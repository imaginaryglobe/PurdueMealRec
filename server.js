const express = require('express');
const path = require('path');
const {
    DINING_COURTS,
    getDiningCourtMenu,
    getAllMenus,
    extractFoodItems
} = require('./graphql-client');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));


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

        console.log(`Fetching menus for ${date}...`);

        let menuResults;
        if (court) {
            const exactCourt = DINING_COURTS.find(c => c.toLowerCase() === court.toLowerCase());
            if (exactCourt) {
                menuResults = [await getDiningCourtMenu(exactCourt, date)];
            } else {
                menuResults = await getAllMenus(date);
            }
        } else {
            // Fetch all menus
            menuResults = await getAllMenus(date);
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

        res.json({
            date,
            count: validItems.length,
            items: validItems
        });

    } catch (error) {
        console.error('Error fetching top foods:', error);
        res.status(500).json({ error: 'Failed to fetch menu data', details: error.message });
    }
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🍽️  Purdue Dining Recommender running at http://localhost:${PORT}`);
});
