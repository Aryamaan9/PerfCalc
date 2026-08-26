"use client";

import React, { useState, useEffect } from "react";
import { AnalysisResult } from "@/lib/advancedEngine";

export default function HoldingsTab({ familyId, userId, brokerId }: any) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portfolio/advancedAnalyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId: familyId || "defaultFamily", userId, brokerId })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to analyze");
      }
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Optionally auto-run analyze if they switch to this tab and have a user
    if (userId) {
      handleAnalyze();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, userId, brokerId]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 className="brand-name" style={{ margin: 0, fontSize: "16px" }}>Holdings <span>& Audit Report</span></h2>
          <p className="brand-sub">Point-in-time holdings and system abnormality auditing.</p>
        </div>
        <button className="template-btn" onClick={handleAnalyze} disabled={loading}>
          {loading ? "Analyzing..." : "Refresh Audit"}
        </button>
      </div>

      {error && <div style={{ color: "var(--color-negative)", background: "rgba(248,113,113,0.1)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(248,113,113,0.3)", marginBottom: "24px" }}>Error: {error}</div>}

      {!result && !loading && !error && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          Click Refresh Audit to load data for this scope.
        </div>
      )}

      {result && (
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          
          {/* Holdings */}
          <div style={{ flex: 1, minWidth: "400px" }}>
            <div className="chart-header">
              <h3 className="chart-title">Current Holdings</h3>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Shares</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.dailyPortfolio[result.dailyPortfolio.length - 1]?.holdings || {}).map(([sym, holding]) => (
                    <tr key={sym}>
                      <td style={{ fontWeight: "bold" }}>{sym}</td>
                      <td>{holding.shares.toFixed(2)}</td>
                      <td className="positive">₹{holding.value.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Report */}
          <div style={{ flex: 1, minWidth: "400px" }}>
            <div className="chart-header">
              <h3 className="chart-title">Abnormality Audit Report</h3>
            </div>
            
            {result.auditAlerts && result.auditAlerts.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {result.auditAlerts.map((alert, i) => (
                  <div key={i} style={{ padding: "12px 16px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "var(--radius-sm)", color: "var(--color-negative)", fontSize: "12px" }}>
                    ⚠️ {alert}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "12px 16px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: "var(--radius-sm)", color: "var(--color-positive)", fontSize: "12px" }}>
                ✅ Passed: Zero abnormalities detected. Cash, holdings, and pricing are stable.
              </div>
            )}

            <div className="chart-header" style={{ marginTop: "32px" }}>
              <h3 className="chart-title">Reconciliation Warnings</h3>
            </div>
            {result.reconciliationWarnings && result.reconciliationWarnings.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {result.reconciliationWarnings.map((warn, i) => (
                  <div key={i} style={{ padding: "12px 16px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: "var(--radius-sm)", color: "var(--color-warning)", fontSize: "12px" }}>
                    ℹ️ {warn}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "12px", color: "var(--text-muted)", fontSize: "12px" }}>No warnings.</div>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
}
