export default function PortfolioGrid({ items = [], fiatCurrency = "EUR" }) {
  return (
    <div className="card glass">
      <div className="card-header">
        <div>
          <p className="eyebrow">Resumen</p>
          <h3>Portfolio</h3>
        </div>
        <span className="pill">{items.length} activos</span>
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
