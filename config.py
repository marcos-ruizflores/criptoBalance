from dotenv import load_dotenv
import os

load_dotenv()

# Conexión a MongoDB local
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "crypto_portfolio")

# Configuración general del proyecto
DEFAULT_QUOTE_ASSET = "USDT"
FIAT_CURRENCY = "EUR"
FIAT_RATE = 1.0  # 1 USDT = 1 EUR (aproximación)

SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="marcos"
SMTP_PASSWORD="root"
EMAIL_FROM="ruizflores200212@gmail.com"
ALERT_EMAIL_TO="marcos20028e@gmail.com"