const express = require('express');
const router = express.Router();
const cache = require('../utils/cache');
const purdueApi = require('../utils/purdueApi');

// Get nutrition info for a specific food item
router.get('/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    // Check cache first
    const cacheKey = `nutrition_${itemId}`;
    let nutritionData = cache.get(cacheKey);

    if (!nutritionData) {
      // Fetch from Purdue API
      nutritionData = await purdueApi.getNutrition(itemId);

      // Cache for 24 hours
      cache.set(cacheKey, nutritionData, 24 * 60 * 60 * 1000);
    }

    res.json(nutritionData);
  } catch (error) {
    console.error('Error fetching nutrition:', error);
    res.status(500).json({ error: 'Failed to fetch nutrition data' });
  }
});

// Get nutrition for multiple items
router.post('/batch', async (req, res) => {
  try {
    const { itemIds } = req.body;

    if (!Array.isArray(itemIds)) {
      return res.status(400).json({ error: 'itemIds must be an array' });
    }

    const nutritionData = {};
    const promises = itemIds.map(async (itemId) => {
      const cacheKey = `nutrition_${itemId}`;
      let data = cache.get(cacheKey);

      if (!data) {
        data = await purdueApi.getNutrition(itemId);
        cache.set(cacheKey, data, 24 * 60 * 60 * 1000);
      }

      nutritionData[itemId] = data;
    });

    await Promise.all(promises);
    res.json(nutritionData);
  } catch (error) {
    console.error('Error fetching batch nutrition:', error);
    res.status(500).json({ error: 'Failed to fetch nutrition data' });
  }
});

module.exports = router;