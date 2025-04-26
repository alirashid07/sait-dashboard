import { useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import "../i18n";

export default function Signup() {
  const { t } = useTranslation();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("http://localhost:8000/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Registration failed");
      }
      router.push("/login"); // Redirect to login on success
    } catch (err) {
      setError(t("signup_error") || "Failed to register. Please try again.");
    }
  };

  return (
    <>
      <header className="header">
        <img src="/logo.png" alt="SAIT Logo" className="header-logo" />
      </header>
      <div className="dashboard-container">
        <div className="frame">
          <h1 className="dashboard-title">{t("sign_up")}</h1>
          <p className="subheading">{t("tagline")}</p>
          <form onSubmit={handleSignup}>
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
              {t("sign_up")}
            </button>
            {error && <p className="error">{error}</p>}
            <p style={{ textAlign: "center", marginTop: "20px" }}>
              {t("already_have_account")}{" "}
              <a href="/login" className="link">
                {t("sign_in")}
              </a>
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
