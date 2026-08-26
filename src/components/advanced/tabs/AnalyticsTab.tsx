"use client";

import React, { useState, useEffect } from "react";
import { AnalysisResult } from "@/lib/advancedEngine";
import OverviewDashboard from "@/components/OverviewDashboard";

export default function AnalyticsTab({ familyId, userId, brokerId }: any) {
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
          <h2 className="brand-name" style={{ margin: 0, fontSize: "16px" }}>Analytics <span>Dashboard</span></h2>
          <p className="brand-sub">
            Viewing scope: {userId ? (brokerId ? `Broker ${brokerId}` : `User ${userId}`) : `Family ${familyId || "defaultFamily"}`}
          </p>
        </div>
        <button className="template-btn" onClick={handleAnalyze} disabled={loading}>
          {loading ? "Analyzing..." : "Refresh Charts"}
        </button>
      </div>

      {error && <div style={{ color: "var(--color-negative)", background: "rgba(248,113,113,0.1)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(248,113,113,0.3)", marginBottom: "24px" }}>Error: {error}</div>}

      {!result && !loading && !error && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          Click Refresh Charts to load data for this scope.
        </div>
      )}

      {result && (
        <div style={{ marginTop: "32px" }}>
          <OverviewDashboard result={result as any} />
        </div>
      )}
    </div>
  );
}
