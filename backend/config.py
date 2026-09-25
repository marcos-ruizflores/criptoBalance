from dotenv import load_dotenv
import os
from pathlib import Path

# Load .env from the project root, even when running from backend/
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB connection (set MONGO_URI for Atlas, defaults to a local instance)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "criptoBalance")

# General settings
DEFAULT_QUOTE_ASSET = "USDT"
FIAT_CURRENCY = "EUR"
FIAT_RATE = 1.0  # 1 USDT = 1 EUR (rough approximation)

# Email alerts. Leave these empty to disable them.
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "")
ALERT_EMAIL_TO = os.getenv("ALERT_EMAIL_TO", "")
