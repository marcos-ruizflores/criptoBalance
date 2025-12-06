import { useEffect, useState } from "react";
import { createTrade, deleteTradeById, fetchPortfolio, fetchTrades, fetchHistory } from "./api";
import TradeForm from "./components/TradeForm";
import TradesTable from "./components/TradesTable";
import PortfolioGrid from "./components/PortfolioGrid";
import HistoryChart from "./components/HistoryChart";

const FIAT = "EUR";

export default function App() {
  const [trades, setTrades] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyAsset, setHistoryAsset] = useState("BTC");
  const [historyQuote, setHistoryQuote] = useState(FIAT);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [view, setView] = useState("dashboard");

  const loadData = async () => {
    try {
      const [t, p] = await Promise.all([fetchTrades(), fetchPortfolio()]);
      setTrades(t);
      setPortfolio(p);
    } catch (err) {
      console.error(err);
      setToast(err.message);
    }
  };

  useEffect(() => {
    loadData();
    loadHistory("BTC");
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
            <PortfolioGrid items={portfolio} fiatCurrency={FIAT} onRefresh={loadData} />
          </div>
        </div>
      )}

      {view === "trades" && (
        <TradesTable trades={trades} onDelete={handleDelete} fiatCurrency={FIAT} onRefresh={loadData} />
      )}

      {view === "history" && (
        <HistoryChart data={history} baseAsset={historyAsset} quote={historyQuote} onRefresh={loadHistory} />
      )}
    </div>
  );
}
