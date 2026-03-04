// Bots List Page

async function loadBots() {
    const data = await fetchAPI('/bots');
    if (!data) {
        document.getElementById('bots-grid').innerHTML = 
            '<div class="error">Failed to load bots. Check API connection.</div>';
        return;
    }

    document.getElementById('bot-count').textContent = `${data.bots?.length || 0} bots`;
    renderBotsGrid(data.bots);
}

function renderBotsGrid(bots) {
    const container = document.getElementById('bots-grid');
    if (!bots || bots.length === 0) {
        container.innerHTML = '<div class="empty-state">No bots configured yet</div>';
        return;
    }

    container.innerHTML = bots.map(bot => {
        const winRate = parseFloat(bot.win_rate) || 0;
        const totalPnl = parseFloat(bot.total_pnl) || 0;
        return `
        <a href="bot.html?id=${bot.bot_id}" class="bot-card">
            <div class="bot-card-header">
                <h3>${bot.name}</h3>
                <span class="status-dot ${bot.status}"></span>
            </div>
            
            <div class="bot-card-strategy">
                🔧 ${bot.strategy} | ⏱️ ${bot.timeframe}
            </div>
            
            <div class="bot-card-stats">
                <div class="stat">
                    <span class="stat-value-small">${bot.total_trades || 0}</span>
                    <span class="stat-label-small">Trades</span>
                </div>
                <div class="stat">
                    <span class="stat-value-small ${winRate >= 50 ? 'positive' : winRate > 0 ? 'negative' : ''}">
                        ${winRate.toFixed(1)}%
                    </span>
                    <span class="stat-label-small">Win Rate</span>
                </div>
                <div class="stat">
                    <span class="stat-value-small ${totalPnl >= 0 ? 'positive' : 'negative'}">
                        $${Math.round(totalPnl)}
                    </span>
                    <span class="stat-label-small">PnL</span>
                </div>
            </div>
            
            <div class="bot-card-footer">
                <span class="badge badge-${bot.status}">${bot.status}</span>
                ${bot.open_trades > 0 ? `<span class="badge badge-open">${bot.open_trades} open</span>` : ''}
            </div>
        </a>
        `;
    }).join('');
}

window.addEventListener('DOMContentLoaded', loadBots);
setInterval(loadBots, 30000);
