import { useMemo, useState } from "react";
import { pct, price, shortDate, tone } from "../format";

const W = 1000;
const H = 260;
const PAD = 12; // keeps the line off the top and bottom edges

// Line chart drawn in a stretched SVG; labels, dot and tooltip are HTML so text never distorts
export default function PriceChart({ data, intraday }) {
  const [hover, setHover] = useState(null);

  const chart = useMemo(() => {
    if (!data.length) return null;
    const closes = data.map((d) => d.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || 1;
    const x = (i) => (data.length > 1 ? (i / (data.length - 1)) * W : W / 2);
    const y = (v) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
    const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.close).toFixed(1)}`).join(" ");
    const change = ((closes.at(-1) - closes[0]) / closes[0]) * 100;
    return { min, max, x, y, line, area: `${line} L${W},${H} L0,${H} Z`, change };
  }, [data]);

  if (!chart) return <div className="chart" style={{ height: 296 }} />;

  const color = chart.change >= 0 ? "var(--pos)" : "var(--neg)";
  const point = hover != null ? data[hover] : null;

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setHover(Math.round(ratio * (data.length - 1)));
  };

  return (
    <div className="chart">
      <div style={{ position: "relative" }} onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Precio, variación ${pct(chart.change)}`}>
          <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.14" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={chart.area} fill="url(#area)" />
          <path d={chart.line} fill="none" stroke={color} strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {point && (
            <line x1={chart.x(hover)} x2={chart.x(hover)} y1="0" y2={H} stroke="var(--border-strong)" vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        {point && (
          <>
            <span
              style={{
                position: "absolute",
                left: `${(chart.x(hover) / W) * 100}%`,
                top: `${(chart.y(point.close) / H) * 100}%`,
                width: 9,
                height: 9,
                marginLeft: -4.5,
                marginTop: -4.5,
                borderRadius: "50%",
                background: color,
                boxShadow: "0 0 0 3px var(--surface)",
                pointerEvents: "none",
              }}
            />
            <div className="chart-tooltip" style={{ left: `clamp(60px, ${(chart.x(hover) / W) * 100}%, calc(100% - 60px))` }}>
              <strong>{price(point.close)}</strong>
              <span style={{ opacity: 0.7, marginLeft: 8 }}>{shortDate(point.open_time, intraday)}</span>
            </div>
          </>
        )}

        <span className="small muted" style={{ position: "absolute", right: 0, top: -2 }}>
          {price(chart.max)}
        </span>
        <span className="small muted" style={{ position: "absolute", right: 0, bottom: -2 }}>
          {price(chart.min)}
        </span>
      </div>
      <div className="row small muted" style={{ justifyContent: "space-between", marginTop: 8 }}>
        <span>{shortDate(data[0].open_time, intraday)}</span>
        <span className={tone(chart.change)}>{pct(chart.change)} en el periodo</span>
        <span>{shortDate(data.at(-1).open_time, intraday)}</span>
      </div>
    </div>
  );
}
