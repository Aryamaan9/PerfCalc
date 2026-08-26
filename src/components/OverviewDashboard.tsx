"use client";
import React, { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement,
  Filler, Tooltip, Legend, TimeScale,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { AnalysisResult } from "@/app/page";
import { formatDateUI } from "@/utils/date";
import * as XLSX from "xlsx";

ChartJS.register(
  CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement,
  Filler, Tooltip, Legend, TimeScale
);

const INR = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const PALETTE = [
  "#c9a84c","#845ef7","#4f9eff","#38d9a9","#f06595",
  "#ffd43b","#51cf66","#ff6b6b","#a78bfa","#e599f7",
  "#86efac","#fca5a5","#93c5fd","#d8b4fe","#6ee7b7",
];

function SummaryCards({ result }: { result: AnalysisResult }) {
  const { summary, dailyPortfolio } = result;
  const lastDay = dailyPortfolio[dailyPortfolio.length - 1];
  const ret = summary.holdingReturn;

  const cards = [
    {
      icon: "💼",
      label: "Current Portfolio Value",
      value: INR(summary.currentValue),
      sub: "Value of stock holdings",
      grad: "linear-gradient(90deg,#c9a84c,#e8cc70)",
      tooltip: lastDay ? "Market value of all active stock holdings." : undefined,
    },
    {
      icon: "💰",
      label: "Total Invested",
      value: INR(summary.totalInvested),
      sub: "Cost basis of active holdings",
      grad: "linear-gradient(90deg,#845ef7,#c9a84c)",
    },
    {
      icon: ret >= 0 ? "📈" : "📉",
      label: "Holding Return",
      value: `${ret >= 0 ? "+" : ""}${ret.toFixed(2)}%`,
      sub: `P&L: ${INR(summary.currentValue - summary.totalInvested)}`,
      grad: ret >= 0 ? "linear-gradient(90deg,#4ade80,#38d9a9)" : "linear-gradient(90deg,#f87171,#f06595)",
      valueClass: ret >= 0 ? "card-positive" : "card-negative",
    },
    {
      icon: "🏔️",
      label: "Peak Portfolio Value",
      value: INR(summary.peakValue),
      sub: `Drawdown: ${INR(summary.peakValue - summary.currentValue)}`,
      grad: "linear-gradient(90deg,#c9a84c,#845ef7)",
    },
    {
      icon: "🎁",
      label: "Total Dividends",
      value: INR(summary.totalDividends),
      sub: "Received in cash",
      grad: "linear-gradient(90deg,#e8cc70,#c9a84c)",
    },
    {
      icon: "📊",
      label: "Stocks in Portfolio",
      value: `${summary.uniqueStocks.length}`,
      sub: summary.uniqueStocks.slice(0, 3).join(", ") + (summary.uniqueStocks.length > 3 ? "…" : ""),
      grad: "linear-gradient(90deg,#845ef7,#c9a84c)",
    },
  ];

  return (
    <div className="summary-grid fade-up">
      {cards.map((c, i) => (
        <div
          key={i}
          className="summary-card"
          title={c.tooltip}
          style={{ cursor: c.tooltip ? "help" : "default", "--card-gradient": c.grad } as React.CSSProperties}
        >
          <div className="card-icon">{c.icon}</div>
          <div className="card-label">{c.label}</div>
          <div className={`card-value ${c.valueClass || ""}`}>{c.value}</div>
          <div className="card-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

const CHART_OPTIONS_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 800 },
  plugins: {
    legend: {
      labels: { color: "#b8a8d8", font: { size: 11, family: "Inter" }, boxWidth: 10, padding: 14 },
    },
    tooltip: {
      backgroundColor: "rgba(15,0,34,0.97)",
      borderColor: "rgba(201,168,76,0.25)",
      borderWidth: 1,
      titleColor: "#f8f4ff",
      bodyColor: "#b8a8d8",
      padding: 12,
      callbacks: {
        label: (ctx: any) => ` ${ctx.dataset.label}: ${INR(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    x: {
      grid: { color: "rgba(201,168,76,0.05)" },
      ticks: { color: "#6b5a8a", font: { size: 10 }, maxTicksLimit: 12 },
    },
    y: {
      grid: { color: "rgba(201,168,76,0.05)" },
      ticks: { color: "#6b5a8a", font: { size: 10 }, callback: (v: any) => `₹${(v/1000).toFixed(0)}K` },
    },
  },
};

function subsample<T>(arr: T[], maxPoints = 180): T[] {
  if (arr.length <= maxPoints) return arr;
  const step = Math.ceil(arr.length / maxPoints);
  return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
}

// Helper to export full portfolio analysis to multi-sheet Excel (.xlsx) file
function downloadPortfolioExcel(result: AnalysisResult) {
  const { dailyPortfolio, summary } = result;
  const lastDay = dailyPortfolio[dailyPortfolio.length - 1];

  // 1. Summary Sheet
  const summaryData = [
    ["Portfolio Analytics Summary", ""],
    ["", ""],
    ["Metric", "Value"],
    ["Current Portfolio Value (INR)", lastDay?.totalValue || 0],
    ["Current Stock Value (INR)", lastDay?.stockValue || 0],
    ["Total Invested (INR)", summary.totalInvested],
    ["Holding Return", `${summary.holdingReturn.toFixed(2)}%`],
    ["Net P&L (INR)", (lastDay?.totalValue || 0) - summary.totalInvested],
    ["Peak Portfolio Value (INR)", summary.peakValue],
    ["Total Dividends Received (INR)", summary.totalDividends],
    ["Number of Unique Stocks", summary.uniqueStocks.length],
    ["Statement Start Date", formatDateUI(summary.dateRange.start)],
    ["Statement End Date", formatDateUI(summary.dateRange.end)],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

  // 2. Daily Balances Sheet
  const dailyData = [
    ["Date", "Stock Value (INR)", "Total Portfolio Value (INR)"],
    ...dailyPortfolio.map(d => [
      formatDateUI(d.date),
      d.stockValue,
      d.totalValue
    ])
  ];
  const wsDaily = XLSX.utils.aoa_to_sheet(dailyData);

  // 3. Current Holdings Sheet
  const holdingsData = [
    ["Symbol", "Shares Held", "Close Price (INR)", "Holding Value (INR)", "Weight (%)"],
    ...Object.entries(lastDay?.holdings || {})
      .map(([sym, h]) => {
        const weight = lastDay.stockValue > 0 ? (h.value / lastDay.stockValue) * 100 : 0;
        return [
          sym.replace(".NS", ""),
          h.shares,
          h.price,
          h.value,
          parseFloat(weight.toFixed(2))
        ] as [string, number, number, number, number];
      })
      .sort((a, b) => b[3] - a[3])
  ];
  const wsHoldings = XLSX.utils.aoa_to_sheet(holdingsData);

  // Create workbook and append sheets
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSummary, "Overview Summary");
  XLSX.utils.book_append_sheet(wb, wsDaily, "Daily Balances");
  XLSX.utils.book_append_sheet(wb, wsHoldings, "Current Holdings");

  // Trigger download
  XLSX.writeFile(wb, `portfolio_analysis_report_${summary.dateRange.end}.xlsx`);
}

export default function OverviewDashboard({ result }: { result: AnalysisResult }) {
  const { dailyPortfolio } = result;
  const [showPeriod, setShowPeriod] = useState<"all" | "1y" | "6m" | "3m" | "1m">("all");
  const [viewType, setViewType] = useState<"graph" | "table">("graph");

  const filtered = useMemo(() => {
    const now = new Date(dailyPortfolio[dailyPortfolio.length - 1]?.date || new Date());
    const cutoffs: Record<string, Date> = {
      "1m": new Date(now.getTime() - 30 * 86400000),
      "3m": new Date(now.getTime() - 90 * 86400000),
      "6m": new Date(now.getTime() - 180 * 86400000),
      "1y": new Date(now.getTime() - 365 * 86400000),
    };
    if (showPeriod === "all") return dailyPortfolio;
    const cut = cutoffs[showPeriod].toISOString().slice(0, 10);
    return dailyPortfolio.filter(d => d.date >= cut);
  }, [dailyPortfolio, showPeriod]);

  const sampled = useMemo(() => subsample(filtered), [filtered]);

  const labels = sampled.map(d => formatDateUI(d.date.slice(0, 10)));

  // Chart 1: Area — Total portfolio value
  const areaData = {
    labels,
    datasets: [
      {
        label: "Portfolio Value",
        data: sampled.map(d => d.stockValue),
        borderColor: "#c9a84c",
        backgroundColor: "rgba(201,168,76,0.08)",
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2.5,
      },
    ],
  };

  // Chart 2: Donut — Current holdings breakdown
  const lastDay = dailyPortfolio[dailyPortfolio.length - 1];
  const holdingEntries = Object.entries(lastDay?.holdings || {})
    .map(([sym, h]) => ({ sym, value: h.value }))
    .filter(h => h.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const donutData = {
    labels: holdingEntries.map(h => h.sym.replace(".NS", "")),
    datasets: [{
      data: holdingEntries.map(h => h.value),
      backgroundColor: PALETTE.slice(0, holdingEntries.length),
      borderColor: "rgba(6,9,18,0.8)",
      borderWidth: 2,
      hoverOffset: 10,
    }],
  };

  const periods = ["1m","3m","6m","1y","all"] as const;

  return (
    <div>
      <SummaryCards result={result} />

      {/* Period selector */}
      <div className="chart-section fade-up fade-up-delay-1">
        <div className="chart-header">
          <div className="chart-title">📊 Portfolio Value Over Time
            <span className="chart-subtitle">Stock holdings value</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {/* Download Report Excel */}
            <button
              onClick={() => downloadPortfolioExcel(result)}
              className="template-btn"
              style={{
                textDecoration: "none",
                padding: "5px 12px",
                fontSize: "11px",
                borderColor: "var(--ms-gold)",
                background: "rgba(201,168,76,0.15)",
                color: "var(--ms-gold-bright)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                height: "32px",
                lineHeight: "20px"
              }}
            >
              📥 DOWNLOAD REPORT (EXCEL)
            </button>

            {/* Chart / Table Toggle */}
            <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden", background: "rgba(255,255,255,0.02)", height: "32px" }}>
              <button
                onClick={() => setViewType("graph")}
                style={{
                  border: "none",
                  padding: "0 12px",
                  fontSize: "10px",
                  fontWeight: "700",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                  background: viewType === "graph" ? "var(--ms-gold)" : "transparent",
                  color: viewType === "graph" ? "var(--ms-purple-deepest)" : "var(--text-muted)",
                  transition: "all 0.2s"
                }}
              >
                📈 CHART
              </button>
              <button
                onClick={() => setViewType("table")}
                style={{
                  border: "none",
                  padding: "0 12px",
                  fontSize: "10px",
                  fontWeight: "700",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                  background: viewType === "table" ? "var(--ms-gold)" : "transparent",
                  color: viewType === "table" ? "var(--ms-purple-deepest)" : "var(--text-muted)",
                  transition: "all 0.2s"
                }}
              >
                📋 TABLE
              </button>
            </div>

            {/* Timeframe Selectors */}
            <div style={{ display: "flex", gap: "4px", height: "32px" }}>
              {periods.map(p => (
                <button
                  key={p}
                  onClick={() => setShowPeriod(p)}
                  className={`period-btn ${showPeriod === p ? 'period-btn-active' : 'period-btn-inactive'}`}
                  style={{ height: "32px" }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {viewType === "graph" ? (
          <div className="chart-wrap" style={{ height: 320 }}>
            <Line data={areaData} options={CHART_OPTIONS_BASE as any} />
          </div>
        ) : (
          <div className="table-wrap" style={{ height: 320, overflow: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Portfolio Value (₹)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice().reverse().map((d) => (
                  <tr key={d.date}>
                    <td className="mono">{formatDateUI(d.date)}</td>
                    <td 
                      className="mono positive" 
                      style={{ fontWeight: 600, cursor: "help" }}
                      title={`Calculation:\n${
                        Object.entries(d.holdings || {}).length > 0
                          ? Object.entries(d.holdings)
                              .map(([sym, h]) => `${sym.replace(".NS", "")}: ${h.shares.toFixed(2)} shares × ${INR(h.price)} = ${INR(h.value)}`)
                              .join("\n")
                          : "No stock holdings on this day."
                      }\n\nTotal Stock Value: ${INR(d.stockValue)}`}
                    >
                      {INR(d.stockValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two-column */}
      <div className="chart-grid-2 fade-up fade-up-delay-2">
        {/* Donut */}
        <div>
          <div className="chart-header">
            <div className="chart-title">🍩 Current Holdings Breakdown</div>
          </div>
          <div className="chart-wrap" style={{ height: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {holdingEntries.length > 0 ? (
              <Doughnut
                data={donutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: "60%",
                  animation: { duration: 800 },
                  plugins: {
                    legend: {
                      position: "right",
                      labels: { color: "#b8a8d8", font: { size: 11, family: "Inter" }, boxWidth: 10, padding: 10 },
                    },
                    tooltip: {
                      backgroundColor: "rgba(15,0,34,0.97)",
                      borderColor: "rgba(201,168,76,0.25)",
                      borderWidth: 1,
                      titleColor: "#f8f4ff",
                      bodyColor: "#b8a8d8",
                      callbacks: {
                        label: (ctx: any) => ` ${ctx.label}: ${INR(ctx.parsed)} (${((ctx.parsed / lastDay.stockValue) * 100).toFixed(1)}%)`,
                      },
                    },
                  },
                } as any}
              />
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>No current stock holdings</div>
            )}
          </div>
        </div>

        {/* Top holdings table */}
        <div>
          <div className="chart-header">
            <div className="chart-title">🏆 Top Holdings</div>
          </div>
          <div className="chart-wrap" style={{ height: 340, overflow: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Shares</th>
                  <th>Price (₹)</th>
                  <th>Value (₹)</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {holdingEntries.map((h, i) => (
                  <tr key={h.sym}>
                    <td>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: PALETTE[i], display: "inline-block", marginRight: 8 }} />
                      <span className="mono">{h.sym.replace(".NS", "")}</span>
                    </td>
                    <td className="mono">{(lastDay.holdings[h.sym]?.shares || 0).toFixed(2)}</td>
                    <td className="mono">{INR(lastDay.holdings[h.sym]?.price || 0)}</td>
                    <td className="mono positive">{INR(h.value)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ height: 6, width: `${Math.min(100, (h.value / lastDay.stockValue) * 100)}%`, minWidth: 4, background: PALETTE[i], borderRadius: 3, maxWidth: 80 }} />
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                          {((h.value / lastDay.stockValue) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
