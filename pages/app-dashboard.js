const API = "https://api.newhorizon.hk";
//const API = "http://localhost:8787";

const MARKET_INTERVAL_MS = 12_000;
const MARKET_SYMBOLS = [
  { key: "btc", symbol: "BTCUSD" },
  { key: "eth", symbol: "ETHUSD" },
  { key: "tsla", symbol: "TSLA" },
  { key: "nvda", symbol: "NVDA" },
  { key: "xaut", symbol: "XAUT" }
];

let chart;
let marketTimer;

const DEV_SKIP_AUTH = false; // 临时 true 为跳过登录验证

function setUserIdentity() {
  const address = sessionStorage.getItem("dashboardAddress") || "未知地址";
  document.getElementById("user-address").innerText = address;
}

async function refreshMarketPrices() {
  try {
    const url = `https://api.hyperliquid.xyz/info`;

    // 获取所有价格的Promise
    const promises = [
      // Perp markets (BTC, ETH)
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' })
      }).then(r => r.json()),

      // Spot markets (XAUT)
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'spotMetaAndAssetCtxs' })
      }).then(r => r.json()),

      // HIP-3 markets (TSLA, NVDA)
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs', dex: 'xyz' })
      }).then(r => r.json())
    ];

    const [perpResult, spotResult, hip3Result] = await Promise.all(promises);

    // 解析 Perp 数据
    // perpResult = [meta, assetCtxs]
    const perpMeta = perpResult[0];
    const perpAssetCtxs = perpResult[1];
    
    // 找到 BTC 和 ETH 的索引
    const btcIndex = perpMeta.universe.findIndex(u => u.name === 'BTC');
    const ethIndex = perpMeta.universe.findIndex(u => u.name === 'ETH');
    
    if (btcIndex >= 0) {
      const btc = perpAssetCtxs[btcIndex];
      const price = btc.markPx;
      const num = Number(price);
      document.getElementById(`price-btc`).innerText = Number.isFinite(num) ? num.toFixed(2) : price;
    }
    
    if (ethIndex >= 0) {
      const eth = perpAssetCtxs[ethIndex];
      const price = eth.markPx;
      const num = Number(price);
      document.getElementById(`price-eth`).innerText = Number.isFinite(num) ? num.toFixed(2) : price;
    }

    // 解析 Spot 数据
    // spotResult = [spotMeta, assetCtxs]
    const spotMeta = spotResult[0];
    const spotAssetCtxs = spotResult[1];
    
    // 找到 XAUT 的索引 (XAUT0 对应 @182)
    const xautIndex = 182; // 硬编码 XAUT0 的索引位置
    if (xautIndex >= 0 && spotAssetCtxs[xautIndex]) {
      const xaut = spotAssetCtxs[xautIndex];
      const price = xaut.markPx;
      const num = Number(price);
      document.getElementById(`price-xaut`).innerText = Number.isFinite(num) ? num.toFixed(2) : price;
    }

    // 解析 HIP-3 数据
    // hip3Result = [meta, assetCtxs]
    const hip3Meta = hip3Result[0];
    const hip3AssetCtxs = hip3Result[1];
    
    // 找到 TSLA 和 NVDA 的索引 (HIP-3 资产名格式: xyz:TSLA)
    const tslaIndex = hip3Meta.universe.findIndex(u => u.name === 'xyz:TSLA');
    const nvdaIndex = hip3Meta.universe.findIndex(u => u.name === 'xyz:NVDA');
    
    if (tslaIndex >= 0) {
      const tsla = hip3AssetCtxs[tslaIndex];
      const price = tsla.markPx;
      const num = Number(price);
      document.getElementById(`price-tsla`).innerText = Number.isFinite(num) ? num.toFixed(2) : price;
    }
    
    if (nvdaIndex >= 0) {
      const nvda = hip3AssetCtxs[nvdaIndex];
      const price = nvda.markPx;
      const num = Number(price);
      document.getElementById(`price-nvda`).innerText = Number.isFinite(num) ? num.toFixed(2) : price;
    }

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
  // 仅在 dashboard 页面启用行情更新和 token 检查
  if (!window.location.pathname.endsWith("dashboard.html")) {
    return;
  }

  startMarketTicker();

  if (!DEV_SKIP_AUTH && !ensureAuth()) return;

  if (!DEV_SKIP_AUTH) setUserIdentity();
  if (!DEV_SKIP_AUTH) loadData();

  // 如果跳过 auth, 也可以写个假地址
  if (DEV_SKIP_AUTH) {
    document.getElementById("user-address").innerText = "0xDEVELOP";
  }
  // 依旧保留登出按钮，便于重复测试
  document.getElementById("logout").onclick = logout;
});
