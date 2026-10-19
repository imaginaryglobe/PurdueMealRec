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
const viewTabs = document.getElementById('view-tabs');
const todayView = document.getElementById('today-view');
const weekView = document.getElementById('week-view');
const weekGrid = document.getElementById('week-grid');
const weekKey = document.getElementById('week-key');
const hiddenBox = document.getElementById('hidden-foods');
const hiddenToggle = document.getElementById('hidden-toggle');
const hiddenList = document.getElementById('hidden-list');
const page = document.querySelector('.page');

// Foods hidden by the user: lowercase name -> display name (saved in localStorage)
let hiddenFoods = loadHiddenFoods();

function loadHiddenFoods() {
    try {
        return new Map(Object.entries(JSON.parse(localStorage.getItem('hiddenFoods') || '{}')));
    } catch {
        return new Map();
    }
}

// State
let currentData = [];
let selectedView = 'today';
let weekDays = [];   // [{ date, items | null }]
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

    dateInput.addEventListener('change', () => fetchData());

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

    // ✕ buttons live inside both the Today list and the Week grid
    [foodList, weekGrid].forEach(el => el.addEventListener('click', (e) => {
        const btn = e.target.closest('.hide-btn');
        if (btn) setFoodHidden(decodeURIComponent(btn.dataset.name), true);
    }));

    hiddenToggle.addEventListener('click', () => {
        hiddenList.hidden = !hiddenList.hidden;
    });

    hiddenList.addEventListener('click', (e) => {
        const btn = e.target.closest('.restore-btn');
        if (btn) setFoodHidden(decodeURIComponent(btn.dataset.name), false);
    });

    updateHiddenUI();

    viewTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.view-tab');
        if (!btn) return;
        setView(btn.dataset.view);
    });

    refreshBtn.addEventListener('click', () => {
        if (selectedView === 'week') {
            fetchWeek(true);
            return;
        }
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        dateInput.value = today;
        weekDays = []; // so the Week tab reloads next time it's opened
        fetchData(true);
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
let todaySeq = 0;      // id of the latest Today request; older responses are ignored
let loadedDate = null; // date currently shown in Today view

async function fetchData(refresh = false) {
    const date = dateInput.value;
    if (!date) return;

    const seq = ++todaySeq;
    showLoading();

    try {
        const response = await fetch(`/api/top-foods/${date}${refresh === true ? '?refresh=1' : ''}`);
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Server error ${response.status}`);
        }
        const data = await response.json();
        if (seq !== todaySeq) return; // a newer request has taken over
        currentData = data.items;

        // Only a different date resets the filters; Refresh keeps your court/meal
        if (date !== loadedDate) {
            selectedCourt = 'all';
            selectedMeal = 'lunch';
            resetFilterButtons();
            loadedDate = date;
        }
        renderFilteredData();
    } catch (error) {
        if (seq !== todaySeq) return;
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
 * Switch between Today and Week views
 */
function setView(view) {
    selectedView = view;
    viewTabs.querySelectorAll('.view-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    const isWeek = view === 'week';
    page.classList.toggle('wide', isWeek);
    dateInput.hidden = isWeek;
    todayView.hidden = isWeek;
    weekView.hidden = !isWeek;
    weekKey.hidden = !isWeek;
    emptyState.hidden = true;

    if (isWeek && weekDays.length === 0) {
        fetchWeek();
    } else {
        renderFilteredData();
    }
}

/**
 * Fetch the next 7 days (starting today, Eastern time) in parallel
 */
let weekSeq = 0; // id of the latest Week request; older responses are ignored

async function fetchWeek(refresh = false) {
    const seq = ++weekSeq;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const base = new Date(`${today}T12:00:00Z`);
    const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(base);
        d.setUTCDate(base.getUTCDate() + i);
        return d.toISOString().slice(0, 10);
    });

    // Show all 7 columns right away as placeholders, then fill each as its response arrives
    foodList.innerHTML = '';
    weekDays = dates.map(date => ({ date, items: undefined, stirFry: null }));
    renderWeek();

    await Promise.all(dates.map(async (date, i) => {
        let day;
        try {
            const response = await fetch(`/api/top-foods/${date}${refresh ? '?refresh=1' : ''}`);
            if (!response.ok) throw new Error(`Server error ${response.status}`);
            const data = await response.json();
            day = { date, items: data.items, stirFry: data.stirFry };
        } catch (error) {
            console.error(`Failed to load ${date}:`, error);
            day = { date, items: null, stirFry: null };
        }

        if (seq !== weekSeq) return; // a newer request has taken over
        weekDays[i] = day;
        if (selectedView === 'week') renderDayColumn(i, true);
    }));
}

/**
 * Filter + sort (shared by Today and Week). Logic unchanged from original.
 */
function filterAndSort(items) {
    let filtered = [...items];

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

    // Foods the user hid with the ✕ button
    filtered = filtered.filter(item => !hiddenFoods.has(item.name.toLowerCase()));

    if (selectedSort === 'fiber') {
        filtered = filtered.filter(item =>
            item.calories >= 50 && item.fiber != null && item.fiber > 0 && item.fiberRatio != null
        );
        filtered.sort((a, b) => a.fiberRatio - b.fiberRatio);
    } else {
        filtered = filtered.filter(item =>
            // Stir fry ingredients are single scoops (~34 cal for chicken), so skip the calorie floor
            (item.emoji || item.calories >= 50) && item.protein >= 5
        );
        filtered.sort((a, b) => a.ratio - b.ratio);
    }

    return filtered;
}

function renderFilteredData() {
    updateMetaLine();
    if (selectedView === 'week') {
        renderWeek();
    } else {
        renderFoods(filterAndSort(currentData));
    }
}

/**
 * Week view: one column per day, top 10 each
 */
function renderWeek() {
    hideLoading();
    hideError();
    weekGrid.innerHTML = weekDays.map((day, i) => dayColumnHtml(day, i)).join('');
}

/**
 * Replace one day's column in place, used as each day finishes loading.
 * `animate` plays the brief fade-in on that column only.
 */
function renderDayColumn(index, animate) {
    const col = weekGrid.children[index];
    if (!col) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = dayColumnHtml(weekDays[index], index, animate).trim();
    col.replaceWith(tpl.content.firstElementChild);
}

/**
 * One day's column. `items` is undefined while loading, null if it failed to load.
 */
function dayColumnHtml({ date, items, stirFry }, dayIndex, animate = false) {
    const isToday = dayIndex === 0;
    const d = new Date(`${date}T12:00:00Z`);
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const label = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'UTC' });

    let body;
    if (items === undefined) {
        body = `<div class="day-skeleton">${'<span class="sk sk-day-row"></span>'.repeat(6)}</div>`;
    } else if (items === null) {
        body = '<p class="day-empty">Couldn\'t load</p>';
    } else {
        const top = filterAndSort(items).slice(0, 10);
        body = top.length === 0
            ? '<p class="day-empty">No menu</p>'
            : `<ol class="day-list">${top.map((item, i) => createDayRow(item, i + 1)).join('')}</ol>`;
    }

    return `
    <section class="day-col${isToday ? ' is-today' : ''}${animate ? ' arrive' : ''}">
      <h2 class="day-head">
        <span class="day-name">${weekday}${stirFryBadge(stirFry)}</span>
        <span class="day-date">${label}</span>
      </h2>
      ${body}
    </section>`;
}

/**
 * Hide / restore a food by name (applies to every court and day)
 */
function setFoodHidden(name, hide) {
    const key = name.toLowerCase();
    if (hide) hiddenFoods.set(key, name);
    else hiddenFoods.delete(key);
    localStorage.setItem('hiddenFoods', JSON.stringify(Object.fromEntries(hiddenFoods)));
    updateHiddenUI();
    renderFilteredData();
}

function hideButton(name) {
    return `<button class="hide-btn" data-name="${encodeURIComponent(name)}" title="Hide ${escapeHtml(name)}" aria-label="Hide ${escapeHtml(name)}">✕</button>`;
}

/**
 * "N hidden" control + restore list
 */
function updateHiddenUI() {
    hiddenBox.hidden = hiddenFoods.size === 0;
    hiddenToggle.textContent = `${hiddenFoods.size} hidden`;
    if (hiddenFoods.size === 0) hiddenList.hidden = true;
    hiddenList.innerHTML = [...hiddenFoods.values()].map(name => `
      <li><span>${escapeHtml(name)}</span>
        <button class="restore-btn" data-name="${encodeURIComponent(name)}">Restore</button></li>`).join('');
}

/**
 * Emoji after the day name when Earhart's MYO Stir Fry has beef and/or chicken
 */
function stirFryBadge(stirFry) {
    if (!stirFry || !stirFry.available) return '';
    const emoji = (stirFry.beef ? '🐄' : '') + (stirFry.chicken ? '🐔' : '');
    if (!emoji) return '';
    const label = stirFry.beef ? 'MYO Stir Fry at Earhart has beef and chicken' : 'MYO Stir Fry at Earhart has chicken (no beef)';
    return `<span class="stirfry-badge" title="${label}" aria-label="${label}">${emoji}</span>`;
}

/**
 * Compact row for a week column
 */
function createDayRow(item, rank) {
    const ratio = selectedSort === 'fiber' ? item.fiberRatio : item.ratio;
    const ratioText = ratio != null ? ratio.toFixed(1) : '—';
    return `
    <li class="day-row" style="--bar: var(--${item.location.toLowerCase()})" title="${escapeHtml(item.name)} · ${escapeHtml(item.location)}">
      <span class="day-rank">${rank}</span>
      <span class="day-food">
        <span class="day-food-name">${escapeHtml(item.name)}${item.emoji ? ` <span class="food-emoji">${item.emoji}</span>` : ''}</span>
        <span class="day-food-meta">
          <span class="day-food-court">${escapeHtml(item.location)}</span>
          <span class="day-ratio">${ratioText}</span>
        </span>
      </span>
      ${hideButton(item.name)}
    </li>`;
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
        <h2 class="food-name">${escapeHtml(item.name)}${item.emoji ? ` <span class="food-emoji">${item.emoji}</span>` : ''}</h2>
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
      ${hideButton(item.name)}
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
    weekGrid.innerHTML = '';
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
