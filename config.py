"""
Configuration for Hedge Fund Dashboard
All sensitive values use environment variables with safe defaults
"""

import os

# Load .env file if it exists
env_path = '/home/claude/crypto-hedge-fund/.env'
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key, value)

# Database (optional - app works without it showing mock data)
DB_HOST = os.getenv('POSTGRES_HOST', os.getenv('DB_HOST', 'localhost'))
DB_PORT = int(os.getenv('POSTGRES_PORT', os.getenv('DB_PORT', '5432')))
DB_USER = os.getenv('POSTGRES_USER', os.getenv('DB_USER', 'trader'))
DB_PASS = os.getenv('POSTGRES_PASSWORD', os.getenv('DB_PASS', ''))
DB_NAME = os.getenv('POSTGRES_DB', os.getenv('DB_NAME', 'hedge_fund'))

# Redis (optional)
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))

# Paths
LOG_PATH = os.getenv('LOG_PATH', '/tmp/orchestrator.log')

# Flask
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-key-change-in-production')
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
