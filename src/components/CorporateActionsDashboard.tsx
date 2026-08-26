"use client";
import React, { useMemo } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, BarElement, Filler, Tooltip, Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { AnalysisResult, CorporateAction } from "@/app/page";
import { formatDateUI } from "@/utils/date";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Filler, Tooltip, Legend
);

const INR = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const ACTION_STYLE: Record<string, { pill: string; icon: string; color: string }> = {
  DEPOSIT:    { pill: "pill-deposit", icon: "💳", color: "#4f9eff" },
  WITHDRAWAL: { pill: "pill-wd",      icon: "💸", color: "#f06595" },
  DIVIDEND:   { pill: "pill-div",     icon: "🎁", color: "#fd7e14" },
  SPLIT:      { pill: "pill-split",   icon: "✂️", color: "#845ef7" },
};

function StatCard({
  icon, label, value, sub, color
}: { icon: string; label: string; value: string; sub?: string; color: string }) {
  return (
    <div
      className="summary-card"
      style={{ "--card-gradient": `linear-gradient(90deg,${color},${color}88)` } as React.CSSProperties}
    >
      <div className="card-icon">{icon}</div>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  );
}

export default function CorporateActionsDashboard({ result }: { result: AnalysisResult }) {
  const { corporateActions } = result;

  // Only filter splits and dividends
  const allActions = useMemo(() => {
    return corporateActions
      .filter(a => a.action === "DIVIDEND" || a.action === "SPLIT")
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [corporateActions]);

  const byType = useMemo(() => {
    const map: Record<string, CorporateAction[]> = {
      DIVIDEND: [], SPLIT: []
    };
    for (const a of allActions) {
      if (map[a.action]) map[a.action].push(a);
    }
    return map;
  }, [allActions]);

  // Dividends by symbol
  const dividendsBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of byType.DIVIDEND) {
      const amt = d.totalAmount !== undefined ? d.totalAmount : d.value;
      map.set(d.symbol, (map.get(d.symbol) || 0) + amt);
    }
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return entries;
  }, [byType]);

  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700 },
    plugins: {
      legend: {
        labels: { color: "#8b9ab8", font: { size: 11, family: "Inter" }, boxWidth: 10, padding: 12 }
      },
      tooltip: {
        backgroundColor: "rgba(12,18,36,0.95)",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        titleColor: "#f0f4ff",
        bodyColor: "#8b9ab8",
        padding: 12,
      },
    },
    scales: {
      x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#4a5568", font: { size: 10 } } },
      y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#4a5568", font: { size: 10 }, callback: (v: any) => `₹${(v/1000).toFixed(0)}K` } },
    },
  };

  const totalDiv = result.summary.totalDividends;

  return (
    <div>
      {/* Summary cards */}
      <div className="summary-grid fade-up" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <StatCard icon="🎁" label="Total Dividends"   value={INR(totalDiv)} sub={`${byType.DIVIDEND.length} payments`}       color="#fd7e14" />
        <StatCard icon="✂️" label="Stock Splits"      value={`${byType.SPLIT.length}`} sub="Total split events"             color="#845ef7" />
      </div>

      {/* Dividends by symbol */}
      {dividendsBySymbol.length > 0 && (
        <div className="chart-section fade-up fade-up-delay-1" style={{ marginTop: 24 }}>
          <div className="chart-header">
            <div className="chart-title">🎁 Dividends by Symbol</div>
          </div>
          <div className="chart-wrap" style={{ height: 300 }}>
            <Bar
              data={{
                labels: dividendsBySymbol.map(([s]) => s.replace(".NS","")),
                datasets: [{
                  label: "Dividend (₹)",
                  data: dividendsBySymbol.map(([, v]) => v),
                  backgroundColor: dividendsBySymbol.map((_, i) =>
                    ["#fd7e14","#ffd43b","#f06595","#845ef7","#4f9eff"][i % 5] + "bb"
                  ),
                  borderRadius: 6,
                }],
              }}
              options={{
                ...baseOpts,
                plugins: {
                  ...baseOpts.plugins,
                  legend: { display: false },
                  tooltip: { ...baseOpts.plugins.tooltip, callbacks: { label: (ctx: any) => ` Dividends: ${INR(ctx.parsed.y)}` } },
                },
              } as any}
            />
          </div>
        </div>
      )}

      {/* Action Log table */}
      <div className="chart-section fade-up fade-up-delay-2" style={{ marginTop: 24 }}>
        <div className="chart-header">
          <div className="chart-title">📋 Corporate Actions Log</div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Symbol</th>
                <th style={{ textAlign: "right" }}>Value</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {allActions.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>No corporate actions found</td></tr>
              )}
              {allActions.map((a, i) => {
                const style = ACTION_STYLE[a.action] || { pill: "", icon: "•", color: "#8b9ab8" };
                return (
                  <tr key={i}>
                    <td className="mono">{formatDateUI(a.date)}</td>
                    <td>
                      <span className={`pill ${style.pill}`}>{style.icon} {a.action}</span>
                    </td>
                    <td className="mono">{a.symbol.replace(".NS","")}</td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      {a.action === "SPLIT"
                        ? `${a.value}:1`
                        : INR(a.value)}
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                      {a.action === "DIVIDEND"   && "Dividend per share received"}
                      {a.action === "SPLIT"      && `Shares multiplied by ${a.value}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
