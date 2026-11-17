import { useCallback, useEffect, useState } from "react";
import { exportTaxReport, fetchTaxReport } from "../api";
import { money, pct, qty, signedMoney, tone } from "../format";
import { Asset, Empty, Icon, Segmented } from "./ui";

const day = (iso) => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
const rate = (r) => `${(r * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;

export default function TaxView({ onToast }) {
  const [year, setYear] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async (y) => {
    try {
      setError("");
      const res = await fetchTaxReport(y);
      setReport(res);
      setYear(res.year);
    } catch {
      setError("No se pudo calcular el informe.");
    }
  }, []);

  useEffect(() => {
    load(null);
  }, [load]);

  const handleExport = async () => {
    try {
      const url = URL.createObjectURL(await exportTaxReport(year));
      const a = document.createElement("a");
      a.href = url;
      a.download = `criptobalance-renta-${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      onToast("No se pudo exportar.");
    }
  };

  if (error) return <div className="card card-body muted">{error}</div>;
  if (!report) return <div className="card card-body muted">Calculando…</div>;

  const { totals, tax, sales, by_asset: byAsset, warnings, years } = report;
  // Always offer the current year, even before its first sale
  const yearOptions = [...new Set([...years, new Date().getFullYear()])].sort((a, b) => b - a).slice(0, 5);

  return (
    <div className="stack tax">
      <div className="tax-bar">
        <Segmented
          label="Año fiscal"
          options={yearOptions.map((y) => ({ value: y, label: String(y) }))}
          value={year}
          onChange={(y) => load(y)}
        />
        {sales.length > 0 && (
          <div className="row no-print">
            <button className="btn btn-ghost" onClick={() => window.print()}>
              Imprimir
            </button>
            <button className="btn" onClick={handleExport}>
              <Icon name="download" size={14} /> Exportar CSV
            </button>
          </div>
        )}
      </div>

      {warnings.map((w) => (
        <p key={w} className="notice warn" role="status">
          {w}
        </p>
      ))}

      {!sales.length ? (
        <div className="card">
          <Empty title={`Sin ventas en ${year}`}>
            Solo tributan las ventas: mientras no vendas, no hay ganancia ni pérdida que declarar.
          </Empty>
        </div>
      ) : (
        <>
          <section className="card kpis" aria-label={`Resumen fiscal de ${year}`}>
            <div className="kpi">
              <p className="kpi-label">Ganancias</p>
              <p className="kpi-value">{money(totals.gains)}</p>
              <p className="kpi-sub muted">{sales.filter((s) => s.gain >= 0).length} ventas con beneficio</p>
            </div>
            <div className="kpi">
              <p className="kpi-label">Pérdidas</p>
              <p className="kpi-value">{money(totals.losses)}</p>
              <p className="kpi-sub muted">Se restan de las ganancias</p>
            </div>
            <div className="kpi">
              <p className="kpi-label">Resultado neto</p>
              <p className={`kpi-value ${tone(totals.net)}`}>{signedMoney(totals.net)}</p>
              <p className="kpi-sub muted">Base del ahorro</p>
            </div>
            <div className="kpi">
              <p className="kpi-label">Cuota estimada</p>
              <p className="kpi-value">{money(tax.total)}</p>
              <p className="kpi-sub muted">{totals.net > 0 ? `Tipo efectivo ${rate(tax.effective_rate)}` : "Sin cuota"}</p>
            </div>
          </section>

          {totals.net < 0 && (
            <p className="notice">
              Cierras el año con {money(-totals.net)} de pérdidas netas. Puedes compensarlas con ganancias del ahorro de los cuatro años
              siguientes.
            </p>
          )}

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Ventas de {year}</h2>
                <p className="muted small">Coste calculado por FIFO: cada venta descuenta primero las compras más antiguas.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Activo</th>
                    <th className="num">Cantidad</th>
                    <th className="num">Transmisión</th>
                    <th className="num">Adquisición</th>
                    <th className="num">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={`${s.date}-${s.asset}-${s.quantity}`}>
                      <td>{day(s.date)}</td>
                      <td>
                        <Asset symbol={s.asset} />
                      </td>
                      <td className="num">{qty(s.quantity)}</td>
                      <td className="num">{money(s.proceeds)}</td>
                      <td className="num">
                        {money(s.cost)}
                        <span className="small muted tax-lots">
                          {s.lots.length
                            ? s.lots.length === 1
                              ? `Compra del ${day(s.lots[0].date)}`
                              : `${s.lots.length} compras, del ${day(s.lots[0].date)} al ${day(s.lots.at(-1).date)}`
                            : "Sin compras registradas"}
                        </span>
                      </td>
                      <td className={`num ${tone(s.gain)}`}>{signedMoney(s.gain)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total</td>
                    <td className="num">{money(totals.proceeds)}</td>
                    <td className="num">{money(totals.cost)}</td>
                    <td className={`num ${tone(totals.net)}`}>{signedMoney(totals.net)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <div className="split">
            <section className="card">
              <div className="card-head">
                <h2>Por activo</h2>
              </div>
              <ul className="list">
                {byAsset.map((a) => (
                  <li key={a.asset}>
                    <Asset symbol={a.asset} />
                    <span className={`num ${tone(a.net)}`}>{signedMoney(a.net)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Cuota por tramos</h2>
                  <p className="muted small">Escala estatal del ahorro de {year}, sin otras rentas del ahorro.</p>
                </div>
              </div>
              {tax.brackets.length ? (
                <ul className="list">
                  {tax.brackets.map((b) => (
                    <li key={b.from}>
                      <span>
                        {b.to ? `${money(b.from)} – ${money(b.to)}` : `Más de ${money(b.from)}`}
                        <span className="muted small" style={{ display: "block" }}>
                          {money(b.base)} al {pct(b.rate * 100, { signed: false })}
                        </span>
                      </span>
                      <span className="num">{money(b.tax)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="card-body muted">Sin ganancia neta, no hay cuota.</p>
              )}
            </section>
          </div>
        </>
      )}

      <section className="card card-body tax-help">
        <h2>Cómo se declara</h2>
        <ul>
          <li>
            En la Renta (modelo 100), cada venta va en el apartado de <strong>monedas virtuales</strong> de ganancias y pérdidas
            patrimoniales, con su valor de transmisión y de adquisición. El CSV trae las dos columnas.
          </li>
          <li>Cambiar una cripto por otra también tributa como venta. Aquí solo cuentan las ventas registradas en euros.</li>
          <li>Las comisiones suben el coste de compra y bajan el valor de venta. Si las pagaste, ajústalas al declarar.</li>
          <li>
            Si a 31 de diciembre tus criptos en plataformas extranjeras valen más de 50.000 €, también tienes que presentar el modelo 721.
          </li>
        </ul>
        <p className="muted small">
          Es una estimación para el régimen común. País Vasco y Navarra tienen sus propias normas. No sustituye el consejo de un
          asesor fiscal.
        </p>
      </section>
    </div>
  );
}
