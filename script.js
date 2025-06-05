// ========== GLOBAL STATE ==========
let combatants = [];
let currentTurnIndex = 0;
let round = 1;
let historyLog = [];
let draggedCombatantId = null;

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

modalForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('modalName').value.trim();
    const init = parseInt(document.getElementById('modalInit').value, 10);
    const ac = parseInt(document.getElementById('modalAC').value || 0, 10);
    const hp = parseInt(document.getElementById('modalHP').value || 0, 10);
    const maxHp = parseInt(document.getElementById('modalMaxHP').value || hp, 10);
    const role = document.getElementById('modalRole').value || 'player';

    if (!name || isNaN(init)) {
        alert('Please enter a name and a valid initiative.');
        return;
    }

    const newCombatant = {
        id: generateUniqueId(),
        name: getUniqueName(name),
        init,
        ac,
        hp,
        maxHp,
        role,
        statusEffects: [],
        isGroup: false,
        previousInit: init // Store original initiative for potential group exit
    };

    combatants.push(newCombatant);
    logChange(`➕ Added ${newCombatant.name} (Init: ${newCombatant.init})`);
    saveCombatants();
    renderCombatants();

    creatureModal.classList.add('hidden');
    // Form is reset on open, no need here.
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

function createGroupRow(group) {
    const row = document.createElement('div');
    row.className = 'group-header tracker-table-header creature-row'; // Use creature-row for grid display
    row.setAttribute("draggable", "true"); // Groups are also draggable

    row.ondragstart = (e) => {
        draggedCombatantId = group.id;
        e.dataTransfer.setData("text/plain", group.id);
        e.dataTransfer.effectAllowed = "move";
    };

    row.innerHTML = `
        <div class="cell"></div>
        <div class="cell init-cell" contenteditable="true" data-field="init">${group.init}</div>
        <div class="cell cell-name" contenteditable="true">${group.name}</div>
        <div class="cell cell-ac" contenteditable="true">${group.ac || ''}</div>
        <div class="cell cell-hp">${group.hp || ''}${group.maxHp ? `/${group.maxHp}` : ''}</div>
        <div class="cell"></div>
        <div class="cell">${group.role || 'DM'}</div>
        <div class="cell">
            <button onclick="duplicateCombatant('${group.id}')">+</button>
            <button onclick="deleteCombatant('${group.id}')">🗑</button>
        </div>
    `;

    // Attach editable events for group name/init/ac/hp
    row.querySelectorAll('[contenteditable="true"]').forEach(cell => {
        attachEditableEvents(row, group);

        cell.addEventListener('blur', () => {
            const newName = row.querySelector('.cell-name').textContent.trim();
            const newInit = parseInt(row.querySelector('.cell:nth-child(2)').textContent.trim());
            const newAC = parseInt(row.querySelector('.cell-ac').textContent.trim());

            if (newName !== group.name) {
                logChange(`${group.name} (Group) renamed to ${newName}`);
                group.name = newName;
            }
            if (!isNaN(newInit) && newInit !== group.init) {
                logChange(`${group.name}'s Initiative changed to ${newInit}`);
                group.init = newInit;
            }
            if (!isNaN(newAC) && newAC !== group.ac) {
                logChange(`${group.name}'s AC changed to ${newAC}`);
                group.ac = newAC;
            }
            saveCombatants();
            renderCombatants(); // Re-render to re-sort if initiative changed
        });
    });

    return row;
}

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
    row.dataset.combatantId = c.id; // Store ID on the row for easier lookup

    // Add role-based styling
    if (c.role === 'dm') {
        row.classList.add('dm-row');
    } else {
        row.classList.add('player-row');
    }

    row.ondragstart = (e) => {
        draggedCombatantId = c.id;
        e.dataTransfer.setData("text/plain", c.id);
        e.dataTransfer.effectAllowed = "move";
        document.body.classList.add('dragging'); // Add dragging class to body
    };

    row.ondragend = () => {
        document.body.classList.remove('dragging'); // Remove dragging class from body
    };

    // Status tags with duration
    const statusTags = (c.statusEffects || []).map(se => {
        return `<span class="status-tag">${se.name} (${se.rounds})</span>`;
    }).join(' ');

    // Status dropdown
    const statusDropdown = `
        <select onchange="applyStatusEffect('${c.id}', this)">
            <option value="">＋ Add</option>
            ${statusOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
        </select>
    `;

    // Image cell placeholder (replace with actual image if c.imageUrl exists)
    // Make image cell editable
    const imageContent = c.imageUrl ? `<img src="${c.imageUrl}" alt="${c.name}" class="combatant-image">` : '🧍';
    const imageCell = `<div class="cell image-cell" data-field="imageUrl">${imageContent}</div>`;

    row.innerHTML = `
        ${imageCell}
        <div class="cell init-cell" ${isGrouped ? '' : 'contenteditable="true"'} data-field="init">
        ${isGrouped ? '' : c.init}
        </div>
        <div class="cell cell-name" contenteditable="true" data-field="name">${c.name}</div>
        <div class="cell cell-ac" contenteditable="true" data-field="ac">${c.ac}</div>
        <div class="cell cell-hp" contenteditable="true" data-field="hp">${c.hp}/${c.maxHp}</div>
        <div class="cell status-cell">${statusTags} ${statusDropdown}</div>
        <div class="cell role-cell" contenteditable="true" data-field="role">${c.role || 'player'}</div>
        <div class="cell action-cell">
            <button onclick="duplicateCombatant('${c.id}')" title="Duplicate Combatant">+</button>
            ${groupRef ? `<button onclick="removeFromGroup('${c.id}', '${groupRef.id}')" title="Remove from Group">⬅</button>` : ''}
            <button onclick="deleteCombatant('${c.id}')" title="Delete Combatant">🗑</button>
        </div>
    `;

    attachEditableEvents(row, c); // This will handle blur and keydown for contenteditable fields
    attachImageEditEvent(row, c); // New function for image editing
    return row;
}

function attachEditableEvents(row, c) {
    row.querySelectorAll('[contenteditable="true"]').forEach(cell => {
        cell.addEventListener('blur', (e) => {
            const field = cell.dataset.field;
            const oldValue = c[field];
            let newValue;

            if (field === 'hp') {
                const hpText = cell.textContent.trim();
                const [currentHP, maxHP] = parseHP(hpText, c.hp, c.maxHp);
                if (currentHP !== c.hp || maxHP !== c.maxHp) {
                    logChange(`${c.name} HP changed: ${c.hp}/${c.maxHp} → ${currentHP}/${maxHP}`);
                    c.hp = Math.max(0, Math.min(currentHP, maxHP)); // Clamp HP between 0 and maxHP
                    c.maxHp = maxHP; // Update max HP if changed
                }
            } else if (field === 'init' || field === 'ac') {
                newValue = parseInt(cell.textContent.trim());
                if (isNaN(newValue)) {
                    alert(`Invalid input for ${field}. Please enter a number.`);
                    cell.textContent = oldValue; // Revert to old value
                    return;
                }
                if (newValue !== oldValue) {
                    logChange(`${c.name}'s ${field} changed to ${newValue}`);
                    c[field] = newValue;
                }
            } else if (field === 'name' || field === 'role') {
                newValue = cell.textContent.trim();
                if (newValue !== oldValue) {
                    logChange(`${c.name}'s ${field} changed to ${newValue}`);
                    c[field] = newValue;
                }
            }
            saveCombatants();
            renderCombatants(); // Re-render to reflect changes, especially if initiative affects order or sorting
        });

        // Add keydown event for 'Enter' to blur and save
        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent new line
                e.target.blur();    // Trigger blur event
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


function parseHP(hpText, currentHP, maxHP) {
    // Handle math operations (e.g., +5, -10)
    const mathMatch = hpText.match(/^([+-]?\d+)$/);
    if (mathMatch) {
        const delta = parseInt(mathMatch[1]);
        return [currentHP + delta, maxHP];
    }

    // Handle "current/max" format (e.g., 20/30)
    const fullMatch = hpText.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (fullMatch) {
        return [parseInt(fullMatch[1]), parseInt(fullMatch[2])];
    }

    // Handle single number (overwrite current HP)
    const single = parseInt(hpText);
    if (!isNaN(single)) {
        return [single, maxHP]; // Keep original max HP if not provided
    }

    // If no valid format, return original values
    return [currentHP, maxHP];
}


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
            const state = JSON.parse(event.target.result);
            combatants = state.combatants || [];
            round = state.round || 1;
            currentTurnIndex = state.currentTurnIndex || 0;
            historyLog = state.historyLog || [];

            // Apply theme state from loaded data
            if (state.isDarkTheme) {
                document.body.classList.add('dark');
                document.getElementById('themeToggle').checked = true;
            } else {
                document.body.classList.remove('dark');
                document.getElementById('themeToggle').checked = false;
            }

            logChange("📂 Encounter loaded from file.");
            renderCombatants();
            updateTurnDisplay();
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
