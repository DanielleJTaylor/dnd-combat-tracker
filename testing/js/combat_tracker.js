// ============================================
// ========== CONSTANTS & SETUP ==========
// ============================================
const statusOptions = ['Charmed', 'Frightened', 'Prone', 'Poisoned', 'Stunned', 'Blinded', 'Invisible', 'Paralyzed', 'Restrained'];

let combatantIdForImageUpload = null;

// ============================================
// ========== COMBATANT MANAGEMENT ==========
// ============================================

function handleAddCombatant(e) {
    e.preventDefault();
    const name = document.getElementById('modalName').value.trim();
    const init = parseInt(document.getElementById('modalInit').value, 10);
    if (!name || isNaN(init)) {
        alert('Please enter a name and a valid initiative.');
        return;
    }
    const hp = parseInt(document.getElementById('modalHP').value, 10);
    const maxHp = parseInt(document.getElementById('modalMaxHP').value, 10);
    const newCombatant = {
        id: generateUniqueId(), name: getUniqueName(name), init,
        ac: parseInt(document.getElementById('modalAC').value || 0, 10),
        hp: isNaN(hp) ? 10 : hp,
        tempHp: 0,
        maxHp: isNaN(maxHp) ? (isNaN(hp) ? 10 : hp) : maxHp,
        role: document.getElementById('modalRole').value || 'player',
        imageUrl: document.getElementById('modalImage').value.trim() || '',
        statusEffects: [], isGroup: false, previousInit: init, spellSlotsVisible: false
    };
    if (document.getElementById('modalIsSpellcaster').checked) {
        newCombatant.spellSlots = {
            1: { c: 2, m: 2 }, 2: { c: 1, m: 3 }, 3: { c: 0, m: 0 },
            4: { c: 0, m: 0 }, 5: { c: 0, m: 0 }, 6: { c: 0, m: 0 },
            7: { c: 0, m: 0 }, 8: { c: 0, m: 0 }, 9: { c: 0, m: 0 }
        };
    }
    combatants.push(newCombatant);
    logChange(`➕ Added ${newCombatant.name} (Init: ${newCombatant.init})`);
    renderCombatants();
    creatureModal.classList.add('hidden');
    modalForm.reset();
}

function addGroup() {
    const groupName = prompt("Enter group name:");
    if (!groupName) return;
    const groupInit = parseInt(prompt(`Enter initiative for "${groupName}":`), 10);
    if (isNaN(groupInit)) { alert("Invalid initiative."); return; }
    const newGroup = {
        id: generateUniqueId(), name: getUniqueName(groupName), init: groupInit,
        isGroup: true, members: [], previousInit: groupInit
    };
    combatants.push(newGroup);
    logChange(`➕ Group created: ${newGroup.name} (Init: ${newGroup.init})`);
    renderCombatants();
}

function startEncounter() {
    round = 1; currentTurnIndex = 0;
    document.getElementById('roundCounter').textContent = `Round: 1`;
    logChange('🎲 Encounter started');
    renderCombatants(); // This will sort and render the initial state
}

// ============================================
// ========== RENDERING & DISPLAY LOGIC ==========
// ============================================

function renderCombatants() {
    const list = document.getElementById('combatantList');
    list.innerHTML = '';
    
    // Use the *flat* sorted list to determine rendering order, but render from the original 'combatants' array
    const sortedIds = getFlatCombatantList().map(c => c.id);
    const sortedTopLevel = [...combatants].sort((a, b) => {
        const a_id = a.isGroup ? a.members[0]?.id || a.id : a.id;
        const b_id = b.isGroup ? b.members[0]?.id || b.id : b.id;
        return sortedIds.indexOf(a_id) - sortedIds.indexOf(b_id);
    });

    sortedTopLevel.forEach((item, index) => {
        list.appendChild(createDropZone(item, null, index, 'before'));
        if (item.isGroup) {
            list.appendChild(createGroupHeaderWrapper(item));
            list.appendChild(createDropZone(item, item, 0, 'group-internal'));
            
            // Sort group members according to the global sort logic
            const sortedMembers = item.members.sort((a, b) => {
                 return sortedIds.indexOf(a.id) - sortedIds.indexOf(b.id);
            });
            
            sortedMembers.forEach((m, i) => {
                list.appendChild(createCombatantWrapper(m, true, item));
                list.appendChild(createDropZone(m, item, i + 1, 'group-internal'));
            });
        } else {
            list.appendChild(createCombatantWrapper(item, false, null));
        }
    });

    if (sortedTopLevel.length > 0) list.appendChild(createDropZone(null, null, sortedTopLevel.length, 'after'));
    else list.appendChild(createDropZone(null, null, 0, 'empty-list'));

    updateTurnDisplay();
    saveAppState();
}


function createCombatantWrapper(c, isGrouped = false, groupRef = null) {
    const wrapper = document.createElement('div');
    // Add dead-combatant class here for the wrapper
    wrapper.className = `combatant-wrapper ${isGrouped ? 'group-member-wrapper' : ''} ${c.hp <= 0 ? 'dead-combatant' : ''}`;
    wrapper.setAttribute("draggable", "true");
    wrapper.dataset.combatantId = c.id;

    wrapper.ondragstart = (e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; };
    wrapper.ondragend = () => document.body.classList.remove('dragging');
    wrapper.appendChild(createCombatantRow(c, isGrouped, groupRef));
    if (c.spellSlotsVisible && c.spellSlots) wrapper.appendChild(createSpellSlotPanel(c));
    return wrapper;
}

/**
 * REPLACED - Now checks if all group members are dead (or if the group is empty)
 * and applies the .dead-combatant class to the header accordingly.
 */
function createGroupHeaderWrapper(group) {
    const wrapper = document.createElement('div');
    
    // --- START OF THE NEW LOGIC ---
    // Check if the group should be visually "dead". This is true if:
    // 1. The group has no members.
    // 2. All members in the group have 0 or less HP.
    const isGroupDefeated = group.members.length === 0 || group.members.every(member => member.hp <= 0);
    
    // Apply the .dead-combatant class if the group is defeated.
    wrapper.className = `combatant-wrapper group-header-wrapper ${isGroupDefeated ? 'dead-combatant' : ''}`;
    // --- END OF THE NEW LOGIC ---

    wrapper.setAttribute("draggable", "true");
    wrapper.dataset.combatantId = group.id;
    wrapper.ondragstart = (e) => { e.dataTransfer.setData("text/plain", group.id); e.dataTransfer.effectAllowed = "move"; };
    wrapper.ondragend = () => document.body.classList.remove('dragging');
    
    const row = document.createElement('div');
    row.className = 'group-header creature-row';
    row.innerHTML = `
        <div class="cell image-cell">📁</div>
        <div class="cell init-cell" contenteditable="true" data-field="init">${group.init}</div>
        <div class="cell cell-name" contenteditable="true" data-field="name">${group.name}</div>
        <div class="cell"></div><!-- AC placeholder -->
        <div class="cell"></div><!-- HP/Max placeholder -->
        <div class="cell"></div><!-- Temp HP placeholder -->
        <div class="cell"></div><!-- Status placeholder -->
        <div class="cell role-cell">DM Group</div>
        <div class="cell action-cell">
            <button onclick="duplicateCombatant('${group.id}')" title="Duplicate Group">+</button>
            <button onclick="deleteCombatant('${group.id}')" title="Delete Group">🗑</button>
        </div>
    `;
    
    // Use the main editable event handler for groups too
    attachEditableEvents(row.querySelectorAll('[contenteditable="true"]'), group);
    wrapper.appendChild(row);
    return wrapper;
}



function createDropZone(targetItem, targetGroup, targetIndex, type) {
    const drop = document.createElement('div');
    drop.className = 'drop-zone';
    drop.dataset.targetId = targetItem?.id || ''; drop.dataset.targetGroup = targetGroup?.id || '';
    drop.dataset.targetIndex = targetIndex; drop.dataset.dropType = type;
    drop.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; drop.classList.add('highlight'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('highlight'));
    drop.addEventListener('drop', e => {
        e.preventDefault(); drop.classList.remove('highlight');
        const draggedId = e.dataTransfer.getData("text/plain");
        if (!draggedId || draggedId === drop.dataset.targetId) return;
        const dragged = removeCombatantById(draggedId);
        if (!dragged) return;
        dragged.init = dragged.isGroup ? dragged.init : (dragged.previousInit ?? dragged.init);
        const targetGroupId = drop.dataset.targetGroup; const targetIdx = parseInt(drop.dataset.targetIndex, 10);
        if (targetGroupId && targetGroupId !== "null") {
            const group = combatants.find(c => c.id === targetGroupId && c.isGroup);
            if (group && !group.members.some(m => m.id === dragged.id)) {
                group.members.splice(targetIdx, 0, dragged);
                logChange(`${dragged.name} added to group ${group.name}`);
            }
        } else {
            combatants.splice(targetIdx, 0, dragged);
            logChange(`${dragged.name} moved in initiative order`);
        }
        renderCombatants();
    });
    return drop;
}

function removeCombatantById(id) {
    let combatantIndex = combatants.findIndex(c => c.id === id);
    if (combatantIndex > -1) return combatants.splice(combatantIndex, 1)[0];
    for (const group of combatants) {
        if (group.isGroup && group.members) {
            const memberIndex = group.members.findIndex(m => m.id === id);
            if (memberIndex > -1) {
                const found = group.members.splice(memberIndex, 1)[0];
                if (group.members.length === 0 && confirm(`Group "${group.name}" is now empty. Do you want to remove it?`)) {
                    combatants = combatants.filter(c => c.id !== group.id);
                    logChange(`Group ${group.name} was removed.`);
                }
                return found;
            }
        }
    }
    return null;
}

function createCombatantRow(c, isGrouped = false, groupRef = null) {
    const row = document.createElement('div');
    row.className = `creature-row ${isGrouped ? 'group-member' : ''} ${c.role === 'dm' ? 'dm-row' : 'player-row'}`;
    
    const statusTags = (c.statusEffects || []).map(se => `<span class="status-tag">${se.name}${se.rounds !== Infinity ? ` (${se.rounds})` : ''}</span>`).join(' ');
    const statusDropdown = `<select onchange="applyStatusEffect('${c.id}', this)"><option value="">＋ Add</option>${statusOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
    
    const imageContent = c.imageUrl ? `<img src="${c.imageUrl}" alt="${c.name}" class="combatant-image">` : '🧍';
    const imageCell = `<div id="image-cell-${c.id}" class="cell image-cell" title="Click to upload, or drag & drop an image file">${imageContent}</div>`;
    
    const spellButton = c.spellSlots ? `<button onclick="toggleSpellSlots('${c.id}')" title="Toggle Spell Slots">🪄</button>` : `<button onclick="makeSpellcaster('${c.id}')" title="Make Spellcaster">✨</button>`;

    row.innerHTML = `
        ${imageCell}
        <div class="cell init-cell" ${isGrouped ? '' : 'contenteditable="true"'} data-field="init">${isGrouped ? '—' : c.init}</div>
        <div class="cell cell-name" contenteditable="true" data-field="name">${c.name}</div>
        <div class="cell cell-ac" contenteditable="true" data-field="ac">${c.ac}</div>
        <div class="cell hp-fraction-cell">
            <span class="hp-heart-icon">❤️</span> 
            <div contenteditable="true" data-field="hp" title="Current HP (Right-click for options)">${c.hp}</div>
            <span>/</span>
            <div contenteditable="true" data-field="maxHp" title="Max HP">${c.maxHp}</div>
        </div>
        <div class="cell" contenteditable="true" data-field="tempHp" title="Temp HP (Right-click for options)">${c.tempHp || 0}</div>
        <div class="cell status-cell">${statusTags} ${statusDropdown}</div>
        <div class="cell role-cell" contenteditable="true" data-field="role">${c.role || 'player'}</div>
        <div class="cell action-cell">
            <button onclick="duplicateCombatant('${c.id}')" title="Duplicate Combatant">+</button>
            ${groupRef ? `<button onclick="removeFromGroup('${c.id}', '${groupRef.id}')" title="Remove from Group">⬅</button>` : ''}
            ${spellButton}
            <button onclick="deleteCombatant('${c.id}')" title="Delete Combatant">🗑</button>
        </div>
    `;

    attachEditableEvents(row.querySelectorAll('[contenteditable="true"]'), c);
    
    const imageCellElement = row.querySelector(`#image-cell-${c.id}`);
    attachImageEventListeners(imageCellElement, c.id);

    row.querySelector('[data-field="hp"]').addEventListener('contextmenu', (e) => { e.preventDefault(); showHpPopup(c.id, e); });
    row.querySelector('[data-field="tempHp"]').addEventListener('contextmenu', (e) => { e.preventDefault(); showHpPopup(c.id, e); });

    return row;
}

/**
 * REPLACED - Now validates name uniqueness on edit.
 * Attaches blur and keydown event listeners to content-editable cells.
 * @param {NodeListOf<HTMLElement>} cells The cells to attach events to.
 * @param {object} c The combatant or group object to update.
 */
function attachEditableEvents(cells, c) {
    cells.forEach(cell => {
        cell.addEventListener('blur', () => {
            const field = cell.dataset.field;
            const oldValue = c[field];
            let newValueRaw = cell.textContent.trim();
            let newValue;

            if (['init', 'ac', 'hp', 'tempHp', 'maxHp'].includes(field)) {
                newValue = parseInt(newValueRaw, 10);
                if (isNaN(newValue)) { 
                    cell.textContent = oldValue; // Revert if not a number
                    return; 
                }
            } else { // Handle string fields like name and role
                newValue = newValueRaw;
                if (field === 'name') {
                    if (newValue === "") {
                        alert("Combatant name cannot be empty.");
                        cell.textContent = oldValue;
                        return;
                    }
                    // If the name was actually changed, check for duplicates.
                    if (newValue !== oldValue) {
                        const allCombatants = combatants.flatMap(comb => comb.isGroup ? [comb, ...comb.members] : comb);
                        // Check if any *other* combatant (one with a different ID) already has the new name.
                        const isDuplicate = allCombatants.some(other => other.id !== c.id && other.name === newValue);
                        if (isDuplicate) {
                            alert(`The name "${newValue}" is already in use. Please choose a unique name.`);
                            cell.textContent = oldValue; // Revert the change in the DOM
                            return; // Stop the update process
                        }
                    }
                }
            }

            // Clamping logic for HP and other numeric values
            if (field === 'hp') newValue = Math.max(0, Math.min(newValue, c.maxHp));
            else if (field === 'tempHp') newValue = Math.max(0, newValue);

            if (newValue !== oldValue) {
                const logName = field === 'name' ? oldValue : c.name; // Log with old name for clarity on name changes
                logChange(`${logName}'s ${field} changed from '${oldValue}' to '${newValue}'`);
                c[field] = newValue;
                renderCombatants(); // Re-render to reflect changes and re-sort if needed
            } else {
                cell.textContent = oldValue; // Revert if value is invalid or unchanged
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

// ============================================
// ========== IMAGE UPLOAD FUNCTIONS ==========
// ============================================

function attachImageEventListeners(cellElement, combatantId) {
    cellElement.addEventListener('click', () => {
        combatantIdForImageUpload = combatantId;
        document.getElementById('imageUploadInput').click();
    });
    cellElement.addEventListener('dragover', (e) => { e.preventDefault(); cellElement.classList.add('image-drop-hover'); });
    cellElement.addEventListener('dragleave', (e) => { e.preventDefault(); cellElement.classList.remove('image-drop-hover'); });
    cellElement.addEventListener('drop', (e) => {
        e.preventDefault(); cellElement.classList.remove('image-drop-hover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            processImageFile(file, combatantId);
        } else {
            alert('Please drop an image file (e.g., PNG, JPG, GIF).');
        }
    });
}

function handleImageSelection(event) {
    const file = event.target.files[0];
    if (file && combatantIdForImageUpload) {
        processImageFile(file, combatantIdForImageUpload);
    }
    combatantIdForImageUpload = null;
    event.target.value = '';
}

function processImageFile(file, combatantId) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const combatant = findCombatantById(combatantId);
        if (combatant) {
            combatant.imageUrl = e.target.result;
            logChange(`🖼️ Updated image for ${combatant.name}.`);
            renderCombatants();
        }
    };
    reader.readAsDataURL(file);
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

/**
 * REPLACED - This is the core fix for turn skipping.
 * This function is now the single source of truth for the turn order.
 * It flattens the combatant list and applies a stable, multi-level sort.
 * 1. Initiative (descending)
 * 2. Base Name (alphabetical, ascending)
 * 3. Suffix number in name (ascending)
 */
function getFlatCombatantList() {
    // Flatten the list, ensuring members inherit the group's initiative for sorting purposes.
    const flatList = combatants.flatMap(c =>
        c.isGroup ? c.members.map(m => ({ ...m, init: c.init })) : c
    );

    // Helper to parse a name like "Goblin (12)" into { name: "Goblin", num: 12 }
    const parseName = (nameStr) => {
        const match = nameStr.match(/^(.*?)(?:\s\((\d+)\))?$/);
        return {
            name: match[1].trim(), // The base name, e.g., "Goblin"
            num: match[2] ? parseInt(match[2], 10) : 0 // The number, or 0 if none.
        };
    };

    // Apply a stable, multi-level sort to prevent reordering on ties.
    flatList.sort((a, b) => {
        // 1. Primary Sort: Initiative (descending)
        const initDiff = b.init - a.init;
        if (initDiff !== 0) return initDiff;

        // 2. Secondary Sort (Tie-breaker): Base Name
        const aParsed = parseName(a.name);
        const bParsed = parseName(b.name);

        // Sort by the base name alphabetically (A-Z)
        const nameDiff = aParsed.name.localeCompare(bParsed.name);
        if (nameDiff !== 0) return nameDiff;

        // 3. Tertiary Sort (Tie-breaker): Suffix number (ascending)
        // If base names are the same (e.g., "Goblin"), sort by the number.
        return aParsed.num - bParsed.num;
    });

    return flatList;
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

/**
 * MODIFIED - Now more robust and guarantees a unique name.
 * Takes a base name and returns a unique version by adding a suffix if needed.
 * e.g., "Goblin" becomes "Goblin (2)" if "Goblin" already exists.
 */
function getUniqueName(baseName) {
    // Get a flat list of all existing names (for combatants, groups, and group members)
    const allNames = combatants.flatMap(c => c.isGroup ? [c.name, ...c.members.map(m => m.name)] : c.name);

    if (!allNames.includes(baseName)) {
        return baseName; // The name is already unique
    }
    
    // If the name exists, find a new numbered suffix.
    // Strip any existing number to get a clean root name, e.g., "Goblin (2)" -> "Goblin"
    const rootName = baseName.replace(/\s\(\d+\)$/, '').trim();
    let suffix = 2;
    let newName;
    
    // Keep trying suffixes until a unique name is found
    do {
        newName = `${rootName} (${suffix})`;
        suffix++;
    } while (allNames.includes(newName));
    
    return newName;
}


// (The rest of your functions: nextTurn, prevTurn, updateTurnDisplay, etc., remain the same as they correctly use getFlatCombatantList)
// ... all your other functions from the original file should follow here ...
// ============================================
// ========== TURN & STATUS MANAGEMENT ==========
// ============================================

function nextTurn() {
    const list = getFlatCombatantList(); if (list.length === 0) return; let rolledOver = false; let nextIndex = currentTurnIndex;
    do {
        nextIndex = (nextIndex + 1) % list.length;
        if (nextIndex === 0 && !rolledOver) {
            rolledOver = true; round++; document.getElementById('roundCounter').textContent = `Round: ${round}`;
            logChange(`⏩ Round ${round} begins`); tickStatusEffects();
        }
    } while (list[nextIndex].hp <= 0 && nextIndex !== currentTurnIndex);
    if (list[nextIndex].hp <= 0 && list.every(i => i.hp <= 0)) return;
    currentTurnIndex = nextIndex; updateTurnDisplay(); scrollToCurrentTurn(); saveAppState();
}

function prevTurn() {
    const list = getFlatCombatantList(); if (list.length === 0) return; let nextIndex = currentTurnIndex;
    do {
        nextIndex = (nextIndex - 1 + list.length) % list.length;
        if (nextIndex === list.length - 1 && currentTurnIndex === 0) {
            if (round > 1) { round--; document.getElementById('roundCounter').textContent = `Round: ${round}`; logChange(`⏪ Reverted to Round ${round}`); }
        }
    } while (list[nextIndex].hp <= 0 && nextIndex !== currentTurnIndex);
    if (list[nextIndex].hp <= 0 && list.every(i => i.hp <= 0)) return;
    currentTurnIndex = nextIndex; updateTurnDisplay(); scrollToCurrentTurn(); saveAppState();
}

function updateTurnDisplay() {
    const list = getFlatCombatantList(); const current = list[currentTurnIndex]; const display = document.getElementById('currentTurnDisplay');
    document.querySelectorAll('.combatant-wrapper.current-turn').forEach(w => w.classList.remove('current-turn'));
    if (current) {
        display.innerHTML = `🟢 Current Turn: <strong>${current.name}</strong>`;
        const wrapper = document.querySelector(`.combatant-wrapper[data-combatant-id="${current.id}"]`);
        if (wrapper) wrapper.classList.add('current-turn');
    } else { display.innerHTML = `🟢 Current Turn: <strong>None</strong>`; }
}

function scrollToCurrentTurn() {
    const wrapper = document.querySelector('.combatant-wrapper.current-turn');
    wrapper?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function tickStatusEffects() {
    let needsRender = false;
    combatants.forEach(c => {
        const members = c.isGroup ? c.members : [c];
        members.forEach(m => {
            if (!m.statusEffects?.length) return;
            const expired = m.statusEffects.filter(se => se.rounds - 1 <= 0).map(se => se.name);
            if (expired.length > 0) { logChange(`${m.name} is no longer affected by: ${expired.join(', ')}.`); needsRender = true; }
            m.statusEffects = m.statusEffects.map(se => ({ ...se, rounds: se.rounds - 1 })).filter(se => se.rounds > 0);
        });
    });
    if (needsRender) renderCombatants();
}

// ============================================
// ========== ACTIONS & POPUPS ==========
// ============================================

function showHpPopup(combatantId, event) {
    const hpPopup = document.getElementById('hpPopup');
    
    document.getElementById('healingInput').value = '';
    document.getElementById('damageInput').value = '';
    document.getElementById('addTempHpInput').value = '';
    
    hpPopup.dataset.combatantId = combatantId;
    
    hpPopup.classList.remove('hidden');
    hpPopup.style.visibility = 'hidden';
    hpPopup.style.top = '-9999px';
    const popupHeight = hpPopup.offsetHeight;
    
    const cellRect = event.target.getBoundingClientRect();
    
    let topPosition = cellRect.bottom + window.scrollY + 5;

    if (topPosition + popupHeight > window.innerHeight + window.scrollY) {
        topPosition = cellRect.top + window.scrollY - popupHeight - 5;
    }

    hpPopup.style.left = `${cellRect.left + window.scrollX}px`;
    hpPopup.style.top = `${topPosition}px`;
    hpPopup.style.visibility = 'visible';
    
    document.getElementById('damageInput').focus();
}

function applyHpChange() {
    const hpPopup = document.getElementById('hpPopup'); const combatantId = hpPopup.dataset.combatantId; if (!combatantId) return;
    const combatant = findCombatantById(combatantId); if (!combatant) return;
    const healing = parseInt(document.getElementById('healingInput').value, 10) || 0;
    const damage = parseInt(document.getElementById('damageInput').value, 10) || 0;
    const tempHpGain = parseInt(document.getElementById('addTempHpInput').value, 10) || 0;
    if (tempHpGain > 0) {
        combatant.tempHp = (combatant.tempHp || 0) + tempHpGain;
        logChange(`✨ ${combatant.name} gains ${tempHpGain} temporary HP (New Temp HP: ${combatant.tempHp}).`);
    }
    if (damage > 0) {
        logChange(`💥 ${combatant.name} takes ${damage} damage.`); let remainingDmg = damage; let tempHpLost = Math.min(combatant.tempHp || 0, remainingDmg);
        combatant.tempHp -= tempHpLost; remainingDmg -= tempHpLost;
        if (tempHpLost > 0) logChange(`  - ${tempHpLost} damage absorbed by Temp HP (New Temp HP: ${combatant.tempHp})`);
        if (remainingDmg > 0) { const oldHp = combatant.hp; combatant.hp -= remainingDmg; const damageToHp = oldHp - combatant.hp; if (damageToHp > 0) logChange(`  - ${damageToHp} damage dealt to main HP (New HP: ${combatant.hp}/${combatant.maxHp})`); }
    }
    if (healing > 0) {
        const oldHp = combatant.hp; const newHp = Math.min(combatant.maxHp, oldHp + healing); const amountHealed = newHp - oldHp;
        if (amountHealed > 0) { combatant.hp = newHp; logChange(`❤️ ${combatant.name} is healed for ${amountHealed} HP (New HP: ${combatant.hp}/${combatant.maxHp}).`); }
    }
    renderCombatants(); hpPopup.classList.add('hidden'); hpPopup.removeAttribute('data-combatant-id');
}

function applyStatusEffect(id, select) {
    const effect = select.value; select.value = ""; if (!effect) return;
    const rounds = parseInt(prompt(`How many rounds for ${effect}?`, '1'), 10);
    if (isNaN(rounds) || rounds <= 0) return; const target = findCombatantById(id); if (!target) return;
    if (!target.statusEffects) target.statusEffects = [];
    const existing = target.statusEffects.find(se => se.name === effect);
    if (existing) { existing.rounds = rounds; logChange(`${target.name} ${effect} duration updated to ${rounds} rounds.`); }
    else { target.statusEffects.push({ name: effect, rounds }); logChange(`${target.name} became ${effect} for ${rounds} round(s).`); }
    renderCombatants();
}

function duplicateCombatant(id) {
    const original = findCombatantById(id); if (!original) return;
    const clone = JSON.parse(JSON.stringify(original)); clone.id = generateUniqueId(); clone.name = getUniqueName(original.name); clone.spellSlotsVisible = false;
    if (clone.isGroup) clone.members = clone.members.map(m => ({ ...m, id: generateUniqueId(), name: getUniqueName(m.name) }));
    const parentGroup = combatants.find(g => g.isGroup && g.members.some(m => m.id === id));
    if (parentGroup) parentGroup.members.splice(parentGroup.members.findIndex(m => m.id === id) + 1, 0, clone);
    else combatants.splice(combatants.findIndex(c => c.id === id) + 1, 0, clone);
    logChange(`Duplicated ${original.name} → ${clone.name}`); renderCombatants();
}

function deleteCombatant(id) {
    const combatant = findCombatantById(id);
    if (combatant && confirm(`Are you sure you want to delete ${combatant.name}?`)) { removeCombatantById(id); logChange(`${combatant.name} was deleted.`); renderCombatants(); }
}

function removeFromGroup(memberId, groupId) {
    const group = combatants.find(c => c.id === groupId); if (!group) return;
    const memberIndex = group.members.findIndex(m => m.id === memberId); if (memberIndex === -1) return;
    const [member] = group.members.splice(memberIndex, 1);
    member.init = member.previousInit ?? member.init; combatants.push(member);
    logChange(`${member.name} removed from group ${group.name}.`); renderCombatants();
}

// ============================================
// ========== SPELL SLOT FUNCTIONS ==========
// ============================================

function toggleSpellSlots(id) { const combatant = findCombatantById(id); if (combatant?.spellSlots) { combatant.spellSlotsVisible = !combatant.spellSlotsVisible; renderCombatants(); } }
function makeSpellcaster(id) {
    const combatant = findCombatantById(id); if (!combatant || combatant.spellSlots) return;
    combatant.spellSlots = {
        1: { c: 0, m: 0 }, 2: { c: 0, m: 0 }, 3: { c: 0, m: 0 },
        4: { c: 0, m: 0 }, 5: { c: 0, m: 0 }, 6: { c: 0, m: 0 },
        7: { c: 0, m: 0 }, 8: { c: 0, m: 0 }, 9: { c: 0, m: 0 }
    };
    combatant.spellSlotsVisible = true; logChange(`${combatant.name} is now a spellcaster.`); renderCombatants();
}

function createSpellSlotPanel(c) {
    const panel = document.createElement('div'); panel.className = 'spell-slot-panel'; let content = '';
    for (let level = 1; level <= 9; level++) {
        const slots = c.spellSlots[level];
        if (slots.m > 0 || level <= 5) {
            let checkboxes = '';
            for (let i = 1; i <= slots.m; i++) checkboxes += `<input type="checkbox" ${i <= slots.c ? 'checked' : ''} onchange="updateCurrentSlotsFromCheckbox('${c.id}', ${level}, this.parentElement)">`;
            content += `<div class="spell-level-row"><div class="spell-level-label">Level ${level}</div><div class="spell-slot-inputs"><input type="number" class="slot-input" value="${slots.c}" onblur="updateCurrentSlots('${c.id}', this.value, ${level})"><span class="slot-separator">/</span><input type="number" class="slot-input" value="${slots.m}" onblur="updateMaxSlots('${c.id}', this.value, ${level})"></div><div class="checkbox-container" title="${slots.c} of ${slots.m} slots available">${checkboxes}</div></div>`;
        }
    }
    panel.innerHTML = content; return panel;
}

function updateCurrentSlotsFromCheckbox(id, level, container) {
    const c = findCombatantById(id)?.spellSlots?.[level]; if (!c) return;
    c.c = Array.from(container.querySelectorAll('input[type="checkbox"]')).filter(cb => cb.checked).length;
    renderCombatants();
}
function updateCurrentSlots(id, value, level) {
    const c = findCombatantById(id)?.spellSlots?.[level]; if (!c) return;
    const current = parseInt(value, 10); if (!isNaN(current)) { c.c = Math.max(0, Math.min(current, c.m)); renderCombatants(); }
}
function updateMaxSlots(id, value, level) {
    const c = findCombatantById(id)?.spellSlots?.[level]; if (!c) return;
    const max = parseInt(value, 10); if (!isNaN(max) && max >= 0) { c.m = max; c.c = Math.min(c.c, c.m); renderCombatants(); }
}

