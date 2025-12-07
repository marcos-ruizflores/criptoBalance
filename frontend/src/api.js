const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function handleResponse(res) {
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Error HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchTrades() {
  const res = await fetch(`${API_URL}/trades?with_pnl=true`);
  return handleResponse(res);
}

export async function fetchPortfolio() {
  const res = await fetch(`${API_URL}/portfolio`);
  return handleResponse(res);
}

export async function createTrade(payload) {
  const res = await fetch(`${API_URL}/trades`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteTradeById(id) {
  const res = await fetch(`${API_URL}/trades/${id}`, { method: "DELETE" });
  return handleResponse(res);
}

export async function fetchHistory(baseAsset, interval = "1d", limit = 90) {
  const res = await fetch(
    `${API_URL}/history?base_asset=${encodeURIComponent(baseAsset)}&interval=${interval}&limit=${limit}`
  );
  return handleResponse(res);
}

export async function exportTrades() {
  const res = await fetch(`${API_URL}/trades/export`);
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  return res.blob();
}

export async function importTrades(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/trades/import`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(res);
}

export async function fetchSnapshots() {
  const res = await fetch(`${API_URL}/snapshots`);
  return handleResponse(res);
}

export async function createSnapshot() {
  const res = await fetch(`${API_URL}/snapshots`, { method: "POST" });
  return handleResponse(res);
}

export async function deleteSnapshot(id) {
  const res = await fetch(`${API_URL}/snapshots/${id}`, { method: "DELETE" });
  return handleResponse(res);
}

export async function fetchAlerts() {
  const res = await fetch(`${API_URL}/alerts`);
  return handleResponse(res);
}

export async function createAlert(payload) {
  const res = await fetch(`${API_URL}/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteAlertById(id) {
  const res = await fetch(`${API_URL}/alerts/${id}`, { method: "DELETE" });
  return handleResponse(res);
}

export async function evaluateAlerts() {
  const res = await fetch(`${API_URL}/alerts/evaluate`, { method: "POST" });
  return handleResponse(res);
}

export async function fetchTopMarketCaps(limit = 15) {
  const res = await fetch(`${API_URL}/market/top?limit=${limit}`);
  return handleResponse(res);
}
