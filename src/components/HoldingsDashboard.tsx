"use client";
import React, { useMemo, useState } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, BarElement, Filler, Tooltip, Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { AnalysisResult } from "@/app/page";
import { formatDateUI } from "@/utils/date";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Filler, Tooltip, Legend
);

const INR = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const PALETTE = [
  "#4f9eff","#38d9a9","#845ef7","#fd7e14","#f06595",
  "#ffd43b","#51cf66","#ff6b6b","#74c0fc","#e599f7",
  "#a9e34b","#ffb347","#69db7c","#da77f2","#63e6be",
];

function subsample<T>(arr: T[], maxPoints = 180): T[] {
  if (arr.length <= maxPoints) return arr;
  const step = Math.ceil(arr.length / maxPoints);
  return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
}

const chartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 700 },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: "rgba(12,18,36,0.95)",
      borderColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      titleColor: "#f0f4ff",
      bodyColor: "#8b9ab8",
      padding: 12,
      callbacks: {
        label: (ctx: any) => ` ${ctx.dataset.label || ""}: ${INR(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    x: {
      grid: { color: "rgba(255,255,255,0.04)" },
      ticks: { color: "#4a5568", font: { size: 10 }, maxTicksLimit: 10 },
    },
    y: {
      grid: { color: "rgba(255,255,255,0.04)" },
      ticks: { color: "#4a5568", font: { size: 10 }, callback: (v: any) => `₹${(v / 1000).toFixed(0)}K` },
    },
  },
});

export default function HoldingsDashboard({ result }: { result: AnalysisResult }) {
  const { dailyPortfolio, summary } = result;
  const [selectedSymbol, setSelectedSymbol] = useState<string>(summary.uniqueStocks[0] || "");

  // All unique stock symbols that ever appeared
  const allSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const d of dailyPortfolio) {
      Object.keys(d.holdings).forEach(s => set.add(s));
    }
    return Array.from(set).sort();
  }, [dailyPortfolio]);

  // Build individual stock value series
  const stockSeries = useMemo(() => {
    if (!selectedSymbol) return null;
    const sampled = subsample(dailyPortfolio);
    const labels = sampled.map(d => formatDateUI(d.date));
    const values = sampled.map(d => d.holdings[selectedSymbol]?.value || 0);
    const shares = sampled.map(d => d.holdings[selectedSymbol]?.shares || 0);
    const prices = sampled.map(d => d.holdings[selectedSymbol]?.price || 0);
    return { labels, values, shares, prices };
  }, [dailyPortfolio, selectedSymbol]);

  // Stacked bar: top 8 stocks value across simulation history
  const topSymbols = useMemo(() => {
    const symbolMaxValues = new Map<string, number>();
    for (const d of dailyPortfolio) {
      for (const [sym, h] of Object.entries(d.holdings || {})) {
        if (h.value > (symbolMaxValues.get(sym) || 0)) {
          symbolMaxValues.set(sym, h.value);
        }
      }
    }
    return Array.from(symbolMaxValues.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([s]) => s);
  }, [dailyPortfolio]);

  const stackedSampled = useMemo(() => subsample(dailyPortfolio, 60), [dailyPortfolio]);

  const stackedBarData = {
    labels: stackedSampled.map(d => formatDateUI(d.date)),
    datasets: topSymbols.map((sym, i) => ({
      label: sym.replace(".NS",""),
      data: stackedSampled.map(d => d.holdings[sym]?.value || 0),
      backgroundColor: PALETTE[i % PALETTE.length] + "cc",
      borderColor: PALETTE[i % PALETTE.length],
      borderWidth: 0,
      stack: "portfolio",
    })),
  };

  const stackedOptions = {
    ...chartOptions(),
    plugins: {
      ...chartOptions().plugins,
      legend: {
        display: true,
        position: "top" as const,
        labels: { color: "#8b9ab8", font: { size: 11, family: "Inter" }, boxWidth: 10, padding: 12 },
      },
      tooltip: {
        ...chartOptions().plugins.tooltip,
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: ${INR(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      ...chartOptions().scales,
      x: { ...chartOptions().scales.x, stacked: true },
      y: { ...chartOptions().scales.y, stacked: true },
    },
  };

  return (
    <div>
      {/* Stacked bar chart */}
      <div className="chart-section fade-up">
        <div className="chart-header">
          <div className="chart-title">📊 Holdings Breakdown Over Time
            <span className="chart-subtitle">Top 8 stocks by current value</span>
          </div>
        </div>
        <div className="chart-wrap" style={{ height: 380 }}>
          <Bar data={stackedBarData} options={stackedOptions as any} />
        </div>
      </div>

      {/* Individual stock */}
      <div className="chart-section fade-up fade-up-delay-1">
        <div className="chart-header">
          <div className="chart-title">📈 Individual Stock Performance</div>
          <select
            className="select-control"
            value={selectedSymbol}
            onChange={e => setSelectedSymbol(e.target.value)}
          >
            {allSymbols.map(s => (
              <option key={s} value={s}>{s.replace(".NS","")}</option>
            ))}
          </select>
        </div>

        {stockSeries && (
          <div className="chart-grid-2">
            {/* Value */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>
                💰 Position Value (₹)
              </div>
              <div className="chart-wrap" style={{ height: 240 }}>
                <Line
                  data={{
                    labels: stockSeries.labels,
                    datasets: [{
                      label: "Value",
                      data: stockSeries.values,
                      borderColor: "#4f9eff",
                      backgroundColor: "rgba(79,158,255,0.1)",
                      fill: true,
                      tension: 0.3,
                      pointRadius: 0,
                      borderWidth: 2,
                    }],
                  }}
                  options={chartOptions() as any}
                />
              </div>
            </div>

            {/* Price */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>
                📉 Stock Price (₹)
              </div>
              <div className="chart-wrap" style={{ height: 240 }}>
                <Line
                  data={{
                    labels: stockSeries.labels,
                    datasets: [{
                      label: "Price",
                      data: stockSeries.prices,
                      borderColor: "#38d9a9",
                      backgroundColor: "rgba(56,217,169,0.1)",
                      fill: true,
                      tension: 0.3,
                      pointRadius: 0,
                      borderWidth: 2,
                    }],
                  }}
                  options={chartOptions() as any}
                />
              </div>
            </div>

            {/* Shares held */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>
                🧮 Shares Held
              </div>
              <div className="chart-wrap" style={{ height: 200 }}>
                <Line
                  data={{
                    labels: stockSeries.labels,
                    datasets: [{
                      label: "Shares",
                      data: stockSeries.shares,
                      borderColor: "#845ef7",
                      backgroundColor: "rgba(132,94,247,0.1)",
                      fill: true,
                      tension: 0,
                      pointRadius: 0,
                      borderWidth: 2,
                      stepped: true,
                    }],
                  }}
                  options={{
                    ...chartOptions() as any,
                    plugins: {
                      ...(chartOptions() as any).plugins,
                      tooltip: {
                        ...((chartOptions() as any).plugins.tooltip),
                        callbacks: { label: (ctx: any) => ` Shares: ${ctx.parsed.y.toFixed(2)}` },
                      },
                    },
                    scales: {
                      ...chartOptions().scales,
                      y: {
                        ...chartOptions().scales.y,
                        ticks: { ...chartOptions().scales.y.ticks, callback: (v: any) => v.toFixed(0) },
                      },
                    },
                  } as any}
                />
              </div>
            </div>

            {/* Stats panel */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>
                📋 Stock Summary
              </div>
              <div className="chart-wrap" style={{ height: 200, padding: "16px 20px" }}>
                {(() => {
                  const last = dailyPortfolio[dailyPortfolio.length - 1];
                  const h = last?.holdings[selectedSymbol];
                  const nonZero = stockSeries.prices.filter(p => p > 0);
                  const minP = Math.min(...nonZero);
                  const maxP = Math.max(...nonZero);
                  return (
                    <table className="data-table">
                      <tbody>
                        {[
                          ["Current Shares", (h?.shares || 0).toFixed(2)],
                          ["Current Price", INR(h?.price || 0)],
                          ["Current Value", INR(h?.value || 0)],
                          ["52W High (data)", INR(maxP)],
                          ["52W Low (data)", INR(minP)],
                        ].map(([label, val]) => (
                          <tr key={label}>
                            <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{label}</td>
                            <td className="mono" style={{ textAlign: "right" }}>{val}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
