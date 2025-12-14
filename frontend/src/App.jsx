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
  fetchTopMarketCaps,
} from "./api";
import TradeForm from "./components/TradeForm";
import TradesTable from "./components/TradesTable";
import PortfolioGrid from "./components/PortfolioGrid";
import HistoryChart from "./components/HistoryChart";
import MyCryptosChart from "./components/MyCryptosChart";
import ChatbotPanel from "./components/ChatbotPanel";
import TaxCalculator from "./components/TaxCalculator";
import CryptoSwap from "./components/CryptoSwap";
import AuthForm from "./components/AuthForm";

const FIAT = "EUR";
const HISTORY_PRESETS = {
  "24h": { interval: "1h", limit: 24 },
  "1w": { interval: "1h", limit: 168 },
  "1m": { interval: "4h", limit: 180 },
  "3m": { interval: "1d", limit: 90 },
  "1y": { interval: "1w", limit: 52 },
};

export default function App() {
  const [mode, setMode] = useState("auth"); // auth primero, luego landing | cripto | tax | market | bot
  const [trades, setTrades] = useState([]);
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [portfolioTotals, setPortfolioTotals] = useState({});
  const [topGainers, setTopGainers] = useState([]);
  const [topLosers, setTopLosers] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyAsset, setHistoryAsset] = useState("BTC");
  const [historyQuote, setHistoryQuote] = useState(FIAT);
  const [historyRange, setHistoryRange] = useState("3m");
  const [topMarket, setTopMarket] = useState([]);
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
  const [tradeSymbol, setTradeSymbol] = useState("");
  const [user, setUser] = useState(null);
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
    if (!user) return;
    if (mode !== "cripto") return;
    loadData();
    loadHistory("BTC", historyRange);
    loadSnapshots();
    loadAlerts();
    loadTopMarket();
  }, [mode, user]);

  useEffect(() => {
    if (!user && mode !== "auth") {
      setMode("auth");
    }
  }, [mode, user]);

  const loadHistory = async (asset, range = historyRange) => {
    try {
      setHistoryAsset(asset);
      const preset = HISTORY_PRESETS[range] || HISTORY_PRESETS["3m"];
      const data = await fetchHistory(asset, preset.interval, preset.limit);
      setHistory(data);
      if (data && data.length) {
        setHistoryQuote(data[0].quote_asset || FIAT);
      }
      setHistoryRange(range);
    } catch (err) {
      setToast(err.message);
    }
  };

  const loadTopMarket = async () => {
    try {
      const data = await fetchTopMarketCaps(15);
      setTopMarket(data);
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

  const handleEnterCripto = () => {
    setMode("cripto");
    setView("dashboard");
  };

  const handleEnterTax = () => {
    setMode("tax");
  };

  const handleEnterMarket = () => {
    setMode("market");
  };

  const handleEnterBot = () => {
    setMode("bot");
  };

  const handleEnterAuth = () => {
    setMode("auth");
  };

  const currentTitle =
    mode === "cripto"
      ? "CriptoBalance"
      : mode === "tax"
      ? "IRPF Rápido"
      : mode === "market"
      ? "Mercado bursátil"
      : mode === "bot"
      ? "Bot de Trading"
      : mode === "auth"
      ? "Acceso"
      : "FinanzasBalance";

  const currentSubtitle =
    mode === "cripto"
      ? "Registra compras en fiat y visualiza tu PnL en vivo."
      : mode === "tax"
      ? "Calcula un IRPF estimado con tus datos básicos."
      : mode === "market"
      ? "Próximamente: seguimiento de acciones y mercados tradicionales."
      : mode === "bot"
      ? "Próximamente: configura y lanza tu bot de trading automatizado."
      : mode === "auth"
      ? "Inicia sesión o crea tu cuenta para guardar tus datos."
      : "Elige qué quieres gestionar hoy.";

  if (mode === "auth") {
    return (
      <div className="auth-page">
        <AuthForm
          onSuccess={(res) => {
            setUser(res?.user || null);
            setMode("landing");
          }}
        />
      </div>
    );
  }

  if (mode === "landing") {
    return (
      <div className="app landing">
        <header className="hero">
          <div>
            <p className="eyebrow">Bienvenido</p>
            <h1 className="title">FinanzasBalance</h1>
            <p className="subtitle">Elige qué quieres gestionar hoy.</p>
          </div>
        </header>
        <div className="landing-grid">
          <div className="option-card glass" onClick={handleEnterCripto}>
            <p className="eyebrow">Portfolio</p>
            <h2>CriptoBalance</h2>
            <p className="muted">
              Registra compras/ventas, ve tu PnL, histórico de precios y alertas de mercado.
            </p>
            <button className="primary">Entrar</button>
          </div>
          <div className="option-card glass" onClick={handleEnterTax}>
            <p className="eyebrow">Fiscalidad</p>
            <h2>Calcula tus impuestos</h2>
            <p className="muted">
              Próximamente: simulador completo de IRPF. De momento, prueba un cálculo rápido.
            </p>
            <button className="ghost">Calcular IRPF</button>
          </div>
          <div className="option-card glass" onClick={handleEnterMarket}>
            <p className="eyebrow">Mercado</p>
            <h2>Bolsa (próximamente)</h2>
            <p className="muted">
              Seguimiento de acciones y mercados tradicionales en desarrollo. Vuelve pronto.
            </p>
            <button className="ghost">Ver avances</button>
          </div>
          <div className="option-card glass" onClick={handleEnterBot}>
            <p className="eyebrow">Automatización</p>
            <h2>Bot de Trading</h2>
            <p className="muted">
              Configura estrategias y lanza un bot. Estará disponible en próximas versiones.
            </p>
            <button className="ghost">Próximamente</button>
          </div>
          {!user && (
            <div className="option-card glass" onClick={handleEnterAuth}>
              <p className="eyebrow">Acceso</p>
              <h2>Login / Signup</h2>
              <p className="muted">Guarda tus datos en tu cuenta y accede desde cualquier dispositivo.</p>
              <button className="primary">Acceder</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className={`app ${mode === "cripto" ? "has-chat" : ""}`}>
      <header className="hero">
        <div>
          <h1 className="title">{currentTitle}</h1>
          <p className="subtitle">{currentSubtitle}</p>
        </div>
        <div className="actions">
          {mode === "cripto" && (
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
          )}
          {user && <span className="pill">{user.email}</span>}
          <button className="ghost" onClick={() => setMode("landing")}>Volver a FinanzasBalance</button>
          {user && (
            <button className="ghost" onClick={() => { setUser(null); setMode("auth"); }}>
              Cerrar sesión
            </button>
          )}
        </div>
        {toast && (
          <div className="pill" role="status">
            {toast}
          </div>
        )}
      </header>

      {mode === "cripto" && view === "dashboard" && (
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

      {mode === "cripto" && view === "trades" && (
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
            symbolFilter={tradeSymbol}
            onFilterChange={setTradeFilter}
            onSymbolChange={setTradeSymbol}
            onDelete={handleDelete}
            fiatCurrency={FIAT}
            onRefresh={loadData}
          />
          <CryptoSwap />
        </>
      )}

      {view === "history" && (
        <div className="layout">
          <HistoryChart
            data={history}
            baseAsset={historyAsset}
            quote={historyQuote}
            range={historyRange}
            presets={HISTORY_PRESETS}
            onRefresh={loadHistory}
          />
          <div className="card glass">
            <div className="card-header">
              <div>
                <p className="eyebrow">Top mercado</p>
                <h3>15 mayores capitalizaciones</h3>
              </div>
              <button className="ghost" onClick={loadTopMarket}>Actualizar</button>
            </div>
            <div className="market-list">
              <div className="market-head">
                <span>#</span>
                <span>Cripto</span>
                <span>Precio</span>
                <span>24h</span>
                <span>Market Cap</span>
              </div>
              {topMarket.map((c, idx) => (
                <div key={c.symbol + idx} className="market-row">
                  <span>{idx + 1}</span>
                  <span><strong>{c.name}</strong> ({c.symbol})</span>
                  <span>{c.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {FIAT}</span>
                  <span className={c.change_24h >= 0 ? "pos" : "neg"}>
                    {c.change_24h.toFixed(2)}%
                  </span>
                  <span>{c.market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 })} {FIAT}</span>
                </div>
              ))}
              {!topMarket.length && <div className="table-empty">Sin datos.</div>}
            </div>
          </div>
        </div>
      )}

      {mode === "cripto" && view === "mycryptos" && (
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

      {mode === "tax" && (
        <div className="layout">
          <div className="card glass">
            <div className="card-header">
              <div>
                <p className="eyebrow">FinanzasBalance</p>
                <h3>Simulador IRPF (en progreso)</h3>
              </div>
              <span className="pill">Beta</span>
            </div>
            <p className="muted">
              Aquí podrás calcular tus impuestos con mayor detalle. Por ahora, usa la calculadora rápida para estimar tu IRPF.
            </p>
          </div>
          <TaxCalculator />
        </div>
      )}

      {mode === "auth" && (
        <div className="layout">
          <AuthForm onSuccess={(res) => setUser(res?.user || null)} />
          {user && (
            <div className="card glass">
              <p className="eyebrow">Sesión</p>
              <strong>{user.email}</strong>
              <p className="muted small">Tus datos se guardan en Atlas (colección users).</p>
              <button className="ghost" onClick={() => setUser(null)}>Cerrar sesión (local)</button>
            </div>
          )}
        </div>
      )}

      {mode === "market" && (
        <div className="layout">
          <div className="card glass">
            <div className="card-header">
              <div>
                <p className="eyebrow">Mercado bursátil</p>
                <h3>Próximamente</h3>
              </div>
              <span className="pill">En desarrollo</span>
            </div>
            <p className="muted">
              Añadiremos seguimiento de acciones, índices y watchlists personalizadas. Estate atento a las próximas versiones.
            </p>
          </div>
        </div>
      )}

      {mode === "bot" && (
        <div className="layout">
          <div className="card glass">
            <div className="card-header">
              <div>
                <p className="eyebrow">Bot de Trading</p>
                <h3>Próximamente</h3>
              </div>
              <span className="pill">En desarrollo</span>
            </div>
            <p className="muted">
              Aquí podrás definir estrategias, backtests y ejecutar bots automáticos. Lo incorporaremos en futuras iteraciones.
            </p>
          </div>
        </div>
      )}

      {mode === "cripto" && view === "alerts" && (
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
    {mode === "cripto" && <ChatbotPanel />}
    </>
  );
}
