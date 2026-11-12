import { useState } from "react";
import { login, signup } from "../api";

const EMPTY = { name: "", phone: "", email: "", password: "", confirmPassword: "" };

// FastAPI errors come back as JSON text; show just the message
function readError(err) {
  try {
    const parsed = JSON.parse(err.message);
    return typeof parsed.detail === "string" ? parsed.detail : "Revisa los datos e inténtalo de nuevo.";
  } catch {
    return err.message || "Algo ha fallado. Inténtalo de nuevo.";
  }
}

export default function AuthForm({ onSuccess }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";
  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const switchMode = () => {
    setMode(isSignup ? "login" : "signup");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (isSignup && form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const res = isSignup
        ? await signup({ name: form.name, phone: form.phone, email: form.email, password: form.password })
        : await login({ email: form.email, password: form.password });
      onSuccess?.(res);
    } catch (err) {
      setError(readError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">C</span>
          CriptoBalance
        </div>
        <h1>{isSignup ? "Crea tu cuenta" : "Inicia sesión"}</h1>
        <p>{isSignup ? "Empieza a registrar tus operaciones." : "Accede a tu cartera."}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <>
              <label className="field">
                <span>Nombre</span>
                <input className="input" name="name" autoComplete="name" required value={form.name} onChange={set} />
              </label>
              <label className="field">
                <span>Teléfono</span>
                <input className="input" name="phone" type="tel" autoComplete="tel" required value={form.phone} onChange={set} />
              </label>
            </>
          )}
          <label className="field">
            <span>Email</span>
            <input className="input" name="email" type="email" autoComplete="email" required value={form.email} onChange={set} />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input
              className="input"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              maxLength={72}
              value={form.password}
              onChange={set}
            />
          </label>
          {isSignup && (
            <label className="field">
              <span>Repite la contraseña</span>
              <input
                className="input"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                maxLength={72}
                value={form.confirmPassword}
                onChange={set}
              />
            </label>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "Un momento…" : isSignup ? "Crear cuenta" : "Entrar"}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? "¿Ya tienes cuenta? " : "¿No tienes cuenta? "}
          <button type="button" className="link" onClick={switchMode}>
            {isSignup ? "Inicia sesión" : "Regístrate"}
          </button>
        </p>
      </div>
    </main>
  );
}
