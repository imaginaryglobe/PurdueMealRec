#!/usr/bin/env node
/**
 * MCP server exposing Purdue HFS dining menu/nutrition data as tools.
 * Reuses the GraphQL client from the main app (../graphql-client.js).
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const {
  DINING_COURTS,
  getDiningCourtMenu,
  getAllMenus,
  extractFoodItems
} = require('../graphql-client');

// Toppings that skew ratios when appearing standalone (mirrors public/app.js)
const EXCLUDED_FOODS = new Set([
  'shredded 3 cheese blend',
  'grated parmesan cheese',
  'garlic herb chicken strip'
]);

function jsonResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

async function fetchItems(date, court, meal) {
  let menuResults;
  if (court) {
    const exactCourt = DINING_COURTS.find(c => c.toLowerCase() === court.toLowerCase());
    menuResults = [await getDiningCourtMenu(exactCourt || court, date)];
  } else {
    menuResults = await getAllMenus(date);
  }

  let items = extractFoodItems(menuResults);

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
  version: '1.0.0'
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
    description: 'Get menu items with nutrition facts for a date, optionally filtered by dining court and/or meal.',
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
    description: 'Rank menu items by calories per gram of protein (lower is more protein-efficient). Filters out items under 50 calories or 5g protein.',
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
    description: 'Rank menu items by calories per gram of fiber (lower is more fiber-efficient). Filters out items under 50 calories or with no fiber.',
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
