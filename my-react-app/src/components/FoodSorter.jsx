import { useState, useEffect } from 'react';
import { fetchNutrition } from '../nutritionApi';
import SidePopout from './SidePopout';

function FoodNutritionModal({ food, nutritionData, onClose }) {
  return (
    <SidePopout onClose={onClose}>
      <div style={{ position: 'relative', padding: '20px', width: '350px' }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: '#666'
          }}
        >
          ✕
        </button>
        <h3 style={{ marginTop: 0, marginLeft: 30, marginBottom: 16 }}>{food.name}</h3>
        {nutritionData ? (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: '1.1rem' }}>Nutrition Facts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {nutritionData.nutritionFacts.slice(1).map(fact => (
                <div key={fact.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', padding: '4px 0' }}>
                  <span>{fact.name}</span>
                  <span>{Math.round(fact.value)}{fact.unit ? ` ${fact.unit}` : ''}{fact.label ? ` (${fact.label})` : ''}</span>
                </div>
              ))}
            </div>
            {nutritionData.servingSize && (
              <div style={{ marginTop: 12, fontStyle: 'italic', color: '#555', fontSize: '0.95rem' }}>Serving Size: {nutritionData.servingSize}</div>
            )}
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center' }}>Loading nutrition info...</div>
        )}
      </div>
    </SidePopout>
  );
}

const nutrientKeys = {
  'Calories': ['Calories', 'calories'],
  'Total Fat': ['Total Fat', 'Total fat', 'total fat'],
  'Protein': ['Protein', 'protein'],
  'Sodium': ['Sodium', 'sodium'],
  'Carbohydrates': ['Carbohydrates', 'Total Carbohydrate', 'Carbohydrate', 'carbohydrates'],
};

function getNutrientValue(nutritionData, nutrient) {
  if (!nutritionData || !nutritionData.nutritionFacts) return null;
  const keys = nutrientKeys[nutrient] || [nutrient];
  for (const k of keys) {
    const found = nutritionData.nutritionFacts.find(f => f.name === k);
    if (found && !isNaN(Number(found.value))) return Number(found.value);
  }
  return null;
}

function FoodSorter({ menus }) {
  const [foods, setFoods] = useState([]);
  const [nutritionMap, setNutritionMap] = useState({});
  const [selectedFood, setSelectedFood] = useState(null);
  const [sortBy, setSortBy] = useState('Calories');
  const [sortOrder, setSortOrder] = useState('desc');
  const [mealFilter, setMealFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingNutrition, setLoadingNutrition] = useState(false);
  const [menuCachedAt, setMenuCachedAt] = useState(null);

  useEffect(() => {
    const allFoods = [];
    Object.entries(menus).forEach(([hall, menu]) => {
      menu?.meals?.forEach(meal => {
        meal.stations?.forEach(station => {
          if (station.name !== 'By Request') {
            station.items?.forEach(item => {
              allFoods.push({
                ...item.item,
                meal: meal.name,
                hall,
                servingSize: item.item.servingSize || null
              });
            });
          }
        });
      });
    });
    const uniqueFoods = Object.values(
      Object.fromEntries(allFoods.map(f => [`${f.itemId}-${f.meal}-${f.hall}`, f]))
    );
    setFoods(uniqueFoods);
    
    // Set cache timestamp when menu is first loaded
    if (uniqueFoods.length > 0 && !menuCachedAt) {
      // Try to get actual cache timestamp from localStorage
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const cacheKey = `menus_${dateStr}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setMenuCachedAt(new Date(parsed.timestamp).toLocaleString());
        } catch (e) {
          setMenuCachedAt(new Date().toLocaleString());
        }
      } else {
        setMenuCachedAt(new Date().toLocaleString());
      }
    }
  }, [menus, menuCachedAt]);

  useEffect(() => {
    if (!foods.length) return;
    const fetchAllNutrition = async () => {
      setLoadingNutrition(true);
      const promises = foods.map(async (food) => {
        const key = `${food.itemId}-${food.meal}-${food.hall}`;
        if (nutritionMap[key]) return;
        try {
          const data = await fetchNutrition(food.itemId);
          setNutritionMap(prev => ({ ...prev, [key]: data }));
        } catch (err) {
          setNutritionMap(prev => ({ ...prev, [key]: null }));
        }
      });
      await Promise.all(promises);
      setLoadingNutrition(false);
    };
    fetchAllNutrition();
  }, [sortBy, sortOrder, mealFilter, foods]);

  const handleFoodClick = (food) => {
    setSelectedFood(food);
  };

  const filteredFoods = mealFilter === 'All' ? foods : foods.filter(f => f.meal === mealFilter);
  const searchedFoods = searchTerm ? filteredFoods.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())) : filteredFoods;
  const sortedFoods = [...searchedFoods].sort((a, b) => {
    const keyA = `${a.itemId}-${a.meal}-${a.hall}`;
    const keyB = `${b.itemId}-${b.meal}-${b.hall}`;
    const nutritionA = nutritionMap[keyA];
    const nutritionB = nutritionMap[keyB];
    let valA, valB;
    if (sortBy === 'CaloriesPerProtein') {
      const calsA = getNutrientValue(nutritionA, 'Calories');
      const proteinA = getNutrientValue(nutritionA, 'Protein');
      valA = calsA && proteinA ? Math.round(calsA / proteinA) : null;
      const calsB = getNutrientValue(nutritionB, 'Calories');
      const proteinB = getNutrientValue(nutritionB, 'Protein');
      valB = calsB && proteinB ? Math.round(calsB / proteinB) : null;
    } else {
      valA = getNutrientValue(nutritionA, sortBy);
      valB = getNutrientValue(nutritionB, sortBy);
    }
    if (valA !== null && valB !== null) {
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    }
    if (valA !== null) return -1;
    if (valB !== null) return 1;
    return 0;
  });

  const sortOptions = [
    { key: 'Calories', label: 'Calories', class: 'calories-bubble' },
    { key: 'Total Fat', label: 'Fat', class: 'total-fat-bubble' },
    { key: 'Protein', label: 'Protein', class: 'protein-bubble' },
    { key: 'Sodium', label: 'Sodium', class: 'sodium-bubble' },
    { key: 'Carbohydrates', label: 'Carbs', class: 'carbohydrates-bubble' },
    { key: 'CaloriesPerProtein', label: 'Cal/g Protein', class: 'calories-per-protein-bubble' }
  ];

  return (
    <div className="food-sorter">
      <h3>All Foods (Click for Nutrition)</h3>
      {menuCachedAt && (
        <div style={{ 
          fontSize: '0.9rem', 
          color: '#666', 
          marginBottom: '16px',
          fontStyle: 'italic',
          padding: '8px 12px',
          background: '#f8f9fa',
          borderRadius: '6px',
          border: '1px solid #e9ecef',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Menu cached at: {menuCachedAt}</span>
          <button
            onClick={() => {
              // Clear menu cache and reload
              const today = new Date();
              const yyyy = today.getFullYear();
              const mm = String(today.getMonth() + 1).padStart(2, '0');
              const dd = String(today.getDate()).padStart(2, '0');
              const dateStr = `${yyyy}-${mm}-${dd}`;
              localStorage.removeItem(`menus_${dateStr}`);
              window.location.reload();
            }}
            style={{
              padding: '4px 8px',
              fontSize: '0.8rem',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="Force refresh menu data"
          >
            🔄 Refresh
          </button>
        </div>
      )}
      <div className="sort-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Search foods..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #b5c6e0',
              fontSize: '1rem',
              width: '100%',
              maxWidth: '300px'
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                marginLeft: 8,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #b5c6e0',
                background: '#f6faff',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div>
          <label>Sort by: </label>
          <div className="sort-buttons">
            {sortOptions.map(({ key, label, class: bubbleClass }) => (
              <button
                key={key}
                className={`bubble ${bubbleClass} ${sortBy === key ? 'active' : ''}`}
                onClick={() => setSortBy(key)}
                style={{ cursor: 'pointer', border: 'none' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label>Meal: </label>
          <div className="sort-buttons">
            {['All', 'Breakfast', 'Lunch', 'Dinner'].map(meal => (
              <button
                key={meal}
                className={`bubble meal-bubble ${mealFilter === meal ? 'active' : ''}`}
                onClick={() => setMealFilter(meal)}
                style={{ cursor: 'pointer', border: 'none', background: mealFilter === meal ? '#d0e2ff' : '#f6faff' }}
              >
                {meal}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')} style={{ marginLeft: 8, fontSize: '1rem' }}>
          {sortOrder === 'desc' ? '▼' : '▲'}
        </button>
      </div>
      <ul style={{ marginTop: 18, padding: 0, listStyle: 'none' }}>
        <li style={{ textAlign: 'center', padding: '10px', fontSize: '0.9rem', color: '#666' }}>
          Showing {sortedFoods.length} of {foods.length} foods
        </li>
        {loadingNutrition && <li style={{ textAlign: 'center', padding: '20px' }}>Loading nutrition data...</li>}
        {sortedFoods.map(food => {
          const key = `${food.itemId}-${food.meal}-${food.hall}`;
          const nutritionData = nutritionMap[key];
          const cals = getNutrientValue(nutritionData, 'Calories') ? Math.round(getNutrientValue(nutritionData, 'Calories')) : null;
          const fat = getNutrientValue(nutritionData, 'Total Fat') ? Math.round(getNutrientValue(nutritionData, 'Total Fat')) : null;
          const protein = getNutrientValue(nutritionData, 'Protein') ? Math.round(getNutrientValue(nutritionData, 'Protein')) : null;
          const carbs = getNutrientValue(nutritionData, 'Carbohydrates') ? Math.round(getNutrientValue(nutritionData, 'Carbohydrates')) : null;
          const sodium = getNutrientValue(nutritionData, 'Sodium') ? Math.round(getNutrientValue(nutritionData, 'Sodium')) : null;
          const proteinPerCal = cals && protein ? Math.round(cals / protein) : null;
          const bubbles = [
            { label: 'Cals', value: cals, unit: '', class: 'calories-bubble', key: 'Calories' },
            { label: 'Fat', value: fat, unit: 'g', class: 'total-fat-bubble', key: 'Total Fat' },
            { label: 'Protein', value: protein, unit: 'g', class: 'protein-bubble', key: 'Protein' },
            { label: 'Carbs', value: carbs, unit: 'g', class: 'carbohydrates-bubble', key: 'Carbohydrates' },
            { label: 'Sodium', value: sodium, unit: 'mg', class: 'sodium-bubble', key: 'Sodium' },
          ];
          bubbles.sort((a, b) => a.key === sortBy ? -1 : b.key === sortBy ? 1 : 0);
          return (
            <li key={key} className="food-list-item" style={{ padding: '10px 0', borderBottom: '1px solid #eee', fontSize: '1.04rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  className="food-nutrition-btn"
                  style={{ fontWeight: 600, fontSize: '1.05rem', background: '#eaf3ff', color: '#1a3a5d', border: '1px solid #b5c6e0', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}
                  onClick={() => handleFoodClick(food)}
                >
                  {food.name}
                </button>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {sortBy === 'CaloriesPerProtein' && nutritionData && <span className={`bubble protein-bubble ${proteinPerCal === null ? 'nutrition-missing' : ''}`}>cal/g protein: {proteinPerCal !== null ? proteinPerCal : '--'}</span>}
                  {bubbles.map(({ label, value, unit, class: bubbleClass, key: bubbleKey }) => (
                    <span key={bubbleKey} className={`bubble ${bubbleClass} ${value === null ? 'nutrition-missing' : ''}`} title={`${label}: ${value !== null ? value + unit : 'Not available'}`}>
                      {label}: {value !== null ? value + unit : '--'}
                    </span>
                  ))}
                  <span className={`bubble serving-bubble ${!nutritionData?.servingSize ? 'nutrition-missing' : ''}`} title={`Serving Size: ${nutritionData?.servingSize || 'Not available'}`}>Serving: {nutritionData?.servingSize || '--'}</span>
                  {sortBy !== 'CaloriesPerProtein' && nutritionData && proteinPerCal !== null && <span className={`bubble protein-bubble`}>cal/g protein: {proteinPerCal}</span>}
                </div>
                <span className="bubble hall-bubble">{food.hall}</span>
              </div>
            </li>
          );
        })}
      </ul>
      {selectedFood && <FoodNutritionModal food={selectedFood} nutritionData={nutritionMap[`${selectedFood.itemId}-${selectedFood.meal}-${selectedFood.hall}`]} onClose={() => setSelectedFood(null)} />}
    </div>
  );
}

export default FoodSorter;