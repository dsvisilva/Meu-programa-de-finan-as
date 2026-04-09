// 🔥 FIREBASE (SEMPRE NO TOPO)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAfY-_-nFQIbNwvse30Ctbfsnq9b-FQnLA",
  authDomain: "app-de-financas-do-davi.firebaseapp.com",
  projectId: "app-de-financas-do-davi",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 📦 ESTADO
const CATEGORIES = {
  income: [
    { id: 'salario', label: 'Salário', icon: '💼' },
    { id: 'freelance', label: 'Freelance', icon: '💻' },
    { id: 'investimento', label: 'Investimento', icon: '📈' },
    { id: 'aluguel_rec', label: 'Aluguel recebido', icon: '🏠' },
    { id: 'outros_rec', label: 'Outros', icon: '✨' },
  ],
  expense: [
    { id: 'moradia', label: 'Moradia', icon: '🏠' },
    { id: 'alimentacao', label: 'Alimentação', icon: '🍽️' },
    { id: 'transporte', label: 'Transporte', icon: '🚗' },
    { id: 'saude', label: 'Saúde', icon: '💊' },
    { id: 'lazer', label: 'Lazer', icon: '🎮' },
    { id: 'educacao', label: 'Educação', icon: '📚' },
    { id: 'vestuario', label: 'Vestuário', icon: '👗' },
    { id: 'streaming', label: 'Streaming', icon: '📺' },
    { id: 'outros_exp', label: 'Outros', icon: '📦' },
  ]
};

let state = { transactions: [], budgets: {}, theme: 'light' };
let currentType = 'income';

// 📡 REFERÊNCIA DO BANCO
const docRef = doc(db, "financas", "user1");

// 🔁 CARREGAR + SINCRONIZAR EM TEMPO REAL
function loadData() {
  onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      state = snap.data();
      applyTheme();
      renderAll();
      showToast('📡 Sincronizado!');
    }
  });
}

// 💾 SALVAR
async function saveData() {
  await setDoc(docRef, state);
}

// 🧠 HELPERS
function fmt(val) {
  return 'R$ ' + parseFloat(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getCatInfo(catId) {
  const all = [...CATEGORIES.income, ...CATEGORIES.expense];
  return all.find(c => c.id === catId) || { label: catId, icon: '📌' };
}

// 🌙 TEMA
function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  saveData();
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme || 'light');
}

// 🔔 TOAST
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// 🧾 TRANSAÇÕES
function saveTransaction() {
  const desc = document.getElementById('tx-desc').value.trim();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const cat = document.getElementById('tx-cat').value;
  const date = document.getElementById('tx-date').value;

  if (!desc || !amount || !cat || !date) {
    showToast('⚠️ Preencha tudo');
    return;
  }

  state.transactions.push({
    id: Date.now().toString(),
    type: currentType,
    desc,
    amount,
    cat,
    date
  });

  saveData();
  renderAll();
}

function deleteTransaction(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveData();
  renderAll();
}

// 💰 RESUMO
function renderSummary() {
  const income = state.transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const expense = state.transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const balance = income - expense;

  document.getElementById('summaryCards').innerHTML = `
    <div>Saldo: ${fmt(balance)}</div>
    <div>Receita: ${fmt(income)}</div>
    <div>Despesa: ${fmt(expense)}</div>
  `;
}

// 📋 LISTA
function renderTransactions() {
  const list = document.getElementById('allTxList');
  list.innerHTML = state.transactions.map(t => {
    const cat = getCatInfo(t.cat);
    return `
      <li>
        ${cat.icon} ${t.desc} - ${fmt(t.amount)}
        <button onclick="deleteTransaction('${t.id}')">🗑</button>
      </li>
    `;
  }).join('');
}

// 🔁 RENDER GERAL
function renderAll() {
  renderSummary();
  renderTransactions();
}

// 🚀 START
loadData();