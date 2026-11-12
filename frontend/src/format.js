// Number and date formatting, all in Spanish locale

export const FIAT = "EUR";

const isNum = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

// useGrouping "always" so 2.611 € gets its dot like 77.228 € (Spanish skips it for 4 digits by default)
const moneyFmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: FIAT, useGrouping: "always" });

// Prices under 1 € need more decimals to mean anything
export function price(v) {
  if (!isNum(v)) return "—";
  const n = Number(v);
  const digits = Math.abs(n) < 1 ? 4 : 2;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: FIAT,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: "always",
  }).format(n);
}

export function money(v) {
  return isNum(v) ? moneyFmt.format(Number(v)) : "—";
}

export function signedMoney(v) {
  if (!isNum(v)) return "—";
  const n = Number(v);
  return `${n > 0 ? "+" : ""}${moneyFmt.format(n)}`;
}

export function pct(v, { signed = true } = {}) {
  if (!isNum(v)) return "—";
  const n = Number(v);
  const s = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return `${signed && n > 0 ? "+" : ""}${s} %`;
}

export function qty(v) {
  if (!isNum(v)) return "—";
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 8, useGrouping: "always" }).format(Number(v));
}

export function compactMoney(v) {
  if (!isNum(v)) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: FIAT, notation: "compact", maximumFractionDigits: 2 }).format(
    Number(v)
  );
}

export function dateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function shortDate(v, withTime = false) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", withTime ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }).format(d);
}

// "pos" / "neg" / "" for colouring
export function tone(v) {
  if (!isNum(v) || Number(v) === 0) return "";
  return Number(v) > 0 ? "pos" : "neg";
}

// Stable, muted colour per asset so the same coin always looks the same
const KNOWN = { BTC: "#e8912d", ETH: "#627eea", SOL: "#7b5ce0", ADA: "#2a6fdb", XRP: "#3a3a40", BNB: "#d9a81a", DOGE: "#b8973a", DOT: "#d6336c", USDT: "#2a9d7c", USDC: "#2775ca" };

export function assetColor(symbol = "") {
  if (KNOWN[symbol]) return KNOWN[symbol];
  const hash = [...symbol].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7);
  return `hsl(${Math.abs(hash) % 360} 45% 48%)`;
}
