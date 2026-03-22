const API = "https://api.newhorizon.hk";
//const API = "http://localhost:8787";

const MARKET_INTERVAL_MS = 12_000;
const MARKET_API = `${API}/market`;

let chart;
let marketTimer;

function setMarketValue(id, price) {
  const element = document.getElementById(id);
  if (!element) return;

  const num = Number(price);
  element.innerText = Number.isFinite(num) ? num.toFixed(2) : price;
}

function setUserIdentity() {
  const address = sessionStorage.getItem("dashboardAddress") || "未知地址";
  document.getElementById("user-address").innerText = address;
}

async function refreshMarketPrices() {
  try {
    const res = await fetch(MARKET_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const market = await res.json();

    setMarketValue("price-btc", market.btc);
    setMarketValue("price-eth", market.eth);
    setMarketValue("price-tsla", market.tsla);
    setMarketValue("price-nvda", market.nvda);
    setMarketValue("price-xaut", market.xaut);

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
