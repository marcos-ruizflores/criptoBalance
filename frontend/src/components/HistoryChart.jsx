import { useEffect, useMemo, useState } from "react";

function buildPath(points, width, height) {
  if (!points.length) return "";
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const range = maxY - minY || 1;

  const stepX = points.length > 1 ? width / (points.length - 1) : width;

  const toY = (val) => height - ((val - minY) / range) * height;

  return points
    .map((p, idx) => {
      const x = idx * stepX;
      const y = toY(p.y);
      return `${idx === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function HistoryChart({ data = [], baseAsset, quote, range, presets = {}, onRefresh }) {
  const [assetInput, setAssetInput] = useState(baseAsset || "BTC");

  useEffect(() => {
    setAssetInput(baseAsset || "BTC");
  }, [baseAsset]);

  const points = useMemo(
    () =>
      data.map((candle, idx) => ({
        x: idx,
        y: candle.close,
      })),
    [data]
  );

  const path = buildPath(points, 700, 240);
  const lastClose = data.length ? data[data.length - 1].close : null;
  const firstClose = data.length ? data[0].close : null;
  const changePct = firstClose ? ((lastClose - firstClose) / firstClose) * 100 : 0;

  return (
    <div className="card glass">
      <div className="card-header">
        <div>
          <p className="eyebrow">Precio histórico</p>
          <h3>
            {baseAsset} / {quote || ""}
          </h3>
        </div>
        <div className="actions">
          <input
            className="input-ghost"
            value={assetInput}
            onChange={(e) => setAssetInput(e.target.value.toUpperCase())}
            placeholder="BTC, ADA..."
          />
          <button className="ghost" onClick={() => onRefresh(assetInput || "BTC", range)}>
            Ver gráfico
          </button>
          <div className="pill">
            {Object.keys(presets).map((key) => (
              <button
                key={key}
                className={range === key ? "chip active" : "chip"}
                onClick={() => onRefresh(assetInput || "BTC", key)}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="chart">
        <svg viewBox="0 0 700 260" preserveAspectRatio="none">
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {path && (
            <>
              <path
                d={`${path} L700,260 L0,260 Z`}
                fill="url(#grad)"
                stroke="none"
                opacity="0.8"
              />
              <path d={path} fill="none" stroke="#22d3ee" strokeWidth="2.5" />
            </>
          )}
        </svg>
      </div>
      <div className="chart-footer">
        <div>
          <p className="eyebrow">Último</p>
          <strong>{lastClose ? lastClose.toFixed(4) : "-"}</strong>
        </div>
        <div>
          <p className="eyebrow">Variación</p>
          <strong className={changePct >= 0 ? "pos" : "neg"}>
            {changePct ? changePct.toFixed(2) : "-"}%
          </strong>
        </div>
        <div>
          <p className="eyebrow">Puntos</p>
          <strong>{data.length}</strong>
        </div>
      </div>
    </div>
  );
}
