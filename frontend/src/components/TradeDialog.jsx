import { useEffect, useRef, useState } from "react";
import { FIAT, money } from "../format";
import { Segmented } from "./ui";

const EMPTY = { side: "BUY", base_symbol: "", quantity: "", price_fiat: "", total_cost_fiat: "" };

// Modal form for a new buy or sell. Uses the native <dialog> so focus and Escape work for free.
export default function TradeDialog({ open, onClose, onSubmit, saving }) {
  const ref = useRef(null);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setForm(EMPTY);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: key === "base_symbol" ? e.target.value.toUpperCase() : e.target.value }));

  const estimated = Number(form.quantity) * Number(form.price_fiat);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await onSubmit({
      base_symbol: form.base_symbol.trim(),
      quantity: Number(form.quantity),
      price_fiat: Number(form.price_fiat),
      total_cost_fiat: form.total_cost_fiat ? Number(form.total_cost_fiat) : undefined,
      side: form.side,
    });
    if (ok) onClose();
  };

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="trade-title">
      <form onSubmit={handleSubmit}>
        <div className="dialog-head">
          <h2 id="trade-title">Nueva operación</h2>
        </div>
        <div className="dialog-body">
          <div className="form-grid">
            <div className="full">
              <Segmented
                label="Tipo de operación"
                value={form.side}
                onChange={(side) => setForm((f) => ({ ...f, side }))}
                options={[
                  { value: "BUY", label: "Compra" },
                  { value: "SELL", label: "Venta" },
                ]}
              />
            </div>
            <label className="field full">
              <span>Criptomoneda</span>
              <input className="input" placeholder="BTC" value={form.base_symbol} onChange={set("base_symbol")} required autoFocus />
            </label>
            <label className="field">
              <span>Cantidad</span>
              <input className="input" type="number" step="any" min="0" inputMode="decimal" value={form.quantity} onChange={set("quantity")} required />
            </label>
            <label className="field">
              <span>Precio por unidad ({FIAT})</span>
              <input className="input" type="number" step="any" min="0" inputMode="decimal" value={form.price_fiat} onChange={set("price_fiat")} required />
            </label>
            <label className="field full">
              <span>Total pagado ({FIAT}), opcional</span>
              <input
                className="input"
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                placeholder={estimated > 0 ? money(estimated) : "Cantidad × precio"}
                value={form.total_cost_fiat}
                onChange={set("total_cost_fiat")}
              />
              <span className="hint">Rellénalo si pagaste comisiones; si no, se calcula solo.</span>
            </label>
          </div>
        </div>
        <div className="dialog-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Guardando…" : "Guardar operación"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
