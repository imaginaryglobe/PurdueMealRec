# Fix for "Received Menus are Null" Issue

## Problem Summary
The application was experiencing issues where menu data was returning as null, preventing the food recommendation system from displaying data.

## Root Causes Identified

### 1. Backend API Endpoint Mismatch
**Issue**: The backend was using Purdue API v2 while the frontend was using v3.
- **Backend**: `https://api.hfs.purdue.edu/menus/v2/graphql`
- **Frontend**: `https://api.hfs.purdue.edu/menus/v3/GraphQL`

**Fix**: Updated backend to use v3 endpoint in `/backend/utils/purdueApi.js`

### 2. GraphQL Query Structure Mismatch
**Issue**: The backend and frontend were using different GraphQL queries.

**Backend (old v2 query)**:
```graphql
query GetMenu($diningCourt: String!, $date: Date!) {
  menu(diningCourt: $diningCourt, date: $date) {
    ...
  }
}
```

**Frontend (v3 query)**:
```graphql
query getLocationMenu($name: String!, $date: Date!) {
  diningCourtByName(name: $name) {
    dailyMenu(date: $date) {
      ...
    }
  }
}
```

**Fix**: Updated backend query to match v3 structure using `diningCourtByName` and `dailyMenu`.

### 3. Node-Fetch ESM Module Import
**Issue**: node-fetch v3 is an ESM module, but the backend was using CommonJS `require()`.

**Error**:
```
TypeError: fetch is not a function
```

**Fix**: Implemented dynamic import for node-fetch:
```javascript
let fetch;
const fetchPromise = import('node-fetch').then(module => {
  fetch = module.default;
});
```

### 4. Async Promise Handling in Frontend
**Issue**: The fallback to direct API calls wasn't being properly awaited in the catch block.

**Fix**: Wrapped the fetch logic in an async function and properly await the fallback:
```javascript
const fetchMenus = async () => {
  try {
    // Try backend...
  } catch (backendError) {
    await fetchMenusDirect(dateStr);
  }
};
```

### 5. Nutrition API Query Mismatch
**Issue**: Backend nutrition query was also using v2 structure.

**Fix**: Updated to v3 structure using `itemByItemId` query:
```graphql
query ($id: Guid!) {
  itemByItemId(itemId: $id) {
    itemId
    name
    isNutritionReady
    nutritionFacts {
      name
      value
      label
    }
  }
}
```

## Enhanced Debugging

Added comprehensive logging throughout the application:

### App.jsx
- Logs date being fetched
- Logs each API response status
- Warns when menus are null
- Provides summary of menu data structure

### FoodRecommender.jsx
- Logs received menu object
- Warns about null menus per dining hall
- Logs number of unique foods processed
- Provides menu structure summary

## Testing Notes

### Backend Server Testing
The backend server can be tested locally but requires network access to the Purdue API:

```bash
cd backend
npm start
```

Test endpoints:
- Health check: `http://localhost:3001/api/health`
- All menus: `http://localhost:3001/api/menus/all/YYYY-MM-DD`
- Single menu: `http://localhost:3001/api/menus/Earhart/YYYY-MM-DD`
- Nutrition: `http://localhost:3001/api/nutrition/{itemId}`

**Note**: In restricted environments, the backend may not be able to reach external APIs. The frontend has built-in fallback to make direct API calls.

### Frontend Testing
The frontend includes automatic fallback logic:

1. **First attempt**: Fetch from backend API
2. **On failure**: Fall back to direct Purdue API calls
3. **Caching**: Successfully fetched data is cached in localStorage for 24 hours

Run frontend:
```bash
cd my-react-app
npm run dev
```

## How to Run the Full Application

### Option 1: With Backend (Recommended)
```bash
# Terminal 1: Backend
cd backend
npm start

# Terminal 2: Frontend
cd my-react-app
npm run dev
```

### Option 2: Frontend Only
```bash
cd my-react-app
npm run dev
```
The frontend will automatically use direct API calls if the backend is not available.

## Potential Issues & Solutions

### Issue: Menus still return null
**Possible causes**:
1. **No data for the date**: The Purdue API may not have menu data for the requested date (e.g., holidays, future dates, weekends)
2. **Network restrictions**: Backend cannot reach external APIs in certain environments
3. **API changes**: Purdue may have changed their API structure

**Solution**:
- Check browser console for detailed logs
- Look for warnings about specific dining halls
- Verify the date has menu data (weekdays during semester)
- Use frontend-only mode as fallback

### Issue: Backend fetch fails but no fallback
**Solution**: Already fixed - frontend now properly awaits fallback

### Issue: Some dining halls return null
**Possible causes**:
- Dining hall closed on that date
- Dining hall name mismatch
- API returned errors for specific halls

**Solution**: Check console logs for specific errors per dining hall

## Files Modified

1. `/backend/utils/purdueApi.js` - Updated API endpoint and queries
2. `/my-react-app/src/App.jsx` - Fixed async handling and added logging
3. `/my-react-app/src/components/FoodRecommender.jsx` - Enhanced error checking and logging

## Verification Checklist

- [x] Backend uses correct v3 API endpoint
- [x] Backend GraphQL queries match v3 structure
- [x] Node-fetch import works with ESM module
- [x] Frontend fallback is properly awaited
- [x] Nutrition API uses correct v3 query
- [x] Comprehensive logging added
- [x] Error handling improved
- [ ] Test with actual menu data (requires Purdue API access)
- [ ] Verify bar chart displays with loaded data
- [ ] Confirm food recommendations work correctly

## Next Steps for Users

1. **Clear cache**: Clear browser localStorage and backend cache directory
2. **Check console**: Open browser developer tools and check console for logs
3. **Verify date**: Ensure you're fetching data for a valid date (weekday during semester)
4. **Test fallback**: If backend doesn't work, frontend should automatically fall back
5. **Report specific errors**: Use the detailed logs to identify exactly where the failure occurs
