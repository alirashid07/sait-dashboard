import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import Image from "next/image";
import "../i18n";

// Define interfaces for TypeScript
interface ReportRow {
  Standard: string;
  Requirement: string;
  "Compliance Score": number;
  Remarks: string;
  Omission: { reason: string; explanation: string } | null;
  "Sector Ref": string | null;
}

interface QueryResult {
  answer: string;
  details: string;
}

interface ChartData {
  standard: string;
  avgScore: number;
}

interface ShowColumns {
  Standard: boolean;
  Requirement: boolean;
  "Compliance Score": boolean;
  Remarks: boolean;
  Omission: boolean;
  "Sector Ref": boolean;
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ReportRow[]>([]);
  const [complianceType, setComplianceType] = useState<"GRI" | "IFRS">("GRI");
  const [query, setQuery] = useState<string>("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isQueryLoading, setIsQueryLoading] = useState(false);
  const [docId, setDocId] = useState<string>("");
  const [showColumns, setShowColumns] = useState<ShowColumns>({
    Standard: true,
    Requirement: true,
    "Compliance Score": true,
    Remarks: true,
    Omission: true,
    "Sector Ref": true,
  });
  const [filterNonCompliant, setFilterNonCompliant] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [showQueryHistory, setShowQueryHistory] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [username, setUsername] = useState<string>("");

  const exampleQueries = [t("example_query_1"), t("example_query_2"), t("example_query_3")];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!localStorage.getItem("isAuthenticated")) {
        router.push("/login");
      } else {
        const storedUsername = localStorage.getItem("username");
        console.log("Stored Username from localStorage:", storedUsername);
        setUsername(storedUsername || "User");
        console.log("Username state after set:", storedUsername || "User");
      }
    }
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % exampleQueries.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [router, exampleQueries.length]);

  const handleTransform = async () => {
    if (!file) return;
    const controller = new AbortController();
    setAbortController(controller);
    setIsAnalyzing(true);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => (prev < 30 ? prev + 5 : prev));
    }, 500);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const uploadRes = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const { doc_id } = await uploadRes.json();
      setDocId(doc_id);

      setUploadProgress(30);

      const analysisProgressInterval = setInterval(() => {
        setUploadProgress((prev) => (prev < 100 ? prev + 10 : prev));
      }, 500);

      const analyzeRes = await fetch(
        `http://localhost:8000/analyze/${doc_id}?compliance_type=${complianceType}&lang=${i18n.language}`,
        { signal: controller.signal }
      );
      const { report: rawReport } = await analyzeRes.json();

      console.log("Raw Report Data:", rawReport);
      rawReport.forEach((row: ReportRow, index: number) => {
        console.log(`Row ${index} - Remarks: "${row.Remarks}", Omission:`, row.Omission);
      });

      const filteredReport = rawReport.filter((row: ReportRow) => {
        if (row.Omission && row.Omission.reason) {
          return row.Omission.reason.toLowerCase() !== "not applicable";
        }
        return true;
      }) as ReportRow[];

      console.log("Filtered Report Data:", filteredReport);
      setReport(filteredReport);

      clearInterval(progressInterval);
      clearInterval(analysisProgressInterval);
      setUploadProgress(100);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Analysis cancelled");
        setReport([]);
      } else {
        console.error("Error:", error);
        setReport([
          {
            Standard: t("error"),
            Requirement: error instanceof Error ? error.message : String(error),
            "Compliance Score": 0,
            Remarks: t("failed_to_process"),
            Omission: null,
            "Sector Ref": null,
          },
        ]);
      }
    } finally {
      setIsAnalyzing(false);
      setUploadProgress(0);
      setAbortController(null);
    }
  };

  const handleQuery = () => {
    if (!query || report.length === 0) {
      setQueryResult({ answer: t("query_error"), details: t("no_report_loaded") });
      return;
    }

    setIsQueryLoading(true);
    setQueryResult(null);

    const lowerQuery = query.toLowerCase();

    const matchingRows = report.filter((row) =>
      [
        row.Standard?.toLowerCase(),
        row.Requirement?.toLowerCase(),
        row.Remarks?.toLowerCase(),
        row["Compliance Score"]?.toString(),
        row.Omission ? `${row.Omission.reason?.toLowerCase()}: ${row.Omission.explanation?.toLowerCase()}` : "",
        row["Sector Ref"]?.toLowerCase(),
      ]
        .filter(Boolean)
        .some((field) => field?.includes(lowerQuery))
    );

    let answer: string, details: string;
    if (matchingRows.length > 0) {
      answer = t("query_found");
      details = `${matchingRows.length} matching item(s) found:\n`;
      matchingRows.forEach((row, index) => {
        details += `${index + 1}. Standard: ${row.Standard}, Requirement: ${row.Requirement}, Score: ${row["Compliance Score"]}\n`;
      });
    } else {
      answer = t("query_not_found");
      details = t("query_not_found_details");
    }

    setQueryResult({ answer, details });
    setQueryHistory((prev) => [query, ...prev.slice(0, 9)]);
    setIsQueryLoading(false);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text(t("compliance_report", { type: complianceType }), 10, 10);
    const visibleColumns = Object.keys(showColumns).filter(
      (col) => showColumns[col as keyof ShowColumns]
    );
    const tableData = report
      .filter((row) => !filterNonCompliant || row["Compliance Score"] === 0)
      .map((row) =>
        visibleColumns.map((col) => {
          const value = row[col as keyof ReportRow];
          if (col === "Omission" && value && typeof value === "object" && "reason" in value) {
            return `${value.reason}: ${value.explanation}`;
          }
          return value ?? "-";
        })
      );
    autoTable(doc, {
      head: [visibleColumns],
      body: tableData,
      startY: 20,
      theme: "striped",
      headStyles: { fillColor: [34, 139, 34] },
    });
    doc.save(`${complianceType}_compliance_report.pdf`);
  };

  const downloadExcel = () => {
    const visibleColumns = Object.keys(showColumns).filter(
      (col) => showColumns[col as keyof ShowColumns]
    );
    const tableData = report
      .filter((row) => !filterNonCompliant || row["Compliance Score"] === 0)
      .map((row) => {
        const rowData: Record<string, string | number> = {};
        visibleColumns.forEach((col) => {
          const value = row[col as keyof ReportRow];
          rowData[col] =
            col === "Omission" && value && typeof value === "object" && "reason" in value
              ? `${value.reason}: ${value.explanation}`
              : value ?? "-";
        });
        return rowData;
      });
    const ws = XLSX.utils.json_to_sheet(tableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${complianceType}_compliance_report.xlsx`);
  };

  const chartData = report.reduce((acc: ChartData[], row) => {
    const standard = row.Standard;
    if (!acc.find((item) => item.standard === standard)) {
      const standardRows = report.filter((r) => r.Standard === standard);
      const avgScore = standardRows.reduce((sum, r) => sum + r["Compliance Score"], 0) / standardRows.length;
      acc.push({ standard, avgScore: Math.round(avgScore) });
    }
    return acc;
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("username");
    router.push("/login");
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <Image
            src="/logo.png"
            alt="SAIT Logo"
            width={100}
            height={175}
            className="header-logo"
            quality={100}
            priority
          />
        </div>
        <div className="auth-buttons">
          <select
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            value={i18n.language}
            className="language-select"
          >
            <option value="en">{t("english")}</option>
            <option value="es">{t("spanish")}</option>
            <option value="french">{t("french")}</option>
            <option value="ar">{t("arabic")}</option>
          </select>
          <button onClick={handleLogout} className="analyze-button">
            {t("logout")}
          </button>
        </div>
      </header>
      <div className="dashboard-container">
        <div className="frame">
          <h1 className="dashboard-title">Welcome, {username}!</h1>
          <p className="subheading">{t("tagline_dashboard")}</p>
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

          <h3>{t("upload_files")}</h3>
          <div className="tooltip">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="file-input"
              disabled={isAnalyzing}
            />
            <span className="tooltiptext">{t("upload_tooltip")}</span>
          </div>
          <div className="button-group" style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button
              onClick={handleTransform}
              className="analyze-button"
              disabled={isAnalyzing || !file}
              style={{ cursor: isAnalyzing || !file ? "not-allowed" : "pointer", width: "150px" }}
            >
              {isAnalyzing ? t("analyzing") : t("transform")}
            </button>
            <Link
              href="/sait-report"
              className="analyze-button"
              style={{ width: "150px", textAlign: "center" }}
            >
              {t("sait_dashboard") || "SAIT Dashboard"}
            </Link>
          </div>

          {isAnalyzing && (
            <div style={{ margin: "20px 0", textAlign: "center" }}>
              <div className="spinner"></div>
              <p>{t("analyzing_report")}</p>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            </div>
          )}

          {report.length > 0 && (
            <>
              <h2 className="report-title">{t("transform_track_reports")}</h2>
              <div style={{ margin: "20px 0" }}>
                <h3>{t("compliance_score_by_standard")}</h3>
                <BarChart width={600} height={300} data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="standard" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgScore" fill="#228B22" />
                </BarChart>
              </div>
              <div style={{ margin: "20px 0" }}>
                <h3>{t("customize_report")}</h3>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {Object.keys(showColumns).map((col) => (
                    <label key={col}>
                      <input
                        type="checkbox"
                        checked={showColumns[col as keyof ShowColumns]}
                        onChange={() =>
                          setShowColumns((prev) => ({
                            ...prev,
                            [col]: !prev[col as keyof ShowColumns],
                          }))
                        }
                      />
                      {t(col.toLowerCase().replace(" ", "_"))}
                    </label>
                  ))}
                  <label>
                    <input
                      type="checkbox"
                      checked={filterNonCompliant}
                      onChange={() => setFilterNonCompliant(!filterNonCompliant)}
                    />
                    {t("show_non_compliant")}
                  </label>
                </div>
              </div>
              <div className={`report-table-container ${report.length > 0 ? "visible" : ""}`}>
                <table className="report-table">
                  <thead>
                    <tr>
                      {showColumns.Standard && <th>{t("standard")}</th>}
                      {showColumns.Requirement && <th>{t("requirement")}</th>}
                      {showColumns["Compliance Score"] && <th>{t("compliance_score")}</th>}
                      {showColumns.Remarks && <th>{t("remarks")}</th>}
                      {showColumns.Omission && <th>{t("omission")}</th>}
                      {showColumns["Sector Ref"] && <th>{t("sector_ref")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {report
                      .filter((row) => !filterNonCompliant || row["Compliance Score"] === 0)
                      .map((row, index) => (
                        <tr key={index}>
                          {showColumns.Standard && <td>{row.Standard}</td>}
                          {showColumns.Requirement && <td>{row.Requirement}</td>}
                          {showColumns["Compliance Score"] && <td>{row["Compliance Score"]}</td>}
                          {showColumns.Remarks && <td>{row.Remarks}</td>}
                          {showColumns.Omission && (
                            <td>{row.Omission ? `${row.Omission.reason}: ${row.Omission.explanation}` : "-"}</td>
                          )}
                          {showColumns["Sector Ref"] && <td>{row["Sector Ref"] || "-"}</td>}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div style={{ margin: "20px 0", textAlign: "center" }}>
                <button onClick={downloadPDF} className="download-button">
                  {t("download_pdf")}
                </button>
                <button
                  onClick={downloadExcel}
                  className="download-button"
                  style={{ marginLeft: "10px" }}
                >
                  {t("download_excel")}
                </button>
              </div>
              <div style={{ margin: "20px 0" }}>
                <h3>{t("ask_question")}</h3>
                <div style={{ display: "flex", gap: "15px", alignItems: "center", flexWrap: "wrap" }}>
                  <div className="query-history" style={{ flex: "1 1 70%", position: "relative" }}>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={exampleQueries[placeholderIndex]}
                      className="query-input"
                    />
                    {queryHistory.length > 0 && (
                      <button
                        className="query-history-button"
                        onClick={() => setShowQueryHistory(!showQueryHistory)}
                      >
                        {showQueryHistory ? t("hide_history") : t("show_history")}
                      </button>
                    )}
                    {showQueryHistory && queryHistory.length > 0 && (
                      <div className="query-history-dropdown">
                        {queryHistory.map((pastQuery, index) => (
                          <div
                            key={index}
                            className="query-history-item"
                            onClick={() => {
                              setQuery(pastQuery);
                              setShowQueryHistory(false);
                            }}
                          >
                            {pastQuery}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={handleQuery} disabled={isQueryLoading} className="ask-button">
                    {isQueryLoading ? t("loading") : t("ask")}
                  </button>
                  <button onClick={() => setQuery("")} className="clear-button">
                    {t("clear")}
                  </button>
                </div>
                {queryResult && (
                  <div className="query-result">
                    <p>
                      <strong>{t("answer")}:</strong> {queryResult.answer}
                    </p>
                    <p>
                      <strong>{t("details")}:</strong> {queryResult.details}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
