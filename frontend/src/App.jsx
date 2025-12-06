import { useEffect, useState } from "react";
import { createTrade, deleteTradeById, fetchPortfolio, fetchTrades } from "./api";
import TradeForm from "./components/TradeForm";
import TradesTable from "./components/TradesTable";
import PortfolioGrid from "./components/PortfolioGrid";

const FIAT = "EUR";

export default function App() {
  const [trades, setTrades] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

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
  }, []);

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
        {toast && (
          <div className="pill" role="status">
            {toast}
          </div>
        )}
      </header>

      <div className="layout">
        <div>
          <TradeForm onSubmit={handleCreate} fiatCurrency={FIAT} loading={loading} />
          <PortfolioGrid items={portfolio} fiatCurrency={FIAT} />
        </div>
        <TradesTable trades={trades} onDelete={handleDelete} fiatCurrency={FIAT} />
      </div>
    </div>
  );
}
