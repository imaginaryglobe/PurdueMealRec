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
 * In-memory cache for Purdue API responses.
 * Stores the promise, so simultaneous callers share one request, and drops it on failure
 * so errors aren't cached. Pass { fresh: true } to bypass and refill an entry.
 */
const CACHE_TTL_MS = 15 * 60 * 1000;
const REFRESH_COOLDOWN_MS = 60 * 1000; // a refresh is honoured at most once per entry per minute
const MAX_CACHE_ENTRIES = 300;
const cache = new Map(); // key -> { created, expires, promise }

function cached(key, fresh, loader) {
  const now = Date.now();
  const hit = cache.get(key);
  const usable = hit && hit.expires > now;
  const refreshAllowed = !hit || now - hit.created >= REFRESH_COOLDOWN_MS;
  if (usable && !(fresh && refreshAllowed)) return hit.promise;

  // Stay bounded: drop expired entries, then the oldest
  cache.delete(key);
  if (cache.size >= MAX_CACHE_ENTRIES) {
    for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
    while (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  }

  const promise = loader();
  cache.set(key, { created: now, expires: now + CACHE_TTL_MS, promise });
  promise.catch(() => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
  });
  return promise;
}

/**
 * Fetch menu for a specific dining court and date (cached)
 */
function getDiningCourtMenu(name, date, { fresh = false } = {}) {
  return cached(`menu|${name}|${date}`, fresh, () => fetchDiningCourtMenu(name, date));
}

async function fetchDiningCourtMenu(name, date) {
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
async function getAllMenus(date, options) {
  const settled = await Promise.allSettled(
    DINING_COURTS.map(court => getDiningCourtMenu(court, date, options))
  );

  // One failing court shouldn't take down the day; callers can see which ones are missing
  const failures = settled.filter(r => r.status === 'rejected');
  failures.forEach(f => console.error(`Court menu failed for ${date}:`, f.reason?.message));
  if (failures.length === settled.length) throw failures[0].reason;

  return settled.filter(r => r.status === 'fulfilled').map(r => r.value);
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

// Names that suggest a meat/fish item vs. bars, toppings and build-your-own stations
const MEAT_WORDS = /\b(steak|sirloin|ribeye|brisket|chicken|drumsticks?|wings?|beef|pork|ham|turkey|bacon|sausage|salmon|fish|shrimp|meatballs?|ribs?|lamb)\b/i;
const NOT_A_SINGLE_ITEM = /\b(bar|toppings?|sauce|soup|pizza|salad|burrito|broth|gravy)\b|build your own|make your own|^myo\b/i;

/**
 * Meat-related items on the menu that have no published nutrition (isNutritionReady: false),
 * e.g. a steak with "no info available". Existence only; there are no numbers to report.
 * Returns [{ name, location, meal, station }] deduped by (name, court, meal).
 */
function extractNoNutritionItems(menuResults) {
  const items = [];
  const seen = new Set();

  for (const result of menuResults) {
    const court = result.data?.diningCourtByName;
    if (!court?.dailyMenu?.meals) continue;

    for (const meal of court.dailyMenu.meals) {
      if (meal.status === 'CLOSED' || !meal.stations) continue;

      for (const station of meal.stations) {
        for (const appearance of station.items || []) {
          const item = appearance.item;
          if (!item || item.isNutritionReady) continue;
          if (!MEAT_WORDS.test(item.name) || NOT_A_SINGLE_ITEM.test(item.name)) continue;

          const key = `${item.name.toLowerCase()}-${court.name}-${meal.name}`;
          if (seen.has(key)) continue;
          seen.add(key);

          items.push({ name: item.name, location: court.name, meal: meal.name, station: station.name });
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

/**
 * Which proteins are in Earhart's "MYO Stir Fry" on a date.
 * The MYO item has no nutrition of its own; its ingredients live in `components`.
 * Returns { available, beef, chicken, meals, proteins } (available=false when it isn't on the menu).
 *   meals:    [{ name, startTime, endTime }] open meals that serve it
 *   proteins: [{ kind: 'beef' | 'chicken', name, calories, protein, fiber }] from the ingredient list
 * Pass an already-fetched Earhart menu as `menuResult` to skip a duplicate request.
 */
async function getMyoStirFryProteins(date, menuResult, options) {
  const result = menuResult || await getDiningCourtMenu('Earhart', date, options);
  const meals = result.data?.diningCourtByName?.dailyMenu?.meals || [];

  const itemIds = new Set();
  const mealsServing = [];
  for (const meal of meals) {
    if (meal.status === 'CLOSED') continue;
    for (const station of meal.stations || []) {
      for (const appearance of station.items || []) {
        if (/^MYO Stir Fry$/i.test(appearance.item?.name || '')) {
          itemIds.add(appearance.item.itemId);
          if (!mealsServing.some(m => m.name === meal.name)) {
            mealsServing.push({ name: meal.name, startTime: meal.startTime, endTime: meal.endTime });
          }
        }
      }
    }
  }

  if (itemIds.size === 0) {
    return { available: false, beef: false, chicken: false, meals: [], proteins: [] };
  }

  const query = `
    query getComponents($id: Guid!) {
      itemByItemId(itemId: $id) { components { name nutritionFacts { name value } } }
    }
  `;
  const components = [];
  for (const id of itemIds) {
    const res = await cached(`components|${id}`, options?.fresh, () =>
      executeQuery('getComponents', query, { id }));
    components.push(...(res.data?.itemByItemId?.components || []));
  }

  const proteins = [];
  for (const [kind, pattern] of [['beef', /beef/i], ['chicken', /chicken/i]]) {
    const match = components.find(c => pattern.test(c.name));
    if (match) proteins.push({ kind, name: match.name, ...parseNutrition(match.nutritionFacts) });
  }

  return {
    available: true,
    beef: proteins.some(p => p.kind === 'beef'),
    chicken: proteins.some(p => p.kind === 'chicken'),
    meals: mealsServing,
    proteins
  };
}

module.exports = {
  DINING_COURTS,
  executeQuery,
  getDiningCourtMenu,
  getAllMenus,
  extractFoodItems,
  extractNoNutritionItems,
  parseNutrition,
  getMyoStirFryProteins
};
