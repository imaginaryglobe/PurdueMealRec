# Purdue Meal Rec

A meal recommendation web app for Purdue University dining halls with nutrition analysis and filtering.

## Features

- **Smart Meal Recommendations**: Analyzes nutrition data to recommend the best foods
- **Dining Hall Comparison**: Visual bar charts showing nutrition scores across dining courts
- **Real-time Menu Data**: Fetches current menus from Purdue's dining API
- **Nutrition Analysis**: Detailed nutritional information for all menu items
- **Caching System**: Reduces API calls with intelligent caching (frontend localStorage + backend file cache)
- **Responsive Design**: Works on desktop and mobile devices

## Architecture

### Frontend (React + Vite)
- **Location**: `my-react-app/`
- **Tech Stack**: React 19, Vite, CSS Modules
- **Features**: Menu display, nutrition analysis, filtering, bar charts

### Backend (Express.js)
- **Location**: `backend/`
- **Tech Stack**: Node.js, Express.js, file-based caching
- **Purpose**: API caching layer to reduce Purdue API calls

### Data Flow
Purdue HFS GraphQL API → Backend Cache → Frontend → User

## Installation & Setup

### Prerequisites
- Node.js 16+
- npm or yarn

### Frontend Setup
```bash
cd my-react-app
npm install
npm run dev
```
Access at: http://localhost:5173

### Backend Setup
```bash
cd backend
npm install
npm start
```
API available at: http://localhost:3001

### Full Development Environment
```bash
# Terminal 1: Frontend
cd my-react-app && npm run dev

# Terminal 2: Backend
cd backend && npm start
```

## API Endpoints

### Backend API (Port 3001)
- `GET /api/health` - Health check
- `GET /api/menus/:court/:date` - Menu for specific dining court
- `GET /api/menus/all/:date` - All dining courts' menus
- `GET /api/nutrition/:itemId` - Nutrition data for food item
- `POST /api/nutrition/batch` - Batch nutrition data request

## Deployment

### Frontend (Netlify)
```bash
cd my-react-app
npm run build
# Deploy dist/ folder to Netlify
```

### Backend (Optional)
The backend is optional - the frontend can work with direct API calls. For production caching, deploy the Express server to services like Heroku, Railway, or Vercel.

## Development

### Key Files
- `my-react-app/src/App.jsx` - Main application component
- `my-react-app/src/components/FoodRecommender.jsx` - Nutrition analysis and recommendations
- `my-react-app/src/nutritionApi.js` - API integration
- `backend/server.js` - Express server setup
- `backend/utils/cache.js` - File-based caching system

### Architecture Patterns
- **Component-based UI**: React components for modals, charts, and data display
- **Caching Strategy**: localStorage for client, file cache for server
- **API Integration**: GraphQL queries to Purdue's dining API
- **Data Processing**: Nutrition scoring and filtering algorithms

## Usage

If you'd like to try it out, click here > <a href="https://purduemealrec.netlify.app/" target="_blank">Purdue Meal Rec</a>

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test both frontend and backend
5. Submit a pull request

## License

MIT License