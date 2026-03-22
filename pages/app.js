// Update to your deployed Worker URL, e.g. https://equity-worker.<account>.workers.dev
const API = "https://api.newhorizon.hk";
//const API = "http://localhost:57745";

const MARKET_INTERVAL_MS = 12_000;
const MARKET_API = `${API}/market`;

let marketTimer;

function saveAuthSession(token, address) {
  try {
    localStorage.setItem("dashboardToken", token);
    localStorage.setItem("dashboardAddress", address);
  } catch (error) {
    console.warn("localStorage unavailable", error);
  }

  sessionStorage.setItem("dashboardToken", token);
  sessionStorage.setItem("dashboardAddress", address);
}

// 设备检测函数
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

function isDesktop() {
  return !isIOS() && !isAndroid() && !/Mobile/.test(navigator.userAgent);
}

function setMarketValue(id, price) {
  const element = document.getElementById(id);
  if (!element) return;

  const num = Number(price);
  element.innerText = Number.isFinite(num) ? num.toFixed(2) : price;
}

async function refreshMarketPrices() {
  try {
    const status = document.getElementById("market-status");
    const res = await fetch(MARKET_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const market = await res.json();

    setMarketValue("price-btc", market.btc);
    setMarketValue("price-eth", market.eth);
    setMarketValue("price-tsla", market.tsla);
    setMarketValue("price-nvda", market.nvda);
    setMarketValue("price-xaut", market.xaut);

    if (status) {
      status.innerText = `更新于 ${new Date().toLocaleTimeString()}`;
      status.style.color = "#8ede9c";
    }
  } catch (error) {
    const status = document.getElementById("market-status");
    if (status) {
      status.innerText = "行情获取失败，稍后重试";
      status.style.color = "#f79a9a";
    }
    console.error(error);
  }
}

function startMarketTicker() {
  const marketBar = document.getElementById("market-bar");
  if (marketBar) {
    marketBar.style.display = "flex";
  }

  if (marketTimer) clearInterval(marketTimer);
  refreshMarketPrices();
  marketTimer = setInterval(refreshMarketPrices, MARKET_INTERVAL_MS);
}

// 登录页脚本，仅做 auth 并跳转到 dashboard

document.getElementById("login").onclick = async () => {
  let ethereumProvider = window.ethereum;

  if (!ethereumProvider) {
    if (isIOS()) {
      // iOS: 尝试跳转到 MetaMask App
      window.location.href = 'metamask://';
      return;
    } else if (isAndroid()) {
      // Android: 跳转到 Play Store
      window.location.href = 'https://play.google.com/store/apps/details?id=io.metamask';
      return;
    } else if (isDesktop()) {
      // Desktop: 使用 WalletConnect 扫码
      try {
        const provider = new WalletConnectProvider({
          bridge: "https://bridge.walletconnect.org",
          qrcodeModal: true,
          qrcodeModalOptions: {
            mobileLinks: ["metamask"],
          },
          rpc: {
            1: "https://cloudflare-eth.com", // 使用公共 RPC
          },
          chainId: 1,
        });
        await provider.enable();
        ethereumProvider = provider;
      } catch (error) {
        console.error("WalletConnect error:", error);
        alert("扫码连接失败，请安装 MetaMask 扩展或检查网络");
        window.location.href = 'https://metamask.io/download/';
        return;
      }
    } else {
      window.location.href = 'https://metamask.io/download/';
      return;
    }
  }

  try {
    const [address] = await ethereumProvider.request({
      method: "eth_requestAccounts"
    });

    const challengeRes = await fetch(`${API}/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address })
    });

    const challenge = await challengeRes.json();
    if (!challenge.ok) return alert("Denied");

    const message = challenge.message;
    const signature = await ethereumProvider.request({
      method: "personal_sign",
      params: [message, address]
    });

    const res = await fetch(`${API}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, signature, message })
    });

    const data = await res.json();
    if (!data.ok) return alert("Denied");

    saveAuthSession(data.token, address);
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error(error);
    alert("请连接钱包");
  }
};

window.addEventListener("load", () => {
  if (document.getElementById("market-bar")) {
    startMarketTicker();
  }
});
