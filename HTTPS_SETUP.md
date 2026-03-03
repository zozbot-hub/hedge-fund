# Fix Mixed Content Error - HTTPS Required

## Problem
GitHub Pages uses HTTPS, but your VDS API uses HTTP.
Browsers block mixed content for security.

## Solution 1: Cloudflare Tunnel (Recommended - Free)

1. Install cloudflared on your VDS:
```bash
# Download and install
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Authenticate (get token from Cloudflare dashboard)
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create hedge-fund-api

# Configure tunnel
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: YOUR_TUNNEL_ID
-credentials-file: /root/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: hedge-api.zozbot-hub.workers.dev
    service: http://localhost:5000
  - service: http_status:404
EOF

# Run tunnel
cloudflared tunnel run hedge-fund-api
```

2. Update API_BASE in js/api.js:
```javascript
const API_BASE = 'https://hedge-api.zozbot-hub.workers.dev/api';
```

## Solution 2: Nginx Reverse Proxy with Let's Encrypt

```bash
# Install certbot
apt-get install certbot python3-certbot-nginx

# Get certificate
certbot certonly --standalone -d your-domain.com

# Nginx config
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Solution 3: Use CORS Proxy (Quick Test Only)

```javascript
// In js/api.js - TEMPORARY for testing only
const API_BASE = 'https://cors-anywhere.herokuapp.com/http://[2a02:c207:2311:1618::1]:5000/api';
```
⚠️ Not recommended for production - relies on third-party service.

## Solution 4: Local Testing

For local development, disable HTTPS on GitHub Pages temporarily or use:
```bash
cd static-dashboard
python -m http.server 8000
# Open http://localhost:8000 (not https)
```

## Recommended: Go with Cloudflare Tunnel

It's free, gives you a HTTPS URL, and takes 5 minutes to set up.
