import { useCallback, useEffect, useState } from "react";
import { createAlert, deleteAlertById, evaluateAlerts, fetchAlerts } from "../api";
import { dateTime, pct, price } from "../format";
import { Asset, Empty, Icon, Segmented } from "./ui";

const EMPTY = { base_asset: "BTC", kind: "price", direction: "above", threshold: "" };

// "BTC sube de 70.000 €" reads better than "price above 70000"
function describe(a) {
  const verb = a.direction === "above" ? "sube de" : "baja de";
  const value = a.kind === "price" ? price(a.threshold) : pct(a.threshold, { signed: false });
  return `${a.kind === "price" ? "Precio" : "Ganancia"} ${verb} ${value}`;
}

export default function AlertsView({ onToast }) {
  const [alerts, setAlerts] = useState([]);
  const [triggered, setTriggered] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    try {
      setAlerts(await fetchAlerts());
    } catch {
      onToast("No se pudieron cargar las alertas.");
    }
  }, [onToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createAlert({ ...form, base_asset: form.base_asset.trim().toUpperCase(), threshold: Number(form.threshold) });
      setForm((f) => ({ ...f, threshold: "" }));
      onToast("Alerta creada");
      load();
    } catch {
      onToast("No se pudo crear la alerta.");
    }
  };

  const handleDelete = async (id) => {
    await deleteAlertById(id);
    load();
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await evaluateAlerts();
      setTriggered(res.triggered || []);
      const n = res.triggered?.length || 0;
      onToast(n === 0 ? "Ninguna alerta se cumple ahora mismo" : n === 1 ? "Se ha cumplido 1 alerta" : `Se han cumplido ${n} alertas`);
      load();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="split">
      <div className="stack">
        <section className="card">
          <div className="card-head">
            <h2>Alertas activas</h2>
            <button className="btn" onClick={handleCheck} disabled={checking || !alerts.length}>
              <Icon name="refresh" size={14} /> {checking ? "Comprobando…" : "Comprobar ahora"}
            </button>
          </div>
          {alerts.length ? (
            <ul className="list">
              {alerts.map((a) => (
                <li key={a._id}>
                  <div className="row" style={{ gap: 14 }}>
                    <Asset symbol={a.base_asset} />
                    <span>{describe(a)}</span>
                  </div>
                  <div className="row">
                    {a.last_triggered_at && <span className="muted small">Última vez: {dateTime(a.last_triggered_at)}</span>}
                    <button className="btn btn-icon" aria-label="Eliminar alerta" onClick={() => handleDelete(a._id)}>
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No tienes alertas">Crea una para saber cuándo un precio cruza el valor que te interesa.</Empty>
          )}
        </section>

        {triggered && (
          <section className="card">
            <div className="card-head">
              <h2>Resultado de la comprobación</h2>
            </div>
            {triggered.length ? (
              <ul className="list">
                {triggered.map((t) => (
                  <li key={t._id}>
                    <div className="row" style={{ gap: 14 }}>
                      <Asset symbol={t.base_asset} />
                      <span>{describe(t)}</span>
                    </div>
                    <span className="badge pos">Ahora: {t.kind === "price" ? price(t.current_value) : pct(t.current_value)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="Ninguna se cumple">Volverán a comprobarse cuando pulses el botón otra vez.</Empty>
            )}
          </section>
        )}
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Nueva alerta</h2>
        </div>
        <form className="card-body stack" onSubmit={handleCreate}>
          <label className="field">
            <span>Activo</span>
            <input className="input" value={form.base_asset} onChange={(e) => setForm((f) => ({ ...f, base_asset: e.target.value.toUpperCase() }))} required />
          </label>
          <div className="field">
            <span>Avisar cuando</span>
            <Segmented
              label="Tipo de alerta"
              value={form.kind}
              onChange={(kind) => setForm((f) => ({ ...f, kind }))}
              options={[
                { value: "price", label: "Precio" },
                { value: "pnl_pct", label: "Ganancia %" },
              ]}
            />
          </div>
          <div className="field">
            <span>Condición</span>
            <Segmented
              label="Dirección"
              value={form.direction}
              onChange={(direction) => setForm((f) => ({ ...f, direction }))}
              options={[
                { value: "above", label: "Sube de" },
                { value: "below", label: "Baja de" },
              ]}
            />
          </div>
          <label className="field">
            <span>{form.kind === "price" ? "Precio (EUR)" : "Porcentaje"}</span>
            <input
              className="input"
              type="number"
              step="any"
              inputMode="decimal"
              value={form.threshold}
              onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
              required
            />
          </label>
          <button className="btn btn-primary" type="submit">
            <Icon name="bell" size={14} /> Crear alerta
          </button>
        </form>
      </section>
    </div>
  );
}
