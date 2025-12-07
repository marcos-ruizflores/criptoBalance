import { useEffect, useMemo, useState } from "react";

const TOKENS = [
  { symbol: "BTC", name: "Bitcoin", price: 42000, change24h: 2.4, balance: "0.25" },
  { symbol: "ETH", name: "Ethereum", price: 2300, change24h: 1.1, balance: "2.8" },
  { symbol: "USDT", name: "Tether", price: 1, change24h: 0.0, balance: "900.00" },
  { symbol: "ADA", name: "Cardano", price: 0.42, change24h: -1.8, balance: "1500" },
];

const fmt = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : "-");

export default function CryptoSwap() {
  const [fromToken, setFromToken] = useState(TOKENS[0]);
  const [toToken, setToToken] = useState(TOKENS[2]);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [status, setStatus] = useState("idle"); // idle | swapping | success
  const [showSelector, setShowSelector] = useState(null); // "from" | "to" | null

  useEffect(() => {
    const val = Number(fromAmount);
    if (!fromAmount || isNaN(val)) {
      setToAmount("");
      return;
    }
    const usd = val * fromToken.price;
    const dest = usd / toToken.price;
    setToAmount(dest.toFixed(6));
  }, [fromAmount, fromToken, toToken]);

  const rate = useMemo(() => toToken.price && fromToken.price
    ? (toToken.price / fromToken.price).toFixed(6)
    : "-"
  , [fromToken.price, toToken.price]);

  const doSwap = () => {
    const val = Number(fromAmount);
    if (!fromAmount || isNaN(val) || val <= 0) return;
    setStatus("swapping");
    setTimeout(() => {
      setStatus("success");
      setFromAmount("");
      setToAmount("");
      setTimeout(() => setStatus("idle"), 1400);
    }, 1200);
  };

  const renderSelector = (which) => (
    showSelector === which && (
      <div className="swap-selector">
        {TOKENS.map((t) => (
          <button
            key={t.symbol}
            className="swap-token-row"
            onClick={() => {
              which === "from" ? setFromToken(t) : setToToken(t);
              setShowSelector(null);
            }}
          >
            <div>
              <strong>{t.symbol}</strong>
              <span className="muted small">{t.name}</span>
            </div>
            <div className={t.change24h >= 0 ? "pos small" : "neg small"}>
              {t.change24h >= 0 ? "+" : ""}{t.change24h}%
            </div>
          </button>
        ))}
      </div>
    )
  );

  return (
    <div className="swap-card glass">
      <div className="card-header">
        <div>
          <p className="eyebrow">Swap rápido</p>
          <h3>Intercambia tokens</h3>
        </div>
        <span className="pill">Demo</span>
      </div>

      <div className="swap-row">
        <div className="swap-field">
          <div className="swap-label">
            <span>De</span>
            <span className="muted small">Balance: {fromToken.balance}</span>
          </div>
          <div className="swap-control">
            <button className="swap-chip" onClick={() => setShowSelector(showSelector === "from" ? null : "from")}>
              {fromToken.symbol} ⌄
            </button>
            <input
              type="number"
              placeholder="0.0"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
            />
          </div>
          <div className="swap-meta">
            <span className="muted small">${fmt(fromToken.price)}</span>
            <span className="muted small">
              ≈ ${fmt((Number(fromAmount) || 0) * fromToken.price)}
            </span>
          </div>
          {renderSelector("from")}
        </div>

        <div className="swap-arrow">⇅</div>

        <div className="swap-field">
          <div className="swap-label">
            <span>A</span>
            <span className="muted small">Balance: {toToken.balance}</span>
          </div>
          <div className="swap-control">
            <button className="swap-chip" onClick={() => setShowSelector(showSelector === "to" ? null : "to")}>
              {toToken.symbol} ⌄
            </button>
            <div className="swap-output">{toAmount || "0.0"}</div>
          </div>
          <div className="swap-meta">
            <span className="muted small">${fmt(toToken.price)}</span>
            <span className="muted small">
              ≈ ${fmt((Number(toAmount) || 0) * toToken.price)}
            </span>
          </div>
          {renderSelector("to")}
        </div>
      </div>

      <div className="swap-info">
        <div>
          <p className="muted small">Slippage</p>
          <div className="swap-slippage">
            {[0.1, 0.5, 1].map((v) => (
              <button
                key={v}
                className={slippage === v ? "chip active" : "chip"}
                onClick={() => setSlippage(v)}
              >
                {v}%
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="muted small">Rate</p>
          <strong>1 {fromToken.symbol} = {rate} {toToken.symbol}</strong>
        </div>
      </div>

      <button
        className={`primary swap-btn ${status === "swapping" ? "loading" : ""}`}
        onClick={doSwap}
        disabled={status === "swapping" || !fromAmount || Number(fromAmount) <= 0}
      >
        {status === "swapping" ? "Haciendo swap..." : status === "success" ? "Swap completado" : "Intercambiar"}
      </button>
    </div>
  );
}
