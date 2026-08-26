"use client";
import React, { useState, useEffect } from "react";

export default function PortfolioManager({
  onAnalyze
}: {
  onAnalyze: (portfolioId: string) => void;
}) {
  const [portfolios, setPortfolios] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Portfolio Form
  const [newId, setNewId] = useState("");
  const [tradesFile, setTradesFile] = useState<File | null>(null);
  const [actionsFile, setActionsFile] = useState<File | null>(null);

  const fetchPortfolios = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portfolio/list");
      if (!res.ok) throw new Error("Failed to list portfolios");
      const data = await res.json();
      setPortfolios(data.portfolios || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load portfolios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetch("/api/portfolio/list")
      .then(res => {
        if (!res.ok) throw new Error("Failed to load portfolios");
        return res.json();
      })
      .then(data => {
        if (isMounted) setPortfolios(data.portfolios || []);
      })
      .catch((e: unknown) => {
        if (isMounted) setError(e instanceof Error ? e.message : "Failed to load portfolios");
      });
    return () => { isMounted = false; };
  }, []);

  const handleCreate = async () => {
    if (!newId || !tradesFile) {
      setError("Please provide a name and trades CSV file.");
      return;
    }
    setLoading(true); setError(null);
    try {
      const formData = new FormData();
      formData.append("portfolioId", newId);
      formData.append("trades", tradesFile);
      if (actionsFile) formData.append("actions", actionsFile);

      const res = await fetch("/api/portfolio/save", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save portfolio");
      }

      setNewId("");
      setTradesFile(null);
      setActionsFile(null);
      await fetchPortfolios();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save portfolio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-up" style={{ padding: "20px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>💾 Firestore Data Manager</h2>
        <button className="template-btn" onClick={() => window.location.reload()} style={{ padding: "4px 12px", fontSize: "12px" }}>
          ← Back to CSV Upload
        </button>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "20px" }}>
        Save multiple portfolios to the database. Edits made here will bypass CSV uploads.
      </p>

      {error && (
        <div className="warning-strip" style={{ marginBottom: "16px", backgroundColor: "rgba(240, 101, 149, 0.1)", color: "#ffb3c6" }}>
          <span>⚠️</span> {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 300px" }}>
          <h3>Saved Portfolios</h3>
          {loading && portfolios.length === 0 ? <p>Loading...</p> : null}
          {portfolios.length === 0 && !loading ? <p style={{ color: "var(--text-muted)" }}>No portfolios found.</p> : null}
          
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
            {portfolios.map(id => (
              <li key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "6px" }}>
                <strong>{id}</strong>
                <button 
                  className="analyze-btn" 
                  style={{ padding: "6px 12px", fontSize: "12px", minWidth: "auto" }}
                  onClick={() => onAnalyze(id)}
                >
                  ▶ Analyze
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ flex: "1 1 300px", background: "rgba(0,0,0,0.2)", padding: "16px", borderRadius: "8px" }}>
          <h3>Create New Portfolio</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
            <input 
              type="text" 
              placeholder="Portfolio Name (e.g. Retirement)" 
              value={newId}
              onChange={e => setNewId(e.target.value)}
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border)", background: "transparent", color: "#fff" }}
            />
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>Trades CSV</label>
              <input type="file" accept=".csv,.xlsx" onChange={e => setTradesFile(e.target.files?.[0] || null)} style={{ display: "block", marginTop: "4px" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>Corporate Actions CSV (Optional)</label>
              <input type="file" accept=".csv,.xlsx" onChange={e => setActionsFile(e.target.files?.[0] || null)} style={{ display: "block", marginTop: "4px" }} />
            </div>
            <button 
              className="template-btn" 
              onClick={handleCreate}
              disabled={loading || !newId || !tradesFile}
              style={{ marginTop: "8px", justifyContent: "center" }}
            >
              {loading ? "Saving..." : "Save to Database"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
