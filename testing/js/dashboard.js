// ============================================
// ========== DASHBOARD LOGIC ==========
// ============================================

function getDashboardById(id) {
    return dashboards.find(d => d.id === id);
}

function getBlockById(dashboard, blockId) {
    return dashboard.blocks.find(b => b.id === blockId);
}

function createNewDashboard() {
    const title = prompt("Enter new dashboard title:", "New Character Sheet");
    if (!title) return;

    const newDash = {
        id: generateUniqueId(),
        title: title,
        description: "A fresh start.",
        emoji: "📄",
        folderId: null,
        isLocked: true,
        blocks: [
            { id: generateUniqueId(), type: 'header', title: '🔲 Header', content: `"${title}"` },
            { id: generateUniqueId(), type: 'stats', title: '🔲 Stats', content: 'AC: 10, HP: 10/10' }
        ]
    };
    dashboards.push(newDash);
    logChange(`Dashboard created: ${title}`);
    renderDashboardList();
}

function createNewFolder() {
    const name = prompt("Enter new folder name:", "New Folder");
    if (!name) return;
    folders.push({ id: generateUniqueId(), name });
    logChange(`Folder created: ${name}`);
    renderDashboardList();
}

function renderDashboardList() {
    const container = document.getElementById('dashboard-list-container');
    if (!container) return;
    container.innerHTML = '';

    folders.forEach(folder => {
        const folderDashboards = dashboards.filter(d => d.folderId === folder.id);
        const folderEl = document.createElement('div');
        folderEl.className = 'folder-container';
        folderEl.innerHTML = `
            <div class="folder-header">${folder.name}</div>
            <div class="folder-content" data-folder-id="${folder.id}">
                ${folderDashboards.map(createDashboardCardHTML).join('')}
            </div>
        `;
        container.appendChild(folderEl);
    });

    const loneDashboards = dashboards.filter(d => !d.folderId);
    const loneEl = document.createElement('div');
    loneEl.className = 'folder-container';
    loneEl.innerHTML = `
        <div class="folder-header">📄 Lone Dashboards</div>
        <div class="folder-content" data-folder-id="null">
            ${loneDashboards.map(createDashboardCardHTML).join('')}
        </div>
    `;
    container.appendChild(loneEl);

    container.querySelectorAll('.dashboard-preview-card').forEach(card => {
        card.addEventListener('click', () => openDashboardSheet(card.dataset.id));
    });

    initializeDashboardSortables();
}

function createDashboardCardHTML(d) {
    return `
        <div class="dashboard-preview-card" data-id="${d.id}" draggable="true">
            <div class="card-image">${d.emoji || '📄'}</div>
            <div class="card-info">
                <div class="card-title">${d.title}</div>
                <div class="card-desc">${d.description}</div>
            </div>
            <div class="card-edit">📝</div>
        </div>`;
}

function renderDashboardSheet(dashboard) {
    const container = document.getElementById('dashboard-sheet-view');
    const isLocked = dashboard.isLocked;
    container.innerHTML = `
        <div class="sheet-header">
            <button class="back-button">← Back to Dashboards</button>
            <span class="sheet-title">${dashboard.title}</span>
            <button class="lock-button">${isLocked ? '🔒 Locked' : '🔓 Unlocked'}</button>
        </div>
        <div class="sheet-portrait">${dashboard.emoji} Portrait</div>
        <div class="sheet-content">
             ${dashboard.blocks.map(b => createSheetBlockHTML(b, isLocked)).join('')}
        </div>
    `;
    container.classList.toggle('sheet-unlocked', !isLocked);

    container.querySelector('.back-button').addEventListener('click', closeDashboardSheet);
    container.querySelector('.lock-button').addEventListener('click', () => toggleDashboardLock(dashboard));

    if (!isLocked) {
        initializeBlockSortable(dashboard);
        container.querySelectorAll('.block-content[contenteditable="true"]').forEach(el => {
            el.addEventListener('blur', (e) => {
                const blockId = e.target.closest('.sheet-block').dataset.blockId;
                const block = getBlockById(dashboard, blockId);
                if (block) {
                    block.content = e.target.innerHTML;
                    logChange(`Edited content in block: ${block.title}`);
                }
            });
        });

        container.querySelectorAll('.delete-block-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const blockId = e.target.closest('.sheet-block').dataset.blockId;
                if (confirm('Are you sure you want to delete this block?')) {
                    dashboard.blocks = dashboard.blocks.filter(b => b.id !== blockId);
                    logChange(`Deleted a block from ${dashboard.title}`);
                    renderDashboardSheet(dashboard);
                }
            });
        });
    }
}

function createSheetBlockHTML(block, isLocked) {
    return `
        <div class="sheet-block" data-block-id="${block.id}">
            <div class="block-title">${block.title}</div>
            <div class="block-content" ${!isLocked ? 'contenteditable="true"' : ''}>${block.content}</div>
            ${!isLocked ? '<button class="delete-block-btn" title="Delete Block">×</button>' : ''}
        </div>
    `;
}

function toggleDashboardPanel(show) {
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        appContainer.classList.toggle('dashboard-visible', show);
    }
}

function openDashboardSheet(dashboardId) {
    currentlyOpenDashboardId = dashboardId;
    const dashboard = getDashboardById(dashboardId);
    if (!dashboard) return;
    renderDashboardSheet(dashboard);
    document.getElementById('dashboard-panel-view').classList.remove('active');
    document.getElementById('dashboard-sheet-view').classList.add('active');
}

function closeDashboardSheet() {
    currentlyOpenDashboardId = null;
    document.getElementById('dashboard-sheet-view').classList.remove('active');
    document.getElementById('dashboard-panel-view').classList.add('active');
    renderDashboardList();
}

function toggleDashboardLock(dashboard) {
    dashboard.isLocked = !dashboard.isLocked;
    logChange(`Dashboard ${dashboard.title} is now ${dashboard.isLocked ? 'locked' : 'unlocked'}`);
    renderDashboardSheet(dashboard);
}

function initializeDashboardSortables() {
    const folders = document.querySelectorAll('#dashboard-list-container .folder-content');
    folders.forEach(folderEl => {
        new Sortable(folderEl, {
            group: 'dashboards',
            animation: 150,
            onEnd: (evt) => {
                const dashboard = getDashboardById(evt.item.dataset.id);
                if (dashboard) {
                    const newFolderId = evt.to.dataset.folderId;
                    dashboard.folderId = (newFolderId === 'null') ? null : newFolderId;
                    logChange(`Moved ${dashboard.title} to a new folder.`);
                }
            }
        });
    });
}

function initializeBlockSortable(dashboard) {
    const container = document.querySelector('#dashboard-sheet-view .sheet-content');
    if (!container) return;
    new Sortable(container, {
        animation: 150,
        handle: '.block-title',
        onEnd: (evt) => {
            const { oldIndex, newIndex } = evt;
            const [movedBlock] = dashboard.blocks.splice(oldIndex, 1);
            dashboard.blocks.splice(newIndex, 0, movedBlock);
            logChange(`Reordered blocks in ${dashboard.title}`);
        }
    });
}

function loadInitialDashboardData() {
    folders = [
        { id: 'folder1', name: '📂 Session Notes' },
        { id: 'folder2', name: '📂 Party Characters' }
    ];
    dashboards = [
        {
            id: 'd1', title: 'Turnden Forewit', description: 'Halfling rogue, good with locks.',
            emoji: '🧙‍♂️', folderId: 'folder1', isLocked: true,
            blocks: [
                { id: generateUniqueId(), type: 'header', title: '🔲 Block 1: Header', content: 'Halfling Rogue, Master of Locks' },
                { id: generateUniqueId(), type: 'stats', title: '🔲 Block 2: Stats Box', content: '🎲 AC: 15 🎯 HP: 24/28 ⚔️ Attack: +5 🧪 DEX +4 💭 INT +2' },
                { id: generateUniqueId(), type: 'notes', title: '𔲐 Block 3: Notes', content: '“Found a strange orb in the ruins.”<ul><li>Investigate with wizard</li><li>Check for traps next time</li></ul>' }
            ]
        },
        { id: 'd2', title: 'Lord Vareth', description: 'Ancient black dragon. Tricky.', emoji: '🐉', folderId: 'folder1', isLocked: true, blocks: [] },
        { id: 'd3', title: 'Seralyn the White', description: 'Elf cleric. Healing focus.', emoji: '🧝', folderId: 'folder2', isLocked: true, blocks: [] },
        { id: 'd4', title: 'The Crimson Fang', description: 'Vampire noble in disguise.', emoji: '🧛', folderId: null, isLocked: true, blocks: [] }
    ];
}