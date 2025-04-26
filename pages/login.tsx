import { useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import "../i18n";

export default function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("http://localhost:8000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }
      const data = await res.json();
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("username", username); // Store username for dashboard
      router.push("/dashboard"); // Redirect to dashboard on success
    } catch (err) {
      setError(t("login_error") || "Invalid credentials. Please try again.");
    }
  };

  return (
    <>
      <header className="header">
        <img src="/logo.png" alt="SAIT Logo" className="header-logo" />
      </header>
      <div className="dashboard-container">
        <div className="frame">
          <h1 className="dashboard-title">{t("sign_in")}</h1>
          <p className="subheading">{t("tagline")}</p>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("username")}
              className="query-input"
              required
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("email")}
              className="query-input"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("password")}
              className="query-input"
              required
            />
            <button type="submit" className="analyze-button">
              {t("sign_in")}
            </button>
            {error && <p className="error">{error}</p>}
            <p style={{ textAlign: "center", marginTop: "20px" }}>
              {t("dont_have_account")}{" "}
              <a href="/signup" className="link">
                {t("sign_up")}
              </a>
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
