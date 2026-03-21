const API = "https://api.newhorizon.hk";
//const API = "http://localhost:57745";

const MARKET_INTERVAL_MS = 12_000;
const MARKET_SYMBOLS = [
  { key: "btc", symbol: "BTCUSD" },
  { key: "tsla", symbol: "TSLA" },
  { key: "nvda", symbol: "NVDA" },
  { key: "xaut", symbol: "XAUT" }
];

let chart;
let marketTimer;

function setUserIdentity() {
  const address = sessionStorage.getItem("dashboardAddress") || "未知地址";
  document.getElementById("user-address").innerText = address;
}

async function refreshMarketPrices() {
  try {
    const symbols = MARKET_SYMBOLS.map(item => item.symbol).join(",");
    const url = `https://api.hyperliquid.io/v1/market/ticker?symbols=${encodeURIComponent(symbols)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();

    MARKET_SYMBOLS.forEach(item => {
      const data = result[item.symbol] || {};
      const price = data.last || data.price || "--";
      const num = Number(price);
      const el = document.getElementById(`price-${item.key}`);
      el.innerText = Number.isFinite(num) ? num.toFixed(2) : price;
    });

    const status = document.getElementById("market-status");
    status.innerText = `更新于 ${new Date().toLocaleTimeString()}`;
    status.style.color = "#8ede9c";
  } catch (error) {
    const status = document.getElementById("market-status");
    status.innerText = "行情获取失败，稍后重试";
    status.style.color = "#f79a9a";
    console.error(error);
  }
}

function startMarketTicker() {
  if (marketTimer) clearInterval(marketTimer);
  refreshMarketPrices();
  marketTimer = setInterval(refreshMarketPrices, MARKET_INTERVAL_MS);
}

function ensureAuth() {
  const token = sessionStorage.getItem("dashboardToken");
  if (!token) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

async function loadData() {
  if (!ensureAuth()) return;

  const token = sessionStorage.getItem("dashboardToken");
  try {
    const res = await fetch(`${API}/data`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { equity, analysis } = await res.json();
    if (!Array.isArray(equity)) {
      document.getElementById("analysis").innerText = "无权益数据";
      return;
    }
    renderChart(equity);
    document.getElementById("analysis").innerText = analysis || "暂无分析文本";
  } catch (error) {
    console.error(error);
    document.getElementById("analysis").innerText = "读取数据失败，请刷新。";
  }
}

function renderChart(equity) {
  const points = equity.map((e) => ({ x: e.time, y: e.value }));

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById("chart"), {
    type: "scatter",
    data: {
      datasets: [{ label: "Equity", data: points, borderColor: "#6ec8ff", backgroundColor: "rgba(110,200,255,0.55)", pointRadius: 2, showLine: true }]
    },
    options: {
      parsing: false,
      responsive: true,
      scales: {
        x: { type: "linear", title: { display: true, text: "Time" }, grid: { color: "rgba(255,255,255,0.08)" } },
        y: { title: { display: true, text: "Equity" }, grid: { color: "rgba(255,255,255,0.08)" } }
      },
      plugins: { legend: { display: true, labels: { color: "#dbf2ff" } } }
    }
  });
}

function logout() {
  sessionStorage.removeItem("dashboardToken");
  sessionStorage.removeItem("dashboardAddress");
  window.location.href = "index.html";
}

window.addEventListener("load", () => {
  if (!ensureAuth()) return;
  setUserIdentity();
  startMarketTicker();
  loadData();
  document.getElementById("logout").onclick = logout;
});
