// ============================================
// ========== CONSTANTS & SETUP ==========
// ============================================
const statusOptions = ['Charmed', 'Frightened', 'Prone', 'Poisoned', 'Stunned', 'Blinded', 'Invisible', 'Paralyzed', 'Restrained'];

// ============================================
// ========== COMBATANT MANAGEMENT ==========
// ============================================

function handleAddCombatant(e) {
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
        imageUrl: document.getElementById('modalImage').value.trim() || '',
        statusEffects: [],
        isGroup: false,
        previousInit: init,
        spellSlotsVisible: false
    };

    if (isSpellcaster) {
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
//... (The rest of the combat_tracker.js file is the same as the previous correct version and can be copied from there)

function addGroup() {
    const groupName = prompt("Enter group name:");
    if (!groupName) return;
    const groupInitInput = prompt(`Enter initiative for "${groupName}":`);
    const groupInit = parseInt(groupInitInput, 10);
    if (isNaN(groupInit)) {
        alert("Invalid initiative. Please enter a number.");
        return;
    }
    const newGroup = {
        id: generateUniqueId(), name: getUniqueName(groupName), init: groupInit,
        isGroup: true, members: [], previousInit: groupInit
    };
    combatants.push(newGroup);
    logChange(`➕ Group created: ${newGroup.name} (Init: ${newGroup.init})`);
    renderCombatants();
}

function startEncounter() {
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
    list.innerHTML = '';
    document.body.classList.remove('dragging');

    const sortedCombatants = [...combatants].sort((a, b) => b.init - a.init);

    sortedCombatants.forEach((item, index) => {
        list.appendChild(createDropZone(item, null, index, 'before'));
        if (item.isGroup) {
            list.appendChild(createGroupHeaderWrapper(item));
            list.appendChild(createDropZone(item, item, 0, 'group-internal'));
            item.members.forEach((member, memberIndex) => {
                list.appendChild(createCombatantWrapper(member, true, item));
                list.appendChild(createDropZone(member, item, memberIndex + 1, 'group-internal'));
            });
        } else {
            list.appendChild(createCombatantWrapper(item, false, null));
        }
    });

    if (sortedCombatants.length > 0) {
        list.appendChild(createDropZone(null, null, sortedCombatants.length, 'after'));
    } else {
        list.appendChild(createDropZone(null, null, 0, 'empty-list'));
    }

    updateTurnDisplay();
    saveAppState();
}

function createCombatantWrapper(c, isGrouped = false, groupRef = null) {
    const wrapper = document.createElement('div');
    wrapper.className = 'combatant-wrapper';
    if(isGrouped) wrapper.classList.add('group-member-wrapper');
    wrapper.setAttribute("draggable", "true");
    wrapper.dataset.combatantId = c.id;

    wrapper.ondragstart = (e) => {
        e.dataTransfer.setData("text/plain", c.id);
        e.dataTransfer.effectAllowed = "move";
        document.body.classList.add('dragging');
    };
    wrapper.ondragend = () => document.body.classList.remove('dragging');

    wrapper.appendChild(createCombatantRow(c, isGrouped, groupRef));

    if (c.spellSlotsVisible && c.spellSlots) {
        wrapper.appendChild(createSpellSlotPanel(c));
    }

    return wrapper;
}

function createGroupHeaderWrapper(group) {
    const wrapper = document.createElement('div');
    wrapper.className = 'combatant-wrapper group-header-wrapper';
    wrapper.setAttribute("draggable", "true");
    wrapper.dataset.combatantId = group.id;

    wrapper.ondragstart = (e) => {
        e.dataTransfer.setData("text/plain", group.id);
        e.dataTransfer.effectAllowed = "move";
        document.body.classList.add('dragging');
    };
    wrapper.ondragend = () => document.body.classList.remove('dragging');

    const row = document.createElement('div');
    row.className = 'group-header creature-row';
    row.innerHTML = `
        <div class="cell image-cell">📁</div>
        <div class="cell init-cell" contenteditable="true" data-field="init">${group.init}</div>
        <div class="cell cell-name" contenteditable="true" data-field="name">${group.name}</div>
        <div class="cell cell-ac"></div><div class="cell cell-hp"></div><div class="cell"></div>
        <div class="cell"></div><div class="cell status-cell"></div><div class="cell role-cell">DM Group</div>
        <div class="cell action-cell">
            <button onclick="duplicateCombatant('${group.id}')" title="Duplicate Group">+</button>
            <button onclick="deleteCombatant('${group.id}')" title="Delete Group">🗑</button>
        </div>
    `;

    row.querySelectorAll('[contenteditable="true"]').forEach(cell => {
        cell.addEventListener('blur', (e) => {
            const field = cell.dataset.field;
            const oldValue = group[field];
            const newValueRaw = cell.textContent.trim();
            let newValue = (field === 'init') ? parseInt(newValueRaw, 10) : newValueRaw;
            if (field === 'init' && isNaN(newValue)) {
                cell.textContent = oldValue; return;
            }
            if (newValue !== oldValue) {
                logChange(`Group ${group.name}'s ${field} changed from ${oldValue} to ${newValue}`);
                group[field] = newValue;
                renderCombatants();
            }
        });
        cell.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
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

    drop.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; drop.classList.add('highlight'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('highlight'));
    drop.addEventListener('drop', e => {
        e.preventDefault();
        drop.classList.remove('highlight');
        const draggedId = e.dataTransfer.getData("text/plain");
        if (!draggedId || draggedId === drop.dataset.targetId) return;
        const dragged = removeCombatantById(draggedId);
        if (!dragged) return;

        dragged.init = dragged.isGroup ? dragged.init : (dragged.previousInit ?? dragged.init);
        const targetGroupId = drop.dataset.targetGroup;
        const targetIdx = parseInt(drop.dataset.targetIndex, 10);

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
    let found = null;
    let combatantIndex = combatants.findIndex(c => c.id === id);
    if (combatantIndex > -1) {
        return combatants.splice(combatantIndex, 1)[0];
    }
    for (const group of combatants) {
        if (group.isGroup && group.members) {
            const memberIndex = group.members.findIndex(m => m.id === id);
            if(memberIndex > -1) {
                found = group.members.splice(memberIndex, 1)[0];
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

    const statusTags = (c.statusEffects || []).map(se => `<span class="status-tag">${se.name} (${se.rounds})</span>`).join('');
    const statusDropdown = `<select onchange="applyStatusEffect('${c.id}', this)"><option value="">＋ Add</option>${statusOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
    const imageContent = c.imageUrl ? `<img src="${c.imageUrl}" alt="${c.name}" class="combatant-image">` : '🧍';
    const spellButton = c.spellSlots ? `<button onclick="toggleSpellSlots('${c.id}')" title="Toggle Spell Slots">🪄</button>` : `<button onclick="makeSpellcaster('${c.id}')" title="Make Spellcaster">✨</button>`;
    
    row.innerHTML = `
        <div class="cell image-cell" title="Double-click to edit image">${imageContent}</div>
        <div class="cell init-cell" ${isGrouped ? '' : 'contenteditable="true"'} data-field="init">${isGrouped ? '—' : c.init}</div>
        <div class="cell cell-name" contenteditable="true" data-field="name">${c.name}</div>
        <div class="cell cell-ac" contenteditable="true" data-field="ac">${c.ac}</div>
        <div class="cell" contenteditable="true" data-field="hp" title="Right-click for options">${c.hp}</div>
        <div class="cell" contenteditable="true" data-field="tempHp" title="Right-click for options">${c.tempHp || 0}</div>
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

    attachEditableEvents(row.querySelectorAll('[contenteditable="true"]'), c);
    row.querySelector('.image-cell').addEventListener('dblclick', () => {
        const newImageUrl = prompt(`Enter new image URL for ${c.name}:`, c.imageUrl || '');
        if (newImageUrl !== null && newImageUrl.trim() !== c.imageUrl) {
            c.imageUrl = newImageUrl.trim();
            logChange(`${c.name}'s image was updated.`);
            renderCombatants();
        }
    });

    row.querySelector('[data-field="hp"]').addEventListener('contextmenu', (e) => { e.preventDefault(); showHpPopup(c.id, e); });
    row.querySelector('[data-field="tempHp"]').addEventListener('contextmenu', (e) => { e.preventDefault(); showHpPopup(c.id, e); });
    return row;
}

function attachEditableEvents(cells, c) {
    cells.forEach(cell => {
        cell.addEventListener('blur', (e) => {
            const field = cell.dataset.field;
            const oldValue = c[field];
            let newValueRaw = cell.textContent.trim();
            let newValue;

            if (['init', 'ac', 'hp', 'tempHp', 'maxHp'].includes(field)) {
                newValue = parseInt(newValueRaw, 10);
                if (isNaN(newValue)) { cell.textContent = oldValue; return; }
            } else {
                newValue = newValueRaw;
            }

            if (newValue !== oldValue) {
                if (field === 'name' && newValue === "") { cell.textContent = oldValue; return; }
                c[field] = newValue;
                logChange(`${c.name}'s ${field} changed from ${oldValue} to ${newValue}`);
                renderCombatants();
            }
        });
        cell.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
    });
}

// ============================================
// ========== TURN & STATUS MANAGEMENT ==========
// ============================================

function nextTurn() {
    const list = getFlatCombatantList();
    if (list.length === 0) return;
    currentTurnIndex = (currentTurnIndex + 1) % list.length;
    if (currentTurnIndex === 0) {
        round++;
        document.getElementById('roundCounter').textContent = `Round: ${round}`;
        logChange(`⏩ Round ${round} begins`);
        tickStatusEffects();
    }
    updateTurnDisplay();
    scrollToCurrentTurn();
    saveAppState();
}

function prevTurn() {
    const list = getFlatCombatantList();
    if (list.length === 0) return;
    currentTurnIndex = (currentTurnIndex - 1 + list.length) % list.length;
    if (currentTurnIndex === list.length - 1 && round > 1) {
        round--;
        document.getElementById('roundCounter').textContent = `Round: ${round}`;
        logChange(`⏪ Reverted to Round ${round}`);
    }
    updateTurnDisplay();
    scrollToCurrentTurn();
    saveAppState();
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
    const wrapper = document.querySelector(`.combatant-wrapper.current-turn`);
    wrapper?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function tickStatusEffects() {
    let needsRender = false;
    combatants.forEach(c => {
        const membersToTick = c.isGroup ? c.members : [c];
        membersToTick.forEach(m => {
            if (!m.statusEffects?.length) return;
            const expired = m.statusEffects.filter(se => se.rounds - 1 <= 0).map(se => se.name);
            if (expired.length > 0) {
                logChange(`${m.name} is no longer affected by: ${expired.join(', ')}.`);
                needsRender = true;
            }
            m.statusEffects = m.statusEffects.map(se => ({...se, rounds: se.rounds - 1})).filter(se => se.rounds > 0);
        });
    });
    if (needsRender) renderCombatants();
}

// ============================================
// ========== ACTIONS & POPUPS ==========
// ============================================

function showHpPopup(combatantId, event) {
    const hpPopup = document.getElementById('hpPopup');
    hpPopup.dataset.combatantId = combatantId;
    const cellRect = event.target.getBoundingClientRect();
    hpPopup.style.left = `${cellRect.left + window.scrollX}px`;
    hpPopup.style.top = `${cellRect.bottom + window.scrollY + 5}px`;
    hpPopup.classList.remove('hidden');
    document.getElementById('damageInput').focus();
}

function applyHpChange() {
    const hpPopup = document.getElementById('hpPopup');
    const combatantId = hpPopup.dataset.combatantId;
    if (!combatantId) return;
    const combatant = findCombatantById(combatantId);
    if (!combatant) return;

    const healing = parseInt(document.getElementById('healingInput').value, 10) || 0;
    const damage = parseInt(document.getElementById('damageInput').value, 10) || 0;
    const tempHp = parseInt(document.getElementById('addTempHpInput').value, 10) || 0;

    if (tempHp > 0) {
        combatant.tempHp = Math.max(combatant.tempHp || 0, tempHp);
        logChange(`${combatant.name} gains ${tempHp} temp HP (now has ${combatant.tempHp}).`);
    }
    if (damage > 0) {
        let remainingDmg = damage;
        let tempHpLost = Math.min(combatant.tempHp || 0, remainingDmg);
        combatant.tempHp -= tempHpLost;
        remainingDmg -= tempHpLost;
        combatant.hp -= remainingDmg;
        logChange(`${combatant.name} takes ${damage} damage.`);
    }
    if (healing > 0) {
        combatant.hp = Math.min(combatant.maxHp, combatant.hp + healing);
        logChange(`${combatant.name} is healed for ${healing}.`);
    }

    renderCombatants();
    hpPopup.classList.add('hidden');
    hpPopup.removeAttribute('data-combatant-id');
}

function applyStatusEffect(id, select) {
    const effect = select.value;
    select.value = "";
    if (!effect) return;

    const rounds = parseInt(prompt(`How many rounds for ${effect}?`, '1'), 10);
    if (isNaN(rounds) || rounds <= 0) return;

    const target = findCombatantById(id);
    if (!target) return;
    if (!target.statusEffects) target.statusEffects = [];

    const existing = target.statusEffects.find(se => se.name === effect);
    if (existing) {
        existing.rounds = rounds;
        logChange(`${target.name} ${effect} duration updated to ${existing.rounds} rounds.`);
    } else {
        target.statusEffects.push({ name: effect, rounds });
        logChange(`${target.name} became ${effect} for ${rounds} round(s).`);
    }
    renderCombatants();
}

function duplicateCombatant(id) {
    const original = findCombatantById(id);
    if (!original) return;
    const clone = JSON.parse(JSON.stringify(original));
    clone.id = generateUniqueId();
    clone.name = getUniqueName(original.name);
    clone.spellSlotsVisible = false;
    
    if (clone.isGroup) {
        clone.members = clone.members.map(m => ({ ...m, id: generateUniqueId(), name: getUniqueName(m.name) }));
    }

    const parentGroup = combatants.find(g => g.isGroup && g.members.some(m => m.id === id));
    if (parentGroup) {
        parentGroup.members.splice(parentGroup.members.findIndex(m => m.id === id) + 1, 0, clone);
    } else {
        combatants.splice(combatants.findIndex(c => c.id === id) + 1, 0, clone);
    }
    logChange(`Duplicated ${original.name} → ${clone.name}`);
    renderCombatants();
}

function deleteCombatant(id) {
    const combatant = findCombatantById(id);
    if (combatant && confirm(`Are you sure you want to delete ${combatant.name}?`)) {
        removeCombatantById(id);
        logChange(`${combatant.name} was deleted.`);
        renderCombatants();
    }
}

function removeFromGroup(memberId, groupId) {
    const group = combatants.find(c => c.id === groupId);
    if (!group) return;
    const memberIndex = group.members.findIndex(m => m.id === memberId);
    if (memberIndex === -1) return;
    const [member] = group.members.splice(memberIndex, 1);
    member.init = member.previousInit ?? member.init;
    combatants.push(member);
    logChange(`${member.name} removed from group ${group.name}.`);
    renderCombatants();
}

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
    combatant.spellSlots = {
        1: { c: 0, m: 0 }, 2: { c: 0, m: 0 }, 3: { c: 0, m: 0 },
        4: { c: 0, m: 0 }, 5: { c: 0, m: 0 }, 6: { c: 0, m: 0 },
        7: { c: 0, m: 0 }, 8: { c: 0, m: 0 }, 9: { c: 0, m: 0 }
    };
    combatant.spellSlotsVisible = true;
    logChange(`${combatant.name} is now a spellcaster.`);
    renderCombatants();
}

function createSpellSlotPanel(c) {
    const panel = document.createElement('div');
    panel.className = 'spell-slot-panel';

    let content = '';
    // FIX: Simplified the condition to always show levels that have max slots, or levels 1-5 for easier editing.
    for (let level = 1; level <= 9; level++) {
        const slots = c.spellSlots[level];
        if (slots.m > 0 || level <= 5) {
            let checkboxes = '';
            for(let i = 1; i <= slots.m; i++) {
                checkboxes += `<input type="checkbox" ${i <= slots.c ? 'checked' : ''} onchange="updateCurrentSlotsFromCheckbox('${c.id}', ${level}, this.parentElement)">`;
            }
            content += `
                <div class="spell-level-row">
                    <div class="spell-level-label">Level ${level}</div>
                    <div class="spell-slot-inputs">
                        <input type="number" class="slot-input" value="${slots.c}" onblur="updateCurrentSlots('${c.id}', this.value, ${level})">
                        <span class="slot-separator">/</span>
                        <input type="number" class="slot-input" value="${slots.m}" onblur="updateMaxSlots('${c.id}', this.value, ${level})">
                    </div>
                     <div class="checkbox-container" title="${slots.c} of ${slots.m} slots available">${checkboxes}</div>
                </div>`;
        }
    }
    panel.innerHTML = content;
    return panel;
}

function updateCurrentSlotsFromCheckbox(id, level, container) {
    const c = findCombatantById(id)?.spellSlots?.[level];
    if (!c) return;
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    c.c = Array.from(checkboxes).filter(cb => cb.checked).length;
    renderCombatants();
}

function updateCurrentSlots(id, value, level) {
    const c = findCombatantById(id)?.spellSlots?.[level];
    if (!c) return;
    const current = parseInt(value, 10);
    if (!isNaN(current)) {
        c.c = Math.max(0, Math.min(current, c.m));
        renderCombatants();
    }
}

function updateMaxSlots(id, value, level) {
    const c = findCombatantById(id)?.spellSlots?.[level];
    if (!c) return;
    const max = parseInt(value, 10);
    if (!isNaN(max) && max >= 0) {
        c.m = max;
        c.c = Math.min(c.c, c.m);
        renderCombatants();
    }
}