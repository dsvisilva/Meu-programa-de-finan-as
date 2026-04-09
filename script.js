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

// ── Constantes ────────────────────────────────────────────────────────────────

const CATEGORIES = {
  income: [
    { id: 'salario',      label: 'Salário',           icon: '💼' },
    { id: 'freelance',    label: 'Freelance',          icon: '💻' },
    { id: 'investimento', label: 'Investimento',       icon: '📈' },
    { id: 'aluguel_rec',  label: 'Aluguel recebido',   icon: '🏠' },
    { id: 'outros_rec',   label: 'Outros',             icon: '✨' },
  ],
  expense: [
    { id: 'moradia',      label: 'Moradia',            icon: '🏠' },
    { id: 'alimentacao',  label: 'Alimentação',        icon: '🍽️' },
    { id: 'transporte',   label: 'Transporte',         icon: '🚗' },
    { id: 'saude',        label: 'Saúde',              icon: '💊' },
    { id: 'lazer',        label: 'Lazer',              icon: '🎮' },
    { id: 'educacao',     label: 'Educação',           icon: '📚' },
    { id: 'vestuario',    label: 'Vestuário',          icon: '👗' },
    { id: 'streaming',    label: 'Streaming',          icon: '📺' },
    { id: 'outros_exp',   label: 'Outros',             icon: '📦' },
  ],
};

const LS_KEY     = 'financas_sync_key';
const COLLECTION = 'financas';

// ── Estado global ─────────────────────────────────────────────────────────────

let state       = { transactions: [], budgets: {}, theme: 'light' };
let currentType = 'income';
let db          = null;
let syncKey     = null;
let isWriting   = false;
let syncReady   = false;

// ── Firebase ──────────────────────────────────────────────────────────────────

function initFirebase(config) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    db = firebase.firestore();
    // Ativa persistência offline (funciona mesmo sem internet)
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    return true;
  } catch (e) {
    console.error('Erro ao inicializar Firebase:', e);
    return false;
  }
}

function startSync() {
  if (!db || !syncKey) return;

  setSyncing(true);

  db.collection(COLLECTION).doc(syncKey).onSnapshot(
    (doc) => {
      // Ignora atualizações causadas por escrita local
      if (isWriting) { setSyncing(false); return; }

      if (doc.exists) {
        const remote = doc.data();
        // Garantir tipos corretos
        if (!Array.isArray(remote.transactions)) remote.transactions = [];
        if (!remote.budgets || typeof remote.budgets !== 'object') remote.budgets = {};
        if (!remote.theme) remote.theme = 'light';

        const remoteStr = JSON.stringify(remote);
        const localStr  = JSON.stringify(state);

        if (remoteStr !== localStr) {
          state = remote;
          applyTheme();
          renderAll();
          if (syncReady) showToast('📡 Sincronizado com outro dispositivo!');
        }
      } else {
        // Documento não existe ainda (primeira vez) — salvar estado inicial
        saveData();
      }

      syncReady = true;
      setSyncing(false);
      renderAll();
    },
    (err) => {
      console.error('Erro de sincronização:', err);
      setSyncing(false, true);
      showToast('❌ Erro de sincronização. Verifique sua conexão.');
    }
  );
}

async function saveData() {
  if (!db || !syncKey) return;
  isWriting = true;
  setSyncing(true);
  try {
    await db.collection(COLLECTION).doc(syncKey).set(state);
  } catch (e) {
    showToast('❌ Erro ao salvar');
    console.error(e);
  }
  isWriting = false;
  setTimeout(() => setSyncing(false), 600);
}

// ── Setup / Configuração ──────────────────────────────────────────────────────

function loadData() {
  const savedKey = localStorage.getItem(LS_KEY);

  // Inicializa Firebase com o config embutido
  initFirebase(FIREBASE_CONFIG);

  if (savedKey) {
    syncKey = savedKey;
    applyTheme();
    renderAll();
    startSync();
    return;
  }

  // Primeira vez neste dispositivo — pedir apenas a chave de sincronização
  document.getElementById('setupModal').classList.add('open');
  setSyncing(false, true);
  applyTheme();
  renderAll();
}

function saveSetup() {
  const keyInput = document.getElementById('setup-key').value.trim().toLowerCase().replace(/\s+/g, '_');

  if (!keyInput) {
    showToast('⚠️ Digite uma chave de sincronização');
    return;
  }

  if (keyInput.length < 4) {
    showToast('⚠️ A chave precisa ter pelo menos 4 caracteres');
    return;
  }

  localStorage.setItem(LS_KEY, keyInput);
  syncKey = keyInput;

  closeModal('setupModal');
  applyTheme();
  renderAll();
  startSync();
  showToast('✅ Conectado! Sincronizando dados...');
}

function openSyncSettings() {
  const savedKey = localStorage.getItem(LS_KEY) || '';
  document.getElementById('setup-key').value = savedKey;
  document.getElementById('setupCancelBtn').style.display = savedKey ? '' : 'none';
  document.getElementById('setupModal').classList.add('open');
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function fmt(val) {
  return 'R$ ' + parseFloat(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getCatInfo(catId) {
  const all = [...CATEGORIES.income, ...CATEGORIES.expense];
  return all.find(c => c.id === catId) || { label: catId, icon: '📌' };
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Tema ──────────────────────────────────────────────────────────────────────

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  saveData();
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme || 'light');
  const btn = document.querySelector('[onclick="toggleTheme()"]');
  if (btn) btn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
}

// ── Status de sincronização ───────────────────────────────────────────────────

function setSyncing(val, offline = false) {
  const dot = document.getElementById('syncDot');
  const txt = document.getElementById('syncText');
  if (!dot || !txt) return;

  if (offline) {
    dot.className = 'sync-dot offline';
    txt.textContent = 'Desconectado';
  } else {
    dot.className = 'sync-dot' + (val ? ' syncing' : '');
    txt.textContent = val ? 'Sincronizando...' : 'Sincronizado';
  }
}

// ── Navegação por abas ────────────────────────────────────────────────────────

function showTab(tab, el) {
  ['dashboard', 'transactions', 'budgets'].forEach(t => {
    document.getElementById('tab-' + t).style.display = t === tab ? '' : 'none';
  });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  if (tab === 'transactions') { populateFilters(); renderTransactions(); }
  if (tab === 'budgets')      renderBudgets();
}

// ── Modais ────────────────────────────────────────────────────────────────────

function openAddModal() {
  setType('income');
  document.getElementById('tx-desc').value   = '';
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-date').value   = new Date().toISOString().slice(0, 10);
  populateCatSelect();
  document.getElementById('addModal').classList.add('open');
}

function openBudgetModal() {
  const sel = document.getElementById('budget-cat');
  sel.innerHTML = CATEGORIES.expense
    .map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`)
    .join('');
  document.getElementById('budget-amount').value = '';
  document.getElementById('budgetModal').classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Fechar modal ao clicar fora (exceto o setupModal na primeira vez)
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
  populateCatSelect();
}

function populateCatSelect() {
  const sel = document.getElementById('tx-cat');
  sel.innerHTML = '<option value="">Selecione...</option>' +
    CATEGORIES[currentType]
      .map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`)
      .join('');
}

// ── Transações ────────────────────────────────────────────────────────────────

function saveTransaction() {
  const desc   = document.getElementById('tx-desc').value.trim();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const cat    = document.getElementById('tx-cat').value;
  const date   = document.getElementById('tx-date').value;

  if (!desc || !amount || amount <= 0 || !cat || !date) {
    showToast('⚠️ Preencha todos os campos');
    return;
  }

  if (!state.transactions) state.transactions = [];

  state.transactions.push({
    id: Date.now().toString(),
    type: currentType,
    desc,
    amount,
    cat,
    date,
  });

  state.transactions.sort((a, b) => b.date.localeCompare(a.date));
  closeModal('addModal');
  saveData();
  renderAll();
  showToast('✅ Transação salva!');
}

function deleteTransaction(id) {
  if (!confirm('Remover esta transação?')) return;
  state.transactions = (state.transactions || []).filter(t => t.id !== id);
  saveData();
  renderAll();
  showToast('🗑️ Transação removida');
}

// ── Orçamentos ────────────────────────────────────────────────────────────────

function saveBudget() {
  const cat    = document.getElementById('budget-cat').value;
  const amount = parseFloat(document.getElementById('budget-amount').value);

  if (!cat || !amount || amount <= 0) {
    showToast('⚠️ Preencha os campos');
    return;
  }

  if (!state.budgets) state.budgets = {};
  state.budgets[cat] = amount;
  closeModal('budgetModal');
  saveData();
  renderBudgets();
  showToast('✅ Orçamento definido!');
}

function deleteBudget(cat) {
  if (!confirm('Remover este orçamento?')) return;
  delete state.budgets[cat];
  saveData();
  renderBudgets();
  showToast('🗑️ Orçamento removido');
}

// ── Renderização ──────────────────────────────────────────────────────────────

function renderAll() {
  renderSummary();
  renderChart();
  renderRecent();
}

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
    </div>
  `;
}

function renderChart() {
  const months = {};
  const txs = state.transactions || [];

  txs.forEach(t => {
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
    const d     = new Date(k + '-01');
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    const ip    = (months[k].income  / maxVal * 100).toFixed(1);
    const ep    = (months[k].expense / maxVal * 100).toFixed(1);
    return `
      <div style="margin-bottom:14px">
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
    <div class="tx-amount ${t.type}">
      ${t.type === 'income' ? '+' : '−'}${fmt(t.amount)}
    </div>
    <button class="tx-delete" onclick="deleteTransaction('${t.id}')" title="Remover">🗑</button>
  </li>`;
}

function renderRecent() {
  const list   = document.getElementById('recentList');
  const txs    = state.transactions || [];
  const recent = txs.slice(0, 5);

  list.innerHTML = recent.length
    ? recent.map(txHTML).join('')
    : `<div class="empty">
         <div class="empty-icon">💳</div>
         Nenhuma transação ainda<br><br>
         <button class="btn btn-primary" onclick="openAddModal()">Adicionar primeira transação</button>
       </div>`;
}

function populateFilters() {
  const txs    = state.transactions || [];
  const cats   = new Set(txs.map(t => t.cat));
  const catSel = document.getElementById('filterCat');

  catSel.innerHTML = '<option value="">Todas as categorias</option>' +
    [...cats].map(c => {
      const i = getCatInfo(c);
      return `<option value="${c}">${i.icon} ${i.label}</option>`;
    }).join('');

  const months = [...new Set(txs.map(t => t.date.slice(0, 7)))].sort().reverse();
  const mSel   = document.getElementById('filterMonth');

  mSel.innerHTML = '<option value="">Todos os meses</option>' +
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

  if (type)  txs = txs.filter(t => t.type  === type);
  if (cat)   txs = txs.filter(t => t.cat   === cat);
  if (month) txs = txs.filter(t => t.date.startsWith(month));

  const list = document.getElementById('allTxList');
  list.innerHTML = txs.length
    ? txs.map(txHTML).join('')
    : '<div class="empty"><div class="empty-icon">🔍</div>Nenhuma transação encontrada</div>';
}

function renderBudgets() {
  const now       = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const txs       = state.transactions || [];

  const expenses = {};
  txs
    .filter(t => t.type === 'expense' && t.date.startsWith(thisMonth))
    .forEach(t => { expenses[t.cat] = (expenses[t.cat] || 0) + t.amount; });

  const b         = state.budgets || {};
  const container = document.getElementById('budgetList');

  if (!Object.keys(b).length) {
    container.innerHTML = `<div class="empty">
      <div class="empty-icon">🎯</div>
      Nenhum orçamento definido<br><br>
      <button class="btn btn-primary" onclick="openBudgetModal()">Definir primeiro orçamento</button>
    </div>`;
    return;
  }

  container.innerHTML = Object.entries(b).map(([cat, limit]) => {
    const spent = expenses[cat] || 0;
    const pct   = Math.min((spent / limit) * 100, 100);
    const info  = getCatInfo(cat);
    const over  = spent > limit;
    const color = over ? 'var(--red)' : pct > 75 ? 'var(--amber)' : 'var(--green)';

    return `<div class="budget-item">
      <div class="budget-top">
        <div class="budget-name">${info.icon} ${info.label}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="budget-values" style="color:${color};font-weight:600">${fmt(spent)} / ${fmt(limit)}</div>
          <button class="btn btn-ghost btn-sm" onclick="deleteBudget('${cat}')">🗑</button>
        </div>
      </div>
      <div class="budget-bar-track">
        <div class="budget-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      ${over ? `<div class="budget-warning">⚠️ Limite ultrapassado em ${fmt(spent - limit)}</div>` : ''}
    </div>`;
  }).join('');
}

// ── Inicialização ─────────────────────────────────────────────────────────────

loadData();

// ── Service Worker (PWA) ──────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('Service Worker não registrado:', err);
    });
  });
}
