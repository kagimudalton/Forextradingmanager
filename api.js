/* api.js — thin fetch wrapper around the FastAPI backend. Cookies (session)
   are sent automatically via credentials:"include". */

const API_BASE = "/api";

async function apiRequest(path, { method = "GET", body = null } = {}) {
  const opts = {
    method,
    credentials: "include",
    headers: {},
  };
  if (body !== null) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, opts);

  if (res.status === 401) {
    // Session missing/expired — bounce to login unless we're already there.
    if (!location.pathname.endsWith("index.html") && location.pathname !== "/") {
      window.location.href = "/";
    }
    throw new Error("Not authenticated");
  }

  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }

  if (!res.ok) {
    const message = (data && data.detail) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

const api = {
  login: (username, password) => apiRequest("/login", { method: "POST", body: { username, password } }),
  logout: () => apiRequest("/logout", { method: "POST" }),
  me: () => apiRequest("/me"),

  account: () => apiRequest("/account"),
  positions: () => apiRequest("/positions"),
  history: (days = 30) => apiRequest(`/history?days=${days}`),
  riskStatus: () => apiRequest("/risk-status"),
  getSettings: () => apiRequest("/settings"),
  updateSettings: (payload) => apiRequest("/settings", { method: "POST", body: payload }),

  analyze: () => apiRequest("/analyze", { method: "POST" }),
  signals: (limit = 20) => apiRequest(`/signals?limit=${limit}`),

  tradeBuy: (payload) => apiRequest("/trade/buy", { method: "POST", body: payload }),
  tradeSell: (payload) => apiRequest("/trade/sell", { method: "POST", body: payload }),
  tradeClose: (ticket) => apiRequest("/trade/close", { method: "POST", body: { ticket } }),

  botStart: () => apiRequest("/bot/start", { method: "POST" }),
  botStop: () => apiRequest("/bot/stop", { method: "POST" }),
  botStatus: () => apiRequest("/bot/status"),

  // admin
  listUsers: () => apiRequest("/users"),
  createUser: (payload) => apiRequest("/users/create", { method: "POST", body: payload }),
  deleteUser: (id) => apiRequest(`/users/${id}`, { method: "DELETE" }),
  disableUser: (id) => apiRequest(`/users/${id}/disable`, { method: "POST" }),
  enableUser: (id) => apiRequest(`/users/${id}/enable`, { method: "POST" }),
  logs: (limit = 100) => apiRequest(`/logs?limit=${limit}`),
  mt5Status: () => apiRequest("/mt5-status"),
};

function connectWebSocket(onMessage) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      onMessage(msg);
    } catch (_) { /* ignore malformed frame */ }
  };
  ws.onclose = () => {
    // simple reconnect after a short delay
    setTimeout(() => connectWebSocket(onMessage), 4000);
  };
  return ws;
}

function showToast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function fmtMoney(n) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function fmtPct(n, digits = 1) {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(digits)}%`;
}
