import { useMemo, useState } from "react";

const starterMessages = [
  { role: "assistant", text: "Hola, soy tu IA local. Pregunta sobre tu portfolio, precios o alertas." },
];

function buildReply(input) {
  const lower = input.toLowerCase();
  if (lower.includes("pnl") || lower.includes("benef")) {
    return "Puedes ver tu PnL en el panel y en MyCriptos. Si quieres recalcular, pulsa \"Actualizar precios\".";
  }
  if (lower.includes("alert")) {
    return "Para alertas, ve a la pestaña Alertas, crea la condición y pulsa \"Evaluar ahora\" para probar.";
  }
  if (lower.includes("hist")) {
    return "En Gráfico puedes cambiar el rango (24h, 1w, 1m, 3m, 1y) y el ticker para ver su histórico.";
  }
  if (lower.includes("import") || lower.includes("csv")) {
    return "Para importar operaciones usa Operaciones > Importar CSV con las columnas base_symbol, quantity, price_fiat, total_cost_fiat, side, timestamp.";
  }
  return "Entendido. A falta de un modelo local real, te respondo con tips rápidos. Conecta aquí tu LLM local si quieres respuestas más inteligentes.";
}

export default function ChatbotPanel() {
  const [messages, setMessages] = useState(starterMessages);
  const [input, setInput] = useState("");
  const sessionTitle = useMemo(() => "IA Local", []);

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const reply = buildReply(trimmed);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }, { role: "assistant", text: reply }]);
    setInput("");
  };

  return (
    <aside className="chatbot-panel">
      <header className="chatbot-header">
        <div>
          <p className="eyebrow">Asistente</p>
          <h4>{sessionTitle}</h4>
        </div>
      </header>
      <div className="chatbot-body">
        {messages.map((m, idx) => (
          <div key={idx} className={`chat-msg ${m.role}`}>
            <div className="chat-bubble">{m.text}</div>
          </div>
        ))}
      </div>
      <div className="chatbot-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregúntame algo..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="primary" onClick={send}>Enviar</button>
      </div>
    </aside>
  );
}
