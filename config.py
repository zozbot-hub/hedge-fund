"""
Configuration for Hedge Fund Dashboard
All sensitive values use environment variables with safe defaults
"""

import os

# Database (optional - app works without it showing mock data)
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', '5432'))
DB_USER = os.getenv('DB_USER', 'trader')
DB_PASS = os.getenv('DB_PASS', '')
DB_NAME = os.getenv('DB_NAME', 'hedgefund')

# Redis (optional)
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))

# Paths
LOG_PATH = os.getenv('LOG_PATH', '/tmp/orchestrator.log')

# Flask
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-key-change-in-production')
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
