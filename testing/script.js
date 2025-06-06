// ========== GLOBAL STATE ==========
let combatants = [];
let currentTurnIndex = 0;
let round = 1;
let historyLog = [];
let draggedCombatantId = null;

// Global variables for HP popup state
let currentCombatantIdForHp = null;
let currentHpFieldToEdit = null; // 'hp' or 'tempHp'

const hpPopup = document.getElementById('hpPopup');
const healingInput = document.getElementById('healingInput');
const damageInput = document.getElementById('damageInput');
const addTempHpInput = document.getElementById('addTempHpInput');

const statusOptions = [
    'Charmed', 'Frightened', 'Prone', 'Poisoned',
    'Stunned', 'Blinded', 'Invisible', 'Paralyzed', 'Restrained'
];


// ... (all of your existing JS code from the prompt)

// ========== GLOBAL STATE ==========
// ...

// ========== NEW: DASHBOARD PANEL LOGIC ==========
const appContainer = document.getElementById('app-container');
const seeDashboardsBtn = document.getElementById('seeDashboardsBtn');
const closeDashboardBtn = document.getElementById('closeDashboardBtn');

function toggleDashboardPanel(show) {
  if (show) {
    appContainer.classList.add('dashboard-visible');
    // You could also do more here, like fetch dashboard data
  } else {
    appContainer.classList.remove('dashboard-visible');
  }
}

seeDashboardsBtn.addEventListener('click', () => toggleDashboardPanel(true));
closeDashboardBtn.addEventListener('click', () => toggleDashboardPanel(false));


// Example of how to switch between dashboard panel and a sheet (for future use)
// This logic would be expanded to handle dynamic loading of sheets.
document.querySelectorAll('.dashboard-preview-card').forEach(card => {
  card.addEventListener('click', () => {
    document.getElementById('dashboard-panel-view').classList.remove('active');
    document.getElementById('dashboard-sheet-view').classList.add('active');
  });
});

document.querySelector('.sheet-header .back-button').addEventListener('click', () => {
    document.getElementById('dashboard-sheet-view').classList.remove('active');
    document.getElementById('dashboard-panel-view').classList.add('active');
});

// ========== THEME TOGGLE ==========
// ... (rest of your existing JS is unchanged)



// ========== THEME TOGGLE ==========
const themeToggle = document.getElementById('themeToggle');

themeToggle.addEventListener('change', () => {
  if (themeToggle.checked) {
    document.body.classList.remove('light');
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
    document.body.classList.add('light');
  }
});


// ========== UTILITIES ==========
function generateUniqueId() {
    return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function getUniqueName(baseName) {
    const match = baseName.match(/^(.*?)(?: (\d+))?$/);
    const namePart = match[1].trim();
    let maxSuffix = 0;

    getFlatCombatantList().forEach(c => {
        const cMatch = c.name.match(/^(.+?)(?: (\d+))?$/);
        if (!cMatch) return;
        const cName = cMatch[1].trim();
        const cNum = parseInt(cMatch[2]);
        if (cName === namePart) {
            if (!isNaN(cNum)) {
                maxSuffix = Math.max(maxSuffix, cNum);
            } else {
                maxSuffix = Math.max(maxSuffix, 1);
            }
        }
    });

    return maxSuffix === 0
        ? namePart
        : `${namePart} ${maxSuffix + 1}`;
}

function getFlatCombatantList() {
    return combatants.flatMap(c => {
        if (c.isGroup) {
            // Spread each member, but attach the group's initiative for sorting
            return c.members.map(m => ({ ...m, groupInit: c.init }));
        }
        return [{ ...c, groupInit: c.init }];
    }).sort((a, b) => b.groupInit - a.groupInit);
}


function findCombatantById(id) {
    for (const c of combatants) {
        if (c.id === id) return c;
        if (c.isGroup) {
            const found = c.members.find(m => m.id === id);
            if (found) return found;
        }
    }
    return null;
}


function updateLogPanel() {
    const logContent = document.getElementById('historyLogContent');
    if (!logContent) return;
    logContent.innerHTML = historyLog.map(line => `<div>${line}</div>`).join('');
    logContent.scrollTop = logContent.scrollHeight;
}



function logChange(msg) {
    const timestamp = new Date().toLocaleTimeString();
    historyLog.push(`[${timestamp}] ${msg}`);
    updateLogPanel(); // ✅ update the panel immediately
    saveCombatants(); // Persist changes
}


// ========== MODAL HANDLING ==========
const creatureModal = document.getElementById('creatureModal');
const modalForm = document.getElementById('modalCreatureForm');
const extraFields = document.getElementById('extraFields');
const showMoreBtn = document.getElementById('showMoreBtn');

document.getElementById('addCombatantBtn').addEventListener('click', () => {
    creatureModal.classList.remove('hidden');
    modalForm.reset(); // Reset form when opening
    extraFields.classList.add('hidden'); // Ensure extra fields are hidden
    document.getElementById('modalName').focus(); // Focus on the name field
});

showMoreBtn.addEventListener('click', () => {
    extraFields.classList.toggle('hidden');
});


modalForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('modalName').value.trim();
    const init = parseInt(document.getElementById('modalInit').value, 10);
    const isSpellcaster = document.getElementById('modalIsSpellcaster').checked;

    if (!name || isNaN(init)) {
        alert('Please enter a name and a valid initiative.');
        return;
    }

    const hp = parseInt(document.getElementById('modalHP').value, 10);
    const maxHp = parseInt(document.getElementById('modalMaxHP').value, 10);

    const initialHp = isNaN(hp) ? 10 : hp;
    const initialMaxHp = isNaN(maxHp) ? initialHp : maxHp;

    const newCombatant = {
        id: generateUniqueId(),
        name: getUniqueName(name),
        init,
        ac: parseInt(document.getElementById('modalAC').value || 0, 10),
        hp: initialHp,
        tempHp: 0,
        maxHp: initialMaxHp,
        role: document.getElementById('modalRole').value || 'player',
        statusEffects: [],
        isGroup: false,
        previousInit: init,
        spellSlotsVisible: false // Start with panel closed
    };

    // If the combatant is a spellcaster, initialize their spell slot data
    if (isSpellcaster) {
        newCombatant.spellSlots = {
            1: { current: 0, max: 0 },
            2: { current: 0, max: 0 },
            3: { current: 0, max: 0 },
            4: { current: 0, max: 0 },
            5: { current: 0, max: 0 },
            6: { current: 0, max: 0 },
            7: { current: 0, max: 0 },
            8: { current: 0, max: 0 },
            9: { current: 0, max: 0 },
        };
    }

    combatants.push(newCombatant);
    logChange(`➕ Added ${newCombatant.name} (Init: ${newCombatant.init})`);
    saveCombatants();
    renderCombatants();

    creatureModal.classList.add('hidden');
    modalForm.reset(); // Reset form after submission
});

window.addEventListener('click', (e) => {
    if (e.target === creatureModal) {
        creatureModal.classList.add('hidden');
    }
});

// ========== SAVE & LOAD ==========
function saveCombatants() {
    const state = {
        combatants,
        round,
        currentTurnIndex,
        historyLog,
        isDarkTheme: document.body.classList.contains('dark') // Save theme state
    };
    localStorage.setItem('trackerData', JSON.stringify(state));
}

function loadCombatants() {
    const saved = localStorage.getItem('trackerData');
    if (!saved) return;
    try {
        const state = JSON.parse(saved);
        combatants = state.combatants || [];
        combatants.forEach(migrateCombatant);
        round = state.round || 1;
        currentTurnIndex = state.currentTurnIndex || 0;
        historyLog = state.historyLog || [];

        if (state.isDarkTheme) {
            document.body.classList.add('dark');
            document.getElementById('themeToggle').checked = true;
        } else {
            document.body.classList.remove('dark');
            document.getElementById('themeToggle').checked = false;
        }

        document.getElementById('roundCounter').textContent = `Round: ${round}`;
        renderCombatants();
        updateTurnDisplay();
        logChange("Encounter loaded from storage.");
    } catch (err) {
        console.error('Error loading tracker data:', err);
        alert('Failed to load saved data. It might be corrupted.');
        clearData(); // Clear potentially corrupted data
    }
}

function clearData() {
    if (!confirm('Are you sure you want to clear all encounter data? This cannot be undone.')) {
        return;
    }
    localStorage.removeItem('trackerData');
    combatants = [];
    round = 1;
    currentTurnIndex = 0;
    historyLog = [];
    renderCombatants();
    updateTurnDisplay();
    logChange('🗑️ All encounter data cleared.');
}

// ========== START ENCOUNTER ==========
document.getElementById('startEncounterBtn').addEventListener('click', () => {
    round = 1;
    currentTurnIndex = 0;
    document.getElementById('roundCounter').textContent = `Round: 1`;
    logChange('🎲 Encounter started');
    renderCombatants(); // Re-render to highlight current turn
});

// ========== ADD GROUP BUTTON ==========
document.getElementById('addGroupBtn').addEventListener('click', () => {
    const groupName = prompt("Enter group name:");
    if (!groupName) return;

    const groupInitInput = prompt(`Enter initiative for "${groupName}":`);
    const groupInit = parseInt(groupInitInput, 10);

    if (isNaN(groupInit)) {
        alert("Invalid initiative. Please enter a number.");
        return;
    }

    const newGroup = {
        id: generateUniqueId(),
        name: getUniqueName(groupName),
        init: groupInit,
        isGroup: true,
        members: [],
        previousInit: groupInit
    };

    combatants.push(newGroup);
    logChange(`➕ Group created: ${newGroup.name} (Init: ${newGroup.init})`);
    saveCombatants();
    renderCombatants();
});

// ==================================================
// ========== PART 3: COMBATANT RENDERING LOGIC (REFACTORED) ==========
// ==================================================

function renderCombatants() {
    const list = document.getElementById('combatantList');
    list.innerHTML = '';
    document.body.classList.remove('dragging');

    const sortedCombatants = [...combatants].sort((a, b) => b.init - a.init);

    sortedCombatants.forEach((item, index) => {
        list.appendChild(createDropZone(item, null, index, 'before'));

        if (item.isGroup) {
            // Create the draggable header for the group
            const groupHeaderWrapper = createGroupHeaderWrapper(item);
            list.appendChild(groupHeaderWrapper);

            // Create a drop zone for adding the first member to the group
            list.appendChild(createDropZone(item, item, 0, 'group-internal'));

            item.members.forEach((member, memberIndex) => {
                // Create a full wrapper for each member
                const memberWrapper = createCombatantWrapper(member, true, item);
                list.appendChild(memberWrapper);
                // Create a drop zone after this member
                list.appendChild(createDropZone(member, item, memberIndex + 1, 'group-internal'));
            });
        } else {
            // Create a full wrapper for an individual combatant
            const combatantWrapper = createCombatantWrapper(item, false, null);
            list.appendChild(combatantWrapper);
        }
    });

    // Add final drop zone at the end of the list
    if (sortedCombatants.length > 0) {
        list.appendChild(createDropZone(null, null, sortedCombatants.length, 'after'));
    } else {
        list.appendChild(createDropZone(null, null, 0, 'empty-list'));
    }

    updateTurnDisplay();
    saveCombatants();
}

/**
 * NEW: Creates the entire "box" for a single combatant.
 * This wrapper is draggable and contains the info row and spell panel.
 */
function createCombatantWrapper(c, isGrouped = false, groupRef = null) {
    const wrapper = document.createElement('div');
    wrapper.className = 'combatant-wrapper';
    if(isGrouped) {
        wrapper.classList.add('group-member-wrapper');
    }
    wrapper.setAttribute("draggable", "true");
    wrapper.dataset.combatantId = c.id;

    // Attach drag-and-drop event listeners to the wrapper
    wrapper.ondragstart = (e) => {
        draggedCombatantId = c.id;
        e.dataTransfer.setData("text/plain", c.id);
        e.dataTransfer.effectAllowed = "move";
        document.body.classList.add('dragging');
    };
    wrapper.ondragend = () => {
        document.body.classList.remove('dragging');
    };

    // Create the main info row and add it to the wrapper
    const row = createCombatantRow(c, isGrouped, groupRef);
    wrapper.appendChild(row);

    // If the combatant is a spellcaster and the panel is visible, add it
    if (c.spellSlotsVisible) {
        const panel = createSpellSlotPanel(c);
        wrapper.appendChild(panel);
    }

    return wrapper;
}


/**
 * REFACTORED: Creates the draggable header "box" for a group.
 */
function createGroupHeaderWrapper(group) {
    const wrapper = document.createElement('div');
    wrapper.className = 'combatant-wrapper group-header-wrapper';
    wrapper.setAttribute("draggable", "true");
    wrapper.dataset.combatantId = group.id;

    wrapper.ondragstart = (e) => {
        draggedCombatantId = group.id;
        e.dataTransfer.setData("text/plain", group.id);
        e.dataTransfer.effectAllowed = "move";
        document.body.classList.add('dragging');
    };
    wrapper.ondragend = () => {
        document.body.classList.remove('dragging');
    };

    const row = document.createElement('div');
    row.className = 'group-header creature-row';
    row.innerHTML = `
        <div class="cell image-cell">📁</div>
        <div class="cell init-cell" contenteditable="true" data-field="init">${group.init}</div>
        <div class="cell cell-name" contenteditable="true" data-field="name">${group.name}</div>
        <div class="cell cell-ac"></div>
        <div class="cell cell-hp"></div>
        <div class="cell"></div>
        <div class="cell"></div>
        <div class="cell status-cell"></div>
        <div class="cell role-cell">DM Group</div>
        <div class="cell action-cell">
            <button onclick="duplicateCombatant('${group.id}')" title="Duplicate Group">+</button>
            <button onclick="deleteCombatant('${group.id}')" title="Delete Group">🗑</button>
        </div>
    `;

    // Attach event listeners for editable fields on the group header
    row.querySelectorAll('[contenteditable="true"]').forEach(cell => {
        cell.addEventListener('blur', (e) => {
            const field = cell.dataset.field;
            const oldValue = group[field];
            const newValueRaw = cell.textContent.trim();
            let newValue;

            if (field === 'init') {
                newValue = parseInt(newValueRaw, 10);
                if (isNaN(newValue)) {
                    alert('Invalid input for initiative. Please enter a number.');
                    cell.textContent = oldValue;
                    return;
                }
            } else {
                newValue = newValueRaw;
            }

            if (newValue !== oldValue) {
                logChange(`Group ${group.name}'s ${field} changed from ${oldValue} to ${newValue}`);
                group[field] = newValue;
                saveCombatants();
                renderCombatants();
            }
        });

        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
        });
    });

    wrapper.appendChild(row);
    return wrapper;
}


function createDropZone(targetItem, targetGroup, targetIndex, type) {
    const drop = document.createElement('div');
    drop.className = 'drop-zone';
    drop.dataset.targetId = targetItem?.id || '';
    drop.dataset.targetGroup = targetGroup?.id || '';
    drop.dataset.targetIndex = targetIndex;
    drop.dataset.dropType = type;

    drop.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        document.body.classList.add('dragging');
        drop.classList.add('highlight');
    });

    drop.addEventListener('dragleave', () => {
        drop.classList.remove('highlight');
    });

    drop.addEventListener('drop', e => {
        e.preventDefault();
        document.body.classList.remove('dragging');
        drop.classList.remove('highlight');

        const draggedId = e.dataTransfer.getData("text/plain");
        if (!draggedId || draggedId === drop.dataset.targetId) return;

        const dragged = removeCombatantById(draggedId);
        if (!dragged) return;

        if (!dragged.isGroup && dragged.previousInit !== undefined) {
             dragged.init = dragged.previousInit;
        }

        const targetGroupId = drop.dataset.targetGroup;
        const targetIdx = parseInt(drop.dataset.targetIndex, 10);

        if (targetGroupId) {
            const targetGroup = combatants.find(c => c.id === targetGroupId && c.isGroup);
            if (targetGroup && !targetGroup.members.some(m => m.id === dragged.id)) {
                targetGroup.members.splice(targetIdx, 0, dragged);
                logChange(`${dragged.name} added to group ${targetGroup.name}`);
            }
        } else {
            combatants.splice(targetIdx, 0, dragged);
            logChange(`${dragged.name} moved to main list`);
        }

        renderCombatants();
    });

    return drop;
}

function removeCombatantById(id) {
    let found = null;
    combatants = combatants.filter(c => {
        if (c.id === id) {
            found = c;
            return false;
        }
        return true;
    });
    if (found) return found;

    for (const group of combatants) {
        if (group.isGroup && group.members) {
            group.members = group.members.filter(m => {
                if (m.id === id) {
                    found = m;
                    return false;
                }
                return true;
            });
            if (found) {
                if (group.members.length === 0 && confirm(`Group "${group.name}" is now empty. Do you want to remove it?`)) {
                    combatants = combatants.filter(c => c.id !== group.id);
                    logChange(`Group ${group.name} was removed because it became empty.`);
                }
                break;
            }
        }
    }
    return found;
}

// ========== PART 4: Combatant Row, Status Effects & Actions ==========

/**
 * REFACTORED: This function now ONLY creates the info row, not the draggable wrapper.
 */
function createCombatantRow(c, isGrouped = false, groupRef = null) {
    const row = document.createElement('div');
    row.className = 'creature-row';
    if (isGrouped) row.classList.add('group-member');

    if (c.role === 'dm') row.classList.add('dm-row');
    else row.classList.add('player-row');

    const statusTags = (c.statusEffects || []).map(se => `<span class="status-tag">${se.name} (${se.rounds})</span>`).join(' ');
    const statusDropdown = `<select onchange="applyStatusEffect('${c.id}', this)"><option value="">＋ Add</option>${statusOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
    const imageContent = c.imageUrl ? `<img src="${c.imageUrl}" alt="${c.name}" class="combatant-image">` : '🧍';
    const imageCell = `<div class="cell image-cell" data-field="imageUrl">${imageContent}</div>`;
    
    let spellButton = '';
    if (c.spellSlots) {
        spellButton = `<button onclick="toggleSpellSlots('${c.id}')" title="Toggle Spell Slots">🪄</button>`;
    } else {
        spellButton = `<button onclick="makeSpellcaster('${c.id}')" title="Make Spellcaster">✨</button>`;
    }

    row.innerHTML = `
        ${imageCell}
        <div class="cell init-cell" ${isGrouped ? '' : 'contenteditable="true"'} data-field="init">${isGrouped ? '' : c.init}</div>
        <div class="cell cell-name" contenteditable="true" data-field="name">${c.name}</div>
        <div class="cell cell-ac" contenteditable="true" data-field="ac">${c.ac}</div>
        <div class="cell" contenteditable="true" data-field="hp">${c.hp}</div>
        <div class="cell" contenteditable="true" data-field="tempHp">${c.tempHp || 0}</div>
        <div class="cell" contenteditable="true" data-field="maxHp">${c.maxHp || 0}</div>
        <div class="cell status-cell">${statusTags} ${statusDropdown}</div>
        <div class="cell role-cell" contenteditable="true" data-field="role">${c.role || 'player'}</div>
        <div class="cell action-cell">
            <button onclick="duplicateCombatant('${c.id}')" title="Duplicate Combatant">+</button>
            ${groupRef ? `<button onclick="removeFromGroup('${c.id}', '${groupRef.id}')" title="Remove from Group">⬅</button>` : ''}
            ${spellButton}
            <button onclick="deleteCombatant('${c.id}')" title="Delete Combatant">🗑</button>
        </div>
    `;

    attachEditableEvents(row, c);
    attachImageEditEvent(row, c);

    row.querySelector('[data-field="hp"]')?.addEventListener('contextmenu', (e) => { e.preventDefault(); showHpPopup(c.id, e, 'hp'); });
    row.querySelector('[data-field="tempHp"]')?.addEventListener('contextmenu', (e) => { e.preventDefault(); showHpPopup(c.id, e, 'tempHp'); });

    return row;
}



function attachEditableEvents(row, c) {
    row.querySelectorAll('[contenteditable="true"]').forEach(cell => {
        cell.addEventListener('blur', (e) => {
            const field = cell.dataset.field;
            const oldValue = c[field];
            let newValueRaw = cell.textContent.trim();
            let newValue;

            const isNumericField = ['init', 'ac', 'hp', 'tempHp', 'maxHp'].includes(field);

            if (isNumericField) {
                newValue = parseInt(newValueRaw, 10);
                if (isNaN(newValue)) {
                    alert(`Invalid input for ${field}. Please enter a number.`);
                    cell.textContent = oldValue;
                    return;
                }
            } else {
                newValue = newValueRaw;
            }


            if (newValue !== oldValue) {
                if (field === 'hp') {
                    if (newValue > c.maxHp) {
                        if (confirm(`HP (${newValue}) is higher than max (${c.maxHp}). Set to max?`)) {
                            newValue = c.maxHp;
                        } else {
                            cell.textContent = oldValue;
                            return;
                        }
                    }
                    newValue = Math.max(0, newValue);
                    logChange(`${c.name} HP changed: ${oldValue}/${c.maxHp} → ${newValue}/${c.maxHp}`);
                    c.hp = newValue;

                } else if (field === 'tempHp') {
                    newValue = Math.max(0, newValue);
                    logChange(`${c.name} Temp HP changed: ${oldValue} → ${newValue}`);
                    c.tempHp = newValue;
                } else if (field === 'maxHp') {
                    newValue = Math.max(0, newValue);
                    logChange(`${c.name} Max HP changed: ${oldValue} → ${newValue}`);
                    c.maxHp = newValue;
                    if (c.hp > c.maxHp) {
                        c.hp = c.maxHp;
                        logChange(`${c.name} current HP clamped to new Max HP: ${c.hp}`);
                    }
                } else {
                     if (field === 'name') {
                        const newUniqueName = getUniqueName(newValue);
                        logChange(`${oldValue}'s name changed to ${newUniqueName}`);
                        newValue = newUniqueName;
                    } else {
                        logChange(`${c.name}'s ${field} changed to ${newValue}`);
                    }
                    c[field] = newValue;
                }
                cell.textContent = newValue;
            }

            saveCombatants();
            if (newValue !== oldValue || isNumericField) {
                 renderCombatants();
            }
        });

        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
        });
    });
}


function attachImageEditEvent(row, c) {
    const imageCell = row.querySelector('.image-cell');
    imageCell?.addEventListener('dblclick', () => {
        const newImageUrl = prompt(`Enter new image URL for ${c.name}:`, c.imageUrl || '');
        if (newImageUrl !== null) {
            const trimmed = newImageUrl.trim();
            if (trimmed !== c.imageUrl) {
                logChange(`${c.name}'s image ${trimmed ? `set to ${trimmed}` : 'removed'}`);
                c.imageUrl = trimmed;
                saveCombatants();
                renderCombatants();
            }
        }
    });
}


function showHpPopup(combatantId, event, fieldType) {
    currentCombatantIdForHp = combatantId;
    currentHpFieldToEdit = fieldType;
    const combatant = findCombatantById(combatantId);
    if (!combatant) return;

    const cellRect = event.target.getBoundingClientRect();
    hpPopup.style.left = `${cellRect.left + window.scrollX}px`;
    hpPopup.style.top = `${cellRect.bottom + window.scrollY + 8}px`;
    hpPopup.classList.remove('hidden');

    healingInput.value = '';
    damageInput.value = '';
    addTempHpInput.value = '';

    if (fieldType === 'hp') healingInput.focus();
    else if (fieldType === 'tempHp') addTempHpInput.focus();
}

function applyHpChange() {
    if (!currentCombatantIdForHp) return;
    const combatant = findCombatantById(currentCombatantIdForHp);
    if (!combatant) return;

    const healingAmount = parseInt(healingInput.value, 10) || 0;
    const damageAmount = parseInt(damageInput.value, 10) || 0;
    const tempHpGain = parseInt(addTempHpInput.value, 10) || 0;

    const oldHp = combatant.hp;
    const oldTempHp = combatant.tempHp || 0;

    if (tempHpGain > 0) {
        combatant.tempHp = oldTempHp + tempHpGain;
        logChange(`${combatant.name} gains ${tempHpGain} temporary HP. Total: ${combatant.tempHp}`);
    }

    if (healingAmount > 0) {
        const newHp = Math.min(combatant.maxHp, combatant.hp + healingAmount);
        if (newHp > oldHp) {
            combatant.hp = newHp;
            logChange(`${combatant.name} is healed for ${newHp - oldHp}. HP: ${combatant.hp}/${combatant.maxHp}`);
        }
    }

    if (damageAmount > 0) {
        let remainingDamage = damageAmount;
        let currentTempHp = combatant.tempHp || 0;
        logChange(`${combatant.name} takes ${damageAmount} damage.`);

        if (currentTempHp > 0) {
            const damageToTemp = Math.min(currentTempHp, remainingDamage);
            combatant.tempHp -= damageToTemp;
            remainingDamage -= damageToTemp;
            if (damageToTemp > 0) logChange(`  -${damageToTemp} absorbed by Temp HP (New Temp HP: ${combatant.tempHp})`);
        }
        if (remainingDamage > 0) {
            const damageToHp = Math.min(combatant.hp, remainingDamage);
            if (damageToHp > 0) {
                combatant.hp -= damageToHp;
                logChange(`  -${damageToHp} dealt to main HP (New HP: ${combatant.hp}/${combatant.maxHp})`);
            }
        }
    }

    saveCombatants();
    renderCombatants();
    hpPopup.classList.add('hidden');
    currentCombatantIdForHp = null;
    currentHpFieldToEdit = null;
}

window.addEventListener('click', (e) => {
    if (!hpPopup.classList.contains('hidden') && !hpPopup.contains(e.target) && !e.target.closest('[data-field="hp"], [data-field="tempHp"]')) {
        hpPopup.classList.add('hidden');
        currentCombatantIdForHp = null;
        currentHpFieldToEdit = null;
    }
}, true);


// ========== PART 5: Turn Logic & Status Effects ==========

function applyStatusEffect(id, select) {
    const effect = select.value;
    select.value = "";
    if (!effect) return;

    const roundsStr = prompt(`How many rounds for ${effect}?`);
    if (roundsStr === null) return;
    const rounds = parseInt(roundsStr, 10);

    if (isNaN(rounds) || rounds <= 0) {
        alert('Please enter a valid number of rounds greater than 0.');
        return;
    }

    const target = findCombatantById(id);
    if (!target) return;
    if (!target.statusEffects) target.statusEffects = [];

    const existingEffect = target.statusEffects.find(se => se.name === effect);
    if (existingEffect) {
        existingEffect.rounds += rounds;
        logChange(`${target.name} ${effect} duration extended to ${existingEffect.rounds} rounds`);
    } else {
        target.statusEffects.push({ name: effect, rounds });
        logChange(`${target.name} became ${effect} (${rounds} rounds)`);
    }

    saveCombatants();
    renderCombatants();
}

function tickStatusEffects() {
    combatants.forEach(c => {
        const membersToTick = c.isGroup ? c.members : [c];
        membersToTick.forEach(m => {
            if (!m.statusEffects?.length) return;
            const oldLength = m.statusEffects.length;
            m.statusEffects = m.statusEffects.map(se => ({ ...se, rounds: se.rounds - 1 })).filter(se => se.rounds > 0);
            if (oldLength - m.statusEffects.length > 0) {
                logChange(`${m.name} had status effect(s) expire.`);
            }
        });
    });
}

function nextTurn() {
    const list = getFlatCombatantList();
    if (list.length === 0) return;

    if (currentTurnIndex === list.length - 1) {
        round++;
        document.getElementById('roundCounter').textContent = `Round: ${round}`;
        logChange(`⏩ Round ${round} begins`);
        tickStatusEffects();
    }
    
    currentTurnIndex = (currentTurnIndex + 1) % list.length;
    
    updateTurnDisplay();
    renderCombatants();
}

function prevTurn() {
    const list = getFlatCombatantList();
    if (list.length === 0) return;

    if (currentTurnIndex === 0 && round > 1) {
        round = Math.max(1, round - 1);
        document.getElementById('roundCounter').textContent = `Round: ${round}`;
        logChange(`⏪ Reverted to Round ${round}`);
    }
    
    currentTurnIndex = (currentTurnIndex - 1 + list.length) % list.length;

    updateTurnDisplay();
    renderCombatants();
}

function updateTurnDisplay() {
    const list = getFlatCombatantList();
    const current = list[currentTurnIndex];
    const display = document.getElementById('currentTurnDisplay');

    // MODIFIED: Target the wrapper for highlighting
    document.querySelectorAll('.combatant-wrapper.current-turn').forEach(wrapper => {
        wrapper.classList.remove('current-turn');
    });

    if (current) {
        display.innerHTML = `🟢 Current Turn: <strong>${current.name}</strong>`;
        // MODIFIED: Find the wrapper and add the class
        const currentWrapper = document.querySelector(`.combatant-wrapper[data-combatant-id="${current.id}"]`);
        if (currentWrapper) {
            currentWrapper.classList.add('current-turn');
        }
    } else {
        display.innerHTML = `🟢 Current Turn: <strong>None</strong>`;
    }
}

function scrollToCurrentTurn() {
    const list = getFlatCombatantList();
    if (list.length === 0) return;
    const current = list[currentTurnIndex];
    if (current) {
        // MODIFIED: Find the wrapper to scroll to
        const currentWrapper = document.querySelector(`.combatant-wrapper[data-combatant-id="${current.id}"]`);
        if (currentWrapper) {
            currentWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}


// ========== PART 6: Other Actions ==========

function duplicateCombatant(id) {
    const original = findCombatantById(id);
    if (!original) return;

    const clone = JSON.parse(JSON.stringify(original));
    clone.id = generateUniqueId();
    clone.name = getUniqueName(original.name);
    clone.statusEffects = [...(original.statusEffects || [])];
    clone.previousInit = original.init;
    clone.spellSlotsVisible = false;
    clone.members = original.isGroup ? original.members.map(member => ({
        ...JSON.parse(JSON.stringify(member)),
        id: generateUniqueId(),
        name: getUniqueName(member.name),
        previousInit: member.init,
        spellSlotsVisible: false
    })) : [];

    let addedToGroup = false;
    for (const group of combatants) {
        if (group.isGroup && group.members.some(m => m.id === id)) {
            group.members.push(clone);
            addedToGroup = true;
            break;
        }
    }

    if (!addedToGroup) combatants.push(clone);
    logChange(`Duplicated ${original.name} → ${clone.name}`);
    renderCombatants();
}

function migrateCombatant(c) {
    if (c.spellSlots && typeof c.spellSlotsVisible === 'undefined') {
        c.spellSlotsVisible = false;
    }
    if (c.isGroup && c.members) {
        c.members.forEach(migrateCombatant);
    }
}

function deleteCombatant(id) {
    const combatant = findCombatantById(id);
    if (combatant && confirm(`Are you sure you want to delete ${combatant.name}?`)) {
        removeCombatantById(id);
        logChange(`${combatant.name} was deleted.`);
        renderCombatants();
    }
}

function removeFromGroup(id, groupId) {
    const group = combatants.find(c => c.id === groupId && c.isGroup);
    if (!group) return;
    const memberIndex = group.members.findIndex(m => m.id === id);
    if (memberIndex === -1) return;
    
    const member = group.members[memberIndex];
    if (!confirm(`Are you sure you want to remove "${member.name}" from the group "${group.name}"?`)) return;
    
    group.members.splice(memberIndex, 1);
    member.init = member.previousInit ?? member.init;
    combatants.push(member);
    logChange(`${member.name} was removed from ${group.name}`);

    if (group.members.length === 0 && confirm(`Group "${group.name}" is now empty. Remove it?`)) {
        combatants = combatants.filter(c => c.id !== group.id);
        logChange(`Group ${group.name} was removed.`);
    }
    renderCombatants();
}

function triggerImport() { document.getElementById('importInput').click(); }

document.getElementById('importInput').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const state = JSON.parse(event.target.result);
            combatants = state.combatants || [];
            combatants.forEach(migrateCombatant);
            round = state.round || 1;
            currentTurnIndex = state.currentTurnIndex || 0;
            historyLog = state.historyLog || [];

            if (state.isDarkTheme) {
                document.body.classList.add('dark');
                document.getElementById('themeToggle').checked = true;
            } else {
                document.body.classList.remove('dark');
                document.body.classList.add('light');
                document.getElementById('themeToggle').checked = false;
            }
            document.getElementById('roundCounter').textContent = `Round: ${round}`;
            renderCombatants();
            updateTurnDisplay();
            logChange("📂 Encounter loaded from file.");
        } catch (err) {
            alert('Failed to import encounter file.');
        } finally {
            e.target.value = '';
        }
    };
    reader.readAsText(file);
});

function saveEncounter() {
    const data = { combatants, round, currentTurnIndex, historyLog, isDarkTheme: document.body.classList.contains('dark') };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "dnd-combat-tracker-encounter.json";
    a.click();
    URL.revokeObjectURL(a.href);
    logChange("💾 Encounter saved to file.");
}

document.getElementById('toggleLogBtn').addEventListener('click', () => {
    document.getElementById('trackerContainer').classList.toggle('show-log');
    updateLogPanel();
});

document.addEventListener('DOMContentLoaded', loadCombatants);

// ============================================
// ========== SPELL SLOT FUNCTIONS ==========
// ============================================

function toggleSpellSlots(id) {
    const combatant = findCombatantById(id);
    if (combatant?.spellSlots) {
        combatant.spellSlotsVisible = !combatant.spellSlotsVisible;
        renderCombatants();
    }
}

function makeSpellcaster(id) {
    const combatant = findCombatantById(id);
    if (!combatant || combatant.spellSlots) return;
    combatant.spellSlots = { 1: { c: 0, m: 0 }, 2: { c: 0, m: 0 }, 3: { c: 0, m: 0 }, 4: { c: 0, m: 0 }, 5: { c: 0, m: 0 }, 6: { c: 0, m: 0 }, 7: { c: 0, m: 0 }, 8: { c: 0, m: 0 }, 9: { c: 0, m: 0 } };
    combatant.spellSlotsVisible = true;
    logChange(`${combatant.name} is now a spellcaster.`);
    renderCombatants();
}

function adjustMaxSlots(id, level, amount) {
    const c = findCombatantById(id)?.spellSlots?.[level];
    if (!c) return;
    c.m = Math.max(0, c.m + amount);
    c.c = Math.min(c.c, c.m);
    renderCombatants();
}

function updateMaxSlots(id, level, value) {
    const c = findCombatantById(id)?.spellSlots?.[level];
    if (!c) return;
    const max = parseInt(value, 10);
    if (!isNaN(max) && max >= 0) {
        c.m = max;
        c.c = Math.min(c.c, c.m);
        renderCombatants();
    }
}

function updateCurrentSlots(id, level, value) {
    const c = findCombatantById(id)?.spellSlots?.[level];
    if (!c) return;
    const current = parseInt(value, 10);
    if (!isNaN(current)) {
        c.c = Math.max(0, Math.min(current, c.m));
        renderCombatants();
    }
}

function createSpellSlotPanel(c) {
    const panel = document.createElement('div');
    panel.className = 'spell-slot-panel';
    panel.dataset.combatantId = c.id;

    let activeLevelsHTML = '';
    const inactiveLevels = [];
    for (const level in c.spellSlots) {
        const slot = c.spellSlots[level];
        if (slot.m > 0) {
            let checkboxesHTML = Array.from({ length: slot.m }, (_, i) => `<input type="checkbox" disabled ${i < slot.c ? 'checked' : ''}>`).join('');
            activeLevelsHTML += `
                <div class="spell-level-row">
                    <div class="spell-level-label">Lvl ${level}</div>
                    <div class="spell-slot-inputs">
                        <input type="number" class="slot-input" value="${slot.c}" onblur="updateCurrentSlots('${c.id}', ${level}, this.value)" min="0" max="${slot.m}" title="Used Slots">
                        <span class="slot-separator">/</span>
                        <input type="number" class="slot-input" value="${slot.m}" onblur="updateMaxSlots('${c.id}', ${level}, this.value)" min="0" title="Max Slots">
                    </div>
                    <div class="checkbox-container" title="${slot.c} of ${slot.m} slots used">${checkboxesHTML}</div>
                    <div class="spell-slot-controls">
                        <button onclick="adjustMaxSlots('${c.id}', ${level}, 1)" title="Add Max Slot">+</button>
                        <button onclick="adjustMaxSlots('${c.id}', ${level}, -1)" title="Remove Max Slot">-</button>
                    </div>
                </div>`;
        } else {
            inactiveLevels.push(level);
        }
    }

    let inactiveLevelsHTML = '';
    if (inactiveLevels.length > 0) {
        const inputs = inactiveLevels.map(level => `
            <div class="add-slot-input-group">
                L${level}: <input type="number" class="slot-input" value="0" onblur="updateMaxSlots('${c.id}', ${level}, this.value)" min="0">
            </div>`).join('');
        inactiveLevelsHTML = `<div class="spell-level-row add-slot-level-row"><div class="spell-level-label">Set Max Slots</div><div class="add-slot-inputs">${inputs}</div></div>`;
    }

    panel.innerHTML = activeLevelsHTML + inactiveLevelsHTML;
    return panel;
}