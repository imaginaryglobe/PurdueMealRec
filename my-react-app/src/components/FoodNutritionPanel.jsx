import { useState, useEffect } from 'react';
import { fetchNutrition } from '../nutritionApi';
import SidePopout from './SidePopout';

function FoodNutritionPanel({ item, onClose }) {
  const [nutrition, setNutrition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchNutrition(item.itemId)
      .then(data => {
        setNutrition(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load nutrition');
        setLoading(false);
      });
  }, [item]);

  const wanted = ['Calories', 'Carbohydrates', 'Protein', 'Sodium', 'Total Fat'];
  const units = {
    'Calories': 'kcal',
    'Carbohydrates': 'g',
    'Protein': 'g',
    'Total Fat': 'g',
    'Sodium': 'mg',
  };
  let facts = null;
  if (nutrition && nutrition.nutritionFacts) {
    facts = wanted.map(label => {
      const found = nutrition.nutritionFacts.find(f => f.name === label);
      if (!found) return null;
      const value = Math.round(found.value);
      return (
        <div key={label} className="nutrition-row">
          <span>{label}:</span> <span>{value} {units[label]}</span>
        </div>
      );
    });
  }

  return (
    <SidePopout onClose={onClose}>
      <h3>{item.name}</h3>
      {loading && <div>Loading nutrition info...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {facts && <div style={{ marginTop: 18 }}>{facts}</div>}
    </SidePopout>
  );
}

export default FoodNutritionPanel;