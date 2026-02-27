// ============================================================================
// Resource Tracker - Deck Edition
// ============================================================================

// State
let currentTurn = 1;
let resources = [];
let stats = [];

// Collections (persistent definitions)
let cardCollection = [];
let buffCollection = [];
let narrativeCollection = []; // Narrative triggers for story events

// Shown narratives (to avoid showing the same narrative twice)
let shownNarratives = [];

// Active instances (reset each game)
let activeCards = [];
let activeBuffs = [];

// UI State
let currentEditType = 'card'; // 'card' or 'buff' for deck editor
let isEditing = false;
let editingId = null;

const STORAGE_KEY = 'resourceTrackerState_v2';

// Animation counter for staggered log entries
let logAnimationCounter = 0;
let logAnimationTimer = null;

// ===== DOM Elements =====

// Main App
const mainApp = document.getElementById('mainApp');
const resourcesContainer = document.getElementById('resourcesContainer');
const statsContainer = document.getElementById('statsContainer');
const cardsContainer = document.getElementById('cardsContainer');
const buffsContainer = document.getElementById('buffsContainer');
const activityLog = document.getElementById('activityLog');
const turnValue = document.getElementById('turnValue');

// Deck Editor
const deckEditor = document.getElementById('deckEditor');
const deckEditorTitle = document.getElementById('deckEditorTitle');
const deckGrid = document.getElementById('deckGrid');
const deckEditContent = document.getElementById('deckEditContent');
const deckEditPlaceholder = document.getElementById('deckEditPlaceholder');
const deckEditTitle = document.getElementById('deckEditTitle');

// Bottom Edit Panel (for resources/stats)
const editPanel = document.getElementById('editPanel');
const editPanelTitle = document.getElementById('editPanelTitle');

// Form Inputs (Deck Editor)
const editIdInput = document.getElementById('editId');
const editTypeInput = document.getElementById('editType');
const resNameInput = document.getElementById('resName');
const resDescInput = document.getElementById('resDesc');
const triggerLogicSelect = document.getElementById('triggerLogic');
const triggerCustomGroup = document.getElementById('triggerCustomGroup');
const triggerCustomValueInput = document.getElementById('triggerCustomValue');
const triggerCustomTotalSpan = document.getElementById('triggerCustomTotal');
const triggerConditionsContainer = document.getElementById('triggerConditionsContainer');
const btnAddTriggerCondition = document.getElementById('btnAddTriggerCondition');
const durationSection = document.getElementById('durationSection');
const buffDurationInput = document.getElementById('buffDuration');
const buffOneTimeInput = document.getElementById('buffOneTime');
const cardCostsSection = document.getElementById('cardCostsSection');
const cardCostsContainer = document.getElementById('cardCostsContainer');
const btnAddCardCost = document.getElementById('btnAddCardCost');
const cardEffectsContainer = document.getElementById('cardEffectsContainer');
const buffEffectsContainer = document.getElementById('buffEffectsContainer');
const btnAddCardEffect = document.getElementById('btnAddCardEffect');
const btnAddBuffEffect = document.getElementById('btnAddBuffEffect');

// Form Inputs (Bottom Panel)
const resNameBottom = document.getElementById('resNameBottom');
const resT1Bottom = document.getElementById('resT1Bottom');
const resChangeBottom = document.getElementById('resChangeBottom');
const resMaxValueBottom = document.getElementById('resMaxValueBottom');
const resHardCapBottom = document.getElementById('resHardCapBottom');
const resMinValueBottom = document.getElementById('resMinValueBottom');
const resMinHardCapBottom = document.getElementById('resMinHardCapBottom');
const resResetEveryTurnBottom = document.getElementById('resResetEveryTurnBottom');
const resAllowNegativeBottom = document.getElementById('resAllowNegativeBottom');
const resColorLogicBottom = document.getElementById('resColorLogicBottom');
const resCyclicalBottom = document.getElementById('resCyclicalBottom');
const cyclicalEffectsContainer = document.getElementById('cyclicalEffectsContainer');
const btnAddCyclicalEffect = document.getElementById('btnAddCyclicalEffect');
const cyclicalEffectsSection = document.getElementById('cyclicalEffectsSection');

// Toast
const toast = document.getElementById('toast');

// ===== Initialization =====

document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupEventListeners();
    
    // Mark all loaded buffs as having their effects already applied
    // (since they were saved with their effects already in the stats)
    activeBuffs.forEach(buff => {
        buff._effectsApplied = true;
        // Ensure _appliedChanges exists for proper reversal
        if (!buff._appliedChanges) {
            buff._appliedChanges = [];
        }
    });
    
    // Render initial turn message if log is empty
    if (activityLog && activityLog.children.length === 0) {
        const roundName = getRoundLabel();
        const roundText = getRoundMessage();
        activityLog.innerHTML = `
            <div class="turn-message">
                <span class="turn-label">${roundName} <span class="turn-number">${currentTurn}</span></span>
                ${roundText ? `<span class="turn-text">${roundText}</span>` : ''}
            </div>
        `;
    }
    
    // Check buffs FIRST (so cards can reference buff states)
    checkAndActivateBuffs();
    // Then check cards (which might depend on buff states)
    checkAndActivateCards();
    // Check narratives for the current turn state
    checkAndDisplayNarratives();
    
    // Setup horizontal scroll for cards
    setupCardsHorizontalScroll();
    
    renderAll();
});

function setupEventListeners() {
    // Helper to safely add event listener
    const on = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };
    
    // Top bar
    on('btnResetSoft', 'click', resetTurn);
    on('btnReset', 'click', resetAll);
    on('btnEndTurn', 'click', endTurn);
    on('btnAddResource', 'click', () => openBottomPanel('resource'));
    on('btnExport', 'click', exportGameState);
    
    // Section buttons
    on('btnAddStat', 'click', () => openBottomPanel('stat'));
    on('btnAddCard', 'click', () => openDeckEditor('card'));
    on('btnAddBuff', 'click', () => openDeckEditor('buff'));
    on('btnAddNarrative', 'click', openNarrativeEditor);
    
    // Deck editor
    on('btnCloseDeckEditor', 'click', closeDeckEditor);
    on('btnAddToCollection', 'click', startAddNew);
    if (btnAddCardCost) btnAddCardCost.addEventListener('click', () => addCardCostRow());
    if (btnAddCardEffect) btnAddCardEffect.addEventListener('click', () => addCardEffectRow());
    if (btnAddBuffEffect) btnAddBuffEffect.addEventListener('click', () => addBuffEffectRow());
    if (btnAddTriggerCondition) btnAddTriggerCondition.addEventListener('click', () => addTriggerConditionRow());
    
    // Deck editor actions
    on('btnSave', 'click', saveItem);
    on('btnUpdate', 'click', updateItem);
    on('btnDelete', 'click', deleteItem);
    on('btnCancelEdit', 'click', cancelEdit);
    
    // Trigger logic change
    if (triggerLogicSelect) {
        triggerLogicSelect.addEventListener('change', (e) => {
            if (triggerCustomGroup) triggerCustomGroup.style.display = e.target.value === 'custom' ? 'flex' : 'none';
            updateTriggerCustomTotal();
        });
    }
    
    // Bottom panel
    on('btnCloseEditPanel', 'click', closeBottomPanel);
    on('btnCancelBottom', 'click', closeBottomPanel);
    on('btnSaveBottom', 'click', saveBottomItem);
    on('btnUpdateBottom', 'click', updateBottomItem);
    on('btnDeleteBottom', 'click', deleteBottomItem);
    
    // Show cyclical option when max value is set and hard cap is checked
    function updateCyclicalVisibility() {
        const cyclicalGroup = document.getElementById('cyclicalGroupBottom');
        const hasMaxValue = resMaxValueBottom?.value && parseFloat(resMaxValueBottom.value) > 0;
        const isHardCap = resHardCapBottom?.checked;
        
        if (cyclicalGroup) {
            cyclicalGroup.style.display = (hasMaxValue && isHardCap) ? 'flex' : 'none';
        }
        
        // Hide effects section if no longer valid
        if ((!hasMaxValue || !isHardCap) && cyclicalEffectsSection) {
            cyclicalEffectsSection.style.display = 'none';
            if (resCyclicalBottom) resCyclicalBottom.checked = false;
        }
    }
    
    // Show/hide min value row when Allow Negative is toggled
    function updateMinValueVisibility() {
        const minValueRow = document.getElementById('minValueRowBottom');
        if (minValueRow) {
            minValueRow.style.display = resAllowNegativeBottom?.checked ? 'flex' : 'none';
        }
    }
    
    if (resMaxValueBottom) {
        resMaxValueBottom.addEventListener('input', updateCyclicalVisibility);
    }
    if (resHardCapBottom) {
        resHardCapBottom.addEventListener('change', updateCyclicalVisibility);
    }
    if (resAllowNegativeBottom) {
        resAllowNegativeBottom.addEventListener('change', updateMinValueVisibility);
    }
    
    // Narrative Editor
    on('btnCloseNarrativeEditor', 'click', closeNarrativeEditor);
    on('btnAddToNarratives', 'click', startAddNewNarrative);
    on('btnSaveNarrative', 'click', saveNarrative);
    on('btnDeleteNarrative', 'click', deleteNarrative);
    on('btnCancelNarrative', 'click', cancelNarrativeEdit);
    on('btnAddNarrativeTrigger', 'click', () => addNarrativeTriggerRow());
    const narrativeTriggerLogic = document.getElementById('narrativeTriggerLogic');
    if (narrativeTriggerLogic) {
        narrativeTriggerLogic.addEventListener('change', (e) => {
            const customGroup = document.getElementById('narrativeTriggerCustomGroup');
            if (customGroup) customGroup.style.display = e.target.value === 'custom' ? 'flex' : 'none';
            updateNarrativeCustomTotal();
        });
    }
    
    // Settings
    on('btnSettings', 'click', openSettings);
    on('btnCloseSettings', 'click', closeSettings);
    
    // Card Album
    on('btnCloseCardAlbum', 'click', closeCardAlbum);
    const settingRoundName = document.getElementById('settingRoundName');
    const settingRoundText = document.getElementById('settingRoundText');
    if (settingRoundName) {
        settingRoundName.addEventListener('change', saveSettings);
        settingRoundName.addEventListener('blur', saveSettings);
    }
    if (settingRoundText) {
        settingRoundText.addEventListener('change', saveSettings);
        settingRoundText.addEventListener('blur', saveSettings);
    }
}

// ===== Deck Editor Functions =====

function openDeckEditor(type) {
    currentEditType = type;
    isEditing = false;
    editingId = null;
    
    deckEditorTitle.textContent = type === 'card' ? 'Card Collection' : 'Buff Collection';
    deckEditor.classList.add('visible');
    
    showDeckPlaceholder();
    renderDeckGrid();
}

function closeDeckEditor() {
    deckEditor.classList.remove('visible');
    isEditing = false;
    editingId = null;
}

function showDeckForm() {
    if (deckEditContent) deckEditContent.classList.add('visible');
    if (deckEditPlaceholder) deckEditPlaceholder.classList.add('hidden');
}

function showDeckPlaceholder() {
    if (deckEditContent) deckEditContent.classList.remove('visible');
    if (deckEditPlaceholder) deckEditPlaceholder.classList.remove('hidden');
}

function startAddNew() {
    isEditing = false;
    editingId = null;
    clearForm();
    
    if (deckEditTitle) deckEditTitle.textContent = `Add New ${currentEditType.charAt(0).toUpperCase() + currentEditType.slice(1)}`;
    const btnSave = document.getElementById('btnSave');
    const btnUpdate = document.getElementById('btnUpdate');
    const btnDelete = document.getElementById('btnDelete');
    if (btnSave) btnSave.style.display = 'block';
    if (btnUpdate) btnUpdate.style.display = 'none';
    if (btnDelete) btnDelete.style.display = 'none';
    
    // Show/hide appropriate sections
    if (durationSection) durationSection.style.display = currentEditType === 'buff' ? 'block' : 'none';
    if (cardCostsSection) cardCostsSection.style.display = currentEditType === 'card' ? 'block' : 'none';
    if (cardEffectsContainer) cardEffectsContainer.style.display = currentEditType === 'card' ? 'block' : 'none';
    if (btnAddCardEffect) btnAddCardEffect.style.display = currentEditType === 'card' ? 'block' : 'none';
    if (buffEffectsContainer) buffEffectsContainer.style.display = currentEditType === 'buff' ? 'block' : 'none';
    if (btnAddBuffEffect) btnAddBuffEffect.style.display = currentEditType === 'buff' ? 'block' : 'none';
    
    // Update dropdowns
    updateTriggerTargetDropdowns();
    if (currentEditType === 'buff') {
        updateBuffTargetDropdowns();
    } else if (currentEditType === 'card') {
        updateCardCostDropdowns();
    }
    
    showDeckForm();
}

function updateBuffTargetDropdowns() {
    // Refresh all buff target dropdowns with current resources/stats
    const resourceOptions = resources.map(r => `<option value="resource:${r.name}">${r.name}</option>`).join('');
    const statOptions = stats.map(s => `<option value="stat:${s.name}">${s.name}</option>`).join('');
    
    buffEffectsContainer.querySelectorAll('.buff-effect-target').forEach(select => {
        const currentValue = select.value;
        select.innerHTML = `
            <option value="">-- Target --</option>
            <optgroup label="Resources">${resourceOptions}</optgroup>
            <optgroup label="Stats">${statOptions}</optgroup>
        `;
        select.value = currentValue;
    });
    
    // Also refresh conditional target dropdowns
    buffEffectsContainer.querySelectorAll('.buff-cond-target').forEach(select => {
        const currentValue = select.value;
        select.innerHTML = `
            <option value="">-- Check --</option>
            <optgroup label="Resources">${resourceOptions}</optgroup>
            <optgroup label="Stats">${statOptions}</optgroup>
        `;
        select.value = currentValue;
    });
}

function updateCardCostDropdowns() {
    // Refresh all card cost dropdowns with current resources/stats
    const resourceOptions = resources.map(r => `<option value="resource:${r.name}">${r.name}</option>`).join('');
    const statOptions = stats.map(s => `<option value="stat:${s.name}">${s.name}</option>`).join('');
    
    cardCostsContainer.querySelectorAll('.card-cost-target').forEach(select => {
        const currentValue = select.value;
        select.innerHTML = `
            <option value="">-- Cost --</option>
            <optgroup label="Resources">${resourceOptions}</optgroup>
            <optgroup label="Stats">${statOptions}</optgroup>
        `;
        select.value = currentValue;
    });
}

function editDeckItem(id) {
    const collection = currentEditType === 'card' ? cardCollection : buffCollection;
    const item = collection.find(i => i.id === id);
    if (!item) return;
    
    isEditing = true;
    editingId = id;
    
    // Populate form
    editIdInput.value = id;
    resNameInput.value = item.name;
    resDescInput.value = item.description || '';
    
    // Populate triggers
    const trigger = item.trigger || { logic: 'all', customValue: 2, conditions: [{ type: 'turn', value: '1', target: '' }] };
    triggerLogicSelect.value = trigger.logic;
    triggerCustomGroup.style.display = trigger.logic === 'custom' ? 'flex' : 'none';
    triggerCustomValueInput.value = trigger.customValue || 2;
    
    triggerConditionsContainer.innerHTML = '';
    if (trigger.conditions && trigger.conditions.length > 0) {
        trigger.conditions.forEach(cond => addTriggerConditionRow(cond));
    } else {
        addTriggerConditionRow();
    }
    updateTriggerCustomTotal();
    
    if (currentEditType === 'card') {
        // Populate card costs
        cardCostsContainer.innerHTML = '';
        if (item.costs && item.costs.length > 0) {
            item.costs.forEach(cost => addCardCostRow(cost));
        } else {
            addCardCostRow();
        }
        
        // Populate card effects
        cardEffectsContainer.innerHTML = '';
        if (item.effects && item.effects.length > 0) {
            item.effects.forEach(effect => addCardEffectRow(effect));
        } else {
            addCardEffectRow();
        }
    } else {
        if (buffDurationInput) buffDurationInput.value = item.duration || 0;
        if (buffOneTimeInput) buffOneTimeInput.checked = item.oneTime || false;
        
        // Populate buff effects
        buffEffectsContainer.innerHTML = '';
        if (item.effects && item.effects.length > 0) {
            item.effects.forEach(effect => addBuffEffectRow(effect));
        } else {
            addBuffEffectRow();
        }
    }
    
    deckEditTitle.textContent = `Edit ${currentEditType.charAt(0).toUpperCase() + currentEditType.slice(1)}`;
    document.getElementById('btnSave').style.display = 'none';
    document.getElementById('btnUpdate').style.display = 'block';
    document.getElementById('btnDelete').style.display = 'block';
    
    // Show/hide sections
    durationSection.style.display = currentEditType === 'buff' ? 'block' : 'none';
    cardCostsSection.style.display = currentEditType === 'card' ? 'block' : 'none';
    cardEffectsContainer.style.display = currentEditType === 'card' ? 'block' : 'none';
    btnAddCardEffect.style.display = currentEditType === 'card' ? 'block' : 'none';
    buffEffectsContainer.style.display = currentEditType === 'buff' ? 'block' : 'none';
    btnAddBuffEffect.style.display = currentEditType === 'buff' ? 'block' : 'none';
    
    // Update dropdowns
    if (currentEditType === 'buff') {
        updateBuffTargetDropdowns();
    } else if (currentEditType === 'card') {
        updateCardCostDropdowns();
    }
    
    showDeckForm();
}

function renderDeckGrid() {
    const collection = currentEditType === 'card' ? cardCollection : buffCollection;
    deckGrid.innerHTML = '';
    
    if (collection.length === 0) {
        deckGrid.innerHTML = '<div class="empty-state">No items yet. Click "Add New" to create one.</div>';
        return;
    }
    
    collection.forEach(item => {
        const cardEl = document.createElement('div');
        
        // Determine card type for border accent
        let cardType = 'neutral';
        if (currentEditType === 'card') {
            const hasCost = item.costs?.some(c => c.value !== 0);
            const hasPositiveEffect = item.effects?.some(e => e.value > 0 && e.type !== 'clear_buff');
            if (hasCost) cardType = 'debuff';
            else if (hasPositiveEffect) cardType = 'buff';
        } else {
            // Buffs - check if mostly positive or negative
            const netEffect = item.effects?.reduce((sum, e) => sum + (e.value || 0), 0);
            if (netEffect > 0) cardType = 'buff';
            else if (netEffect < 0) cardType = 'debuff';
        }
        
        cardEl.className = `deck-card ${cardType}` + (editingId === item.id ? ' selected' : '');
        cardEl.onclick = () => editDeckItem(item.id);
        
        // Build stats HTML like action cards
        const statsHtml = [];
        
        // For cards: show costs and effects
        if (currentEditType === 'card') {
            // Costs - always negative (red)
            item.costs?.forEach(c => {
                const val = c.costType === 'percent' ? `${Math.abs(c.value)}%` : Math.abs(c.value);
                statsHtml.push(`<div class="deck-card-effect"><span class="effect-name">${escapeHtml(c.targetName)}</span><span class="effect-value negative">−${val}</span></div>`);
            });
            
            // Effects (non-clear)
            item.effects?.filter(e => e.type !== 'clear_buff').forEach(e => {
                const val = e.effectType === 'percent' ? `${Math.abs(e.value)}%` : Math.abs(e.value);
                const sign = e.value >= 0 ? '+' : '−';
                const colorClass = e.value > 0 ? 'positive' : (e.value < 0 ? 'negative' : 'neutral');
                statsHtml.push(`<div class="deck-card-effect"><span class="effect-name">${escapeHtml(e.targetName)}</span><span class="effect-value ${colorClass}">${sign}${val}</span></div>`);
            });
            
            // Clear buff effects
            item.effects?.filter(e => e.type === 'clear_buff').forEach(e => {
                statsHtml.push(`<div class="deck-card-effect"><span class="effect-name">Clear</span><span class="effect-value neutral">${escapeHtml(e.buffName)}</span></div>`);
            });
        } else {
            // For buffs: show effects
            item.effects?.forEach(e => {
                const val = e.effectType === 'percent' ? `${Math.abs(e.value)}%` : Math.abs(e.value);
                const sign = e.value >= 0 ? '+' : '−';
                const colorClass = e.value > 0 ? 'positive' : (e.value < 0 ? 'negative' : 'neutral');
                statsHtml.push(`<div class="deck-card-effect"><span class="effect-name">${escapeHtml(e.targetName)}</span><span class="effect-value ${colorClass}">${sign}${val}</span></div>`);
            });
        }
        
        cardEl.innerHTML = `
            <div class="deck-card-header">
                <span class="deck-card-name">${escapeHtml(item.name)}</span>
                <button class="deck-card-delete" onclick="deleteDeckItem(${item.id}, event)">&times;</button>
            </div>
            <div class="deck-card-body">
                <div class="deck-card-effects">${statsHtml.join('')}</div>
                <div class="deck-card-desc">${escapeHtml(item.description) || 'No description'}</div>
            </div>
        `;
        
        deckGrid.appendChild(cardEl);
    });
}

function deleteDeckItem(id, event) {
    if (event) event.stopPropagation();
    if (!confirm(`Delete this ${currentEditType}?`)) return;
    
    if (currentEditType === 'card') {
        cardCollection = cardCollection.filter(c => c.id !== id);
        activeCards = activeCards.filter(c => c.collectionId !== id);
    } else {
        buffCollection = buffCollection.filter(b => b.id !== id);
        activeBuffs = activeBuffs.filter(b => b.collectionId !== id);
    }
    
    if (editingId === id) {
        showDeckPlaceholder();
        isEditing = false;
        editingId = null;
    }
    
    saveState();
    renderDeckGrid();
    renderCards();
    renderBuffs();
    showToast(`${currentEditType} deleted`, 'success');
}

// ===== Form Functions =====

function clearForm() {
    if (resNameInput) resNameInput.value = '';
    if (resDescInput) resDescInput.value = '';
    if (triggerLogicSelect) triggerLogicSelect.value = 'all';
    if (triggerCustomGroup) triggerCustomGroup.style.display = 'none';
    if (triggerCustomValueInput) triggerCustomValueInput.value = '2';
    if (buffDurationInput) buffDurationInput.value = '0';
    if (buffOneTimeInput) buffOneTimeInput.checked = false;
    
    // Reset trigger conditions
    if (triggerConditionsContainer) {
        triggerConditionsContainer.innerHTML = '';
        addTriggerConditionRow();
    }
    
    // Reset cost rows
    if (cardCostsContainer) {
        cardCostsContainer.innerHTML = '';
        addCardCostRow();
    }
    
    // Reset effect rows
    if (cardEffectsContainer) {
        cardEffectsContainer.innerHTML = '';
        addCardEffectRow();
    }
    
    if (buffEffectsContainer) {
        buffEffectsContainer.innerHTML = '';
        addBuffEffectRow();
    }
}

// ===== SHARED EDITOR COMPONENTS =====

// Generate target options HTML for resources/stats/buffs
function generateTargetOptions(selectedTarget = '', filterType = null) {
    let html = '<option value="">-- Select --</option>';
    
    if (!filterType || filterType === 'resource') {
        const resourceOptions = resources.map(r => {
            const selected = selectedTarget === `resource:${r.name}` ? 'selected' : '';
            return `<option value="resource:${r.name}" ${selected}>${r.name}</option>`;
        }).join('');
        if (resourceOptions) html += `<optgroup label="Resources">${resourceOptions}</optgroup>`;
    }
    
    if (!filterType || filterType === 'stat') {
        const statOptions = stats.map(s => {
            const selected = selectedTarget === `stat:${s.name}` ? 'selected' : '';
            return `<option value="stat:${s.name}" ${selected}>${s.name}</option>`;
        }).join('');
        if (statOptions) html += `<optgroup label="Stats">${statOptions}</optgroup>`;
    }
    
    if (!filterType || filterType === 'buff') {
        const buffOptions = buffCollection.map(b => {
            const selected = selectedTarget === `buff:${b.name}` ? 'selected' : '';
            return `<option value="buff:${b.name}" ${selected}>${b.name}</option>`;
        }).join('');
        if (buffOptions) html += `<optgroup label="Buffs">${buffOptions}</optgroup>`;
    }
    
    return html;
}

// Create a unified trigger condition row
// conditionType: 'card', 'buff', or 'narrative'
function createTriggerConditionRow(existingCondition = null, conditionType = 'card') {
    const row = document.createElement('div');
    row.className = 'effect-row trigger-condition-row';
    row.dataset.conditionType = conditionType;
    
    const category = existingCondition?.category || 'turn'; // turn, resource, stat, buff
    const operator = existingCondition?.operator || '>=';
    const target = existingCondition?.target || '';
    const value = existingCondition?.value ?? '';
    
    // Determine visibility based on category
    const showTarget = category !== 'turn';
    const showValue = category !== 'buff';
    
    row.innerHTML = `
        <!-- Category: What are we checking? -->
        <div class="form-group" style="flex: 1;">
            <select class="trigger-category" onchange="updateTriggerConditionRow(this)">
                <option value="turn" ${category === 'turn' ? 'selected' : ''}>Turn</option>
                <option value="resource" ${category === 'resource' ? 'selected' : ''}>Resource</option>
                <option value="stat" ${category === 'stat' ? 'selected' : ''}>Stat</option>
                <option value="buff" ${category === 'buff' ? 'selected' : ''}>Buff</option>
            </select>
        </div>
        <!-- Target: Which one? (hidden for turn) -->
        <div class="form-group trigger-target-group" style="flex: 1; display: ${showTarget ? 'block' : 'none'};">
            <select class="trigger-target">
                ${category === 'resource' ? generateTargetOptions(target, 'resource') : 
                  category === 'stat' ? generateTargetOptions(target, 'stat') : 
                  category === 'buff' ? generateTargetOptions(target, 'buff') : 
                  generateTargetOptions()}
            </select>
        </div>
        <!-- Operator -->
        <div class="form-group trigger-operator-group" style="flex: 1;">
            <select class="trigger-operator">
                ${getOperatorOptions(category, operator)}
            </select>
        </div>
        <!-- Value (hidden for buff) -->
        <div class="form-group trigger-value-group" style="flex: 1; display: ${showValue ? 'block' : 'none'};">
            <input type="number" class="trigger-value" placeholder="1" step="0.01" value="${value}">
        </div>
        <button type="button" class="btn-remove-row" onclick="this.closest('.effect-row').remove(); updateTriggerCustomTotal();">&times;</button>
    `;
    
    return row;
}

// Get operator options based on category
function getOperatorOptions(category, selected = '>=') {
    const operators = {
        turn: [
            { value: '>=', label: '≥' },
            { value: '=', label: '=' },
            { value: '<=', label: '≤' }
        ],
        resource: [
            { value: '>=', label: '≥' },
            { value: '=', label: '=' },
            { value: '<=', label: '≤' }
        ],
        stat: [
            { value: '>=', label: '≥' },
            { value: '=', label: '=' },
            { value: '<=', label: '≤' }
        ],
        buff: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' }
        ]
    };
    
    const opts = operators[category] || operators.turn;
    return opts.map(o => `<option value="${o.value}" ${selected === o.value ? 'selected' : ''}>${o.label}</option>`).join('');
}

// Update trigger condition row when category changes
function updateTriggerConditionRow(select) {
    const row = select.closest('.trigger-condition-row');
    const category = select.value;
    const targetGroup = row.querySelector('.trigger-target-group');
    const operatorSelect = row.querySelector('.trigger-operator');
    const valueGroup = row.querySelector('.trigger-value-group');
    const targetSelect = row.querySelector('.trigger-target');
    
    // Show/hide target group
    targetGroup.style.display = category === 'turn' ? 'none' : 'block';
    valueGroup.style.display = category === 'buff' ? 'none' : 'block';
    
    // Update operator options
    operatorSelect.innerHTML = getOperatorOptions(category);
    
    // Update target options
    if (category !== 'turn') {
        targetSelect.innerHTML = generateTargetOptions('', category);
    }
}

// Legacy wrapper for card/buff editor
function addTriggerConditionRow(existingCondition = null) {
    // Convert legacy format to new format if needed
    const newFormatCondition = existingCondition ? legacyToNewTriggerFormat(existingCondition) : null;
    const row = createTriggerConditionRow(newFormatCondition, 'card');
    triggerConditionsContainer.appendChild(row);
    updateTriggerCustomTotal();
}

function updateTriggerTargetDropdowns() {
    const resourceOptions = resources.map(r => `<option value="resource:${r.name}">${r.name}</option>`).join('');
    const statOptions = stats.map(s => `<option value="stat:${s.name}">${s.name}</option>`).join('');
    const buffOptions = buffCollection.map(b => `<option value="buff:${b.name}">${b.name}</option>`).join('');
    
    triggerConditionsContainer.querySelectorAll('.trigger-target').forEach(select => {
        const currentValue = select.value;
        const categorySelect = select.closest('.trigger-condition-row')?.querySelector('.trigger-category');
        if (!categorySelect) return;
        
        const category = categorySelect.value;
        
        let html = '<option value="">-- Select --</option>';
        if (category === 'buff') {
            html += buffOptions ? `<optgroup label="Buffs">${buffOptions}</optgroup>` : '';
        } else if (category === 'resource') {
            html += resourceOptions ? `<optgroup label="Resources">${resourceOptions}</optgroup>` : '';
        } else if (category === 'stat') {
            html += statOptions ? `<optgroup label="Stats">${statOptions}</optgroup>` : '';
        } else {
            html += resourceOptions ? `<optgroup label="Resources">${resourceOptions}</optgroup>` : '';
            html += statOptions ? `<optgroup label="Stats">${statOptions}</optgroup>` : '';
            html += buffOptions ? `<optgroup label="Buffs">${buffOptions}</optgroup>` : '';
        }
        select.innerHTML = html;
        select.value = currentValue;
    });
}

function updateTriggerCustomTotal() {
    const count = triggerConditionsContainer.querySelectorAll('.trigger-condition-row').length;
    triggerCustomTotalSpan.textContent = count;
}

// Expose functions needed for inline event handlers
window.toggleCardEffectType = toggleCardEffectType;
window.updateTriggerCustomTotal = updateTriggerCustomTotal;
window.updateCyclicalTargetOptions = updateCyclicalTargetOptions;

function collectTriggers() {
    const conditions = [];
    triggerConditionsContainer.querySelectorAll('.trigger-condition-row').forEach(row => {
        const category = row.querySelector('.trigger-category')?.value;
        const operator = row.querySelector('.trigger-operator')?.value;
        const target = row.querySelector('.trigger-target')?.value || '';
        const value = row.querySelector('.trigger-value')?.value || '';
        
        if (!category) return;
        
        // Convert new format to legacy format for compatibility
        let type;
        if (category === 'turn') {
            type = operator === '<=' ? 'turn_lte' : (operator === '=' ? 'turn_eq' : 'turn');
        } else if (category === 'resource') {
            type = operator === '<=' ? 'resource_lte' : 'resource_gte';
        } else if (category === 'stat') {
            type = operator === '<=' ? 'stat_lte' : 'stat_gte';
        } else if (category === 'buff') {
            type = operator === 'inactive' ? 'buff_inactive' : 'buff_active';
        }
        
        conditions.push({ type, value, target });
    });
    
    return {
        logic: triggerLogicSelect.value,
        customValue: parseInt(triggerCustomValueInput.value) || 2,
        conditions
    };
}

// Convert legacy trigger format to new format for editing
function legacyToNewTriggerFormat(legacyCondition) {
    const { type, value, target } = legacyCondition;
    
    // Parse category and operator from legacy type
    let category, operator;
    
    if (type === 'turn' || type === 'turn_gte') {
        category = 'turn';
        operator = '>=';
    } else if (type === 'turn_lte') {
        category = 'turn';
        operator = '<=';
    } else if (type === 'turn_eq') {
        category = 'turn';
        operator = '=';
    } else if (type === 'resource_gte') {
        category = 'resource';
        operator = '>=';
    } else if (type === 'resource_lte') {
        category = 'resource';
        operator = '<=';
    } else if (type === 'stat_gte') {
        category = 'stat';
        operator = '>=';
    } else if (type === 'stat_lte') {
        category = 'stat';
        operator = '<=';
    } else if (type === 'buff_active') {
        category = 'buff';
        operator = 'active';
    } else if (type === 'buff_inactive') {
        category = 'buff';
        operator = 'inactive';
    } else {
        // Default fallback
        category = 'turn';
        operator = '>=';
    }
    
    return { category, operator, target, value };
}

function addCardCostRow(existingCost = null) {
    if (!cardCostsContainer) return;
    const row = document.createElement('div');
    row.className = 'effect-row card-cost-row';
    
    // Build options from resources and stats
    const resourceOptions = resources.map(r => 
        `<option value="resource:${r.name}" ${existingCost?.targetType === 'resource' && existingCost?.targetName === r.name ? 'selected' : ''}>${r.name}</option>`
    ).join('');
    const statOptions = stats.map(s => 
        `<option value="stat:${s.name}" ${existingCost?.targetType === 'stat' && existingCost?.targetName === s.name ? 'selected' : ''}>${s.name}</option>`
    ).join('');
    
    row.innerHTML = `
        <div class="form-group" style="flex: 2;">
            <select class="card-cost-target">
                <option value="">-- Cost --</option>
                <optgroup label="Resources">${resourceOptions}</optgroup>
                <optgroup label="Stats">${statOptions}</optgroup>
            </select>
        </div>
        <div class="form-group" style="flex: 1;">
            <select class="card-cost-type">
                <option value="flat" ${existingCost?.costType === 'flat' ? 'selected' : ''}>Flat</option>
                <option value="percent" ${existingCost?.costType === 'percent' ? 'selected' : ''}>%</option>
            </select>
        </div>
        <div class="form-group" style="flex: 1;">
            <input type="number" class="card-cost-value" placeholder="Val" step="0.01" value="${existingCost?.value || ''}">
        </div>
        <div class="form-group" style="flex: 1;">
            <input type="number" class="card-cost-duration" placeholder="Turns" min="0" value="${existingCost?.duration || 0}">
        </div>
        <button type="button" class="btn-remove-row" onclick="this.closest('.effect-row').remove()">&times;</button>
    `;
    cardCostsContainer.appendChild(row);
}

function addCardEffectRow(existingEffect = null) {
    if (!cardEffectsContainer) return;
    const row = document.createElement('div');
    row.className = 'effect-row card-effect-row';
    
    // Get buff options for the dropdown
    const buffOptions = activeBuffs.map(b => 
        `<option value="${b.name}" ${existingEffect?.buffName === b.name ? 'selected' : ''}>${b.name}</option>`
    ).join('');
    
    row.innerHTML = `
        <div class="form-group" style="flex: 1;">
            <select class="card-effect-type" onchange="toggleCardEffectType(this)">
                <option value="">-- Effect --</option>
                <option value="clear_buff" ${existingEffect?.type === 'clear_buff' ? 'selected' : ''}>Remove Buff</option>
            </select>
        </div>
        <div class="form-group card-buff-target-group" style="display: ${existingEffect?.type === 'clear_buff' ? 'block' : 'none'}; flex: 1;">
            <select class="card-buff-target">
                <option value="">-- Select Buff --</option>
                ${buffOptions}
            </select>
        </div>
        <button type="button" class="btn-remove-row" onclick="this.closest('.effect-row').remove()">&times;</button>
    `;
    cardEffectsContainer.appendChild(row);
}

function toggleCardEffectType(select) {
    const targetGroup = select.closest('.effect-row').querySelector('.card-buff-target-group');
    targetGroup.style.display = select.value === 'clear_buff' ? 'block' : 'none';
}

function addBuffEffectRow(existingEffect = null) {
    if (!buffEffectsContainer) return;
    const row = document.createElement('div');
    row.className = 'effect-row buff-effect-row';
    
    // Build options from resources and stats
    const resourceOptions = resources.map(r => 
        `<option value="resource:${r.name}" ${existingEffect?.targetType === 'resource' && existingEffect?.targetName === r.name ? 'selected' : ''}>${r.name}</option>`
    ).join('');
    const statOptions = stats.map(s => 
        `<option value="stat:${s.name}" ${existingEffect?.targetType === 'stat' && existingEffect?.targetName === s.name ? 'selected' : ''}>${s.name}</option>`
    ).join('');
    
    // Conditional target options
    const condTargetOptions = [...resources.map(r => `<option value="resource:${r.name}" ${existingEffect?.condition?.targetType === 'resource' && existingEffect?.condition?.targetName === r.name ? 'selected' : ''}>${r.name}</option>`),
                              ...stats.map(s => `<option value="stat:${s.name}" ${existingEffect?.condition?.targetType === 'stat' && existingEffect?.condition?.targetName === s.name ? 'selected' : ''}>${s.name}</option>`)].join('');
    
    const hasCondition = existingEffect?.condition?.enabled || false;
    
    row.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
            <!-- Main Effect Row -->
            <div style="display: flex; gap: 6px; align-items: flex-start;">
                <div class="form-group" style="flex: 2;">
                    <select class="buff-effect-target">
                        <option value="">-- Target --</option>
                        <optgroup label="Resources">${resourceOptions}</optgroup>
                        <optgroup label="Stats">${statOptions}</optgroup>
                    </select>
                </div>
                <div class="form-group" style="flex: 1;">
                    <select class="buff-effect-type">
                        <option value="flat" ${existingEffect?.effectType === 'flat' ? 'selected' : ''}>Flat</option>
                        <option value="percent" ${existingEffect?.effectType === 'percent' ? 'selected' : ''}>%</option>
                    </select>
                </div>
                <div class="form-group" style="flex: 1;">
                    <input type="number" class="buff-effect-value" placeholder="Val" step="0.01" value="${existingEffect?.value || ''}">
                </div>
                <div class="form-group" style="flex: 1;">
                    <select class="buff-effect-trigger">
                        <option value="immediate" ${existingEffect?.trigger === 'immediate' ? 'selected' : ''}>Now</option>
                        <option value="end_of_round" ${existingEffect?.trigger === 'end_of_round' ? 'selected' : ''}>End Turn</option>
                    </select>
                </div>
                <button type="button" class="btn-remove-row" onclick="this.closest('.effect-row').remove()">&times;</button>
            </div>
            
            <!-- Set as Base Toggle -->
            <label class="conditional-toggle" style="background: rgba(34, 197, 94, 0.1); border-color: #22c55e; color: #4ade80;">
                <input type="checkbox" class="buff-effect-setbase-toggle" ${existingEffect?.setBase ? 'checked' : ''}>
                <span>Set as new base value (buff doesn't compound)</span>
            </label>
            
            <!-- Conditional Toggle -->
            <label class="conditional-toggle">
                <input type="checkbox" class="buff-effect-conditional-toggle" ${hasCondition ? 'checked' : ''} onchange="toggleBuffConditional(this)">
                <span>Add "If" condition</span>
            </label>
            
            <!-- Conditional Section -->
            <div class="conditional-section ${hasCondition ? '' : 'hidden'}">
                <div class="conditional-label">Only apply if:</div>
                <div style="display: flex; gap: 6px; align-items: flex-start; flex-wrap: wrap;">
                    <div class="form-group" style="flex: 2; min-width: 80px;">
                        <select class="buff-cond-target">
                            <option value="">-- Check --</option>
                            <optgroup label="Resources">${resources.map(r => `<option value="resource:${r.name}" ${existingEffect?.condition?.targetType === 'resource' && existingEffect?.condition?.targetName === r.name ? 'selected' : ''}>${r.name}</option>`).join('')}</optgroup>
                            <optgroup label="Stats">${stats.map(s => `<option value="stat:${s.name}" ${existingEffect?.condition?.targetType === 'stat' && existingEffect?.condition?.targetName === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}</optgroup>
                        </select>
                    </div>
                    <div class="form-group" style="flex: 2; min-width: 100px;">
                        <select class="buff-cond-operator" onchange="updateBuffCondOperator(this)">
                            <option value="<" ${existingEffect?.condition?.operator === '<' ? 'selected' : ''}>Less than</option>
                            <option value=">" ${existingEffect?.condition?.operator === '>' ? 'selected' : ''}>Greater than</option>
                            <option value="=" ${existingEffect?.condition?.operator === '=' ? 'selected' : ''}>Equal to</option>
                            <option value="changes" ${existingEffect?.condition?.operator === 'changes' ? 'selected' : ''}>Changes by</option>
                        </select>
                    </div>
                    <div class="form-group buff-cond-value-group" style="flex: 1; min-width: 60px; ${existingEffect?.condition?.operator === 'changes' ? 'display:none;' : ''}">
                        <input type="number" class="buff-cond-value" placeholder="Value" step="0.01" value="${existingEffect?.condition?.value ?? ''}">
                    </div>
                    <div class="form-group buff-cond-change-group" style="flex: 1; min-width: 60px; ${existingEffect?.condition?.operator === 'changes' ? '' : 'display:none;'}">
                        <input type="number" class="buff-cond-change" placeholder="Change" step="0.01" value="${existingEffect?.condition?.change ?? ''}">
                    </div>
                </div>
            </div>
        </div>
    `;
    buffEffectsContainer.appendChild(row);
}

function toggleBuffConditional(checkbox) {
    const row = checkbox.closest('.effect-row');
    const condSection = row.querySelector('.conditional-section');
    condSection.classList.toggle('hidden', !checkbox.checked);
}

function updateBuffCondOperator(select) {
    const row = select.closest('.effect-row');
    const valueGroup = row.querySelector('.buff-cond-value-group');
    const changeGroup = row.querySelector('.buff-cond-change-group');
    const isChangeOperator = select.value === 'changes';
    
    // For "changes by" operator, we show the change input and hide the value input
    // For comparison operators (<, >, =), we show the value input and hide the change input
    valueGroup.style.display = isChangeOperator ? 'none' : 'block';
    changeGroup.style.display = isChangeOperator ? 'block' : 'none';
}

function cancelEdit() {
    showDeckPlaceholder();
    isEditing = false;
    editingId = null;
}

// ===== Save/Update Functions =====

function saveItem() {
    const name = resNameInput.value.trim();
    const description = resDescInput.value.trim();
    
    if (!name) {
        showToast('Please enter a name', 'error');
        return;
    }
    
    const item = {
        id: Date.now(),
        name,
        description,
        trigger: collectTriggers()
    };
    
    if (currentEditType === 'card') {
        item.costs = collectCardCosts();
        item.effects = collectCardEffects();
        cardCollection.push(item);
        
        // Activate if conditions met
        if (checkTriggerConditions(item.trigger)) {
            activateCardFromCollection(item);
        }
    } else {
        item.duration = parseInt(buffDurationInput.value) || 0;
        item.oneTime = buffOneTimeInput?.checked || false;
        item.effects = collectBuffEffects();
        buffCollection.push(item);
        
        // Activate if conditions met
        if (checkTriggerConditions(item.trigger)) {
            activateBuffFromCollection(item);
        }
    }
    
    saveState();
    renderDeckGrid();
    renderCards();
    renderBuffs();
    
    // Clear form for next
    clearForm();
    showToast(`${currentEditType} added!`, 'success');
}

function collectCardCosts() {
    const costs = [];
    cardCostsContainer.querySelectorAll('.card-cost-row').forEach(row => {
        const targetSelect = row.querySelector('.card-cost-target').value;
        const costType = row.querySelector('.card-cost-type').value;
        const value = parseFloat(row.querySelector('.card-cost-value').value) || 0;
        const duration = parseInt(row.querySelector('.card-cost-duration').value) || 0;
        
        if (targetSelect && value !== 0) {
            const [targetType, targetName] = targetSelect.split(':');
            costs.push({ targetType, targetName, costType, value, duration });
        }
    });
    return costs;
}

function updateItem() {
    if (!editingId) return;
    
    const name = resNameInput.value.trim();
    const description = resDescInput.value.trim();
    
    if (!name) {
        showToast('Please enter a name', 'error');
        return;
    }
    
    const collection = currentEditType === 'card' ? cardCollection : buffCollection;
    const item = collection.find(i => i.id === editingId);
    if (!item) return;
    
    item.name = name;
    item.description = description;
    item.trigger = collectTriggers();
    
    if (currentEditType === 'card') {
        item.costs = collectCardCosts();
        item.effects = collectCardEffects();
        
        // Update active instances
        activeCards.filter(c => c.collectionId === editingId).forEach(active => {
            active.name = name;
            active.description = description;
            active.trigger = JSON.parse(JSON.stringify(item.trigger));
            active.costs = JSON.parse(JSON.stringify(item.costs));
            active.effects = JSON.parse(JSON.stringify(item.effects));
        });
    } else {
        item.duration = parseInt(buffDurationInput.value) || 0;
        item.oneTime = buffOneTimeInput?.checked || false;
        item.effects = collectBuffEffects();
        
        activeBuffs.filter(b => b.collectionId === editingId).forEach(active => {
            active.name = name;
            active.description = description;
            active.effects = JSON.parse(JSON.stringify(item.effects));
        });
    }
    
    saveState();
    renderDeckGrid();
    renderCards();
    renderBuffs();
    showToast(`${currentEditType} updated!`, 'success');
}

function deleteItem() {
    if (!editingId) return;
    deleteDeckItem(editingId);
}

function collectCardEffects() {
    const effects = [];
    cardEffectsContainer.querySelectorAll('.card-effect-row').forEach(row => {
        const type = row.querySelector('.card-effect-type').value;
        if (!type) return;
        
        const effect = { type };
        if (type === 'clear_buff') {
            effect.buffName = row.querySelector('.card-buff-target')?.value || '';
        }
        effects.push(effect);
    });
    return effects;
}

function collectBuffEffects() {
    const effects = [];
    buffEffectsContainer.querySelectorAll('.buff-effect-row').forEach(row => {
        const targetSelect = row.querySelector('.buff-effect-target')?.value || '';
        const effectType = row.querySelector('.buff-effect-type')?.value || 'flat';
        const value = parseFloat(row.querySelector('.buff-effect-value')?.value) || 0;
        const trigger = row.querySelector('.buff-effect-trigger')?.value || 'immediate';
        const setBase = row.querySelector('.buff-effect-setbase-toggle')?.checked || false;
        
        // Collect conditional data
        const conditionalToggle = row.querySelector('.buff-effect-conditional-toggle');
        const hasCondition = conditionalToggle?.checked || false;
        
        let condition = null;
        if (hasCondition) {
            const condTargetSelect = row.querySelector('.buff-cond-target')?.value || '';
            const condOperator = row.querySelector('.buff-cond-operator')?.value || '=';
            const condValue = parseFloat(row.querySelector('.buff-cond-value')?.value) || 0;
            const condChange = parseFloat(row.querySelector('.buff-cond-change')?.value) || 0;
            
            if (condTargetSelect && condTargetSelect.includes(':')) {
                const [condTargetType, condTargetName] = condTargetSelect.split(':');
                condition = {
                    enabled: true,
                    targetType: condTargetType,
                    targetName: condTargetName,
                    operator: condOperator,
                    value: condValue,
                    change: condChange
                };
            }
        }
        
        if (targetSelect && targetSelect.includes(':')) {
            const [targetType, targetName] = targetSelect.split(':');
            if (targetType && targetName) {
                const effect = { targetType, targetName, effectType, value, trigger, setBase };
                if (condition) {
                    effect.condition = condition;
                }
                effects.push(effect);
            }
        }
    });
    return effects;
}

// ===== Bottom Panel (Resources/Stats) =====

let bottomEditType = 'resource';
let bottomEditingId = null;

function openBottomPanel(type, editId = null) {
    bottomEditType = type;
    bottomEditingId = editId;
    
    if (editPanelTitle) editPanelTitle.textContent = editId ? `Edit ${type}` : `Add ${type}`;
    const btnSaveBottom = document.getElementById('btnSaveBottom');
    const btnUpdateBottom = document.getElementById('btnUpdateBottom');
    const btnDeleteBottom = document.getElementById('btnDeleteBottom');
    if (btnSaveBottom) btnSaveBottom.style.display = editId ? 'none' : 'block';
    if (btnUpdateBottom) btnUpdateBottom.style.display = editId ? 'block' : 'none';
    if (btnDeleteBottom) btnDeleteBottom.style.display = editId ? 'block' : 'none';
    
    // Show/hide resource-specific options
    const maxValueGroup = document.getElementById('resMaxValueBottom')?.parentElement;
    const hardCapCheckbox = document.getElementById('resHardCapBottom')?.parentElement;
    const minValueRow = document.getElementById('minValueRowBottom');
    const cyclicalGroup = document.getElementById('cyclicalGroupBottom');
    
    if (type === 'resource') {
        if (maxValueGroup) maxValueGroup.style.display = 'flex';
        if (hardCapCheckbox) hardCapCheckbox.style.display = 'flex';
        if (cyclicalGroup) cyclicalGroup.style.display = (resMaxValueBottom?.value > 0 && resHardCapBottom?.checked) ? 'flex' : 'none';
        // Min value row shown based on allow negative
        if (minValueRow) minValueRow.style.display = resAllowNegativeBottom?.checked ? 'flex' : 'none';
    } else {
        // Stats don't have max value/hard cap/min value
        if (maxValueGroup) maxValueGroup.style.display = 'none';
        if (hardCapCheckbox) hardCapCheckbox.style.display = 'none';
        if (minValueRow) minValueRow.style.display = 'none';
        if (cyclicalGroup) cyclicalGroup.style.display = 'none';
    }
    
    // Setup cyclical effects section
    if (type === 'resource') {
        if (cyclicalEffectsSection) cyclicalEffectsSection.style.display = 'none';
        if (cyclicalEffectsContainer) cyclicalEffectsContainer.innerHTML = '';
        
        if (resCyclicalBottom) {
            resCyclicalBottom.onchange = (e) => {
                if (cyclicalEffectsSection) {
                    cyclicalEffectsSection.style.display = e.target.checked ? 'block' : 'none';
                }
            };
        }
        
        if (btnAddCyclicalEffect) {
            btnAddCyclicalEffect.onclick = () => addCyclicalEffectRow();
        }
    }
    
    if (editId) {
        const item = type === 'resource' 
            ? resources.find(r => r.id === editId)
            : stats.find(s => s.id === editId);
        if (item) {
            if (resNameBottom) resNameBottom.value = item.name;
            if (resT1Bottom) resT1Bottom.value = item.baseValue;
            if (resChangeBottom) resChangeBottom.value = item.changePerRound || 0;
            // Max Value and Hard Cap
            const maxValue = item.maxValue !== undefined ? item.maxValue :
                             (item.hardCap !== null && item.hardCap !== undefined ? item.hardCap : 
                              (item.softCap !== null && item.softCap !== undefined ? item.softCap : ''));
            if (resMaxValueBottom) resMaxValueBottom.value = maxValue;
            if (resHardCapBottom) resHardCapBottom.checked = item.isHardCap !== undefined ? item.isHardCap : (item.hardCap !== null && item.hardCap !== undefined);
            
            // Min Value and Hard Floor
            const minValue = item.minValue !== undefined ? item.minValue : '';
            if (resMinValueBottom) resMinValueBottom.value = minValue;
            if (resMinHardCapBottom) resMinHardCapBottom.checked = item.isMinHardCap || false;
            if (resResetEveryTurnBottom) resResetEveryTurnBottom.checked = item.resetEveryTurn || false;
            if (resAllowNegativeBottom) resAllowNegativeBottom.checked = item.allowNegative || false;
            if (resColorLogicBottom) resColorLogicBottom.value = item.colorLogic || 'default';
            if (resCyclicalBottom) {
                resCyclicalBottom.checked = item.cyclical || false;
                if (cyclicalEffectsSection) {
                    cyclicalEffectsSection.style.display = item.cyclical ? 'block' : 'none';
                }
            }
            // Populate cyclical effects
            if (cyclicalEffectsContainer && item.cyclicalEffects) {
                cyclicalEffectsContainer.innerHTML = '';
                item.cyclicalEffects.forEach(effect => addCyclicalEffectRow(effect));
            }
        }
    } else {
        if (resNameBottom) resNameBottom.value = '';
        if (resT1Bottom) resT1Bottom.value = '';
        if (resChangeBottom) resChangeBottom.value = '';
        if (resMaxValueBottom) resMaxValueBottom.value = '';
        if (resHardCapBottom) resHardCapBottom.checked = false;
        if (resMinValueBottom) resMinValueBottom.value = '';
        if (resMinHardCapBottom) resMinHardCapBottom.checked = false;
        if (resResetEveryTurnBottom) resResetEveryTurnBottom.checked = false;
        if (resAllowNegativeBottom) resAllowNegativeBottom.checked = false;
        if (resColorLogicBottom) resColorLogicBottom.value = 'default';
        if (resCyclicalBottom) resCyclicalBottom.checked = false;
        if (cyclicalEffectsContainer) cyclicalEffectsContainer.innerHTML = '';
        if (cyclicalEffectsSection) cyclicalEffectsSection.style.display = 'none';
    }
    
    if (editPanel) editPanel.classList.add('visible');
    
    // Re-render to add click handlers and drag functionality for editing
    renderResources();
    renderStats();
}

function closeBottomPanel() {
    editPanel.classList.remove('visible');
    bottomEditingId = null;
    // Re-render to remove click handlers and drag functionality
    renderResources();
    renderStats();
}

function saveBottomItem() {
    const name = resNameBottom.value.trim();
    if (!name) {
        showToast('Please enter a name', 'error');
        return;
    }
    
    const item = createResourceStatItem();
    
    if (bottomEditType === 'resource') {
        resources.push(item);
    } else {
        stats.push(item);
    }
    
    saveState();
    renderAll();
    closeBottomPanel();
    showToast(`${bottomEditType} added!`, 'success');
}

function updateBottomItem() {
    if (!bottomEditingId) return;
    
    const item = bottomEditType === 'resource'
        ? resources.find(r => r.id === bottomEditingId)
        : stats.find(s => s.id === bottomEditingId);
    
    if (!item) return;
    
    const updated = createResourceStatItem();
    Object.assign(item, updated);
    
    saveState();
    renderAll();
    closeBottomPanel();
    showToast(`${bottomEditType} updated!`, 'success');
}

function deleteBottomItem() {
    if (!bottomEditingId) return;
    
    if (bottomEditType === 'resource') {
        resources = resources.filter(r => r.id !== bottomEditingId);
    } else {
        stats = stats.filter(s => s.id !== bottomEditingId);
    }
    
    saveState();
    renderAll();
    closeBottomPanel();
    showToast(`${bottomEditType} deleted!`, 'success');
}

function createResourceStatItem() {
    return {
        id: Date.now(),
        name: resNameBottom.value.trim(),
        baseValue: parseFloat(resT1Bottom.value) || 0,
        currentValue: parseFloat(resT1Bottom.value) || 0,
        changePerRound: parseFloat(resChangeBottom.value) || 0,
        maxValue: resMaxValueBottom?.value === '' ? null : parseFloat(resMaxValueBottom?.value || 0),
        isHardCap: resHardCapBottom?.checked || false,
        minValue: resAllowNegativeBottom?.checked && resMinValueBottom?.value !== '' ? parseFloat(resMinValueBottom.value) : null,
        isMinHardCap: resAllowNegativeBottom?.checked && resMinHardCapBottom?.checked || false,
        resetEveryTurn: resResetEveryTurnBottom.checked,
        allowNegative: resAllowNegativeBottom.checked,
        colorLogic: resColorLogicBottom?.value || 'default',
        cyclical: resCyclicalBottom?.checked || false,
        cyclicalEffects: collectCyclicalEffects()
    };
}

function collectCyclicalEffects() {
    const effects = [];
    const rows = cyclicalEffectsContainer?.querySelectorAll('.cyclical-effect-row') || [];
    rows.forEach(row => {
        const targetType = row.querySelector('.effect-target-type')?.value;
        const targetName = row.querySelector('.effect-target-name')?.value;
        const changeType = row.querySelector('.effect-change-type')?.value || 'flat';
        const value = parseFloat(row.querySelector('.effect-value')?.value) || 0;
        const narrativeTitle = row.querySelector('.effect-narrative-title')?.value?.trim();
        const narrativeDesc = row.querySelector('.effect-narrative-desc')?.value?.trim();
        const showInNarrative = row.querySelector('.effect-show-in-narrative')?.checked !== false;
        
        if (targetName && value !== 0) {
            effects.push({ targetType, targetName, changeType, value, narrativeTitle, narrativeDesc, showInNarrative });
        }
    });
    return effects;
}

function addCyclicalEffectRow(existingEffect = null) {
    if (!cyclicalEffectsContainer) return;
    
    const row = document.createElement('div');
    row.className = 'effect-row cyclical-effect-row';
    
    // Build target options
    const resourceOptions = resources.map(r => 
        `<option value="${escapeHtml(r.name)}" ${existingEffect?.targetType === 'resource' && existingEffect?.targetName === r.name ? 'selected' : ''}>${escapeHtml(r.name)}</option>`
    ).join('');
    const statOptions = stats.map(s => 
        `<option value="${escapeHtml(s.name)}" ${existingEffect?.targetType === 'stat' && existingEffect?.targetName === s.name ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
    ).join('');
    
    row.innerHTML = `
        <div style="display: flex; gap: 8px; margin-bottom: 10px; align-items: flex-start;">
            <div class="form-group" style="flex: 1;">
                <select class="effect-target-type" onchange="updateCyclicalTargetOptions(this)">
                    <option value="resource" ${existingEffect?.targetType === 'resource' ? 'selected' : ''}>Resource</option>
                    <option value="stat" ${existingEffect?.targetType === 'stat' ? 'selected' : ''}>Stat</option>
                </select>
            </div>
            <div class="form-group" style="flex: 2;">
                <select class="effect-target-name">
                    <optgroup label="Resources">${resourceOptions}</optgroup>
                    <optgroup label="Stats">${statOptions}</optgroup>
                </select>
            </div>
            <div class="form-group" style="flex: 1;">
                <select class="effect-change-type">
                    <option value="flat" ${existingEffect?.changeType === 'flat' ? 'selected' : ''}>Flat</option>
                    <option value="percent" ${existingEffect?.changeType === 'percent' ? 'selected' : ''}>%</option>
                </select>
            </div>
            <div class="form-group" style="flex: 1;">
                <input type="number" class="effect-value" placeholder="Value" step="0.1" value="${existingEffect?.value || ''}">
            </div>
            <button type="button" class="btn-remove-row" onclick="this.closest('.cyclical-effect-row').remove()">×</button>
        </div>
        <div class="form-group" style="margin-bottom: 8px;">
            <input type="text" class="effect-narrative-title" placeholder="Narrative title (e.g., 'Another Month Passes')" value="${escapeHtml(existingEffect?.narrativeTitle || '')}" style="width: 100%;">
        </div>
        <div class="form-group" style="margin-bottom: 8px;">
            <textarea class="effect-narrative-desc" placeholder="Narrative description (shown in body)" rows="2" style="width: 100%; resize: vertical;">${escapeHtml(existingEffect?.narrativeDesc || '')}</textarea>
        </div>
        <div class="form-group checkbox-group">
            <label class="checkbox-label">
                <input type="checkbox" class="effect-show-in-narrative" ${existingEffect?.showInNarrative !== false ? 'checked' : ''}>
                <span>Show value in description</span>
            </label>
        </div>
    `;
    
    cyclicalEffectsContainer.appendChild(row);
}

function updateCyclicalTargetOptions(select) {
    const row = select.closest('.cyclical-effect-row');
    const targetNameSelect = row.querySelector('.effect-target-name');
    const type = select.value;
    
    let options = '<option value="">-- Select --</option>';
    if (type === 'resource') {
        options += resources.map(r => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join('');
    } else {
        options += stats.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
    }
    targetNameSelect.innerHTML = options;
}

// ===== Game Logic =====

function playCard(card) {
    // Check costs - immediate costs only
    const canAfford = checkCardCosts(card);
    if (!canAfford) {
        showToast(`Cannot afford to play this card!`, 'error');
        return;
    }
    
    // Apply immediate costs
    applyCardCosts(card);
    
    addLogEntry('action', `Played ${card.name}`);
    
    // Create duration-based costs as buffs (negative effects on player)
    applyDurationCosts(card);
    
    // Apply effects
    let buffWasRemoved = false;
    if (card.effects) {
        card.effects.forEach(effect => {
            if (effect.type === 'clear_buff') {
                const idx = activeBuffs.findIndex(b => b.name === effect.buffName);
                if (idx !== -1) {
                    const buff = activeBuffs[idx];
                    const name = buff.name;
                    const buffDef = buffCollection.find(b => b.id === buff.collectionId);
                    if (buffDef) {
                        // Mark as removed this turn - it can come back next turn if conditions are met
                        buffDef._removedOnTurn = currentTurn;
                    }
                    
                    // Reverse the immediate effects of this buff
                    reverseBuffEffects(buff);
                    
                    activeBuffs.splice(idx, 1);
                    buffWasRemoved = true;
                    
                    // Mark as manually removed (won't re-activate until reset)
                    if (buffDef) {
                        buffDef._manuallyRemoved = true;
                    }
                    
                    // Buff ending is already logged by reverseBuffEffects
                }
            }
        });
    }
    
    // Mark this card as played this turn (so it doesn't immediately reappear)
    const cardDef = cardCollection.find(c => c.id === card.collectionId);
    if (cardDef) {
        cardDef._removedOnTurn = currentTurn;
    }
    
    // Remove from active cards (vanish)
    const idx = activeCards.findIndex(c => c.id === card.id);
    if (idx !== -1) {
        activeCards.splice(idx, 1);
    }
    
    // Re-check triggers immediately - cards might become available/unavailable based on buff changes
    checkAndActivateCards();
    checkAndActivateBuffs();
    
    saveState();
    renderAll();
}

function reverseBuffEffects(buff) {
    addLogEntry('buff', `${buff.name} ended`);
    
    // Use stored changes if available (for accurate reversal)
    if (buff._appliedChanges && buff._appliedChanges.length > 0) {
        buff._appliedChanges.forEach(changeInfo => {
            const targetArray = changeInfo.targetType === 'resource' ? resources : stats;
            const target = targetArray.find(t => t.name === changeInfo.targetName);
            
            if (target) {
                // Reverse the exact change that was applied
                const changeToReverse = changeInfo.change;
                const oldValue = target.currentValue;
                target.currentValue -= changeToReverse;  // Subtract the original change
                applyCaps(target);
                
                const actualChange = target.currentValue - oldValue;
                logChange(changeInfo.targetType, changeInfo.targetName, actualChange, `reversed from ${buff.name}`);
            }
        });
    } else {
        // Fallback: calculate from effects (less accurate for percentages)
        if (!buff.effects) return;
        
        buff.effects.forEach(effect => {
            if (effect.trigger === 'immediate') {
                const targetArray = effect.targetType === 'resource' ? resources : stats;
                const target = targetArray.find(t => t.name === effect.targetName);
                
                if (target) {
                    // For reversal, apply the opposite effect
                    let change = effect.value;
                    if (effect.effectType === 'percent') {
                        change = target.currentValue * (effect.value / 100);
                    }
                    
                    const oldValue = target.currentValue;
                    target.currentValue -= change;
                    applyCaps(target);
                    
                    const actualChange = target.currentValue - oldValue;
                    logChange(effect.targetType, effect.targetName, actualChange, `reversed from ${buff.name}`);
                }
            }
        });
    }
}

function checkCardCosts(card) {
    if (!card.costs || card.costs.length === 0) return true;
    
    for (const cost of card.costs) {
        if (cost.duration > 0) continue; // Skip duration costs for now
        
        const targetArray = cost.targetType === 'resource' ? resources : stats;
        const target = targetArray.find(t => t.name === cost.targetName);
        if (!target) return false;
        
        // Costs always reduce the resource, so use absolute value
        let actualCost = Math.abs(cost.value);
        if (cost.costType === 'percent') {
            actualCost = target.currentValue * (Math.abs(cost.value) / 100);
        }
        
        // Check if would go negative (unless allowed)
        if (cost.targetType === 'resource' && !target.allowNegative && target.currentValue < actualCost) {
            return false;
        }
        if (cost.targetType === 'stat' && target.currentValue < actualCost) {
            return false; // Stats typically shouldn't go negative
        }
    }
    return true;
}

function applyCardCosts(card) {
    if (!card.costs) return;
    
    card.costs.forEach(cost => {
        if (cost.duration > 0) return; // Skip duration costs - they become buffs
        
        const targetArray = cost.targetType === 'resource' ? resources : stats;
        const target = targetArray.find(t => t.name === cost.targetName);
        if (!target) return;
        
        // Costs always reduce the resource, so use absolute value
        let actualCost = Math.abs(cost.value);
        
        if (cost.costType === 'percent') {
            actualCost = target.currentValue * (Math.abs(cost.value) / 100);
        }
        
        target.currentValue -= actualCost;
        applyCaps(target);
    });
}

function applyDurationCosts(card) {
    if (!card.costs) return;
    
    card.costs.forEach(cost => {
        if (cost.duration === 0) return; // Skip immediate costs
        
        // Create a "debuff" for duration costs (negative effect on player)
        const debuffName = `${card.name}: Cost`;
        const existingDebuff = activeBuffs.find(b => b.name === debuffName && b.fromCard === card.id);
        
        if (!existingDebuff) {
            activeBuffs.push({
                id: Date.now() + Math.random(),
                collectionId: null,
                name: debuffName,
                description: `Cost from playing ${card.name}`,
                effects: [{
                    targetType: cost.targetType,
                    targetName: cost.targetName,
                    effectType: cost.costType,
                    value: -Math.abs(cost.value), // Always negative because it's a cost
                    trigger: 'end_of_round'
                }],
                duration: cost.duration,
                currentValue: cost.duration,
                fromCard: card.id
            });
            addLogEntry('buff', `${card.name} cost: ${cost.duration} turns`);
        }
    });
}

function addLogEntry(type, title, detail = '') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = title;
    
    // Staggered animation - entries appear one by one
    entry.style.animationDelay = `${logAnimationCounter * 0.08}s`;
    entry.style.opacity = '0'; // Start hidden, animation will reveal
    logAnimationCounter++;
    clearTimeout(logAnimationTimer);
    logAnimationTimer = setTimeout(() => { logAnimationCounter = 0; }, 500);
    
    activityLog.prepend(entry);
}

// Helper function to determine if a change is "good" for a resource/stat
function isChangeGood(targetType, targetName, changeValue) {
    const targetArray = targetType === 'resource' ? resources : stats;
    const target = targetArray.find(t => t.name === targetName);
    if (!target) return changeValue > 0; // Default: positive is good
    
    // Handle colorLogic setting
    const colorLogic = target.colorLogic || 'default';
    if (colorLogic === 'neutral') {
        return null; // Neutral - no good/bad coloring
    }
    if (colorLogic === 'negative_is_good') {
        return changeValue < 0;
    }
    return changeValue > 0;
}

// Helper to format change with color class
function formatChange(change, isGood) {
    const sign = change > 0 ? '+' : '';
    const value = parseFloat(change.toFixed(2));
    return { sign, value, className: isGood ? 'change-good' : 'change-bad' };
}

// Helper functions for colored logging
function logCardAction(cardName, detail = '') {
    addLogEntry('action', cardName);
}

function logBuffEffect(buffName, detail = '') {
    addLogEntry('buff', buffName);
}

function logChange(targetType, targetName, change, source = '', neutral = false) {
    const isGood = neutral ? null : isChangeGood(targetType, targetName, change);
    const { sign, value } = formatChange(change, isGood);
    const logType = targetType === 'resource' ? 'resource-change' : 'stat-change';
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${logType}`;
    
    // Neutral forces white color, otherwise use good/bad coloring
    const className = neutral ? 'change-neutral' : (isGood ? 'change-good' : 'change-bad');
    
    // Compact: Name Value
    entry.innerHTML = `${targetName} <span class="${className}">${sign}${value}</span>`;
    
    // Staggered animation - entries appear one by one
    entry.style.animationDelay = `${logAnimationCounter * 0.08}s`;
    entry.style.opacity = '0'; // Start hidden, animation will reveal
    logAnimationCounter++;
    clearTimeout(logAnimationTimer);
    logAnimationTimer = setTimeout(() => { logAnimationCounter = 0; }, 500);
    
    activityLog.prepend(entry);
}

function logResourceReset(resourceName, resetValue, colorLogic) {
    const entry = document.createElement('div');
    entry.className = 'log-entry resource-change';
    
    // Only the value gets colored based on colorLogic
    // The text "reset to" stays default color
    const isNeutral = colorLogic === 'neutral';
    const valueClass = isNeutral ? 'change-neutral' : 'change-good';
    
    entry.innerHTML = `${resourceName} reset to <span class="${valueClass}">${resetValue}</span>`;
    
    // Staggered animation
    entry.style.animationDelay = `${logAnimationCounter * 0.08}s`;
    entry.style.opacity = '0';
    logAnimationCounter++;
    clearTimeout(logAnimationTimer);
    logAnimationTimer = setTimeout(() => { logAnimationCounter = 0; }, 500);
    
    activityLog.prepend(entry);
}

// ===== Turn Functions =====

function endTurn() {
    // Save current values as "previous" for gains/loses condition checks
    // This must happen before applying buff effects so conditions check against previous turn
    resources.forEach(r => { r._prevValue = r.currentValue; });
    stats.forEach(s => { s._prevValue = s.currentValue; });
    
    // Increment turn FIRST (before clearing markers)
    currentTurn++;
    turnValue.textContent = currentTurn;
    
    // Decrement buff durations and remove expired
    activeBuffs = activeBuffs.filter(buff => {
        if (buff.duration !== undefined && buff.duration > 0 && buff.currentValue !== undefined) {
            buff.currentValue--;
            if (buff.currentValue <= 0) {
                addLogEntry('buff', `${buff.name} expired`);
                reverseBuffEffects(buff);
                return false;
            }
        }
        return true;
    });
    
    // Clear turn-based removal markers (but keep manual removal markers)
    // Cards removed this turn can come back next turn if conditions change
    cardCollection.forEach(c => {
        if (c._removedOnTurn && c._removedOnTurn < currentTurn) {
            delete c._removedOnTurn;
        }
    });
    // Note: _manuallyRemoved on buffs is NOT cleared here - only on reset
    
    // Turn message
    const turnMsg = document.createElement('div');
    turnMsg.className = 'turn-message';
    const roundName = getRoundLabel();
    const roundText = getRoundMessage();
    turnMsg.innerHTML = `
        <span class="turn-label">${roundName} <span class="turn-number">${currentTurn}</span></span>
        ${roundText ? `<span class="turn-text">${roundText}</span>` : ''}
    `;
    // Animation delay
    turnMsg.style.animationDelay = '0s';
    
    activityLog.prepend(turnMsg);
    
    // Apply natural changes
    resources.forEach(r => {
        if (r.resetEveryTurn) {
            r.currentValue = r.baseValue;
        } else if (r.changePerRound !== 0) {
            applyNaturalChange(r);
        }
    });
    
    // Handle cyclical resources BEFORE applying caps
    // This allows resources to exceed caps temporarily and trigger cascades
    handleCyclicalResources();
    
    // Now apply caps to non-cyclical resources
    resources.forEach(r => {
        if (!r.cyclical) {
            applyCaps(r);
        }
    });
    
    stats.forEach(s => {
        if (s.resetEveryTurn) {
            s.currentValue = s.baseValue;
        } else if (s.changePerRound !== 0) {
            applyNaturalChange(s);
        }
        applyCaps(s);
    });
    
    // Apply end of round buff effects AFTER natural changes
    // This allows conditions to check if resources changed this turn
    applyBuffEffects('end_of_round');
    
    // Reapply immediate buff effects after resource resets
    // (buffs with immediate effects need to reapply after their target resources reset)
    let reappliedAny = false;
    activeBuffs.forEach(buff => {
        if (!buff.effects) return;
        buff.effects.forEach(effect => {
            if (effect.trigger === 'immediate') {
                const targetArray = effect.targetType === 'resource' ? resources : stats;
                const target = targetArray.find(t => t.name === effect.targetName);
                if (target) {
                    let change = effect.value;
                    if (effect.effectType === 'percent') {
                        change = target.currentValue * (effect.value / 100);
                    }
                    const oldValue = target.currentValue;
                    target.currentValue += change;
                    applyCaps(target);
                    
                    const actualChange = target.currentValue - oldValue;
                    if (Math.abs(actualChange) > 0.01) {
                        reappliedAny = true;
                        logChange(effect.targetType, effect.targetName, actualChange, buff.name);
                    }
                }
            }
        });
    });
    
    // START OF TURN: Check if active cards should still be available
    // Remove cards whose trigger conditions are no longer met
    const cardsToRemove = activeCards.filter(card => {
        const cardDef = cardCollection.find(c => c.id === card.collectionId);
        return cardDef && !checkTriggerConditions(cardDef.trigger);
    });
    cardsToRemove.forEach(card => {
        const idx = activeCards.findIndex(c => c.id === card.id);
        if (idx !== -1) {
            activeCards.splice(idx, 1);
            addLogEntry('action', `${card.name} unavailable`);
        }
    });
    
    // Check for newly activatable buffs/cards
    checkAndActivateBuffs();
    checkAndActivateCards();
    
    // Check for narrative triggers
    checkAndDisplayNarratives();
    
    saveState();
    renderAll();
}

function applyNaturalChange(item) {
    const newValue = item.currentValue + item.changePerRound;
    // Use maxValue as soft cap if not a hard cap and not cyclical
    const maxValue = item.maxValue !== undefined ? item.maxValue : item.softCap;
    const isHardCap = item.isHardCap !== undefined ? item.isHardCap : (item.hardCap !== null && item.hardCap !== undefined);
    
    if (maxValue !== null && maxValue !== undefined && !isHardCap && !item.cyclical) {
        // Soft cap behavior - gently push toward cap
        if (item.changePerRound > 0 && item.currentValue < maxValue) {
            item.currentValue = Math.min(newValue, maxValue);
        } else if (item.changePerRound < 0 && item.currentValue > maxValue) {
            item.currentValue = Math.max(newValue, maxValue);
        } else {
            item.currentValue = newValue;
        }
    } else {
        item.currentValue = newValue;
    }
}

function applyCaps(item) {
    // Round to 2 decimal places to avoid floating point precision issues
    item.currentValue = Math.round(item.currentValue * 100) / 100;
    
    // Determine max value and whether it's a hard cap
    const maxValue = item.maxValue !== undefined ? item.maxValue : 
                     (item.hardCap !== null && item.hardCap !== undefined ? item.hardCap : 
                      (item.softCap !== null && item.softCap !== undefined ? item.softCap : null));
    const isHardCap = item.isHardCap !== undefined ? item.isHardCap : 
                      (item.hardCap !== null && item.hardCap !== undefined);
    
    // Upper cap (hard cap only)
    if (isHardCap && maxValue !== null && maxValue !== undefined && item.currentValue > maxValue) {
        item.currentValue = maxValue;
    }
    
    // Lower cap (negative hard cap / floor)
    if (item.allowNegative) {
        const minValue = item.minValue !== undefined ? item.minValue : null;
        const isMinHardCap = item.isMinHardCap || false;
        
        if (isMinHardCap && minValue !== null && minValue !== undefined && item.currentValue < minValue) {
            item.currentValue = minValue;
        }
    } else {
        // Prevent negative if not allowed
        if (item.currentValue < 0) {
            item.currentValue = 0;
        }
    }
}

function handleCyclicalResources() {
    // Process cyclical resources (Day/Month/Year cascade)
    // Handles both counting up (1->24) and counting down (24->1)
    let changed = true;
    let iterations = 0;
    const maxIterations = 10;
    
    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        
        resources.forEach(r => {
            // Determine max value - cyclical requires a max value (hard cap)
            const maxValue = r.maxValue !== undefined ? r.maxValue : 
                             (r.hardCap !== null && r.hardCap !== undefined ? r.hardCap : null);
            if (!r.cyclical || !maxValue) return;
            
            let triggered = false;
            let resetValue = r.baseValue;
            
            // Determine reset direction based on changePerRound
            const isCountingDown = r.changePerRound < 0;
            
            if (isCountingDown) {
                // Counting down: check if value went below 1 (or below minimum)
                // For Hour 24->1: when it hits 0 or below, reset to max value (24)
                if (r.currentValue < 1) {
                    triggered = true;
                    resetValue = maxValue; // Reset to max value when counting down
                }
            } else {
                // Counting up: check if value exceeded max value
                if (r.currentValue > maxValue) {
                    triggered = true;
                    resetValue = r.baseValue; // Reset to base when counting up
                }
            }
            
            if (triggered) {
                r.currentValue = resetValue;
                changed = true;
                
                // Log the reset with proper color logic - only the value gets colored
                logResourceReset(r.name, resetValue, r.colorLogic);
                
                // Process all cyclical effects
                if (r.cyclicalEffects && r.cyclicalEffects.length > 0) {
                    r.cyclicalEffects.forEach(effect => {
                        const targetArray = effect.targetType === 'resource' ? resources : stats;
                        const target = targetArray.find(t => t.name === effect.targetName);
                        
                        if (target) {
                            let actualChange = effect.value;
                            
                            if (effect.changeType === 'percent') {
                                actualChange = target.currentValue * (effect.value / 100);
                            }
                            
                            target.currentValue += actualChange;
                            
                            // Apply caps
                            if (effect.targetType === 'resource' && !target.cyclical) {
                                applyCaps(target);
                            }
                            
                            // Determine color based on target's colorLogic setting
                            const targetForColor = effect.targetType === 'resource' ? resources.find(t => t.name === effect.targetName) : stats.find(t => t.name === effect.targetName);
                            const colorLogic = targetForColor?.colorLogic || 'default';
                            const isGood = colorLogic === 'neutral' ? null : isChangeGood(effect.targetType, effect.targetName, actualChange);
                            
                            // Log the change - use logChange for proper color coding
                            logChange(effect.targetType, effect.targetName, actualChange, r.name, colorLogic === 'neutral');
                            
                            // Show narrative if title is provided
                            if (effect.narrativeTitle) {
                                let valueText = '';
                                
                                // Build value text if showInNarrative is checked
                                if (effect.showInNarrative !== false) {
                                    const sign = actualChange > 0 ? '+' : '';
                                    const valueFormatted = parseFloat(actualChange.toFixed(2));
                                    const className = colorLogic === 'neutral' ? 'change-neutral' : (isGood ? 'change-good' : 'change-bad');
                                    const typeText = effect.changeType === 'percent' ? '%' : '';
                                    valueText = ` <span class="${className}">${sign}${valueFormatted}${typeText} ${escapeHtml(effect.targetName)}</span>`;
                                }
                                
                                // Mirror standard narrative cards: just title and text
                                displayNarrative({
                                    id: Date.now() + Math.random(),
                                    name: escapeHtml(effect.narrativeTitle),
                                    text: effect.narrativeDesc || '',
                                    valueHtml: valueText, // Separate HTML value to append
                                    repeatable: true,
                                    trigger: null,
                                    hideFooter: true
                                });
                            }
                        }
                    });
                }
            }
        });
    }
}

function checkAndActivateCards() {
    cardCollection.forEach(cardDef => {
        const alreadyActive = activeCards.some(c => c.collectionId === cardDef.id);
        if (alreadyActive) return;
        
        // Skip if was removed this turn (by card effect, not naturally expired)
        if (cardDef._removedOnTurn === currentTurn) return;
        
        if (checkTriggerConditions(cardDef.trigger)) {
            activateCardFromCollection(cardDef);
            addLogEntry('action', `${cardDef.name} available`);
        }
    });
}

function checkAndActivateBuffs() {
    buffCollection.forEach(buffDef => {
        const alreadyActive = activeBuffs.some(b => b.collectionId === buffDef.id);
        if (alreadyActive) return;
        
        // Skip if was manually removed by a card (persist until reset)
        if (buffDef._manuallyRemoved === true) return;
        
        // Skip one-time buffs that have already been triggered
        if (buffDef.oneTime && buffDef._oneTimeTriggered) return;
        
        if (checkTriggerConditions(buffDef.trigger)) {
            activateBuffFromCollection(buffDef);
            // Buff effects will be logged individually by applyBuffEffects
            
            // Mark one-time buffs as triggered
            if (buffDef.oneTime) {
                buffDef._oneTimeTriggered = true;
            }
        }
    });
}

function checkTriggerConditions(trigger) {
    if (!trigger || !trigger.conditions || trigger.conditions.length === 0) return true;
    
    const results = trigger.conditions.map(checkSingleCondition);
    const trueCount = results.filter(r => r).length;
    const totalCount = results.length;
    
    switch (trigger.logic) {
        case 'all':
            return trueCount === totalCount;
        case 'any':
            return trueCount > 0;
        case 'custom':
            return trueCount >= (trigger.customValue || 2);
        default:
            return trueCount === totalCount;
    }
}

function checkSingleCondition(condition) {
    if (!condition || !condition.type) return false;
    
    switch (condition.type) {
        case 'turn':
            return currentTurn >= parseInt(condition.value || 1);
        
        case 'turn_eq':
            return currentTurn === parseInt(condition.value || 1);
        
        case 'turn_lte':
            return currentTurn <= parseInt(condition.value || 1);
        
        case 'buff_active':
            if (!condition.target) return false;
            const buffName = condition.target.split(':')[1];
            return activeBuffs.some(b => b.name === buffName);
        
        case 'buff_inactive':
            if (!condition.target) return false;
            const inactiveBuffName = condition.target.split(':')[1];
            return !activeBuffs.some(b => b.name === inactiveBuffName);
        
        case 'resource_gte':
            if (!condition.target) return false;
            const resName = condition.target.split(':')[1];
            const res = resources.find(r => r.name === resName);
            return res && res.currentValue >= parseFloat(condition.value || 0);
        
        case 'stat_gte':
            if (!condition.target) return false;
            const statName = condition.target.split(':')[1];
            const stat = stats.find(s => s.name === statName);
            return stat && stat.currentValue >= parseFloat(condition.value || 0);
        
        case 'resource_lte':
            if (!condition.target) return false;
            const resName2 = condition.target.split(':')[1];
            const res2 = resources.find(r => r.name === resName2);
            return res2 && res2.currentValue <= parseFloat(condition.value || 0);
        
        case 'stat_lte':
            if (!condition.target) return false;
            const statName2 = condition.target.split(':')[1];
            const stat2 = stats.find(s => s.name === statName2);
            return stat2 && stat2.currentValue <= parseFloat(condition.value || 0);
        
        default:
            return false;
    }
}

function activateCardFromCollection(cardDef) {
    activeCards.push({
        id: Date.now() + Math.random(),
        collectionId: cardDef.id,
        name: cardDef.name,
        costs: JSON.parse(JSON.stringify(cardDef.costs || [])),
        description: cardDef.description,
        effects: JSON.parse(JSON.stringify(cardDef.effects || [])),
        trigger: JSON.parse(JSON.stringify(cardDef.trigger || { logic: 'all', conditions: [] }))
    });
}

function activateBuffFromCollection(buffDef) {
    const buff = {
        id: Date.now() + Math.random(),
        collectionId: buffDef.id,
        name: buffDef.name,
        description: buffDef.description,
        effects: JSON.parse(JSON.stringify(buffDef.effects || [])),
        duration: buffDef.duration || 0,
        currentValue: buffDef.duration || 0,
        _effectsApplied: false,  // Track if immediate effects have been applied
        _appliedChanges: []  // Store the actual changes made for proper reversal
    };
    activeBuffs.push(buff);
    
    // Log buff activation once
    addLogEntry('buff', `${buff.name} applied`);
    
    // Apply immediate effects right away (once only)
    
    // Apply immediate effects right away (once only)
    if (buff.effects && !buff._effectsApplied) {
        buff.effects.forEach(effect => {
            if (effect.trigger === 'immediate') {
                const targetArray = effect.targetType === 'resource' ? resources : stats;
                const target = targetArray.find(t => t.name === effect.targetName);
                if (target) {
                    let change = effect.value;
                    
                    if (effect.effectType === 'percent') {
                        change = target.currentValue * (effect.value / 100);
                    }
                    
                    const oldValue = target.currentValue;
                    target.currentValue += change;
                    applyCaps(target);
                    
                    // Store the actual change for proper reversal
                    const actualChange = target.currentValue - oldValue;
                    buff._appliedChanges.push({
                        targetType: effect.targetType,
                        targetName: effect.targetName,
                        change: actualChange
                    });
                    
                    // Log with color coding
                    logChange(effect.targetType, effect.targetName, actualChange, buff.name);
                    
                    // If setBase is enabled, update the base value to the new current value
                    if (effect.setBase) {
                        target.baseValue = target.currentValue;
                    }
                } else {
                    addLogEntry('effect', `${effect.targetName} not found`);
                }
            }
        });
        buff._effectsApplied = true;
    }
}

function applyBuffEffects(triggerType) {
    activeBuffs.forEach(buff => {
        if (!buff.effects) return;
        
        // Skip if this buff's immediate effects were already applied during activation
        if (triggerType === 'immediate' && buff._effectsApplied) return;
        
        buff.effects.forEach(effect => {
            if (effect.trigger !== triggerType) return;
            
            // Check condition if present
            if (effect.condition && effect.condition.enabled) {
                if (!evaluateBuffCondition(effect.condition)) {
                    return; // Condition not met, skip this effect
                }
            }
            
            const targetArray = effect.targetType === 'resource' ? resources : stats;
            const target = targetArray.find(t => t.name === effect.targetName);
            
            if (target) {
                let change = effect.value;
                
                if (effect.effectType === 'percent') {
                    change = target.currentValue * (effect.value / 100);
                }
                
                const oldValue = target.currentValue;
                target.currentValue += change;
                applyCaps(target);
                
                // Log the actual change with color coding
                const actualChange = target.currentValue - oldValue;
                logChange(effect.targetType, effect.targetName, actualChange, buff.name);
                
                // If setBase is enabled, update the base value to the new current value
                // This prevents the buff from compounding each turn
                if (effect.setBase) {
                    target.baseValue = target.currentValue;
                }
            }
        });
        
        // Mark immediate effects as applied
        if (triggerType === 'immediate') {
            buff._effectsApplied = true;
        }
    });
}

function evaluateBuffCondition(condition) {
    if (!condition || !condition.enabled) return true;
    
    const targetArray = condition.targetType === 'resource' ? resources : stats;
    const target = targetArray.find(t => t.name === condition.targetName);
    
    if (!target) return false;
    
    const currentValue = target.currentValue;
    const conditionValue = condition.value || 0;
    const conditionChange = condition.change || 0;
    
    switch (condition.operator) {
        case '<':
            return currentValue < conditionValue;
        case '>':
            return currentValue > conditionValue;
        case '=':
            return currentValue === conditionValue;
        case 'changes':
            // Check if value changed by the specified amount this turn
            if (target._prevValue !== undefined) {
                const actualChange = currentValue - target._prevValue;
                return actualChange === conditionChange;
            }
            return false;
        case 'gains':
            // Legacy: check if value increased (any positive change)
            if (target._prevValue !== undefined) {
                return currentValue > target._prevValue;
            }
            return false;
        case 'loses':
            // Legacy: check if value decreased (any negative change)
            if (target._prevValue !== undefined) {
                return currentValue < target._prevValue;
            }
            return false;
        default:
            return true;
    }
}

function resetTurn() {
    if (currentTurn > 1 && !confirm('Reset to turn 1? Active cards and buffs will be cleared, but your collection is kept.')) {
        return;
    }
    
    currentTurn = 1;
    turnValue.textContent = currentTurn;
    
    // Clear log and narrative
    const roundName = getRoundLabel();
    const roundText = getRoundMessage();
    activityLog.innerHTML = `
        <div class="turn-message">
            <span class="turn-label">${roundName} <span class="turn-number">1</span></span>
            ${roundText ? `<span class="turn-text">${roundText}</span>` : ''}
        </div>
    `;
    const narrativeArea = document.getElementById('narrativeArea');
    if (narrativeArea) narrativeArea.innerHTML = '';
    
    // Reset resources/stats
    resources.forEach(r => {
        r.currentValue = r.baseValue;
        applyCaps(r);
    });
    stats.forEach(s => {
        s.currentValue = s.baseValue;
        applyCaps(s);
    });
    
    // Clear active cards/buffs
    activeCards = [];
    activeBuffs = [];
    
    // Clear shown narratives (now in log, will be cleared with log)
    shownNarratives = [];
    
    // Clear all removal markers (fresh start)
    cardCollection.forEach(c => {
        delete c._removedOnTurn;
        delete c._manuallyRemoved;
    });
    buffCollection.forEach(b => {
        delete b._removedOnTurn;
        delete b._manuallyRemoved;
    });
    
    // Re-activate based on turn 1 triggers (buffs first, then cards)
    checkAndActivateBuffs();
    checkAndActivateCards();
    
    // Check for turn 1 narratives
    checkAndDisplayNarratives();
    
    saveState();
    renderAll();
}

function resetAll() {
    if (!confirm('Reset EVERYTHING? All data will be lost.')) return;
    
    currentTurn = 1;
    resources = [];
    stats = [];
    cardCollection = [];
    buffCollection = [];
    narrativeCollection = [];
    activeCards = [];
    activeBuffs = [];
    shownNarratives = [];
    
    gameSettings = { roundName: '', roundText: '' };
    const roundName = getRoundLabel();
    const roundText = getRoundMessage();
    activityLog.innerHTML = `
        <div class="turn-message">
            <span class="turn-label">${roundName} <span class="turn-number">1</span></span>
            ${roundText ? `<span class="turn-text">${roundText}</span>` : ''}
        </div>
    `;
    const narrativeArea = document.getElementById('narrativeArea');
    if (narrativeArea) narrativeArea.innerHTML = '';
    localStorage.removeItem(STORAGE_KEY);
    turnValue.textContent = currentTurn;
    renderAll();
}

// ===== Narrative Editor Functions =====

let currentNarrativeEditId = null;
let isEditingNarrative = false;

function openNarrativeEditor() {
    document.getElementById('narrativeEditor').classList.add('visible');
    renderNarrativeGrid();
    resetNarrativeEditForm();
}

function closeNarrativeEditor() {
    document.getElementById('narrativeEditor').classList.remove('visible');
    resetNarrativeEditForm();
}

// ===== Settings Functions =====

let gameSettings = {
    roundName: '',
    roundText: ''
};

function openSettings() {
    const settingRoundName = document.getElementById('settingRoundName');
    const settingRoundText = document.getElementById('settingRoundText');
    if (settingRoundName) settingRoundName.value = gameSettings.roundName || '';
    if (settingRoundText) settingRoundText.value = gameSettings.roundText || '';
    document.getElementById('settingsEditor').classList.add('visible');
}

function closeSettings() {
    document.getElementById('settingsEditor').classList.remove('visible');
}

function saveSettings() {
    const settingRoundName = document.getElementById('settingRoundName');
    const settingRoundText = document.getElementById('settingRoundText');
    if (settingRoundName) gameSettings.roundName = settingRoundName.value.trim();
    if (settingRoundText) gameSettings.roundText = settingRoundText.value.trim();
    saveState();
}

function getRoundLabel() {
    return gameSettings.roundName || 'Turn';
}

function getRoundMessage() {
    return gameSettings.roundText || '';
}

function renderNarrativeGrid() {
    const grid = document.getElementById('narrativeGrid');
    if (narrativeCollection.length === 0) {
        grid.innerHTML = '<div class="empty-state">No narratives yet. Click "Add New Narrative" to create one.</div>';
        return;
    }
    
    grid.innerHTML = narrativeCollection.map(n => `
        <div class="narrative-item ${currentNarrativeEditId === n.id ? 'selected' : ''}" onclick="selectNarrativeForEdit(${n.id})">
            <div class="narrative-item-name">${escapeHtml(n.name)}</div>
            <div class="narrative-item-preview">${escapeHtml(n.text)}</div>
            ${n.repeatable ? '<div class="narrative-item-repeatable">↻ Repeatable</div>' : ''}
        </div>
    `).join('');
}

function selectNarrativeForEdit(id) {
    const narrative = narrativeCollection.find(n => n.id === id);
    if (!narrative) return;
    
    currentNarrativeEditId = id;
    isEditingNarrative = true;
    
    document.getElementById('narrativeEditId').value = id;
    document.getElementById('narrativeName').value = narrative.name;
    document.getElementById('narrativeText').value = narrative.text;
    document.getElementById('narrativeRepeatable').checked = narrative.repeatable || false;
    
    // Set trigger logic
    const trigger = narrative.trigger || { logic: 'all', customValue: 1, conditions: [] };
    document.getElementById('narrativeTriggerLogic').value = trigger.logic;
    document.getElementById('narrativeTriggerCustomGroup').style.display = trigger.logic === 'custom' ? 'flex' : 'none';
    document.getElementById('narrativeTriggerCustomValue').value = trigger.customValue || 2;
    
    // Render conditions
    const container = document.getElementById('narrativeTriggerConditionsContainer');
    container.innerHTML = '';
    
    if (trigger.conditions && trigger.conditions.length > 0) {
        trigger.conditions.forEach(condition => {
            addNarrativeTriggerRow(condition);
        });
    } else {
        addNarrativeTriggerRow(); // Add one empty row
    }
    
    updateNarrativeCustomTotal();
    
    document.getElementById('narrativeEditTitle').textContent = 'Edit Narrative';
    document.getElementById('btnSaveNarrative').textContent = 'Update Narrative';
    document.getElementById('btnDeleteNarrative').style.display = 'inline-block';
    document.getElementById('narrativeEditContent').classList.add('visible');
    
    renderNarrativeGrid();
}

function startAddNewNarrative() {
    resetNarrativeEditForm();
    const content = document.getElementById('narrativeEditContent');
    if (content) content.classList.add('visible');
}

function resetNarrativeEditForm() {
    currentNarrativeEditId = null;
    isEditingNarrative = false;
    
    const editId = document.getElementById('narrativeEditId');
    const name = document.getElementById('narrativeName');
    const text = document.getElementById('narrativeText');
    const repeatable = document.getElementById('narrativeRepeatable');
    const triggerLogic = document.getElementById('narrativeTriggerLogic');
    const customGroup = document.getElementById('narrativeTriggerCustomGroup');
    const customValue = document.getElementById('narrativeTriggerCustomValue');
    const editTitle = document.getElementById('narrativeEditTitle');
    const btnSave = document.getElementById('btnSaveNarrative');
    const btnDelete = document.getElementById('btnDeleteNarrative');
    
    if (editId) editId.value = '';
    if (name) name.value = '';
    if (text) text.value = '';
    if (repeatable) repeatable.checked = false;
    if (triggerLogic) triggerLogic.value = 'all';
    if (customGroup) customGroup.style.display = 'none';
    if (customValue) customValue.value = '2';
    
    // Reset conditions
    const container = document.getElementById('narrativeTriggerConditionsContainer');
    if (container) {
        container.innerHTML = '';
        addNarrativeTriggerRow();
    }
    
    if (editTitle) editTitle.textContent = 'Add New Narrative';
    if (btnSave) btnSave.textContent = 'Save Narrative';
    if (btnDelete) btnDelete.style.display = 'none';
    
    renderNarrativeGrid();
}

// Unified narrative trigger row using shared component
function addNarrativeTriggerRow(condition = null) {
    const container = document.getElementById('narrativeTriggerConditionsContainer');
    if (!container) return;
    // Convert legacy format if needed
    const newFormatCondition = condition ? legacyToNewTriggerFormat(condition) : null;
    const row = createTriggerConditionRow(newFormatCondition, 'narrative');
    // Change class for narrative-specific styling
    row.classList.remove('trigger-condition-row');
    row.classList.add('narrative-trigger-row');
    container.appendChild(row);
    updateNarrativeCustomTotal();
}

function updateNarrativeCustomTotal() {
    const count = document.querySelectorAll('.narrative-trigger-row').length;
    const totalEl = document.getElementById('narrativeTriggerCustomTotal');
    if (totalEl) totalEl.textContent = count;
}

// Collect narrative triggers using shared logic
function collectNarrativeTriggers() {
    const conditions = [];
    document.querySelectorAll('.narrative-trigger-row').forEach(row => {
        const category = row.querySelector('.trigger-category')?.value;
        const operator = row.querySelector('.trigger-operator')?.value;
        const target = row.querySelector('.trigger-target')?.value || '';
        const value = row.querySelector('.trigger-value')?.value || '';
        
        if (!category) return;
        
        // Convert to legacy format
        let type;
        if (category === 'turn') {
            type = operator === '<=' ? 'turn_lte' : (operator === '=' ? 'turn_eq' : 'turn');
        } else if (category === 'resource') {
            type = operator === '<=' ? 'resource_lte' : 'resource_gte';
        } else if (category === 'stat') {
            type = operator === '<=' ? 'stat_lte' : 'stat_gte';
        } else if (category === 'buff') {
            type = operator === 'inactive' ? 'buff_inactive' : 'buff_active';
        }
        
        conditions.push({ type, target, value });
    });
    
    return {
        logic: document.getElementById('narrativeTriggerLogic').value,
        customValue: parseInt(document.getElementById('narrativeTriggerCustomValue').value) || 2,
        conditions
    };
}

function saveNarrative() {
    const name = document.getElementById('narrativeName').value.trim();
    const text = document.getElementById('narrativeText').value.trim();
    const repeatable = document.getElementById('narrativeRepeatable').checked;
    
    if (!name || !text) {
        showToast('Please enter a name and narrative text', 'error');
        return;
    }
    
    // Collect trigger conditions
    const trigger = collectNarrativeTriggers();
    
    if (isEditingNarrative && currentNarrativeEditId) {
        const index = narrativeCollection.findIndex(n => n.id === currentNarrativeEditId);
        if (index !== -1) {
            narrativeCollection[index] = {
                ...narrativeCollection[index],
                name,
                text,
                repeatable,
                trigger
            };
            showToast('Narrative updated!');
        }
    } else {
        const newNarrative = {
            id: Date.now(),
            name,
            text,
            repeatable,
            trigger
        };
        narrativeCollection.push(newNarrative);
        showToast('Narrative added!');
    }
    
    saveState();
    resetNarrativeEditForm();
    renderNarrativeGrid();
}

function deleteNarrative() {
    if (!currentNarrativeEditId) return;
    
    if (!confirm('Delete this narrative?')) return;
    
    narrativeCollection = narrativeCollection.filter(n => n.id !== currentNarrativeEditId);
    saveState();
    resetNarrativeEditForm();
    renderNarrativeGrid();
    showToast('Narrative deleted');
}

function cancelNarrativeEdit() {
    resetNarrativeEditForm();
    document.getElementById('narrativeEditContent').classList.remove('visible');
}

// ===== Card Album Functions =====

function openCardAlbum() {
    document.getElementById('cardAlbum').classList.add('visible');
    renderCardAlbum();
}

function closeCardAlbum() {
    document.getElementById('cardAlbum').classList.remove('visible');
}

function renderCardAlbum() {
    const grid = document.getElementById('cardAlbumGrid');
    if (cardCollection.length === 0) {
        grid.innerHTML = '<div class="empty-state">No cards in collection yet.</div>';
        return;
    }
    
    grid.innerHTML = cardCollection.map(c => {
        // Determine card type for border accent
        let cardType = 'neutral';
        const hasCost = c.costs?.some(cost => cost.value !== 0);
        const hasPositiveEffect = c.effects?.some(e => e.value > 0 && e.type !== 'clear_buff');
        if (hasCost) cardType = 'debuff';
        else if (hasPositiveEffect) cardType = 'buff';
        
        // Build stats HTML like action cards
        const statsHtml = [];
        
        // Costs - always negative (red)
        c.costs?.forEach(cost => {
            const val = cost.costType === 'percent' ? `${Math.abs(cost.value)}%` : Math.abs(cost.value);
            const targetName = cost.targetName || (cost.target ? cost.target.split(':')[1] : '?');
            statsHtml.push(`<div class="deck-card-effect"><span class="effect-name">${escapeHtml(targetName)}</span><span class="effect-value negative">−${val}</span></div>`);
        });
        
        // Effects (non-clear)
        c.effects?.filter(e => e.type !== 'clear_buff').forEach(e => {
            const val = e.effectType === 'percent' ? `${Math.abs(e.value)}%` : Math.abs(e.value);
            const sign = e.value >= 0 ? '+' : '−';
            const colorClass = e.value > 0 ? 'positive' : (e.value < 0 ? 'negative' : 'neutral');
            const targetName = e.targetName || (e.target ? e.target.split(':')[1] : '?');
            statsHtml.push(`<div class="deck-card-effect"><span class="effect-name">${escapeHtml(targetName)}</span><span class="effect-value ${colorClass}">${sign}${val}</span></div>`);
        });
        
        // Clear buff effects
        c.effects?.filter(e => e.type === 'clear_buff').forEach(e => {
            const buffName = e.buffName || (e.target ? e.target.split(':')[1] : 'buff');
            statsHtml.push(`<div class="deck-card-effect"><span class="effect-name">Clear</span><span class="effect-value neutral">${escapeHtml(buffName)}</span></div>`);
        });
        
        return `
            <div class="card-album-item ${cardType}">
                <div class="deck-card-header">
                    <span class="deck-card-name">${escapeHtml(c.name)}</span>
                </div>
                <div class="deck-card-body">
                    <div class="deck-card-effects">${statsHtml.join('')}</div>
                    <div class="deck-card-desc">${escapeHtml(c.description || '')}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ===== Narrative System =====

function checkAndDisplayNarratives() {
    const narrativeArea = document.getElementById('narrativeArea');
    
    narrativeCollection.forEach(narrative => {
        // Skip if already shown and not repeatable
        if (shownNarratives.includes(narrative.id) && !narrative.repeatable) {
            return;
        }
        
        // Check trigger conditions
        if (checkTriggerConditions(narrative.trigger)) {
            // Add to shown list
            if (!shownNarratives.includes(narrative.id)) {
                shownNarratives.push(narrative.id);
            }
            
            // Display narrative (escape the name for user-defined narratives)
            displayNarrative({
                ...narrative,
                name: escapeHtml(narrative.name)
            });
        }
    });
}

function displayNarrative(narrative) {
    const narrativeArea = document.getElementById('narrativeArea');
    if (!narrativeArea) return;
    
    const entry = document.createElement('div');
    entry.className = 'narrative-log-entry';
    
    // Format text with paragraph breaks if it contains newlines
    let formattedText = '';
    if (narrative.text) {
        formattedText = escapeHtml(narrative.text)
            .split('\n')
            .filter(p => p.trim())
            .map(p => `<span>${p}</span>`)
            .join('');
    }
    
    // Append valueHtml if provided (for colored values from cyclical effects)
    if (narrative.valueHtml) {
        formattedText += ` ${narrative.valueHtml}`;
    }
    
    // Narrative format: centered title with gradient lines on sides, description below
    entry.innerHTML = `
        <div class="narrative-log-header">
            <span class="narrative-log-title">${escapeHtml(narrative.name)}</span>
        </div>
        <span class="narrative-log-text">${formattedText}</span>
    `;
    
    // Staggered animation like log entries
    entry.style.animationDelay = `${logAnimationCounter * 0.08}s`;
    entry.style.opacity = '0';
    logAnimationCounter++;
    clearTimeout(logAnimationTimer);
    logAnimationTimer = setTimeout(() => { logAnimationCounter = 0; }, 500);
    
    // Prepend like log (newest at top), don't clear
    narrativeArea.prepend(entry);
}

// ===== Storage =====

function saveState() {
    const state = {
        currentTurn,
        resources,
        stats,
        cardCollection,
        buffCollection,
        narrativeCollection,
        activeCards,
        activeBuffs,
        shownNarratives,
        gameSettings
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function exportGameState() {
    const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        game: {
            currentTurn,
            resources: resources.map(r => ({
                name: r.name,
                currentValue: r.currentValue,
                baseValue: r.baseValue,
                changePerRound: r.changePerRound,
                maxValue: r.maxValue,
                isHardCap: r.isHardCap,
                resetEveryTurn: r.resetEveryTurn,
                allowNegative: r.allowNegative,
                minValue: r.minValue,
                isMinHardCap: r.isMinHardCap,
                colorLogic: r.colorLogic,
                cyclical: r.cyclical,
                cyclicalEffects: r.cyclicalEffects
            })),
            stats: stats.map(s => ({
                name: s.name,
                currentValue: s.currentValue,
                baseValue: s.baseValue,
                changePerRound: s.changePerRound,
                maxValue: s.maxValue,
                isHardCap: s.isHardCap,
                resetEveryTurn: s.resetEveryTurn,
                colorLogic: s.colorLogic
            })),
            activeBuffs: activeBuffs.map(b => ({
                name: b.name,
                description: b.description,
                duration: b.duration,
                currentValue: b.currentValue,
                effects: b.effects
            })),
            activeCards: activeCards.map(c => ({
                name: c.name,
                description: c.description,
                costs: c.costs,
                effects: c.effects
            }))
        },
        collection: {
            buffs: buffCollection.map(b => ({
                name: b.name,
                description: b.description,
                duration: b.duration,
                trigger: b.trigger,
                effects: b.effects
            })),
            cards: cardCollection.map(c => ({
                name: c.name,
                description: c.description,
                trigger: c.trigger,
                costs: c.costs,
                effects: c.effects
            })),
            narratives: narrativeCollection.map(n => ({
                name: n.name,
                text: n.text,
                repeatable: n.repeatable,
                trigger: n.trigger
            }))
        }
    };
    
    const json = JSON.stringify(exportData, null, 2);
    
    navigator.clipboard.writeText(json).then(() => {
        showToast('Game state copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy - check console', 'error');
        console.log('EXPORT DATA:', json);
    });
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    
    try {
        const state = JSON.parse(saved);
        currentTurn = state.currentTurn || 1;
        resources = state.resources || [];
        stats = state.stats || [];
        cardCollection = state.cardCollection || [];
        buffCollection = state.buffCollection || [];
        narrativeCollection = state.narrativeCollection || [];
        activeCards = state.activeCards || [];
        activeBuffs = state.activeBuffs || [];
        shownNarratives = state.shownNarratives || [];
        gameSettings = state.gameSettings || { roundName: '', roundText: '' };
        
        // Migrate old negativeIsGood to colorLogic
        resources.forEach(r => {
            if (r.negativeIsGood !== undefined) {
                r.colorLogic = r.negativeIsGood ? 'negative_is_good' : 'default';
                delete r.negativeIsGood;
            }
        });
        stats.forEach(s => {
            if (s.negativeIsGood !== undefined) {
                s.colorLogic = s.negativeIsGood ? 'negative_is_good' : 'default';
                delete s.negativeIsGood;
            }
        });
        
        // Migrate old softCap/hardCap to new maxValue/isHardCap format
        resources.forEach(r => {
            if (r.maxValue === undefined) {
                if (r.hardCap !== null && r.hardCap !== undefined) {
                    r.maxValue = r.hardCap;
                    r.isHardCap = true;
                } else if (r.softCap !== null && r.softCap !== undefined) {
                    r.maxValue = r.softCap;
                    r.isHardCap = false;
                } else {
                    r.maxValue = null;
                    r.isHardCap = false;
                }
            }
            if (r.minValue === undefined) {
                r.minValue = null;
                r.isMinHardCap = false;
            }
        });
        stats.forEach(s => {
            if (s.maxValue === undefined) {
                if (s.hardCap !== null && s.hardCap !== undefined) {
                    s.maxValue = s.hardCap;
                    s.isHardCap = true;
                } else if (s.softCap !== null && s.softCap !== undefined) {
                    s.maxValue = s.softCap;
                    s.isHardCap = false;
                } else {
                    s.maxValue = null;
                    s.isHardCap = false;
                }
            }
            if (s.minValue === undefined) {
                s.minValue = null;
                s.isMinHardCap = false;
            }
        });
        
        // Migrate old trigger format to new format
        [...cardCollection, ...buffCollection].forEach(item => {
            if (!item.trigger && (item.triggerType || item.triggerValue !== undefined)) {
                item.trigger = {
                    logic: 'all',
                    customValue: 1,
                    conditions: [{
                        type: item.triggerType === 'immediate' ? 'turn' : (item.triggerType || 'turn'),
                        value: String(item.triggerValue || 1),
                        target: ''
                    }]
                };
                delete item.triggerType;
                delete item.triggerValue;
            }
        });
        
        [...activeCards, ...activeBuffs].forEach(item => {
            if (!item.trigger && (item.triggerType || item.triggerValue !== undefined)) {
                item.trigger = {
                    logic: 'all',
                    customValue: 1,
                    conditions: [{
                        type: item.triggerType === 'immediate' ? 'turn' : (item.triggerType || 'turn'),
                        value: String(item.triggerValue || 1),
                        target: ''
                    }]
                };
                delete item.triggerType;
                delete item.triggerValue;
            }
        });
    } catch (e) {
        console.error('Failed to load state:', e);
    }
}

// ===== Render Functions =====

function renderAll() {
    renderResources();
    renderStats();
    renderCards();
    renderBuffs();
}

function setupCardsHorizontalScroll() {
    const cardsGrid = document.getElementById('cardsContainer');
    if (!cardsGrid) return;
    
    // Convert vertical scroll to horizontal
    cardsGrid.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
            e.preventDefault();
            cardsGrid.scrollLeft += e.deltaY;
        }
    }, { passive: false });
}

function renderResources() {
    const isEditorOpen = editPanel?.classList.contains('visible');
    resourcesContainer.innerHTML = resources.map((r, index) => {
        const clickHandler = isEditorOpen ? `onclick="openBottomPanel('resource', ${r.id})"` : '';
        const dragAttrs = isEditorOpen ? `draggable="true" data-id="${r.id}" data-index="${index}" data-type="resource"` : '';
        return `<div class="resource-chip" ${clickHandler} ${dragAttrs}>
            <span class="label">${escapeHtml(r.name)}</span>
            <span class="value ${r.currentValue < 0 ? 'negative' : ''}">${r.currentValue}</span>
        </div>`;
    }).join('');
    
    // Setup drag and drop if editor is open
    if (isEditorOpen) {
        setupDragAndDrop(resourcesContainer, 'resource');
    }
}

function renderStats() {
    const isEditorOpen = editPanel?.classList.contains('visible');
    statsContainer.innerHTML = stats.map((s, index) => {
        const clickHandler = isEditorOpen ? `onclick="openBottomPanel('stat', ${s.id})"` : '';
        const dragAttrs = isEditorOpen ? `draggable="true" data-id="${s.id}" data-index="${index}" data-type="stat"` : '';
        return `<div class="stat-row" ${clickHandler} ${dragAttrs}>
            <div class="stat-info">
                <span class="stat-name">${escapeHtml(s.name)}</span>
                <span class="stat-value">${s.currentValue}${s.softCap !== null ? '/' + s.softCap : ''}</span>
            </div>
        </div>`;
    }).join('');
    
    // Setup drag and drop if editor is open
    if (isEditorOpen) {
        setupDragAndDrop(statsContainer, 'stat');
    }
}

function renderCards() {
    if (activeCards.length === 0) {
        cardsContainer.innerHTML = '<div class="empty-state">No actions available</div>';
        return;
    }
    
    cardsContainer.innerHTML = activeCards.map(card => {
        // Determine card type accent based on costs/effects
        let cardType = 'neutral';
        const hasCost = card.costs?.some(c => c.value !== 0);
        const hasPositiveEffect = card.effects?.some(e => e.value > 0 && e.type !== 'clear_buff');
        if (hasCost) cardType = 'debuff';
        else if (hasPositiveEffect) cardType = 'buff';
        
        // Build all stats lines with proper colors
        const statsHtml = [];
        
        // Costs - what you PAY to play the card
        // Display: "Resource -X" in red (it's a cost you're paying)
        card.costs?.forEach(c => {
            const val = c.costType === 'percent' ? `${Math.abs(c.value)}%` : Math.abs(c.value);
            statsHtml.push(`<div class="card-stat"><span class="stat-name">${escapeHtml(c.targetName)}</span><span class="stat-value negative">−${val}</span></div>`);
        });
        
        // Effects (non-clear) - what happens when you play
        card.effects?.filter(e => e.type !== 'clear_buff').forEach(e => {
            const val = e.effectType === 'percent' ? `${Math.abs(e.value)}%` : Math.abs(e.value);
            const sign = e.value >= 0 ? '+' : '-';
            const colorClass = e.value > 0 ? 'positive' : (e.value < 0 ? 'negative' : 'neutral');
            statsHtml.push(`<div class="card-stat"><span class="stat-name">${escapeHtml(e.targetName)}</span><span class="stat-value ${colorClass}">${sign}${val}</span></div>`);
        });
        
        // Reverse effects (what you lose when clearing buffs)
        // When you clear a buff, you lose its ongoing benefits/penalties
        const clearBuffEffects = card.effects?.filter(e => e.type === 'clear_buff');
        if (clearBuffEffects && clearBuffEffects.length > 0) {
            clearBuffEffects.forEach(clearEffect => {
                const buffName = clearEffect.buffName;
                const buff = activeBuffs.find(b => b.name === buffName);
                if (buff && buff.effects) {
                    buff.effects.forEach(buffEffect => {
                        const val = buffEffect.effectType === 'percent' ? `${Math.abs(buffEffect.value)}%` : Math.abs(buffEffect.value);
                        // When clearing a buff, you LOSE that buff's effect
                        // If buff gave +85 Money, clearing it means losing 85 Money (red/negative)
                        // If buff gave -35 Focus, clearing it means gaining 35 Focus (green/positive)
                        const isBuffPositive = buffEffect.value > 0;
                        const displaySign = isBuffPositive ? '−' : '+';  // Using actual minus sign
                        const colorClass = isBuffPositive ? 'negative' : 'positive';
                        statsHtml.push(`<div class="card-stat"><span class="stat-name">${escapeHtml(buffEffect.targetName)}</span><span class="stat-value ${colorClass}">${displaySign}${val}</span></div>`);
                    });
                }
            });
        }
        
        // Description at bottom
        const descriptionHtml = card.description 
            ? `<div class="card-description">${escapeHtml(card.description)}</div>` 
            : '';
        
        return `
            <div class="card ${cardType}" onclick="playCard(activeCards.find(c => c.id === ${card.id}))">
                <div class="card-header">
                    <span class="card-title">${escapeHtml(card.name)}</span>
                </div>
                <div class="card-stats">
                    ${statsHtml.join('')}
                </div>
                ${descriptionHtml}
            </div>
        `;
    }).join('');
}

function renderBuffs() {
    buffsContainer.innerHTML = activeBuffs.map(buff => {
        const effects = buff.effects?.map(e => {
            const val = e.effectType === 'percent' ? `${e.value}%` : `${e.value > 0 ? '+' : ''}${e.value}`;
            
            // Determine color based on target's colorLogic
            let colorClass = '';
            if (e.targetType === 'resource') {
                const target = resources.find(r => r.name === e.targetName);
                if (target?.colorLogic === 'neutral') colorClass = 'neutral';
                else if (target?.colorLogic === 'negative_is_good') colorClass = e.value < 0 ? 'good' : 'bad';
                else colorClass = e.value > 0 ? 'good' : 'bad';
            } else {
                const target = stats.find(s => s.name === e.targetName);
                if (target?.colorLogic === 'neutral') colorClass = 'neutral';
                else if (target?.colorLogic === 'negative_is_good') colorClass = e.value < 0 ? 'good' : 'bad';
                else colorClass = e.value > 0 ? 'good' : 'bad';
            }
            
            return `${e.targetName} <span class="${colorClass}">${val}</span>`;
        }).join(', ');
        const duration = buff.duration > 0 && buff.currentValue !== undefined ? `${buff.currentValue}t` : '∞';
        return `
            <div class="buff-item">
                <div class="buff-header">
                    <span class="buff-name">${escapeHtml(buff.name)}</span>
                    <span class="buff-duration">${duration}</span>
                </div>
                <div class="buff-effect">${effects}</div>
            </div>
        `;
    }).join('');
}

// ===== Drag and Drop =====

let draggedItem = null;
let draggedType = null;

function setupDragAndDrop(container, type) {
    const items = container.querySelectorAll('[draggable="true"]');
    
    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
    });
}

function handleDragStart(e) {
    draggedItem = this;
    draggedType = this.dataset.type;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    draggedItem = null;
    draggedType = null;
    
    // Remove all drag-over styles
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    if (this !== draggedItem && this.dataset.type === draggedType) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    if (this === draggedItem || this.dataset.type !== draggedType) return;
    
    const fromIndex = parseInt(draggedItem.dataset.index);
    const toIndex = parseInt(this.dataset.index);
    
    if (draggedType === 'resource') {
        // Reorder resources array
        const [moved] = resources.splice(fromIndex, 1);
        resources.splice(toIndex, 0, moved);
    } else if (draggedType === 'stat') {
        // Reorder stats array
        const [moved] = stats.splice(fromIndex, 1);
        stats.splice(toIndex, 0, moved);
    }
    
    // Save and re-render
    saveState();
    renderAll();
    
    // Re-setup drag and drop since elements were recreated
    if (editPanel?.classList.contains('visible')) {
        if (draggedType === 'resource') setupDragAndDrop(resourcesContainer, 'resource');
        if (draggedType === 'stat') setupDragAndDrop(statsContainer, 'stat');
    }
}

// ===== Utilities =====

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast show toast-${type}`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
