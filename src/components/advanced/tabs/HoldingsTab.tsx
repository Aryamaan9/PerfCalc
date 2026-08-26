"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AnalysisResult } from "@/lib/advancedEngine";

export default function HoldingsTab({ familyId, userId, brokerId }: any) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [snapshotDate, setSnapshotDate] = useState("");

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
      if (data.dailyPortfolio?.length > 0) {
        setSnapshotDate(data.dailyPortfolio[data.dailyPortfolio.length - 1].date);
      }
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

  const { selectedHoldings, selectedSnapshot } = useMemo(() => {
    if (!result || !result.dailyPortfolio) return { selectedHoldings: {}, selectedSnapshot: null };
    
    // Find closest date before or equal to snapshotDate
    const pastSnapshots = result.dailyPortfolio.filter(d => d.date <= snapshotDate);
    if (pastSnapshots.length > 0) {
      const snap = pastSnapshots[pastSnapshots.length - 1];
      return { selectedHoldings: snap.holdings, selectedSnapshot: snap };
    }
    return { selectedHoldings: {}, selectedSnapshot: null };
  }, [result, snapshotDate]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 className="brand-name" style={{ margin: 0, fontSize: "16px" }}>Holdings <span>& Audit Report</span></h2>
          <p className="brand-sub">Point-in-time holdings and system abnormality auditing.</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {result && (
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <label style={{ fontSize: "11px", color: "var(--ms-gold)", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: "12px", fontWeight: "bold" }}>Snapshot Date:</label>
              <input type="date" value={snapshotDate} onChange={e => setSnapshotDate(e.target.value)} style={{ background: "transparent", border: "none", color: "white", outline: "none", fontFamily: "var(--font-mono)", fontSize: "13px", cursor: "pointer" }} />
            </div>
          )}
          <button className="template-btn" onClick={handleAnalyze} disabled={loading} style={{ padding: "8px 16px", borderColor: "var(--ms-gold)" }}>
            {loading ? "Analyzing..." : "Refresh Audit"}
          </button>
        </div>
      </div>

      {error && <div style={{ color: "var(--color-negative)", background: "rgba(248,113,113,0.1)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(248,113,113,0.3)", marginBottom: "24px" }}>Error: {error}</div>}

      {!result && !loading && !error && (
        <div style={{ padding: "60px", textAlign: "center", background: "rgba(0,0,0,0.1)", borderRadius: "var(--radius-md)", border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "24px", marginBottom: "12px" }}>🔍</div>
          Click <strong>Refresh Audit</strong> to load data for this scope.
        </div>
      )}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {selectedSnapshot && (
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "200px", padding: "16px", background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", borderLeft: "3px solid var(--ms-gold)" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>Total Value</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>{formatCurrency(selectedSnapshot.totalValue)}</div>
              </div>
              <div style={{ flex: 1, minWidth: "200px", padding: "16px", background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", borderLeft: "3px solid var(--color-positive)" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>Stock Value</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>{formatCurrency(selectedSnapshot.stockValue)}</div>
              </div>
              <div style={{ flex: 1, minWidth: "200px", padding: "16px", background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", borderLeft: "3px solid var(--color-blue, #60A5FA)" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>Cash Balance</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>{formatCurrency(selectedSnapshot.cashBalance)}</div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            
            {/* Holdings Table */}
            <div style={{ flex: 1.5, minWidth: "400px" }}>
              <div className="chart-header">
                <h3 className="chart-title">Holdings as of {snapshotDate}</h3>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th style={{ textAlign: "right" }}>Shares</th>
                      <th style={{ textAlign: "right" }}>Price</th>
                      <th style={{ textAlign: "right" }}>Cost Basis</th>
                      <th style={{ textAlign: "right" }}>Total Value</th>
                      <th style={{ textAlign: "right" }}>Unrealized P&L</th>
                      <th style={{ textAlign: "right" }}>Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(selectedHoldings).length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>No holdings for this date.</td>
                      </tr>
                    )}
                    {Object.entries(selectedHoldings).map(([sym, holding]: any) => {
                      const weight = selectedSnapshot?.stockValue ? (holding.value / selectedSnapshot.stockValue) * 100 : 0;
                      const pnlColor = holding.pnl >= 0 ? "var(--color-positive)" : "var(--color-negative)";
                      return (
                        <tr key={sym}>
                          <td style={{ fontWeight: "bold", color: "var(--text-primary)" }}>{sym}</td>
                          <td style={{ textAlign: "right" }}>{holding.shares.toFixed(2)}</td>
                          <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>{formatCurrency(holding.price)}</td>
                          <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>{formatCurrency(holding.cost || 0)}</td>
                          <td style={{ textAlign: "right", color: "var(--text-primary)" }}>{formatCurrency(holding.value)}</td>
                          <td style={{ textAlign: "right", color: pnlColor }}>
                            {holding.pnl >= 0 ? "+" : ""}{formatCurrency(holding.pnl || 0)}
                          </td>
                          <td style={{ textAlign: "right", color: "var(--text-muted)", fontSize: "11px" }}>{weight.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit Report */}
            <div style={{ flex: 1, minWidth: "350px", display: "flex", flexDirection: "column", gap: "24px" }}>
              <div>
                <div className="chart-header">
                  <h3 className="chart-title">Abnormality Audit Report</h3>
                </div>
                
                {result.auditAlerts && result.auditAlerts.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {result.auditAlerts.map((alert, i) => (
                      <div key={i} style={{ padding: "12px 16px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderLeft: "3px solid var(--color-negative)", borderRadius: "var(--radius-sm)", color: "var(--color-negative)", fontSize: "12px", lineHeight: "1.5" }}>
                        <strong>⚠️ Abnormality Detected:</strong><br/>{alert}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "16px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderLeft: "3px solid var(--color-positive)", borderRadius: "var(--radius-sm)", color: "var(--color-positive)", fontSize: "13px" }}>
                    ✅ <strong>Passed:</strong> Zero abnormalities detected. Cash, holdings, and pricing are stable across the timeline.
                  </div>
                )}
              </div>

              <div>
                <div className="chart-header">
                  <h3 className="chart-title">Reconciliation Warnings</h3>
                </div>
                {result.reconciliationWarnings && result.reconciliationWarnings.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {result.reconciliationWarnings.map((warn, i) => (
                      <div key={i} style={{ padding: "12px 16px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderLeft: "3px solid var(--color-warning)", borderRadius: "var(--radius-sm)", color: "var(--color-warning)", fontSize: "12px", lineHeight: "1.5" }}>
                        ℹ️ {warn}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px dashed var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-muted)", fontSize: "13px" }}>
                    No warnings found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
