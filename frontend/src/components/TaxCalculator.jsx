import { useState } from "react";

export default function TaxCalculator() {
  const [inputs, setInputs] = useState({
    salary: "",
    capitalGains: "",
    deductions: "",
    rate: "20",
  });
  const [result, setResult] = useState(null);

  const handleChange = (field, val) => {
    setInputs((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const salary = Number(inputs.salary) || 0;
    const gains = Number(inputs.capitalGains) || 0;
    const deductions = Number(inputs.deductions) || 0;
    const rate = Number(inputs.rate) || 0;
    const base = Math.max(salary + gains - deductions, 0);
    const tax = base * (rate / 100);
    setResult({ base, tax, rate });
  };

  return (
    <div className="card glass">
      <div className="card-header">
        <div>
          <p className="eyebrow">IRPF</p>
          <h3>Calculadora rápida</h3>
        </div>
      </div>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field">
          <span>Ingresos (salario)</span>
          <input
            type="number"
            min="0"
            value={inputs.salary}
            onChange={(e) => handleChange("salary", e.target.value)}
            placeholder="Ej: 28000"
          />
        </label>
        <label className="field">
          <span>Ganancias/pérdidas capital</span>
          <input
            type="number"
            value={inputs.capitalGains}
            onChange={(e) => handleChange("capitalGains", e.target.value)}
            placeholder="Ej: 1200"
          />
        </label>
        <label className="field">
          <span>Deducciones</span>
          <input
            type="number"
            min="0"
            value={inputs.deductions}
            onChange={(e) => handleChange("deductions", e.target.value)}
            placeholder="Ej: 2000"
          />
        </label>
        <label className="field">
          <span>Tipo efectivo (%)</span>
          <input
            type="number"
            min="0"
            max="60"
            step="0.1"
            value={inputs.rate}
            onChange={(e) => handleChange("rate", e.target.value)}
          />
        </label>
        <div className="actions">
          <button className="primary" type="submit">Calcular</button>
        </div>
      </form>
      {result && (
        <div className="metric" style={{ marginTop: 12 }}>
          <p className="eyebrow">Resultado</p>
          <strong>Base imponible: {result.base.toFixed(2)} EUR</strong>
          <strong>Impuesto estimado: {result.tax.toFixed(2)} EUR ({result.rate}%)</strong>
          <p className="muted small">Estimación básica. Ajusta tramos y deducciones reales cuando completes esta sección.</p>
        </div>
      )}
    </div>
  );
}
