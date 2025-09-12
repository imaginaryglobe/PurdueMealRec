# Copilot Instructions for PurdueMealRec

## Project Overview
- This is a full-stack project for browsing Purdue dining menus and nutrition info.
- The main user-facing app is a React SPA in `my-react-app/` using Vite for build/dev.
- The backend folder exists but is not the focus of the current workflow.

## Frontend Architecture
- Main entry: `my-react-app/src/main.jsx` (renders the full menu/nutrition UI directly, not via `App.jsx`).
- Major UI flows:
  - Menu navigation: meal → dining court → station → food (modal/side-panel navigation)
  - Nutrition info: click food to fetch and display all nutrition facts from the API
  - Sorting: foods can be sorted by Calories, Total Fat, Protein, Sodium, Carbohydrates
- API integration: uses Purdue Dining API via GraphQL POSTs (see `fetchNutrition` in `my-react-app/src/nutritionApi.js`).
- Styling: modern CSS in `my-react-app/src/App.css` (bubbles, modals, popouts)

## Key Patterns & Conventions
- All nutrition info is fetched on-demand per food (not bulk-fetched)
- Sorting is performed only on foods with loaded nutrition data (others remain unsorted until expanded)
- UI state is managed with React hooks (`useState`, `useEffect`)
- Modals and side panels are implemented as custom React components (not external libraries)
- No TypeScript or Redux; all state is local to components
- `App.jsx` is a placeholder and not used in the main app flow

## Developer Workflows
- Start dev server: `cd my-react-app && npm install && npm run dev`
- Main file to edit for UI/logic: `my-react-app/src/main.jsx`
- Add new UI: create new React components in `src/`, import as needed
- For new API calls: add helpers to `my-react-app/src/nutritionApi.js`
- For styles: edit `my-react-app/src/App.css`

## Examples
- To add a new nutrition field, update the nutrition rendering logic in `main.jsx` and optionally style in `App.css`
- To change menu navigation, edit the modal/side-panel logic in `main.jsx`

## External Integration
- Relies on Purdue Dining API (see fetches in `main.jsx` and `nutritionApi.js`)
- No authentication or user accounts

## Testing & Debugging
- No formal test suite; use browser and DevTools for debugging
- Use browser network tab to inspect API requests/responses

---
For major changes, always check `main.jsx` for the latest UI/data flow patterns.
