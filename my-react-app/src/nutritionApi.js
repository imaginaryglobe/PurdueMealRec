// Utility to fetch nutrition info for a food item by itemId
export async function fetchNutrition(itemId) {
  const cacheKey = `nutrition_${itemId}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      // Check if cached on a different day
      const cacheDate = new Date(parsed.timestamp).toDateString();
      const today = new Date().toDateString();
      if (cacheDate === today) {
        console.log("cache successful");
        return parsed.data;
      }
    } catch (e) {
      // Invalid cache, ignore
    }
  }

  const res = await fetch('/.netlify/functions/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      variables: { id: itemId },
      query: `query ($id: Guid!) {\n  itemByItemId(itemId: $id) {\n    itemId\n    name\n    isNutritionReady\n    nutritionFacts {\n      name\n      value\n      label\n    }\n  }\n}`
    })
  });
  const data = await res.json();
  const item = data.data?.itemByItemId;
  if (item && item.nutritionFacts && item.nutritionFacts.length > 0) {
    item.servingSize = item.nutritionFacts[0].label;
  }
  // Cache the result
  localStorage.setItem(cacheKey, JSON.stringify({ data: item, timestamp: Date.now() }));
  return item;
}
