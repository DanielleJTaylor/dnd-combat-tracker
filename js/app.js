// ============================================
// ========== GLOBAL STATE & CONSTANTS ==========
// ============================================

// --- STATE VARIABLES ---
let combatants = [];
let dashboards = [];
let folders = [];
let currentTurnIndex = 0;
let round = 1;
let historyLog = [];
let currentlyOpenDashboardId = null;

// --- DOM ELEMENT VARIABLES (DECLARED BUT NOT ASSIGNED) ---
// MODIFIED: Removed modal-related variables
let themeToggle, hpPopup; 

// ============================================
// ========== INITIALIZATION & APP STATE ==========
// ============================================

function loadAppState() {
    const saved = localStorage.getItem('trackerData');
    if (!saved) {
        if (typeof loadInitialDashboardData === 'function') {
            loadInitialDashboardData(); 
            logChange("Loaded initial example dashboard data.");
            renderDashboardList();
        }
        renderCombatants();
        return;
    }
    try {
        const state = JSON.parse(saved);
        combatants = state.combatants || [];
        dashboards = state.dashboards || [];
        folders = state.folders || [];
        round = state.round || 1;
        currentTurnIndex = state.currentTurnIndex || 0;
        historyLog = state.historyLog || [];

        combatants.forEach(migrateCombatant);

        document.body.classList.toggle('dark', state.isDarkTheme);
        if(themeToggle) themeToggle.checked = state.isDarkTheme;

        document.getElementById('roundCounter').textContent = `Round: ${round}`;
        
        renderCombatants();
        if (typeof renderDashboardList === 'function') renderDashboardList();
        updateTurnDisplay();
        updateLogPanel();
        logChange("App state loaded from local storage.");
    } catch (err) {
        console.error('Error loading tracker data from localStorage:', err);
        alert('Failed to load saved data. It might be corrupted. Starting fresh.');
        clearData(true); // Force clear corrupted data
    }
}

function saveAppState() {
    const state = {
        combatants, dashboards, folders, round,
        currentTurnIndex, historyLog,
        isDarkTheme: document.body.classList.contains('dark')
    };
    localStorage.setItem('trackerData', JSON.stringify(state));
}

function clearData(force = false) {
    if (!force && !confirm('Are you sure you want to clear ALL encounter and dashboard data? This cannot be undone.')) {
        return;
    }
    localStorage.removeItem('trackerData');
    combatants = []; dashboards = []; folders = [];
    round = 1; currentTurnIndex = 0; historyLog = [];
    
    if (typeof loadInitialDashboardData === 'function') loadInitialDashboardData();
    renderCombatants();
    if (typeof renderDashboardList === 'function') renderDashboardList();
    updateTurnDisplay();
    logChange('🗑️ All encounter and dashboard data cleared.');
}


// =======================================================
// ========== DATA I/O FUNCTIONS (SAVE/LOAD FILE) ==========
// =======================================================

function triggerImport() {
    document.getElementById('importInput').click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedState = JSON.parse(e.target.result);
            if (typeof importedState.combatants === 'undefined' || typeof importedState.dashboards === 'undefined') {
                throw new Error("Invalid or corrupted file format.");
            }
            logChange(`📂 Successfully imported data from ${file.name}.`);
            localStorage.setItem('trackerData', e.target.result);
            loadAppState();
        } catch (error) {
            console.error('Error parsing imported file:', error);
            alert(`Failed to load file. It might be corrupted or not a valid tracker JSON file.\n\nError: ${error.message}`);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

function saveEncounter() {
    saveAppState(); 
    const stateJSON = localStorage.getItem('trackerData');

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(JSON.parse(stateJSON), null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `dnd-encounter-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    logChange('💾 Encounter data saved to file.');
}

function migrateCombatant(c) {
    if (c.spellSlots && typeof c.spellSlotsVisible === 'undefined') c.spellSlotsVisible = false;
    if (c.statusEffects && c.statusEffects.length > 0 && typeof c.statusEffects[0].appliedRound === 'undefined') {
        c.statusEffects = c.statusEffects.map(se => ({ id: generateUniqueId(), name: se.name, duration: se.rounds === Infinity ? Infinity : se.rounds, appliedRound: round }));
    }
    if (typeof c.tempHp === 'number' && c.tempHp > 0) {
        c.tempHpSources = [{ id: generateUniqueId(), amount: c.tempHp, duration: Infinity, appliedRound: round }];
    }
    if (!c.tempHpSources) c.tempHpSources = [];
    delete c.tempHp;
    if (c.isGroup && c.members) c.members.forEach(migrateCombatant);
}


// ============================================
// ========== EVENT LISTENERS ==========
// ============================================
function setupEventListeners() {
    // === ASSIGN DOM CONSTANTS ===
    themeToggle = document.getElementById('themeToggle');
    hpPopup = document.getElementById('hpPopup');

    // === ATTACH LISTENERS ===
    themeToggle.addEventListener('change', () => {
      document.body.classList.toggle('dark', themeToggle.checked);
      document.body.classList.toggle('light', !themeToggle.checked);
      saveAppState();
    });

    // Dashboard Panel
    const seeDashboardsBtn = document.getElementById('seeDashboardsBtn');
    const closeDashboardBtn = document.getElementById('closeDashboardBtn');
    const newDashboardBtn = document.getElementById('newDashboardBtn');
    const newFolderBtn = document.getElementById('newFolderBtn');
    if (seeDashboardsBtn && typeof toggleDashboardPanel === 'function') seeDashboardsBtn.addEventListener('click', () => toggleDashboardPanel(true));
    if (closeDashboardBtn && typeof toggleDashboardPanel === 'function') closeDashboardBtn.addEventListener('click', () => toggleDashboardPanel(false));
    if (newDashboardBtn && typeof createNewDashboard === 'function') newDashboardBtn.addEventListener('click', createNewDashboard);
    if (newFolderBtn && typeof createNewFolder === 'function') newFolderBtn.addEventListener('click', createNewFolder);
    
    // === MODIFIED: Combat Tracker Main Buttons now call direct-add functions ===
    document.getElementById('addCombatantBtn').addEventListener('click', addDefaultCombatant);
    document.getElementById('addGroupBtn').addEventListener('click', addDefaultGroup);
    document.getElementById('startEncounterBtn').addEventListener('click', startEncounter);

    // Combat Tracker Controls
    document.getElementById('toggleLogBtn').addEventListener('click', () => {
        document.getElementById('trackerContainer').classList.toggle('show-log');
    });
    
    // === MODIFIED: Removed modal-related listeners ===
    window.addEventListener('click', (e) => {
        // This listener now ONLY handles the HP popup
        if (!hpPopup.classList.contains('hidden') && !hpPopup.contains(e.target) && !e.target.closest('[data-field="hp"], [data-field="tempHp"]')) {
            hpPopup.classList.add('hidden');
        }
    });
    
    document.getElementById('importInput').addEventListener('change', handleFileImport);
    
    const imageUploadInput = document.getElementById('imageUploadInput');
    if (imageUploadInput && typeof handleImageSelection === 'function') {
        imageUploadInput.addEventListener('change', handleImageSelection);
    }
    
    document.querySelector('button[onclick="clearData()"]').addEventListener('click', (e) => {
        e.preventDefault();
        clearData(false);
    });
}

// ============================================
// ========== APP INITIALIZATION ==========
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadAppState();
});