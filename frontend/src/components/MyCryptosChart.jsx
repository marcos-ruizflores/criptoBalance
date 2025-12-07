import React from "react";

const colorFor = (label) => {
  // Genera un color único por activo a partir del nombre usando HSL.
  const base = Array.from(label || "").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const hue = (base * 137) % 360; // golden angle para separar tonos
  return `hsl(${hue}, 75%, 55%)`;
};

export default function MyCryptosChart({ items = [], fiatCurrency = "EUR" }) {
  const total = items.reduce((acc, i) => acc + Number(i.current_value_fiat || 0), 0);
  const data = items.map((i) => ({
    label: i.base_asset,
    value: Number(i.current_value_fiat || 0),
    pct: total ? (Number(i.current_value_fiat || 0) / total) * 100 : 0,
    color: colorFor(i.base_asset),
  }));
  const circumference = 2 * Math.PI * 60;

  const segments = data.reduce(
    (acc, d) => {
      const segment = { ...d, start: acc.totalPct };
      acc.totalPct += d.pct;
      acc.list.push(segment);
      return acc;
    },
    { totalPct: 0, list: [] }
  ).list;

  return (
    <div className="bar-chart">
      <div className="bar-chart-header">
        <div>
          <p className="eyebrow">Valor actual</p>
          <h2 className="balance-number">{total.toFixed(2)} {fiatCurrency}</h2>
        </div>
      </div>
      <div className="donut-chart">
        <div className="donut-wrapper">
          <svg className="donut-svg" viewBox="0 0 160 160">
            <g transform="translate(80,80) rotate(-90)">
              {segments.map((d, idx) => {
                const dash = (d.pct / 100) * circumference;
                const offset = circumference - (d.start / 100) * circumference;
                return (
                  <circle
                    key={d.label}
                    r="60"
                    cx="0"
                    cy="0"
                    fill="transparent"
                    stroke={d.color}
                    strokeWidth="20"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          </svg>
          <div className="donut-center">
            <span className="muted small">Activos</span>
            <strong>{data.length}</strong>
          </div>
        </div>
        <div className="donut-legend">
          {data.map((d) => (
            <div key={d.label} className="legend-item">
              <span className="legend-dot" style={{ background: d.color }} />
              <div>
                <strong>{d.label}</strong>
                <span className="muted small">
                  {d.value.toFixed(2)} {fiatCurrency} · {d.pct.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
          {!data.length && <p className="muted">Sin datos de portfolio.</p>}
        </div>
      </div>
      <div className="bars">
        {data.map((d) => (
          <div key={d.label} className="bar">
            <div
              className="bar-fill"
              style={{ height: `${Math.max(d.pct, 1)}%`, background: d.color, animationDelay: `${Math.random() * 0.3}s` }}
            >
              <span className="bar-value">{d.pct.toFixed(1)}%</span>
            </div>
            <div className="bar-label">
              <strong>{d.label}</strong>
              <span>{d.value.toFixed(2)} {fiatCurrency}</span>
            </div>
          </div>
        ))}
        {!data.length && <p className="muted">Sin datos de portfolio.</p>}
      </div>
    </div>
  );
}
