import { useMemo, useState } from "react";
import { compactMoney, money, pct, signedMoney, tone } from "../format";

const W = 1000;
const H = 240;
const TOP = 10;

const longDate = (iso) =>
  new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00`));
const axisDate = (iso, withYear) =>
  new Intl.DateTimeFormat("es-ES", withYear ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" }).format(
    new Date(`${iso}T12:00:00`),
  );

// Portfolio value vs money in it, one euro axis from zero. Value is the solid line
// with an area, invested the dashed one, so the two never depend on colour alone.
export default function PortfolioChart({ points }) {
  const [hover, setHover] = useState(null);

  const chart = useMemo(() => {
    if (points.length < 2) return null;
    // Round steps (1, 2, 2.5 or 5 times a power of ten) so the axis reads 5.000 €, 10.000 €...
    const top = Math.max(...points.map((p) => Math.max(p.value, p.invested))) || 1;
    const raw = top / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw);
    const max = Math.ceil(top / step) * step;
    const x = (i) => (i / (points.length - 1)) * W;
    const y = (v) => TOP + (1 - v / max) * (H - TOP);
    const path = (key) => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
    const value = path("value");
    const ticks = Array.from({ length: Math.round(max / step) }, (_, i) => (i + 1) * step);
    const spanDays = (new Date(points.at(-1).date) - new Date(points[0].date)) / 86_400_000;
    return {
      max,
      x,
      y,
      value,
      invested: path("invested"),
      area: `${value} L${W},${H} L0,${H} Z`,
      ticks,
      withYear: spanDays > 200,
    };
  }, [points]);

  if (!chart) return null;

  const last = points.at(-1);
  const p = hover != null ? points[hover] : null;
  const gain = (pt) => pt.value - pt.invested;

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setHover(Math.round(ratio * (points.length - 1)));
  };

  const mid = points[Math.floor(points.length / 2)];

  return (
    <div className="pchart">
      <div className="pchart-legend" aria-hidden="true">
        <span>
          <i className="pchart-key value" /> Valor
        </span>
        <span>
          <i className="pchart-key invested" /> Invertido
        </span>
      </div>

      <div className="pchart-plot">
        {chart.ticks.map((t) => (
          <span key={t} className="pchart-tick" style={{ top: `${(chart.y(t) / H) * 100}%` }}>
            {compactMoney(t)}
          </span>
        ))}
        <div className="pchart-inner" onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`Evolución de la cartera del ${longDate(points[0].date)} al ${longDate(last.date)}: vale ${money(last.value)} con ${money(
              last.invested,
            )} invertidos`}
          >
            <defs>
              <linearGradient id="pchart-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--series-value)" stopOpacity="0.16" />
                <stop offset="100%" stopColor="var(--series-value)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {chart.ticks.map((t) => (
              <line key={t} x1="0" x2={W} y1={chart.y(t)} y2={chart.y(t)} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
            ))}
            <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--border-strong)" vectorEffect="non-scaling-stroke" />
            <path d={chart.area} fill="url(#pchart-area)" />
            <path
              d={chart.invested}
              fill="none"
              stroke="var(--series-invested)"
              strokeWidth="2"
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            <path
              d={chart.value}
              fill="none"
              stroke="var(--series-value)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            {p && (
              <line x1={chart.x(hover)} x2={chart.x(hover)} y1="0" y2={H} stroke="var(--border-strong)" vectorEffect="non-scaling-stroke" />
            )}
          </svg>

          {p && (
            <>
              {["invested", "value"].map((k) => (
                <span
                  key={k}
                  className={`pchart-dot ${k}`}
                  style={{
                    left: `${(chart.x(hover) / W) * 100}%`,
                    top: `${(chart.y(p[k]) / H) * 100}%`,
                  }}
                />
              ))}
              <div
                className="chart-tooltip pchart-tip"
                style={{
                  left: `clamp(90px, ${(chart.x(hover) / W) * 100}%, calc(100% - 90px))`,
                }}
              >
                <span className="pchart-tip-date">{longDate(p.date)}</span>
                <span>
                  <i className="pchart-key value" /> Valor <strong>{money(p.value)}</strong>
                </span>
                <span>
                  <i className="pchart-key invested" /> Invertido <strong>{money(p.invested)}</strong>
                </span>
                <span>
                  Ganancia <strong>{signedMoney(gain(p))}</strong>
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="row small muted pchart-axis">
        <span>{axisDate(points[0].date, chart.withYear)}</span>
        <span>{axisDate(mid.date, chart.withYear)}</span>
        <span>{axisDate(last.date, chart.withYear)}</span>
      </div>
      <p className="small muted">
        En el periodo el valor ha pasado de {money(points[0].value)} a {money(last.value)}. Ahora vas{" "}
        <span className={tone(gain(last))}>{signedMoney(gain(last))}</span>
        {last.invested > 0 && <> ({pct((gain(last) / last.invested) * 100)})</>} sobre lo invertido.
      </p>
    </div>
  );
}
