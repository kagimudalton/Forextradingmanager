/* dashboard.js — powers dashboard.html: account stats, AI control center,
   market opportunities, risk status, open positions, live WS updates. */

let currentSettings = { max_trades: 5 };

document.addEventListener("DOMContentLoaded", async () => {
  const user = await initShell("dashboard");
  if (!user) return;

  document.getElementById("welcome-heading").textContent = `Welcome, ${user.username}`;

  await Promise.all([
    loadAccount(),
    loadPositions(),
    loadRiskStatus(),
    loadSignals(),
    loadBotStatus(),
    loadSettingsForCaps(),
  ]);

  wireButtons();
  connectWebSocket(handleWsMessage);
});

async function loadSettingsForCaps() {
  try {
    currentSettings = await api.getSettings();
    document.getElementById("stat-max-trades").textContent = currentSettings.max_trades;
  } catch (_) { /* non-fatal */ }
}

async function loadAccount() {
  try {
    const acct = await api.account();
    document.getElementById("stat-balance").textContent = fmtMoney(acct.balance);
    document.getElementById("stat-equity").textContent = fmtMoney(acct.equity);
    document.getElementById("stat-currency").textContent = acct.currency;
    document.getElementById("stat-margin-level").textContent = fmtPct(acct.margin_level);

    const dot = document.getElementById("mt5-dot");
    const text = document.getElementById("mt5-text");
    dot.classList.toggle("on", true);
    dot.classList.toggle("off", false);
    text.textContent = acct.mock ? "MT5 · Mock data" : `MT5 · ${acct.server}`;
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function loadPositions() {
  const body = document.getElementById("positions-body");
  try {
    const positions = await api.positions();
    document.getElementById("stat-open-trades").textContent = positions.length;

    const dailyProfit = positions.reduce((sum, p) => sum + p.profit, 0);
    const sub = document.getElementById("stat-daily-profit");
    const subline = document.getElementById("stat-daily-profit-sub");
    sub.textContent = fmtMoney(dailyProfit);
    sub.className = `stat-value ${dailyProfit >= 0 ? "up" : "down"}`;
    subline.textContent = `${positions.length} open position(s)`;

    if (!positions.length) {
      body.innerHTML = `<tr><td colspan="7" class="empty-state">No open positions.</td></tr>`;
      return;
    }

    body.innerHTML = positions.map((p) => `
      <tr>
        <td><strong>${p.symbol}</strong></td>
        <td><span class="opp-dir ${p.type}">${p.type}</span></td>
        <td>${p.volume}</td>
        <td>${p.open_price}</td>
        <td>${p.current_price}</td>
        <td class="${p.profit >= 0 ? "up" : "down"}">${fmtMoney(p.profit)}</td>
        <td><button class="btn btn-ghost" data-close-ticket="${p.ticket}">Close</button></td>
      </tr>
    `).join("");

    body.querySelectorAll("[data-close-ticket]").forEach((btn) => {
      btn.addEventListener("click", () => closeTrade(Number(btn.dataset.closeTicket)));
    });
  } catch (err) {
    body.innerHTML = `<tr><td colspan="7" class="empty-state">Failed to load positions.</td></tr>`;
  }
}

async function loadRiskStatus() {
  const card = document.getElementById("risk-card");
  try {
    const r = await api.riskStatus();
    card.innerHTML = `
      <div class="opp-row">
        <span class="muted">Daily Risk</span>
        <strong>${fmtPct(r.daily_risk_percent)}</strong>
      </div>
      <div class="opp-row">
        <span class="muted">Risk Used Today</span>
        <strong>${fmtPct(r.daily_risk_used_percent)}</strong>
      </div>
      <div class="opp-row">
        <span class="muted">Exposure</span>
        <span class="tag ${r.exposure}">${r.exposure}</span>
      </div>
      <div class="opp-row">
        <span class="muted">Drawdown</span>
        <strong>${fmtPct(r.drawdown_percent)}</strong>
      </div>
      <div class="opp-row">
        <span class="muted">Open / Max Trades</span>
        <strong>${r.open_trades} / ${r.max_trades}</strong>
      </div>
    `;
  } catch (err) {
    card.innerHTML = `<div class="empty-state">Failed to load risk status.</div>`;
  }
}

async function loadSignals() {
  const card = document.getElementById("opportunities-card");
  try {
    const signals = await api.signals(6);
    renderOpportunities(signals);
  } catch (_) {
    // leave the initial empty-state as-is
  }
}

function renderOpportunities(signals) {
  const card = document.getElementById("opportunities-card");
  if (!signals.length) {
    card.innerHTML = `<div class="empty-state">Run <strong>Analyze Markets</strong> to generate AI signals.</div>`;
    return;
  }
  card.innerHTML = signals.map((s) => `
    <div class="opp-row">
      <div class="opp-symbol">
        ${s.symbol}
        <span class="opp-dir ${s.direction}">${s.direction}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="confidence-bar-track"><div class="confidence-bar-fill" style="width:${s.confidence}%"></div></div>
        <span class="confidence-pct">${s.confidence}%</span>
      </div>
    </div>
  `).join("");
}

async function loadBotStatus() {
  try {
    const status = await api.botStatus();
    setBotStatusLine(status.running);
  } catch (_) { /* ignore */ }
}

function setBotStatusLine(running) {
  document.getElementById("bot-status-line").textContent =
    `Bot status: ${running ? "🟢 Running (Auto Mode)" : "⚪ Stopped"}`;
}

function wireButtons() {
  document.getElementById("btn-analyze").addEventListener("click", runAnalysis);
  document.getElementById("btn-generate").addEventListener("click", runAnalysis);

  document.getElementById("btn-start-bot").addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      const status = await api.botStart();
      setBotStatusLine(status.running);
      showToast("Auto mode started", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      e.target.disabled = false;
    }
  });

  document.getElementById("btn-stop-bot").addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      const status = await api.botStop();
      setBotStatusLine(status.running);
      showToast("Bot stopped", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      e.target.disabled = false;
    }
  });
}

async function runAnalysis() {
  const btn = document.getElementById("btn-analyze");
  const btn2 = document.getElementById("btn-generate");
  btn.disabled = true; btn2.disabled = true;
  btn.textContent = "🔍 Analyzing…";
  try {
    const results = await api.analyze();
    renderOpportunities(results);
    await loadPositions();
    showToast(`Analysis complete — ${results.length} symbols scanned`, "success");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false; btn2.disabled = false;
    btn.textContent = "🔍 Analyze Markets";
  }
}

async function closeTrade(ticket) {
  try {
    await api.tradeClose(ticket);
    showToast(`Position ${ticket} closed`, "success");
    await Promise.all([loadPositions(), loadRiskStatus()]);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function handleWsMessage(msg) {
  switch (msg.event) {
    case "trade_opened":
    case "trade_closed":
      loadPositions();
      loadRiskStatus();
      break;
    case "analysis_complete":
      renderOpportunities(msg.data);
      break;
    case "bot_status":
      setBotStatusLine(msg.data.running);
      break;
    case "price_update":
      // Lightweight — could be wired into a ticker; no-op for V1 stat cards.
      break;
  }
}
