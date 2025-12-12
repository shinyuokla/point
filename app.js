// ===== State =====
let token = localStorage.getItem("token") || null;
let categories = [];
let transactions = [];
let budget = { id: "1", amount: "0" };
let currentFilter = "all"; // 追蹤目前的篩選狀態

// ===== DOM Elements =====
const landingSection = document.getElementById("landing-section");
const loginSection = document.getElementById("login-section");
const mainSection = document.getElementById("main-section");
const goLoginBtn = document.getElementById("go-login-btn");
const backToLandingBtn = document.getElementById("back-to-landing");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const welcomeMsg = document.getElementById("welcome-msg");

const btnAddTransaction = document.getElementById("btn-add-transaction");
const btnManageCategory = document.getElementById("btn-manage-category");
const transactionList = document.getElementById("transaction-list");
const transactionListTitle = document.getElementById("transaction-list-title");

const totalIncome = document.getElementById("total-income");
const totalExpense = document.getElementById("total-expense");
const totalBalanceEl = document.getElementById("total-balance");

const budgetSection = document.getElementById("budget-section");
const budgetRemaining = document.getElementById("budget-remaining");
const budgetProgressBar = document.getElementById("budget-progress-bar");
const totalBudget = document.getElementById("total-budget");
const budgetPercent = document.getElementById("budget-percent");

const categoryFilter = document.getElementById("category-filter");

// ===== API Helper =====
async function api(endpoint, options = {}) {
  const url = `${CONFIG.API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "請求失敗");
  }

  return data;
}

// ===== Auth =====
async function login(username, password) {
  const data = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  token = data.token;
  localStorage.setItem("token", token);
  return data;
}

function logout() {
  token = null;
  localStorage.removeItem("token");
  showLanding();
}

async function validateToken() {
  if (!token) return false;
  try {
    await api("/api/categories");
    return true;
  } catch (error) {
    token = null;
    localStorage.removeItem("token");
    return false;
  }
}

// ===== Navigation =====
function showLanding() {
  landingSection.classList.remove("hidden");
  loginSection.classList.add("hidden");
  mainSection.classList.add("hidden");
}

function showLogin() {
  landingSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
  mainSection.classList.add("hidden");
}

function showMain() {
  landingSection.classList.add("hidden");
  loginSection.classList.add("hidden");
  mainSection.classList.remove("hidden");
  loadData();
}

// ===== Data Loading =====
async function loadData() {
  try {
    await Promise.all([loadCategories(), loadTransactions(), loadBudget()]);
  } catch (error) {
    if (error.message.includes("token") || error.message.includes("未授權")) {
      logout();
    }
  }
}

async function loadCategories() {
  const data = await api("/api/categories");
  categories = data.data || [];
  renderCategoryFilter(); // 載入類別後更新篩選選單
}

async function loadTransactions() {
  const data = await api("/api/transactions");
  transactions = data.data || [];
  updateSummary(); // 載入交易後更新統計介面
}

async function loadBudget() {
  const data = await api("/api/budget");
  budget = data.data || { id: "1", amount: "0" };
  updateSummary(); // 載入預算後更新統計介面
}

// ===== 渲染類別篩選器 =====
function renderCategoryFilter() {
  const options = categories
    .map((cat) => `<option value="${cat.id}">${cat.name}</option>`)
    .join("");
  
  // 保存當前選擇
  const currentVal = categoryFilter.value;
  categoryFilter.innerHTML = `<option value="all">顯示全部</option>` + options;
  
  if(currentFilter && currentFilter !== 'all'){
      categoryFilter.value = currentFilter;
  }
}

// ===== Render Functions =====
function renderTransactions(dataToRender = transactions) {
  if (dataToRender.length === 0) {
    transactionList.innerHTML = `<div style="text-align:center; padding:20px; color:#9ca095;">
      🍃 這裡空空的，沒有符合的紀錄喔！
    </div>`;
    return;
  }

  const sorted = [...dataToRender].sort((a, b) => {
    const getIdNum = (id) => {
      const match = id.match(/(\d+)$/);
      return match ? Number(match[1]) : 0;
    };
    const idDiff = getIdNum(b.id) - getIdNum(a.id);
    if (idDiff !== 0) return idDiff;
    return new Date(b.date) - new Date(a.date);
  });

  transactionList.innerHTML = sorted
    .map(
      (txn) => `
      <div class="transaction-item">
        <div class="left">
          <div class="category-icon" style="background-color: ${
            txn.category_color_hex || "#9E9E9E"
          }">
            ${txn.category_name.charAt(0)}
          </div>
          <div class="info">
            <span class="note">${txn.note || txn.category_name}</span>
            <span class="meta">${txn.date} · ${txn.category_name}</span>
          </div>
        </div>
        <div class="right">
          <span class="amount ${txn.type}">
            ${txn.type === "income" ? "+" : "-"}${Number(
        txn.amount
      ).toLocaleString()}
          </span>
          <button class="edit-btn" onclick="window.editTransaction('${
            txn.id
          }')">✎</button>
          <button class="delete-btn" onclick="window.deleteTransaction('${
            txn.id
          }')">✕</button>
        </div>
      </div>
    `
    )
    .join("");
}

function updateSummary() {
  // --- 1. 定義時間篩選器 ---
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const isCurrentMonth = (txn) => {
    const txnDate = new Date(txn.date);
    return (
      txnDate.getMonth() === currentMonth &&
      txnDate.getFullYear() === currentYear
    );
  };

  // --- 2. 執行類別篩選 (影響所有數字與列表) ---
  let categoryFilteredTransactions = transactions;
  if (currentFilter !== "all") {
    categoryFilteredTransactions = transactions.filter(txn => txn.category_id === currentFilter);
  }

  // --- 3. 計算左上角總資產/結餘 (所有時間 + 類別篩選) ---
  const balanceIncome = categoryFilteredTransactions
    .filter((txn) => txn.type === "income")
    .reduce((sum, txn) => sum + Number(txn.amount), 0);

  const balanceExpense = categoryFilteredTransactions
    .filter((txn) => txn.type === "expense")
    .reduce((sum, txn) => sum + Number(txn.amount), 0);

  const balance = balanceIncome - balanceExpense;


  // --- 4. 計算當月收入與支出 (當月 + 類別篩選) ---
  
  // 篩選出「當月」且「符合類別」的交易
  const currentMonthDisplayTransactions = categoryFilteredTransactions.filter(isCurrentMonth);

  const currentMonthIncome = currentMonthDisplayTransactions
    .filter((txn) => txn.type === "income")
    .reduce((sum, txn) => sum + Number(txn.amount), 0);

  const currentMonthExpense = currentMonthDisplayTransactions
    .filter((txn) => txn.type === "expense")
    .reduce((sum, txn) => sum + Number(txn.amount), 0);
    
    
  // --- 5. 更新 UI 顯示 ---

  // 更新中間欄的當月收入與支出
  totalIncome.textContent = currentMonthIncome.toLocaleString();
  totalExpense.textContent = currentMonthExpense.toLocaleString();

  // 更新列表標題
  transactionListTitle.textContent = currentFilter === 'all' 
    ? "所有點數紀錄" 
    : `${categoryFilter.options[categoryFilter.selectedIndex].text} 紀錄`;

  // 更新左上角的總資產/結餘
  if (totalBalanceEl) {
      totalBalanceEl.textContent = balance.toLocaleString();
      
      // 根據正負值改變顏色
      totalBalanceEl.style.color = balance < 0 ? "#ff7675" : "#558b2f"; 

      // 【UX 優化】動態修改標題與說明文字
      const cardContainer = totalBalanceEl.parentElement;
      const titleEl = cardContainer.querySelector('.label-lg');
      const descEl = cardContainer.querySelector('.budget-meta span');
      
      const categoryName = categoryFilter.options[categoryFilter.selectedIndex].text;

      if (currentFilter === 'all') {
          if(titleEl) titleEl.textContent = "目前總資產";
          if(descEl) descEl.textContent = "口袋裡的點數總額";
      } else {
          // 當篩選特定類別時，總資產卡片顯示該類別所有時間的結餘
          if(titleEl) titleIlel.textContent = `${categoryName} 總結餘`; 
          if(descEl) descEl.textContent = `所有時間的 ${categoryName} 收支總和`;
      }
  }

  // --- 6. 預算 UI 邏輯 (預算追蹤當月總結餘/淨流入) ---
  
  // 計算當月所有類別的總收入和總支出
  const totalMonthIncome = transactions
    .filter(isCurrentMonth)
    .filter((txn) => txn.type === "income")
    .reduce((sum, txn) => sum + Number(txn.amount), 0);
    
  const totalMonthExpense = transactions
    .filter(isCurrentMonth)
    .filter((txn) => txn.type === "expense")
    .reduce((sum, txn) => sum + Number(txn.amount), 0);
    
  // 【關鍵修改點】：計算當月淨結餘 (Net Flow)
  const currentMonthNetFlow = totalMonthIncome - totalMonthExpense;

  // 預算金額 (amount) 現在代表「期望的每月淨結餘 (例如：期望每月淨賺 $2000)」
  const budgetAmount = Number(budget.amount);
  
  // 計算「與期望淨結餘的差異」 (Difference from Target Net Flow)
  // 如果目標是 $2000，實際淨結餘 $1500，則差異為 $500 (還差 $500 達成目標)
  const difference = budgetAmount - currentMonthNetFlow; 
  
  // 計算達成百分比 (實際淨結餘 / 期望淨結餘)
  const percent =
    budgetAmount !== 0 ? Math.round((currentMonthNetFlow / budgetAmount) * 100) : 0;
    
  // 顯示「距離目標淨結餘的差異」
  budgetRemaining.textContent = `${difference.toLocaleString()}`; 
  totalBudget.textContent = `${budgetAmount.toLocaleString()}`;
  budgetPercent.textContent = `${percent}%`;

  // 進度條長度代表淨結餘達成率
  let progressWidth = budgetAmount !== 0 ? (currentMonthNetFlow / budgetAmount) * 100 : 0;
  progressWidth = Math.max(0, progressWidth); // 淨結餘可以是負數，但進度條應至少從 0 開始
  budgetProgressBar.style.width = `${progressWidth}%`;

  // 進度條顏色邏輯：
  budgetProgressBar.className = "progress-bar-fill"; 
  if (currentMonthNetFlow < 0) {
      budgetProgressBar.classList.add("danger"); // 淨結餘為負，表示這個月是賠錢的
  } else if (currentMonthNetFlow < budgetAmount) {
      budgetProgressBar.classList.add("warning"); // 有賺錢但未達預期目標
  } else {
      budgetProgressBar.classList.add("success"); // 淨結餘達到或超過目標
  }

  // 7. 渲染列表 (使用經過類別篩選的資料)
  renderTransactions(categoryFilteredTransactions);
}

// ===== SweetAlert Flows (Modal) =====

async function openBudgetModal() {
  const { value: amount } = await Swal.fire({
    title: "設定每月目標點數",
    input: "number",
    inputLabel: "請輸入點數",
    inputValue: budget.amount,
    showCancelButton: true,
    confirmButtonText: "儲存",
    cancelButtonText: "取消",
    confirmButtonColor: "#5abf98",
    inputValidator: (value) => {
      if (!value || Number(value) < 0) {
        return "請輸入有效的點數！";
      }
    },
  });

  if (amount) {
    Swal.fire({
      title: "儲存中...",
      text: "正在更新點數",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await api("/api/budget", {
        method: "PUT",
        body: JSON.stringify({ amount }),
      });
      await loadBudget();
      Swal.fire("成功", "點數已更新！", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
}

async function openAddTransactionModal() {
  const categoryOptions = categories
    .map((cat) => `<option value="${cat.id}">${cat.name}</option>`)
    .join("");

  const today = new Date().toISOString().split("T")[0];

  const { value: formValues } = await Swal.fire({
    title: "記一筆",
    html: `
      <form id="swal-txn-form" class="swal-form">
        <div class="form-group">
          <label>項目名稱</label>
          <input type="text" id="swal-note" class="swal2-input" placeholder="例如：午餐、搭公車、買卡片" required autofocus>
        </div>
        <div class="form-group">
          <label>類別</label>
          <select id="swal-category" class="swal2-select">
            ${categoryOptions}
          </select>
        </div>
        <div class="form-group">
          <label>點數</label>
          <input type="number" id="swal-amount" class="swal2-input" placeholder="多少點？" min="1" required>
        </div>
        <div class="form-group">
          <label>收支</label>
          <select id="swal-type" class="swal2-select">
            <option value="expense">扣點</option>
            <option value="income">加點</option>
          </select>
        </div>
        <div class="form-group">
          <label>日期</label>
          <input type="date" id="swal-date" class="swal2-input" value="${today}" required>
        </div>
      </form>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "紀錄點數！",
    cancelButtonText: "算了",
    confirmButtonColor: "#5abf98",
    preConfirm: () => {
      return {
        date: document.getElementById("swal-date").value,
        type: document.getElementById("swal-type").value,
        category_id: document.getElementById("swal-category").value,
        amount: document.getElementById("swal-amount").value,
        note: document.getElementById("swal-note").value,
      };
    },
  });

  if (formValues) {
    if (!formValues.amount)
      return Swal.fire("哎呀！", "點數沒填喔！", "warning");

    Swal.fire({
      title: "處理中...",
      text: "正在儲存點數資料",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await createTransaction(formValues);
      Swal.fire("成功！", "點數紀錄完成！", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
}

async function openManageCategoryModal() {
  const categoryListHtml = categories
    .map(
      (cat) => `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:8px; background:#f9f9f9; border-radius:8px;">
        <div style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1;" onclick="window.editCategory('${
          cat.id
        }', '${cat.name}', '${cat.color_hex}')">
          <span style="width:12px; height:12px; border-radius:50%; background:${
            cat.color_hex
          }"></span>
          <span>${cat.name}</span>
          <span style="font-size:0.8em; color:#999;">(點擊編輯)</span>
        </div>
        ${
          cat.id !== "1"
            ? `<button onclick="window.deleteCategory('${cat.id}')" style="border:none; background:none; color:red; cursor:pointer; padding:4px 8px;">✕</button>`
            : ""
        }
      </div>
    `
    )
    .join("");

  const { value: newCat } = await Swal.fire({
    title: "管理類別",
    html: `
      <div style="text-align:left; margin-bottom:16px;">
        <label style="font-weight:bold;">新增類別</label>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <input id="swal-cat-name" class="swal2-input" placeholder="名稱" style="margin:0 !important;">
          <input id="swal-cat-color" type="color" value="#5abf98" style="height:46px; width:60px; padding:0; border:none; background:none;">
        </div>
      </div>
      <hr style="border:0; border-top:1px dashed #ccc; margin:16px 0;">
      <div style="text-align:left; max-height:200px; overflow-y:auto;">
        <label style="font-weight:bold; margin-bottom:8px; display:block;">現有類別 (點擊可編輯)</label>
        ${categoryListHtml}
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "新增類別",
    cancelButtonText: "關閉",
    confirmButtonColor: "#5abf98",
    preConfirm: () => {
      const name = document.getElementById("swal-cat-name").value;
      const color = document.getElementById("swal-cat-color").value;
      if (!name) return null;
      return { name, color_hex: color };
    },
  });

  if (newCat) {
    Swal.fire({
      title: "新增中...",
      text: "正在建立類別",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await api("/api/categories", {
        method: "POST",
        body: JSON.stringify(newCat),
      });
      await loadCategories();
      Swal.fire("成功", "類別已新增！", "success").then(() =>
        openManageCategoryModal()
      );
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
}

window.editCategory = async function (id, currentName, currentColor) {
  const { value: updatedCat } = await Swal.fire({
    title: "編輯類別",
    html: `
      <div style="text-align:left;">
        <div style="margin-bottom:16px;">
          <label>類別名稱</label>
          <input id="edit-cat-name" class="swal2-input" value="${currentName}" placeholder="名稱">
        </div>
        <div>
          <label>代表色</label>
          <input id="edit-cat-color" type="color" value="${currentColor}" style="width:100%; height:50px; padding:0; border:none;">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "儲存",
    cancelButtonText: "取消",
    confirmButtonColor: "#5abf98",
    preConfirm: () => {
      return {
        name: document.getElementById("edit-cat-name").value,
        color_hex: document.getElementById("edit-cat-color").value,
      };
    },
  });

  if (updatedCat) {
    Swal.fire({
      title: "更新中...",
      text: "正在儲存變更",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await api(`/api/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(updatedCat),
      });
      await loadCategories();
      Swal.fire("成功", "類別已更新！", "success").then(() =>
        openManageCategoryModal()
      );
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
};

// ===== CRUD Operations =====
async function createTransaction(payload) {
  await api("/api/transactions", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      id: `txn-${Date.now()}`,
      amount: Number(payload.amount),
    }),
  });
  await loadTransactions();
}

window.editTransaction = async function (id) {
  const txn = transactions.find((t) => t.id === id);
  if (!txn) return;

  const categoryOptions = categories
    .map(
      (cat) =>
        `<option value="${cat.id}" ${
          cat.id === txn.category_id ? "selected" : ""
        }>${cat.name}</option>`
    )
    .join("");

  const { value: formValues } = await Swal.fire({
    title: "編輯點數",
    html: `
      <form id="swal-txn-form" class="swal-form">
        <div class="form-group">
          <label>項目名稱</label>
          <input type="text" id="swal-note" class="swal2-input" placeholder="例如：午餐、搭公車、買卡片" value="${
            txn.note || ""
          }" required autofocus>
        </div>
        <div class="form-group">
          <label>類別</label>
          <select id="swal-category" class="swal2-select">
            ${categoryOptions}
          </select>
        </div>
        <div class="form-group">
          <label>點數</label>
          <input type="number" id="swal-amount" class="swal2-input" placeholder="多少點？" min="1" value="${
            txn.amount
          }" required>
        </div>
        <div class="form-group">
          <label>收支</label>
          <select id="swal-type" class="swal2-select">
            <option value="expense" ${
              txn.type === "expense" ? "selected" : ""
            }>支出</option>
            <option value="income" ${
              txn.type === "income" ? "selected" : ""
            }>收入</option>
          </select>
        </div>
        <div class="form-group">
          <label>日期</label>
          <input type="date" id="swal-date" class="swal2-input" value="${
            txn.date
          }" required>
        </div>
      </form>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "儲存",
    cancelButtonText: "取消",
    confirmButtonColor: "#5abf98",
    preConfirm: () => {
      return {
        date: document.getElementById("swal-date").value,
        type: document.getElementById("swal-type").value,
        category_id: document.getElementById("swal-category").value,
        amount: document.getElementById("swal-amount").value,
        note: document.getElementById("swal-note").value,
      };
    },
  });

  if (formValues) {
    if (!formValues.amount)
      return Swal.fire("哎呀！", "點數沒填喔！", "warning");

    Swal.fire({
      title: "更新中...",
      text: "正在儲存變更",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await api(`/api/transactions/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...formValues,
          amount: Number(formValues.amount),
        }),
      });
      await loadTransactions();
      Swal.fire("成功！", "點數已更新！", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
};

window.deleteTransaction = async function (id) {
  const result = await Swal.fire({
    title: "確定要刪除嗎？",
    text: "這筆紀錄會消失在時空縫隙中喔！",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ff7675",
    confirmButtonText: "刪除",
    cancelButtonText: "取消",
  });

  if (result.isConfirmed) {
    try {
      await api(`/api/transactions/${id}`, { method: "DELETE" });
      await loadTransactions();
      Swal.fire("已刪除！", "紀錄已移除。", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
};

window.deleteCategory = async function (id) {
  const result = await Swal.fire({
    title: "刪除類別？",
    text: "該類別無法復原喔！",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ff7675",
    confirmButtonText: "刪除",
    cancelButtonText: "取消",
  });

  if (result.isConfirmed) {
    try {
      await api(`/api/categories/${id}`, { method: "DELETE" });
      await loadCategories();
      Swal.fire("已刪除！", "類別已移除。", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
};

// ===== Event Listeners =====
goLoginBtn.addEventListener("click", showLogin);
backToLandingBtn.addEventListener("click", showLanding);

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    await login(username, password);
    showMain();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

logoutBtn.addEventListener("click", logout);
btnAddTransaction.addEventListener("click", openAddTransactionModal);
btnManageCategory.addEventListener("click", openManageCategoryModal);
budgetSection.addEventListener("click", openBudgetModal);

categoryFilter.addEventListener("change", (e) => {
  currentFilter = e.target.value;
  updateSummary();
});

// ===== Initialize =====
async function init() {
  if (token) {
    const isValid = await validateToken();
    if (isValid) {
      showMain();
    } else {
      showLanding();
    }
  } else {
    showLanding();
  }
}

init();