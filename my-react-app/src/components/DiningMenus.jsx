import { useState, useEffect } from 'react';
import ModalWindow from './ModalWindow';
import SidePopout from './SidePopout';
import FoodNutritionPanel from './FoodNutritionPanel';

const diningCourts = ['Earhart', 'Ford', 'Hillenbrand', 'Wiley', 'Windsor'];

function DiningMenus() {
  const [menus, setMenus] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openMeal, setOpenMeal] = useState(null);
  const [openCourt, setOpenCourt] = useState({});
  const [openStation, setOpenStation] = useState({});
  const [openFood, setOpenFood] = useState(null);

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

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
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch menus: ' + err.message);
        setLoading(false);
      });
  }, []);

  const allMeals = Array.from(new Set(
    Object.values(menus)
      .flatMap(menu => menu?.meals?.map(meal => meal.name) || [])
  )).sort((a, b) => {
    const order = ['Breakfast', 'Lunch', 'Dinner'];
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const handleMealClick = (meal) => {
    setOpenMeal(openMeal === meal ? null : meal);
    setOpenCourt({});
    setOpenStation({});
  };

  const handleCourtClick = (meal, court) => {
    setOpenCourt(prev => ({ ...prev, [meal]: prev[meal] === court ? null : court }));
    setOpenStation(prev => ({ ...prev, [`${meal}-${court}`]: null }));
  };

  const handleStationClick = (meal, court, station) => {
    setOpenStation(prev => ({ ...prev, [`${meal}-${court}`]: prev[`${meal}-${court}`] === station ? null : station }));
  };

  if (loading) return <div style={{ padding: 24 }}>Loading menus...</div>;
  if (error) return <div style={{ color: 'red', padding: 24 }}>{error}</div>;

  return (
    <div className="menus-container">
      <h2 className="menus-title">Purdue Dining Menus for Today</h2>
      <div className="dropdown-root">
        {allMeals.map(meal => (
          <div key={meal} className="meal-dropdown">
            <button
              className={`dropdown-btn meal-btn${openMeal === meal ? ' open' : ''}`}
              onClick={() => handleMealClick(meal)}
            >
              {meal}
            </button>
          </div>
        ))}
      </div>

      {openMeal && (
        <ModalWindow onClose={() => setOpenMeal(null)}>
          <h3>Select Dining Court for {openMeal}</h3>
          <div className="modal-list">
            {diningCourts.map(dc => {
              const menu = menus[dc];
              const mealObj = menu?.meals?.find(m => m.name === openMeal);
              if (!mealObj) return null;
              return (
                <button key={dc} className="modal-btn" onClick={() => setOpenCourt({ [openMeal]: dc })}>
                  {dc}
                </button>
              );
            })}
          </div>
        </ModalWindow>
      )}

      {openMeal && openCourt[openMeal] && (() => {
        const dc = openCourt[openMeal];
        const menu = menus[dc];
        const mealObj = menu?.meals?.find(m => m.name === openMeal);
        if (!mealObj) return null;
        const stations = mealObj.stations.filter(station => station.name !== 'By Request');
        return (
          <ModalWindow onClose={() => setOpenCourt({})}>
            <h3>Select Station in {dc}</h3>
            <div className="modal-list">
              {stations.map(station => (
                <button key={station.name} className="modal-btn" onClick={() => setOpenStation({ [`${openMeal}-${dc}`]: station.name })}>
                  {station.name}
                </button>
              ))}
            </div>
          </ModalWindow>
        );
      })()}

      {openMeal && openCourt[openMeal] && openStation[`${openMeal}-${openCourt[openMeal]}`] && (() => {
        const dc = openCourt[openMeal];
        const stationName = openStation[`${openMeal}-${dc}`];
        const menu = menus[dc];
        const mealObj = menu?.meals?.find(m => m.name === openMeal);
        if (!mealObj) return null;
        const station = mealObj.stations.find(s => s.name === stationName);
        if (!station) return null;
        return (
          <SidePopout onClose={() => setOpenStation({ ...openStation, [`${openMeal}-${dc}`]: null })}>
            <h3>Foods at {stationName}</h3>
            <ul className="modal-food-list">
              {station.items.map(item => (
                <li key={item.item.itemId}>
                  <button className="food-nutrition-btn" onClick={() => setOpenFood(item.item)}>
                    {item.item.name}
                  </button>
                </li>
              ))}
            </ul>
          </SidePopout>
        );
      })()}

      {openFood && <FoodNutritionPanel item={openFood} onClose={() => setOpenFood(null)} />}
    </div>
  );
}

export default DiningMenus;