import React from "react";

export default function MyCryptosChart({ items = [], fiatCurrency = "EUR" }) {
  const total = items.reduce((acc, i) => acc + Number(i.current_value_fiat || 0), 0);
  const data = items.map((i) => ({
    label: i.base_asset,
    value: Number(i.current_value_fiat || 0),
    pct: total ? (Number(i.current_value_fiat || 0) / total) * 100 : 0,
  }));

  return (
    <div className="bar-chart">
      <div className="bar-chart-header">
        <div>
          <p className="eyebrow">Valor actual</p>
          <h2 className="balance-number">{total.toFixed(2)} {fiatCurrency}</h2>
        </div>
      </div>
      <div className="bars">
        {data.map((d) => (
          <div key={d.label} className="bar">
            <div className="bar-fill" style={{ height: `${Math.max(d.pct, 1)}%` }}>
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
