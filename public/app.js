/**
 * Purdue Dining Recommender - Frontend App
 */

// DOM Elements
const dateInput = document.getElementById('menu-date');
const courtFilters = document.getElementById('court-filters');
const mealFilters = document.getElementById('meal-filters');
const sortFilters = document.getElementById('sort-filters');
const foodGrid = document.getElementById('food-grid');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('empty-state');
const refreshBtn = document.getElementById('refresh-btn');
const themeToggle = document.getElementById('theme-toggle');

// State
let currentData = [];
let selectedCourt = 'all';
let selectedMeal = 'lunch';
let selectedSort = 'protein';
let isDarkMode = localStorage.getItem('theme') !== 'light';

/**
 * Initialize the app
 */
function init() {
    // Set date to today in Eastern time
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    dateInput.value = today;

    // Add event listeners
    dateInput.addEventListener('change', fetchData);

    courtFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            setActiveFilter(courtFilters, e.target);
            selectedCourt = e.target.dataset.court;
            renderFilteredData();
        }
    });

    mealFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            setActiveFilter(mealFilters, e.target);
            selectedMeal = e.target.dataset.meal;
            renderFilteredData();
        }
    });

    sortFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            setActiveFilter(sortFilters, e.target);
            selectedSort = e.target.dataset.sort;
            renderFilteredData();
        }
    });

    // Refresh button - updates date to today and fetches fresh data
    refreshBtn.addEventListener('click', () => {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        dateInput.value = today;
        fetchData(true);
    });

    // Theme toggle
    applyTheme();
    themeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        applyTheme();
    });

    // Initial fetch
    fetchData();
}

/**
 * Apply current theme
 */
function applyTheme() {
    document.body.classList.toggle('light-mode', !isDarkMode);
    themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
}

/**
 * Set active state on filter button
 */
function setActiveFilter(container, activeBtn) {
    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    activeBtn.classList.add('active');
}

/**
 * Fetch data from API
 */
async function fetchData() {
    const date = dateInput.value;
    if (!date) return;

    showLoading();

    try {
        const response = await fetch(`/api/top-foods/${date}`);
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Server error ${response.status}`);
        }
        const data = await response.json();
        currentData = data.items;

        selectedCourt = 'all';
        selectedMeal = 'lunch';
        resetFilterButtons();
        renderFilteredData();

    } catch (error) {
        console.error('Failed to fetch data:', error);
        showError(`Failed to load menu data: ${error.message}`);
    }
}

/**
 * Reset filter buttons to 'all'
 */
function resetFilterButtons() {
    courtFilters.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.court === 'all');
    });
    mealFilters.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.meal === 'lunch');
    });
}

/**
 * Filter and render data based on current selections
 */
function renderFilteredData() {
    let filtered = [...currentData];

    if (selectedCourt !== 'all') {
        filtered = filtered.filter(item =>
            item.location.toLowerCase() === selectedCourt.toLowerCase()
        );
    }

    if (selectedMeal !== 'all') {
        filtered = filtered.filter(item =>
            item.meal.toLowerCase() === selectedMeal.toLowerCase()
        );
    }

    // Exclude specific items (toppings that shouldn't be standalone)
    const excludedFoods = [
        'shredded 3 cheese blend',
        'grated parmesan cheese',
        'garlic herb chicken strip'
    ];
    filtered = filtered.filter(item =>
        !excludedFoods.includes(item.name.toLowerCase())
    );

    if (selectedSort === 'fiber') {
        // Filter to items with valid fiber data and at least 50 calories
        filtered = filtered.filter(item =>
            item.calories >= 50 && item.fiber != null && item.fiber > 0 && item.fiberRatio != null
        );
        // Sort by calories per gram of fiber (lower = more fiber-efficient)
        filtered.sort((a, b) => a.fiberRatio - b.fiberRatio);
    } else {
        // Protein mode: filter out small portions/toppings with misleading ratios
        filtered = filtered.filter(item =>
            item.calories >= 50 && item.protein >= 5
        );
        // Sort by calories per gram of protein (lower = more protein-efficient)
        filtered.sort((a, b) => a.ratio - b.ratio);
    }

    renderFoods(filtered);
}

/**
 * Render food cards
 */
function renderFoods(items) {
    hideLoading();
    hideError();

    if (items.length === 0) {
        foodGrid.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    // Show only top 10
    const top10 = items.slice(0, 10);

    // Render cards
    foodGrid.innerHTML = top10.map((item, index) => createFoodCard(item, index + 1)).join('');
}

/**
 * Create a food card HTML
 */
function createFoodCard(item, rank) {
    const isTop3 = rank <= 3;
    const caloriesFormatted = Math.round(item.calories);
    const courtSlug = item.location.toLowerCase();
    const courtClass = `court-${courtSlug}`;
    const cardCourtClass = `card-${courtSlug}`;

    const traitsHtml = item.traits.map(trait => `
    <img
      class="trait-icon"
      src="${trait.svgIconWithoutBackground}"
      alt="${trait.name}"
      title="${trait.name}"
    >
  `).join('');

    let statsHtml;
    if (selectedSort === 'fiber') {
        const fiberRatioFormatted = item.fiberRatio != null ? item.fiberRatio.toFixed(1) : '--';
        const fiberFormatted = item.fiber != null ? Math.round(item.fiber) + 'g' : '--';
        statsHtml = `
        <div class="ratio-hero">
          <span class="ratio-value">${fiberRatioFormatted}</span>
          <span class="ratio-label">cal / g fiber</span>
        </div>
        <div class="secondary-stats">
          <div class="secondary-stat">
            <span class="secondary-value">${fiberFormatted}</span>
            <span class="secondary-label">Fiber</span>
          </div>
          <div class="secondary-stat">
            <span class="secondary-value">${caloriesFormatted}</span>
            <span class="secondary-label">Cal</span>
          </div>
        </div>`;
    } else {
        const ratioFormatted = item.ratio.toFixed(1);
        const proteinFormatted = Math.round(item.protein);
        statsHtml = `
        <div class="ratio-hero">
          <span class="ratio-value">${ratioFormatted}</span>
          <span class="ratio-label">cal / g protein</span>
        </div>
        <div class="secondary-stats">
          <div class="secondary-stat">
            <span class="secondary-value">${proteinFormatted}g</span>
            <span class="secondary-label">Protein</span>
          </div>
          <div class="secondary-stat">
            <span class="secondary-value">${caloriesFormatted}</span>
            <span class="secondary-label">Cal</span>
          </div>
        </div>`;
    }

    return `
    <article class="food-card ${isTop3 ? 'top-3' : ''} ${rank === 1 ? 'rank-1' : ''} ${cardCourtClass}">
      <span class="card-rank rank-${rank}">#${rank}</span>
      <div class="card-header">
        <h3 class="food-name">${escapeHtml(item.name)}</h3>
        <div class="food-location">
          <span class="court ${courtClass}">${item.location}</span>
          <span>•</span>
          <span class="meal">${item.meal}</span>
        </div>
      </div>
      <div class="card-stats">
        ${statsHtml}
      </div>
      ${traitsHtml ? `<div class="card-traits">${traitsHtml}</div>` : ''}
    </article>
  `;
}

/**
 * Show loading state
 */
function showLoading() {
    loadingEl.style.display = 'flex';
    errorEl.style.display = 'none';
    emptyState.style.display = 'none';
    foodGrid.innerHTML = '';
}

/**
 * Hide loading state
 */
function hideLoading() {
    loadingEl.style.display = 'none';
}

/**
 * Show error state
 */
function showError(message) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'flex';
    errorMessage.textContent = message;
    foodGrid.innerHTML = '';
}

/**
 * Hide error state
 */
function hideError() {
    errorEl.style.display = 'none';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Start the app
init();
