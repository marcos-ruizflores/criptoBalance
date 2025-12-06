import { useState } from "react";

export default function TradeForm({ onSubmit, fiatCurrency = "EUR", loading }) {
  const [form, setForm] = useState({
    base_symbol: "",
    quantity: "",
    price_fiat: "",
    total_cost_fiat: "",
    side: "BUY",
  });

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.base_symbol || !form.quantity || !form.price_fiat) return;
    onSubmit({
      base_symbol: form.base_symbol.trim(),
      quantity: Number(form.quantity),
      price_fiat: Number(form.price_fiat),
      total_cost_fiat: form.total_cost_fiat ? Number(form.total_cost_fiat) : undefined,
      side: form.side,
    });
  };

  return (
    <form className="card glass" onSubmit={handleSubmit}>
      <div className="card-header">
        <div>
          <p className="eyebrow">Registrar compra</p>
          <h3>Nuevo trade</h3>
        </div>
        <button type="submit" className="primary" disabled={loading}>
          {loading ? "Guardando..." : "Guardar"}
        </button>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Criptomoneda</span>
          <input
            placeholder="BTC, ADA..."
            value={form.base_symbol}
            onChange={(e) => update("base_symbol", e.target.value.toUpperCase())}
            required
          />
        </label>
        <label className="field">
          <span>Cantidad</span>
          <input
            type="number"
            step="any"
            min="0"
            value={form.quantity}
            onChange={(e) => update("quantity", e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Precio unitario ({fiatCurrency})</span>
          <input
            type="number"
            step="any"
            min="0"
            value={form.price_fiat}
            onChange={(e) => update("price_fiat", e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Coste total ({fiatCurrency})</span>
          <input
            type="number"
            step="any"
            min="0"
            value={form.total_cost_fiat}
            onChange={(e) => update("total_cost_fiat", e.target.value)}
            placeholder="Opcional"
          />
        </label>
        <label className="field">
          <span>Tipo</span>
          <select value={form.side} onChange={(e) => update("side", e.target.value)}>
            <option value="BUY">Compra</option>
            <option value="SELL">Venta</option>
          </select>
        </label>
      </div>
    </form>
  );
}
