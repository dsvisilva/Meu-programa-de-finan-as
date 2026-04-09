// ── Firebase Config ───────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAfY-_-nFQIbNwvse30Ctbfsnq9b-FQnLA",
  authDomain:        "app-de-financas-do-davi.firebaseapp.com",
  projectId:         "app-de-financas-do-davi",
  storageBucket:     "app-de-financas-do-davi.firebasestorage.app",
  messagingSenderId: "784308862884",
  appId:             "1:784308862884:web:7f82582ecd9fa70f05cb31",
  measurementId:     "G-XWFEGCG9PB",
};

// ── Categorias padrão ─────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = {
  income: [
    { id: 'salario',      label: 'Salário',           icon: '💼', isDefault: true },
    { id: 'freelance',    label: 'Freelance',          icon: '💻', isDefault: true },
    { id: 'investimento', label: 'Investimento',       icon: '📈', isDefault: true },
    { id: 'aluguel_rec',  label: 'Aluguel recebido',   icon: '🏠', isDefault: true },
    { id: 'outros_rec',   label: 'Outros',             icon: '✨', isDefault: true },
  ],
  expense: [
    { id: 'moradia',      label: 'Moradia',            icon: '🏠', isDefault: true },
    { id: 'alimentacao',  label: 'Alimentação',        icon: '🍽️', isDefault: true },
    { id: 'transporte',   label: 'Transporte',         icon: '🚗', isDefault: true },
    { id: 'saude',        label: 'Saúde',              icon: '💊', isDefault: true },
    { id: 'lazer',        label: 'Lazer',              icon: '🎮', isDefault: true },
    { id: 'educacao',     label: 'Educação',           icon: '📚', isDefault: true },
    { id: 'vestuario',    label: 'Vestuário',          icon: '👗', isDefault: true },
    { id: 'streaming',    label: 'Streaming',          icon: '📺', isDefault: true },
    { id: 'outros_exp',   label: 'Outros',             icon: '📦', isDefault: true },
  ],
};

// ── Constantes ────────────────────────────────────────────────────────────────

const LS_KEY     = 'financas_sync_key';
const COLLECTION = 'financas';

// ── Estado global ─────────────────────────────────────────────────────────────

let state = {
  transactions:         [],
  budgets:              {},
  theme:                'light',
  customCategories:     { income: [], expense: [] },
  recurringTransactions: [],
  goals:                [],
  budgetAlertThreshold: 80,
};

let currentType    = 'income';
let currentRecType = 'income';
let editingGoalId  = null;
let goalContribId  = null;
let editingCatType = null;
let db             = null;
let syncKey        = null;
let isWriting      = false;
let syncReady      = false;

// ── Firebase ──────────────────────────────────────────────────────────────────

function initFirebase(config) {
  try {
    if (!firebase.apps.length) firebase.initializeApp(config);
    db = firebase.firestore();
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    return true;
  } catch (e) { console.error(e); return false; }
}

function startSync() {
  if (!db || !syncKey) return;
  setSyncing(true);

  db.collection(COLLECTION).doc(syncKey).onSnapshot(doc => {
    if (isWriting) { setSyncing(false); return; }
    if (doc.exists) {
      const remote = normalizeState(doc.data());
      if (JSON.stringify(remote) !== JSON.stringify(state)) {
        state = remote;
        applyTheme();
        renderAll();
        if (syncReady) showToast('📡 Sincronizado com outro dispositivo!');
      }
    } else {
      saveData();
    }
    syncReady = true;
    setSyncing(false);
    renderAll();
    processRecurringTransactions();
  }, err => {
    console.error(err);
    setSyncing(false, true);
    showToast('❌ Erro de sincronização');
  });
}

async function saveData() {
  if (!db || !syncKey) return;
  isWriting = true;
  setSyncing(true);
  try {
    await db.collection(COLLECTION).doc(syncKey).set(state);
  } catch (e) { showToast('❌ Erro ao salvar'); }
  isWriting = false;
  setTimeout(() => setSyncing(false), 600);
}

function normalizeState(s) {
  return {
    transactions:          Array.isArray(s.transactions) ? s.transactions : [],
    budgets:               (s.budgets && typeof s.budgets === 'object') ? s.budgets : {},
    theme:                 s.theme || 'light',
    customCategories:      s.customCategories || { income: [], expense: [] },
    recurringTransactions: Array.isArray(s.recurringTransactions) ? s.recurringTransactions : [],
    goals:                 Array.isArray(s.goals) ? s.goals : [],
    budgetAlertThreshold:  s.budgetAlertThreshold || 80,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

function loadData() {
  const savedKey = localStorage.getItem(LS_KEY);
  initFirebase(FIREBASE_CONFIG);
  if (savedKey) {
    syncKey = savedKey;
    applyTheme(); renderAll(); startSync();
    return;
  }
  document.getElementById('setupModal').classList.add('open');
  setSyncing(false, true); applyTheme(); renderAll();
}

function saveSetup() {
  const keyInput = document.getElementById('setup-key').value.trim().toLowerCase().replace(/\s+/g, '_');
  if (!keyInput)          { showToast('⚠️ Digite uma chave de sincronização'); return; }
  if (keyInput.length < 4){ showToast('⚠️ A chave precisa ter pelo menos 4 caracteres'); return; }
  localStorage.setItem(LS_KEY, keyInput);
  syncKey = keyInput;
  closeModal('setupModal');
  applyTheme(); renderAll(); startSync();
  showToast('✅ Conectado! Sincronizando dados...');
}

function openSyncSettings() {
  document.getElementById('setup-key').value = localStorage.getItem(LS_KEY) || '';
  document.getElementById('setupCancelBtn').style.display = syncKey ? '' : 'none';
  document.getElementById('setupModal').classList.add('open');
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function getAllCategories() {
  const custom = state.customCategories || { income: [], expense: [] };
  return {
    income:  [...DEFAULT_CATEGORIES.income,  ...(custom.income  || [])],
    expense: [...DEFAULT_CATEGORIES.expense, ...(custom.expense || [])],
  };
}

function getCatInfo(catId) {
  const all = getAllCategories();
  return [...all.income, ...all.expense].find(c => c.id === catId) || { label: catId, icon: '📌' };
}

function fmt(val) {
  return 'R$ ' + parseFloat(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthStr(date) { return date.toISOString().slice(0, 7); }

function pctDiff(current, previous) {
  if (previous === 0) return null;
  return ((current - previous) / previous * 100);
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastQueue = [];
let toastBusy  = false;

function showToast(msg) {
  toastQueue.push(msg);
  if (!toastBusy) flushToast();
}

function flushToast() {
  if (!toastQueue.length) { toastBusy = false; return; }
  toastBusy = true;
  const msg = toastQueue.shift();
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => { t.classList.remove('show'); setTimeout(flushToast, 300); }, 2800);
}

// ── Tema ──────────────────────────────────────────────────────────────────────

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme(); saveData();
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme || 'light');
  const btn = document.querySelector('[onclick="toggleTheme()"]');
  if (btn) btn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
}

// ── Sync status ───────────────────────────────────────────────────────────────

function setSyncing(val, offline = false) {
  const dot = document.getElementById('syncDot');
  const txt = document.getElementById('syncText');
  if (!dot || !txt) return;
  if (offline) { dot.className = 'sync-dot offline'; txt.textContent = 'Desconectado'; }
  else { dot.className = 'sync-dot' + (val ? ' syncing' : ''); txt.textContent = val ? 'Sincronizando...' : 'Sincronizado'; }
}

// ── Navegação ─────────────────────────────────────────────────────────────────

const ALL_TABS = ['dashboard', 'transactions', 'budgets', 'goals', 'config'];

function showTab(tab, el) {
  ALL_TABS.forEach(t => {
    document.getElementById('tab-' + t).style.display = t === tab ? '' : 'none';
  });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  if (tab === 'transactions') { populateFilters(); renderTransactions(); }
  if (tab === 'budgets')      renderBudgets();
  if (tab === 'goals')        renderGoals();
  if (tab === 'config')       renderConfig();
}

// ── Modais ────────────────────────────────────────────────────────────────────

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => {
    if (e.target !== o) return;
    if (o.id === 'setupModal' && !localStorage.getItem(LS_KEY)) return;
    o.classList.remove('open');
  });
});

// ── Tipo de transação ─────────────────────────────────────────────────────────

function setType(type) {
  currentType = type;
  document.getElementById('btn-income').className  = 'type-btn' + (type === 'income'  ? ' active-income'  : '');
  document.getElementById('btn-expense').className = 'type-btn' + (type === 'expense' ? ' active-expense' : '');
  populateCatSelect('tx-cat', type);
}

function setRecType(type) {
  currentRecType = type;
  document.getElementById('rec-btn-income').className  = 'type-btn' + (type === 'income'  ? ' active-income'  : '');
  document.getElementById('rec-btn-expense').className = 'type-btn' + (type === 'expense' ? ' active-expense' : '');
  populateCatSelect('rec-cat', type);
}

function populateCatSelect(selectId, type) {
  const cats = getAllCategories()[type] || [];
  const sel  = document.getElementById(selectId);
  sel.innerHTML = '<option value="">Selecione...</option>' +
    cats.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
}

// ── Transações ────────────────────────────────────────────────────────────────

function openAddModal() {
  setType('income');
  document.getElementById('tx-desc').value   = '';
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-date').value   = todayStr();
  document.getElementById('addModal').classList.add('open');
}

function saveTransaction() {
  const desc   = document.getElementById('tx-desc').value.trim();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const cat    = document.getElementById('tx-cat').value;
  const date   = document.getElementById('tx-date').value;

  if (!desc || !amount || amount <= 0 || !cat || !date) { showToast('⚠️ Preencha todos os campos'); return; }

  state.transactions.push({ id: Date.now().toString(), type: currentType, desc, amount, cat, date });
  state.transactions.sort((a, b) => b.date.localeCompare(a.date));
  closeModal('addModal');
  saveData(); renderAll();
  showToast('✅ Transação salva!');
  checkBudgetAlerts();
}

function deleteTransaction(id) {
  if (!confirm('Remover esta transação?')) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveData(); renderAll();
  showToast('🗑️ Transação removida');
}

// ── Alertas de orçamento ──────────────────────────────────────────────────────

function checkBudgetAlerts() {
  const now       = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const expenses  = {};
  state.transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(thisMonth))
    .forEach(t => { expenses[t.cat] = (expenses[t.cat] || 0) + t.amount; });

  const threshold = state.budgetAlertThreshold || 80;
  Object.entries(state.budgets || {}).forEach(([cat, limit]) => {
    const spent = expenses[cat] || 0;
    const pct   = (spent / limit) * 100;
    const info  = getCatInfo(cat);
    if (spent > limit) {
      showToast(`🚨 ${info.label}: limite ultrapassado!`);
    } else if (pct >= threshold) {
      showToast(`⚡ ${info.label}: ${pct.toFixed(0)}% do orçamento usado`);
    }
  });
}

function saveAlertThreshold() {
  state.budgetAlertThreshold = parseInt(document.getElementById('alertThresholdSelect').value);
  saveData();
}

// ── Orçamentos ────────────────────────────────────────────────────────────────

function openBudgetModal() {
  const cats = getAllCategories().expense;
  document.getElementById('budget-cat').innerHTML =
    cats.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
  document.getElementById('budget-amount').value = '';
  document.getElementById('budgetModal').classList.add('open');
}

function saveBudget() {
  const cat    = document.getElementById('budget-cat').value;
  const amount = parseFloat(document.getElementById('budget-amount').value);
  if (!cat || !amount || amount <= 0) { showToast('⚠️ Preencha os campos'); return; }
  state.budgets[cat] = amount;
  closeModal('budgetModal');
  saveData(); renderBudgets();
  showToast('✅ Orçamento definido!');
}

function deleteBudget(cat) {
  if (!confirm('Remover este orçamento?')) return;
  delete state.budgets[cat];
  saveData(); renderBudgets();
  showToast('🗑️ Orçamento removido');
}

// ── Metas financeiras ─────────────────────────────────────────────────────────

function openGoalModal(id = null) {
  editingGoalId = id;
  const goal = id ? (state.goals || []).find(g => g.id === id) : null;
  document.getElementById('goalModalTitle').textContent = id ? 'Editar meta' : 'Nova meta';
  document.getElementById('goal-icon').value     = goal?.icon    || '🎯';
  document.getElementById('goal-name').value     = goal?.name    || '';
  document.getElementById('goal-target').value   = goal?.target  || '';
  document.getElementById('goal-saved').value    = goal?.saved   || '';
  document.getElementById('goal-deadline').value = goal?.deadline || '';
  document.getElementById('goalModal').classList.add('open');
}

function saveGoal() {
  const icon     = document.getElementById('goal-icon').value.trim()  || '🎯';
  const name     = document.getElementById('goal-name').value.trim();
  const target   = parseFloat(document.getElementById('goal-target').value);
  const saved    = parseFloat(document.getElementById('goal-saved').value)  || 0;
  const deadline = document.getElementById('goal-deadline').value;

  if (!name || !target || target <= 0) { showToast('⚠️ Preencha nome e valor da meta'); return; }

  if (!state.goals) state.goals = [];
  if (editingGoalId) {
    const idx = state.goals.findIndex(g => g.id === editingGoalId);
    if (idx >= 0) state.goals[idx] = { ...state.goals[idx], icon, name, target, saved, deadline };
  } else {
    state.goals.push({ id: Date.now().toString(), icon, name, target, saved, deadline });
  }
  closeModal('goalModal');
  saveData(); renderGoals();
  showToast('✅ Meta salva!');
}

function deleteGoal(id) {
  if (!confirm('Remover esta meta?')) return;
  state.goals = (state.goals || []).filter(g => g.id !== id);
  saveData(); renderGoals();
  showToast('🗑️ Meta removida');
}

function openGoalContrib(id) {
  goalContribId = id;
  const goal = (state.goals || []).find(g => g.id === id);
  if (!goal) return;
  document.getElementById('goalContribLabel').textContent =
    `Adicionar à meta "${goal.name}" (atual: ${fmt(goal.saved)})`;
  document.getElementById('goal-contrib').value = '';
  document.getElementById('goalContribModal').classList.add('open');
}

function applyGoalContrib() {
  const amount = parseFloat(document.getElementById('goal-contrib').value);
  if (!amount || amount <= 0) { showToast('⚠️ Digite um valor válido'); return; }
  const goal = (state.goals || []).find(g => g.id === goalContribId);
  if (!goal) return;
  goal.saved = (goal.saved || 0) + amount;
  closeModal('goalContribModal');
  saveData(); renderGoals();
  if (goal.saved >= goal.target) {
    showToast(`🏆 Parabéns! Meta "${goal.name}" concluída!`);
  } else {
    showToast(`✅ ${fmt(amount)} adicionado à meta!`);
  }
}

// ── Transações recorrentes ────────────────────────────────────────────────────

function openRecurringModal() {
  setRecType('income');
  document.getElementById('rec-desc').value  = '';
  document.getElementById('rec-amount').value = '';
  document.getElementById('rec-freq').value  = 'monthly';
  document.getElementById('rec-start').value = todayStr();
  populateDaySelect();
  updateRecurringFields();
  document.getElementById('recurringModal').classList.add('open');
}

function populateDaySelect() {
  const sel = document.getElementById('rec-day');
  sel.innerHTML = Array.from({ length: 31 }, (_, i) =>
    `<option value="${i + 1}">${i + 1}</option>`).join('');
}

function updateRecurringFields() {
  const freq = document.getElementById('rec-freq').value;
  const dayField   = document.getElementById('rec-day-field');
  const dayLabel   = document.getElementById('rec-day-label');
  const monthField = document.getElementById('rec-month-field');

  if (freq === 'monthly') {
    dayField.style.display   = '';
    monthField.style.display = 'none';
    dayLabel.textContent     = 'Dia do mês';
    populateDaySelect();
  } else if (freq === 'weekly') {
    dayField.style.display   = '';
    monthField.style.display = 'none';
    dayLabel.textContent     = 'Dia da semana';
    document.getElementById('rec-day').innerHTML = `
      <option value="0">Domingo</option><option value="1">Segunda</option>
      <option value="2">Terça</option><option value="3">Quarta</option>
      <option value="4">Quinta</option><option value="5">Sexta</option>
      <option value="6">Sábado</option>`;
  } else if (freq === 'yearly') {
    dayField.style.display   = '';
    monthField.style.display = '';
    dayLabel.textContent     = 'Dia';
    populateDaySelect();
  }
}

function saveRecurring() {
  const desc   = document.getElementById('rec-desc').value.trim();
  const amount = parseFloat(document.getElementById('rec-amount').value);
  const cat    = document.getElementById('rec-cat').value;
  const freq   = document.getElementById('rec-freq').value;
  const day    = parseInt(document.getElementById('rec-day').value);
  const month  = parseInt(document.getElementById('rec-month').value) || 1;
  const start  = document.getElementById('rec-start').value;

  if (!desc || !amount || amount <= 0 || !cat || !start) { showToast('⚠️ Preencha todos os campos'); return; }

  if (!state.recurringTransactions) state.recurringTransactions = [];
  state.recurringTransactions.push({
    id: Date.now().toString(),
    type: currentRecType, desc, amount, cat, freq,
    day, month, startDate: start,
    lastGenerated: null, active: true,
  });
  closeModal('recurringModal');
  saveData(); renderConfig();
  showToast('✅ Transação recorrente criada!');
}

function toggleRecurring(id) {
  const rec = (state.recurringTransactions || []).find(r => r.id === id);
  if (!rec) return;
  rec.active = !rec.active;
  saveData(); renderConfig();
}

function deleteRecurring(id) {
  if (!confirm('Remover esta transação recorrente?')) return;
  state.recurringTransactions = (state.recurringTransactions || []).filter(r => r.id !== id);
  saveData(); renderConfig();
  showToast('🗑️ Recorrente removida');
}

function processRecurringTransactions() {
  const recurring = state.recurringTransactions || [];
  const today     = todayStr();
  const todayDate = new Date(today + 'T00:00:00');
  let changed = false;

  recurring.forEach(r => {
    if (!r.active) return;
    const startDate = new Date(r.startDate + 'T00:00:00');
    if (todayDate < startDate) return;

    let shouldGenerate = false;
    let genKey = '';

    if (r.freq === 'monthly') {
      const monthKey = today.slice(0, 7);
      genKey = monthKey;
      if (r.lastGenerated !== monthKey && todayDate.getDate() >= r.day) {
        shouldGenerate = true;
      }
    } else if (r.freq === 'weekly') {
      const weekKey = getISOWeekKey(todayDate);
      genKey = weekKey;
      if (r.lastGenerated !== weekKey && todayDate.getDay() === r.day) {
        shouldGenerate = true;
      }
    } else if (r.freq === 'yearly') {
      const yearKey = today.slice(0, 4);
      genKey = yearKey;
      const m = todayDate.getMonth() + 1;
      const d = todayDate.getDate();
      if (r.lastGenerated !== yearKey && m >= r.month && d >= r.day) {
        shouldGenerate = true;
      }
    }

    if (shouldGenerate) {
      state.transactions.push({
        id:          Date.now().toString() + '_' + Math.random().toString(36).slice(2),
        type:        r.type,
        desc:        r.desc + ' 🔁',
        amount:      r.amount,
        cat:         r.cat,
        date:        today,
        isRecurring: true,
      });
      r.lastGenerated = genKey;
      changed = true;
    }
  });

  if (changed) {
    state.transactions.sort((a, b) => b.date.localeCompare(a.date));
    saveData(); renderAll();
    showToast('🔁 Transações recorrentes geradas!');
  }
}

function getISOWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - new Date(Date.UTC(year, 0, 1))) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// ── Categorias personalizadas ─────────────────────────────────────────────────

function openCategoryModal(type) {
  editingCatType = type;
  document.getElementById('categoryModalTitle').textContent =
    type === 'income' ? 'Nova categoria de Receita' : 'Nova categoria de Despesa';
  document.getElementById('cat-icon').value = '';
  document.getElementById('cat-name').value = '';
  document.getElementById('categoryModal').classList.add('open');
}

function saveCustomCategory() {
  const icon = document.getElementById('cat-icon').value.trim() || '📌';
  const name = document.getElementById('cat-name').value.trim();
  if (!name) { showToast('⚠️ Digite o nome da categoria'); return; }

  if (!state.customCategories) state.customCategories = { income: [], expense: [] };
  if (!state.customCategories[editingCatType]) state.customCategories[editingCatType] = [];

  const id = 'custom_' + Date.now();
  state.customCategories[editingCatType].push({ id, label: name, icon });
  closeModal('categoryModal');
  saveData(); renderConfig();
  showToast('✅ Categoria criada!');
}

function deleteCustomCategory(type, id) {
  if (!confirm('Remover esta categoria?')) return;
  state.customCategories[type] = (state.customCategories[type] || []).filter(c => c.id !== id);
  saveData(); renderConfig();
  showToast('🗑️ Categoria removida');
}

// ── Exportação CSV ────────────────────────────────────────────────────────────

function exportCSV() {
  const type  = document.getElementById('filterType')?.value  || '';
  const cat   = document.getElementById('filterCat')?.value   || '';
  const month = document.getElementById('filterMonth')?.value || '';

  let txs = state.transactions || [];
  if (type)  txs = txs.filter(t => t.type === type);
  if (cat)   txs = txs.filter(t => t.cat  === cat);
  if (month) txs = txs.filter(t => t.date.startsWith(month));

  const header = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor'];
  const rows   = txs.map(t => [
    t.date,
    t.type === 'income' ? 'Receita' : 'Despesa',
    `"${t.desc.replace(/"/g, '""')}"`,
    getCatInfo(t.cat).label,
    t.amount.toFixed(2).replace('.', ','),
  ]);

  const csv  = [header, ...rows].map(r => r.join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `financas-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬇️ CSV exportado!');
}

// ── Renderização ──────────────────────────────────────────────────────────────

function renderAll() {
  renderSummary();
  renderComparison();
  renderChart();
  renderRecent();
}

// ── Summary ───────────────────────────────────────────────────────────────────

function renderSummary() {
  const now       = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const txs       = state.transactions || [];
  const txMonth   = txs.filter(t => t.date.startsWith(thisMonth));
  const income    = txMonth.filter(t => t.type === 'income') .reduce((s, t) => s + t.amount, 0);
  const expense   = txMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance   = income - expense;
  const total     = txs.reduce((s, t) => t.type === 'income' ? s + t.amount : s - t.amount, 0);
  const month     = now.toLocaleDateString('pt-BR', { month: 'long' });

  document.getElementById('summaryCards').innerHTML = `
    <div class="summary-card">
      <div class="summary-label">Saldo total</div>
      <div class="summary-value ${total >= 0 ? 'blue' : 'red'}">${fmt(total)}</div>
      <div class="summary-sub">Acumulado</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Receitas (${month})</div>
      <div class="summary-value green">${fmt(income)}</div>
      <div class="summary-sub">${txMonth.filter(t => t.type === 'income').length} transações</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Despesas (${month})</div>
      <div class="summary-value red">${fmt(expense)}</div>
      <div class="summary-sub">${txMonth.filter(t => t.type === 'expense').length} transações</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Resultado (${month})</div>
      <div class="summary-value ${balance >= 0 ? 'green' : 'red'}">${fmt(balance)}</div>
      <div class="summary-sub">${balance >= 0 ? 'Superávit ✓' : 'Déficit ⚠'}</div>
    </div>`;
}

// ── Comparação mensal ─────────────────────────────────────────────────────────

function renderComparison() {
  const now       = new Date();
  const thisM     = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevM     = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const txs       = state.transactions || [];

  function sum(month, type) {
    return txs.filter(t => t.type === type && t.date.startsWith(month)).reduce((s, t) => s + t.amount, 0);
  }

  const thisIncome  = sum(thisM, 'income');
  const thisExpense = sum(thisM, 'expense');
  const thisBalance = thisIncome - thisExpense;
  const prevIncome  = sum(prevM, 'income');
  const prevExpense = sum(prevM, 'expense');
  const prevBalance = prevIncome - prevExpense;

  const prevName = prevDate.toLocaleDateString('pt-BR', { month: 'long' });

  function diffBadge(current, previous, higherIsBetter = true) {
    const d = pctDiff(current, previous);
    if (d === null) return '<span class="comparison-diff neutral">—</span>';
    const positive = higherIsBetter ? d >= 0 : d <= 0;
    const cls  = positive ? 'up' : 'down';
    const sign = d >= 0 ? '+' : '';
    return `<span class="comparison-diff ${cls}">${sign}${d.toFixed(1)}%</span>`;
  }

  document.getElementById('comparisonBody').innerHTML = `
    <div class="comparison-grid">
      <div class="comparison-item">
        <div class="comparison-label">Receitas</div>
        <div class="comparison-value" style="color:var(--green)">${fmt(thisIncome)}</div>
        ${diffBadge(thisIncome, prevIncome, true)}
      </div>
      <div class="comparison-item">
        <div class="comparison-label">Despesas</div>
        <div class="comparison-value" style="color:var(--red)">${fmt(thisExpense)}</div>
        ${diffBadge(thisExpense, prevExpense, false)}
      </div>
      <div class="comparison-item">
        <div class="comparison-label">Resultado</div>
        <div class="comparison-value" style="color:var(--blue)">${fmt(thisBalance)}</div>
        ${diffBadge(thisBalance, prevBalance, true)}
      </div>
    </div>
    <div style="padding:6px 1.25rem 10px;font-size:11px;color:var(--muted)">
      vs. ${prevName}
    </div>`;
}

// ── Gráfico de barras ─────────────────────────────────────────────────────────

function renderChart() {
  const months = {};
  (state.transactions || []).forEach(t => {
    const k = t.date.slice(0, 7);
    if (!months[k]) months[k] = { income: 0, expense: 0 };
    months[k][t.type] += t.amount;
  });
  const keys = Object.keys(months).sort().slice(-6);

  if (!keys.length) {
    document.getElementById('monthlyChart').innerHTML =
      '<div class="empty"><div class="empty-icon">📊</div>Nenhum dado ainda</div>';
    return;
  }

  const maxVal = Math.max(...keys.map(k => Math.max(months[k].income, months[k].expense)), 1);
  document.getElementById('monthlyChart').innerHTML = keys.map(k => {
    const label = new Date(k + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    const ip = (months[k].income  / maxVal * 100).toFixed(1);
    const ep = (months[k].expense / maxVal * 100).toFixed(1);
    return `<div style="margin-bottom:14px">
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px;font-weight:500">${label}</div>
      <div class="bar-row" style="margin-bottom:4px">
        <div class="bar-label" style="color:var(--green);font-size:11px">Receita</div>
        <div class="bar-track"><div class="bar-fill income" style="width:${ip}%"></div></div>
        <div class="bar-val" style="color:var(--green)">${fmt(months[k].income)}</div>
      </div>
      <div class="bar-row">
        <div class="bar-label" style="color:var(--red);font-size:11px">Despesa</div>
        <div class="bar-track"><div class="bar-fill expense" style="width:${ep}%"></div></div>
        <div class="bar-val" style="color:var(--red)">${fmt(months[k].expense)}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Transações recentes ───────────────────────────────────────────────────────

function txHTML(t) {
  const cat = getCatInfo(t.cat);
  const d   = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
  const bg  = t.type === 'income' ? 'var(--green-bg)' : 'var(--red-bg)';
  return `<li class="tx-item">
    <div class="tx-icon" style="background:${bg}">${cat.icon}</div>
    <div class="tx-info">
      <div class="tx-desc">${t.desc}</div>
      <div class="tx-meta">${cat.label} · ${d}</div>
    </div>
    <div class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '−'}${fmt(t.amount)}</div>
    <button class="tx-delete" onclick="deleteTransaction('${t.id}')">🗑</button>
  </li>`;
}

function renderRecent() {
  const recent = (state.transactions || []).slice(0, 5);
  document.getElementById('recentList').innerHTML = recent.length
    ? recent.map(txHTML).join('')
    : `<div class="empty"><div class="empty-icon">💳</div>Nenhuma transação ainda<br><br>
       <button class="btn btn-primary" onclick="openAddModal()">Adicionar primeira transação</button></div>`;
}

// ── Filtros + lista de transações ─────────────────────────────────────────────

function populateFilters() {
  const txs  = state.transactions || [];
  const cats = new Set(txs.map(t => t.cat));
  document.getElementById('filterCat').innerHTML =
    '<option value="">Todas as categorias</option>' +
    [...cats].map(c => { const i = getCatInfo(c); return `<option value="${c}">${i.icon} ${i.label}</option>`; }).join('');

  const months = [...new Set(txs.map(t => t.date.slice(0, 7)))].sort().reverse();
  document.getElementById('filterMonth').innerHTML =
    '<option value="">Todos os meses</option>' +
    months.map(m => {
      const d = new Date(m + '-01');
      return `<option value="${m}">${d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</option>`;
    }).join('');
}

function renderTransactions() {
  const type  = document.getElementById('filterType').value;
  const cat   = document.getElementById('filterCat').value;
  const month = document.getElementById('filterMonth').value;
  let txs = state.transactions || [];
  if (type)  txs = txs.filter(t => t.type === type);
  if (cat)   txs = txs.filter(t => t.cat  === cat);
  if (month) txs = txs.filter(t => t.date.startsWith(month));
  document.getElementById('allTxList').innerHTML = txs.length
    ? txs.map(txHTML).join('')
    : '<div class="empty"><div class="empty-icon">🔍</div>Nenhuma transação encontrada</div>';
}

// ── Orçamentos ────────────────────────────────────────────────────────────────

function renderBudgets() {
  const now       = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const expenses  = {};
  (state.transactions || [])
    .filter(t => t.type === 'expense' && t.date.startsWith(thisMonth))
    .forEach(t => { expenses[t.cat] = (expenses[t.cat] || 0) + t.amount; });

  const threshold = state.budgetAlertThreshold || 80;
  const sel = document.getElementById('alertThresholdSelect');
  if (sel) sel.value = threshold;

  const b         = state.budgets || {};
  const container = document.getElementById('budgetList');

  if (!Object.keys(b).length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">🎯</div>Nenhum orçamento definido<br><br>
      <button class="btn btn-primary" onclick="openBudgetModal()">Definir primeiro orçamento</button></div>`;
    return;
  }

  container.innerHTML = Object.entries(b).map(([cat, limit]) => {
    const spent = expenses[cat] || 0;
    const pct   = Math.min((spent / limit) * 100, 100);
    const info  = getCatInfo(cat);
    const over  = spent > limit;
    const warn  = !over && (spent / limit * 100) >= threshold;
    const color = over ? 'var(--red)' : warn ? 'var(--amber)' : 'var(--green)';

    return `<div class="budget-item">
      <div class="budget-top">
        <div class="budget-name">${info.icon} ${info.label} ${over ? '🚨' : warn ? '⚡' : ''}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="budget-values" style="color:${color};font-weight:600">${fmt(spent)} / ${fmt(limit)}</div>
          <button class="btn btn-ghost btn-sm" onclick="deleteBudget('${cat}')">🗑</button>
        </div>
      </div>
      <div class="budget-bar-track">
        <div class="budget-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      ${over ? `<div class="budget-warning">⚠️ Ultrapassado em ${fmt(spent - limit)}</div>` : ''}
      ${warn && !over ? `<div class="budget-warning" style="color:var(--amber)">⚡ ${pct.toFixed(0)}% do limite usado</div>` : ''}
    </div>`;
  }).join('');
}

// ── Metas ─────────────────────────────────────────────────────────────────────

function renderGoals() {
  const goals     = state.goals || [];
  const container = document.getElementById('goalList');

  if (!goals.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">🏆</div>Nenhuma meta criada<br><br>
      <button class="btn btn-primary" onclick="openGoalModal()">Criar primeira meta</button></div>`;
    return;
  }

  container.innerHTML = goals.map(g => {
    const pct      = Math.min(((g.saved || 0) / g.target) * 100, 100);
    const done     = (g.saved || 0) >= g.target;
    const deadline = g.deadline
      ? new Date(g.deadline + 'T00:00:00').toLocaleDateString('pt-BR')
      : null;

    let daysLeft = '';
    if (g.deadline && !done) {
      const diff = Math.ceil((new Date(g.deadline) - new Date()) / 86400000);
      daysLeft   = diff > 0 ? `${diff} dias restantes` : '⚠️ Prazo vencido';
    }

    return `<div class="goal-item">
      <div class="goal-top">
        <div class="goal-icon-circle">${g.icon || '🎯'}</div>
        <div class="goal-info">
          <div class="goal-name">${g.name} ${done ? '✅' : ''}</div>
          <div class="goal-deadline">${deadline ? `Prazo: ${deadline}` : ''} ${daysLeft ? `· ${daysLeft}` : ''}</div>
        </div>
        <div class="goal-amounts">
          <div class="goal-saved">${fmt(g.saved || 0)}</div>
          <div class="goal-target">de ${fmt(g.target)}</div>
        </div>
      </div>
      <div class="goal-bar-track">
        <div class="goal-bar-fill ${done ? 'done' : ''}" style="width:${pct}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
        <span style="font-size:12px;color:var(--muted)">${pct.toFixed(0)}% concluído</span>
        <div class="goal-actions">
          <button class="btn btn-primary btn-sm" onclick="openGoalContrib('${g.id}')">💰 Adicionar</button>
          <button class="btn btn-ghost btn-sm"   onclick="openGoalModal('${g.id}')">✏️</button>
          <button class="btn btn-ghost btn-sm"   onclick="deleteGoal('${g.id}')">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Config ────────────────────────────────────────────────────────────────────

function renderConfig() {
  renderRecurringList();
  renderCategoryLists();
}

function renderRecurringList() {
  const recurring = state.recurringTransactions || [];
  const container = document.getElementById('recurringList');

  if (!recurring.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">🔁</div>Nenhuma transação recorrente<br><br>
      <button class="btn btn-primary" onclick="openRecurringModal()">Adicionar</button></div>`;
    return;
  }

  const freqLabel = { monthly: 'Mensal', weekly: 'Semanal', yearly: 'Anual' };
  container.innerHTML = recurring.map(r => {
    const cat   = getCatInfo(r.cat);
    const sign  = r.type === 'income' ? '+' : '−';
    const color = r.type === 'income' ? 'income' : 'expense';
    return `<div class="recurring-item">
      <div class="tx-icon" style="background:${r.type === 'income' ? 'var(--green-bg)' : 'var(--red-bg)'}">
        ${cat.icon}
      </div>
      <div class="recurring-info">
        <div class="recurring-desc">${r.desc}</div>
        <div class="recurring-meta">${cat.label} · ${freqLabel[r.freq] || r.freq}</div>
      </div>
      <div class="recurring-amount ${color}">${sign}${fmt(r.amount)}</div>
      <div class="toggle ${r.active ? 'on' : ''}" onclick="toggleRecurring('${r.id}')" title="${r.active ? 'Ativa' : 'Pausada'}"></div>
      <button class="tx-delete" style="opacity:1" onclick="deleteRecurring('${r.id}')">🗑</button>
    </div>`;
  }).join('');
}

function renderCategoryLists() {
  const custom = state.customCategories || { income: [], expense: [] };

  function catRowHTML(c, type, isDefault) {
    return `<div class="cat-row">
      <div class="cat-row-icon">${c.icon}</div>
      <div class="cat-row-label">${c.label}</div>
      ${isDefault
        ? '<span class="cat-row-badge">padrão</span>'
        : `<button class="btn btn-ghost btn-sm" onclick="deleteCustomCategory('${type}','${c.id}')">🗑</button>`}
    </div>`;
  }

  ['income', 'expense'].forEach(type => {
    const defaults = DEFAULT_CATEGORIES[type].map(c => catRowHTML(c, type, true));
    const customs  = (custom[type] || []).map(c => catRowHTML(c, type, false));
    const listId   = type === 'income' ? 'catIncomeList' : 'catExpenseList';
    document.getElementById(listId).innerHTML = [...defaults, ...customs].join('') ||
      '<div class="empty" style="padding:1rem">Nenhuma categoria</div>';
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

loadData();

// ── Service Worker (PWA) ──────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
