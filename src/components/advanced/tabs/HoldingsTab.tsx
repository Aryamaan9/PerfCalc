"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AnalysisResult } from "@/lib/advancedEngine";

export default function HoldingsTab({ familyId, userId, brokerId }: any) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [snapshotDate, setSnapshotDate] = useState("");
  const [showClosed, setShowClosed] = useState(false);

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
    if (userId) {
      handleAnalyze();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, userId, brokerId]);

  const { snapshot, cashBalance } = useMemo(() => {
    if (!result || !result.dailyPortfolio) return { snapshot: {}, cashBalance: 0 };
    let snap = result.dailyPortfolio.find(d => d.date === snapshotDate);
    if (!snap) {
      const pastSnapshots = result.dailyPortfolio.filter(d => d.date <= snapshotDate);
      if (pastSnapshots.length > 0) snap = pastSnapshots[pastSnapshots.length - 1];
    }
    return {
      snapshot: snap?.holdings || {},
      cashBalance: snap?.cashBalance || 0
    };
  }, [result, snapshotDate]);

  const activeHoldings = useMemo(() => {
    return Object.entries(snapshot).filter(([_, h]: any) => h.shares > 0);
  }, [snapshot]);

  const closedPositions = useMemo(() => {
    return Object.entries(snapshot).filter(([_, h]: any) => h.shares <= 0 && Math.abs(h.realizedGain) >= 0.01);
  }, [snapshot]);

  const totals = useMemo(() => {
    let cost = 0, value = 0, unrealized = 0, realized = 0;
    activeHoldings.forEach(([_, h]: any) => {
      cost += h.cost || 0;
      value += h.value || 0;
      unrealized += h.unrealizedGain || 0;
    });
    Object.values(snapshot).forEach((h: any) => {
      realized += h.realizedGain || 0;
    });
    return { cost, value, unrealized, realized };
  }, [activeHoldings, snapshot]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 className="brand-name" style={{ margin: 0, fontSize: "16px" }}>Holdings <span>& Performance</span></h2>
          <p className="brand-sub">FIFO cost basis, realized gains, and point-in-time valuation.</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {result && (
            <>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Snapshot Date:</label>
              <input type="date" value={snapshotDate} onChange={e => setSnapshotDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "12px" }} />
            </>
          )}
          <button className="template-btn" onClick={handleAnalyze} disabled={loading}>
            {loading ? "Analyzing..." : "Refresh Report"}
          </button>
        </div>
      </div>

      {error && <div style={{ color: "var(--color-negative)", background: "rgba(248,113,113,0.1)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(248,113,113,0.3)", marginBottom: "24px" }}>Error: {error}</div>}

      {!result && !loading && !error && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          Click Refresh Report to load data for this scope.
        </div>
      )}

      {result && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "32px" }}>
            <div className="stat-card">
              <div className="stat-label">Total Portfolio Value</div>
              <div className="stat-value">₹{(totals.value + cashBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Invested Cost</div>
              <div className="stat-value">₹{totals.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Unrealized Gain</div>
              <div className={`stat-value ${totals.unrealized >= 0 ? 'positive' : 'negative'}`}>
                {totals.unrealized >= 0 ? '+' : '-'}${Math.abs(totals.unrealized).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Realized Gain</div>
              <div className={`stat-value ${totals.realized >= 0 ? 'positive' : 'negative'}`}>
                {totals.realized >= 0 ? '+' : '-'}${Math.abs(totals.realized).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Cash Balance</div>
              <div className="stat-value">₹{cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div className="chart-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 className="chart-title">Active Holdings</h3>
            <button 
              onClick={() => setShowClosed(!showClosed)}
              style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "4px 12px", borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: "12px" }}
            >
              {showClosed ? "Hide Closed Positions" : "Show Closed Positions"}
            </button>
          </div>
          
          <div className="table-wrap" style={{ marginBottom: "32px" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th style={{ textAlign: "right" }}>Price</th>
                  <th style={{ textAlign: "right" }}>Qty</th>
                  <th style={{ textAlign: "right" }}>Cost (FIFO)</th>
                  <th style={{ textAlign: "right" }}>Value</th>
                  <th style={{ textAlign: "right" }}>Unrealized Gain</th>
                  <th style={{ textAlign: "right" }}>Realized Gain</th>
                </tr>
              </thead>
              <tbody>
                {activeHoldings.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>No active holdings for this date.</td>
                  </tr>
                )}
                {activeHoldings.map(([sym, h]: any) => (
                  <tr key={sym}>
                    <td style={{ fontWeight: "bold" }}>{sym}</td>
                    <td style={{ textAlign: "right" }}>₹{(h.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: "right" }}>{(h.shares || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td style={{ textAlign: "right" }}>₹{(h.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: "right" }}>₹{(h.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: "right" }} className={(h.unrealizedGain || 0) >= 0 ? "positive" : "negative"}>
                      {(h.unrealizedGain || 0) > 0 ? "+" : ""}${(h.unrealizedGain || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: "right" }} className={(h.realizedGain || 0) >= 0 ? "positive" : "negative"}>
                      {(h.realizedGain || 0) > 0 ? "+" : ""}${(h.realizedGain || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              {activeHoldings.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: "bold", background: "rgba(255,255,255,0.05)" }}>
                    <td>Total</td>
                    <td></td>
                    <td></td>
                    <td style={{ textAlign: "right" }}>₹{(totals.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: "right" }}>₹{(totals.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: "right" }} className={(totals.unrealized || 0) >= 0 ? "positive" : "negative"}>
                      {(totals.unrealized || 0) > 0 ? "+" : ""}${(totals.unrealized || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {showClosed && (
            <div style={{ opacity: 0.8 }}>
              <div className="chart-header">
                <h3 className="chart-title">Closed Positions</h3>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th style={{ textAlign: "right" }}>Qty</th>
                      <th style={{ textAlign: "right" }}>Value</th>
                      <th style={{ textAlign: "right" }}>Realized Gain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedPositions.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>No closed positions with realized gains.</td>
                      </tr>
                    )}
                    {closedPositions.map(([sym, h]: any) => (
                      <tr key={sym}>
                        <td style={{ fontWeight: "bold" }}>{sym}</td>
                        <td style={{ textAlign: "right" }}>0</td>
                        <td style={{ textAlign: "right" }}>₹0.00</td>
                        <td style={{ textAlign: "right" }} className={(h.realizedGain || 0) >= 0 ? "positive" : "negative"}>
                          {(h.realizedGain || 0) > 0 ? "+" : ""}${(h.realizedGain || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
