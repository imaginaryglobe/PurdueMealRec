import { useState, useEffect } from 'react';
import FoodSorter from './components/FoodSorter';
import './App.css';

function App() {
  const [menus, setMenus] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const diningCourts = ['Earhart', 'Ford', 'Hillenbrand', 'Wiley', 'Windsor'];
    
    // Check for cached menu data
    const cacheKey = `menus_${dateStr}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Check if cached today
        const cacheDate = new Date(parsed.timestamp).toDateString();
        const todayStr = new Date().toDateString();
        if (cacheDate === todayStr) {
          console.log("Menu cache hit - using cached data");
          setMenus(parsed.data);
          setLoading(false);
          return; // Skip API calls
        }
      } catch (e) {
        console.log("Invalid menu cache, fetching fresh data");
        // Invalid cache, continue with fetch
      }
    }

    console.log("Fetching fresh menu data");
    Promise.all(
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
          .then(res => res.json())
          .then(data => ({
            name,
            menu: data.data?.diningCourtByName?.dailyMenu || null
          }))
          .catch(() => ({ name, menu: null }))
      )
    )
      .then(results => {
        const menuObj = {};
        results.forEach(({ name, menu }) => {
          menuObj[name] = menu;
        });
        setMenus(menuObj);
        
        // Cache the menu data
        localStorage.setItem(cacheKey, JSON.stringify({ 
          data: menuObj, 
          timestamp: Date.now() 
        }));
        
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch menus: ' + err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (error) return <div style={{ color: 'red', padding: 24 }}>{error}</div>;

  return (
    <>
      <FoodSorter menus={menus} />
    </>
  );
}

export default App;