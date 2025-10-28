// Clear invalid menu cache
const today = new Date().toISOString().split('T')[0];
const cacheKey = `menus_${today}`;

if (typeof localStorage !== 'undefined') {
  localStorage.removeItem(cacheKey);
  console.log('Cleared invalid cache for:', cacheKey);
} else {
  console.log('localStorage not available');
}