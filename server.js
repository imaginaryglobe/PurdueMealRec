const express = require('express');
const path = require('path');
const {
    DINING_COURTS,
    getDiningCourtMenu,
    getAllMenus,
    extractFoodItems,
    extractNoNutritionItems,
    getMyoStirFryProteins
} = require('./graphql-client');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));


const MAX_DAYS_AWAY = 14;

/**
 * Returns an error message if `date` isn't a real YYYY-MM-DD within MAX_DAYS_AWAY of today
 * (Eastern time), otherwise null. Keeps junk dates from reaching Purdue or filling the cache.
 */
function validateDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Date must look like YYYY-MM-DD';

    const target = new Date(`${date}T12:00:00Z`);
    if (Number.isNaN(target.getTime()) || target.toISOString().slice(0, 10) !== date) {
        return 'Not a real calendar date';
    }

    const today = new Date(`${new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })}T12:00:00Z`);
    const daysAway = Math.abs(Math.round((target - today) / 86400000));
    if (daysAway > MAX_DAYS_AWAY) return `Date must be within ${MAX_DAYS_AWAY} days of today`;

    return null;
}

/**
 * GET /api/dining-courts
 * Returns list of all dining courts
 */
app.get('/api/dining-courts', (req, res) => {
    res.json(DINING_COURTS);
});

/**
 * GET /api/top-foods/:date
 * Returns all foods for a date, sorted by calories per gram of protein
 * Query params:
 *   - court: filter by dining court name
 *   - meal: filter by meal name (Breakfast, Lunch, Dinner)
 */
app.get('/api/top-foods/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { court, meal } = req.query;

        const dateError = validateDate(date);
        if (dateError) return res.status(400).json({ error: dateError });
        // ?refresh=1 bypasses the cache and refills it with fresh data
        const options = { fresh: req.query.refresh === '1' };

        console.log(`Fetching menus for ${date}${options.fresh ? ' (refresh)' : ''}...`);

        let menuResults;
        if (court) {
            const exactCourt = DINING_COURTS.find(c => c.toLowerCase() === court.toLowerCase());
            if (exactCourt) {
                menuResults = [await getDiningCourtMenu(exactCourt, date, options)];
            } else {
                menuResults = await getAllMenus(date, options);
            }
        } else {
            // Fetch all menus
            menuResults = await getAllMenus(date, options);
        }

        // Extract food items with nutrition already included
        let items = extractFoodItems(menuResults);
        console.log(`Found ${items.length} menu items with nutrition ready`);

        // Apply filters
        if (court) {
            items = items.filter(item => item.location.toLowerCase() === court.toLowerCase());
        }
        if (meal) {
            items = items.filter(item => item.meal.toLowerCase() === meal.toLowerCase());
        }

        // Earhart's MYO Stir Fry has no nutrition of its own, so add its beef / chicken
        // ingredients as ranked items (tagged with an emoji so the UI can mark them).
        let stirFryInfo = null;
        if (!court || court.toLowerCase() === 'earhart') {
            try {
                const earhartMenu = menuResults.find(r => r.data?.diningCourtByName?.name === 'Earhart');
                const stirFry = await getMyoStirFryProteins(date, earhartMenu, options);
                stirFryInfo = { available: stirFry.available, beef: stirFry.beef, chicken: stirFry.chicken };
                for (const mealInfo of stirFry.meals) {
                    if (meal && mealInfo.name.toLowerCase() !== meal.toLowerCase()) continue;
                    for (const p of stirFry.proteins) {
                        items.push({
                            itemId: `myo-stir-fry-${p.kind}`,
                            name: `MYO Stir Fry ${p.kind === 'beef' ? 'Beef' : 'Chicken'}`,
                            emoji: p.kind === 'beef' ? '🐄' : '🐔',
                            location: 'Earhart',
                            locationFormal: 'Earhart',
                            station: 'The Gallery',
                            meal: mealInfo.name,
                            mealStart: mealInfo.startTime,
                            mealEnd: mealInfo.endTime,
                            traits: [],
                            calories: p.calories,
                            protein: p.protein,
                            fiber: p.fiber
                        });
                    }
                }
            } catch (err) {
                console.error('Could not add MYO stir fry items:', err.message);
            }
        }

        // Calculate ratios
        const itemsWithNutrition = items.map(item => {
            const { calories, protein, fiber } = item;

            // Calculate calories per gram of protein
            let ratio = null;
            if (calories != null && protein != null && protein > 0) {
                ratio = calories / protein;
            }

            // Calculate calories per gram of fiber
            let fiberRatio = null;
            if (calories != null && fiber != null && fiber > 0) {
                fiberRatio = calories / fiber;
            }

            return { ...item, ratio, fiberRatio };
        });

        // Keep items valid for either protein or fiber sort mode
        const validItems = itemsWithNutrition.filter(item =>
            item.ratio != null || item.fiberRatio != null
        );

        console.log(`Returning ${validItems.length} items with nutrition data`);

        // Meat items with no published nutrition: listed separately, never ranked
        let noNutrition = extractNoNutritionItems(menuResults);
        if (court) noNutrition = noNutrition.filter(i => i.location.toLowerCase() === court.toLowerCase());
        if (meal) noNutrition = noNutrition.filter(i => i.meal.toLowerCase() === meal.toLowerCase());

        // Courts whose menu couldn't be loaded (the rest are still returned)
        const failedCourts = court
            ? []
            : DINING_COURTS.filter(c => !menuResults.some(r => r.data?.diningCourtByName?.name === c));

        res.json({
            date,
            count: validItems.length,
            stirFry: stirFryInfo,
            failedCourts,
            noNutrition,
            items: validItems
        });

    } catch (error) {
        // Log the detail, but don't pass Purdue's raw error text on to the browser
        console.error('Error fetching top foods:', error);
        res.status(500).json({ error: 'Failed to fetch menu data' });
    }
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🍽️  Purdue Dining Recommender running at http://localhost:${PORT}`);
});
