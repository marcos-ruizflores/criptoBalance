from dotenv import load_dotenv
import os
from pathlib import Path

# Carga .env desde la raíz del proyecto aunque ejecutes desde backend/
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

# Conexión a MongoDB (usa MONGO_URI para Atlas, por defecto local)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "criptoBalance")

# Configuración general del proyecto
DEFAULT_QUOTE_ASSET = "USDT"
FIAT_CURRENCY = "EUR"
FIAT_RATE = 1.0  # 1 USDT = 1 EUR (aproximación)

SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="marcos" # mirar de cambiar configuracion 
SMTP_PASSWORD="root" #mirar de cambiar la configuracion 
EMAIL_FROM="ruizflores200212@gmail.com"
ALERT_EMAIL_TO="marcos20028e@gmail.com"
