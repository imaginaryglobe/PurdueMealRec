#!/usr/bin/env node
/**
 * MCP server exposing Purdue HFS dining menu/nutrition data as tools.
 * Uses executeQuery from ../graphql-client.js but runs its own richer
 * GraphQL query so every field the API offers (full macros, daily values,
 * ingredients, allergen/preference traits) reaches the model, not just
 * the calories/protein/fiber subset the web app needs.
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const { DINING_COURTS, executeQuery } = require('../graphql-client');

// Toppings that skew ratios when appearing standalone (mirrors public/app.js)
const EXCLUDED_FOODS = new Set([
  'shredded 3 cheese blend',
  'grated parmesan cheese',
  'garlic herb chicken strip'
]);

const FULL_MENU_QUERY = `
  query getLocationMenu($name: String!, $date: Date!) {
    diningCourtByName(name: $name) {
      name
      formalName
      dailyMenu(date: $date) {
        meals {
          name
          status
          startTime
          endTime
          stations {
            name
            items {
              itemMenuId
              item {
                itemId
                name
                isNutritionReady
                ingredients
                traits {
                  name
                  type
                }
                nutritionFacts {
                  name
                  value
                  label
                  dailyValueLabel
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Maps the API's free-text nutrition fact names to stable camelCase keys.
// Anything not in this map still comes through in the raw `nutritionFacts` array.
const NUTRITION_KEY_MAP = {
  'Serving Size': 'servingSize',
  'Calories': 'calories',
  'Calories from fat': 'caloriesFromFat',
  'Total fat': 'totalFat',
  'Saturated fat': 'saturatedFat',
  'Trans Fat': 'transFat',
  'Cholesterol': 'cholesterol',
  'Sodium': 'sodium',
  'Total Carbohydrate': 'totalCarbohydrate',
  'Sugar': 'sugar',
  'Added Sugar': 'addedSugar',
  'Dietary Fiber': 'fiber',
  'Protein': 'protein',
  'Calcium': 'calcium',
  'Iron': 'iron',
  'Potassium': 'potassium',
  'Vitamin D': 'vitaminD'
};

function getFullDiningCourtMenu(name, date) {
  return executeQuery('getLocationMenu', FULL_MENU_QUERY, { name, date });
}

function getAllFullMenus(date) {
  return Promise.all(DINING_COURTS.map(court => getFullDiningCourtMenu(court, date)));
}

/**
 * Flatten nutritionFacts into named numeric fields (for easy sorting/ratios)
 * while also keeping the raw array (with label + % daily value) intact.
 */
function parseFullNutrition(nutritionFacts) {
  const parsed = {};
  for (const fact of nutritionFacts || []) {
    const key = NUTRITION_KEY_MAP[fact.name];
    if (key && fact.value != null) {
      parsed[key] = fact.value;
    }
  }
  return parsed;
}

function extractFullFoodItems(menuResults) {
  const items = [];
  const seenIds = new Set();

  for (const result of menuResults) {
    const court = result.data?.diningCourtByName;
    if (!court?.dailyMenu?.meals) continue;

    for (const meal of court.dailyMenu.meals) {
      if (meal.status === 'CLOSED' || !meal.stations) continue;

      for (const station of meal.stations) {
        for (const itemAppearance of station.items || []) {
          const item = itemAppearance.item;
          if (!item || !item.isNutritionReady) continue;

          const key = `${item.itemId}-${court.name}-${meal.name}`;
          if (seenIds.has(key)) continue;
          seenIds.add(key);

          const nutrition = parseFullNutrition(item.nutritionFacts);

          items.push({
            itemId: item.itemId,
            name: item.name,
            location: court.name,
            locationFormal: court.formalName,
            station: station.name,
            meal: meal.name,
            mealStart: meal.startTime,
            mealEnd: meal.endTime,
            ingredients: item.ingredients || null,
            traits: item.traits || [],
            nutritionFacts: item.nutritionFacts || [],
            ...nutrition
          });
        }
      }
    }
  }

  return items;
}

function jsonResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

async function fetchItems(date, court, meal) {
  let menuResults;
  if (court) {
    const exactCourt = DINING_COURTS.find(c => c.toLowerCase() === court.toLowerCase());
    menuResults = [await getFullDiningCourtMenu(exactCourt || court, date)];
  } else {
    menuResults = await getAllFullMenus(date);
  }

  let items = extractFullFoodItems(menuResults);

  if (court) {
    items = items.filter(item => item.location.toLowerCase() === court.toLowerCase());
  }
  if (meal) {
    items = items.filter(item => item.meal.toLowerCase() === meal.toLowerCase());
  }

  return items.filter(item => !EXCLUDED_FOODS.has(item.name.toLowerCase()));
}

const server = new McpServer({
  name: 'purdue-dining',
  version: '1.1.0'
});

server.registerTool(
  'list_dining_courts',
  {
    title: 'List dining courts',
    description: 'List the Purdue dining courts available to query (Earhart, Ford, Hillenbrand, Wiley, Windsor).',
    inputSchema: {}
  },
  async () => jsonResult(DINING_COURTS)
);

server.registerTool(
  'get_menu',
  {
    title: 'Get dining menu',
    description: 'Get full menu items for a date, optionally filtered by dining court and/or meal. Each item includes every nutrition fact the API exposes (calories, total/saturated fat, cholesterol, sodium, carbs, sugar, added sugar, fiber, protein, calcium, iron, % daily values), the ingredients list, and allergen/dietary-preference traits — not just calories/protein/fiber.',
    inputSchema: {
      date: z.string().describe('Date in YYYY-MM-DD format'),
      court: z.string().optional().describe('Dining court name, e.g. "Earhart". Omit for all courts.'),
      meal: z.string().optional().describe('Meal name, e.g. "Breakfast", "Lunch", "Dinner". Omit for all meals.')
    }
  },
  async ({ date, court, meal }) => {
    const items = await fetchItems(date, court, meal);
    return jsonResult({ date, count: items.length, items });
  }
);

server.registerTool(
  'best_protein_sources',
  {
    title: 'Best protein sources',
    description: 'Rank menu items by calories per gram of protein (lower is more protein-efficient). Filters out items under 50 calories or 5g protein. Each returned item still includes the full nutrition breakdown (fat, sodium, carbs, sugar, etc.), ingredients, and traits.',
    inputSchema: {
      date: z.string().describe('Date in YYYY-MM-DD format'),
      court: z.string().optional().describe('Dining court name. Omit for all courts.'),
      meal: z.string().optional().describe('Meal name: Breakfast, Lunch, or Dinner. Omit for all meals.'),
      limit: z.number().int().positive().optional().default(10).describe('Max number of items to return.')
    }
  },
  async ({ date, court, meal, limit }) => {
    const items = await fetchItems(date, court, meal);
    const ranked = items
      .filter(item => item.calories != null && item.calories >= 50 && item.protein != null && item.protein >= 5)
      .map(item => ({ ...item, caloriesPerGramProtein: item.calories / item.protein }))
      .sort((a, b) => a.caloriesPerGramProtein - b.caloriesPerGramProtein)
      .slice(0, limit);
    return jsonResult({ date, count: ranked.length, items: ranked });
  }
);

server.registerTool(
  'best_fiber_sources',
  {
    title: 'Best fiber sources',
    description: 'Rank menu items by calories per gram of fiber (lower is more fiber-efficient). Filters out items under 50 calories or with no fiber. Each returned item still includes the full nutrition breakdown (fat, sodium, carbs, sugar, etc.), ingredients, and traits.',
    inputSchema: {
      date: z.string().describe('Date in YYYY-MM-DD format'),
      court: z.string().optional().describe('Dining court name. Omit for all courts.'),
      meal: z.string().optional().describe('Meal name: Breakfast, Lunch, or Dinner. Omit for all meals.'),
      limit: z.number().int().positive().optional().default(10).describe('Max number of items to return.')
    }
  },
  async ({ date, court, meal, limit }) => {
    const items = await fetchItems(date, court, meal);
    const ranked = items
      .filter(item => item.calories != null && item.calories >= 50 && item.fiber != null && item.fiber > 0)
      .map(item => ({ ...item, caloriesPerGramFiber: item.calories / item.fiber }))
      .sort((a, b) => a.caloriesPerGramFiber - b.caloriesPerGramFiber)
      .slice(0, limit);
    return jsonResult({ date, count: ranked.length, items: ranked });
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error('Fatal error running MCP server:', err);
  process.exit(1);
});
