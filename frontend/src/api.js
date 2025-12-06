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
