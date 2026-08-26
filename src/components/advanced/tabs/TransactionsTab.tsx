"use client";

import React, { useState, useRef } from "react";
import { Trade, parseTrades } from "@/lib/advancedEngine";

export default function TransactionsTab({ familyId, userId, brokerId }: any) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    try {
      const parsed = parseTrades(buffer);
      setTrades(prev => {
        // Merge and re-sort
        const merged = [...prev, ...parsed];
        return merged.sort((a, b) => a.date.localeCompare(b.date));
      });
    } catch (err: any) {
      alert("Failed to parse file: " + err.message);
    }
    
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleEdit = (index: number, field: keyof Trade, value: any) => {
    const updated = [...trades];
    (updated[index] as any)[field] = value;
    setTrades(updated);
  };

  const handleDelete = (index: number) => {
    const updated = [...trades];
    updated.splice(index, 1);
    setTrades(updated);
  };

  const handleAddRow = () => {
    setTrades([{
      date: new Date().toISOString().slice(0, 10),
      symbol: "NEW.NS",
      rawSymbol: "NEW.NS",
      side: "Buy",
      qty: 1,
      fillPrice: 100,
      commission: 0,
      broker: brokerId || ""
    }, ...trades]);
  };

  const handleSave = async () => {
    if (!userId || !brokerId) {
      alert("Please select a User ID and Broker ID from the Scope above before saving.");
      return;
    }
    
    setIsSaving(true);
    try {
      const res = await fetch("/api/portfolio/advancedSave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyId: familyId || "defaultFamily",
          userId,
          brokerId,
          tradesJson: JSON.stringify(trades)
        })
      });

      if (!res.ok) throw new Error("Failed to save");
      alert("Saved successfully!");
    } catch (err: any) {
      alert("Save error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 className="brand-name" style={{ margin: 0, fontSize: "16px" }}>Transactions <span>Manager</span></h2>
          <p className="brand-sub">Upload CSV/Excel or manually add trades.</p>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <input type="file" ref={fileInput} style={{ display: "none" }} accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
          <button className="template-btn" onClick={() => fileInput.current?.click()}>
            <span style={{ fontSize: "14px" }}>📂</span> Upload File
          </button>
          <button className="template-btn" onClick={handleAddRow}>
            <span style={{ fontSize: "14px" }}>➕</span> Add Row
          </button>
          <button className="template-btn" style={{ background: "rgba(201,168,76,0.15)", borderColor: "var(--ms-gold)" }} onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Recalculate & Save"}
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Symbol</th>
              <th>Side</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Commission</th>
              <th>Broker</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                  No transactions yet. Upload a file or add a row.
                </td>
              </tr>
            )}
            {trades.map((t, idx) => (
              <tr key={idx}>
                <td>
                  <input type="date" value={t.date} onChange={e => handleEdit(idx, "date", e.target.value)} style={{ width: "120px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px" }} />
                </td>
                <td>
                  <input type="text" value={t.symbol} onChange={e => handleEdit(idx, "symbol", e.target.value)} style={{ width: "90px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px" }} />
                </td>
                <td>
                  <select value={t.side} onChange={e => handleEdit(idx, "side", e.target.value)} style={{ border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                    <option value="Buy">Buy</option>
                    <option value="Sell">Sell</option>
                    <option value="Transfer In">Transfer In</option>
                    <option value="Transfer Out">Transfer Out</option>
                  </select>
                </td>
                <td>
                  <input type="number" value={t.qty} onChange={e => handleEdit(idx, "qty", parseFloat(e.target.value) || 0)} style={{ width: "70px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px" }} />
                </td>
                <td>
                  <input type="number" value={t.fillPrice} onChange={e => handleEdit(idx, "fillPrice", parseFloat(e.target.value) || 0)} style={{ width: "70px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px" }} />
                </td>
                <td>
                  <input type="number" value={t.commission} onChange={e => handleEdit(idx, "commission", parseFloat(e.target.value) || 0)} style={{ width: "70px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px" }} />
                </td>
                <td>
                  <input type="text" value={t.broker || ""} onChange={e => handleEdit(idx, "broker", e.target.value)} placeholder="Default" style={{ width: "80px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px" }} />
                </td>
                <td>
                  <button onClick={() => handleDelete(idx)} style={{ color: "var(--color-negative)", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "4px", cursor: "pointer", padding: "4px 8px", fontSize: "11px" }}>✕ Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
