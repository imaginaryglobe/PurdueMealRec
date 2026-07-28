/**
 * Purdue Protein — Frontend
 * Data + ranking logic preserved from the original; presentation rebuilt
 * around a light editorial ranked list.
 */

// DOM
const dateInput = document.getElementById('menu-date');
const courtFilters = document.getElementById('court-filters');
const mealFilters = document.getElementById('meal-filters');
const sortFilters = document.getElementById('sort-filters');
const foodList = document.getElementById('food-list');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('empty-state');
const refreshBtn = document.getElementById('refresh-btn');
const themeToggle = document.getElementById('theme-toggle');
const metaLine = document.getElementById('meta-line');

// State
let currentData = [];
let selectedCourt = 'all';
let selectedMeal = 'lunch';
let selectedSort = 'protein';
// Light editorial is the default; dark is opt-in.
let isDarkMode = localStorage.getItem('theme') === 'dark';

/**
 * Initialize
 */
function init() {
    // Today in Eastern time
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    dateInput.value = today;

    dateInput.addEventListener('change', fetchData);

    courtFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab')) {
            setActiveFilter(courtFilters, e.target);
            selectedCourt = e.target.dataset.court;
            renderFilteredData();
        }
    });

    mealFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab')) {
            setActiveFilter(mealFilters, e.target);
            selectedMeal = e.target.dataset.meal;
            renderFilteredData();
        }
    });

    sortFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab')) {
            setActiveFilter(sortFilters, e.target);
            selectedSort = e.target.dataset.sort;
            renderFilteredData();
        }
    });

    refreshBtn.addEventListener('click', () => {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        dateInput.value = today;
        fetchData();
    });

    applyTheme();
    themeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        applyTheme();
    });

    fetchData();
}

/**
 * Theme
 */
function applyTheme() {
    document.body.classList.toggle('dark', isDarkMode);
    themeToggle.textContent = isDarkMode ? '☀' : '☾';
    const themeColor = isDarkMode ? '#16140F' : '#FAF9F6';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', themeColor);
}

/**
 * Active tab within a group
 */
function setActiveFilter(container, activeBtn) {
    container.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');
}

/**
 * Fetch data
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
        showError(`Couldn't load today's menu: ${error.message}`);
    }
}

/**
 * Reset court/meal tabs to defaults
 */
function resetFilterButtons() {
    courtFilters.querySelectorAll('.tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.court === 'all');
    });
    mealFilters.querySelectorAll('.tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.meal === 'lunch');
    });
}

/**
 * Filter + sort + render (logic unchanged from original)
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

    // Toppings that shouldn't stand alone
    const excludedFoods = [
        'shredded 3 cheese blend',
        'grated parmesan cheese',
        'garlic herb chicken strip'
    ];
    filtered = filtered.filter(item =>
        !excludedFoods.includes(item.name.toLowerCase())
    );

    if (selectedSort === 'fiber') {
        filtered = filtered.filter(item =>
            item.calories >= 50 && item.fiber != null && item.fiber > 0 && item.fiberRatio != null
        );
        filtered.sort((a, b) => a.fiberRatio - b.fiberRatio);
    } else {
        filtered = filtered.filter(item =>
            item.calories >= 50 && item.protein >= 5
        );
        filtered.sort((a, b) => a.ratio - b.ratio);
    }

    updateMetaLine();
    renderFoods(filtered);
}

/**
 * Colophon line reflects current sort
 */
function updateMetaLine() {
    if (!metaLine) return;
    metaLine.textContent = selectedSort === 'fiber'
        ? 'Ranked by calories per gram of fiber · lower is better.'
        : 'Ranked by calories per gram of protein · lower is better.';
}

/**
 * Render the ranked list
 */
function renderFoods(items) {
    hideLoading();
    hideError();

    if (items.length === 0) {
        foodList.innerHTML = '';
        emptyState.hidden = false;
        return;
    }

    emptyState.hidden = true;

    const top10 = items.slice(0, 10);
    foodList.innerHTML = top10.map((item, index) => createFoodRow(item, index + 1)).join('');
}

/**
 * One ranked row
 */
function createFoodRow(item, rank) {
    const courtSlug = item.location.toLowerCase();
    const rankLabel = String(rank).padStart(2, '0');

    const traitsHtml = item.traits.map(trait => `
      <img class="trait-icon" src="${trait.svgIconWithoutBackground}" alt="${escapeHtml(trait.name)}" title="${escapeHtml(trait.name)}">
    `).join('');

    let ratioText, unitText, detailText;
    if (selectedSort === 'fiber') {
        ratioText = item.fiberRatio != null ? item.fiberRatio.toFixed(1) : '—';
        unitText = 'cal / g fiber';
        const fiber = item.fiber != null ? Math.round(item.fiber) + 'g fiber' : '— fiber';
        detailText = `${fiber} · ${Math.round(item.calories)} cal`;
    } else {
        ratioText = item.ratio.toFixed(1);
        unitText = 'cal / g protein';
        detailText = `${Math.round(item.protein)}g protein · ${Math.round(item.calories)} cal`;
    }

    return `
    <li class="rank-row">
      <span class="rank-num">${rankLabel}</span>
      <div class="rank-body">
        <h2 class="food-name">${escapeHtml(item.name)}</h2>
        <div class="food-meta">
          <span class="court-dot court-${courtSlug}"></span>
          <span class="food-court">${escapeHtml(item.location)}</span>
          <span class="meta-sep">·</span>
          <span class="food-court-meal">${escapeHtml(item.meal)}</span>
          ${traitsHtml ? `<span class="food-traits">${traitsHtml}</span>` : ''}
        </div>
      </div>
      <div class="rank-stat">
        <div class="ratio">${ratioText}</div>
        <div class="ratio-unit">${unitText}</div>
        <div class="stat-detail">${detailText}</div>
      </div>
    </li>`;
}

/**
 * State helpers
 */
function showLoading() {
    loadingEl.hidden = false;
    errorEl.hidden = true;
    emptyState.hidden = true;
    foodList.innerHTML = '';
}

function hideLoading() {
    loadingEl.hidden = true;
}

function showError(message) {
    loadingEl.hidden = true;
    emptyState.hidden = true;
    errorEl.hidden = false;
    errorMessage.textContent = message;
    foodList.innerHTML = '';
}

function hideError() {
    errorEl.hidden = true;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

init();
