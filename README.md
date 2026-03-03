# Static Dashboard for GitHub Pages

A static HTML/CSS/JS dashboard that connects to your VDS API for live trading data.

## Architecture

```
GitHub Pages (Free Hosting)
    ↓ JavaScript fetch()
VDS API (Your Server)
    ↓ Flask App
Trading Data
```

## Setup

### 1. Configure API Endpoint

Edit `js/app.js` and update the API_BASE:

```javascript
const API_BASE = 'http://YOUR_VDS_IP:5000/api';
// or use domain: 'https://api.yourdomain.com/api'
```

### 2. Enable CORS on VDS

SSH to your VDS and update the Flask app:

```bash
pip install flask-cors
```

Add to your Flask app:

```python
from flask_cors import CORS

# Allow GitHub Pages
CORS(app, resources={
    r"/api/*": {
        "origins": ["https://zozbot-hub.github.io", "http://localhost:*"]
    }
})
```

Or for testing (less secure):

```python
CORS(app, resources={r"/api/*": {"origins": "*"}})
```

### 3. Test Locally

```bash
cd static-dashboard
python -m http.server 8000
```

Open http://localhost:8000

The dashboard should load data from your VDS.

### 4. Deploy to GitHub Pages

Option A: Separate repo (recommended)
```bash
# Create new repo for just the static site
git init
git add .
git commit -m "Initial static dashboard"
git remote add origin https://github.com/zozbot-hub/hedge-fund-dashboard.git
git push -u origin main
```

Option B: Same repo, gh-pages branch
```bash
git checkout --orphan gh-pages
git rm -rf .
cp -r static-dashboard/* .
git add .
git commit -m "Static dashboard"
git push origin gh-pages
```

Then enable GitHub Pages in repo settings.

## Security

✅ **Safe for public:**
- No API keys in JavaScript
- No secrets in HTML/CSS
- All sensitive logic on VDS

⚠️ **VDS Security:**
- Use HTTPS in production
- Restrict CORS origins to your GitHub Pages domain
- Add API authentication if needed

## Files

```
static-dashboard/
├── index.html      # Main dashboard
├── css/
│   └── style.css   # Dashboard styles
├── js/
│   └── app.js      # API client
└── README.md       # This file
```

## Troubleshooting

**CORS errors:**
- Check VDS Flask app has CORS enabled
- Verify the origin matches your GitHub Pages URL

**Connection refused:**
- Ensure VDS firewall allows port 5000
- Check Flask app is running: `python app.py`

**Mixed content:**
- Use HTTPS on both GitHub Pages and VDS
- Or use HTTP on both (not recommended for production)
