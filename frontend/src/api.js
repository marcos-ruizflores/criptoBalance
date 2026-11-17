const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

let token = null;
let onUnauthorized = () => {};

export function setSession(newToken, handleUnauthorized) {
  token = newToken;
  if (handleUnauthorized) onUnauthorized = handleUnauthorized;
}

async function request(path, { method = "GET", json, body, raw = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : body,
  });

  // Expired or invalid session: drop it and send the user back to the login screen
  if (res.status === 401 && token) {
    onUnauthorized();
  }
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Error HTTP ${res.status}`);
  }
  return raw ? res.blob() : res.json();
}

export const fetchTrades = () => request("/trades?with_pnl=true");
export const fetchPortfolio = () => request("/portfolio");
export const createTrade = (payload) => request("/trades", { method: "POST", json: payload });
export const deleteTradeById = (id) => request(`/trades/${encodeURIComponent(id)}`, { method: "DELETE" });
export const exportTrades = () => request("/trades/export", { raw: true });

export function importTrades(file) {
  const formData = new FormData();
  formData.append("file", file);
  return request("/trades/import", { method: "POST", body: formData });
}

export const fetchHistory = (baseAsset, interval = "1d", limit = 90) =>
  request(`/history?base_asset=${encodeURIComponent(baseAsset)}&interval=${interval}&limit=${limit}`);
export const fetchTopMarketCaps = (limit = 15) => request(`/market/top?limit=${limit}`);

export const fetchSnapshots = () => request("/snapshots");
export const createSnapshot = () => request("/snapshots", { method: "POST" });
export const deleteSnapshot = (id) => request(`/snapshots/${encodeURIComponent(id)}`, { method: "DELETE" });

export const fetchAlerts = () => request("/alerts");
export const createAlert = (payload) => request("/alerts", { method: "POST", json: payload });
export const deleteAlertById = (id) => request(`/alerts/${encodeURIComponent(id)}`, { method: "DELETE" });
export const evaluateAlerts = () => request("/alerts/evaluate", { method: "POST" });

// The assistant answers as NDJSON, one event per line, so text shows up as it's written.
// EventSource can't send the Authorization header, hence fetch + a stream reader.
export async function streamChat(messages, onEvent, signal) {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (res.status === 401) onUnauthorized();
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).detail;
    } catch {}
    throw new Error(typeof detail === "string" && detail ? detail : `Error HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (line.trim()) onEvent(JSON.parse(line));
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer));
}

export const signup = (payload) => request("/auth/signup", { method: "POST", json: payload });
export const login = (payload) => request("/auth/login", { method: "POST", json: payload });
