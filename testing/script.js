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

// ... (your existing code) ...

modalForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('modalName').value.trim();
    const init = parseInt(document.getElementById('modalInit').value, 10);
    // Removed the old ac, hp, maxHp parsing here

    if (!name || isNaN(init)) {
        alert('Please enter a name and a valid initiative.');
        return;
    }

    // --- PASTE THE NEW CODE HERE ---
    const hp = parseInt(document.getElementById('modalHP').value, 10);
    const maxHp = parseInt(document.getElementById('modalMaxHP').value, 10);

    const initialHp = isNaN(hp) ? 10 : hp; // Default to 10 if no HP given
    const initialMaxHp = isNaN(maxHp) ? initialHp : maxHp; // Default max to initial HP if no max given

    const newCombatant = {
        id: generateUniqueId(),
        name: getUniqueName(name),
        init,
        ac: parseInt(document.getElementById('modalAC').value || 0, 10), // AC can default to 0
        hp: initialHp,
        tempHp: 0,
        maxHp: initialMaxHp,
        role: document.getElementById('modalRole').value || 'player', // Make sure role is correctly assigned
        statusEffects: [],
        isGroup: false,
        previousInit: init
    };
    // --- END OF NEW CODE ---

    combatants.push(newCombatant);
    logChange(`➕ Added ${newCombatant.name} (Init: ${newCombatant.init})`);
    saveCombatants();
    renderCombatants();

    creatureModal.classList.add('hidden');
    // Form is reset on open, no need here.
});

// ... (rest of your existing code) ...

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
        round = state.round || 1;
        currentTurnIndex = state.currentTurnIndex || 0;
        historyLog = state.historyLog || [];

        // Apply theme state
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
        name: getUniqueName(groupName), // Removed '(Group)' suffix from name generation for cleaner base name
        init: groupInit,
        isGroup: true,
        members: [],
        previousInit: groupInit // Groups also store their initiative
    };

    combatants.push(newGroup);
    logChange(`➕ Group created: ${newGroup.name} (Init: ${newGroup.init})`);
    saveCombatants();
    renderCombatants();
});

// ========== PART 3: Rendering Combatants & Drop Zones ==========

function renderCombatants() {
    const list = document.getElementById('combatantList');
    list.innerHTML = '';
    document.body.classList.remove('dragging');

    // Sort combatants first, then iterate
    const sortedCombatants = [...combatants].sort((a, b) => b.init - a.init);

    sortedCombatants.forEach((item, index) => {
        // Drop zone *before* each main item or group
        list.appendChild(createDropZone(item, null, index, 'before'));

        if (item.isGroup) {
            const groupHeader = createGroupRow(item);
            list.appendChild(groupHeader);

            // Drop zone *inside* the group, before the first member (to add to an empty group)
            list.appendChild(createDropZone(item, item, 0, 'group-internal'));

            item.members.forEach((member, memberIndex) => {
                const row = createCombatantRow(member, true, item);
                list.appendChild(row);

                // Drop zone *between* members within a group
                list.appendChild(createDropZone(member, item, memberIndex + 1, 'group-internal'));
            });

        } else {
            const row = createCombatantRow(item, false, null);
            list.appendChild(row);
        }
    });

    // Final drop zone *after* the last item/group
    if (sortedCombatants.length > 0) {
        list.appendChild(createDropZone(null, null, sortedCombatants.length, 'after'));
    } else {
        // If no combatants, add a general drop zone to add the first one
        list.appendChild(createDropZone(null, null, 0, 'empty-list'));
    }

    updateTurnDisplay();
    saveCombatants(); // Ensure state is saved after rendering
}



// ========== PASTE THE FULL REPLACEMENT FUNCTION HERE ==========

function createGroupRow(group) {
  const row = document.createElement('div');
  row.className = 'group-header creature-row';
  row.setAttribute("draggable", "true");
  row.dataset.combatantId = group.id;

  row.ondragstart = (e) => {
    draggedCombatantId = group.id;
    e.dataTransfer.setData("text/plain", group.id);
    e.dataTransfer.effectAllowed = "move";
    document.body.classList.add('dragging');
  };

  row.ondragend = () => {
    document.body.classList.remove('dragging');
  };

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

  // --- CORRECTED EDITABLE LOGIC ---
  row.querySelectorAll('[contenteditable="true"]').forEach(cell => {
    cell.addEventListener('blur', (e) => {
        const field = cell.dataset.field;
        const oldValue = group[field]; // FIXED: Use 'group' instead of 'c'
        const newValueRaw = cell.textContent.trim();
        let newValue;

        if (field === 'init') {
            newValue = parseInt(newValueRaw, 10);
            if (isNaN(newValue)) {
                alert('Invalid input for initiative. Please enter a number.');
                cell.textContent = oldValue; // Revert display
                return;
            }
        } else { // For 'name' field
            newValue = newValueRaw;
        }

        // Only update if the value actually changed
        if (newValue !== oldValue) {
            logChange(`Group ${group.name}'s ${field} changed from ${oldValue} to ${newValue}`);
            group[field] = newValue;

            // If the name was changed, we don't need to re-log. The value is just updated.
            if (field === 'name') {
              group.name = newValue;
            }

            saveCombatants();
            renderCombatants(); // Re-render to reflect the change (especially sorting for init)
        }
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
      }
    });
  });
  // --- END OF CORRECTION ---

  return row;
}

// ========== END OF REPLACEMENT FUNCTION ==========


function createDropZone(targetItem, targetGroup, targetIndex, type) {
    const drop = document.createElement('div');
    drop.className = 'drop-zone';
    drop.dataset.targetId = targetItem?.id || ''; // The item being dropped *next to*
    drop.dataset.targetGroup = targetGroup?.id || ''; // The group we are dropping into (if any)
    drop.dataset.targetIndex = targetIndex; // Index within the group or main list
    drop.dataset.dropType = type; // 'before', 'after', 'group-internal', 'empty-list'

    drop.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move"; // Indicate a move operation
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
        if (!draggedId || draggedId === drop.dataset.targetId) {
            // Prevent dropping on self
            return;
        }

        const dragged = removeCombatantById(draggedId);
        if (!dragged) {
            console.warn("Dragged combatant not found or already removed.");
            return;
        }

        // Restore previousInit for individual combatants leaving a group
        if (!dragged.isGroup && dragged.previousInit !== undefined) {
             dragged.init = dragged.previousInit;
        }


        const targetGroupId = drop.dataset.targetGroup;
        const targetIdx = parseInt(drop.dataset.targetIndex, 10);
        const dropType = drop.dataset.dropType;

        if (targetGroupId) { // Dropping into a group
            const targetGroup = combatants.find(c => c.id === targetGroupId && c.isGroup);
            if (targetGroup) {
                // Ensure combatant is not already a member of this group
                if (!targetGroup.members.some(m => m.id === dragged.id)) {
                    targetGroup.members.splice(targetIdx, 0, dragged);
                    logChange(`${dragged.name} added to group ${targetGroup.name}`);
                } else {
                    logChange(`${dragged.name} is already in group ${targetGroup.name}`);
                }
            }
        } else { // Dropping into the main combatants array
            combatants.splice(targetIdx, 0, dragged);
            logChange(`${dragged.name} moved to main list`);
        }

        renderCombatants();
    });

    return drop;
}

function removeCombatantById(id) {
    let found = null;
    let originalParentGroup = null;

    // First, try to find and remove from top-level combatants array
    const initialLength = combatants.length;
    combatants = combatants.filter(c => {
        if (c.id === id) {
            found = c;
            return false; // Remove this combatant
        }
        return true;
    });

    if (found) {
        return found; // Found at top level, no need to check groups
    }

    // If not found at top level, iterate through groups to find and remove
    for (const group of combatants) {
        if (group.isGroup && group.members) {
            const memberInitialLength = group.members.length;
            group.members = group.members.filter(m => {
                if (m.id === id) {
                    found = m;
                    originalParentGroup = group; // Store the group it was removed from
                    return false; // Remove this member from the group
                }
                return true;
            });
            if (found) {
                // If the group is now empty, consider removing it (optional, but good for cleanup)
                if (group.members.length === 0 && confirm(`Group "${group.name}" is now empty. Do you want to remove it?`)) {
                    combatants = combatants.filter(c => c.id !== group.id);
                    logChange(`Group ${group.name} was removed because it became empty.`);
                }
                break; // Found it, stop searching
            }
        }
    }
    return found;
}

// ... (rest of your existing code) ...


// ========== PART 4: Combatant Row, Status Effects & Actions ==========

function createCombatantRow(c, isGrouped = false, groupRef = null) {
    const row = document.createElement('div');
    row.className = 'creature-row';
    if (isGrouped) row.classList.add('group-member');
    row.setAttribute("draggable", "true");
    row.dataset.combatantId = c.id;

    if (c.role === 'dm') {
        row.classList.add('dm-row');
    } else {
        row.classList.add('player-row');
    }

    row.ondragstart = (e) => {
        draggedCombatantId = c.id;
        e.dataTransfer.setData("text/plain", c.id);
        e.dataTransfer.effectAllowed = "move";
        document.body.classList.add('dragging');
    };

    row.ondragend = () => {
        document.body.classList.remove('dragging');
    };

    const statusTags = (c.statusEffects || []).map(se => {
        return `<span class="status-tag">${se.name} (${se.rounds})</span>`;
    }).join(' ');

    const statusDropdown = `
        <select onchange="applyStatusEffect('${c.id}', this)">
            <option value="">＋ Add</option>
            ${statusOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
        </select>
    `;

    const imageContent = c.imageUrl ? `<img src="${c.imageUrl}" alt="${c.name}" class="combatant-image">` : '🧍';
    const imageCell = `<div class="cell image-cell" data-field="imageUrl">${imageContent}</div>`;

    // In script.js (inside createCombatantRow function)
    row.innerHTML = `
        ${imageCell}
        <div class="cell init-cell" ${isGrouped ? '' : 'contenteditable="true"'} data-field="init">
            ${isGrouped ? '' : c.init}
        </div>
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
            <button onclick="deleteCombatant('${c.id}')" title="Delete Combatant">🗑</button>
        </div>
    `;

    attachEditableEvents(row, c);
    attachImageEditEvent(row, c);


    // Context menu for HP and Temp HP cells
    const hpCell = row.querySelector('[data-field="hp"]');  // FIXED
    if (hpCell) {
        hpCell.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showHpPopup(c.id, e, 'hp');
        });
    }

    const tempHpCell = row.querySelector('[data-field="tempHp"]');
    if (tempHpCell) {
        tempHpCell.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showHpPopup(c.id, e, 'tempHp');
        });
    }


    return row;
}



function attachEditableEvents(row, c) {
    row.querySelectorAll('[contenteditable="true"]').forEach(cell => {
        cell.addEventListener('blur', (e) => {
            const field = cell.dataset.field;
            const oldValue = c[field];
            let newValueRaw = cell.textContent.trim();
            let newValue; // Declare newValue here, will be assigned correctly below

            // Determine if the field should be a number
            const isNumericField = ['init', 'ac', 'hp', 'tempHp', 'maxHp'].includes(field);

            if (isNumericField) {
                newValue = parseInt(newValueRaw, 10);
                if (isNaN(newValue)) {
                    alert(`Invalid input for ${field}. Please enter a number.`);
                    cell.textContent = oldValue; // Revert to old value
                    return; // Stop execution
                }
            } else {
                newValue = newValueRaw; // For 'name' or 'role', use the raw string
            }

            // Perform the update only if the new value is different from the old value
            // and apply specific logic for each field type
            // ========== PASTE THE REPLACEMENT CODE HERE ==========

            if (newValue !== oldValue) { // This comparison now correctly handles number vs number or string vs string
                if (field === 'hp') {
                    // NEW: Check if the entered value is higher than the maximum HP
                    if (newValue > c.maxHp) {
                        const confirmSetToMax = confirm(
                            `Invalid Input: The entered HP (${newValue}) is higher than the maximum (${c.maxHp}).\n\n` +
                            `Would you like to set the HP to the maximum value (${c.maxHp}) instead?`
                        );

                        if (confirmSetToMax) {
                            // User agreed, so we'll use maxHp as the new value.
                            newValue = c.maxHp;
                        } else {
                            // User cancelled, so revert the change and stop processing.
                            cell.textContent = oldValue; // Revert the cell display
                            return; // Exit the event listener
                        }
                    } else {
                        // If the value is not over max, ensure it's not negative.
                        newValue = Math.max(0, newValue);
                    }

                    // Proceed with the update using the (potentially corrected) newValue
                    logChange(`${c.name} HP changed: ${oldValue}/${c.maxHp} → ${newValue}/${c.maxHp}`);
                    c.hp = newValue;

                } else if (field === 'tempHp') {
                    // Temp HP cannot go below zero
                    newValue = Math.max(0, newValue);
                    logChange(`${c.name} Temp HP changed: ${oldValue} → ${newValue}`);
                    c.tempHp = newValue;
                } else if (field === 'maxHp') {
                    // Max HP cannot go below zero
                    newValue = Math.max(0, newValue);
                    logChange(`${c.name} Max HP changed: ${oldValue} → ${newValue}`);
                    c.maxHp = newValue;
                    // If current HP is greater than new max HP, clamp it
                    if (c.hp > c.maxHp) {
                        c.hp = c.maxHp;
                        logChange(`${c.name} current HP clamped to new Max HP: ${c.hp}`);
                    }
                } else if (field === 'init' || field === 'ac') {
                    logChange(`${c.name}'s ${field} changed to ${newValue}`);
                    c[field] = newValue;
                } else if (field === 'name' || field === 'role') {
                    // Special handling for 'name' due to getUniqueName
                    if (field === 'name') {
                        // If the name is changed, generate a unique one
                        const newUniqueName = getUniqueName(newValue);
                        logChange(`${oldValue}'s name changed to ${newUniqueName}`);
                        newValue = newUniqueName; // Update newValue to the unique one
                    } else {
                        logChange(`${c.name}'s ${field} changed to ${newValue}`);
                    }
                    c[field] = newValue;
                }
                // Update the cell's content to reflect the potentially adjusted newValue
                // This is now handled by renderCombatants(), but we leave it for the name change case
                cell.textContent = newValue;
            }
            // ========== END OF REPLACEMENT CODE ==========

            saveCombatants();
            // Re-render only if there was a meaningful change, or if a number was clamped.
            // This is often good practice to ensure UI consistency.
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
    if (imageCell) {
        imageCell.addEventListener('dblclick', () => {
            const newImageUrl = prompt(`Enter new image URL for ${c.name} (leave blank to remove image):`, c.imageUrl || '');
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
}




// ... (rest of your existing code, no changes needed below this) ...


function showHpPopup(combatantId, event, fieldType) {
    currentCombatantIdForHp = combatantId;
    currentHpFieldToEdit = fieldType; // Keep this to know what was clicked
    const combatant = findCombatantById(combatantId);

    if (!combatant) return;

    const cellRect = event.target.getBoundingClientRect();
    hpPopup.style.left = `${cellRect.left + window.scrollX}px`;
    hpPopup.style.top = `${cellRect.bottom + window.scrollY + 8}px`;
    hpPopup.classList.remove('hidden');

    // Clear all inputs
    healingInput.value = '';
    damageInput.value = '';
    addTempHpInput.value = '';

    // Focus on the most relevant input based on the click context
    if (fieldType === 'hp') {
        healingInput.focus(); // Default to healing when clicking main HP
    } else if (fieldType === 'tempHp') {
        addTempHpInput.focus(); // Default to adding Temp HP when clicking Temp HP
    }
}


// ========== PASTE THE FULL REPLACEMENT FUNCTION HERE ==========

function applyHpChange() {
    if (!currentCombatantIdForHp) return;

    const combatant = findCombatantById(currentCombatantIdForHp);
    if (!combatant) return;

    // Get values from all three input fields, defaulting to 0 if empty
    const healingAmount = parseInt(healingInput.value, 10) || 0;
    const damageAmount = parseInt(damageInput.value, 10) || 0;
    const tempHpGain = parseInt(addTempHpInput.value, 10) || 0;

    // Store old values for accurate logging
    const oldHp = combatant.hp;
    const oldTempHp = combatant.tempHp || 0;

    // --- Process changes in a logical, unified order ---

    // 1. Add new temporary HP first.
    if (tempHpGain > 0) {
        combatant.tempHp = oldTempHp + tempHpGain;
        logChange(`${combatant.name} gains ${tempHpGain} temporary HP. Total: ${combatant.tempHp}`);
    }

    // 2. Apply healing to the main HP pool (cannot exceed max HP).
    if (healingAmount > 0) {
        const newHp = Math.min(combatant.maxHp, combatant.hp + healingAmount);
        if (newHp > oldHp) {
            const healedFor = newHp - oldHp;
            combatant.hp = newHp;
            logChange(`${combatant.name} is healed for ${healedFor}. HP: ${combatant.hp}/${combatant.maxHp}`);
        }
    }

    // 3. Apply damage last. This logic is now ALWAYS used for damage.
    if (damageAmount > 0) {
        let remainingDamage = damageAmount;
        let currentTempHp = combatant.tempHp || 0;
        
        logChange(`${combatant.name} takes ${damageAmount} damage.`);

        // Damage hits temporary HP first.
        if (currentTempHp > 0) {
            const damageToTemp = Math.min(currentTempHp, remainingDamage);
            combatant.tempHp -= damageToTemp;
            remainingDamage -= damageToTemp;
            if (damageToTemp > 0) {
                 logChange(`  -${damageToTemp} absorbed by Temp HP (New Temp HP: ${combatant.tempHp})`);
            }
        }

        // Any remaining damage hits the main HP pool.
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
    
    // Hide and reset the popup
    hpPopup.classList.add('hidden');
    currentCombatantIdForHp = null;
    currentHpFieldToEdit = null;
}

// ========== END OF REPLACEMENT FUNCTION ==========



// Close HP popup if clicking outside
window.addEventListener('click', (e) => {
    // Check if the clicked element is NOT the popup itself AND NOT one of its children
    // AND if a combatant ID is currently associated with the popup (meaning it's open)
    if (e.target !== hpPopup && !hpPopup.contains(e.target) && currentCombatantIdForHp) {
        // Also ensure the click wasn't on the cell that opened the popup
        const clickedCell = e.target.closest('.cell-hp, [data-field="tempHp"]');
        if (!clickedCell || clickedCell.parentNode.dataset.combatantId !== currentCombatantIdForHp || (clickedCell.dataset.field !== currentHpFieldToEdit && clickedCell.dataset.field !== 'hp' && clickedCell.dataset.field !== 'tempHp')) {
            hpPopup.classList.add('hidden');
            currentCombatantIdForHp = null;
            currentHpFieldToEdit = null;
        }
    }
}, true); // Use capture phase to ensure this runs before other click handlers


// ========== PART 5: Turn Logic & Status Effects ==========

function applyStatusEffect(id, select) {
    const effect = select.value;
    select.value = ""; // Reset dropdown
    if (!effect) return;

    const roundsStr = prompt(`How many rounds for ${effect}?`);
    if (roundsStr === null) return; // User cancelled prompt
    const rounds = parseInt(roundsStr, 10);

    if (isNaN(rounds) || rounds <= 0) {
        alert('Please enter a valid number of rounds greater than 0.');
        return;
    }

    const target = findCombatantById(id);
    if (!target) {
        console.error("Combatant not found for status effect:", id);
        return;
    }
    if (!target.statusEffects) target.statusEffects = [];

    // Check if effect already exists and update rounds if so
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
        // Iterate over members if it's a group, otherwise just the combatant itself
        const membersToTick = c.isGroup ? c.members : [c];
        membersToTick.forEach(m => {
            if (!m.statusEffects || m.statusEffects.length === 0) return;

            const oldLength = m.statusEffects.length;
            m.statusEffects = m.statusEffects
                .map(se => ({ ...se, rounds: se.rounds - 1 }))
                .filter(se => se.rounds > 0);

            const removedCount = oldLength - m.statusEffects.length;
            if (removedCount > 0) {
                logChange(`${m.name} had ${removedCount} status effect(s) expire.`);
            }
        });
    });
}

function nextTurn() {
    const list = getFlatCombatantList();
    if (list.length === 0) {
        logChange('No combatants to advance turn.');
        return;
    }

    // If this is the start of a new round (after last combatant's turn), tick effects
    if (currentTurnIndex === list.length - 1) {
        round++;
        document.getElementById('roundCounter').textContent = `Round: ${round}`;
        logChange(`⏩ Round ${round} begins`);
        tickStatusEffects(); // Tick effects at the start of the new round
    }
    
    currentTurnIndex = (currentTurnIndex + 1) % list.length;
    
    updateTurnDisplay();
    renderCombatants(); // Re-render to highlight current turn and update status tags
}

function prevTurn() {
    const list = getFlatCombatantList();
    if (list.length === 0) {
        logChange('No combatants to revert turn.');
        return;
    }

    if (currentTurnIndex === 0 && round > 1) {
        // If reverting from the first combatant, go back a round
        round = Math.max(1, round - 1);
        document.getElementById('roundCounter').textContent = `Round: ${round}`;
        logChange(`⏪ Reverted to Round ${round}`);
        // Optional: logic to "un-tick" status effects if truly rewinding state
    }
    
    currentTurnIndex = (currentTurnIndex - 1 + list.length) % list.length;

    updateTurnDisplay();
    renderCombatants(); // Re-render to highlight current turn
}

function updateTurnDisplay() {
    const list = getFlatCombatantList();
    const current = list[currentTurnIndex];
    const display = document.getElementById('currentTurnDisplay');

    // Remove previous highlight
    document.querySelectorAll('.creature-row.current-turn').forEach(row => {
        row.classList.remove('current-turn');
    });

    if (current) {
        display.innerHTML = `🟢 Current Turn: <strong>${current.name}</strong>`;
        // Highlight the current combatant's row
        const currentRow = document.querySelector(`[data-combatant-id="${current.id}"]`);
        if (currentRow) {
            currentRow.classList.add('current-turn');
            currentRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    } else {
        display.innerHTML = `🟢 Current Turn: <strong>None</strong>`;
    }
}

// ========== PART 6: Duplication, Delete, Export/Import, Log Panel ==========

function duplicateCombatant(id) {
    const original = findCombatantById(id);
    if (!original) return;

    const clone = JSON.parse(JSON.stringify(original)); // Deep clone
    clone.id = generateUniqueId();
    clone.name = getUniqueName(original.name);
    clone.statusEffects = [...(original.statusEffects || [])]; // Ensure status effects are cloned correctly
    clone.previousInit = original.init; // Store original init for duplicated members
    clone.members = original.isGroup ? original.members.map(member => ({
        ...member,
        id: generateUniqueId(), // New IDs for duplicated group members
        name: getUniqueName(member.name),
        previousInit: member.init
    })) : [];


    // If the original was part of a group, add the clone to the same group's members
    let addedToGroup = false;
    for (const group of combatants) {
        if (group.isGroup && group.members.some(m => m.id === id)) {
            group.members.push(clone);
            addedToGroup = true;
            break;
        }
    }

    // If not added to a group (i.e., it was a top-level combatant or group itself)
    if (!addedToGroup) {
        combatants.push(clone);
    }

    logChange(`Duplicated ${original.name} → ${clone.name}`);
    saveCombatants();
    renderCombatants();
}

function deleteCombatant(id) {
    let name = '';
    let foundAndRemoved = false;

    // Helper to log and set found flag
    const logAndSetRemoved = (item) => {
        name = item.name;
        foundAndRemoved = true;
        logChange(`${name} was removed from the tracker`);
    };

    // Try deleting from top level
    const initialCombatantsLength = combatants.length;
    combatants = combatants.filter(c => {
        if (c.id === id) {
            logAndSetRemoved(c);
            return false;
        }
        return true;
    });

    if (foundAndRemoved) {
        saveCombatants();
        renderCombatants();
        return;
    }

    // Try deleting from inside a group
    for (const group of combatants) {
        if (group.isGroup) {
            const initialMembersLength = group.members.length;
            group.members = group.members.filter(m => {
                if (m.id === id) {
                    logAndSetRemoved(m);
                    return false;
                }
                return true;
            });

            if (foundAndRemoved) {
                // If group becomes empty, offer to delete it
                if (group.members.length === 0 && confirm(`Group "${group.name}" is now empty. Do you want to remove it?`)) {
                    combatants = combatants.filter(c => c.id !== group.id);
                    logChange(`Group ${group.name} was removed because it became empty.`);
                }
                saveCombatants();
                renderCombatants();
                return;
            }
        }
    }

    console.warn(`Attempted to delete combatant with ID ${id} but could not find it.`);
}

function removeFromGroup(id, groupId) {
    const group = combatants.find(c => c.id === groupId && c.isGroup);
    if (!group) {
        console.error("Group not found for removeFromGroup:", groupId);
        return;
    }

    let member = null;
    group.members = group.members.filter(m => {
        if (m.id === id) {
            member = m;
            return false; // Remove from group
        }
        return true;
    });

    if (member) {
        // Restore previousInit and add to top-level combatants
        member.init = member.previousInit !== undefined ? member.previousInit : member.init;
        combatants.push(member);
        logChange(`${member.name} was removed from ${group.name}`);

        // If the group is now empty, consider removing it
        if (group.members.length === 0 && confirm(`Group "${group.name}" is now empty. Do you want to remove it?`)) {
            combatants = combatants.filter(c => c.id !== group.id);
            logChange(`Group ${group.name} was removed because it became empty.`);
        }
    } else {
        console.warn(`Member with ID ${id} not found in group ${groupId}.`);
    }

    saveCombatants();
    renderCombatants();
}

function triggerImport() {
    document.getElementById('importInput').click();
}


document.getElementById('importInput').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            // FIX: Parse the JSON string from the file content
            const state = JSON.parse(event.target.result);

            combatants = state.combatants || [];
            round = state.round || 1;
            currentTurnIndex = state.currentTurnIndex || 0;
            historyLog = state.historyLog || [];

            // ✅ Ensure tempHp and maxHp exist on all combatants (this block is good for migration)
            function ensureHpFieldsExist(combatant) {
            if (combatant.isGroup && combatant.members) {
                combatant.members.forEach(member => {
                if (typeof member.tempHp !== 'number') member.tempHp = 0;
                if (typeof member.maxHp !== 'number') member.maxHp = member.hp || 1;
                });
            } else {
                if (typeof combatant.tempHp !== 'number') combatant.tempHp = 0;
                if (typeof combatant.maxHp !== 'number') combatant.maxHp = combatant.hp || 1;
            }
            }

            combatants.forEach(ensureHpFieldsExist);


            // Apply theme state from loaded data
            if (state.isDarkTheme) {
                document.body.classList.add('dark');
                document.getElementById('themeToggle').checked = true;
            } else {
                document.body.classList.remove('dark');
                document.body.classList.add('light');
                document.getElementById('themeToggle').checked = false;
            }

            // Update UI based on loaded state
            document.getElementById('roundCounter').textContent = `Round: ${round}`; // Added this line
            renderCombatants();
            updateTurnDisplay();
            logChange("📂 Encounter loaded from file."); // This log will now correctly appear in the *newly loaded* historyLog

        } catch (err) {
            console.error('Error importing encounter:', err);
            alert('Failed to import encounter. The file might be corrupted or in an incorrect format.');
        } finally {
            e.target.value = ''; // Clear the file input
        }
    };
    reader.readAsText(file);
});



function exportToPDF() {
    alert('🖨 PDF export not implemented yet.\nUse browser Print (Ctrl+P) as a workaround.');
    // To implement real PDF export, you'd typically use a library like jsPDF or html2canvas
    // Example:
    // const element = document.getElementById('combatTable');
    // html2canvas(element).then(canvas => {
    //     const imgData = canvas.toDataURL('image/png');
    //     const pdf = new jspdf.jsPDF();
    //     pdf.addImage(imgData, 'PNG', 0, 0);
    //     pdf.save("combat-tracker.pdf");
    // });
}

function saveEncounter() {
    const data = {
        combatants,
        round,
        currentTurnIndex,
        historyLog,
        isDarkTheme: document.body.classList.contains('dark')
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "dnd-combat-tracker-encounter.json"; // More descriptive filename
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // Clean up the URL object
    logChange("💾 Encounter saved to file.");
}

document.getElementById('toggleLogBtn').addEventListener('click', () => {
    const container = document.getElementById('trackerContainer');
    container.classList.toggle('show-log');

    const logContent = document.getElementById('historyLogContent');
    logContent.innerHTML = historyLog.map(entry => `<div>${entry}</div>`).join('');
    logContent.scrollTop = logContent.scrollHeight;
});

// Initial load when script starts
document.addEventListener('DOMContentLoaded', loadCombatants);


