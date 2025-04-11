import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer
} from "recharts";
import "../i18n";

export default function SaitDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [reportData, setReportData] = useState<any>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (!isAuthenticated) {
      router.push("/login");
    } else if (storedUsername) {
      setUsername(storedUsername);
    }

    const { docId: queryDocId } = router.query;
    if (queryDocId && typeof queryDocId === "string") {
      setDocId(queryDocId);
    } else {
      setLoading(false); // No docId, stop loading
    }
  }, [router]);

  useEffect(() => {
    if (docId) {
      const fetchReportData = async () => {
        try {
          setLoading(true);
          const res = await fetch(`http://localhost:8000/analyze/${docId}?compliance_type=GRI`);
          if (!res.ok) throw new Error("Failed to fetch report data");
          const data = await res.json();
          setReportData(data);
        } catch (error) {
          console.error("Error fetching report data:", error);
          setReportData({ report: [], suggestions: [] });
        } finally {
          setLoading(false);
        }
      };
      fetchReportData();
    }
  }, [docId]);

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("username");
    router.push("/login");
  };

  // Extract insights from reportData
  const insightsData = reportData?.report.length > 0
    ? reportData.report
        .filter((row: any) => [
          "305-1", "305-2", "305-3", // Emissions
          "302-1", // Energy
          "303-5", // Water
        ].some(id => row.Requirement.includes(id)))
        .map((row: any) => {
          const metric = row.Requirement.split(" ")[1];
          return {
            name: metric,
            value: row["Compliance Score"] > 0 ? Math.round(row["Compliance Score"] / 10) : 0, // Mock value
            change: row["Compliance Score"] > 50 ? 10 : -5, // Mock change
            benchmark: row["Compliance Score"] > 75 ? "High" : "Needs Improvement",
          };
        })
    : [];

  const esgPillarData = [
    { name: "Environmental", value: 82 },
    { name: "Social", value: 76 },
    { name: "Governance", value: 89 },
  ];

  const sdgData = [
    { name: "SDG 7", progress: 95 },
    { name: "SDG 9", progress: 75 },
    { name: "SDG 12", progress: 75 },
  ];

  const complianceChartData = reportData?.report
    ? reportData.report.reduce((acc: any[], row: any) => {
        const standard = row.Standard;
        if (!acc.find((item) => item.standard === standard)) {
          const standardRows = reportData.report.filter((r: any) => r.Standard === standard);
          const avgScore = standardRows.reduce((sum: number, r: any) => sum + r["Compliance Score"], 0) / standardRows.length;
          acc.push({ standard, avgScore: Math.round(avgScore) });
        }
        return acc;
      }, [])
    : [];

  const COLORS = ["#228B22", "#FFBB28", "#FF8042", "#00C49F", "#FF4444", "#8884D8", "#82CA9D"];

  return (
    <>
      <header className="header">
        <div className="header-left">
          <img src="/logo.png" alt="SAIT Logo" className="header-logo" />
          <Link href="/dashboard" className="analyze-button">
            {t("back_to_dashboard") || "Back to Dashboard"}
          </Link>
        </div>
        <div className="auth-buttons">
          <button onClick={handleLogout} className="analyze-button">
            {t("logout")}
          </button>
        </div>
      </header>
      <div className="dashboard-container">
        <div className="frame sait-dashboard">
          <h1 className="dashboard-title">SAIT Dashboard</h1>
          <p className="subheading">
            {docId ? `Report Analysis for Document: ${docId}` : "No Document Selected"} | Generated by: SAIT - Sustainability Assessment & Impact Tracker
          </p>

          {/* Insights & Impact Summary */}
          <h2 className="report-title">Insights & Impact Summary</h2>
          {loading ? (
            <p>{t("loading") || "Loading..."}</p>
          ) : insightsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={insightsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value, name) => [`${value} ${name === "value" ? "Units" : "%"}`, name]} />
                <Legend />
                <Bar dataKey="value" fill="#228B22" name="Value" />
                <Bar dataKey="change" fill="#FF8042" name="Change YoY" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p>{t("no_insights_available") || "No relevant insights found in the uploaded report."}</p>
          )}

          {/* IFRS-Based Reporting */}
          <h2 className="report-title">IFRS-Based Reporting</h2>
          <p>(S1 & S2 Climate Disclosure - Condensed)</p>
          <div className="about-us-section">
            <h3>Material Financial Risks Identified:</h3>
            <ul>
              <li>Climate-linked operational costs, carbon pricing exposure</li>
              <li>Transition risks in hardware supply chain</li>
            </ul>
            <h3>Climate Opportunities:</h3>
            <ul>
              <li>AI for climate forecasting (new revenue stream)</li>
              <li>Increased demand for cloud-based energy-efficient computing</li>
            </ul>
            <h3>Disclosure Integration Status:</h3>
            <ul>
              <li>✓ Climate risks embedded in 10-K filing</li>
              <li>✓ Scenario analysis completed (1.3°C/2°C aligned)</li>
            </ul>
          </div>

          {/* ESG Pillar Strength */}
          <h2 className="report-title">ESG Pillar Strength</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={esgPillarData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884D8"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {esgPillarData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>

          {/* Compliance Overview */}
          {reportData?.report.length > 0 && (
            <>
              <h2 className="report-title">Compliance Overview</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={complianceChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="standard" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgScore" fill="#228B22" name="Avg Compliance Score" />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}

          {/* UN SDG Mapping & Progress */}
          <h2 className="report-title">UN SDG Mapping & Progress</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sdgData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value}%`, "Progress"]} />
              <Legend />
              <Bar dataKey="progress" fill="#00C49F" name="Progress (%)" />
            </BarChart>
          </ResponsiveContainer>

          {/* Suggestions */}
          {reportData?.suggestions.length > 0 && (
            <>
              <h2 className="report-title">AI Suggestions</h2>
              <ul>
                {reportData.suggestions.map((suggestion: any, index: number) => (
                  <li key={index}>{`${suggestion.standard}: ${suggestion.suggestion}`}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  );
}
