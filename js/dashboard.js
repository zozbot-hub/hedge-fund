// Dashboard Overview Page

async function loadDashboard() {
    const data = await fetchAPI('/dashboard');
    if (!data) {
        document.getElementById('bots-summary').innerHTML = 
            '<div class="error">Failed to load data. Check API connection.</div>';
        return;
    }

    // Update stats
    document.getElementById('total-bots').textContent = data.total_bots || 0;
    document.getElementById('active-bots').textContent = `${data.total_bots_active || 0} active`;
    document.getElementById('total-trades').textContent = data.total_trades || 0;
    document.getElementById('open-trades').textContent = data.open_trades_count || 0;
    document.getElementById('closed-trades').textContent = data.closed_trades_count || 0;
    
    const pnlEl = document.getElementById('total-pnl');
    pnlEl.textContent = formatCurrency(data.total_pnl || 0);
    pnlEl.className = `stat-value ${(data.total_pnl || 0) >= 0 ? 'positive' : 'negative'}`;

    // Bot summary
    renderBotsSummary(data.bots_summary);
    
    // Recent signals
    renderSignals(data.recent_signals);
    
    // Recent trades
    renderTrades(data.recent_trades);
}

function renderBotsSummary(bots) {
    const container = document.getElementById('bots-summary');
    if (!bots || bots.length === 0) {
        container.innerHTML = '<div class="empty-state">No bots configured</div>';
        return;
    }

    container.innerHTML = `
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Bot</th>
                        <th>Strategy</th>
                        <th>Status</th>
                        <th>Open Trades</th>
                        <th>PnL</th>
                    </tr>
                </thead>
                <tbody>
                    ${bots.map(bot => `
                        <tr>
                            <td><a href="bot.html?id=${bot.bot_id}">${bot.name}</a></td>
                            <td>${bot.strategy} (${bot.timeframe})</td>
                            <td><span class="badge badge-${bot.status}">${bot.status}</span></td>
                            <td>${bot.open_trades || 0}</td>
                            <td class="${(bot.pnl || 0) >= 0 ? 'positive' : 'negative'}">${formatCurrency(bot.pnl || 0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderSignals(signals) {
    const container = document.getElementById('recent-signals');
    if (!signals || signals.length === 0) {
        container.innerHTML = '<div class="empty-state">No recent signals</div>';
        return;
    }

    container.innerHTML = `
        <div class="table-wrapper">
            <table class="data-table compact">
                <thead>
                    <tr><th>Time</th><th>Bot</th><th>Action</th><th>Price</th></tr>
                </thead>
                <tbody>
                    ${signals.slice(0, 10).map(s => `
                        <tr>
                            <td class="timestamp">${formatTime(s.timestamp)}</td>
                            <td>${s.bot_name}</td>
                            <td class="side-${s.action}">${s.action.toUpperCase()}</td>
                            <td>$${s.price?.toFixed(4) || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderTrades(trades) {
    const container = document.getElementById('recent-trades');
    if (!trades || trades.length === 0) {
        container.innerHTML = '<div class="empty-state">No recent trades</div>';
        return;
    }

    container.innerHTML = `
        <div class="table-wrapper">
            <table class="data-table compact">
                <thead>
                    <tr><th>Time</th><th>Bot</th><th>Side</th><th>PnL</th></tr>
                </thead>
                <tbody>
                    ${trades.slice(0, 10).map(t => `
                        <tr class="${t.pnl > 0 ? 'row-win' : t.pnl < 0 ? 'row-loss' : ''}">
                            <td class="timestamp">${formatTime(t.entry_time)}</td>
                            <td>${t.bot_name}</td>
                            <td class="side-${t.side}">${t.side.toUpperCase()}</td>
                            <td class="${(t.pnl || 0) >= 0 ? 'positive' : 'negative'}">${t.pnl ? formatCurrency(t.pnl) : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Load on page load
window.addEventListener('DOMContentLoaded', loadDashboard);
// Refresh every 30 seconds
setInterval(loadDashboard, 30000);
