# Crypto Hedge Fund Dashboard

A lightweight Flask dashboard for monitoring trading bot performance.

## Features

- **Live BTC Price**: Real-time price display
- **Agent Status Cards**: Visual status of all trading agents
- **7-Day PnL Calendar**: Daily profit/loss tracking
- **Open Positions**: Active trades with unrealized PnL
- **Performance Stats**: Win rate, total PnL, trade duration
- **Live Log**: Real-time orchestrator logs
- **Signal Feed**: Recent trading signals with execution status

## Quick Start

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run the app
python app.py
```

Visit: http://localhost:5000

### Docker Deployment

```bash
# Build image
docker build -t hedge-dashboard .

# Run container
docker run -p 5000:5000 hedge-dashboard
```

### Environment Variables

Create a `.env` file (optional - app works with defaults):

```env
# Database (optional - falls back to mock data)
DB_HOST=localhost
DB_PORT=5432
DB_USER=trader
DB_PASS=yourpassword
DB_NAME=hedgefund

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# Log path (optional)
LOG_PATH=/path/to/orchestrator.log
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/` | Main dashboard (HTML) |
| `/api/data` | JSON data feed |

## Auto-Refresh

Dashboard auto-refreshes every 15 seconds.

## License

MIT
