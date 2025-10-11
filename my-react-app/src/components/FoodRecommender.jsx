import { useState, useEffect, useMemo } from 'react';
import { fetchNutrition } from '../nutritionApi';

// Reusable nutrient extraction logic
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

// Bar chart component for dining hall distribution
function DiningHallChart({ hallCounts, totalTopFoods, isLoading, selectedMeal }) {
  const maxCount = Math.max(...Object.values(hallCounts));
  const halls = Object.keys(hallCounts).sort((a, b) => hallCounts[b] - hallCounts[a]);

  return (
    <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '2px solid #007bff' }}>
      <h3 style={{ marginTop: 0, marginBottom: '16px', textAlign: 'center', color: '#007bff' }}>
        🏆 Dining Hall Performance: Top Food Distribution
      </h3>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>📊 Loading nutrition data...</div>
          <div style={{ fontSize: '14px' }}>Chart will update automatically</div>
        </div>
      ) : totalTopFoods === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>📊 Analyzing data...</div>
          <div style={{ fontSize: '14px' }}>No nutrition data available yet</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {halls.map(hall => {
              const count = hallCounts[hall];
              const percentage = ((count / totalTopFoods) * 100).toFixed(1);
              const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

              return (
                <div key={hall} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ minWidth: '100px', fontWeight: '500' }}>{hall}</div>
                  <div style={{
                    flex: 1,
                    height: '24px',
                    background: '#e9ecef',
                    borderRadius: '4px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${barWidth}%`,
                      height: '100%',
                      background: count === maxCount && count > 0 ? '#28a745' : '#007bff',
                      transition: 'width 0.3s ease',
                      borderRadius: '4px'
                    }} />
                    <div style={{
                      position: 'absolute',
                      left: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: barWidth > 20 ? 'white' : '#333',
                      fontWeight: 'bold',
                      fontSize: '14px'
                    }}>
                      {count} ({percentage}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
            Based on top 15 foods with best protein-to-calorie ratio for {selectedMeal} (lowest cal/g protein, excluding cheese, ≥3g protein, ≥30 cal)
          </div>
        </>
      )}
    </div>
  );
}

// Metric analysis component
function MetricAnalysis({ foods, nutritionMap, metric, title, sortOrder = 'desc' }) {
  // Color coding for dining halls
  const getHallColor = (hall) => {
    const colors = {
      'Earhart': '#007bff',     // Blue
      'Ford': '#28a745',        // Green
      'Hillenbrand': '#dc3545', // Red
      'Wiley': '#6f42c1',       // Purple
      'Windsor': '#fd7e14'      // Orange
    };
    return colors[hall] || '#6c757d'; // Default gray
  };
  const topFoods = useMemo(() => {
    // First, filter out invalid foods
    const validFoods = foods.filter(food => {
      const key = `${food.itemId}-${food.meal}-${food.hall}`;
      const nutrition = nutritionMap[key];
      
      // Exclude foods containing "Cheese" (case insensitive)
      if (food.name.toLowerCase().includes('cheese')) {
        return false;
      }
      
      // Exclude "Garlic Herb chicken strip" (case insensitive)
      if (food.name.toLowerCase().includes('garlic herb chicken strip')) {
        return false;
      }
      
      if (metric === 'CaloriesPerProtein') {
        const cals = getNutrientValue(nutrition, 'Calories');
        const protein = getNutrientValue(nutrition, 'Protein');
        
        // Filter out unrealistic foods:
        // - Must have at least 3g protein (realistic protein source)
        // - Must have at least 30 calories (not just trace amounts)
        // - Must not have more than 100 cal/g protein (unrealistically high ratio)
        if (!cals || !protein || protein < 3 || cals < 30 || (cals / protein) > 100) {
          return false;
        }
        
        return true;
      }
      return getNutrientValue(nutrition, metric) !== null;
    });
    
    // Then sort the valid foods and take top 15
    const sorted = validFoods.sort((a, b) => {
      const keyA = `${a.itemId}-${a.meal}-${a.hall}`;
      const keyB = `${b.itemId}-${b.meal}-${b.hall}`;
      const nutritionA = nutritionMap[keyA];
      const nutritionB = nutritionMap[keyB];

      let valA, valB;
      if (metric === 'CaloriesPerProtein') {
        const calsA = getNutrientValue(nutritionA, 'Calories');
        const proteinA = getNutrientValue(nutritionA, 'Protein');
        valA = calsA && proteinA ? Math.round(calsA / proteinA) : null;
        const calsB = getNutrientValue(nutritionB, 'Calories');
        const proteinB = getNutrientValue(nutritionB, 'Protein');
        valB = calsB && proteinB ? Math.round(calsB / proteinB) : null;
      } else {
        valA = getNutrientValue(nutritionA, metric);
        valB = getNutrientValue(nutritionB, metric);
      }

      if (valA !== null && valB !== null) {
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      }
      if (valA !== null) return -1;
      if (valB !== null) return 1;
      return 0;
    });

    return sorted.slice(0, 15);
  }, [foods, nutritionMap, metric, sortOrder]);

  return (
    <div style={{ marginBottom: '24px', padding: '16px', border: '1px solid #e9ecef', borderRadius: '8px' }}>
      <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#495057' }}>
        Top 15: {title} {sortOrder === 'desc' ? '(Highest)' : '(Lowest)'}
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '8px' }}>
        {topFoods.map((food, index) => {
          const key = `${food.itemId}-${food.meal}-${food.hall}`;
          const nutrition = nutritionMap[key];
          let value, unit = '';

          if (metric === 'CaloriesPerProtein') {
            const cals = getNutrientValue(nutrition, 'Calories');
            const protein = getNutrientValue(nutrition, 'Protein');
            value = cals && protein ? Math.round(cals / protein) : null;
            unit = ' cal/g protein';
          } else {
            value = getNutrientValue(nutrition, metric);
            if (metric === 'Calories') unit = '';
            else if (metric === 'Sodium') unit = 'mg';
            else unit = 'g';
          }

          return (
            <div key={key} style={{
              padding: '8px 12px',
              background: '#f8f9fa',
              borderRadius: '6px',
              fontSize: '14px',
              border: '1px solid #dee2e6'
            }}>
              <div style={{ fontWeight: 'bold', color: '#495057' }}>
                #{index + 1}: {food.name}
              </div>
              <div style={{ color: '#6c757d', fontSize: '13px' }}>
                {value !== null ? `${value}${unit}` : 'N/A'} • <span style={{ color: getHallColor(food.hall), fontWeight: 'bold' }}>{food.hall}</span> • {food.meal}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FoodRecommender({ menus }) {
  console.log("FoodRecommender received menus:", menus);
  console.log("Menus object keys:", Object.keys(menus || {}));
  console.log("Menu values:", Object.entries(menus || {}).map(([hall, menu]) => ({
    hall,
    hasMenu: !!menu,
    mealsCount: menu?.meals?.length || 0
  })));
  
  const [foods, setFoods] = useState([]);
  const [nutritionMap, setNutritionMap] = useState({});
  const [loadingNutrition, setLoadingNutrition] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState('Lunch'); // Default to Lunch

  // Extract all foods from menus
  useEffect(() => {
    console.log("FoodRecommender useEffect - processing menus:", menus);
    const allFoods = [];
    Object.entries(menus).forEach(([hall, menu]) => {
      if (!menu) {
        console.warn(`Menu for ${hall} is null or undefined`);
        return;
      }
      if (!menu.meals) {
        console.warn(`Menu for ${hall} has no meals property:`, menu);
        return;
      }
      menu.meals.forEach(meal => {
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
    console.log("Processed foods:", uniqueFoods.length, "unique foods");
    setFoods(uniqueFoods);
  }, [menus]);

  // Fetch nutrition data for all foods
  useEffect(() => {
    if (!foods.length) return;
    const fetchAllNutrition = async () => {
      setLoadingNutrition(true);
      const promises = foods.map(async (food) => {
        const key = `${food.itemId}-${food.meal}-${food.hall}`;
        if (nutritionMap[key]) return; // Skip if already have data
        try {
          const data = await fetchNutrition(food.itemId);
          setNutritionMap(prev => ({ ...prev, [key]: data }));
        } catch (err) {
          console.warn('Failed to fetch nutrition for', food.name, err);
          setNutritionMap(prev => ({ ...prev, [key]: null }));
        }
      });
      await Promise.all(promises);
      setLoadingNutrition(false);
    };
    fetchAllNutrition();
  }, [foods]); // Only depend on foods, not nutritionMap

  // Calculate dining hall distribution of top foods
  const hallDistribution = useMemo(() => {
    // Check if we have any non-null nutrition data
    const hasNutritionData = Object.values(nutritionMap).some(data => data !== null && data !== undefined);
    
    if (!foods.length || !hasNutritionData) {
      return { counts: {}, totalTopFoods: 0 };
    }

    // Filter foods by selected meal
    const mealFoods = foods.filter(food => food.meal === selectedMeal);

    const metrics = ['CaloriesPerProtein']; // Only analyze calories per gram of protein
    const metricConfigs = {
      'CaloriesPerProtein': { order: 'asc' } // Lower is better (more protein per calorie)
    };
    const topFoodsSet = new Set();

    // Collect top 15 foods from each metric
    metrics.forEach(metric => {
      const sortOrder = metricConfigs[metric]?.order || 'desc';
      
      // First, filter out invalid foods
      const validFoods = mealFoods.filter(food => {
        const key = `${food.itemId}-${food.meal}-${food.hall}`;
        const nutrition = nutritionMap[key];
        
        // Exclude foods containing "Cheese" (case insensitive)
        if (food.name.toLowerCase().includes('cheese')) {
          return false;
        }
        
        // Exclude "Garlic Herb chicken strip" (case insensitive)
        if (food.name.toLowerCase().includes('garlic herb chicken strip')) {
          return false;
        }
        
        if (metric === 'CaloriesPerProtein') {
          const cals = getNutrientValue(nutrition, 'Calories');
          const protein = getNutrientValue(nutrition, 'Protein');
          
          // Filter out unrealistic foods:
          // - Must have at least 3g protein (realistic protein source)
          // - Must have at least 30 calories (not just trace amounts)
          // - Must not have more than 100 cal/g protein (unrealistically high ratio)
          if (!cals || !protein || protein < 3 || cals < 30 || (cals / protein) > 100) {
            return false;
          }
          
          return true;
        }
        return getNutrientValue(nutrition, metric) !== null;
      });
      
      // Then sort the valid foods and take top 15
      const sorted = validFoods.sort((a, b) => {
        const keyA = `${a.itemId}-${a.meal}-${a.hall}`;
        const keyB = `${b.itemId}-${b.meal}-${b.hall}`;
        const nutritionA = nutritionMap[keyA];
        const nutritionB = nutritionMap[keyB];

        let valA, valB;
        if (metric === 'CaloriesPerProtein') {
          const calsA = getNutrientValue(nutritionA, 'Calories');
          const proteinA = getNutrientValue(nutritionA, 'Protein');
          valA = calsA && proteinA ? Math.round(calsA / proteinA) : null;
          const calsB = getNutrientValue(nutritionB, 'Calories');
          const proteinB = getNutrientValue(nutritionB, 'Protein');
          valB = calsB && proteinB ? Math.round(calsB / proteinB) : null;
        } else {
          valA = getNutrientValue(nutritionA, metric);
          valB = getNutrientValue(nutritionB, metric);
        }

        if (valA !== null && valB !== null) {
          return sortOrder === 'desc' ? valB - valA : valA - valB;
        }
        if (valA !== null) return -1;
        if (valB !== null) return 1;
        return 0;
      });

      // Take the top 15 valid foods
      const top15ValidFoods = sorted.slice(0, 15);
      top15ValidFoods.forEach(food => {
        topFoodsSet.add(`${food.itemId}-${food.meal}-${food.hall}`);
      });
    });

    // Count by dining hall
    const hallCounts = {};
    const diningHalls = ['Earhart', 'Ford', 'Hillenbrand', 'Wiley', 'Windsor'];
    diningHalls.forEach(hall => hallCounts[hall] = 0);

    topFoodsSet.forEach(foodKey => {
      const hall = foodKey.split('-').slice(-1)[0];
      if (hallCounts[hall] !== undefined) {
        hallCounts[hall]++;
      }
    });

    console.log('Hall distribution result:', { counts: hallCounts, totalTopFoods: topFoodsSet.size });

    return {
      counts: hallCounts,
      totalTopFoods: topFoodsSet.size
    };
  }, [foods, nutritionMap, selectedMeal]);

  const metrics = [
    { key: 'CaloriesPerProtein', title: 'Cal/g Protein', order: 'asc' } // Lower is better (more protein per calorie)
  ];

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Dining Hall Chart ALWAYS at the very top */}
      <div style={{ marginBottom: '32px' }}>
        <DiningHallChart
          hallCounts={hallDistribution.counts}
          totalTopFoods={hallDistribution.totalTopFoods}
          isLoading={loadingNutrition}
          selectedMeal={selectedMeal}
        />
      </div>

      <h2 style={{ textAlign: 'center', marginBottom: '24px', color: '#2c3e50' }}>
        🏆 Best Protein-Per-Calorie Foods: Top Performers
      </h2>

      {/* Meal Selector */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'inline-flex', gap: '8px', background: '#f8f9fa', padding: '8px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          {['Breakfast', 'Lunch', 'Dinner'].map(meal => (
            <button
              key={meal}
              onClick={() => setSelectedMeal(meal)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                background: selectedMeal === meal ? '#007bff' : 'transparent',
                color: selectedMeal === meal ? 'white' : '#495057',
                cursor: 'pointer',
                fontWeight: selectedMeal === meal ? 'bold' : 'normal',
                transition: 'all 0.2s ease'
              }}
            >
              {meal}
            </button>
          ))}
        </div>
        <div style={{ marginTop: '8px', fontSize: '14px', color: '#6c757d' }}>
          Analyzing {selectedMeal} menu for best protein-to-calorie ratio
        </div>
      </div>

      {loadingNutrition && (
        <div style={{ textAlign: 'center', padding: '40px', fontSize: '18px', color: '#666' }}>
          Loading nutrition data for analysis...
        </div>
      )}

      {!loadingNutrition && foods.length > 0 && (
        <>
          {/* Metric Analysis Sections */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
            {metrics.map(({ key, title, order }) => {
              // Filter foods by selected meal for the analysis
              const mealFilteredFoods = foods.filter(food => food.meal === selectedMeal);
              return (
                <MetricAnalysis
                  key={`${key}-${selectedMeal}`}
                  foods={mealFilteredFoods}
                  nutritionMap={nutritionMap}
                  metric={key}
                  title={title}
                  sortOrder={order}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default FoodRecommender;
