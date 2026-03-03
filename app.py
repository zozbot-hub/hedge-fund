"""
Crypto Hedge Fund Dashboard — momentum-first workflow.
Features: live price, agent status cards, cycle countdown,
7-day PnL calendar, open positions, closed trades, signals, live log.
"""

import os, sys, subprocess
from datetime import datetime, date, timedelta
from flask import Flask, jsonify
from flask_cors import CORS

# Import config (works with or without env vars)
import config

app = Flask(__name__)
LOG_PATH = config.LOG_PATH

# Enable CORS for GitHub Pages and local development
CORS(app, resources={
    r"/api/*": {
        "origins": ["*"]  # Restrict to your GitHub Pages domain in production
    }
})

# ── helpers ───────────────────────────────────────────────────────────────────

def get_db():
    try:
        import psycopg2
        return psycopg2.connect(
            host=config.DB_HOST,
            port=config.DB_PORT,
            user=config.DB_USER,
            password=config.DB_PASS,
            database=config.DB_NAME,
            connect_timeout=3
        )
    except Exception:
        return None

def get_redis():
    try:
        import redis
        r = redis.Redis(
            host=config.REDIS_HOST,
            port=config.REDIS_PORT,
            decode_responses=True,
            socket_connect_timeout=2
        )
        r.ping()
        return r
    except Exception:
        return None

def orchestrator_pid():
    try:
        out = subprocess.run(['ps','aux'], capture_output=True, text=True, timeout=3).stdout
        for l in out.splitlines():
            if 'orchestrator' in l and 'grep' not in l:
                return int(l.split()[1])
    except Exception:
        pass
    return None

def tail_log(n=35):
    try:
        with open(LOG_PATH) as f:
            lines = f.readlines()
        return ''.join(lines[-n:])
    except Exception:
        return 'Log not available'

# ── data ──────────────────────────────────────────────────────────────────────

def fetch_data():
    r  = get_redis()
    db = get_db()

    # BTC price
    price = None
    if r:
        try: price = float(r.get('btcusdt:current_price') or 0) or None
        except Exception: pass

    # Orchestrator
    pid = orchestrator_pid()

    # Agent status cards — last signal per agent
    agents = {}
    if db:
        try:
            cur = db.cursor()
            cur.execute("""
                SELECT DISTINCT ON (strategy) strategy, action, confidence, created_at
                FROM strategy_signals ORDER BY strategy, created_at DESC
            """)
            for row in cur.fetchall():
                agents[row[0]] = dict(action=row[1], conf=float(row[2]) if row[2] else 0,
                                      at=row[3].strftime('%H:%M') if row[3] else '?')
            cur.close()
        except Exception: pass

    # Open trades
    open_trades = []
    if db:
        try:
            cur = db.cursor()
            cur.execute("""SELECT id, strategy_agent, action, entry_price, size_btc,
                                  stop_loss, take_profit, opened_at
                           FROM trades WHERE status='OPEN' ORDER BY opened_at DESC""")
            for row in cur.fetchall():
                entry = float(row[3]); size = float(row[4])
                sl = float(row[5]) if row[5] else 0
                tp = float(row[6]) if row[6] else 0
                upnl = upnl_pct = dist_sl = dist_tp = None
                if price and entry and size:
                    d = 1 if row[2].upper() == 'BUY' else -1
                    upnl = round(d * (price - entry) * size, 2)
                    upnl_pct = round(upnl / (entry * size) * 100, 2)
                if price and sl: dist_sl = round((price - sl) / price * 100, 2)
                if price and tp: dist_tp = round((tp - price) / price * 100, 2)
                # duration
                dur = ''
                if row[7]:
                    mins = int((datetime.now() - row[7]).total_seconds() / 60)
                    dur = f"{mins}m" if mins < 60 else f"{mins//60}h{mins%60:02d}m"
                open_trades.append(dict(id=row[0], strategy=row[1], side=row[2],
                    entry=entry, size=size, sl=sl, tp=tp,
                    upnl=upnl, upnl_pct=upnl_pct,
                    dist_sl=dist_sl, dist_tp=dist_tp, dur=dur))
            cur.close()
        except Exception: pass

    # Closed trades
    closed = []
    win_rate = total_pnl = avg_dur = None
    if db:
        try:
            cur = db.cursor()
            cur.execute("""SELECT closed_at, strategy_agent, action, entry_price,
                                  exit_price, pnl_usdt, pnl_percent,
                                  EXTRACT(EPOCH FROM (closed_at - opened_at))/60
                           FROM trades WHERE status='CLOSED' ORDER BY closed_at DESC LIMIT 20""")
            rows = cur.fetchall()
            for row in rows:
                mins = int(float(row[7])) if row[7] else None
                dur_str = (f"{mins}m" if mins and mins < 60 else
                           f"{mins//60}h{mins%60:02d}m" if mins else '?')
                closed.append(dict(
                    time=row[0].strftime('%m-%d %H:%M') if row[0] else '?',
                    strategy=row[1], side=row[2],
                    entry=float(row[3]) if row[3] else 0,
                    exit=float(row[4]) if row[4] else 0,
                    pnl=float(row[5]) if row[5] is not None else None,
                    pnl_pct=float(row[6]) if row[6] is not None else None,
                    dur=dur_str))
            if rows:
                pnls = [float(r[5]) for r in rows if r[5] is not None]
                wins = sum(1 for p in pnls if p > 0)
                win_rate  = round(wins / len(pnls) * 100, 1) if pnls else 0
                total_pnl = round(sum(pnls), 2)
                durs = [float(r[7]) for r in rows if r[7] is not None]
                avg_dur = round(sum(durs)/len(durs)) if durs else None
            cur.close()
        except Exception: pass

    # 7-day PnL calendar
    calendar = []
    today = date.today()
    if db:
        try:
            cur = db.cursor()
            cur.execute("""SELECT DATE(closed_at), SUM(pnl_usdt), COUNT(*),
                                  SUM(CASE WHEN pnl_usdt > 0 THEN 1 ELSE 0 END)
                           FROM trades WHERE status='CLOSED'
                             AND closed_at > NOW() - INTERVAL '7 days'
                           GROUP BY DATE(closed_at)""")
            day_map = {row[0]: (float(row[1]), int(row[2]), int(row[3])) for row in cur.fetchall()}
            for i in range(6, -1, -1):
                d = today - timedelta(days=i)
                pnl, tc, wins = day_map.get(d, (None, 0, 0))
                calendar.append(dict(date=d.strftime('%a %d'), pnl=pnl, trades=tc, wins=wins,
                                     today=(d == today)))
            cur.close()
        except Exception: pass

    # Recent signals
    signals = []
    if db:
        try:
            cur = db.cursor()
            cur.execute("""SELECT created_at, strategy, action, confidence,
                                  was_executed, rejection_reason, signal_data
                           FROM strategy_signals ORDER BY created_at DESC LIMIT 40""")
            for row in cur.fetchall():
                sd = row[6] or {}
                llm_used = sd.get('extra', {}).get('llm_used', False) if isinstance(sd, dict) else False
                signals.append(dict(time=row[0].strftime('%H:%M:%S') if row[0] else '?',
                    strategy=row[1], action=row[2],
                    conf=float(row[3]) if row[3] else 0,
                    executed=row[4], rejection=row[5], llm_used=llm_used))
            cur.close()
        except Exception: pass

    # LLM stats
    llm_avg = None
    if db:
        try:
            cur = db.cursor()
            cur.execute("SELECT AVG(latency_ms) FROM llm_calls WHERE created_at > NOW() - INTERVAL '1 hour'")
            row = cur.fetchone()
            if row and row[0]: llm_avg = round(float(row[0])/1000, 1)
            cur.close()
        except Exception: pass

    if db: db.close()

    return dict(price=price, now=datetime.now().strftime('%H:%M:%S'),
                pid=pid, running=pid is not None,
                agents=agents, open_trades=open_trades,
                closed=closed, win_rate=win_rate,
                total_pnl=total_pnl, trade_count=len(closed),
                avg_dur=avg_dur, calendar=calendar,
                signals=signals, llm_avg=llm_avg, log=tail_log())


# ── render ────────────────────────────────────────────────────────────────────

def render(d):
    price_str = f"${d['price']:,.2f}" if d['price'] else 'N/A'
    run_col   = '#00e676' if d['running'] else '#ff5252'
    run_lbl   = f"Running (PID {d['pid']})" if d['running'] else 'Stopped'
    pnl_col   = '#00e676' if (d['total_pnl'] or 0) >= 0 else '#ff5252'
    pnl_str   = f"${d['total_pnl']:+,.2f}" if d['total_pnl'] is not None else '$0.00'
    wr_str    = f"{d['win_rate']:.1f}%" if d['win_rate'] is not None else 'N/A'
    dur_str   = f"{d['avg_dur']}m" if d['avg_dur'] else 'N/A'
    llm_str   = f"{d['llm_avg']}s" if d['llm_avg'] else 'timeout'

    # ── agent cards ───────────────────────────────────────────────────────────
    agent_order = ['momentum','meanreversion','grid','sentiment']
    agent_cards = ''
    for a in agent_order:
        info = d['agents'].get(a, {})
        act  = (info.get('action') or 'N/A').upper()
        conf = info.get('conf', 0)
        at   = info.get('at', '–')
        ac   = '#00e676' if act in ('BUY','ADD','BUY_GRID') else \
               '#ff6b6b' if act in ('SELL','CLOSE') else '#555'
        bar_w = int(conf * 100)
        label = {'momentum':'Momentum','meanreversion':'Mean Rev',
                 'grid':'Grid','sentiment':'Sentiment'}.get(a, a)
        agent_cards += f"""<div class="acard">
          <div class="aname">{label}</div>
          <div class="aact" style="color:{ac}">{act}</div>
          <div class="abar"><div class="abar-fill" style="width:{bar_w}%"></div></div>
          <div class="aconf">{conf:.0%} &nbsp;<span class="atime">{at}</span></div>
        </div>"""

    # ── 7-day calendar ────────────────────────────────────────────────────────
    cal_cells = ''
    for day in d['calendar']:
        pnl = day['pnl']
        tc  = day['trades']
        if pnl is None:
            bg, pnl_str_d, sub = '#13161f', '–', f"{tc} trades"
        elif pnl >= 0:
            intensity = min(int(pnl / 10), 9)
            bg = f"#{0x10 + intensity*5:02x}{0x28 + intensity*8:02x}{0x18 + intensity*4:02x}"
            pnl_str_d = f"+${pnl:,.0f}"
            sub = f"{day['wins']}/{tc} wins"
        else:
            intensity = min(int(abs(pnl) / 10), 9)
            bg = f"#{0x28 + intensity*8:02x}{0x10 + intensity*3:02x}{0x10 + intensity*3:02x}"
            pnl_str_d = f"-${abs(pnl):,.0f}"
            sub = f"{day['wins']}/{tc} wins"
        border = '1px solid #4a90d9' if day['today'] else '1px solid #1e2535'
        cal_cells += f"""<div class="cal-cell" style="background:{bg};border:{border}">
          <div class="cal-date">{day['date']}</div>
          <div class="cal-pnl" style="color:{'#00e676' if (pnl or 0) >= 0 else '#ff5252'}">{pnl_str_d}</div>
          <div class="cal-sub">{sub}</div>
        </div>"""

    # ── open positions ────────────────────────────────────────────────────────
    ot_rows = ''
    for t in d['open_trades']:
        pc  = '#00e676' if (t['upnl'] or 0) >= 0 else '#ff5252'
        pnl = (f"${t['upnl']:+,.2f} ({t['upnl_pct']:+.2f}%)"
               if t['upnl'] is not None else 'N/A')
        dsl = f"<span class='dim'>{t['dist_sl']:.2f}% away</span>" if t['dist_sl'] is not None else ''
        dtp = f"<span class='dim'>{t['dist_tp']:.2f}% away</span>" if t['dist_tp'] is not None else ''
        sc  = '#00e676' if t['side'] == 'BUY' else '#ff6b6b'
        ot_rows += (f"<tr><td><b>#{t['id']}</b></td><td>{t['strategy']}</td>"
                    f"<td style='color:{sc};font-weight:700'>{t['side']}</td>"
                    f"<td>${t['entry']:,.2f}</td><td>{t['size']:.4f}</td>"
                    f"<td>${t['sl']:,.2f} {dsl}</td><td>${t['tp']:,.2f} {dtp}</td>"
                    f"<td style='color:{pc};font-weight:700'>{pnl}</td>"
                    f"<td class='dim'>{t['dur']}</td></tr>")
    if not ot_rows:
        ot_rows = "<tr><td colspan='9' class='empty'>No open positions</td></tr>"

    # ── closed trades ─────────────────────────────────────────────────────────
    ct_rows = ''
    for t in d['closed']:
        pc = '#00e676' if (t['pnl'] or 0) >= 0 else '#ff5252'
        ps = f"${t['pnl']:+,.2f}" if t['pnl'] is not None else 'N/A'
        pp = f"({t['pnl_pct']:+.2f}%)" if t['pnl_pct'] is not None else ''
        sc = '#00e676' if t['side'] == 'BUY' else '#ff6b6b'
        ct_rows += (f"<tr><td class='dim'>{t['time']}</td>"
                    f"<td>{t['strategy']}</td>"
                    f"<td style='color:{sc}'>{t['side']}</td>"
                    f"<td>${t['entry']:,.2f}</td><td>${t['exit']:,.2f}</td>"
                    f"<td style='color:{pc};font-weight:700'>{ps} "
                    f"<span style='font-size:11px;color:{pc}'>{pp}</span></td>"
                    f"<td class='dim'>{t['dur']}</td></tr>")
    if not ct_rows:
        ct_rows = "<tr><td colspan='7' class='empty'>No closed trades</td></tr>"

    # ── signals ───────────────────────────────────────────────────────────────
    sig_rows = ''
    for s in d['signals']:
        a   = (s['action'] or '').upper()
        ac  = '#00e676' if a in ('BUY','ADD','BUY_GRID') else \
              '#ff6b6b' if a in ('SELL','CLOSE') else '#555'
        ec  = '#00e676' if s['executed'] else '#333'
        mth = ('<span class="tag-llm">LLM</span>' if s['llm_used']
               else '<span class="tag-det">det</span>')
        rej = (f'<span class="tag-rej">{s["rejection"]}</span>'
               if s['rejection'] else '')
        sig_rows += (f"<tr><td class='dim'>{s['time']}</td>"
                     f"<td>{s['strategy']}</td>"
                     f"<td style='color:{ac};font-weight:700'>{s['action']}</td>"
                     f"<td>{s['conf']:.0%}</td><td>{mth}</td>"
                     f"<td style='color:{ec};font-weight:700'>{'✓' if s['executed'] else '–'}</td>"
                     f"<td>{rej}</td></tr>")
    if not sig_rows:
        sig_rows = "<tr><td colspan='7' class='empty'>No signals</td></tr>"

    log_html = d['log'].replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="15">
<title>Hedge Fund</title>
<style>
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#090b10;color:#b0bccf;font-family:'Segoe UI',system-ui,sans-serif;font-size:13px}}
header{{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 20px;
        background:#0c0f18;border-bottom:1px solid #192030;position:sticky;top:0;z-index:9}}
h1{{font-size:16px;font-weight:700;color:#dce4f0}}
.pill{{display:flex;align-items:center;gap:6px;border:1px solid #192030;border-radius:999px;padding:3px 11px;font-size:11px}}
.pill .lbl{{color:#3a4a60;font-size:10px;text-transform:uppercase;letter-spacing:.05em}}
.pill .val{{color:#c0cce0;font-weight:600}}
.dot{{width:7px;height:7px;border-radius:50%;background:{run_col};box-shadow:0 0 5px {run_col}}}
.ml{{margin-left:auto}}
main{{padding:14px 20px;display:grid;gap:14px;max-width:1800px}}
.g2{{display:grid;grid-template-columns:1fr 1fr;gap:14px}}
.g3{{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}}
@media(max-width:1100px){{.g3{{grid-template-columns:1fr 1fr}}}}
@media(max-width:700px){{.g2,.g3{{grid-template-columns:1fr}}}}
.card{{background:#0e111a;border:1px solid #192030;border-radius:10px;overflow:hidden}}
.ch{{padding:9px 14px;background:#0c0f18;border-bottom:1px solid #192030;font-size:10px;
     font-weight:700;color:#4a5870;text-transform:uppercase;letter-spacing:.08em;
     display:flex;align-items:center;gap:8px}}
.badge{{display:inline-block;padding:1px 7px;font-size:10px;font-weight:700;
        border-radius:4px;background:#14192a;border:1px solid #243050;color:#4a90d9}}
/* agent cards */
.agents{{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#192030}}
@media(max-width:700px){{.agents{{grid-template-columns:1fr 1fr}}}}
.acard{{background:#0e111a;padding:12px 14px}}
.aname{{font-size:10px;color:#4a5870;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}}
.aact{{font-size:18px;font-weight:700;margin-bottom:6px}}
.abar{{height:4px;background:#131820;border-radius:2px;margin-bottom:5px}}
.abar-fill{{height:100%;background:#2a4a7a;border-radius:2px;transition:width .3s}}
.aconf{{font-size:11px;color:#5a6880}}
.atime{{color:#334455}}
/* calendar */
.cal{{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;padding:12px 14px}}
.cal-cell{{border-radius:7px;padding:8px 10px;min-height:70px}}
.cal-date{{font-size:10px;color:#5a6880;margin-bottom:4px;font-weight:600;text-transform:uppercase}}
.cal-pnl{{font-size:15px;font-weight:700;margin-bottom:2px}}
.cal-sub{{font-size:10px;color:#3a4a58}}
/* stats bar */
.stats{{display:flex;flex-wrap:wrap}}
.stat{{padding:12px 18px;border-right:1px solid #192030}}
.stat:last-child{{border-right:none}}
.sl{{color:#4a5870;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}}
.sv{{font-size:19px;font-weight:700;color:#d0dced}}
/* table */
.tw{{overflow-x:auto}}
table{{width:100%;border-collapse:collapse}}
th{{padding:7px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;
    letter-spacing:.06em;color:#4a5870;border-bottom:1px solid #192030;white-space:nowrap}}
td{{padding:6px 12px;border-bottom:1px solid #10141e;vertical-align:middle;white-space:nowrap}}
tr:last-child td{{border-bottom:none}}
tr:hover td{{background:rgba(255,255,255,.015)}}
.empty{{text-align:center;color:#2a3444;padding:18px!important}}
.dim{{color:#444}}
/* tags */
.tag-llm{{display:inline-block;padding:1px 5px;border-radius:3px;font-size:10px;
          font-weight:700;background:#0d2035;color:#4fc3f7;border:1px solid #1a3a55}}
.tag-det{{display:inline-block;padding:1px 5px;border-radius:3px;font-size:10px;
          color:#3a4a5a;background:#111520;border:1px solid #1a2030}}
.tag-rej{{display:inline-block;padding:1px 5px;border-radius:3px;font-size:10px;
          color:#ff7043;background:#1a0e0a;border:1px solid #3a1a10}}
/* log */
.log{{padding:10px 14px;background:#060810;font-family:'Cascadia Code','Fira Code',monospace;
      font-size:11px;color:#2a5a30;max-height:260px;overflow-y:auto;
      white-space:pre-wrap;word-break:break-all;line-height:1.65}}
</style>
</head>
<body>
<header>
  <h1>🤖 Hedge Fund</h1>
  <div class="pill"><span class="lbl">BTC</span><span class="val">{price_str}</span></div>
  <div class="pill"><div class="dot"></div><span class="val">{run_lbl}</span></div>
  <div class="pill"><span class="lbl">Cycle</span><span class="val">15 min</span></div>
  <div class="pill"><span class="lbl">Min conf</span><span class="val">50%</span></div>
  <div class="pill"><span class="lbl">LLM 1h</span><span class="val">{llm_str}</span></div>
  <div class="pill ml"><span class="lbl">↻</span><span class="val">{d['now']}</span></div>
</header>
<main>

<!-- Agent Status -->
<div class="card">
  <div class="ch">🤖 Agent Status</div>
  <div class="agents">{agent_cards}</div>
</div>

<!-- 7-day Calendar -->
<div class="card">
  <div class="ch">📅 7-Day PnL Calendar</div>
  <div class="cal">{cal_cells}</div>
</div>

<!-- Open Positions -->
<div class="card">
  <div class="ch">📂 Open Positions <span class="badge">{len(d['open_trades'])}</span></div>
  <div class="tw"><table>
    <thead><tr><th>ID</th><th>Strategy</th><th>Side</th><th>Entry</th><th>Size</th>
               <th>Stop Loss</th><th>Take Profit</th><th>Unrealized PnL</th><th>Duration</th></tr></thead>
    <tbody>{ot_rows}</tbody>
  </table></div>
</div>

<!-- Performance + Log -->
<div class="g2">
  <div class="card">
    <div class="ch">🏆 Performance</div>
    <div class="stats">
      <div class="stat"><div class="sl">Total PnL</div>
        <div class="sv" style="color:{pnl_col}">{pnl_str}</div></div>
      <div class="stat"><div class="sl">Win Rate</div>
        <div class="sv">{wr_str}</div></div>
      <div class="stat"><div class="sl">Trades</div>
        <div class="sv">{d['trade_count']}</div></div>
      <div class="stat"><div class="sl">Avg Duration</div>
        <div class="sv">{dur_str}</div></div>
    </div>
    <div class="tw"><table>
      <thead><tr><th>Closed</th><th>Strategy</th><th>Side</th>
                 <th>Entry</th><th>Exit</th><th>PnL</th><th>Duration</th></tr></thead>
      <tbody>{ct_rows}</tbody>
    </table></div>
  </div>

  <div class="card">
    <div class="ch">📋 Live Log</div>
    <div class="log" id="log">{log_html}</div>
  </div>
</div>

<!-- Signals -->
<div class="card">
  <div class="ch">📡 Signals <span class="badge">{len(d['signals'])}</span>
    <span style="margin-left:auto;font-size:10px;color:#2a3848;font-weight:400;text-transform:none;letter-spacing:0">
      <span style="color:#4fc3f7">LLM</span> boosted &nbsp;·&nbsp;
      <span style="color:#3a4a5a">det</span> deterministic &nbsp;·&nbsp; ✓ executed
    </span>
  </div>
  <div class="tw"><table>
    <thead><tr><th>Time</th><th>Agent</th><th>Action</th><th>Conf</th>
               <th>Method</th><th>Exec</th><th>Rejection</th></tr></thead>
    <tbody>{sig_rows}</tbody>
  </table></div>
</div>

</main>
<script>
  // Auto-scroll log to bottom
  var log = document.getElementById('log');
  if (log) log.scrollTop = log.scrollHeight;
</script>
</body>
</html>"""

@app.route('/')
def index():
    return render(fetch_data())

@app.route('/api/data')
def api():
    return jsonify(fetch_data())

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
