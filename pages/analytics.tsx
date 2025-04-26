import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useTranslation } from "react-i18next";
import "../i18n";

export default function Analytics() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [complianceStats, setComplianceStats] = useState<any[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [complianceType, setComplianceType] = useState<"GRI" | "IFRS">("GRI");

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("isAuthenticated")) {
      router.push("/");
    }

    const fetchAnalytics = async () => {
      try {
        const response = await fetch(`http://localhost:8000/analytics?compliance_type=${complianceType}&lang=${i18n.language}`);
        const { complianceStats, aiSuggestions } = await response.json();
        setComplianceStats(complianceStats);
        setAiSuggestions(aiSuggestions);
      } catch (error) {
        console.error("Error fetching analytics:", error);
        setComplianceStats([]);
        setAiSuggestions([]);
      }
    };

    fetchAnalytics();
  }, [router, complianceType, i18n.language]);

  return (
    <>
      <header className="header">
        <img src="/logo.png" alt="SAIT Logo" className="header-logo" />
        <select
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          value={i18n.language}
          style={{ marginLeft: "auto", padding: "5px" }}
        >
          <option value="en">{t("english")}</option>
          <option value="es">{t("spanish")}</option>
          <option value="fr">{t("french")}</option>
          <option value="ar">{t("arabic")}</option>
        </select>
      </header>
      <div className="analytics-container">
        <div className="frame">
          <h1 className="analytics-title">{t("analytics_title")}</h1>

          <div className="compliance-options">
            <button
              className={`option-button ${complianceType === "GRI" ? "active" : ""}`}
              onClick={() => setComplianceType("GRI")}
            >
              {t("gri_compliance")}
            </button>
            <button
              className={`option-button ${complianceType === "IFRS" ? "active" : ""}`}
              onClick={() => setComplianceType("IFRS")}
            >
              {t("ifrs_compliance")}
            </button>
          </div>

          <div className="analytics-section">
            <h3>{t("compliance_statistics")}</h3>
            {complianceStats.length > 0 ? (
              <>
                <BarChart width={600} height={300} data={complianceStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="standard" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgScore" fill="#82ca9d" />
                </BarChart>
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>{t("standard")}</th>
                      <th>{t("avg_compliance_score")}</th>
                      <th>{t("total_disclosures_analyzed")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complianceStats.map((stat, index) => (
                      <tr key={index}>
                        <td>{stat.standard}</td>
                        <td>{stat.avgScore}</td>
                        <td>{stat.totalReports}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p>{t("no_data", { type: complianceType })}</p>
            )}
          </div>

          <div className="analytics-section">
            <h3>{t("ai_suggestions")}</h3>
            {aiSuggestions.length > 0 ? (
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>{t("standard")}</th>
                    <th>{t("suggestion")}</th>
                  </tr>
                </thead>
                <tbody>
                  {aiSuggestions.map((suggestion, index) => (
                    <tr key={index}>
                      <td>{suggestion.standard}</td>
                      <td>{suggestion.suggestion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>{t("no_suggestions")}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
