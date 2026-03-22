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

function getInjectedProvider() {
  if (!window.ethereum) return null;

  if (Array.isArray(window.ethereum.providers)) {
    return (
      window.ethereum.providers.find((provider) => provider.isMetaMask && typeof provider.request === "function") ||
      window.ethereum.providers.find((provider) => typeof provider.request === "function") ||
      null
    );
  }

  return typeof window.ethereum.request === "function" ? window.ethereum : null;
}

function getWalletErrorMessage(error) {
  if (error?.code === 4001) {
    return "你取消了钱包授权或签名。";
  }

  if (error?.message) {
    if (error.message.includes("No matching key")) {
      return "当前钱包没有可用账户，请先在 MetaMask 中解锁并选择账户。";
    }
    if (error.message.includes("User rejected")) {
      return "你取消了钱包授权或签名。";
    }
    return `钱包连接失败: ${error.message}`;
  }

  return "钱包连接失败，请确认 MetaMask 已解锁并已授权当前网站。";
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
  let ethereumProvider = getInjectedProvider();

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
        alert("未检测到 MetaMask 插件，且扫码连接失败，请安装插件或打开 MetaMask 钱包重试。");
        return;
      }
    } else {
      alert("请使用 MetaMask 钱包完成连接。");
      return;
    }
  }

  try {
    if (!ethereumProvider || typeof ethereumProvider.request !== "function") {
      alert("未检测到可用的钱包插件，请确认 MetaMask 已安装并启用。");
      return;
    }

    const [address] = await ethereumProvider.request({
      method: "eth_requestAccounts"
    });

    const challengeRes = await fetch(`${API}/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address })
    });
    if (!challengeRes.ok) throw new Error(`challenge HTTP ${challengeRes.status}`);

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
    if (!res.ok) throw new Error(`verify HTTP ${res.status}`);

    const data = await res.json();
    if (!data.ok) return alert("Denied");

    saveAuthSession(data.token, address);
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error(error);
    alert(getWalletErrorMessage(error));
  }
};

window.addEventListener("load", () => {
  if (document.getElementById("market-bar")) {
    startMarketTicker();
  }
});
