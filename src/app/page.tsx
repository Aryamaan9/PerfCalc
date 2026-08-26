"use client";
import React, { useRef, useState, useCallback } from "react";
import OverviewDashboard from "@/components/OverviewDashboard";
import HoldingsDashboard from "@/components/HoldingsDashboard";
import CorporateActionsDashboard from "@/components/CorporateActionsDashboard";
import TradeLedger from "@/components/TradeLedger";

import {
  type DailyPortfolioEntry,
  type CorporateAction,
  type Trade,
  type AnalysisResult,
} from "@/lib/portfolioEngine";

export type {
  DailyPortfolioEntry,
  CorporateAction,
  Trade,
  AnalysisResult,
};



import { formatDateUI } from "@/utils/date";

// ─── Template Download Bar ────────────────────────────────────────────────────
function TemplateBar() {
  const templates = [
    { 
      label: "Trades Template", 
      csvHref: "/trades_template.csv", 
      csvFile: "trades_template.csv",
      xlsxHref: "/trades_template.xlsx",
      xlsxFile: "trades_template.xlsx"
    },
    { 
      label: "Prices Template", 
      csvHref: "/prices_template.csv", 
      csvFile: "prices_template.csv",
      xlsxHref: "/prices_template.xlsx",
      xlsxFile: "prices_template.xlsx"
    },
    { 
      label: "Actions Template", 
      csvHref: "/actions_template.csv", 
      csvFile: "actions_template.csv",
      xlsxHref: "/actions_template.xlsx",
      xlsxFile: "actions_template.xlsx"
    },
  ];

  return (
    <div className="template-bar" style={{ display: "flex", flexDirection: "column", gap: "14px", alignItems: "stretch" }}>
      <div className="template-bar-label" style={{ borderBottom: "1px solid rgba(201,168,76,0.12)", paddingBottom: "8px", width: "100%" }}>
        <span>📄</span>
        <span>Download sample templates in Excel (.xlsx) or CSV format to format your financial statements</span>
      </div>
      <div className="template-row-container" style={{ display: "flex", flexWrap: "wrap", gap: "24px", justifyContent: "space-between", padding: "4px 0" }}>
        {templates.map((t) => (
          <div key={t.label} style={{ display: "flex", alignItems: "center", gap: "12px", flex: "1 1 250px" }}>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", minWidth: "120px" }}>{t.label}</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <a
                href={t.csvHref}
                download={t.csvFile}
                className="template-btn"
                style={{ textDecoration: "none", padding: "5px 12px", fontSize: "11px" }}
              >
                ⬇ CSV
              </a>
              <a
                href={t.xlsxHref}
                download={t.xlsxFile}
                className="template-btn"
                style={{ textDecoration: "none", padding: "5px 12px", fontSize: "11px", borderColor: "var(--ms-gold)", background: "rgba(201,168,76,0.15)", color: "var(--ms-gold-bright)" }}
              >
                ⬇ EXCEL
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── MoneyStories Logo SVG ────────────────────────────────────────────────────
function MSLogo() {
  return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="10" fill="rgba(201,168,76,0.1)" stroke="rgba(201,168,76,0.3)" strokeWidth="1"/>
      {/* Compass / arrow motif inspired by moneystories.in */}
      <path d="M22 8 L28 22 L22 19 L16 22 Z" fill="#c9a84c" opacity="0.9"/>
      <path d="M22 36 L16 22 L22 25 L28 22 Z" fill="#c9a84c" opacity="0.35"/>
      <circle cx="22" cy="22" r="3" fill="#c9a84c"/>
      <circle cx="22" cy="22" r="7" stroke="rgba(201,168,76,0.2)" strokeWidth="1" fill="none"/>
      <circle cx="22" cy="22" r="12" stroke="rgba(201,168,76,0.1)" strokeWidth="1" fill="none"/>
    </svg>
  );
}

// ─── File Upload Zone ─────────────────────────────────────────────────────────
interface UploadZoneProps {
  label: string;
  hint: string;
  icon: string;
  required?: boolean;
  file: File | null;
  onFile: (f: File | null) => void;
}

function UploadZone({ label, hint, icon, required, file, onFile }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      className={`upload-zone ${file ? "uploaded" : ""} ${dragOver ? "drag-over" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: "none" }}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <span className={`upload-badge ${required ? "badge-required" : "badge-optional"}`}>
        {required ? "Required" : "Optional"}
      </span>
      <span className="upload-icon">{file ? "✅" : icon}</span>
      <div className="upload-label">{label}</div>
      <div className="upload-hint">{hint}</div>
      {file && <div className="file-name">📎 {file.name}</div>}
    </div>
  );
}

import PortfolioManager from "@/components/PortfolioManager";

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",  label: "Overview",          icon: "📊" },
  { id: "holdings",  label: "Holdings",          icon: "📈" },
  { id: "corporate", label: "Corporate Actions", icon: "🏦" },
  { id: "trades",    label: "Trade Ledger",      icon: "📋" },
  { id: "manager",   label: "Data Manager",      icon: "💾" },
];

const CLOUD_FN_URL = process.env.NEXT_PUBLIC_CLOUD_FN_URL || "/api/analyze";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [tradesFile, setTradesFile]   = useState<File | null>(null);
  const [pricesFile, setPricesFile]   = useState<File | null>(null);
  const [actionsFile, setActionsFile] = useState<File | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [result, setResult]           = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab]     = useState("overview");

  const handleAnalyze = async () => {
    if (!tradesFile) {
      setError("Please upload the Trades file to continue.");
      return;
    }
    setLoading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("trades", tradesFile);
      if (pricesFile) fd.append("prices", pricesFile);
      if (actionsFile) fd.append("actions", actionsFile);

      const res = await fetch(CLOUD_FN_URL, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data: AnalysisResult = await res.json();
      setResult(data);
      setActiveTab("overview");
    } catch (e: any) {
      setError(e.message || "Analysis failed. Please check your files.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeDB = async (portfolioId: string) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/portfolio/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data: AnalysisResult = await res.json();
      setResult(data);
      setActiveTab("overview");
    } catch (e: any) {
      setError(e.message || "Database Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-wrapper">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="container">
          <div className="header-inner">
            <div className="brand">
              <div className="brand-icon"><MSLogo /></div>
              <div>
                <div className="brand-name">
                  Money <span>Stories</span>
                </div>
                <div className="brand-sub">Portfolio Analytics Platform</div>
              </div>
            </div>
            {result && (
              <div className="header-date">
                <span>📅</span>
                <span>{formatDateUI(result.summary.dateRange.start)} — {formatDateUI(result.summary.dateRange.end)}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingBottom: 48 }}>
        {/* ── Template Download Bar ───────────────────────────────────── */}
        <TemplateBar />

        {/* ── Upload Section ──────────────────────────────────────────── */}
        {activeTab !== "manager" && (
          <section className="upload-section fade-up">
          <div className="upload-title">
            <span>⬆</span> Upload Financial Statements
          </div>
          <div className="upload-grid">
            <UploadZone
              label="Trades Statement"
              hint="Symbol · Side · Qty · Fill Price · Commission · Closing Time"
              icon="🧾"
              required
              file={tradesFile}
              onFile={setTradesFile}
            />
            <UploadZone
              label="Historic Prices"
              hint="Optional: Will auto-fetch from Yahoo Finance if skipped."
              icon="📉"
              file={pricesFile}
              onFile={setPricesFile}
            />
            <UploadZone
              label="Corporate Actions"
              hint="Date · Symbol · Action (DIVIDEND / SPLIT / DEPOSIT / WITHDRAWAL) · Value"
              icon="🏛️"
              file={actionsFile}
              onFile={setActionsFile}
            />
          </div>

          {error && (
            <div className="error-box">
              <span>⚠️</span><span>{error}</span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "center", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <button
              className="analyze-btn gold-pulse"
              onClick={handleAnalyze}
              disabled={loading || !tradesFile}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Analysing Portfolio…
                </>
              ) : (
                <>✦ Analyse Portfolio</>
              )}
            </button>
            <button
              className="template-btn"
              onClick={() => setActiveTab("manager")}
              style={{ fontSize: "12px" }}
            >
              💾 Open Database Manager
            </button>
          </div>
        </section>
        )}

        {/* ── Loading ──────────────────────────────────────────────────── */}
        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
            <div className="loading-text">Computing Daily Portfolio Value</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
              Processing prices · positions · corporate actions
            </div>
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────── */}
        {result && !loading && (
          <>
            <div className="gold-divider" />

            {/* Tabs */}
            <nav className="tab-bar fade-up">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={`tab-btn ${activeTab === t.id ? "active" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </nav>

            {/* Missing prices warning */}
            {result.missingPriceDates.length > 0 && (
              <div className="warning-strip fade-up">
                <span>⚠️</span>
                <span>
                  <strong>{result.missingPriceDates.length} missing price entries</strong> were interpolated
                  (weighted average of nearest dates). Tickers:{" "}
                  {[...new Set(result.missingPriceDates.map(m => m.ticker))].slice(0, 5).join(", ")}
                  {result.missingPriceDates.length > 5 ? " and more." : "."}
                </span>
              </div>
            )}

            {/* Reconciliation anomalies warning */}
            {result.reconciliationWarnings?.length > 0 && (
              <div className="warning-strip fade-up" style={{ backgroundColor: "rgba(240, 101, 149, 0.1)", borderColor: "rgba(240, 101, 149, 0.3)", color: "#f8f4ff" }}>
                <span>🚨</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <strong>Anomaly Detected (Corporate Action Audit)</strong>
                  {result.reconciliationWarnings.map((warning, idx) => (
                    <span key={idx} style={{ fontSize: '12px', color: '#ffb3c6' }}>• {warning}</span>
                  ))}
                </span>
              </div>
            )}

            {activeTab === "overview"  && <OverviewDashboard result={result} />}
            {activeTab === "holdings"  && <HoldingsDashboard result={result} />}
            {activeTab === "corporate" && <CorporateActionsDashboard result={result} />}
            {activeTab === "trades"    && <TradeLedger result={result} />}
          </>
        )}
        {activeTab === "manager" && <PortfolioManager onAnalyze={handleAnalyzeDB} />}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="app-footer">
        <div className="container">
          Money Stories · Portfolio Analytics · Boutique Asset Management · All Values in ₹ INR
        </div>
      </footer>
    </div>
  );
}
