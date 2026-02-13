// Update to your deployed Worker URL, e.g. https://equity-worker.<account>.workers.dev
const API = "https://api.newhorizon.hk";
//const API = "http://localhost:57745";


let token;
let chart;

document.getElementById("login").onclick = async () => {
  const [address] = await ethereum.request({
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
  const signature = await ethereum.request({
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

  token = data.token;
  document.getElementById("login").style.display = "none";
  document.getElementById("status").innerText = "Authenticated";
  loadData();
};

async function loadData() {
  const res = await fetch(`${API}/data`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    document.getElementById("status").innerText = `Load failed: ${res.status}`;
    console.error("Load failed:", res.status, text);
    return;
  }

  const { equity, analysis } = await res.json();
  if (!Array.isArray(equity)) {
    document.getElementById("status").innerText = "No equity data";
    return;
  }
  renderChart(equity);
  document.getElementById("analysis").innerText = analysis;
}

function renderChart(equity) {
  if (chart) chart.destroy();
  chart = new Chart(document.getElementById("chart"), {
    type: "scatter",
    data: {
      datasets: [{
        label: "Equity",
        data: equity.map(e => ({ x: e.time, y: e.value }))
      }]
    },
    options: {
      parsing: false,
      scales: {
        x: { type: "linear", title: { display: true, text: "Time" } },
        y: { title: { display: true, text: "Equity" } }
      }
    }
  });
}
