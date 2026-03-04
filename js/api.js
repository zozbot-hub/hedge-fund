// API Configuration - HTTPS enabled
const API_BASE = 'https://217.76.56.212:5000/api';

// Track if we've shown the certificate warning
let certWarningShown = false;

// Fetch with error handling
async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            mode: 'cors',
            credentials: 'omit'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        
        // Show certificate warning if it's a connection error
        if ((error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) && !certWarningShown) {
            certWarningShown = true;
            showCertWarning();
        }
        
        return null;
    }
}

// Show certificate warning with link
function showCertWarning() {
    const banner = document.getElementById('error-banner') || document.createElement('div');
    banner.id = 'error-banner';
    banner.className = 'error-banner';
    banner.innerHTML = `
        <strong>⚠️ Connection Error</strong><br>
        Please accept the self-signed certificate first:<br>
        <a href="${API_BASE}/dashboard" target="_blank" style="color: #4fc3f7;">
            Click here to accept certificate
        </a><br>
        Then refresh this page.
    `;
    banner.style.display = 'block';
    document.body.appendChild(banner);
}

// Format currency
function formatCurrency(value) {
    if (value === null || value === undefined) return '$0.00';
    const sign = value >= 0 ? '+' : '';
    return `${sign}$${value.toFixed(2)}`;
}

// Format percentage
function formatPercent(value) {
    if (value === null || value === undefined) return '0%';
    return `${value.toFixed(1)}%`;
}

// Format timestamp
function formatTime(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString();
}
