import { useEffect, useState } from "react";
import { fetchPortfolioHistory } from "../api";
import { assetColor, dateTime, money, pct, price, qty, signedMoney, tone } from "../format";
import PortfolioChart from "./PortfolioChart";
import { Asset, Empty, Icon, Segmented } from "./ui";

const RANGES = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "1y", label: "1A" },
  { value: "all", label: "Todo" },
];

function Evolution({ portfolio }) {
  const [range, setRange] = useState("all");
  const [state, setState] = useState({ loading: true, points: [], error: "" });

  // Reload when the range changes or the portfolio does (a trade added or removed)
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    fetchPortfolioHistory(range)
      .then((res) => alive && setState({ loading: false, points: res.points, error: "" }))
      .catch(() => alive && setState({ loading: false, points: [], error: "No se pudo calcular la evolución ahora mismo." }));
    return () => {
      alive = false;
    };
  }, [range, portfolio]);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Evolución</h2>
          <p className="muted small">Valor de la cartera cada día, con precios de cierre de Binance.</p>
        </div>
        <Segmented label="Periodo" options={RANGES} value={range} onChange={setRange} />
      </div>
      <div className="card-body">
        {state.error ? (
          <p className="muted">{state.error}</p>
        ) : state.points.length < 2 ? (
          <div className="pchart-placeholder muted">{state.loading ? "Calculando…" : "Hace falta al menos un día de historia."}</div>
        ) : (
          <div style={{ opacity: state.loading ? 0.5 : 1, transition: "opacity 0.15s" }}>
            <PortfolioChart points={state.points} />
          </div>
        )}
      </div>
    </section>
  );
}

export default function Overview({ portfolio, snapshots, onNewTrade, onSnapshot, onDeleteSnapshot }) {
  const { items = [], totals = {}, missing_prices: missing = [] } = portfolio;
  // Positions without a live price still show what they cost, but stay out of value and PnL
  const priced = items.filter((i) => i.current_value_fiat !== null && i.current_value_fiat !== undefined);
  const value = Number(totals.total_value_fiat) || 0;
  const invested = items.reduce((acc, i) => acc + Number(i.total_cost_fiat || 0), 0);
  const pricedInvested = priced.reduce((acc, i) => acc + Number(i.total_cost_fiat || 0), 0);
  const unrealized = Number(totals.total_unrealized_pnl_fiat) || 0;
  const unrealizedPct = pricedInvested ? (unrealized / pricedInvested) * 100 : 0;

  const sorted = [...items].sort((a, b) => Number(b.current_value_fiat ?? -1) - Number(a.current_value_fiat ?? -1));
  const byPnl = [...priced].sort((a, b) => Number(b.pnl_pct) - Number(a.pnl_pct));
  const pricedSorted = sorted.filter((p) => priced.includes(p));

  if (!items.length) {
    return (
      <div className="card">
        <Empty title="Todavía no tienes posiciones">
          <p style={{ marginBottom: 16 }}>Registra tu primera compra para ver el valor de tu cartera.</p>
          <button className="btn btn-primary" onClick={onNewTrade}>
            <Icon name="plus" size={14} /> Nueva operación
          </button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="stack">
      {missing.length > 0 && (
        <p className="notice" role="status">
          Binance no ha devuelto precio para {missing.join(", ")}. Esas posiciones salen sin valor actual y no cuentan en el total.
        </p>
      )}
      <section className="card kpis" aria-label="Resumen de la cartera">
        <div className="kpi">
          <p className="kpi-label">Valor actual</p>
          <p className="kpi-value">{money(value)}</p>
          <p className="kpi-sub muted">{items.length} activos</p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Invertido</p>
          <p className="kpi-value">{money(invested)}</p>
          <p className="kpi-sub muted">Coste de lo que tienes ahora</p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Ganancia sin realizar</p>
          <p className={`kpi-value ${tone(unrealized)}`}>{signedMoney(unrealized)}</p>
          <p className={`kpi-sub ${tone(unrealizedPct)}`}>{pct(unrealizedPct)}</p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Ganancia realizada</p>
          <p className={`kpi-value ${tone(totals.total_realized_pnl_fiat)}`}>{signedMoney(totals.total_realized_pnl_fiat)}</p>
          <p className="kpi-sub muted">De las ventas</p>
        </div>
      </section>

      <Evolution portfolio={portfolio} />

      <div className="split">
        <section className="card">
          <div className="card-head">
            <h2>Posiciones</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Activo</th>
                  <th className="num">Precio</th>
                  <th className="num">Precio medio</th>
                  <th className="num">Valor</th>
                  <th className="num">Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.symbol}>
                    <td>
                      <Asset symbol={p.base_asset} sub={qty(p.total_quantity)} />
                    </td>
                    <td className="num">{price(p.current_price_fiat)}</td>
                    <td className="num muted">{price(p.avg_price_fiat)}</td>
                    <td className="num">{money(p.current_value_fiat)}</td>
                    <td className={`num ${tone(p.pnl_fiat)}`}>
                      {signedMoney(p.pnl_fiat)}
                      <span className="small" style={{ display: "block" }}>
                        {pct(p.pnl_pct)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>Distribución</h2>
            </div>
            <div className="card-body">
              <div className="alloc-bar" aria-hidden="true">
                {pricedSorted.map((p) => (
                  <span key={p.symbol} style={{ width: `${(Number(p.current_value_fiat) / value) * 100}%`, background: assetColor(p.base_asset) }} />
                ))}
              </div>
              <ul className="alloc-list">
                {pricedSorted.map((p) => (
                  <li key={p.symbol}>
                    <span className="dot" style={{ background: assetColor(p.base_asset) }} />
                    <span>{p.base_asset}</span>
                    <span className="num muted">{money(p.current_value_fiat)}</span>
                    <span className="num" style={{ minWidth: 56 }}>
                      {pct((Number(p.current_value_fiat) / value) * 100, { signed: false })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Mejor y peor</h2>
            </div>
            <ul className="list">
              {[byPnl[0], byPnl[byPnl.length - 1]]
                .filter((p, i, arr) => p && arr.indexOf(p) === i)
                .map((p) => (
                  <li key={p.symbol}>
                    <Asset symbol={p.base_asset} />
                    <span className={`badge ${tone(p.pnl_pct)}`}>{pct(p.pnl_pct)}</span>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Snapshots</h2>
            <p className="muted small">Guarda el valor de la cartera para comparar con el tiempo.</p>
          </div>
          <button className="btn" onClick={onSnapshot}>
            <Icon name="camera" size={14} /> Guardar snapshot
          </button>
        </div>
        {snapshots.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="num">Valor</th>
                  <th className="num">Ganancia total</th>
                  <th className="cell-actions">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s._id}>
                    <td>{dateTime(s.timestamp)}</td>
                    <td className="num">{money(s.totals?.total_value_fiat)}</td>
                    <td className={`num ${tone(s.totals?.total_pnl_fiat)}`}>{signedMoney(s.totals?.total_pnl_fiat)}</td>
                    <td className="cell-actions">
                      <button className="btn btn-icon" aria-label="Eliminar snapshot" onClick={() => onDeleteSnapshot(s._id)}>
                        <Icon name="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Sin snapshots">Guarda el primero para empezar a ver la evolución.</Empty>
        )}
      </section>
    </div>
  );
}
