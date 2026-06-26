/**
 * GraphQL client for Purdue HFS Dining API
 */

const API_URL = 'https://api.hfs.purdue.edu/menus/v3/GraphQL';

// All Purdue dining courts
const DINING_COURTS = ['Earhart', 'Ford', 'Hillenbrand', 'Wiley', 'Windsor'];

/**
 * Execute a GraphQL query against the Purdue API
 */
async function executeQuery(operationName, query, variables = {}) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      operationName,
      query,
      variables
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed: ${response.status} - ${text.substring(0, 200)}`);
  }

  const json = await response.json();

  // Check for GraphQL errors
  if (json.errors && json.errors.length > 0) {
    throw new Error(`GraphQL error: ${json.errors[0].message}`);
  }

  return json;
}

/**
 * Fetch menu for a specific dining court and date
 */
async function getDiningCourtMenu(name, date) {
  const query = `
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
                  traits {
                    name
                    svgIconWithoutBackground
                  }
                  nutritionFacts {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  return executeQuery('getLocationMenu', query, { name, date });
}



/**
 * Fetch all menus for a date from all dining courts
 */
async function getAllMenus(date) {
  const promises = DINING_COURTS.map(court => getDiningCourtMenu(court, date));
  const results = await Promise.all(promises);
  return results;
}

/**
 * Extract all food items from menu data with their locations
 */
function extractFoodItems(menuResults) {
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

          // Create unique key for item at this location/meal
          const key = `${item.itemId}-${court.name}-${meal.name}`;
          if (seenIds.has(key)) continue;
          seenIds.add(key);

          const { calories, protein, fiber } = parseNutrition(item.nutritionFacts);

          items.push({
            itemId: item.itemId,
            name: item.name,
            location: court.name,
            locationFormal: court.formalName,
            station: station.name,
            meal: meal.name,
            mealStart: meal.startTime,
            mealEnd: meal.endTime,
            traits: item.traits || [],
            calories,
            protein,
            fiber
          });
        }
      }
    }
  }

  return items;
}

/**
 * Parse nutrition facts to get calories, protein, and fiber
 */
function parseNutrition(nutritionFacts) {
  let calories = null;
  let protein = null;
  let fiber = null;

  for (const fact of nutritionFacts || []) {
    if (fact.name === 'Calories' && fact.value != null) {
      calories = fact.value;
    } else if (fact.name === 'Protein' && fact.value != null) {
      protein = fact.value;
    } else if (fact.name === 'Dietary Fiber' && fact.value != null) {
      fiber = fact.value;
    }
  }

  return { calories, protein, fiber };
}

module.exports = {
  DINING_COURTS,
  getDiningCourtMenu,
  getAllMenus,
  extractFoodItems,
  parseNutrition
};
