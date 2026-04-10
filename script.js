// ══════════════════════════════════════════════════════════════════════════════
// AUTENTICAÇÃO — Firebase Auth (email/senha + Google)
// ══════════════════════════════════════════════════════════════════════════════

// ── Variáveis de auth ─────────────────────────────────────────────────────────
let auth       = null;
let authMode   = 'login'; // 'login' | 'register'

// ── Inicializa auth e observa estado ─────────────────────────────────────────
function initAuth() {
  auth = firebase.auth();

  // Resolve redirect do Google (caso tenha sido redirecionado)
  auth.getRedirectResult().catch(() => {});

  auth.onAuthStateChanged(user => {
    if (user) {
      syncKey = user.uid;
      renderUserUI(user);
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appRoot').style.display     = 'block';
      startSync();
    } else {
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('appRoot').style.display     = 'none';
      setSyncing(false, true);
    }
  });
}

// ── UI do usuário no header ───────────────────────────────────────────────────
function renderUserUI(user) {
  const name    = user.displayName || user.email?.split('@')[0] || 'Usuário';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('userAvatar').textContent  = initials;
  document.getElementById('menuUserName').textContent = name;
  document.getElementById('menuUserEmail').textContent = user.email || '';
}

function toggleUserMenu() {
  const m = document.getElementById('userMenu');
  m.style.display = m.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', e => {
  const menu   = document.getElementById('userMenu');
  const avatar = document.getElementById('userAvatar');
  if (menu && avatar && !menu.contains(e.target) && !avatar.contains(e.target)) {
    menu.style.display = 'none';
  }
});

// ── Login com email/senha ─────────────────────────────────────────────────────
function switchAuthTab(mode) {
  authMode = mode;
  document.getElementById('tabLogin').classList.toggle('active',    mode === 'login');
  document.getElementById('tabRegister').classList.toggle('active', mode === 'register');
  document.getElementById('confirmPasswordField').style.display = mode === 'register' ? '' : 'none';
  document.getElementById('authSubmitBtn').textContent = mode === 'login' ? 'Entrar' : 'Criar conta';
  document.getElementById('forgotBtn').style.display   = mode === 'login' ? 'block' : 'none';
  hideAuthError();
}

function submitAuth() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const confirm  = document.getElementById('auth-confirm').value;

  if (!email || !password) { showAuthError('Preencha email e senha.'); return; }
  if (authMode === 'register') {
    if (password.length < 6)    { showAuthError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (password !== confirm)    { showAuthError('As senhas não coincidem.'); return; }
    auth.createUserWithEmailAndPassword(email, password).catch(e => showAuthError(firebaseAuthError(e.code)));
  } else {
    auth.signInWithEmailAndPassword(email, password).catch(e => showAuthError(firebaseAuthError(e.code)));
  }
}

// ── Login com Google ──────────────────────────────────────────────────────────
function loginGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  // Tenta popup; se bloqueado (mobile PWA), usa redirect
  auth.signInWithPopup(provider).catch(err => {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request') {
      auth.signInWithRedirect(provider);
    } else {
      showAuthError(firebaseAuthError(err.code));
    }
  });
}

// ── Recuperação de senha ──────────────────────────────────────────────────────
function forgotPassword() {
  document.getElementById('loginFormWrap').style.display  = 'none';
  document.getElementById('resetFormWrap').style.display  = 'block';
  document.getElementById('reset-email').value = document.getElementById('auth-email').value;
}

function showLoginForm() {
  document.getElementById('loginFormWrap').style.display  = 'block';
  document.getElementById('resetFormWrap').style.display  = 'none';
}

function sendReset() {
  const email = document.getElementById('reset-email').value.trim();
  if (!email) { showResetMsg('Digite seu email.', true); return; }
  auth.sendPasswordResetEmail(email)
    .then(() => showResetMsg('✅ Email enviado! Verifique sua caixa de entrada.', false))
    .catch(e => showResetMsg(firebaseAuthError(e.code), true));
}

function showResetMsg(msg, isError) {
  const el = document.getElementById('resetMsg');
  el.textContent = msg;
  el.style.display = 'block';
  el.style.color   = isError ? 'var(--red)' : 'var(--green)';
  el.style.background = isError ? 'var(--red-bg)' : 'var(--green-bg)';
}

// ── Logout ────────────────────────────────────────────────────────────────────
function logout() {
  if (!confirm('Sair da conta?')) return;
  auth.signOut().then(() => {
    syncKey   = null;
    syncReady = false;
    state     = { transactions: [], budgets: {}, theme: 'light',
                  customCategories: { income: [], expense: [] },
                  recurringTransactions: [], goals: [], budgetAlertThreshold: 80,
                  onboardingDone: false };
    document.getElementById('userMenu').style.display = 'none';
  });
}

// ── Mensagens de erro amigáveis ───────────────────────────────────────────────
function firebaseAuthError(code) {
  const msgs = {
    'auth/user-not-found':      'Usuário não encontrado.',
    'auth/wrong-password':      'Senha incorreta.',
    'auth/email-already-in-use':'Este email já está em uso.',
    'auth/invalid-email':       'Email inválido.',
    'auth/weak-password':       'Senha muito fraca.',
    'auth/too-many-requests':   'Muitas tentativas. Tente mais tarde.',
    'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
    'auth/invalid-credential':  'Email ou senha incorretos.',
  };
  return msgs[code] || 'Erro ao autenticar. Tente novamente.';
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.classList.add('show');
}

function hideAuthError() {
  document.getElementById('authError').classList.remove('show');
}

// ── Enter para submeter login ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('loginScreen').style.display !== 'none') {
    if (document.getElementById('resetFormWrap').style.display !== 'none') {
      sendReset();
    } else {
      submitAuth();
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

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
  onboardingDone:       false,
};

let currentType       = 'income';
let currentRecType    = 'income';
let editingGoalId     = null;
let goalContribId     = null;
let editingCatType    = null;
let editingTxId       = null;
let db                = null;
let syncKey           = null;
let isWriting         = false;
let syncReady         = false;
let monthlyChartInst  = null;
let pieChartInst      = null;

// Paleta de cores para o gráfico de categorias
const PIE_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#06b6d4','#84cc16','#f97316','#6366f1',
  '#14b8a6','#a855f7','#eab308','#64748b','#0ea5e9',
];

// ── Firebase ──────────────────────────────────────────────────────────────────

function initFirebase(config) {
  try {
    if (!firebase.apps.length) firebase.initializeApp(config);
    db = firebase.firestore();
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    initAuth(); // inicializa autenticação
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
        if (syncReady) showToast('Sincronizado com outro dispositivo');
      }
    } else {
      saveData();
    }
    syncReady = true;
    setSyncing(false);
    renderAll();
    processRecurringTransactions();
    checkOnboarding();
    requestNotificationPermission();
  }, err => {
    console.error(err);
    setSyncing(false, true);
    showToast('Erro de sincronização');
  });
}

async function saveData() {
  if (!db || !syncKey) return;
  isWriting = true;
  setSyncing(true);
  try {
    await db.collection(COLLECTION).doc(syncKey).set(state);
  } catch (e) { showToast('Erro ao salvar'); }
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
    onboardingDone:        s.onboardingDone || false,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

function loadData() {
  initFirebase(FIREBASE_CONFIG);
  // A autenticação via onAuthStateChanged cuida do resto
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
  applyTheme();
  renderChart();
  renderPieChart();
  saveData();
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme || 'light');
  const label = document.getElementById('themeLabel');
  if (label) label.textContent = state.theme === 'dark' ? 'Tema claro' : 'Tema escuro';
  const icon = document.getElementById('themeIcon');
  if (icon && state.theme === 'dark') {
    icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  } else if (icon) {
    icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  }
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

function openAddModal(id = null) {
  editingTxId = id;
  const tx = id ? (state.transactions || []).find(t => t.id === id) : null;

  setType(tx ? tx.type : 'income');
  document.getElementById('tx-desc').value   = tx ? tx.desc : '';
  document.getElementById('tx-amount').value = tx ? tx.amount : '';
  document.getElementById('tx-date').value   = tx ? tx.date : todayStr();
  if (tx) populateCatSelect('tx-cat', tx.type);
  if (tx) document.getElementById('tx-cat').value = tx.cat;

  const installCheck = document.getElementById('tx-is-installment');
  if (installCheck) installCheck.checked = false;
  const installWrap = document.getElementById('tx-installment-wrap');
  if (installWrap) installWrap.style.display = 'none';
  const installNum = document.getElementById('tx-installments');
  if (installNum) installNum.value = '';

  document.querySelector('#addModal .modal-title').textContent = id ? 'Editar transação' : 'Nova transação';
  document.getElementById('addModal').classList.add('open');
}

function toggleInstallmentField() {
  const checked = document.getElementById('tx-is-installment').checked;
  document.getElementById('tx-installment-wrap').style.display = checked ? '' : 'none';
}

function saveTransaction() {
  const desc       = document.getElementById('tx-desc').value.trim();
  const amount     = parseFloat(document.getElementById('tx-amount').value);
  const cat        = document.getElementById('tx-cat').value;
  const date       = document.getElementById('tx-date').value;
  const isInstall  = document.getElementById('tx-is-installment')?.checked;
  const numInstall = parseInt(document.getElementById('tx-installments')?.value) || 1;

  if (!desc || !amount || amount <= 0 || !cat || !date) { showToast('Preencha todos os campos'); return; }

  if (editingTxId) {
    const idx = state.transactions.findIndex(t => t.id === editingTxId);
    if (idx >= 0) {
      state.transactions[idx] = { ...state.transactions[idx], type: currentType, desc, amount, cat, date };
    }
    editingTxId = null;
    showToast('Transação atualizada');
  } else if (isInstall && numInstall >= 2) {
    const baseDate = new Date(date + 'T00:00:00');
    const parcela  = Math.round((amount / numInstall) * 100) / 100;
    for (let i = 0; i < numInstall; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
      state.transactions.push({
        id:     Date.now().toString() + '_p' + i,
        type:   currentType,
        desc:   `${desc} (${i + 1}/${numInstall})`,
        amount: parcela,
        cat,
        date:   d.toISOString().slice(0, 10),
      });
    }
    showToast(`${numInstall}x de ${fmt(parcela)} criadas`);
  } else {
    state.transactions.push({ id: Date.now().toString(), type: currentType, desc, amount, cat, date });
    showToast('Transação salva');
  }

  state.transactions.sort((a, b) => b.date.localeCompare(a.date));
  closeModal('addModal');
  saveData(); renderAll();
  checkBudgetAlerts();
}

function deleteTransaction(id) {
  if (!confirm('Remover esta transação?')) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveData(); renderAll();
  showToast('Transação removida');
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
      showToast(`${info.label}: limite ultrapassado`);
    } else if (pct >= threshold) {
      showToast(`${info.label}: ${pct.toFixed(0)}% do limite`);
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
  if (!cat || !amount || amount <= 0) { showToast('Preencha os campos'); return; }
  state.budgets[cat] = amount;
  closeModal('budgetModal');
  saveData(); renderBudgets();
  showToast('Orçamento definido');
}

function deleteBudget(cat) {
  if (!confirm('Remover este orçamento?')) return;
  delete state.budgets[cat];
  saveData(); renderBudgets();
  showToast('Orçamento removido');
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

  if (!name || !target || target <= 0) { showToast('Preencha nome e valor da meta'); return; }

  if (!state.goals) state.goals = [];
  if (editingGoalId) {
    const idx = state.goals.findIndex(g => g.id === editingGoalId);
    if (idx >= 0) state.goals[idx] = { ...state.goals[idx], icon, name, target, saved, deadline };
  } else {
    state.goals.push({ id: Date.now().toString(), icon, name, target, saved, deadline });
  }
  closeModal('goalModal');
  saveData(); renderGoals();
  showToast('Meta salva');
}

function deleteGoal(id) {
  if (!confirm('Remover esta meta?')) return;
  state.goals = (state.goals || []).filter(g => g.id !== id);
  saveData(); renderGoals();
  showToast('Meta removida');
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
  if (!amount || amount <= 0) { showToast('Digite um valor válido'); return; }
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

  if (!desc || !amount || amount <= 0 || !cat || !start) { showToast('Preencha todos os campos'); return; }

  if (!state.recurringTransactions) state.recurringTransactions = [];
  state.recurringTransactions.push({
    id: Date.now().toString(),
    type: currentRecType, desc, amount, cat, freq,
    day, month, startDate: start,
    lastGenerated: null, active: true,
  });
  closeModal('recurringModal');
  saveData(); renderConfig();
  showToast('Transação recorrente criada');
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
  showToast('Recorrente removida');
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
        desc:        r.desc,
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
    showToast('Transações recorrentes atualizadas');
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
  if (!name) { showToast('Digite o nome da categoria'); return; }

  if (!state.customCategories) state.customCategories = { income: [], expense: [] };
  if (!state.customCategories[editingCatType]) state.customCategories[editingCatType] = [];

  const id = 'custom_' + Date.now();
  state.customCategories[editingCatType].push({ id, label: name, icon });
  closeModal('categoryModal');
  saveData(); renderConfig();
  showToast('Categoria criada');
}

function deleteCustomCategory(type, id) {
  if (!confirm('Remover esta categoria?')) return;
  state.customCategories[type] = (state.customCategories[type] || []).filter(c => c.id !== id);
  saveData(); renderConfig();
  showToast('Categoria removida');
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
  showToast('CSV exportado');
}

// ── Renderização ──────────────────────────────────────────────────────────────

function renderAll() {
  renderSummary();
  renderComparison();
  renderChart();
  renderPieChart();
  renderUpcoming();
  renderRecent();
}

// ── Próximos vencimentos ──────────────────────────────────────────────────────

function getNextDueDate(r, fromDate) {
  const today = new Date(fromDate);
  today.setHours(0, 0, 0, 0);

  if (r.freq === 'monthly') {
    let d = new Date(today.getFullYear(), today.getMonth(), r.day);
    if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, r.day);
    return d;
  } else if (r.freq === 'weekly') {
    const diff = (r.day - today.getDay() + 7) % 7;
    return new Date(today.getTime() + diff * 86400000);
  } else if (r.freq === 'yearly') {
    let d = new Date(today.getFullYear(), (r.month || 1) - 1, r.day);
    if (d < today) d = new Date(today.getFullYear() + 1, (r.month || 1) - 1, r.day);
    return d;
  }
  return null;
}

function renderUpcoming() {
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const horizon = new Date(today.getTime() + 7 * 86400000); // próximos 7 dias

  const upcoming = (state.recurringTransactions || [])
    .filter(r => r.active)
    .map(r => ({ ...r, nextDate: getNextDueDate(r, today) }))
    .filter(r => r.nextDate && r.nextDate <= horizon)
    .sort((a, b) => a.nextDate - b.nextDate);

  const section   = document.getElementById('upcomingSection');
  const container = document.getElementById('upcomingList');
  const countEl   = document.getElementById('upcomingCount');
  if (!section || !container) return;

  if (!upcoming.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  if (countEl) countEl.textContent = upcoming.length;

  container.innerHTML = upcoming.map(r => {
    const cat      = getCatInfo(r.cat);
    const daysLeft = Math.round((r.nextDate - today) / 86400000);
    const label    = daysLeft === 0 ? 'Vence hoje!' : daysLeft === 1 ? 'Amanhã' : `Em ${daysLeft} dias`;
    const urgColor = daysLeft === 0 ? 'var(--red)' : daysLeft <= 2 ? 'var(--amber)' : 'var(--blue)';
    const sign     = r.type === 'income' ? '+' : '−';
    const amtClass = r.type === 'income' ? 'income' : 'expense';

    return `<div class="upcoming-item">
      <div class="tx-icon" style="background:${r.type === 'income' ? 'var(--green-bg)' : 'var(--red-bg)'}">
        ${cat.icon}
      </div>
      <div class="upcoming-info">
        <div class="upcoming-desc">${r.desc}</div>
        <div class="upcoming-meta">${cat.label}</div>
      </div>
      <div class="upcoming-right">
        <div class="tx-amount ${amtClass}">${sign}${fmt(r.amount)}</div>
        <div class="upcoming-badge" style="color:${urgColor}">${label}</div>
      </div>
    </div>`;
  }).join('');
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

// ── Gráfico de barras (Chart.js) ──────────────────────────────────────────────

function chartTextColor() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--muted').trim() || '#6b7280';
}

function chartGridColor() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
}

function renderChart() {
  const months = {};
  (state.transactions || []).forEach(t => {
    const k = t.date.slice(0, 7);
    if (!months[k]) months[k] = { income: 0, expense: 0 };
    months[k][t.type] += t.amount;
  });
  const keys = Object.keys(months).sort().slice(-6);

  const canvas  = document.getElementById('monthlyChart');
  const emptyEl = document.getElementById('monthlyChartEmpty');
  if (!canvas || !emptyEl) return;

  if (!keys.length) {
    canvas.style.display  = 'none';
    emptyEl.style.display = '';
    if (monthlyChartInst) { monthlyChartInst.destroy(); monthlyChartInst = null; }
    return;
  }

  canvas.style.display  = '';
  emptyEl.style.display = 'none';

  const labels      = keys.map(k => new Date(k + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
  const incomeData  = keys.map(k => months[k].income);
  const expenseData = keys.map(k => months[k].expense);
  const textColor   = chartTextColor();
  const gridColor   = chartGridColor();

  if (monthlyChartInst) { monthlyChartInst.destroy(); monthlyChartInst = null; }

  monthlyChartInst = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Receitas',
          data: incomeData,
          backgroundColor: 'rgba(16,185,129,0.75)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 5,
          borderSkipped: false,
        },
        {
          label: 'Despesas',
          data: expenseData,
          backgroundColor: 'rgba(239,68,68,0.75)',
          borderColor: '#ef4444',
          borderWidth: 1,
          borderRadius: 5,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, font: { size: 12 }, padding: 16 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          ticks:  { color: textColor, font: { size: 11 } },
          grid:   { color: gridColor },
        },
        y: {
          ticks: {
            color: textColor, font: { size: 11 },
            callback: v => 'R$ ' + v.toLocaleString('pt-BR'),
          },
          grid: { color: gridColor },
        },
      },
    },
  });
}

// ── Gráfico de rosca — gastos por categoria ────────────────────────────────────

function renderPieChart() {
  const now       = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const catTotals = {};
  (state.transactions || [])
    .filter(t => t.type === 'expense' && t.date.startsWith(thisMonth))
    .forEach(t => { catTotals[t.cat] = (catTotals[t.cat] || 0) + t.amount; });

  const canvas   = document.getElementById('pieChart');
  const emptyEl  = document.getElementById('pieChartEmpty');
  const legendEl = document.getElementById('pieLegend');
  if (!canvas || !emptyEl || !legendEl) return;

  const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    canvas.style.display  = 'none';
    emptyEl.style.display = '';
    legendEl.innerHTML    = '';
    if (pieChartInst) { pieChartInst.destroy(); pieChartInst = null; }
    return;
  }

  canvas.style.display  = '';
  emptyEl.style.display = 'none';

  const total  = entries.reduce((s, [, v]) => s + v, 0);
  const labels = entries.map(([cat]) => { const i = getCatInfo(cat); return `${i.icon} ${i.label}`; });
  const data   = entries.map(([, v]) => v);
  const colors = entries.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]);
  const surfaceColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--surface').trim() || '#ffffff';

  if (pieChartInst) { pieChartInst.destroy(); pieChartInst = null; }

  pieChartInst = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: surfaceColor,
        hoverOffset: 10,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)} (${(ctx.raw / total * 100).toFixed(1)}%)`,
          },
        },
      },
    },
  });

  // Legenda customizada
  legendEl.innerHTML = entries.map(([cat, val], i) => {
    const info = getCatInfo(cat);
    return `<div class="pie-legend-item">
      <span class="pie-legend-dot" style="background:${colors[i]}"></span>
      <span class="pie-legend-label">${info.icon} ${info.label}</span>
      <span class="pie-legend-val">${fmt(val)}</span>
      <span class="pie-legend-pct">${(val / total * 100).toFixed(0)}%</span>
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
    <button class="tx-edit" onclick="openAddModal('${t.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </button>
    <button class="tx-delete" onclick="deleteTransaction('${t.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
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
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  let txs = state.transactions || [];
  if (type)  txs = txs.filter(t => t.type === type);
  if (cat)   txs = txs.filter(t => t.cat  === cat);
  if (month) txs = txs.filter(t => t.date.startsWith(month));
  if (search) txs = txs.filter(t => t.desc.toLowerCase().includes(search) || getCatInfo(t.cat).label.toLowerCase().includes(search));
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
        <div class="budget-name">${info.icon} ${info.label}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="budget-values" style="color:${color};font-weight:600">${fmt(spent)} / ${fmt(limit)}</div>
          <button class="btn btn-ghost btn-sm" onclick="deleteBudget('${cat}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
        </div>
      </div>
      <div class="budget-bar-track">
        <div class="budget-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      ${over ? `<div class="budget-warning">Ultrapassado em ${fmt(spent - limit)}</div>` : ''}
      ${warn && !over ? `<div class="budget-warning" style="color:var(--amber)">${pct.toFixed(0)}% do limite atingido</div>` : ''}
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
          <div class="goal-name">${g.name}${done ? ' · Concluída' : ''}</div>
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
          <button class="btn btn-primary btn-sm" onclick="openGoalContrib('${g.id}')">Adicionar</button>
          <button class="btn btn-ghost btn-sm"   onclick="openGoalModal('${g.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-ghost btn-sm"   onclick="deleteGoal('${g.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
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
      <button class="tx-delete" style="opacity:1" onclick="deleteRecurring('${r.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
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
        : `<button class="btn btn-ghost btn-sm" onclick="deleteCustomCategory('${type}','${c.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>`}
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

// ── Onboarding ──────────────────────────────────────────────────────────────

function checkOnboarding() {
  if (!state.onboardingDone) {
    document.getElementById('onboardingModal').classList.add('open');
  }
}

function dismissOnboarding() {
  document.getElementById('onboardingModal').classList.remove('open');
  state.onboardingDone = true;
  saveData();
}

// ── Notificações ─────────────────────────────────────────────────────────────

async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    checkAndNotify();
  } else if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') checkAndNotify();
  }
}

function checkAndNotify() {
  if (Notification.permission !== 'granted') return;
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);

  (state.recurringTransactions || [])
    .filter(r => r.active)
    .forEach(r => {
      const next = getNextDueDate(r, today);
      if (!next) return;
      const diff = Math.round((next - today) / 86400000);
      if (diff === 0) {
        new Notification('GiWallet — Vencimento hoje', {
          body: `${r.desc}: ${fmt(r.amount)}`,
          icon: './icon-192.png',
          tag: 'giwallet-' + r.id,
        });
      } else if (diff === 1) {
        new Notification('GiWallet — Vence amanhã', {
          body: `${r.desc}: ${fmt(r.amount)}`,
          icon: './icon-192.png',
          tag: 'giwallet-' + r.id + '-tomorrow',
        });
      }
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
