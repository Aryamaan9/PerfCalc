import React, { useState, useRef, useMemo } from "react";
import { Trade, parseTrades } from "@/lib/advancedEngine";

export default function TransactionsTab({ familyId, userId, brokerId, trades, setTrades, actions, setActions, setHasUnsavedChanges }: any) {
  const [isSaving, setIsSaving] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [sortKey, setSortKey] = useState<keyof Trade>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    try {
      const parsed = parseTrades(buffer);
      setTrades((prev: any) => {
        const merged = [...prev, ...parsed];
        return merged.sort((a, b) => a.date.localeCompare(b.date));
      });
      setHasUnsavedChanges(true);
    } catch (err: any) {
      alert("Failed to parse file: " + err.message);
    }
    
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleEdit = (t: Trade, field: keyof Trade, value: any) => {
    const updated = trades.map((item: Trade) => item === t ? { ...item, [field]: value } : item);
    setTrades(updated);
    setHasUnsavedChanges(true);
  };

  const handleDelete = (t: Trade) => {
    if (t.linkedActionId && setActions && actions) {
      const updatedActions = actions.map((a: any) => a.id === t.linkedActionId ? { ...a, status: "PENDING" } : a);
      setActions(updatedActions);
    }
    setTrades(trades.filter((item: Trade) => item !== t));
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!userId) {
      alert("Please select a User ID from the Scope above before saving.");
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
          brokerId, // Can be empty if aggregated
          tradesJson: JSON.stringify(trades)
        })
      });

      if (!res.ok) throw new Error("Failed to save");
      
      // Trigger background auto-fetch for corporate actions
      fetch("/api/portfolio/advancedAutoFetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyId: familyId || "defaultFamily",
          userId,
          brokerId
        })
      }).catch(err => console.error("AutoFetch background error:", err));

      alert("Saved successfully!");
      setHasUnsavedChanges(false);
    } catch (err: any) {
      alert("Save error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSort = (key: keyof Trade) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const filteredAndSortedTrades = useMemo(() => {
    let filtered = trades.filter((t: Trade) => t.symbol.toLowerCase().includes(filterText.toLowerCase()) || t.side.toLowerCase().includes(filterText.toLowerCase()));
    
    filtered.sort((a: any, b: any) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [trades, filterText, sortKey, sortOrder]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 className="brand-name" style={{ margin: 0, fontSize: "16px" }}>Transactions <span>Manager</span></h2>
          <p className="brand-sub">Upload CSV/Excel or manually add trades.</p>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <input type="text" placeholder="Search symbol or side..." value={filterText} onChange={e => setFilterText(e.target.value)} style={{ padding: "8px 12px", borderRadius: "4px", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "white", fontSize: "12px", width: "180px" }} />
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
              <th onClick={() => handleSort("date")} style={{ cursor: "pointer" }}>Date {sortKey === "date" && (sortOrder === "asc" ? "↑" : "↓")}</th>
              <th onClick={() => handleSort("symbol")} style={{ cursor: "pointer" }}>Symbol {sortKey === "symbol" && (sortOrder === "asc" ? "↑" : "↓")}</th>
              <th onClick={() => handleSort("side")} style={{ cursor: "pointer" }}>Side {sortKey === "side" && (sortOrder === "asc" ? "↑" : "↓")}</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Commission</th>
              <th onClick={() => handleSort("broker")} style={{ cursor: "pointer" }}>Broker {sortKey === "broker" && (sortOrder === "asc" ? "↑" : "↓")}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedTrades.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                  No transactions found.
                </td>
              </tr>
            )}
            {filteredAndSortedTrades.map((t: Trade, idx: number) => (
              <tr key={idx}>
                <td>
                  <input type="date" value={t.date} onChange={e => handleEdit(t, "date", e.target.value)} disabled={!!t.linkedActionId} style={{ width: "120px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px", opacity: t.linkedActionId ? 0.5 : 1 }} />
                </td>
                <td>
                  <input type="text" value={t.symbol} onChange={e => handleEdit(t, "symbol", e.target.value)} disabled={!!t.linkedActionId} style={{ width: "90px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px", opacity: t.linkedActionId ? 0.5 : 1 }} />
                </td>
                <td>
                  <select value={t.side} onChange={e => handleEdit(t, "side", e.target.value)} disabled={!!t.linkedActionId} style={{ border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px", opacity: t.linkedActionId ? 0.5 : 1 }}>
                    <option value="Buy">Buy</option>
                    <option value="Sell">Sell</option>
                    <option value="Transfer In">Transfer In</option>
                    <option value="Transfer Out">Transfer Out</option>
                    <option value="Split Adjust">Split Adjust</option>
                    <option value="Dividend Payout">Dividend Payout</option>
                    <option value="Bonus Issue">Bonus Issue</option>
                    <option value="Merger Swap">Merger Swap</option>
                  </select>
                </td>
                <td>
                  <input type="number" value={t.qty} onChange={e => handleEdit(t, "qty", parseFloat(e.target.value) || 0)} disabled={!!t.linkedActionId} style={{ width: "70px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px", opacity: t.linkedActionId ? 0.5 : 1 }} />
                </td>
                <td>
                  <input type="number" value={t.fillPrice} onChange={e => handleEdit(t, "fillPrice", parseFloat(e.target.value) || 0)} disabled={!!t.linkedActionId} style={{ width: "70px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px", opacity: t.linkedActionId ? 0.5 : 1 }} />
                </td>
                <td>
                  <input type="number" value={t.commission} onChange={e => handleEdit(t, "commission", parseFloat(e.target.value) || 0)} disabled={!!t.linkedActionId} style={{ width: "70px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px", opacity: t.linkedActionId ? 0.5 : 1 }} />
                </td>
                <td>
                  <input type="text" value={t.broker || ""} onChange={e => handleEdit(t, "broker", e.target.value)} disabled={!!t.linkedActionId} placeholder="Default" style={{ width: "80px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px", opacity: t.linkedActionId ? 0.5 : 1 }} />
                </td>
                <td>
                  <button onClick={() => handleDelete(t)} style={{ color: "var(--color-negative)", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "4px", cursor: "pointer", padding: "4px 8px", fontSize: "11px" }}>✕ Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
