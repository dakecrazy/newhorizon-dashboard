// Update to your deployed Worker URL, e.g. https://equity-worker.<account>.workers.dev
const API = "https://your-worker-domain";

let token;

document.getElementById("login").onclick = async () => {
  const [address] = await ethereum.request({
    method: "eth_requestAccounts"
  });

  const challengeRes = await fetch(`${API}/challenge`, {
    method: "POST",
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
    body: JSON.stringify({ address, signature, message })
  });

  const data = await res.json();
  if (!data.ok) return alert("Denied");

  token = data.token;
  loadData();
};

async function loadData() {
  const res = await fetch(`${API}/data`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const { equity, analysis } = await res.json();
  renderChart(equity);
  document.getElementById("analysis").innerText = analysis;
}

function renderChart(equity) {
  new Chart(document.getElementById("chart"), {
    type: "line",
    data: {
      labels: equity.map(e => e.time),
      datasets: [{ data: equity.map(e => e.value) }]
    }
  });
}
