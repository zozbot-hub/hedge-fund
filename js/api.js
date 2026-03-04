// API Configuration - HTTPS via Cloudflare Tunnel
const API_BASE = "https://asthma-francis-except-gilbert.trycloudflare.com/api";

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
        return null;
    }
}

// Format currency
function formatCurrency(value) {
    if (value === null || value === undefined || value === '') return '$0.00';
    const num = parseFloat(value);
    if (isNaN(num)) return '$0.00';
    const sign = num >= 0 ? '+' : '';
    return `${sign}$${Math.abs(num).toFixed(2)}`;
}

// Format percentage
function formatPercent(value) {
    if (value === null || value === undefined || value === '') return '0%';
    const num = parseFloat(value);
    if (isNaN(num)) return '0%';
    return `${num.toFixed(1)}%`;
}

// Format timestamp
function formatTime(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString();
}
