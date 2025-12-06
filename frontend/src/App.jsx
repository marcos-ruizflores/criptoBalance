import { useEffect, useRef, useState } from "react";
import {
  createTrade,
  deleteTradeById,
  fetchPortfolio,
  fetchTrades,
  fetchHistory,
  exportTrades,
  importTrades,
  fetchSnapshots,
  createSnapshot,
  deleteSnapshot,
  fetchAlerts,
  createAlert,
  deleteAlertById,
  evaluateAlerts,
} from "./api";
import TradeForm from "./components/TradeForm";
import TradesTable from "./components/TradesTable";
import PortfolioGrid from "./components/PortfolioGrid";
import HistoryChart from "./components/HistoryChart";
import MyCryptosChart from "./components/MyCryptosChart";

const FIAT = "EUR";

export default function App() {
  const [trades, setTrades] = useState([]);
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [portfolioTotals, setPortfolioTotals] = useState({});
  const [topGainers, setTopGainers] = useState([]);
  const [topLosers, setTopLosers] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyAsset, setHistoryAsset] = useState("BTC");
  const [historyQuote, setHistoryQuote] = useState(FIAT);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [triggered, setTriggered] = useState([]);
  const [newAlert, setNewAlert] = useState({
    base_asset: "BTC",
    kind: "price",
    direction: "above",
    threshold: "",
  });
  const [toast, setToast] = useState("");
  const [view, setView] = useState("dashboard");
  const [tradeFilter, setTradeFilter] = useState("all");
  const fileInputRef = useRef(null);

  const loadData = async () => {
    try {
      const [t, p] = await Promise.all([fetchTrades(), fetchPortfolio()]);
      setTrades(t);
      setPortfolioItems(p.items || []);
      setPortfolioTotals(p.totals || {});
      setTopGainers(p.top_gainers || []);
      setTopLosers(p.top_losers || []);
    } catch (err) {
      console.error(err);
      setToast(err.message);
    }
  };

  const loadSnapshots = async () => {
    try {
      const s = await fetchSnapshots();
      setSnapshots(s);
    } catch (err) {
      setToast(err.message);
    }
  };

  const loadAlerts = async () => {
    try {
      const a = await fetchAlerts();
      setAlerts(a);
    } catch (err) {
      setToast(err.message);
    }
  };

  useEffect(() => {
    loadData();
    loadHistory("BTC");
    loadSnapshots();
    loadAlerts();
  }, []);

  const loadHistory = async (asset) => {
    try {
      setHistoryAsset(asset);
      const data = await fetchHistory(asset);
      setHistory(data);
      if (data && data.length) {
        setHistoryQuote(data[0].quote_asset || FIAT);
      }
    } catch (err) {
      setToast(err.message);
    }
  };

  const handleCreate = async (payload) => {
    try {
      setLoading(true);
      await createTrade(payload);
      setToast("Operación guardada");
      await loadData();
    } catch (err) {
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta operación?")) return;
    try {
      await deleteTradeById(id);
      setToast("Operación eliminada");
      await loadData();
    } catch (err) {
      setToast(err.message);
    }
  };

  const handleSnapshot = async () => {
    try {
      await createSnapshot();
      setToast("Snapshot guardado");
      await loadSnapshots();
    } catch (err) {
      setToast(err.message);
    }
  };

  const handleDeleteSnapshot = async (id) => {
    try {
      await deleteSnapshot(id);
      setToast("Snapshot eliminado");
      await loadSnapshots();
    } catch (err) {
      setToast(err.message);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportTrades();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "trades.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setToast(err.message);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImporting(true);
      const res = await importTrades(file);
      setToast(`Importadas ${res.imported} operaciones`);
      await loadData();
    } catch (err) {
      setToast(err.message);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    try {
      await createAlert({ ...newAlert, threshold: Number(newAlert.threshold) });
      setToast("Alerta creada");
      await loadAlerts();
    } catch (err) {
      setToast(err.message);
    }
  };

  const handleDeleteAlert = async (id) => {
    await deleteAlertById(id);
    await loadAlerts();
  };

  const handleEvaluateAlerts = async () => {
    try {
      const res = await evaluateAlerts();
      setTriggered(res.triggered || []);
      setToast(res.triggered?.length ? "Alertas activadas" : "Sin alertas disparadas");
    } catch (err) {
      setToast(err.message);
    }
  };

  return (
    <div className="app">
      <header className="hero">
        <div>
          <h1 className="title">CriptoBalance</h1>
          <p className="subtitle">Registra compras en fiat y visualiza tu PnL en vivo.</p>
        </div>
        <nav className="nav">
          <button className={view === "dashboard" ? "nav-btn active" : "nav-btn"} onClick={() => setView("dashboard")}>
            Panel
          </button>
          <button className={view === "trades" ? "nav-btn active" : "nav-btn"} onClick={() => setView("trades")}>
            Operaciones
          </button>
          <button className={view === "history" ? "nav-btn active" : "nav-btn"} onClick={() => setView("history")}>
            Gráfico
          </button>
          <button className={view === "alerts" ? "nav-btn active" : "nav-btn"} onClick={() => setView("alerts")}>
            Alertas
          </button>
          <button className={view === "mycryptos" ? "nav-btn active" : "nav-btn"} onClick={() => setView("mycryptos")}>
            MyCriptos
          </button>
        </nav>
        {toast && (
          <div className="pill" role="status">
            {toast}
          </div>
        )}
      </header>

      {view === "dashboard" && (
        <div className="layout">
          <div>
            <TradeForm onSubmit={handleCreate} fiatCurrency={FIAT} loading={loading} />
            <PortfolioGrid items={portfolioItems} totals={portfolioTotals} fiatCurrency={FIAT} onRefresh={loadData} />
            <div className="grid two">
              <div className="card glass">
                <div className="card-header">
                  <div>
                    <p className="eyebrow">Ganadores</p>
                    <h3>Top 3</h3>
                  </div>
                </div>
                {topGainers.map((g) => (
                  <div key={g.symbol} className="metric">
                    <strong>{g.base_asset}</strong>
                    <span className={g.pnl_fiat >= 0 ? "pos" : "neg"}>
                      {g.pnl_fiat.toFixed(2)} {FIAT} ({g.pnl_pct.toFixed(2)}%)
                    </span>
                  </div>
                ))}
                {!topGainers.length && <p className="muted">Sin datos</p>}
              </div>
              <div className="card glass">
                <div className="card-header">
                  <div>
                    <p className="eyebrow">Perdedores</p>
                    <h3>Top 3</h3>
                  </div>
                </div>
                {topLosers.map((g) => (
                  <div key={g.symbol} className="metric">
                    <strong>{g.base_asset}</strong>
                    <span className={g.pnl_fiat >= 0 ? "pos" : "neg"}>
                      {g.pnl_fiat.toFixed(2)} {FIAT} ({g.pnl_pct.toFixed(2)}%)
                    </span>
                  </div>
                ))}
                {!topLosers.length && <p className="muted">Sin datos</p>}
              </div>
            </div>
            <div className="card glass">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Snapshots</p>
                  <h3>Valor diario</h3>
                </div>
                <button className="ghost" onClick={handleSnapshot}>
                  Guardar snapshot
                </button>
              </div>
              {snapshots.map((s) => (
                <div key={s._id} className="snapshot-row">
                  <div>
                    <strong>{new Date(s.timestamp).toLocaleString()}</strong>
                    <span className="muted small">
                      Total: {s.totals?.total_value_fiat?.toFixed(2)} {FIAT} | PnL: {s.totals?.total_pnl_fiat?.toFixed(2)} {FIAT}
                    </span>
                  </div>
                  <button className="ghost" onClick={() => handleDeleteSnapshot(s._id)}>🗑️</button>
                </div>
              ))}
              {!snapshots.length && <p className="muted">Sin snapshots aún.</p>}
            </div>
          </div>
        </div>
      )}

      {view === "trades" && (
        <>
          <div className="card glass">
            <div className="card-header">
              <div>
                <p className="eyebrow">CSV</p>
                <h3>Importar / Exportar</h3>
              </div>
              <div className="actions">
                <button className="ghost" onClick={handleExport}>Exportar CSV</button>
                <button className="primary" onClick={handleImportClick} disabled={importing}>
                  {importing ? "Importando..." : "Importar CSV"}
                </button>
              </div>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              ref={fileInputRef}
              onChange={handleImport}
            />
            <p className="muted">
              Usa columnas: base_symbol, quantity, price_fiat, total_cost_fiat, side (BUY/SELL), timestamp (ISO, opcional).
            </p>
          </div>
          <TradesTable
            trades={trades}
            filter={tradeFilter}
            onFilterChange={setTradeFilter}
            onDelete={handleDelete}
            fiatCurrency={FIAT}
            onRefresh={loadData}
          />
        </>
      )}

      {view === "history" && (
        <HistoryChart data={history} baseAsset={historyAsset} quote={historyQuote} onRefresh={loadHistory} />
      )}

      {view === "mycryptos" && (
        <div className="layout">
          <div className="card glass">
            <div className="card-header">
              <div>
                <p className="eyebrow">Distribución</p>
                <h3>MyCriptos</h3>
              </div>
            </div>
            <MyCryptosChart items={portfolioItems} fiatCurrency={FIAT} />
          </div>
        </div>
      )}

      {view === "alerts" && (
        <div className="layout">
          <div className="card glass">
            <div className="card-header">
              <div>
                <p className="eyebrow">Alertas</p>
                <h3>Crear alerta</h3>
              </div>
              <button className="ghost" onClick={handleEvaluateAlerts}>Evaluar ahora</button>
            </div>
            <form className="form-grid" onSubmit={handleCreateAlert}>
              <label className="field">
                <span>Activo</span>
                <input value={newAlert.base_asset} onChange={(e) => setNewAlert((a) => ({ ...a, base_asset: e.target.value.toUpperCase() }))} />
              </label>
              <label className="field">
                <span>Tipo</span>
                <select value={newAlert.kind} onChange={(e) => setNewAlert((a) => ({ ...a, kind: e.target.value }))}>
                  <option value="price">Precio</option>
                  <option value="pnl_pct">PnL %</option>
                </select>
              </label>
              <label className="field">
                <span>Dirección</span>
                <select value={newAlert.direction} onChange={(e) => setNewAlert((a) => ({ ...a, direction: e.target.value }))}>
                  <option value="above">Mayor o igual que</option>
                  <option value="below">Menor o igual que</option>
                </select>
              </label>
              <label className="field">
                <span>Umbral</span>
                <input type="number" step="any" value={newAlert.threshold} onChange={(e) => setNewAlert((a) => ({ ...a, threshold: e.target.value }))} />
              </label>
              <div className="actions">
                <button className="primary" type="submit">Guardar alerta</button>
              </div>
            </form>
          </div>
          <div className="card glass">
            <div className="card-header">
              <div>
                <p className="eyebrow">Activas</p>
                <h3>{alerts.length} alertas</h3>
              </div>
            </div>
            {alerts.map((a) => (
              <div key={a._id} className="metric">
                <div><strong>{a.base_asset}</strong> · {a.kind} {a.direction} {a.threshold}</div>
                <button className="ghost" onClick={() => handleDeleteAlert(a._id)}>🗑️</button>
              </div>
            ))}
            {!alerts.length && <p className="muted">No hay alertas.</p>}
          </div>
          <div className="card glass">
            <div className="card-header">
              <div>
                <p className="eyebrow">Últimas activadas</p>
                <h3>{triggered.length}</h3>
              </div>
            </div>
            {triggered.map((t) => (
              <div key={t._id} className="metric">
                <strong>{t.base_asset}</strong>
                <span>{t.kind} {t.direction} {t.threshold} | valor {t.current_value?.toFixed?.(4) ?? t.current_value}</span>
              </div>
            ))}
            {!triggered.length && <p className="muted">Aún sin disparar.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
