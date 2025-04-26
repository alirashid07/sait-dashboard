import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import "../i18n"; // i18n setup (redundant with _app.tsx, kept for clarity)

export default function Landing() {
  const { t } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <>
      <header className="header">
        <div className="header-left">
          <img src="/logo.png" alt="SAIT Logo" className="header-logo" />
          <div className="menu-container">
            <button
              className="dropdown-button analyze-button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              {t("menu")}
            </button>
            {isDropdownOpen && (
              <div className="dropdown-menu query-history-dropdown">
                <Link href="/clients" className="dropdown-item query-history-item">
                  {t("our_clients")}
                </Link>
                <Link href="/esg-scores" className="dropdown-item query-history-item">
                  {t("esg_scores")}
                </Link>
              </div>
            )}
          </div>
        </div>
        <div className="auth-buttons">
          <Link href="/login" className="login-button analyze-button">
            {t("sign_in")}
          </Link>
          <Link href="/signup" className="login-button analyze-button signup">
            {t("sign_up")}
          </Link>
        </div>
      </header>
      <div className="dashboard-container">
        <div className="frame landing-content">
          <img src="/logo.png" alt="SAIT Logo" className="landing-logo" />
          <h1 className="dashboard-title tagline-left">{t("tagline")}</h1>
          <div className="about-us-section">
            <h2 className="report-title about-us-left">{t("about_us")}</h2>
            <p className="about-us-text">
              We are a dynamic startup from Qatar, established in 2023, dedicated to empowering companies to achieve their sustainability goals. At SAIT, we believe that sustainable practices are the cornerstone of a thriving future. Our innovative tools simplify ESG (Environmental, Social, and Governance) reporting, enabling businesses to track and transform their environmental impact with ease and precision.
            </p>
            <p className="about-us-text">
              Committed to sustainability, we partner with organizations across industries to drive meaningful change. By leveraging cutting-edge technology and a passion for eco-conscious solutions, we aim to create a ripple effect of positive impact—supporting not just compliance, but a genuine shift towards a greener, more responsible world. Join us in building a sustainable tomorrow, one report at a time.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
