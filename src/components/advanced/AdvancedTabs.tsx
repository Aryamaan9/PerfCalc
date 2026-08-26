import React, { useState } from "react";
import TransactionsTab from "./tabs/TransactionsTab";
import TickersTab from "./tabs/TickersTab";
import CorporateActionsTab from "./tabs/CorporateActionsTab";
import HoldingsTab from "./tabs/HoldingsTab";
import AnalyticsTab from "./tabs/AnalyticsTab";

export default function AdvancedTabs({ initialFamilies }: { initialFamilies: any[] }) {
  const [activeTab, setActiveTab] = useState("transactions");
  const [families, setFamilies] = useState(initialFamilies);
  const [selectedFamilyId, setSelectedFamilyId] = useState("defaultFamily");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedBrokerId, setSelectedBrokerId] = useState("");

  const tabs = [
    { id: "transactions", label: "Transactions" },
    { id: "tickers", label: "Tickers" },
    { id: "corporateActions", label: "Corporate Actions" },
    { id: "holdings", label: "Holdings & Audit" },
    { id: "analytics", label: "Analytics" },
  ];

  return (
    <div className="glass-card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border)" }}>
      
      {/* Top Header / Scope Selector */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: "16px", alignItems: "center", background: "var(--bg-card)" }}>
        <div className="upload-label" style={{ marginBottom: 0 }}>Scope:</div>
        
        <select value={selectedFamilyId} onChange={e => setSelectedFamilyId(e.target.value)} style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
          <option value="defaultFamily">Default Family</option>
          {families.filter(f => f.id !== "defaultFamily").map(f => (
            <option key={f.id} value={f.id}>{f.id}</option>
          ))}
        </select>
        
        <input 
          type="text" 
          placeholder="User ID (e.g. John)" 
          value={selectedUserId} 
          onChange={e => setSelectedUserId(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "12px", width: "160px" }}
        />
        
        <input 
          type="text" 
          placeholder="Broker ID (e.g. Zerodha)" 
          value={selectedBrokerId} 
          onChange={e => setSelectedBrokerId(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "12px", width: "160px" }}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 24px",
              cursor: "pointer",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--ms-gold)" : "2px solid transparent",
              color: activeTab === tab.id ? "var(--ms-gold)" : "var(--text-secondary)",
              fontWeight: activeTab === tab.id ? "700" : "500",
              fontFamily: "var(--font-heading)",
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              transition: "all 0.2s ease"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "24px 20px" }}>
        {activeTab === "transactions" && (
          <TransactionsTab familyId={selectedFamilyId} userId={selectedUserId} brokerId={selectedBrokerId} />
        )}
        {activeTab === "tickers" && (
          <TickersTab familyId={selectedFamilyId} userId={selectedUserId} brokerId={selectedBrokerId} />
        )}
        {activeTab === "corporateActions" && (
          <CorporateActionsTab familyId={selectedFamilyId} userId={selectedUserId} brokerId={selectedBrokerId} />
        )}
        {activeTab === "holdings" && (
          <HoldingsTab familyId={selectedFamilyId} userId={selectedUserId} brokerId={selectedBrokerId} />
        )}
        {activeTab === "analytics" && (
          <AnalyticsTab familyId={selectedFamilyId} userId={selectedUserId} brokerId={selectedBrokerId} />
        )}
      </div>
    </div>
  );
}
