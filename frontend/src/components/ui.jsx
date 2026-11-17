import { useEffect } from "react";
import { assetColor } from "../format";

// Small shared pieces: icons, asset label, toast, empty state, segmented control

const paths = {
  plus: "M12 5v14M5 12h14",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  download: "M12 4v12m0 0-5-5m5 5 5-5M5 20h14",
  upload: "M12 20V8m0 0-5 5m5-5 5 5M5 4h14",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2ZM10 20a2 2 0 0 0 4 0",
  chat: "M5 5h14v10H9l-4 4zM9 9h6M9 12h4",
  send: "M5 12h13M13 6l6 6-6 6",
  close: "M6 6l12 12M18 6 6 18",
  clip: "M20 11.5 12.2 19.3a5 5 0 0 1-7-7l8-8a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.7 1.7 0 0 1-2.4-2.4L15 7.3",
};

export function Icon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function Asset({ symbol, sub }) {
  return (
    <span className="asset">
      <span className="asset-icon" style={{ background: assetColor(symbol) }} aria-hidden="true">
        {symbol.slice(0, 3)}
      </span>
      <span>
        {symbol}
        {sub && <span className="muted small" style={{ display: "block", fontWeight: 400 }}>{sub}</span>}
      </span>
    </span>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDone, 3000);
    return () => clearTimeout(id);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
