import { createRoot } from 'react-dom/client'

const myelement = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '250px' }}>
    <label>
      Carbs:
      <input type="number" name="carbs" />
    </label>
    <label>
      Fat:
      <input type="number" name="fat" />
    </label>
    <label>
      Protein:
      <input type="number" name="protein" />
    </label>
    <label>
      Sodium:
      <input type="number" name="sodium" />
    </label>
    <label>
      Total Calories:
      <input type="number" name="calories" />
    </label>
  </div>
);

createRoot(document.getElementById('root')).render(
  myelement
)