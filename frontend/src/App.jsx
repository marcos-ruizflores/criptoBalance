import { useCallback, useEffect, useState } from "react";
import {
  createSnapshot,
  createTrade,
  deleteSnapshot,
  deleteTradeById,
  exportTrades,
  fetchPortfolio,
  fetchSnapshots,
  fetchTrades,
  importTrades,
  setSession,
} from "./api";
import AuthForm from "./components/AuthForm";
import Overview from "./components/Overview";
import TradesView from "./components/TradesView";
import MarketView from "./components/MarketView";
import AlertsView from "./components/AlertsView";
import TaxView from "./components/TaxView";
import TradeDialog from "./components/TradeDialog";
import ChatPanel from "./components/ChatPanel";
import { Icon, Toast } from "./components/ui";

const TABS = [
  { id: "overview", label: "Resumen" },
  { id: "trades", label: "Operaciones" },
  { id: "market", label: "Mercado" },
  { id: "alerts", label: "Alertas" },
  { id: "tax", label: "Renta" },
];

const HEADINGS = {
  overview: ["Resumen", "Lo que vale tu cartera ahora, con precios de Binance."],
  trades: ["Operaciones", "Todas tus compras y ventas."],
  market: ["Mercado", "Histórico de precios y las mayores criptomonedas."],
  alerts: ["Alertas", "Avisos cuando un precio o una ganancia cruza un valor."],
  tax: ["Renta", "Lo que tus ventas suponen en la declaración, calculado como Hacienda: por FIFO."],
};

const SESSION_KEY = "criptobalance:session";

// Only a session with a token counts; older saves held just the user
function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    return s?.token && s?.user ? s : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("criptobalance:user");
  } catch {}
}

export default function App() {
  const [session, setSessionState] = useState(readSession);
  const [notice, setNotice] = useState("");

  const handleLogout = useCallback((message = "") => {
    saveSession(null);
    setSession(null);
    setNotice(message);
    setSessionState(null);
  }, []);

  // The API client needs the token before the dashboard makes its first request
  setSession(session?.token || null, () => handleLogout("Tu sesión ha caducado. Vuelve a entrar."));

  const handleLogin = (res) => {
    const next = res?.token ? { user: res.user, token: res.token } : null;
    saveSession(next);
    setNotice("");
    setSessionState(next);
  };

  if (!session) return <AuthForm onSuccess={handleLogin} notice={notice} />;
  return <Dashboard user={session.user} onLogout={() => handleLogout()} />;
}

function Dashboard({ user, onLogout }) {
  const [tab, setTab] = useState("overview");
  const [portfolio, setPortfolio] = useState({ items: [], totals: {} });
  const [trades, setTrades] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [toast, setToast] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const clearToast = useCallback(() => setToast(""), []);
  const showToast = useCallback((msg) => setToast(msg), []);

  const loadData = useCallback(async () => {
    // Load both independently, so one failing call doesn't blank the whole page
    const [t, p] = await Promise.allSettled([fetchTrades(), fetchPortfolio()]);
    if (t.status === "fulfilled") setTrades(t.value);
    if (p.status === "fulfilled") setPortfolio(p.value);
    if (t.status === "rejected" && p.status === "rejected") {
      setToast("No se pudo conectar con el servidor.");
    } else if (t.status === "rejected" || p.status === "rejected") {
      setToast("Algunos datos no se han podido cargar. Prueba a actualizar en un momento.");
    }
  }, []);

  const loadSnapshots = useCallback(async () => {
    try {
      setSnapshots(await fetchSnapshots());
    } catch {
      /* snapshots are optional, the rest of the page still works */
    }
  }, []);

  useEffect(() => {
    loadData();
    loadSnapshots();
  }, [loadData, loadSnapshots]);

  const handleCreate = async (payload) => {
    setSaving(true);
    try {
      await createTrade(payload);
      setToast(payload.side === "BUY" ? "Compra guardada" : "Venta guardada");
      await loadData();
      return true;
    } catch {
      setToast("No se pudo guardar. Revisa que el símbolo exista en Binance.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta operación? No se puede deshacer.")) return;
    try {
      await deleteTradeById(id);
      setToast("Operación eliminada");
      await loadData();
    } catch {
      setToast("No se pudo eliminar.");
    }
  };

  const handleSnapshot = async () => {
    try {
      await createSnapshot();
      setToast("Snapshot guardado");
      await loadSnapshots();
    } catch {
      setToast("No se pudo guardar el snapshot.");
    }
  };

  const handleDeleteSnapshot = async (id) => {
    try {
      await deleteSnapshot(id);
      await loadSnapshots();
    } catch {
      setToast("No se pudo eliminar el snapshot.");
    }
  };

  const handleExport = async () => {
    try {
      const url = URL.createObjectURL(await exportTrades());
      const a = document.createElement("a");
      a.href = url;
      a.download = "criptobalance-operaciones.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast("No se pudo exportar.");
    }
  };

  const handleImport = async (file) => {
    setImporting(true);
    try {
      const res = await importTrades(file);
      setToast(`${res.imported} operaciones importadas`);
      await loadData();
    } catch {
      setToast("El CSV no tiene el formato esperado.");
    } finally {
      setImporting(false);
    }
  };

  const [title, subtitle] = HEADINGS[tab];
  const heldAssets = portfolio.items.map((i) => i.base_asset);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark">C</span>
            CriptoBalance
          </div>
          <nav className="tabs" role="tablist" aria-label="Secciones">
            {TABS.map((t) => (
              <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="user">
            <button className="btn btn-ghost chat-toggle" onClick={() => setChatOpen((o) => !o)} aria-expanded={chatOpen} aria-controls="chat-panel">
              <Icon name="chat" size={15} /> Asistente
            </button>
            <span className="user-email">{user.demo ? "Cuenta de ejemplo" : user.email}</span>
            <button className="btn btn-ghost" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
              <Icon name="logout" size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className={`page ${chatOpen ? "with-chat" : ""}`}>
        {user.demo && (
          <p className="notice demo-banner">
            Estás en la <strong>cuenta de ejemplo</strong>: cartera ficticia con precios reales de Binance. Puedes probarlo todo, los
            cambios se borran cada hora. <button className="link" onClick={onLogout}>Crear mi cuenta</button>
          </p>
        )}
        <div className="page-head">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {(tab === "overview" || tab === "trades") && (
            <div className="row">
              <button className="btn btn-ghost" onClick={loadData}>
                <Icon name="refresh" size={14} /> Actualizar precios
              </button>
              <button className="btn btn-primary" onClick={() => setDialogOpen(true)}>
                <Icon name="plus" size={14} /> Nueva operación
              </button>
            </div>
          )}
        </div>

        {tab === "overview" && (
          <Overview
            portfolio={portfolio}
            snapshots={snapshots}
            onNewTrade={() => setDialogOpen(true)}
            onSnapshot={handleSnapshot}
            onDeleteSnapshot={handleDeleteSnapshot}
          />
        )}
        {tab === "trades" && (
          <TradesView trades={trades} onDelete={handleDelete} onExport={handleExport} onImport={handleImport} importing={importing} />
        )}
        {tab === "market" && <MarketView heldAssets={heldAssets} onError={showToast} />}
        {tab === "alerts" && <AlertsView onToast={showToast} />}
        {tab === "tax" && <TaxView onToast={showToast} />}
      </main>

      {/* On phones the top bar scrolls sideways, so the assistant gets a floating button.
          It lives outside the header: backdrop-filter there would pin it to the bar. */}
      {!chatOpen && (
        <button className="btn chat-fab" onClick={() => setChatOpen(true)} aria-label="Abrir asistente">
          <Icon name="chat" size={20} />
        </button>
      )}
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onTradesSaved={(n) => {
          setToast(n === 1 ? "1 operación registrada" : `${n} operaciones registradas`);
          loadData();
        }}
      />
      <TradeDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSubmit={handleCreate} saving={saving} />
      <Toast message={toast} onDone={clearToast} />
    </>
  );
}
