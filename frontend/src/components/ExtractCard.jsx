import { useState } from "react";
import { createTrade } from "../api";

// Trades read from a screenshot, shown for review. Nothing is saved until "Registrar".

function flagText(flag) {
  const [kind, value] = flag.split(":");
  if (kind === "duplicate") return { text: "Ya tienes una operación igual", tone: "warn" };
  if (kind === "converted") return { text: `Convertido de ${value} a EUR, revisa el precio`, tone: "info" };
  if (kind === "unsupported") return { text: `Pagado en ${value}: pon el precio en EUR`, tone: "warn" };
  return null;
}

const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

function isComplete(r) {
  return r.asset.trim() && num(r.quantity) > 0 && num(r.price) > 0;
}

export function toRows(trades) {
  return trades.map((t, i) => ({
    id: i,
    asset: t.asset,
    side: t.side,
    quantity: t.quantity ?? "",
    price: t.price ?? "",
    total: t.total ?? "",
    date: t.date ?? "",
    flags: t.flags || [],
    // Duplicates and half-read rows start unticked, the user opts in
    include: !(t.flags || []).includes("duplicate") && !(t.flags || []).includes("incomplete"),
    status: "",
  }));
}

export default function ExtractCard({ rows, notes, onChange, onSaved }) {
  const [saving, setSaving] = useState(false);
  const done = rows.length > 0 && rows.every((r) => !r.include || r.status === "saved");
  const selected = rows.filter((r) => r.include && r.status !== "saved");
  const ready = selected.length > 0 && selected.every(isComplete);

  const edit = (id, key, value) =>
    onChange(
      rows.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, [key]: value };
        // Keep the total in step when the amount or the price changes
        if ((key === "quantity" || key === "price") && num(next.quantity) > 0 && num(next.price) > 0) {
          next.total = +(num(next.quantity) * num(next.price)).toFixed(2);
        }
        return next;
      })
    );

  const save = async () => {
    setSaving(true);
    let current = rows;
    let ok = 0;
    for (const r of selected) {
      let status = "saved";
      try {
        await createTrade({
          base_symbol: r.asset.trim().toUpperCase(),
          side: r.side,
          quantity: num(r.quantity),
          price_fiat: num(r.price),
          total_cost_fiat: num(r.total) > 0 ? num(r.total) : undefined,
          timestamp: r.date || undefined,
        });
        ok += 1;
      } catch {
        status = "failed";
      }
      current = current.map((x) => (x.id === r.id ? { ...x, status } : x));
      onChange(current);
    }
    setSaving(false);
    if (ok) onSaved(ok);
  };

  if (!rows.length) {
    return <p>{notes || "No he encontrado operaciones en la captura."}</p>;
  }

  return (
    <div className="extract">
      <p>
        He encontrado {rows.length === 1 ? "1 operación" : `${rows.length} operaciones`}. Revisa los datos antes de registrarlas.
      </p>
      {notes && <p className="muted small">{notes}</p>}

      <div className="extract-list">
        {rows.map((r) => {
          const locked = saving || r.status === "saved";
          return (
            <fieldset key={r.id} className={`extract-row ${r.include ? "" : "is-off"} ${r.status ? `is-${r.status}` : ""}`} disabled={locked}>
              <legend className="sr-only">Operación {r.id + 1}</legend>
              <div className="extract-top">
                <label className="extract-check">
                  <input type="checkbox" checked={r.include} onChange={(e) => edit(r.id, "include", e.target.checked)} />
                  <span className="sr-only">Incluir</span>
                </label>
                <select className="input input-sm" value={r.side} onChange={(e) => edit(r.id, "side", e.target.value)} aria-label="Tipo">
                  <option value="BUY">Compra</option>
                  <option value="SELL">Venta</option>
                </select>
                <input
                  className="input input-sm extract-asset"
                  value={r.asset}
                  onChange={(e) => edit(r.id, "asset", e.target.value.toUpperCase())}
                  aria-label="Criptomoneda"
                />
                {r.status === "saved" && <span className="badge pos">Guardada</span>}
                {r.status === "failed" && <span className="badge neg">Error</span>}
              </div>
              <div className="extract-grid">
                <label>
                  <span>Cantidad</span>
                  <input className="input input-sm" type="number" step="any" min="0" value={r.quantity} onChange={(e) => edit(r.id, "quantity", e.target.value)} />
                </label>
                <label>
                  <span>Precio €</span>
                  <input className="input input-sm" type="number" step="any" min="0" value={r.price} onChange={(e) => edit(r.id, "price", e.target.value)} />
                </label>
                <label>
                  <span>Total €</span>
                  <input className="input input-sm" type="number" step="any" min="0" value={r.total} onChange={(e) => edit(r.id, "total", e.target.value)} />
                </label>
                <label>
                  <span>Fecha</span>
                  <input className="input input-sm" type="datetime-local" value={r.date} onChange={(e) => edit(r.id, "date", e.target.value)} />
                </label>
              </div>
              {r.flags.map(flagText).filter(Boolean).map((f) => (
                <p key={f.text} className={`extract-flag ${f.tone}`}>
                  {f.text}
                </p>
              ))}
            </fieldset>
          );
        })}
      </div>

      {done ? (
        <p className="pos small">Listo. Ya aparecen en Operaciones.</p>
      ) : (
        <div className="extract-foot">
          <button className="btn btn-primary" onClick={save} disabled={!ready || saving}>
            {saving
              ? "Guardando…"
              : `Registrar ${selected.length === 1 ? "1 operación" : `${selected.length} operaciones`}`}
          </button>
          {selected.length > 0 && !ready && <span className="muted small">Completa cantidad y precio</span>}
        </div>
      )}
    </div>
  );
}
