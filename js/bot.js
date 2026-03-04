// Bot Detail Page

// Get bot ID from URL
function getBotId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

async function loadBotDetails() {
    const botId = getBotId();
    if (!botId) {
        document.getElementById('bot-name').textContent = 'Bot Not Found';
        return;
    }

    // Load all data in parallel
    const [botsData, tradesData] = await Promise.all([
        fetchAPI('/bots'),
        fetchAPI('/trades')
    ]);

    if (!botsData || !tradesData) {
        document.getElementById('bot-name').textContent = 'Error Loading Bot';
        return;
    }

    // Find this bot
    const bot = botsData.bots?.find(b => b.bot_id === botId);
    if (!bot) {
        document.getElementById('bot-name').textContent = 'Bot Not Found';
        return;
    }

    // Get bot's trades
    const botTrades = tradesData.trades?.filter(t => t.bot_id === botId) || [];
    const openTrades = botTrades.filter(t => t.status === 'open');
    const closedTrades = botTrades.filter(t => t.status === 'closed');

    // Update header
    document.getElementById('bot-name').textContent = bot.name;
    document.getElementById('bot-meta').innerHTML = `
        🔧 ${bot.strategy || 'Unknown'} | 
        ⏱️ ${bot.timeframe || '1h'} | 
        💰 ${bot.symbol || 'BTC/USDT'}
    `;
    document.getElementById('bot-status').textContent = bot.status;
    document.getElementById('bot-status').className = `status-badge badge-${bot.status}`;

    // Calculate stats
    const totalPnl = parseFloat(bot.total_pnl) || 0;
    const winRate = parseFloat(bot.win_rate) || 0;
    
    // Calculate average profit and loss
    let avgProfit = 0;
    let avgLoss = 0;
    let profitCount = 0;
    let lossCount = 0;
    
    closedTrades.forEach(t => {
        const pnl = parseFloat(t.pnl) || 0;
        if (pnl > 0) {
            avgProfit += pnl;
            profitCount++;
        } else if (pnl < 0) {
            avgLoss += pnl;
            lossCount++;
        }
    });
    
    avgProfit = profitCount > 0 ? avgProfit / profitCount : 0;
    avgLoss = lossCount > 0 ? avgLoss / lossCount : 0;

    // Update stats
    document.getElementById('stat-total-trades').textContent = bot.total_trades || 0;
    document.getElementById('stat-open-trades').textContent = bot.open_trades || 0;
    document.getElementById('stat-win-rate').textContent = `${winRate.toFixed(1)}%`;
    
    const pnlEl = document.getElementById('stat-pnl');
    pnlEl.textContent = formatCurrency(totalPnl);
    pnlEl.className = `stat-value ${totalPnl >= 0 ? 'positive' : 'negative'}`;
    
    const avgProfitEl = document.getElementById('stat-avg-profit');
    avgProfitEl.textContent = formatCurrency(avgProfit);
    avgProfitEl.className = `stat-value positive`;
    
    const avgLossEl = document.getElementById('stat-avg-loss');
    avgLossEl.textContent = formatCurrency(avgLoss);
    avgLossEl.className = `stat-value negative`;

    // Render sections
    renderPerformanceChart(closedTrades);
    renderOpenPositions(openTrades);
    renderTradeHistory(closedTrades);
    
    // Load signals separately
    loadBotSignals(botId);
}

function renderPerformanceChart(closedTrades) {
    const container = document.getElementById('performance-chart');
    
    if (closedTrades.length === 0) {
        container.innerHTML = '<div class="empty-state">No closed trades yet</div>';
        return;
    }

    // Sort by exit time
    const sorted = [...closedTrades].sort((a, b) => 
        new Date(a.exit_time) - new Date(b.exit_time)
    );

    // Calculate cumulative PnL
    let cumulative = 0;
    const dataPoints = sorted.map(t => {
        cumulative += parseFloat(t.pnl) || 0;
        return {
            date: formatTime(t.exit_time),
            pnl: cumulative
        };
    });

    // Simple ASCII chart
    const maxVal = Math.max(...dataPoints.map(d => d.pnl), 0);
    const minVal = Math.min(...dataPoints.map(d => d.pnl), 0);
    const range = maxVal - minVal || 1;
    
    const chartHeight = 10;
    const chartLines = [];
    
    for (let i = chartHeight; i >= 0; i--) {
        const threshold = minVal + (range * i / chartHeight);
        let line = '';
        
        for (let j = 0; j < dataPoints.length; j++) {
            const val = dataPoints[j].pnl;
            if (val >= threshold) {
                line += val >= 0 ? '+' : '-';
            } else {
                line += ' ';
            }
        }
        
        const label = threshold >= 0 ? '+' : '';
        chartLines.push(`${label}${threshold.toFixed(0).padStart(4)} | ${line}`);
    }

    container.innerHTML = `
        <div class="ascii-chart">
            <pre>${chartLines.join('\n')}</pre>
            <div class="chart-legend">
                Cumulative PnL over ${dataPoints.length} trades
                <br>Final: ${formatCurrency(dataPoints[dataPoints.length - 1]?.pnl || 0)}
            </div>
        </div>
    `;
}

function renderOpenPositions(openTrades) {
    const container = document.getElementById('open-positions');
    
    if (openTrades.length === 0) {
        container.innerHTML = '<div class="empty-state">No open positions</div>';
        return;
    }

    // Calculate unrealized PnL (approximate using current price if available)
    container.innerHTML = `
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Entry Time</th>
                        <th>Side</th>
                        <th>Entry Price</th>
                        <th>Size</th>
                        <th>Order ID</th>
                    </tr>
                </thead>
                <tbody>
                    ${openTrades.map(t => `
                        <tr>
                            <td class="timestamp">${formatTime(t.entry_time)}</td>
                            <td class="side-${t.side}">${t.side?.toUpperCase()}</td>
                            <td>$${parseFloat(t.entry_price)?.toFixed(2) || '-'}</td>
                            <td>${parseFloat(t.size)?.toFixed(4) || '-'}</td>
                            <td><code>${t.metadata?.order_id || '-'}</code></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <p class="table-footer">${openTrades.length} open position${openTrades.length !== 1 ? 's' : ''}</p>
    `;
}

function renderTradeHistory(closedTrades) {
    const container = document.getElementById('trade-history');
    
    if (closedTrades.length === 0) {
        container.innerHTML = '<div class="empty-state">No trade history</div>';
        return;
    }

    // Sort by exit time (newest first)
    const sorted = [...closedTrades].sort((a, b) => 
        new Date(b.exit_time) - new Date(a.exit_time)
    );

    container.innerHTML = `
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Exit Time</th>
                        <th>Side</th>
                        <th>Entry</th>
                        <th>Exit</th>
                        <th>PnL</th>
                        <th>Reason</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.slice(0, 20).map(t => {
                        const pnl = parseFloat(t.pnl) || 0;
                        return `
                        <tr class="${pnl > 0 ? 'row-win' : pnl < 0 ? 'row-loss' : ''}">
                            <td class="timestamp">${formatTime(t.exit_time)}</td>
                            <td class="side-${t.side}">${t.side?.toUpperCase()}</td>
                            <td>$${parseFloat(t.entry_price)?.toFixed(2) || '-'}</td>
                            <td>$${parseFloat(t.exit_price)?.toFixed(2) || '-'}</td>
                            <td class="${pnl >= 0 ? 'positive' : 'negative'}">${formatCurrency(pnl)}</td>
                            <td><span class="badge badge-${t.close_reason?.includes('PROFIT') ? 'profit' : t.close_reason?.includes('STOP') ? 'stop' : 'info'}">${t.close_reason || '-'}</span></td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        ${sorted.length > 20 ? `<p class="table-footer">Showing 20 of ${sorted.length} trades. <a href="trades.html">View all →</a></p>` : 
          `<p class="table-footer">${sorted.length} trade${sorted.length !== 1 ? 's' : ''}</p>`}
    `;
}

async function loadBotSignals(botId) {
    const container = document.getElementById('recent-signals');
    
    // Get all signals from dashboard endpoint
    const dashboard = await fetchAPI('/dashboard');
    
    if (!dashboard || !dashboard.recent_signals) {
        container.innerHTML = '<div class="empty-state">No signals available</div>';
        return;
    }

    // Filter to this bot
    const botSignals = dashboard.recent_signals
        .filter(s => s.bot_id === botId)
        .slice(0, 10);

    if (botSignals.length === 0) {
        container.innerHTML = '<div class="empty-state">No recent signals</div>';
        return;
    }

    container.innerHTML = `
        <div class="table-wrapper">
            <table class="data-table compact">
                <thead>
                    <tr><th>Time</th><th>Signal</th><th>Price</th><th>Executed</th></tr>
                </thead>
                <tbody>
                    ${botSignals.map(s => `
                        <tr>
                            <td class="timestamp">${formatTime(s.timestamp)}</td>
                            <td class="side-${s.signal_type}">${s.signal_type?.toUpperCase() || '-'}</td>
                            <td>$${parseFloat(s.price)?.toFixed(2) || '-'}</td>
                            <td>${s.executed ? '✅' : '⏳'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Load on page load
window.addEventListener('DOMContentLoaded', loadBotDetails);
// Refresh every 30 seconds
setInterval(loadBotDetails, 30000);
