const express = require('express');
const cors = require('cors');
const path = require('path');
const menuRoutes = require('./routes/menus');
const nutritionRoutes = require('./routes/nutrition');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/menus', menuRoutes);
app.use('/api/nutrition', nutritionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Purdue Meal Backend running on port ${PORT}`);
});