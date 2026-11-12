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
} from "./api";
import AuthForm from "./components/AuthForm";
import Overview from "./components/Overview";
import TradesView from "./components/TradesView";
import MarketView from "./components/MarketView";
import AlertsView from "./components/AlertsView";
import TradeDialog from "./components/TradeDialog";
import { Icon, Toast } from "./components/ui";

const TABS = [
  { id: "overview", label: "Resumen" },
  { id: "trades", label: "Operaciones" },
  { id: "market", label: "Mercado" },
  { id: "alerts", label: "Alertas" },
];

const HEADINGS = {
  overview: ["Resumen", "Lo que vale tu cartera ahora, con precios de Binance."],
  trades: ["Operaciones", "Todas tus compras y ventas."],
  market: ["Mercado", "Histórico de precios y las mayores criptomonedas."],
  alerts: ["Alertas", "Avisos cuando un precio o una ganancia cruza un valor."],
};

const USER_KEY = "criptobalance:user";

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(readUser);

  const handleLogin = (res) => {
    const u = res?.user || null;
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    } catch {}
    setUser(u);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}
    setUser(null);
  };

  if (!user) return <AuthForm onSuccess={handleLogin} />;
  return <Dashboard user={user} onLogout={handleLogout} />;
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

  const clearToast = useCallback(() => setToast(""), []);
  const showToast = useCallback((msg) => setToast(msg), []);

  const loadData = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([fetchTrades(), fetchPortfolio()]);
      setTrades(t);
      setPortfolio(p);
    } catch {
      setToast("No se pudo conectar con el servidor.");
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
            <span className="user-email">{user.email}</span>
            <button className="btn btn-ghost" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
              <Icon name="logout" size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="page">
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
      </main>

      <TradeDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSubmit={handleCreate} saving={saving} />
      <Toast message={toast} onDone={clearToast} />
    </>
  );
}
