// ============================================
// ========== CONSTANTS & SETUP ==========
// ============================================
const statusOptions = ['Charmed', 'Frightened', 'Prone', 'Poisoned', 'Stunned', 'Blinded', 'Invisible', 'Paralyzed', 'Restrained'];

let combatantIdForImageUpload = null;

// ============================================
// ========== COMBATANT MANAGEMENT ==========
// ============================================

function addDefaultCombatant() {
    const newCombatant = {
        id: generateUniqueId(), name: getUniqueDefaultName("Combatant"), init: 10,
        ac: 10, hp: 10, maxHp: 10, tempHpSources: [], role: 'dm', imageUrl: '',
        statusEffects: [], isGroup: false, previousInit: 10, spellSlotsVisible: false
    };
    combatants.push(newCombatant);
    logChange(`➕ Added ${newCombatant.name}`);
    renderCombatants();
}

function addDefaultGroup() {
    const newGroup = {
        id: generateUniqueId(), name: getUniqueDefaultName("Group"), init: 10,
        isGroup: true, members: [], previousInit: 10
    };
    combatants.push(newGroup);
    logChange(`➕ Group created: ${newGroup.name}`);
    renderCombatants();
}

function startEncounter() {
    if (getFlatCombatantList().length === 0) {
        alert("Add some combatants before starting the encounter!");
        return;
    }
    round = 1; 
    currentTurnIndex = 0;
    document.getElementById('roundCounter').textContent = `Round: 1`;
    logChange('🎲 Encounter started');
    renderCombatants();
}

// ============================================
// ========== RENDERING & DISPLAY LOGIC ==========
// ============================================

function renderCombatants() {
    const list = document.getElementById('combatantList');
    if (!list) return;
    list.innerHTML = '';
    
    const sortedIds = getFlatCombatantList().map(c => c.id);
    
    const parseName = (nameStr) => {
        const match = nameStr.match(/^(.*?)(?:\s\((\d+)\))?$/);
        return { name: match[1].trim(), num: match[2] ? parseInt(match[2], 10) : 0 };
    };

    const sortedTopLevel = [...combatants].sort((a, b) => {
        const initDiff = b.init - a.init;
        if (initDiff !== 0) return initDiff;
        const aParsed = parseName(a.name);
        const bParsed = parseName(b.name);
        const nameDiff = aParsed.name.localeCompare(bParsed.name);
        if (nameDiff !== 0) return nameDiff;
        return aParsed.num - bParsed.num;
    });

    sortedTopLevel.forEach((item, index) => {
        list.appendChild(createDropZone(item, null, index, 'before'));
        if (item.isGroup) {
            list.appendChild(createGroupHeaderWrapper(item));
            list.appendChild(createDropZone(item, item, 0, 'group-internal'));
            
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

    if (sortedTopLevel.length > 0) {
        list.appendChild(createDropZone(null, null, sortedTopLevel.length, 'after'));
    } else {
        list.appendChild(createDropZone(null, null, 0, 'empty-list'));
    }

    updateTurnDisplay();
    saveAppState();
}


function createCombatantWrapper(c, isGrouped = false, groupRef = null) {
    const wrapper = document.createElement('div');
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
 * FIXED: The logic for determining a defeated group is now correct.
 */
function createGroupHeaderWrapper(group) {
    const wrapper = document.createElement('div');
    
    // THE FIX IS HERE: A group is only "defeated" if it has members AND all of them are at 0 HP.
    // An empty group is not considered defeated.
    const isGroupDefeated = group.members.length > 0 && group.members.every(member => member.hp <= 0);
    
    wrapper.className = `combatant-wrapper group-header-wrapper ${isGroupDefeated ? 'dead-combatant' : ''}`;
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
        <div class="cell"></div><div class="cell"></div><div class="cell"></div><div class="cell"></div>
        <div class="cell role-cell">DM Group</div>
        <div class="cell action-cell">
            <button onclick="duplicateCombatant('${group.id}')" title="Duplicate Group">+</button>
            <button onclick="deleteCombatant('${group.id}')" title="Delete Group">🗑</button>
        </div>
    `;
    attachEditableEvents(row.querySelectorAll('[contenteditable="true"]'), group);
    wrapper.appendChild(row);
    return wrapper;
}

// ... the rest of the file remains the same ...

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
    const activeStatusEffects = getActiveStatusEffects(c);
    const statusTags = activeStatusEffects.map(se => {
        const remaining = (se.appliedRound + se.duration) - round;
        return `<span class="status-tag">${se.name}${se.duration !== Infinity ? ` (${remaining})` : ''}</span>`;
    }).join(' ');
    const statusDropdown = `<select onchange="applyStatusEffect('${c.id}', this)"><option value="">＋ Add</option>${statusOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
    const imageContent = c.imageUrl ? `<img src="${c.imageUrl}" alt="${c.name}" class="combatant-image">` : '🧍';
    const imageCell = `<div id="image-cell-${c.id}" class="cell image-cell" title="Click to upload, or drag & drop an image file">${imageContent}</div>`;
    const spellButton = c.spellSlots ? `<button onclick="toggleSpellSlots('${c.id}')" title="Toggle Spell Slots">🪄</button>` : `<button onclick="makeSpellcaster('${c.id}')" title="Make Spellcaster">✨</button>`;
    const totalTempHp = getTotalTempHp(c);
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
        <div class="cell" data-field="tempHp" title="Temp HP (Right-click for options)">${totalTempHp || 0}</div>
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

function attachEditableEvents(cells, c) {
    cells.forEach(cell => {
        cell.addEventListener('blur', () => {
            const field = cell.dataset.field;
            const oldValue = c[field];
            let newValueRaw = cell.textContent.trim();
            let newValue;

            if (['init', 'ac', 'hp', 'maxHp'].includes(field)) {
                newValue = parseInt(newValueRaw, 10);
                if (isNaN(newValue)) { cell.textContent = oldValue; return; }
            } else {
                newValue = newValueRaw;
                if (field === 'name') {
                    if (newValue === "") { alert("Combatant name cannot be empty."); cell.textContent = oldValue; return; }
                    if (newValue !== oldValue) {
                        const allNames = combatants.flatMap(comb => comb.isGroup ? [comb.name, ...comb.members.map(m => m.name)] : [comb.name]);
                        const isDuplicate = allNames.some(other => other.id !== c.id && other.name === newValue);
                        if (isDuplicate) {
                            alert(`The name "${newValue}" is already in use.`); cell.textContent = oldValue; return;
                        }
                    }
                }
            }
            if (field === 'hp') newValue = Math.max(0, Math.min(newValue, c.maxHp));
            
            if (newValue !== oldValue) {
                const logName = field === 'name' ? oldValue : c.name;
                logChange(`${logName}'s ${field} changed from '${oldValue}' to '${newValue}'`);
                c[field] = newValue;
                renderCombatants();
            } else {
                cell.textContent = oldValue;
            }
        });
        cell.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
    });
}

// ============================================
// ========== TURN & STATUS MANAGEMENT ==========
// ============================================

function processRoundChange() {
    let needsRender = false;
    const allCombatants = getFlatCombatantList();
    allCombatants.forEach(c => {
        const combatant = findCombatantById(c.id);
        if (combatant.statusEffects && combatant.statusEffects.length > 0) {
            const newlyExpired = combatant.statusEffects.filter(se => (round >= se.appliedRound + se.duration));
            if (newlyExpired.length > 0) {
                logChange(`⌛ ${combatant.name} is no longer affected by: ${newlyExpired.map(e => e.name).join(', ')}.`);
                needsRender = true;
            }
        }
        if (combatant.tempHpSources && combatant.tempHpSources.length > 0) {
            const newlyExpired = combatant.tempHpSources.filter(thps => (round >= thps.appliedRound + thps.duration));
             if (newlyExpired.length > 0) {
                logChange(`⌛ Temporary HP on ${combatant.name} from ${newlyExpired.length} source(s) has expired.`);
                needsRender = true;
            }
        }
    });
    if (needsRender) renderCombatants();
}


function nextTurn() {
    const list = getFlatCombatantList(); if (list.length === 0) return; let rolledOver = false; let nextIndex = currentTurnIndex;
    do {
        nextIndex = (nextIndex + 1) % list.length;
        if (nextIndex === 0 && !rolledOver) {
            rolledOver = true; round++; document.getElementById('roundCounter').textContent = `Round: ${round}`;
            logChange(`⏩ Round ${round} begins`);
            processRoundChange();
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
            if (round > 1) { 
                round--; 
                document.getElementById('roundCounter').textContent = `Round: ${round}`; 
                logChange(`⏪ Reverted to Round ${round}`); 
                renderCombatants();
            }
        }
    } while (list[nextIndex].hp <= 0 && nextIndex !== currentTurnIndex);
    if (list[nextIndex].hp <= 0 && list.every(i => i.hp <= 0)) return;
    currentTurnIndex = nextIndex; updateTurnDisplay(); scrollToCurrentTurn(); saveAppState();
}

function updateTurnDisplay() {
    const list = getFlatCombatantList();
    const current = list[currentTurnIndex];
    const display = document.getElementById('currentTurnDisplay');
    document.querySelectorAll('.combatant-wrapper.current-turn').forEach(w => w.classList.remove('current-turn'));
    if (current) {
        display.innerHTML = `🟢 Current Turn: <strong>${current.name}</strong>`;
        const wrapper = document.querySelector(`.combatant-wrapper[data-combatant-id="${current.id}"]`);
        if (wrapper) wrapper.classList.add('current-turn');
    } else {
        display.innerHTML = `🟢 Current Turn: <strong>None</strong>`;
    }
}

function scrollToCurrentTurn() {
    const wrapper = document.querySelector('.combatant-wrapper.current-turn');
    wrapper?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ============================================
// ========== ACTIONS & POPUPS ==========
// ============================================
function showHpPopup(combatantId, event) {
    const hpPopup = document.getElementById('hpPopup');
    document.getElementById('healingInput').value = '';
    document.getElementById('damageInput').value = '';
    document.getElementById('addTempHpInput').value = '';
    document.getElementById('tempHpDurationInput').value = '';
    hpPopup.dataset.combatantId = combatantId;
    hpPopup.classList.remove('hidden');
    const rect = event.target.getBoundingClientRect();
    hpPopup.style.left = `${rect.left}px`;
    hpPopup.style.top = `${rect.bottom + 5}px`;
    document.getElementById('damageInput').focus();
}
function applyHpChange() {
    const hpPopup = document.getElementById('hpPopup');
    const combatantId = hpPopup.dataset.combatantId;
    if (!combatantId) return;
    const combatant = findCombatantById(combatantId);
    if (!combatant) return;
    const healing = parseInt(document.getElementById('healingInput').value, 10) || 0;
    let damage = parseInt(document.getElementById('damageInput').value, 10) || 0;
    const tempHpGain = parseInt(document.getElementById('addTempHpInput').value, 10) || 0;
    const tempHpDurationStr = document.getElementById('tempHpDurationInput').value;
    const tempHpDuration = tempHpDurationStr === '' ? Infinity : parseInt(tempHpDurationStr, 10);
    if (tempHpGain > 0 && (tempHpDuration > 0 || tempHpDuration === Infinity)) {
        if (!combatant.tempHpSources) combatant.tempHpSources = [];
        const newSource = { id: generateUniqueId(), amount: tempHpGain, duration: tempHpDuration, appliedRound: round };
        combatant.tempHpSources.push(newSource);
        logChange(`✨ ${combatant.name} gains ${tempHpGain} temporary HP for ${tempHpDuration === Infinity ? 'infinite' : tempHpDuration} rounds.`);
    }
    if (damage > 0) {
        logChange(`💥 ${combatant.name} takes ${damage} damage.`);
        let activeTempHpSources = getActiveTempHpSources(combatant);
        activeTempHpSources.sort((a, b) => (a.appliedRound + a.duration) - (b.appliedRound + b.duration));
        for (const source of activeTempHpSources) {
            if (damage <= 0) break;
            const damageToSource = Math.min(damage, source.amount);
            source.amount -= damageToSource;
            damage -= damageToSource;
            logChange(`  - ${damageToSource} damage absorbed by Temp HP source. ${source.amount} HP remains in source.`);
        }
        combatant.tempHpSources = combatant.tempHpSources.filter(s => s.amount > 0);
        if (damage > 0) {
            const oldHp = combatant.hp;
            combatant.hp = Math.max(0, combatant.hp - damage);
            const damageToHp = oldHp - combatant.hp;
            if (damageToHp > 0) logChange(`  - ${damageToHp} damage dealt to main HP (New HP: ${combatant.hp}/${combatant.maxHp})`);
        }
    }
    if (healing > 0) {
        const oldHp = combatant.hp;
        const newHp = Math.min(combatant.maxHp, oldHp + healing);
        const amountHealed = newHp - oldHp;
        if (amountHealed > 0) {
            combatant.hp = newHp;
            logChange(`❤️ ${combatant.name} is healed for ${amountHealed} HP (New HP: ${combatant.hp}/${combatant.maxHp}).`);
        }
    }
    hpPopup.classList.add('hidden');
    hpPopup.removeAttribute('data-combatant-id');
    renderCombatants();
}

function applyStatusEffect(id, select) {
    const effectName = select.value;
    select.value = "";
    if (!effectName) return;
    const durationStr = prompt(`How many rounds for ${effectName}? (Leave blank for infinite)`, '1');
    if (durationStr === null) return;
    const duration = durationStr.trim() === '' ? Infinity : parseInt(durationStr, 10);
    if (isNaN(duration) || (duration <= 0 && duration !== Infinity)) {
        alert('Invalid duration. Please enter a positive number or leave blank for infinite.');
        return;
    }
    const target = findCombatantById(id);
    if (!target) return;
    if (!target.statusEffects) target.statusEffects = [];
    const newEffect = { id: generateUniqueId(), name: effectName, duration: duration, appliedRound: round };
    const existingIndex = target.statusEffects.findIndex(se => se.name === effectName);
    if (existingIndex > -1) {
        target.statusEffects[existingIndex] = newEffect;
        logChange(`⌛ ${target.name}'s ${effectName} duration updated to ${duration === Infinity ? 'infinite' : `${duration} round(s)`}.`);
    } else {
        target.statusEffects.push(newEffect);
        logChange(`✨ ${target.name} became ${effectName} for ${duration === Infinity ? 'infinite' : `${duration} round(s)`}.`);
    }
    renderCombatants();
}

// ============================================
// ========== HELPER & UTILITY FUNCTIONS ==========
// ============================================
function generateUniqueId() { return `${Date.now()}-${Math.floor(Math.random() * 100000)}`; }

function logChange(msg) {
    const timestamp = new Date().toLocaleTimeString();
    historyLog.push(`[${timestamp}] ${msg}`);
    if (historyLog.length > 200) historyLog.shift();
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
    const flatList = combatants.flatMap(c => c.isGroup ? c.members.map(m => ({ ...m, init: c.init })) : [c]);
    const parseName = (nameStr) => {
        const match = nameStr.match(/^(.*?)(?:\s\((\d+)\))?$/);
        return { name: match[1].trim(), num: match[2] ? parseInt(match[2], 10) : 0 };
    };
    flatList.sort((a, b) => {
        const initDiff = b.init - a.init;
        if (initDiff !== 0) return initDiff;
        const aParsed = parseName(a.name);
        const bParsed = parseName(b.name);
        const nameDiff = aParsed.name.localeCompare(bParsed.name);
        if (nameDiff !== 0) return nameDiff;
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

function getUniqueDefaultName(base) {
    const allNames = combatants.flatMap(c => c.isGroup ? [c.name, ...c.members.map(m => m.name)] : [c.name]);
    let counter = 1;
    let newName = `${base} ${counter}`;
    while (allNames.includes(newName)) {
        counter++;
        newName = `${base} ${counter}`;
    }
    return newName;
}

function getUniqueName(baseName) {
    const allNames = combatants.flatMap(c => c.isGroup ? [c.name, ...c.members.map(m => m.name)] : [c.name]);
    if (!allNames.includes(baseName)) return baseName;
    const rootName = baseName.replace(/\s\(\d+\)$/, '').trim();
    let suffix = 2;
    let newName;
    do {
        newName = `${rootName} (${suffix})`;
        suffix++;
    } while (allNames.includes(newName));
    return newName;
}

function getActiveTempHpSources(combatant) {
    if (!combatant.tempHpSources) return [];
    return combatant.tempHpSources.filter(source => (round < source.appliedRound + source.duration));
}

function getTotalTempHp(combatant) {
    return getActiveTempHpSources(combatant).reduce((sum, source) => sum + source.amount, 0);
}

function getActiveStatusEffects(combatant) {
    if (!combatant.statusEffects) return [];
    return combatant.statusEffects.filter(effect => (round < effect.appliedRound + effect.duration));
}

// ============================================
// ========== IMAGE & OTHER ACTIONS ==========
// ============================================
function attachImageEventListeners(cell, id) {
    cell.addEventListener('click', () => { combatantIdForImageUpload = id; document.getElementById('imageUploadInput').click(); });
    cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('image-drop-hover'); });
    cell.addEventListener('dragleave', (e) => { e.preventDefault(); cell.classList.remove('image-drop-hover'); });
    cell.addEventListener('drop', (e) => {
        e.preventDefault(); cell.classList.remove('image-drop-hover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) processImageFile(file, id);
        else alert('Please drop an image file (e.g., PNG, JPG, GIF).');
    });
}
function handleImageSelection(event) {
    const file = event.target.files[0];
    if (file && combatantIdForImageUpload) processImageFile(file, combatantIdForImageUpload);
    combatantIdForImageUpload = null;
    event.target.value = '';
}
function processImageFile(file, id) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const combatant = findCombatantById(id);
        if (combatant) {
            combatant.imageUrl = e.target.result;
            logChange(`🖼️ Updated image for ${combatant.name}.`);
            renderCombatants();
        }
    };
    reader.readAsDataURL(file);
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
    combatant.spellSlots = { 1: { c: 0, m: 0 }, 2: { c: 0, m: 0 }, 3: { c: 0, m: 0 }, 4: { c: 0, m: 0 }, 5: { c: 0, m: 0 }, 6: { c: 0, m: 0 }, 7: { c: 0, m: 0 }, 8: { c: 0, m: 0 }, 9: { c: 0, m: 0 } };
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