export default function TradesTable({
  trades = [],
  filter = "all",
  symbolFilter = "",
  onFilterChange,
  onSymbolChange,
  onDelete,
  onRefresh,
  fiatCurrency = "EUR",
}) {
  const filtered = trades
    .filter((t) => {
      if (filter === "buy") return t.side === "BUY";
      if (filter === "sell") return t.side === "SELL";
      return true;
    })
    .filter((t) => {
      if (!symbolFilter) return true;
      const sym = (t.base_asset || t.symbol || "").toUpperCase();
      return sym.includes(symbolFilter.toUpperCase());
    });
  return (
    <div className="card glass">
      <div className="card-header">
        <div>
          <p className="eyebrow">Histórico</p>
          <h3>Operaciones</h3>
        </div>
        <div className="actions">
          <div className="pill">
            <button className={filter === "all" ? "chip active" : "chip"} onClick={() => onFilterChange?.("all")}>Todas</button>
            <button className={filter === "buy" ? "chip active" : "chip"} onClick={() => onFilterChange?.("buy")}>Compras</button>
            <button className={filter === "sell" ? "chip active" : "chip"} onClick={() => onFilterChange?.("sell")}>Ventas</button>
          </div>
          <input
            className="input-ghost"
            style={{ width: 120 }}
            placeholder="Filtrar cripto"
            value={symbolFilter}
            onChange={(e) => onSymbolChange?.(e.target.value)}
          />
          <button className="ghost" onClick={onRefresh}>
            Actualizar precios
          </button>
          <span className="pill">{filtered.length} ops</span>
        </div>
      </div>
      <div className="table">
        <div className="table-head">
          <span>ID</span>
          <span>Cripto</span>
          <span>Tipo</span>
          <span>Cantidad</span>
          <span>Precio</span>
          <span>Importe</span>
          <span>Precio ahora</span>
          <span>PnL</span>
          <span></span>
        </div>
        {filtered.map((t) => (
          <div className="table-row" key={t._id}>
            <span className="mono">{t._id}</span>
            <span>{t.base_asset}</span>
            <span>{t.side}</span>
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
