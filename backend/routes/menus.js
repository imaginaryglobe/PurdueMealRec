const express = require('express');
const router = express.Router();
const cache = require('../utils/cache');
const purdueApi = require('../utils/purdueApi');

// Get menu for a specific dining court and date
router.get('/:court/:date', async (req, res) => {
  try {
    const { court, date } = req.params;

    // Check cache first
    const cacheKey = `menu_${court}_${date}`;
    let menuData = cache.get(cacheKey);

    if (!menuData) {
      // Fetch from Purdue API
      menuData = await purdueApi.getMenu(court, date);

      // Cache for 24 hours
      cache.set(cacheKey, menuData, 24 * 60 * 60 * 1000);
    }

    res.json(menuData);
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu data' });
  }
});

// Get all dining courts menu for a date
router.get('/all/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const courts = ['Earhart', 'Ford', 'Hillenbrand', 'Wiley', 'Windsor'];

    const menus = {};
    const promises = courts.map(async (court) => {
      const cacheKey = `menu_${court}_${date}`;
      let menuData = cache.get(cacheKey);

      if (!menuData) {
        menuData = await purdueApi.getMenu(court, date);
        cache.set(cacheKey, menuData, 24 * 60 * 60 * 1000);
      }

      menus[court] = menuData;
    });

    await Promise.all(promises);
    res.json(menus);
  } catch (error) {
    console.error('Error fetching all menus:', error);
    res.status(500).json({ error: 'Failed to fetch menu data' });
  }
});

module.exports = router;