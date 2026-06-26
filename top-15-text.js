const {
  getAllMenus,
  getDiningCourtMenu,
  extractFoodItems,
  DINING_COURTS
} = require('./graphql-client');

const EXCLUDED_FOODS = new Set([
  'shredded 3 cheese blend',
  'grated parmesan cheese',
  'garlic herb chicken strip'
]);

function getEasternDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '--';
}

function applyRankingFilters(items, { court, meal, sort }) {
  let filtered = [...items];

  if (court && court.toLowerCase() !== 'all') {
    filtered = filtered.filter(item => item.location.toLowerCase() === court.toLowerCase());
  }

  if (meal && meal.toLowerCase() !== 'all') {
    filtered = filtered.filter(item => item.meal.toLowerCase() === meal.toLowerCase());
  }

  filtered = filtered.filter(item => !EXCLUDED_FOODS.has(item.name.toLowerCase()));

  if (sort === 'fiber') {
    return filtered
      .filter(item => item.calories >= 50 && item.fiber > 0 && item.fiberRatio != null)
      .sort((a, b) => a.fiberRatio - b.fiberRatio);
  }

  return filtered
    .filter(item => item.calories >= 50 && item.protein >= 5 && item.ratio != null)
    .sort((a, b) => a.ratio - b.ratio);
}

async function getRankedFoods({ date, court = 'all', meal = 'Lunch', sort = 'protein' }) {
  let menuResults;
  if (court && court.toLowerCase() !== 'all') {
      const exactCourt = DINING_COURTS.find(c => c.toLowerCase() === court.toLowerCase());
      if (exactCourt) {
          menuResults = [await getDiningCourtMenu(exactCourt, date)];
      } else {
          menuResults = await getAllMenus(date);
      }
  } else {
      menuResults = await getAllMenus(date);
  }

  const items = extractFoodItems(menuResults);

  const itemsWithNutrition = items.map(item => {
    const { calories, protein, fiber } = item;

    return {
      ...item,
      ratio: calories != null && protein > 0 ? calories / protein : null,
      fiberRatio: calories != null && fiber > 0 ? calories / fiber : null
    };
  });

  return applyRankingFilters(itemsWithNutrition, { court, meal, sort });
}

function buildMessage({ date, meal, court, sort, foods }) {
  const metricLabel = sort === 'fiber' ? 'cal/fiber' : 'cal/protein';
  const titleCourt = court && court.toLowerCase() !== 'all' ? ` at ${court}` : '';
  const lines = foods.slice(0, 15).map((item, index) => {
    const metric = sort === 'fiber' ? item.fiberRatio : item.ratio;
    const macro = sort === 'fiber'
      ? `${Math.round(item.fiber)}g fiber`
      : `${Math.round(item.protein)}g protein`;

    return `${index + 1}. ${item.name} (${item.location}, ${Math.round(item.calories)} cal, ${macro}, ${formatNumber(metric)} ${metricLabel})`;
  });

  if (lines.length === 0) {
    return `Top Purdue foods for ${meal}${titleCourt} on ${date}: no matching foods found yet.`;
  }

  return `Top ${lines.length} Purdue foods for ${meal}${titleCourt} on ${date}\n\n${lines.join('\n')}`;
}

async function main() {
  const date = process.env.TOP_FOODS_DATE || getEasternDate();
  const meal = process.env.TOP_FOODS_MEAL || 'Lunch';
  const court = process.env.TOP_FOODS_COURT || 'all';
  const sort = process.env.TOP_FOODS_SORT || 'protein';

  const foods = await getRankedFoods({ date, court, meal, sort });
  const message = buildMessage({ date, meal, court, sort, foods });

  console.log(message);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  getRankedFoods,
  buildMessage
};
