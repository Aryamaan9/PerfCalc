import React, { useState, useEffect, useRef } from "react";

export default function GlobalPricesTab() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tickerInput, setTickerInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const fetchTickers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/portfolio/advancedGlobalPrices");
      const data = await res.json();
      if (res.ok) {
        setTickers(data.tickers || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickers();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!tickerInput.trim()) {
      alert("Please enter a ticker symbol first (e.g. AAPL or RELIANCE.NS)");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("ticker", tickerInput.trim().toUpperCase());
      formData.append("file", file);

      const res = await fetch("/api/portfolio/advancedGlobalPrices", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Successfully uploaded custom prices for ${tickerInput.toUpperCase()}! Found ${data.count} rows.`);
        fetchTickers();
        setTickerInput("");
      } else {
        alert("Upload failed: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h2 className="brand-name" style={{ margin: 0, fontSize: "16px" }}>Global Custom Prices <span>Overrides</span></h2>
        <p className="brand-sub">Upload historical price CSVs to override Yahoo Finance globally for dissolved or missing tickers.</p>
      </div>

      <div style={{ background: "var(--bg-elevated)", padding: "20px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", marginBottom: "24px" }}>
        <h3 style={{ marginTop: 0, fontSize: "14px", color: "var(--text-primary)" }}>Upload Custom Price History</h3>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "16px" }}>
          CSV must contain headers: <strong>Date</strong> (YYYY-MM-DD) and <strong>Close</strong> (or Price).
        </p>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <input 
            type="text" 
            placeholder="Ticker (e.g. TWTR)" 
            value={tickerInput}
            onChange={e => setTickerInput(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "4px", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", width: "200px", fontFamily: "var(--font-mono)" }}
          />
          <input type="file" ref={fileInput} style={{ display: "none" }} accept=".csv,.xlsx" onChange={handleFileUpload} />
          <button className="template-btn" onClick={() => fileInput.current?.click()} disabled={uploading} style={{ background: "var(--ms-gold)", color: "#000", border: "none" }}>
            {uploading ? "Uploading..." : "Select File & Upload"}
          </button>
        </div>
      </div>

      <div style={{ background: "var(--bg-elevated)", padding: "20px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
        <h3 style={{ marginTop: 0, fontSize: "14px", color: "var(--text-primary)", marginBottom: "16px" }}>Tickers with Custom Prices</h3>
        
        {isLoading ? (
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading...</div>
        ) : tickers.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>No custom prices uploaded yet.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {tickers.map(t => (
              <div key={t} style={{ padding: "6px 12px", background: "rgba(204,164,61,0.1)", border: "1px solid rgba(204,164,61,0.3)", borderRadius: "4px", color: "var(--ms-gold)", fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 600 }}>
                {t}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
