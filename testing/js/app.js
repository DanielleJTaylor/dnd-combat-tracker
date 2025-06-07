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
let themeToggle, creatureModal, modalForm, hpPopup;

// ============================================
// ========== INITIALIZATION & APP STATE ==========
// ============================================

function loadAppState() {
    const saved = localStorage.getItem('trackerData');
    if (!saved) {
        // These dashboard functions are in dashboard.js, which is loaded
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

function migrateCombatant(c) {
    if (c.spellSlots && typeof c.spellSlotsVisible === 'undefined') {
        c.spellSlotsVisible = false;
    }
    if (c.isGroup && c.members) {
        c.members.forEach(migrateCombatant);
    }
}

// ============================================
// ========== UTILITIES (SHARED) ==========
// ============================================
function generateUniqueId() { return `${Date.now()}-${Math.floor(Math.random() * 100000)}`; }

function logChange(msg) {
    const timestamp = new Date().toLocaleTimeString();
    historyLog.push(`[${timestamp}] ${msg}`);
    updateLogPanel();
    saveAppState();
}

function updateLogPanel() {
    const logContent = document.getElementById('historyLogContent');
    if (logContent) {
        logContent.innerHTML = historyLog.map(line => `<div>${line}</div>`).join('');
        logContent.scrollTop = logContent.scrollHeight;
    }
}

function getFlatCombatantList() {
    return combatants.flatMap(c => c.isGroup ? c.members.map(m => ({ ...m, groupInit: c.init })) : [{ ...c, groupInit: c.init }]).sort((a, b) => b.init - a.init || b.groupInit - a.groupInit);
}

function findCombatantById(id) {
    for (const c of combatants) {
        if (c.id === id) return c;
        if (c.isGroup && c.members) {
            const found = c.members.find(m => m.id === id);
            if (found) return found;
        }
    }
    return null;
}

// This function correctly generates a unique name for new or duplicated combatants
function getUniqueName(baseName) {
    const allNames = getFlatCombatantList().map(c => c.name);
    if (!allNames.includes(baseName)) {
        return baseName;
    }
    
    const match = baseName.match(/^(.*?)(?: \((\d+)\))?$/);
    const namePart = match[1].trim();
    let maxSuffix = 1;

    allNames.forEach(cName => {
        if (cName.startsWith(namePart)) {
            const cMatch = cName.match(/^(.*?)(?: \((\d+)\))?$/);
            if (cMatch && cMatch[1].trim() === namePart) {
                 const num = parseInt(cMatch[2], 10);
                 if (!isNaN(num) && num >= maxSuffix) {
                    maxSuffix = num + 1;
                 }
            }
        }
    });

    return `${namePart} (${maxSuffix})`;
}


// ============================================
// ========== IMPORT / EXPORT ==========
// ============================================
function triggerImport() { document.getElementById('importInput').click(); }

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const state = JSON.parse(e.target.result);
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
            logChange("📂 State loaded from file.");
        } catch (err) {
            console.error("Import Error:", err);
            alert('Failed to import file. It may be corrupted or in the wrong format.');
        } finally {
            // Reset file input to allow importing the same file again
            event.target.value = '';
        }
    };
    reader.readAsText(file); // This must be called to start the reading process
}

function saveEncounter() {
    const state = {
        combatants, dashboards, folders, round,
        currentTurnIndex, historyLog,
        isDarkTheme: document.body.classList.contains('dark')
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dnd-dashboard-state-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    logChange("💾 Full application state saved to file.");
}

// ============================================
// ========== EVENT LISTENERS ==========
// ============================================
function setupEventListeners() {
    // === ASSIGN DOM CONSTANTS ===
    themeToggle = document.getElementById('themeToggle');
    creatureModal = document.getElementById('creatureModal');
    modalForm = document.getElementById('modalCreatureForm');
    hpPopup = document.getElementById('hpPopup');

    // === ATTACH LISTENERS ===
    themeToggle.addEventListener('change', () => {
      document.body.classList.toggle('dark', themeToggle.checked);
      document.body.classList.toggle('light', !themeToggle.checked);
      saveAppState();
    });

    // Dashboard Panel (check if buttons exist first)
    const seeDashboardsBtn = document.getElementById('seeDashboardsBtn');
    const closeDashboardBtn = document.getElementById('closeDashboardBtn');
    const newDashboardBtn = document.getElementById('newDashboardBtn');
    const newFolderBtn = document.getElementById('newFolderBtn');
    if (seeDashboardsBtn && typeof toggleDashboardPanel === 'function') seeDashboardsBtn.addEventListener('click', () => toggleDashboardPanel(true));
    if (closeDashboardBtn && typeof toggleDashboardPanel === 'function') closeDashboardBtn.addEventListener('click', () => toggleDashboardPanel(false));
    if (newDashboardBtn && typeof createNewDashboard === 'function') newDashboardBtn.addEventListener('click', createNewDashboard);
    if (newFolderBtn && typeof createNewFolder === 'function') newFolderBtn.addEventListener('click', createNewFolder);
    
    // Combat Tracker Main Buttons
    document.getElementById('addCombatantBtn').addEventListener('click', () => {
        creatureModal.classList.remove('hidden');
        modalForm.reset();
        document.getElementById('extraFields').classList.add('hidden');
        document.getElementById('modalName').focus();
    });
    document.getElementById('addGroupBtn').addEventListener('click', addGroup);
    document.getElementById('startEncounterBtn').addEventListener('click', startEncounter);

    // Combat Tracker Controls
    document.getElementById('toggleLogBtn').addEventListener('click', () => {
        document.getElementById('trackerContainer').classList.toggle('show-log');
    });
    
    // Modals and Popups
    document.getElementById('showMoreBtn').addEventListener('click', () => {
        document.getElementById('extraFields').classList.toggle('hidden');
    });
    modalForm.addEventListener('submit', handleAddCombatant);

    window.addEventListener('click', (e) => {
        if (e.target === creatureModal) {
            creatureModal.classList.add('hidden');
        }
        if (!hpPopup.classList.contains('hidden') && !hpPopup.contains(e.target) && !e.target.closest('[data-field="hp"], [data-field="tempHp"]')) {
            hpPopup.classList.add('hidden');
        }
    });
    
    document.getElementById('importInput').addEventListener('change', handleFileImport);
    
    // Check for image upload input and function before adding listener
    const imageUploadInput = document.getElementById('imageUploadInput');
    if (imageUploadInput && typeof handleImageSelection === 'function') {
        imageUploadInput.addEventListener('change', handleImageSelection);
    }
    
    // This is a safer way to handle the clear button
    document.querySelector('button[onclick="clearData()"]').addEventListener('click', (e) => {
        e.preventDefault(); // Stop the old onclick attribute
        clearData(false); // Call the function directly
    });
}

// ============================================
// ========== APP INITIALIZATION ==========
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadAppState();
});