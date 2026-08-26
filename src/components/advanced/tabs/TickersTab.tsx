"use client";

import React, { useState } from "react";

export default function TickersTab({ familyId, userId, brokerId }: any) {
  const [tickers, setTickers] = useState<string>("");
  const [validations, setValidations] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState(false);

  const handleValidate = async () => {
    const list = tickers.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);
    if (!list.length) return;

    setIsValidating(true);
    try {
      const res = await fetch("/api/portfolio/advancedValidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: list })
      });
      const data = await res.json();
      if (data.validations) {
        setValidations(data.validations);
      }
    } catch (err: any) {
      alert("Validation error: " + err.message);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h2 className="brand-name" style={{ margin: 0, fontSize: "16px" }}>Ticker <span>Validation</span></h2>
        <p className="brand-sub">Paste comma-separated tickers (e.g. AAPL, TCS.NS) to verify they resolve in Yahoo Finance.</p>
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
        <input 
          type="text" 
          value={tickers} 
          onChange={e => setTickers(e.target.value)} 
          placeholder="AAPL, RELIANCE.NS, INFY.NS"
          style={{ flex: 1, padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
        />
        <button className="template-btn" onClick={handleValidate} disabled={isValidating}>
          {isValidating ? "Validating..." : "Validate"}
        </button>
      </div>

      {Object.keys(validations).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
          {Object.entries(validations).map(([t, isValid]) => (
            <div key={t} style={{ 
              padding: "8px 16px", 
              borderRadius: "20px", 
              border: `1px solid ${isValid ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`,
              background: isValid ? "rgba(74,222,128,0.05)" : "rgba(248,113,113,0.05)",
              color: isValid ? "var(--color-positive)" : "var(--color-negative)",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              display: "flex", alignItems: "center", gap: "8px"
            }}>
              <span style={{ fontWeight: "700" }}>{t}</span>
              <span>{isValid ? "✅ Valid" : "❌ Invalid"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
