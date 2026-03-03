/**
 * Hedge Fund Dashboard - JavaScript Data Layer
 * Fetches data from VDS API and updates the dashboard
 */

// CONFIG: VDS API endpoint
const API_BASE = 'http://[2a02:c207:2311:1618::1]:5000/api';

// Cache for data
let lastData = null;

/**
 * Format currency
 */
function formatCurrency(value) {
  if (value === null || value === undefined) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return `${sign}$${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

/**
 * Format number as percentage
 */
function formatPercent(value) {
  if (value === null || value === undefined) return 'N/A';
  return `${(value * 100).toFixed(0)}%`;
}

/**
 * Update header info
 */
function updateHeader(data) {
  // Price
  const priceEl = document.getElementById('price');
  if (data.price) {
    priceEl.textContent = `$${data.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  } else {
    priceEl.textContent = 'N/A';
  }

  // Status dot
  const dotEl = document.getElementById('status-dot');
  const statusEl = document.getElementById('status');
  if (data.running) {
    dotEl.className = 'dot running';
    statusEl.textContent = `Running (PID ${data.pid})`;
  } else {
    dotEl.className = 'dot stopped';
    statusEl.textContent = 'Stopped';
  }

  // LLM avg
  const llmEl = document.getElementById('llm-avg');
  llmEl.textContent = data.llm_avg ? `${data.llm_avg}s` : 'timeout';

  // Time
  document.getElementById('time').textContent = data.now || '--:--:--';
}

/**
 * Update agent cards
 */
function updateAgents(data) {
  const container = document.getElementById('agent-cards');
  if (!data.agents) {
    container.innerHTML = '<div class="empty">No agent data</div>';
    return;
  }

  const agentOrder = ['momentum', 'meanreversion', 'grid', 'sentiment'];
  const labels = {
    momentum: 'Momentum',
    meanreversion: 'Mean Rev',
    grid: 'Grid',
    sentiment: 'Sentiment'
  };

  container.innerHTML = agentOrder.map(a => {
    const info = data.agents[a] || {};
    const act = (info.action || 'N/A').toUpperCase();
    const conf = info.conf || 0;
    const at = info.at || '–';
    
    let actClass = 'hold';
    if (['BUY', 'ADD', 'BUY_GRID'].includes(act)) actClass = 'buy';
    else if (['SELL', 'CLOSE'].includes(act)) actClass = 'sell';
    
    const barW = Math.round(conf * 100);
    
    return `
      <div class="acard">
        <div class="aname">${labels[a] || a}</div>
        <div class="aact ${actClass}">${act}</div>
        <div class="abar"><div class="abar-fill" style="width:${barW}%"></div></div>
        <div class="aconf">${(conf * 100).toFixed(0)}% &nbsp;<span class="atime">${at}</span></div>
      </div>
    `;
  }).join('');
}

/**
 * Update calendar
 */
function updateCalendar(data) {
  const container = document.getElementById('calendar');
  if (!data.calendar || data.calendar.length === 0) {
    container.innerHTML = '<div class="empty">No calendar data</div>';
    return;
  }

  container.innerHTML = data.calendar.map(day => {
    const pnl = day.pnl;
    const tc = day.trades;
    
    let bg, pnlStr, sub, pnlClass;
    
    if (pnl === null) {
      bg = '#13161f';
      pnlStr = '–';
      sub = `${tc} trades`;
      pnlClass = '';
    } else if (pnl >= 0) {
      const intensity = Math.min(Math.floor(pnl / 10), 9);
      const r = (0x10 + intensity * 5).toString(16).padStart(2, '0');
      const g = (0x28 + intensity * 8).toString(16).padStart(2, '0');
      const b = (0x18 + intensity * 4).toString(16).padStart(2, '0');
      bg = `#${r}${g}${b}`;
      pnlStr = `+$${pnl.toLocaleString('en-US', {maximumFractionDigits: 0})}`;
      sub = `${day.wins}/${tc} wins`;
      pnlClass = 'positive';
    } else {
      const intensity = Math.min(Math.floor(Math.abs(pnl) / 10), 9);
      const r = (0x28 + intensity * 8).toString(16).padStart(2, '0');
      const g = (0x10 + intensity * 3).toString(16).padStart(2, '0');
      const b = (0x10 + intensity * 3).toString(16).padStart(2, '0');
      bg = `#${r}${g}${b}`;
      pnlStr = `-$${Math.abs(pnl).toLocaleString('en-US', {maximumFractionDigits: 0})}`;
      sub = `${day.wins}/${tc} wins`;
      pnlClass = 'negative';
    }
    
    const border = day.today ? '1px solid #4a90d9' : '1px solid #1e2535';
    const todayClass = day.today ? 'today' : '';
    
    return `
      <div class="cal-cell ${todayClass}" style="background:${bg};border:${border}">
        <div class="cal-date">${day.date}</div>
        <div class="cal-pnl ${pnlClass}">${pnlStr}</div>
        <div class="cal-sub">${sub}</div>
      </div>
    `;
  }).join('');
}

/**
 * Update open positions
 */
function updateOpenTrades(data) {
  const tbody = document.getElementById('open-trades');
  const countEl = document.getElementById('open-count');
  
  if (!data.open_trades || data.open_trades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty">No open positions</td></tr>';
    countEl.textContent = '0';
    return;
  }
  
  countEl.textContent = data.open_trades.length;
  
  tbody.innerHTML = data.open_trades.map(t => {
    const pnlClass = (t.upnl || 0) >= 0 ? 'pnl-positive' : 'pnl-negative';
    const pnl = t.upnl !== null 
      ? `$${t.upnl >= 0 ? '+' : ''}${t.upnl.toFixed(2)} (${t.upnl_pct >= 0 ? '+' : ''}${t.upnl_pct.toFixed(2)}%)`
      : 'N/A';
    const dsl = t.dist_sl !== null ? `<span class='dim'>${t.dist_sl.toFixed(2)}% away</span>` : '';
    const dtp = t.dist_tp !== null ? `<span class='dim'>${t.dist_tp.toFixed(2)}% away</span>` : '';
    const sideClass = t.side === 'BUY' ? 'side-buy' : 'side-sell';
    
    return `
      <tr>
        <td><b>#${t.id}</b></td>
        <td>${t.strategy}</td>
        <td class="${sideClass}">${t.side}</td>
        <td>$${t.entry.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
        <td>${t.size.toFixed(4)}</td>
        <td>$${t.sl.toLocaleString('en-US', {minimumFractionDigits: 2})} ${dsl}</td>
        <td>$${t.tp.toLocaleString('en-US', {minimumFractionDigits: 2})} ${dtp}</td>
        <td class="${pnlClass}">${pnl}</td>
        <td class="dim">${t.dur}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Update performance stats
 */
function updatePerformance(data) {
  const pnlEl = document.getElementById('total-pnl');
  const wrEl = document.getElementById('win-rate');
  const countEl = document.getElementById('trade-count');
  const durEl = document.getElementById('avg-dur');
  
  pnlEl.textContent = data.total_pnl !== null ? formatCurrency(data.total_pnl) : '$0.00';
  pnlEl.className = 'sv ' + ((data.total_pnl || 0) >= 0 ? 'positive' : 'negative');
  
  wrEl.textContent = data.win_rate !== null ? `${data.win_rate.toFixed(1)}%` : 'N/A';
  countEl.textContent = data.trade_count || 0;
  durEl.textContent = data.avg_dur ? `${data.avg_dur}m` : 'N/A';
}

/**
 * Update closed trades
 */
function updateClosedTrades(data) {
  const tbody = document.getElementById('closed-trades');
  
  if (!data.closed || data.closed.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No closed trades</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.closed.map(t => {
    const pnlClass = (t.pnl || 0) >= 0 ? 'pnl-positive' : 'pnl-negative';
    const ps = t.pnl !== null ? formatCurrency(t.pnl) : 'N/A';
    const pp = t.pnl_pct !== null ? `(${t.pnl_pct >= 0 ? '+' : ''}${t.pnl_pct.toFixed(2)}%)` : '';
    const sideClass = t.side === 'BUY' ? 'side-buy' : 'side-sell';
    
    return `
      <tr>
        <td class="dim">${t.time}</td>
        <td>${t.strategy}</td>
        <td class="${sideClass}">${t.side}</td>
        <td>$${t.entry.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
        <td>$${t.exit.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
        <td class="${pnlClass}">${ps} <span style="font-size:11px">${pp}</span></td>
        <td class="dim">${t.dur}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Update log
 */
function updateLog(data) {
  const logEl = document.getElementById('log');
  if (data.log) {
    // Escape HTML
    const escaped = data.log
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    logEl.innerHTML = escaped;
    // Auto-scroll to bottom
    logEl.scrollTop = logEl.scrollHeight;
  } else {
    logEl.textContent = 'No log available';
  }
}

/**
 * Update signals
 */
function updateSignals(data) {
  const tbody = document.getElementById('signals');
  const countEl = document.getElementById('signal-count');
  
  if (!data.signals || data.signals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No signals</td></tr>';
    countEl.textContent = '0';
    return;
  }
  
  countEl.textContent = data.signals.length;
  
  tbody.innerHTML = data.signals.map(s => {
    const act = (s.action || '').toUpperCase();
    let actClass = '';
    if (['BUY', 'ADD', 'BUY_GRID'].includes(act)) actClass = 'style="color:#00e676;font-weight:700"';
    else if (['SELL', 'CLOSE'].includes(act)) actClass = 'style="color:#ff6b6b;font-weight:700"';
    else actClass = 'style="color:#555;font-weight:700"';
    
    const execColor = s.executed ? '#00e676' : '#333';
    const mth = s.llm_used ? '<span class="tag-llm">LLM</span>' : '<span class="tag-det">det</span>';
    const rej = s.rejection ? `<span class="tag-rej">${s.rejection}</span>` : '';
    
    return `
      <tr>
        <td class="dim">${s.time}</td>
        <td>${s.strategy}</td>
        <td ${actClass}>${s.action}</td>
        <td>${(s.conf * 100).toFixed(0)}%</td>
        <td>${mth}</td>
        <td style="color:${execColor};font-weight:700">${s.executed ? '✓' : '–'}</td>
        <td>${rej}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Main load function
 */
async function loadDashboard() {
  const errorBanner = document.getElementById('error-banner');
  
  try {
    const response = await fetch(`${API_BASE}/data`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    lastData = data;
    
    // Update all sections
    updateHeader(data);
    updateAgents(data);
    updateCalendar(data);
    updateOpenTrades(data);
    updatePerformance(data);
    updateClosedTrades(data);
    updateLog(data);
    updateSignals(data);
    
    // Hide error banner
    errorBanner.style.display = 'none';
    
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    errorBanner.style.display = 'block';
    errorBanner.textContent = `⚠️ Connection error: ${error.message}. Retrying...`;
  }
}

/**
 * Initialize dashboard
 */
function init() {
  // Initial load
  loadDashboard();
  
  // Refresh every 15 seconds
  setInterval(loadDashboard, 15000);
  
  console.log('Dashboard initialized. API:', API_BASE);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
