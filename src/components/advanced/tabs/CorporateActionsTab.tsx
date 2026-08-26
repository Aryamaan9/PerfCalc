import React, { useState, useRef } from "react";
import { CorporateAction, parseCorporateActions } from "@/lib/advancedEngine";

export default function CorporateActionsTab({ familyId, userId, brokerId, actions, setActions, setHasUnsavedChanges }: any) {
  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  
  const [fetchSymbol, setFetchSymbol] = useState("");
  const [fetchStart, setFetchStart] = useState("");
  const [fetchEnd, setFetchEnd] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    try {
      const parsed = parseCorporateActions(buffer);
      setActions((prev: any) => [...prev, ...parsed].sort((a: any, b: any) => a.date.localeCompare(b.date)));
      setHasUnsavedChanges(true);
    } catch (err: any) {
      alert("Failed to parse file: " + err.message);
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleAutoFetch = async () => {
    if (!fetchSymbol || !fetchStart || !fetchEnd) {
      alert("Please provide Symbol, Start Date, and End Date for auto-fetch.");
      return;
    }
    setIsFetching(true);
    try {
      const res = await fetch("/api/portfolio/advancedAutoFetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: fetchSymbol, startDate: fetchStart, endDate: fetchEnd })
      });
      const data = await res.json();
      if (data.actions) {
        setActions((prev: any) => [...prev, ...data.actions].sort((a: any, b: any) => a.date.localeCompare(b.date)));
        alert(`Fetched ${data.actions.length} actions!`);
        setHasUnsavedChanges(true);
      }
    } catch (err: any) {
      alert("Fetch error: " + err.message);
    } finally {
      setIsFetching(false);
    }
  };

  const handleEdit = (a: CorporateAction, field: keyof CorporateAction, value: any) => {
    const updated = actions.map((item: CorporateAction) => item === a ? { ...item, [field]: value } : item);
    setActions(updated);
    setHasUnsavedChanges(true);
  };

  const handleDelete = (a: CorporateAction) => {
    setActions(actions.filter((item: CorporateAction) => item !== a));
    setHasUnsavedChanges(true);
  };

  const handleAddRow = () => {
    setActions([{
      date: new Date().toISOString().slice(0, 10),
      symbol: "NEW.NS",
      action: "DIVIDEND",
      value: 1,
      status: "APPLIED",
      broker: brokerId || ""
    }, ...actions]);
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
          brokerId, // Optional in aggregate view
          actionsJson: JSON.stringify(actions),
          tradesJson: "[]" // Send empty trades array so it doesn't overwrite trades (actually wait!)
        })
      });

      if (!res.ok) throw new Error("Failed to save");
      alert("Saved successfully!");
      setHasUnsavedChanges(false);
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
          <h2 className="brand-name" style={{ margin: 0, fontSize: "16px" }}>Corporate Actions <span>Manager</span></h2>
          <p className="brand-sub">Auto-fetch from Yahoo Finance or manually upload/edit.</p>
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
            {isSaving ? "Saving..." : "Save Actions"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "24px", padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", flexWrap: "wrap", alignItems: "center" }}>
        <div className="upload-label" style={{ marginBottom: 0 }}>Auto-Fetch:</div>
        <input type="text" placeholder="Symbol (e.g. AAPL)" value={fetchSymbol} onChange={e => setFetchSymbol(e.target.value)} style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "12px" }} />
        <input type="date" value={fetchStart} onChange={e => setFetchStart(e.target.value)} style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "12px" }} />
        <input type="date" value={fetchEnd} onChange={e => setFetchEnd(e.target.value)} style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "12px" }} />
        <button className="template-btn" onClick={handleAutoFetch} disabled={isFetching}>
          {isFetching ? "Fetching..." : "Fetch"}
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Symbol</th>
              <th>Action</th>
              <th>Value/Multiplier</th>
              <th>Target Symbol (Mergers)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {actions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                  No corporate actions. Fetch or add a row.
                </td>
              </tr>
            )}
            {actions.map((a, idx) => (
              <tr key={idx}>
                <td>
                  <input type="date" value={a.date} onChange={e => handleEdit(idx, "date", e.target.value)} style={{ width: "120px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px" }} />
                </td>
                <td>
                  <input type="text" value={a.symbol} onChange={e => handleEdit(idx, "symbol", e.target.value)} style={{ width: "90px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px" }} />
                </td>
                <td>
                  <select value={a.action} onChange={e => handleEdit(idx, "action", e.target.value)} style={{ border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                    <option value="DIVIDEND">DIVIDEND</option>
                    <option value="SPLIT">SPLIT</option>
                    <option value="BONUS">BONUS</option>
                    <option value="MERGER">MERGER</option>
                    <option value="DEMERGER">DEMERGER</option>
                    <option value="RIGHTS">RIGHTS</option>
                    <option value="DEPOSIT">DEPOSIT</option>
                    <option value="WITHDRAWAL">WITHDRAWAL</option>
                  </select>
                </td>
                <td>
                  <input type="number" value={a.value} onChange={e => handleEdit(idx, "value", parseFloat(e.target.value) || 0)} style={{ width: "80px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px" }} />
                </td>
                <td>
                  <input type="text" value={a.targetSymbol || ""} onChange={e => handleEdit(idx, "targetSymbol", e.target.value)} placeholder="Target" style={{ width: "100px", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "11px" }} />
                </td>
                <td>
                  <select value={a.status || "APPLIED"} onChange={e => handleEdit(idx, "status", e.target.value)} style={{ border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", background: a.status === "IGNORED" ? "rgba(248,113,113,0.1)" : "rgba(74,222,128,0.1)", color: a.status === "IGNORED" ? "var(--color-negative)" : "var(--color-positive)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                    <option value="APPLIED">Applied</option>
                    <option value="PENDING">Pending Review</option>
                    <option value="IGNORED">Ignored</option>
                  </select>
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
