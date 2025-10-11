# Purdue Meal Backend

A caching API server for Purdue University dining hall data.

## Features

- **Menu Caching**: Caches dining hall menus for 24 hours to reduce API calls
- **Nutrition Data**: Caches detailed nutrition information for food items
- **File-based Storage**: Persistent caching using JSON files
- **Express.js API**: RESTful endpoints for menu and nutrition data
- **Purdue API v3**: Uses latest Purdue dining API (v3)

## Installation

```bash
cd backend
npm install
```

## Usage

### Development

```bash
npm start
```

The server will run on http://localhost:3001

### API Endpoints

#### Health Check
```
GET /api/health
```

#### Menu Data
```
GET /api/menus/:court/:date
GET /api/menus/all/:date
```

**Parameters:**
- `court`: Dining hall name (Earhart, Ford, Hillenbrand, Wiley, Windsor)
- `date`: Date in YYYY-MM-DD format

**Example:**
```bash
curl http://localhost:3001/api/menus/Earhart/2024-10-15
curl http://localhost:3001/api/menus/all/2024-10-15
```

#### Nutrition Data
```
GET /api/nutrition/:itemId
POST /api/nutrition/batch
```

**Example:**
```bash
curl http://localhost:3001/api/nutrition/12345
curl -X POST http://localhost:3001/api/nutrition/batch \
  -H "Content-Type: application/json" \
  -d '{"itemIds": ["12345", "67890"]}'
```

## Cache Management

- Cache files are stored in `backend/cache/`
- Data expires after 24 hours
- Memory cache for faster access
- Automatic cleanup of expired entries

## Purdue API Integration

This backend integrates with Purdue's GraphQL API v3:
- **Endpoint**: `https://api.hfs.purdue.edu/menus/v3/GraphQL`
- **Menu Query**: Uses `diningCourtByName` and `dailyMenu` structure
- **Nutrition Query**: Uses `itemByItemId` for food item details

## Environment Variables

- `PORT`: Server port (default: 3001)

## Dependencies

- express: Web framework
- cors: Cross-origin resource sharing
- node-fetch: HTTP client for GraphQL API (v3 ESM module)
- fs-extra: Enhanced file system operations

## Troubleshooting

### "fetch is not a function" error
This has been fixed by using dynamic import for node-fetch v3 ESM module.

### Menus returning null
- Ensure the date has actual menu data (weekdays during semester)
- Check network connectivity to Purdue API
- Review console logs for specific error messages
- The frontend has automatic fallback to direct API calls

### Cache not working
- Verify `backend/cache/` directory exists
- Check file permissions
- Clear cache manually if needed: `rm -rf backend/cache/*`