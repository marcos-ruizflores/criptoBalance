import { Fragment, useEffect, useRef, useState } from "react";
import { streamChat } from "../api";
import { Icon } from "./ui";

const SUGGESTIONS = [
  "¿Cuánto vale mi cartera y cuánto llevo ganado?",
  "¿Cuál es mi peor posición ahora mismo?",
  "¿Cuánto he invertido en BTC en total?",
  "Resume mis operaciones de este año",
];

const TOOL_LABELS = {
  get_portfolio: "Mirando tu cartera",
  list_trades: "Revisando tus operaciones",
  get_price_history: "Consultando el histórico",
  get_market_top: "Consultando el mercado",
  list_alerts: "Revisando tus alertas",
  list_snapshots: "Revisando tus snapshots",
};

// The server only needs the last few turns
const HISTORY_SENT = 12;

// Just enough markdown for the answers: paragraphs, "- " lists and **bold**
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>
  );
}

const BULLET = /^\s*[-*•] /;

// Groups lines into paragraphs and lists, so "Total:\n- a\n- b" renders as text plus a list
function RichText({ text }) {
  const blocks = [];
  for (const line of text.trim().split("\n")) {
    const isItem = BULLET.test(line);
    const last = blocks[blocks.length - 1];
    if (!line.trim()) {
      blocks.push({ type: "gap" });
    } else if (last && last.type === (isItem ? "ul" : "p")) {
      last.lines.push(line);
    } else {
      blocks.push({ type: isItem ? "ul" : "p", lines: [line] });
    }
  }
  return blocks
    .filter((b) => b.type !== "gap")
    .map((b, i) =>
      b.type === "ul" ? (
        <ul key={i}>
          {b.lines.map((l, j) => (
            <li key={j}>{inline(l.replace(BULLET, ""))}</li>
          ))}
        </ul>
      ) : (
        <p key={i}>
          {b.lines.map((l, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {inline(l.replace(/^#+\s*/, ""))}
            </Fragment>
          ))}
        </p>
      )
    );
}

export default function ChatPanel({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateLast = (fn) =>
    setMessages((prev) => {
      const next = [...prev];
      next[next.length - 1] = fn(next[next.length - 1]);
      return next;
    });

  const send = async (raw) => {
    const question = raw.trim();
    if (!question || busy) return;
    setInput("");

    // Failed answers aren't sent back, they'd only confuse the model
    const history = [...messages.filter((m) => !m.error && m.text), { role: "user", text: question }]
      .slice(-HISTORY_SENT)
      .map((m) => ({ role: m.role, content: m.text }));
    while (history.length && history[0].role !== "user") history.shift();

    setMessages((prev) => [...prev, { role: "user", text: question }, { role: "assistant", text: "" }]);
    setBusy(true);
    setStatus("Pensando");
    const controller = new AbortController();
    abortRef.current = controller;
    let afterTool = false;

    try {
      await streamChat(
        history,
        (ev) => {
          if (ev.type === "text") {
            setStatus("");
            const gap = afterTool;
            afterTool = false;
            updateLast((m) => ({ ...m, text: m.text + (gap && m.text && !m.text.endsWith("\n") ? "\n\n" : "") + ev.text }));
          } else if (ev.type === "tool") {
            afterTool = true;
            setStatus(TOOL_LABELS[ev.name] || "Buscando datos");
          } else if (ev.type === "error") {
            updateLast((m) => ({ ...m, error: ev.message }));
          }
        },
        controller.signal
      );
    } catch (err) {
      if (err.name !== "AbortError") {
        updateLast((m) => ({ ...m, error: err.message || "No se pudo conectar con el asistente." }));
      }
    } finally {
      setBusy(false);
      setStatus("");
      abortRef.current = null;
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
  };

  return (
    <aside id="chat-panel" className={`chat ${open ? "is-open" : ""}`} aria-label="Asistente" aria-hidden={!open} inert={open ? undefined : ""}>
      <header className="chat-head">
        <div>
          <h2>Asistente</h2>
          <p className="muted small">Pregunta por tu cartera y tus operaciones</p>
        </div>
        <div className="row">
          {messages.length > 0 && (
            <button className="btn btn-ghost" onClick={reset} disabled={busy}>
              Nueva
            </button>
          )}
          <button className="btn btn-icon" onClick={onClose} aria-label="Cerrar asistente">
            <Icon name="close" size={16} />
          </button>
        </div>
      </header>

      <div className="chat-body" ref={bodyRef} aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p className="muted">Responde con tus datos reales: posiciones, PnL, operaciones, alertas y precios de Binance.</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chat-suggestion" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              {m.role === "user" ? (
                <p>{m.text}</p>
              ) : (
                <>
                  {m.text && <RichText text={m.text} />}
                  {m.error && <p className="chat-error">{m.error}</p>}
                  {i === messages.length - 1 && status && <p className="chat-status">{status}…</p>}
                </>
              )}
            </div>
          ))
        )}
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          ref={inputRef}
          className="input"
          rows={1}
          value={input}
          maxLength={2000}
          placeholder="Escribe tu pregunta"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button className="btn btn-primary btn-send" type="submit" disabled={busy || !input.trim()} aria-label="Enviar">
          <Icon name="send" size={15} />
        </button>
      </form>
      <p className="chat-foot muted small">Funciona con Claude. No es asesoramiento financiero.</p>
    </aside>
  );
}
