# Private AI MT5 Trading Intelligence Dashboard — v1

A private, admin-provisioned trading command center: FastAPI + SQLite backend,
vanilla HTML/CSS/JS frontend, rule-based AI market analysis, risk management,
and a MetaTrader 5 connector.

```
Browser (HTML/CSS/JS)
        │
FastAPI REST + WebSocket API
        │
Trading Service (market_analyzer / risk_manager)
        │
MT5 Connector (mt5_connector.py)
        │
MetaTrader 5 Terminal → Broker Account
```

The frontend never talks to MT5 directly — every request goes through the
FastAPI backend.

---

## 1. Project layout

```
mt5-dashboard/
├── backend/
│   ├── main.py                # FastAPI app, static file serving, WebSocket, startup
│   ├── ws_manager.py          # WebSocket broadcast manager
│   ├── requirements.txt
│   ├── db/
│   │   └── database.py        # SQLite schema + connection helpers
│   ├── services/
│   │   ├── security.py        # password hashing + session auth
│   │   ├── mt5_connector.py   # MT5 API wrapper (with mock fallback)
│   │   ├── market_analyzer.py # indicators + AI-style confidence scoring
│   │   └── risk_manager.py    # position sizing, exposure, drawdown
│   └── routers/
│       ├── auth.py            # /login /logout /me
│       ├── dashboard.py       # /account /positions /history /risk-status /settings
│       ├── analysis.py        # /analyze /signals
│       ├── trading.py         # /trade/buy /trade/sell /trade/close /bot/*
│       └── admin.py           # /users/* /logs /mt5-status
└── frontend/
    ├── index.html              # login
    ├── dashboard.html          # main trading dashboard
    ├── profile.html            # personal risk settings
    ├── admin.html               # admin panel
    ├── css/style.css
    └── js/{api.js, app.js, shared.js, dashboard.js}
```

---

## 2. Important note on MetaTrader 5 connectivity

The official `MetaTrader5` Python package **only runs on Windows** — it talks
to a locally installed MT5 terminal over native IPC. There is no Linux/Mac
build.

`mt5_connector.py` handles this cleanly:

* If the `MetaTrader5` package is importable **and** `MT5_LOGIN` is set, it
  connects to your real terminal/broker.
* Otherwise it transparently falls back to **mock mode** — deterministic,
  realistic account/position/price data — so the rest of the platform (API,
  DB, frontend, WebSocket) is fully runnable and testable on any OS without a
  broker connection. The admin panel's "Data Mode" indicator shows which mode
  is active.

To go live:
1. Run this app on a Windows machine with the MT5 terminal installed and
   logged into your broker.
2. `pip install MetaTrader5` (uncomment it in `requirements.txt`).
3. Set environment variables `MT5_LOGIN`, `MT5_PASSWORD`, `MT5_SERVER`.

---

## 3. Installation

Requires Python 3.10+.

```bash
cd mt5-dashboard/backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Environment variables (optional)

| Variable            | Purpose                                   | Default          |
|---------------------|--------------------------------------------|-------------------|
| `SEED_ADMIN_USER`   | Username for the auto-created first admin | `admin`           |
| `SEED_ADMIN_PASS`   | Password for that admin                   | `ChangeMe123!`    |
| `MT5_LOGIN`         | MT5 account number (enables live mode)    | unset (mock mode) |
| `MT5_PASSWORD`      | MT5 account password                      | unset             |
| `MT5_SERVER`        | MT5 broker server name                    | unset             |

---

## 4. Running it

```bash
cd mt5-dashboard/backend
uvicorn main:app --reload --port 8000
```

Open **http://localhost:8000**. On first run the app auto-creates an admin
account (`admin` / `ChangeMe123!` by default — printed to the console).
**Change this password immediately** by creating a new admin user from the
Admin Panel and disabling/deleting the seed account, since there's no
self-registration by design.

Log in → you land on `dashboard.html`. From there:
* **Analyze Markets / Generate Signals** → runs `market_analyzer.py` against
  the watchlist (XAUUSD, EURUSD, NAS100, GBPUSD, BTCUSD) and stores results in
  the `signals` table.
* **Start Auto Mode / Stop Bot** → flips a per-user `bot_status` flag and
  broadcasts it over WebSocket (hook your own scheduled trading loop into
  `services/mt5_connector.py` + `services/risk_manager.py` here for v2).
* **Risk Manager** card → live position sizing / exposure / drawdown from
  `risk_manager.py`, using each user's personal settings from `profile.html`.
* **Admin Panel** (ADMIN role only) → create/disable/delete users, and view
  system logs + MT5 connection status.

---

## 5. User roles

| Role    | Can do |
|---------|--------|
| ADMIN   | Everything TRADER can, plus create/disable/delete users, view system logs, view MT5 status |
| TRADER  | View dashboard, run analysis, view signals, manage own risk settings, open/close trades |
| VIEWER  | View dashboards and reports only — trading endpoints reject VIEWER with 403 |

There is **no self-registration**. Only an ADMIN can create accounts, via
Admin Panel → Create User, or `POST /api/users/create`.

---

## 6. API reference

All endpoints are prefixed with `/api` and (except `/login`) require a valid
`session_token` cookie set by `/login`.

**Auth**
```
POST /api/login          { username, password } → sets session cookiegh
POST /api/logout
GET  /api/me              → { id, username, role }
```

**Dashboard**
```
GET  /api/account
GET  /api/positions
GET  /api/history?days=30
GET  /api/risk-status
GET  /api/settings
POST /api/settings        { risk_percent, max_trades, max_daily_loss_percent }
```

**Analysis**
```
POST /api/analyze         → runs market_analyzer.py over the watchlist
GET  /api/signals?limit=20
```

**Trading** (TRADER or ADMIN only)
```
POST /api/trade/buy       { symbol, volume, sl?, tp? }
POST /api/trade/sell      { symbol, volume, sl?, tp? }
POST /api/trade/close     { ticket }
POST /api/bot/start
POST /api/bot/stop
GET  /api/bot/status
```

**Admin** (ADMIN only)
```
POST   /api/users/create  { username, password, role }
GET    /api/users
DELETE /api/users/{id}
POST   /api/users/{id}/disable
POST   /api/users/{id}/enable
GET    /api/logs?limit=100
GET    /api/mt5-status
```

**WebSocket**
```
ws://localhost:8000/ws
```
Events pushed: `price_update`, `analysis_complete`, `trade_opened`,
`trade_closed`, `bot_status`.

---

## 7. Testing it end-to-end

1. Start the server (`uvicorn main:app --reload --port 8000`).
2. Log in as the seed admin at `http://localhost:8000`.
3. Admin Panel → create a TRADER user.
4. Log out, log back in as the trader.
5. Dashboard → click **Analyze Markets** → confirm the Market Opportunities
   card populates with symbols/confidence bars, and open a WebSocket console
   (`new WebSocket("ws://localhost:8000/ws")` in devtools) to see the
   `analysis_complete` event.
6. Open a mock trade from a signal card or via `POST /api/trade/buy` with
   body `{"symbol": "XAUUSD", "volume": 0.1}` — confirm it shows up under
   Open Positions and in the Admin Panel's system logs.
7. Profile page → change risk % / max trades → Dashboard's Risk Manager card
   should reflect the new values immediately.
8. Log back in as admin → Admin Panel → confirm the trader's actions appear
   in System Logs, and disable the trader account, then confirm that account
   can no longer log in.

### Quick backend logic tests (no server needed)

The pure-Python modules can be exercised directly:

```bash
cd backend
python3 -c "
from services import risk_manager
print(risk_manager.position_size(balance=10000, risk_percent=1, stop_loss_pips=20))
"
```

---

## 8. Next steps (v2 ideas)

* Swap the rule-based `market_analyzer.py` scoring for a trained ML model
  behind the same `analyze_symbol()` interface.
* Wire `bot_status` into an actual scheduled loop that calls
  `market_analyzer.analyze_watchlist()` + `risk_manager.check_trade_allowed()`
  + `mt5_connector.open_trade()` on an interval.
* Add real-time candlestick charts (e.g. lightweight-charts) fed by the
  `price_update` WebSocket event.
* Add 2FA for ADMIN accounts and per-IP login rate limiting.
* Persist per-user watchlists instead of the shared default list.

