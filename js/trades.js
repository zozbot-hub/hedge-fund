// Trades List Page

let allTrades = [];
let allBots = [];

async function loadTrades() {
    const data = await fetchAPI('/trades');
    if (!data) {
        document.getElementById('trades-container').innerHTML = 
            '<div class="error">Failed to load trades. Check API connection.</div>';
        return;
    }

    allTrades = data.trades || [];
    allBots = data.all_bots || [];
    
    // Populate bot filter
    const botFilter = document.getElementById('bot-filter');
    botFilter.innerHTML = '<option value="all">All Bots</option>' + 
        allBots.map(b => `<option value="${b.bot_id}">${b.name}</option>`).join('');
    
    // Add event listeners
    document.getElementById('status-filter').addEventListener('change', filterTrades);
    botFilter.addEventListener('change', filterTrades);
    
    filterTrades();
}

function filterTrades() {
    const statusFilter = document.getElementById('status-filter').value;
    const botFilter = document.getElementById('bot-filter').value;
    
    let filtered = allTrades;
    
    if (statusFilter !== 'all') {
        filtered = filtered.filter(t => t.status === statusFilter);
    }
    
    if (botFilter !== 'all') {
        filtered = filtered.filter(t => t.bot_id === botFilter);
    }
    
    renderTrades(filtered);
}

function renderTrades(trades) {
    const container = document.getElementById('trades-container');
    
    if (trades.length === 0) {
        container.innerHTML = '<div class="empty-state">No trades found</div>';
        return;
    }

    container.innerHTML = `
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Bot</th>
                        <th>Symbol</th>
                        <th>Side</th>
                        <th>Entry Price</th>
                        <th>Exit Price</th>
                        <th>Size</th>
                        <th>PnL</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${trades.map(t => {
                        const pnl = t.pnl ? parseFloat(t.pnl) : null;
                        const entryPrice = parseFloat(t.entry_price);
                        const exitPrice = t.exit_price ? parseFloat(t.exit_price) : null;
                        const size = parseFloat(t.size);
                        return `
                        <tr class="${pnl > 0 ? 'row-win' : pnl < 0 ? 'row-loss' : ''}">
                            <td class="timestamp">${formatTime(t.entry_time)}</td>
                            <td><a href="bot.html?id=${t.bot_id}">${t.bot_name}</a></td>
                            <td>${t.symbol}</td>
                            <td class="side-${t.side}">${t.side?.toUpperCase()}</td>
                            <td>$${!isNaN(entryPrice) ? entryPrice.toFixed(2) : '-'}</td>
                            <td>${exitPrice ? '$' + exitPrice.toFixed(2) : '-'}</td>
                            <td>${!isNaN(size) ? size.toFixed(4) : '-'}</td>
                            <td class="${pnl >= 0 ? 'positive' : 'negative'}">
                                ${pnl ? formatCurrency(pnl) : '-'}
                            </td>
                            <td><span class="badge badge-${t.status}">${t.status}</span></td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <p class="table-footer">Showing ${trades.length} trades</p>
    `;
}

window.addEventListener('DOMContentLoaded', loadTrades);
