import { useState } from "react";
import { login, signup } from "../api";

export default function AuthForm({ onSuccess }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (mode === "signup" && form.password !== form.confirmPassword) {
      setMessage("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      const payload =
        mode === "login"
          ? { email: form.email, password: form.password }
          : {
              name: form.name,
              phone: form.phone,
              email: form.email,
              password: form.password,
            };

      const fn = mode === "login" ? login : signup;
      const res = await fn(payload);

      setMessage(
        mode === "login"
          ? `✅ Bienvenido ${res?.user?.email}`
          : "✅ Cuenta creada correctamente"
      );

      onSuccess?.(res);
    } catch (err) {
      setMessage(err.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <header className="auth-header">
          <h2>{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>
          <div className="auth-tabs">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              className={mode === "signup" ? "active" : ""}
              onClick={() => setMode("signup")}
            >
              Sign up
            </button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && (
            <>
              <input
                name="name"
                placeholder="Nombre completo"
                required
                onChange={handleChange}
              />
              <input
                name="phone"
                placeholder="Número de teléfono"
                required
                onChange={handleChange}
              />
            </>
          )}

          <input
            type="email"
            name="email"
            placeholder="Correo electrónico"
            required
            onChange={handleChange}
          />

          <input
            type="password"
            name="password"
            placeholder="Contraseña"
            required
            maxLength={72}
            onChange={handleChange}
          />

          {mode === "signup" && (
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirmar contraseña"
              required
              maxLength={72}
              onChange={handleChange}
            />
          )}

          <button type="submit" disabled={loading}>
            {loading
              ? "Procesando..."
              : mode === "login"
              ? "Entrar"
              : "Crear cuenta"}
          </button>
        </form>

        {message && <p className="auth-message">{message}</p>}
      </div>
    </div>
  );
}
