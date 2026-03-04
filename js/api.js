// API Configuration - HTTPS enabled
const API_BASE = 'https://217.76.56.212:5000/api';

// Note: Using self-signed certificate.
// First visit https://217.76.56.212:5000/api/dashboard directly
// Accept the security warning, then the dashboard will work.

// Fetch with error handling
async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
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
