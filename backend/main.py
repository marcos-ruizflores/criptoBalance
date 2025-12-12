from datetime import datetime
from backend.trades_service import register_trade, list_trades_with_market, delete_trade
from backend.portfolio_service import compute_portfolio
from backend.config import FIAT_CURRENCY


def menu():
    print("\n=== GESTIÓN CRIPTO ===")
    print("1. Registrar compra")
    print("2. Ver operaciones con PnL actual")
    print("3. Ver estado del portfolio (PnL agregado)")
    print("4. Eliminar operación de compra")
    print("0. Salir")
    return input("Selecciona opción: ")

def handle_register_trade():
    base_symbol = input("Criptomoneda (ej: BTC): ").upper()
    quantity = float(input("Cantidad: "))
    price_fiat = float(input(f"Precio unitario en {FIAT_CURRENCY}: "))
    total_cost_fiat_input = input(f"Coste total en {FIAT_CURRENCY} (enter para {quantity * price_fiat:.2f}): ")
    total_cost_fiat = float(total_cost_fiat_input) if total_cost_fiat_input else quantity * price_fiat

    trade_id = register_trade(base_symbol, quantity, price_fiat, total_cost_fiat, datetime.utcnow())
    print(f"Operación registrada con ID: {trade_id}")

def handle_list_trades():
    trades = list_trades_with_market()
    print("\n=== OPERACIONES (PNL ACTUAL) ===")
    for t in trades:
        print(
            f"{str(t.get('_id'))} | {t.get('timestamp')} - {t.get('base_asset')} - "
            f"Qty={t.get('quantity')} @ {t.get('price_fiat'):.4f} {FIAT_CURRENCY} - "
            f"Coste={t.get('total_cost_fiat'):.2f} {FIAT_CURRENCY} - "
            f"Precio ahora={t.get('current_price_fiat'):.4f} {FIAT_CURRENCY} - "
            f"PnL={t.get('pnl_fiat'):.2f} {FIAT_CURRENCY} ({t.get('pnl_pct'):.2f}%)"
        )

def handle_portfolio():
    portfolio = compute_portfolio()
    print("\n=== PORTFOLIO ===")
    for p in portfolio:
        print(
            f"{p['base_asset']}: "
            f"Qty={p['total_quantity']}, "
            f"Avg={p['avg_price_fiat']:.4f} {FIAT_CURRENCY}, "
            f"Now={p['current_price_fiat']:.4f} {FIAT_CURRENCY}, "
            f"PnL={p['pnl_fiat']:.2f} {FIAT_CURRENCY} ({p['pnl_pct']:.2f}%)"
        )


def handle_delete_trade():
    trade_id = input("ID de la operación a eliminar (_id): ").strip()
    try:
        deleted = delete_trade(trade_id)
    except ValueError as exc:
        print(f"ID no válido: {exc}")
        return
    if deleted:
        print("Operación eliminada.")
    else:
        print("No se encontró una operación con ese ID.")


def main():
    while True:
        option = menu()
        if option == "1": handle_register_trade()
        elif option == "2": handle_list_trades()
        elif option == "3": handle_portfolio()
        elif option == "4": handle_delete_trade()
        elif option == "0":
            print("Saliendo...")
            break
        else:
            print("Opción no válida")

if __name__ == "__main__":
    main()
