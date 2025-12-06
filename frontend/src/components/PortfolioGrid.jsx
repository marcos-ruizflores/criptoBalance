const fmt = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : "-");

export default function PortfolioGrid({ items = [], totals = {}, fiatCurrency = "EUR", onRefresh }) {
  const totalPnl = Number(totals.total_pnl_fiat);
  const totalValue = Number(totals.total_value_fiat);
  const totalRealized = Number(totals.total_realized_pnl_fiat);
  const totalUnrealized = Number(totals.total_unrealized_pnl_fiat);
  return (
    <div className="card glass">
      <div className="card-header">
        <div>
          <p className="eyebrow">Resumen</p>
          <h3>Portfolio</h3>
        </div>
        <div className="actions">
          <div className="balance-total">
            <p className="eyebrow">Balance total</p>
            <div className={`balance-number ${totalPnl >= 0 ? "pos" : "neg"}`}>
              {fmt(totalPnl)} {fiatCurrency}
            </div>
            <div className="muted small">Valor actual: {fmt(totalValue)} {fiatCurrency}</div>
            <div className="muted small">Realizado: {fmt(totalRealized)} · No realizado: {fmt(totalUnrealized)}</div>
          </div>
          <button className="ghost" onClick={onRefresh}>
            Actualizar precios
          </button>
          <span className="pill">{items.length} activos</span>
        </div>
      </div>
      <div className="portfolio-grid">
        {items.map((p) => (
          <article className="portfolio-card" key={p.symbol}>
            <header>
              <div className="pill">{p.base_asset}</div>
              <span className={Number(p.pnl_fiat) >= 0 ? "pos" : "neg"}>
                {Number(p.pnl_pct).toFixed(2)}%
              </span>
            </header>
            <div className="metric">
              <p className="eyebrow">Cantidad</p>
              <strong>{Number(p.total_quantity).toLocaleString()}</strong>
            </div>
            <div className="metric">
              <p className="eyebrow">Precio medio</p>
              <strong>
                {Number(p.avg_price_fiat).toFixed(4)} {fiatCurrency}
              </strong>
            </div>
            <div className="metric">
              <p className="eyebrow">Precio actual</p>
              <strong>
                {Number(p.current_price_fiat).toFixed(4)} {fiatCurrency}
              </strong>
            </div>
            <div className="metric">
              <p className="eyebrow">PnL</p>
              <strong className={Number(p.pnl_fiat) >= 0 ? "pos" : "neg"}>
                {Number(p.pnl_fiat).toFixed(2)} {fiatCurrency}
              </strong>
            </div>
          </article>
        ))}
        {items.length === 0 && <div className="table-empty">No hay posiciones abiertas.</div>}
      </div>
    </div>
  );
}
