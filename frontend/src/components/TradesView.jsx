import { useMemo, useRef, useState } from "react";
import { dateTime, money, pct, price, qty, signedMoney, tone } from "../format";
import { Asset, Empty, Icon, Segmented } from "./ui";

export default function TradesView({ trades, onDelete, onExport, onImport, importing }) {
  const [side, setSide] = useState("all");
  const [search, setSearch] = useState("");
  const fileRef = useRef(null);

  const rows = useMemo(() => {
    const q = search.trim().toUpperCase();
    return [...trades]
      .filter((t) => side === "all" || t.side === side)
      .filter((t) => !q || (t.base_asset || "").toUpperCase().includes(q))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [trades, side, search]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await onImport(file);
  };

  return (
    <section className="card">
      <div className="card-head">
        <div className="row">
          <Segmented
            label="Filtrar por tipo"
            value={side}
            onChange={setSide}
            options={[
              { value: "all", label: "Todas" },
              { value: "BUY", label: "Compras" },
              { value: "SELL", label: "Ventas" },
            ]}
          />
          <input
            className="input input-sm"
            type="search"
            placeholder="Buscar activo"
            aria-label="Buscar activo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="row">
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Icon name="upload" size={14} /> {importing ? "Importando…" : "Importar CSV"}
          </button>
          <button className="btn" onClick={onExport} disabled={!trades.length}>
            <Icon name="download" size={14} /> Exportar
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleFile} />
        </div>
      </div>

      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Activo</th>
                <th>Tipo</th>
                <th className="num">Cantidad</th>
                <th className="num">Precio</th>
                <th className="num">Total</th>
                <th className="num">Precio actual</th>
                <th className="num">Resultado</th>
                <th className="cell-actions">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t._id}>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>
                    {dateTime(t.timestamp)}
                  </td>
                  <td>
                    <Asset symbol={t.base_asset} />
                  </td>
                  <td>
                    <span className={`badge ${t.side === "BUY" ? "pos" : "neg"}`}>{t.side === "BUY" ? "Compra" : "Venta"}</span>
                  </td>
                  <td className="num">{qty(t.quantity)}</td>
                  <td className="num">{price(t.price_fiat)}</td>
                  <td className="num">{money(t.total_cost_fiat)}</td>
                  <td className="num muted">{price(t.current_price_fiat)}</td>
                  <td className={`num ${tone(t.pnl_fiat)}`}>
                    {signedMoney(t.pnl_fiat)}
                    <span className="small" style={{ display: "block" }}>
                      {pct(t.pnl_pct)}
                    </span>
                  </td>
                  <td className="cell-actions">
                    <button className="btn btn-icon" aria-label={`Eliminar operación de ${t.base_asset}`} onClick={() => onDelete(t._id)}>
                      <Icon name="trash" size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : trades.length ? (
        <Empty title="Nada coincide con el filtro">Prueba con otro activo o tipo.</Empty>
      ) : (
        <Empty title="Sin operaciones">
          Añade una desde «Nueva operación» o importa un CSV con las columnas
          <br />
          <code className="small">base_symbol, quantity, price_fiat, total_cost_fiat, side, timestamp</code>
        </Empty>
      )}
    </section>
  );
}
