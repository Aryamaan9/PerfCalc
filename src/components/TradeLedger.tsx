"use client";
import React, { useMemo, useState } from "react";
import { AnalysisResult } from "@/app/page";
import { formatDateUI } from "@/utils/date";

const INR = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v);

export default function TradeLedger({ result }: { result: AnalysisResult }) {
  const { tradeLog } = result;
  const [filterSide, setFilterSide] = useState<string>("all");
  const [filterSym, setFilterSym] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const allSymbols = useMemo(() => {
    return ["all", ...Array.from(new Set(tradeLog.map(t => t.rawSymbol))).sort()];
  }, [tradeLog]);

  const allSides = useMemo(() => {
    return ["all", ...Array.from(new Set(tradeLog.map(t => t.side))).sort()];
  }, [tradeLog]);

  const filtered = useMemo(() => {
    return tradeLog.filter(t => {
      if (filterSide !== "all" && t.side !== filterSide) return false;
      if (filterSym !== "all" && t.rawSymbol !== filterSym) return false;
      return true;
    }).reverse(); // most recent first
  }, [tradeLog, filterSide, filterSym]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const sideStyle: Record<string, string> = {
    buy: "pill-buy", Buy: "pill-buy",
    sell: "pill-sell", Sell: "pill-sell",
    deposit: "pill-deposit", Deposit: "pill-deposit",
    withdrawal: "pill-wd", Withdrawal: "pill-wd",
  };

  return (
    <div>
      {/* Filters */}
      <div className="fade-up" style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Side:</span>
          <select className="select-control" value={filterSide} onChange={e => { setFilterSide(e.target.value); setPage(0); }}>
            {allSides.map(s => <option key={s} value={s}>{s === "all" ? "All" : s}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Symbol:</span>
          <select className="select-control" value={filterSym} onChange={e => { setFilterSym(e.target.value); setPage(0); }}>
            {allSymbols.map(s => <option key={s} value={s}>{s === "all" ? "All Symbols" : s}</option>)}
          </select>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-secondary)" }}>
          {filtered.length} trades · Page {page + 1}/{Math.max(1, totalPages)}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap fade-up fade-up-delay-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Symbol</th>
              <th>Side</th>
              <th style={{ textAlign: "right" }}>Qty</th>
              <th style={{ textAlign: "right" }}>Fill Price (₹)</th>
              <th style={{ textAlign: "right" }}>Commission (₹)</th>
              <th style={{ textAlign: "right" }}>Value (₹)</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>No trades found</td></tr>
            )}
            {paginated.map((t, i) => (
              <tr key={i}>
                <td className="mono">{formatDateUI(t.date)}</td>
                <td>
                  <span className="mono">{t.rawSymbol}</span>
                  {t.rawSymbol !== t.symbol && (
                    <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6 }}>→ {t.symbol}</span>
                  )}
                </td>
                <td>
                  <span className={`pill ${sideStyle[t.side] || ""}`}>{t.side}</span>
                </td>
                <td className="mono" style={{ textAlign: "right" }}>{t.qty.toLocaleString("en-IN")}</td>
                <td className="mono" style={{ textAlign: "right" }}>{t.fillPrice > 0 ? INR(t.fillPrice) : "—"}</td>
                <td className="mono" style={{ textAlign: "right" }}>{t.commission > 0 ? INR(t.commission) : "—"}</td>
                <td className={`mono ${t.side === "Buy" ? "negative" : t.side === "Sell" ? "positive" : "neutral"}`} style={{ textAlign: "right" }}>
                  {t.fillPrice > 0 ? INR(t.qty * t.fillPrice) : INR(t.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="select-control"
            style={{ cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.4 : 1 }}
          >← Prev</button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            const p = page < 4 ? i : page - 3 + i;
            if (p >= totalPages) return null;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="select-control"
                style={{
                  background: p === page ? "rgba(79,158,255,0.2)" : "transparent",
                  borderColor: p === page ? "var(--accent-blue)" : "var(--border)",
                  color: p === page ? "var(--accent-blue)" : "var(--text-secondary)",
                  cursor: "pointer",
                  minWidth: 36,
                }}
              >{p + 1}</button>
            );
          })}
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="select-control"
            style={{ cursor: page === totalPages - 1 ? "not-allowed" : "pointer", opacity: page === totalPages - 1 ? 0.4 : 1 }}
          >Next →</button>
        </div>
      )}
    </div>
  );
}
