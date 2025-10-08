# Purdue Meal Backend

A caching API server for Purdue University dining hall data.

## Features

- **Menu Caching**: Caches dining hall menus for 24 hours to reduce API calls
- **Nutrition Data**: Caches detailed nutrition information for food items
- **File-based Storage**: Persistent caching using JSON files
- **Express.js API**: RESTful endpoints for menu and nutrition data

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

#### Nutrition Data
```
GET /api/nutrition/:itemId
POST /api/nutrition/batch
```

## Cache Management

- Cache files are stored in `backend/cache/`
- Data expires after 24 hours
- Memory cache for faster access
- Automatic cleanup of expired entries

## Environment Variables

- `PORT`: Server port (default: 3001)

## Dependencies

- express: Web framework
- cors: Cross-origin resource sharing
- node-fetch: HTTP client for GraphQL API
- fs-extra: Enhanced file system operations