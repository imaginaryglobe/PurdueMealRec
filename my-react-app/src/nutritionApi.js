// Utility to fetch nutrition info for a food item by itemId
const API_URL = process.env.NODE_ENV === 'production'
  ? '/.netlify/functions/proxy' // Use Netlify function in production
  : 'https://api.hfs.purdue.edu/menus/v3/GraphQL'; // Direct API in development

export async function fetchNutrition(itemId) {
  const cacheKey = `nutrition_${itemId}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      // Check if cached on a different day (compare YYYY-MM-DD format)
      const cacheDate = new Date(parsed.timestamp).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      if (cacheDate === today) {
        console.log("cache successful");
        return parsed.data;
      }
    } catch (e) {
      // Invalid cache, ignore
    }
  }

  try {
    const query = `query ($id: Guid!) {
      itemByItemId(itemId: $id) {
        itemId
        name
        isNutritionReady
        nutritionFacts {
          name
          value
          label
        }
      }
    }`;

    const variables = { id: itemId };

    let response;
    if (process.env.NODE_ENV === 'production') {
      // Use Netlify function in production
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
      });
    } else {
      // Direct API call in development
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
      });
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const item = data.data?.itemByItemId;

    if (item && item.nutritionFacts && item.nutritionFacts.length > 0) {
      item.servingSize = item.nutritionFacts[0].label;
    }

    // Cache the result
    localStorage.setItem(cacheKey, JSON.stringify({ data: item, timestamp: Date.now() }));
    return item;
  } catch (error) {
    console.error('Error fetching nutrition:', error);
    throw error;
  }
}
