export default function TradesTable({ trades = [], onDelete, fiatCurrency = "EUR" }) {
  return (
    <div className="card glass">
      <div className="card-header">
        <div>
          <p className="eyebrow">Histórico</p>
          <h3>Operaciones</h3>
        </div>
        <span className="pill">{trades.length} ops</span>
      </div>
      <div className="table">
        <div className="table-head">
          <span>ID</span>
          <span>Cripto</span>
          <span>Cantidad</span>
          <span>Precio compra</span>
          <span>Coste total</span>
          <span>Precio ahora</span>
          <span>PnL</span>
          <span></span>
        </div>
        {trades.map((t) => (
          <div className="table-row" key={t._id}>
            <span className="mono">{t._id}</span>
            <span>{t.base_asset}</span>
            <span>{Number(t.quantity).toLocaleString()}</span>
            <span>
              {Number(t.price_fiat).toFixed(4)} {fiatCurrency}
            </span>
            <span>
              {Number(t.total_cost_fiat).toFixed(2)} {fiatCurrency}
            </span>
            <span>
              {Number(t.current_price_fiat).toFixed(4)} {fiatCurrency}
            </span>
            <span className={Number(t.pnl_fiat) >= 0 ? "pos" : "neg"}>
              {Number(t.pnl_fiat).toFixed(2)} ({Number(t.pnl_pct).toFixed(2)}%)
            </span>
            <span>
              <button className="ghost" onClick={() => onDelete(t._id)}>
                🗑️
              </button>
            </span>
          </div>
        ))}
        {trades.length === 0 && <div className="table-empty">No hay operaciones todavía.</div>}
      </div>
    </div>
  );
}
