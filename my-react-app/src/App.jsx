import { useState, useEffect } from 'react';
import FoodRecommender from './components/FoodRecommender';
import FoodSorter from './components/FoodSorter';
import './App.css';

const BACKEND_URL = process.env.NODE_ENV === 'production'
  ? 'https://your-backend-url.com' // Update this for production
  : 'http://localhost:3001';

function App() {
  const [menus, setMenus] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log("App useEffect running - fetching menu data");
    
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const diningCourts = ['Earhart', 'Ford', 'Hillenbrand', 'Wiley', 'Windsor'];
    
    // Clean up old cache entries (older than 7 days)
    const cleanupOldCache = () => {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('menus_') || key.startsWith('nutrition_'))) {
          try {
            const value = localStorage.getItem(key);
            const parsed = JSON.parse(value);
            if (parsed.timestamp && parsed.timestamp < sevenDaysAgo) {
              localStorage.removeItem(key);
            }
          } catch (e) {
            // Remove corrupted cache entries
            localStorage.removeItem(key);
          }
        }
      }
    };
    
    cleanupOldCache();
    const cacheKey = `menus_${dateStr}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Check if cached today (compare YYYY-MM-DD format)
        const cacheDate = new Date(parsed.timestamp).toISOString().split('T')[0];
        const todayStr = new Date().toISOString().split('T')[0];
        if (cacheDate === todayStr) {
          console.log("Menu cache hit - using cached data", parsed.data);
          setMenus(parsed.data);
          setLoading(false);
          return; // Skip API calls
        }
      } catch (e) {
        console.log("Invalid menu cache, fetching fresh data");
        // Invalid cache, continue with fetch
      }
    }

    console.log("Fetching fresh menu data from backend");

    // Try backend API first, fallback to direct API
    fetch(`${BACKEND_URL}/api/menus/all/${dateStr}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Backend API error: ${res.status}`);
        }
        return res.json();
      })
      .then(menuObj => {
        console.log("Backend API success:", menuObj);
        setMenus(menuObj);

        // Cache the menu data
        localStorage.setItem(cacheKey, JSON.stringify({
          data: menuObj,
          timestamp: Date.now()
        }));

        setLoading(false);
      })
      .catch(backendError => {
        console.log("Backend API failed, falling back to direct API:", backendError);
        // Fallback to direct API calls
        return fetchMenusDirect(dateStr);
      });
  }, []);

  const fetchMenusDirect = async (dateStr) => {
    const diningCourts = ['Earhart', 'Ford', 'Hillenbrand', 'Wiley', 'Windsor'];

    try {
      const results = await Promise.all(
        diningCourts.map(name =>
          fetch('https://api.hfs.purdue.edu/menus/v3/GraphQL', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operationName: 'getLocationMenu',
              variables: { name, date: dateStr },
              query: `query getLocationMenu($name: String!, $date: Date!) {\n  diningCourtByName(name: $name) {\n    dailyMenu(date: $date) {\n      meals {\n        name\n        stations {\n          name\n          items {\n            item {\n              itemId\n              name\n            }\n          }\n        }\n      }\n    }\n  }\n}`
            })
          })
            .then(res => {
              console.log(`API response for ${name}:`, res.status);
              return res.json();
            })
            .then(data => {
              console.log(`Parsed data for ${name}:`, data);
              return {
                name,
                menu: data.data?.diningCourtByName?.dailyMenu || null
              };
            })
            .catch(err => {
              console.error(`Error fetching ${name}:`, err);
              return { name, menu: null };
            })
        )
      );

      console.log("All API results:", results);
      const menuObj = {};
      results.forEach(({ name, menu }) => {
        menuObj[name] = menu;
      });
      console.log("Final menu object:", menuObj);
      setMenus(menuObj);

      // Cache the menu data
      localStorage.setItem(`menus_${dateStr}`, JSON.stringify({
        data: menuObj,
        timestamp: Date.now()
      }));

      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch menus:', err);
      setError('Failed to fetch menus: ' + err.message);
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (error) return <div style={{ color: 'red', padding: 24 }}>{error}</div>;

  return (
    <>
      <FoodRecommender menus={menus} />
      <div style={{ marginTop: '40px', borderTop: '2px solid #e9ecef', paddingTop: '40px' }}>
        <FoodSorter menus={menus} />
      </div>
    </>
  );
}

export default App;