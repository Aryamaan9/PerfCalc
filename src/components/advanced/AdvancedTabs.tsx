import React, { useState, useEffect } from "react";
import TransactionsTab from "./tabs/TransactionsTab";
import TickersTab from "./tabs/TickersTab";
import CorporateActionsTab from "./tabs/CorporateActionsTab";
import HoldingsTab from "./tabs/HoldingsTab";
import AnalyticsTab from "./tabs/AnalyticsTab";
import ScopeManagerModal from "./ScopeManagerModal";
import { Trade, CorporateAction } from "@/lib/advancedEngine";

export default function AdvancedTabs({ initialFamilies }: { initialFamilies: any[] }) {
  const [activeTab, setActiveTab] = useState("transactions");
  const [families, setFamilies] = useState(initialFamilies);
  
  // Scopes
  const [selectedFamilyId, setSelectedFamilyId] = useState("defaultFamily");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedBrokerId, setSelectedBrokerId] = useState("");
  
  // Data State
  const [trades, setTrades] = useState<Trade[]>([]);
  const [actions, setActions] = useState<CorporateAction[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Modal
  const [showManager, setShowManager] = useState(false);

  // Auto fetch raw data when scope changes
  useEffect(() => {
    if (!selectedUserId) {
      setTrades([]);
      setActions([]);
      return;
    }

    const fetchData = async () => {
      setIsFetching(true);
      try {
        const res = await fetch("/api/portfolio/advancedRawData", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            familyId: selectedFamilyId || "defaultFamily",
            userId: selectedUserId,
            brokerId: selectedBrokerId
          })
        });
        if (res.ok) {
          const data = await res.json();
          setTrades(data.trades || []);
          setActions(data.actions || []);
          setHasUnsavedChanges(false);
        }
      } catch (err) {
        console.error("Failed to fetch raw data:", err);
      } finally {
        setIsFetching(false);
      }
    };
    fetchData();
  }, [selectedFamilyId, selectedUserId, selectedBrokerId]);

  const handleScopeChange = (type: string, value: string) => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm("You have unsaved changes! Discard them and switch scope?");
      if (!confirm) return;
    }
    setHasUnsavedChanges(false);
    if (type === "family") setSelectedFamilyId(value);
    if (type === "user") setSelectedUserId(value);
    if (type === "broker") setSelectedBrokerId(value);
  };

  const tabs = [
    { id: "transactions", label: "Transactions" },
    { id: "tickers", label: "Tickers" },
    { id: "corporateActions", label: "Corporate Actions" },
    { id: "holdings", label: "Holdings & Audit" },
    { id: "analytics", label: "Analytics" },
  ];

  return (
    <div className="glass-card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border)", position: "relative" }}>
      {showManager && <ScopeManagerModal onClose={() => setShowManager(false)} families={families} onRegroup={() => window.location.reload()} />}
      
      {/* Top Header / Scope Selector */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: "16px", alignItems: "center", background: "var(--bg-card)", flexWrap: "wrap" }}>
        <div className="upload-label" style={{ marginBottom: 0 }}>Scope:</div>
        
        <select value={selectedFamilyId} onChange={e => handleScopeChange("family", e.target.value)} style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
          <option value="defaultFamily">Default Family</option>
          {families.filter(f => f.id !== "defaultFamily").map(f => (
            <option key={f.id} value={f.id}>{f.id}</option>
          ))}
        </select>
        
        <input 
          type="text" 
          placeholder="User ID (e.g. John)" 
          value={selectedUserId} 
          onChange={e => handleScopeChange("user", e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "12px", width: "160px" }}
        />
        
        <input 
          type="text" 
          placeholder="Broker ID (e.g. Zerodha)" 
          value={selectedBrokerId} 
          onChange={e => handleScopeChange("broker", e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "12px", width: "160px" }}
        />

        <button className="template-btn" onClick={() => setShowManager(true)} style={{ marginLeft: "auto", background: "rgba(255,255,255,0.05)" }}>
          ⚙️ Manage Scopes
        </button>
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
      <div style={{ padding: "24px 20px", position: "relative" }}>
        {isFetching && <div style={{ position: "absolute", top: 10, right: 20, color: "var(--ms-gold)", fontSize: "12px" }}>Loading data...</div>}
        {activeTab === "transactions" && (
          <TransactionsTab familyId={selectedFamilyId} userId={selectedUserId} brokerId={selectedBrokerId} trades={trades} setTrades={setTrades} setHasUnsavedChanges={setHasUnsavedChanges} />
        )}
        {activeTab === "tickers" && (
          <TickersTab familyId={selectedFamilyId} userId={selectedUserId} brokerId={selectedBrokerId} trades={trades} />
        )}
        {activeTab === "corporateActions" && (
          <CorporateActionsTab familyId={selectedFamilyId} userId={selectedUserId} brokerId={selectedBrokerId} actions={actions} setActions={setActions} setHasUnsavedChanges={setHasUnsavedChanges} />
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
