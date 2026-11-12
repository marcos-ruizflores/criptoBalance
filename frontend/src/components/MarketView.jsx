import { useCallback, useEffect, useState } from "react";
import { fetchHistory, fetchTopMarketCaps } from "../api";
import { compactMoney, pct, price, tone } from "../format";
import PriceChart from "./PriceChart";
import { Asset, Empty, Icon, Segmented } from "./ui";

const RANGES = {
  "24h": { interval: "1h", limit: 24, label: "24 h" },
  "1w": { interval: "1h", limit: 168, label: "1 sem" },
  "1m": { interval: "4h", limit: 180, label: "1 mes" },
  "3m": { interval: "1d", limit: 90, label: "3 meses" },
  "1y": { interval: "1w", limit: 52, label: "1 año" },
};

export default function MarketView({ heldAssets, onError }) {
  const [asset, setAsset] = useState(heldAssets[0] || "BTC");
  const [input, setInput] = useState(asset);
  const [range, setRange] = useState("3m");
  const [history, setHistory] = useState([]);
  const [top, setTop] = useState([]);

  const loadHistory = useCallback(
    async (a, r) => {
      try {
        const { interval, limit } = RANGES[r];
        setHistory(await fetchHistory(a, interval, limit));
      } catch {
        setHistory([]);
        onError(`No hay datos de precio para ${a}.`);
      }
    },
    [onError]
  );

  const loadTop = useCallback(async () => {
    try {
      setTop(await fetchTopMarketCaps(15));
    } catch {
      onError("No se pudo cargar el mercado. CoinGecko limita las peticiones; prueba en un minuto.");
    }
  }, [onError]);

  useEffect(() => {
    loadHistory(asset, range);
  }, [asset, range, loadHistory]);

  useEffect(() => {
    loadTop();
  }, [loadTop]);

  const last = history.at(-1)?.close;
  const quote = history[0]?.quote_asset;

  const choose = (a) => {
    const clean = a.trim().toUpperCase();
    if (!clean) return;
    setInput(clean);
    setAsset(clean);
  };

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head" style={{ alignItems: "flex-start" }}>
          <div>
            <p className="muted small">
              {asset}
              {quote ? ` / ${quote}` : ""}
            </p>
            <p style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }} className="num">
              {price(last)}
            </p>
          </div>
          <div className="row">
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                choose(input);
              }}>
              <input
                className="input input-sm"
                style={{ width: 110 }}
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                aria-label="Activo"
                placeholder="BTC"
              />
              <button className="btn" type="submit">
                Ver
              </button>
            </form>
            <Segmented label="Periodo" value={range} onChange={setRange} options={Object.entries(RANGES).map(([value, r]) => ({ value, label: r.label }))} />
          </div>
        </div>
        {heldAssets.length > 1 && (
          <div className="row" style={{ padding: "12px 16px 0" }}>
            <span className="muted small">Tus activos:</span>
            {heldAssets.map((a) => (
              <button key={a} className={`btn ${a === asset ? "btn-primary" : ""}`} style={{ height: 26, padding: "0 10px" }} onClick={() => choose(a)}>
                {a}
              </button>
            ))}
          </div>
        )}
        <PriceChart data={history} intraday={range === "24h" || range === "1w"} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Mayores por capitalización</h2>
          <button className="btn btn-ghost" onClick={loadTop}>
            <Icon name="refresh" size={14} /> Actualizar
          </button>
        </div>
        {top.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Activo</th>
                  <th className="num">Precio</th>
                  <th className="num">24 h</th>
                  <th className="num">Capitalización</th>
                </tr>
              </thead>
              <tbody>
                {top.map((c, i) => (
                  <tr key={c.symbol + i} style={{ cursor: "pointer" }} onClick={() => choose(c.symbol)}>
                    <td className="muted">{i + 1}</td>
                    <td>
                      <Asset symbol={c.symbol} sub={c.name !== c.symbol ? c.name : undefined} />
                    </td>
                    <td className="num">{price(c.price)}</td>
                    <td className={`num ${tone(c.change_24h)}`}>{pct(c.change_24h)}</td>
                    <td className="num muted">{compactMoney(c.market_cap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Sin datos de mercado">Pulsa «Actualizar» para volver a intentarlo.</Empty>
        )}
      </section>
    </div>
  );
}
