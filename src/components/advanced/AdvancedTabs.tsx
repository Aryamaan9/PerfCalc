"use client";

import React, { useState, useEffect } from "react";
import TransactionsTab from "./tabs/TransactionsTab";
import TickersTab from "./tabs/TickersTab";
import CorporateActionsTab from "./tabs/CorporateActionsTab";
import HoldingsTab from "./tabs/HoldingsTab";
import AnalyticsTab from "./tabs/AnalyticsTab";
import { Trade, CorporateAction } from "@/lib/advancedEngine";

// ── Inline "Add" Modal ─────────────────────────────────────────────────────────
function AddModal({ title, label, onConfirm, onCancel }: { title: string; label: string; onConfirm: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "28px 32px", width: "340px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "14px", color: "var(--text-primary)" }}>{title}</h3>
        <input
          autoFocus
          type="text"
          placeholder={label}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === "Enter" && value.trim() && onConfirm(value.trim())}
          style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "rgba(0,0,0,0.3)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "13px", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: "10px", marginTop: "18px", justifyContent: "flex-end" }}>
          <button className="template-btn" style={{ background: "rgba(255,255,255,0.05)" }} onClick={onCancel}>Cancel</button>
          <button className="template-btn" onClick={() => value.trim() && onConfirm(value.trim())}>Create</button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar Tree ──────────────────────────────────────────────────────────────
function SidebarTree({ families, selectedFamilyId, selectedUserId, selectedBrokerId, onSelect, onReload }: any) {
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<null | { type: "family" | "user" | "broker"; parentFamily?: string; parentUser?: string }>(null);

  // Auto-expand when scope is selected
  useEffect(() => {
    if (selectedFamilyId) setExpandedFamilies(p => ({ ...p, [selectedFamilyId]: true }));
    if (selectedFamilyId && selectedUserId) setExpandedUsers(p => ({ ...p, [`${selectedFamilyId}/${selectedUserId}`]: true }));
  }, [selectedFamilyId, selectedUserId]);

  const handleCreate = async (name: string) => {
    if (!modal) return;
    try {
      if (modal.type === "family") {
        // Create family by saving empty data to it
        await fetch("/api/portfolio/advancedSave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ familyId: name, userId: "_init", brokerId: "_init", trades: [], actions: [] })
        });
      } else if (modal.type === "user") {
        await fetch("/api/portfolio/advancedSave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ familyId: modal.parentFamily, userId: name, brokerId: "_init", trades: [], actions: [] })
        });
      } else if (modal.type === "broker") {
        await fetch("/api/portfolio/advancedSave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ familyId: modal.parentFamily, userId: modal.parentUser, brokerId: name, trades: [], actions: [] })
        });
      }
      await onReload();
    } catch (e) {
      alert("Could not create: " + (e as any).message);
    }
    setModal(null);
  };

  const rowBase: React.CSSProperties = { display: "flex", alignItems: "center", width: "100%", border: "none", background: "none", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-mono)", transition: "background 0.15s" };
  const isSelected = (fId: string, uId?: string, bId?: string) =>
    selectedFamilyId === fId && selectedUserId === (uId ?? "") && selectedBrokerId === (bId ?? "");

  const selStyle = (active: boolean): React.CSSProperties => ({
    borderLeft: active ? "3px solid var(--ms-gold)" : "3px solid transparent",
    background: active ? "rgba(204,164,61,0.1)" : "transparent",
    color: active ? "var(--ms-gold)" : "var(--text-secondary)",
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", fontSize: "12px" }}>
      {modal && (
        <AddModal
          title={modal.type === "family" ? "New Family" : modal.type === "user" ? `New Client in ${modal.parentFamily}` : `New Portfolio in ${modal.parentUser}`}
          label={modal.type === "family" ? "Family name" : modal.type === "user" ? "Client name" : "Portfolio / Broker name"}
          onConfirm={handleCreate}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Add Family */}
      <button
        onClick={() => setModal({ type: "family" })}
        style={{ ...rowBase, padding: "9px 14px", color: "var(--ms-gold)", fontSize: "11px", gap: "6px", borderBottom: "1px solid var(--border)" }}
      >
        <span style={{ fontSize: "14px" }}>＋</span> New Family
      </button>

      {families.length === 0 && (
        <div style={{ padding: "16px 14px", color: "var(--text-muted)", fontSize: "11px", lineHeight: 1.6 }}>
          No workspaces yet.<br />Create a Family to start.
        </div>
      )}

      {families.map((family: any) => {
        const fExp = !!expandedFamilies[family.id];
        const fActive = isSelected(family.id);
        const users: any[] = (family.users || []).filter((u: any) => u.id !== "_init");

        return (
          <div key={family.id}>
            {/* Family Row */}
            <div style={{ display: "flex", alignItems: "center", ...selStyle(fActive), borderBottom: "none" }}>
              <button
                onClick={() => setExpandedFamilies(p => ({ ...p, [family.id]: !p[family.id] }))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "8px 6px 8px 10px", fontSize: "10px", flexShrink: 0 }}
              >
                {fExp ? "▼" : "▶"}
              </button>
              <button
                onClick={() => onSelect(family.id, "", "")}
                style={{ ...rowBase, flex: 1, padding: "8px 4px", fontWeight: 700, fontSize: "12px", color: "inherit", gap: "6px", overflow: "hidden" }}
              >
                <span>📁</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{family.id}</span>
                <span style={{ marginLeft: "auto", fontSize: "10px", color: "var(--text-muted)", flexShrink: 0, paddingRight: "8px" }}>{users.length}</span>
              </button>
            </div>

            {/* Users */}
            {fExp && (
              <div>
                {users.map((user: any) => {
                  const uKey = `${family.id}/${user.id}`;
                  const uExp = !!expandedUsers[uKey];
                  const uActive = isSelected(family.id, user.id);
                  const brokers: any[] = (user.brokers || []).filter((b: any) => b.id !== "_init");

                  return (
                    <div key={user.id}>
                      <div style={{ display: "flex", alignItems: "center", ...selStyle(uActive), marginLeft: "14px" }}>
                        <button
                          onClick={() => setExpandedUsers(p => ({ ...p, [uKey]: !p[uKey] }))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "6px 6px 6px 6px", fontSize: "10px", flexShrink: 0 }}
                        >
                          {uExp ? "▼" : "▶"}
                        </button>
                        <button
                          onClick={() => onSelect(family.id, user.id, "")}
                          style={{ ...rowBase, flex: 1, padding: "6px 4px", fontSize: "11px", color: "inherit", gap: "6px", overflow: "hidden" }}
                        >
                          <span>👤</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.id}</span>
                          <span style={{ marginLeft: "auto", fontSize: "10px", color: "var(--text-muted)", flexShrink: 0, paddingRight: "6px" }}>{brokers.length}</span>
                        </button>
                      </div>

                      {/* Brokers */}
                      {uExp && (
                        <div>
                          {brokers.map((broker: any) => {
                            const bActive = isSelected(family.id, user.id, broker.id);
                            return (
                              <button
                                key={broker.id}
                                onClick={() => onSelect(family.id, user.id, broker.id)}
                                style={{ ...rowBase, ...selStyle(bActive), marginLeft: "28px", padding: "5px 8px 5px 6px", fontSize: "11px", gap: "6px", overflow: "hidden" }}
                              >
                                <span>🏦</span>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{broker.id}</span>
                              </button>
                            );
                          })}
                          {/* Add Broker */}
                          <button
                            onClick={() => setModal({ type: "broker", parentFamily: family.id, parentUser: user.id })}
                            style={{ ...rowBase, marginLeft: "28px", padding: "4px 8px", color: "var(--text-muted)", fontSize: "10px", gap: "4px" }}
                          >
                            <span>＋</span> Add Portfolio
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Client */}
                <button
                  onClick={() => setModal({ type: "user", parentFamily: family.id })}
                  style={{ ...rowBase, marginLeft: "14px", padding: "5px 10px", color: "var(--text-muted)", fontSize: "10px", gap: "4px" }}
                >
                  <span>＋</span> Add Client
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdvancedTabs({ initialFamilies }: { initialFamilies: any[] }) {
  const [activeTab, setActiveTab] = useState("transactions");
  const [families, setFamilies] = useState(initialFamilies);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedBrokerId, setSelectedBrokerId] = useState("");

  const [trades, setTrades] = useState<Trade[]>([]);
  const [actions, setActions] = useState<CorporateAction[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const reloadFamilies = async () => {
    try {
      const res = await fetch("/api/portfolio/advancedList");
      if (res.ok) {
        const data = await res.json();
        setFamilies(data.workspaces || []);
      }
    } catch (e) { /* silent */ }
  };

  useEffect(() => { reloadFamilies(); }, []);

  useEffect(() => {
    if (!selectedUserId) { setTrades([]); setActions([]); return; }
    const go = async () => {
      setIsFetching(true);
      try {
        const res = await fetch("/api/portfolio/advancedRawData", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ familyId: selectedFamilyId || "defaultFamily", userId: selectedUserId, brokerId: selectedBrokerId })
        });
        if (res.ok) { const d = await res.json(); setTrades(d.trades || []); setActions(d.actions || []); setHasUnsavedChanges(false); }
      } catch (e) { /* silent */ } finally { setIsFetching(false); }
    };
    go();
  }, [selectedFamilyId, selectedUserId, selectedBrokerId]);

  const handleSelect = (fId: string, uId: string, bId: string) => {
    if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Discard and switch?")) return;
    setHasUnsavedChanges(false);
    setSelectedFamilyId(fId);
    setSelectedUserId(uId);
    setSelectedBrokerId(bId);
  };

  // Breadcrumb
  const scopeLabel = (() => {
    if (!selectedFamilyId) return null;
    const parts = [`📁 ${selectedFamilyId}`];
    if (selectedUserId) parts.push(`👤 ${selectedUserId}`);
    if (selectedBrokerId) parts.push(`🏦 ${selectedBrokerId}`);
    const level = selectedBrokerId ? "Portfolio" : selectedUserId ? "Client (all portfolios)" : "Family (all clients)";
    return { crumbs: parts, level };
  })();

  const tabs = [
    { id: "transactions", label: "Transactions" },
    { id: "tickers", label: "Tickers" },
    { id: "corporateActions", label: "Corporate Actions" },
    { id: "holdings", label: "Holdings & Audit" },
    { id: "analytics", label: "Analytics" },
  ];

  return (
    <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--bg-card)", minHeight: "640px" }}>

      {/* ═══ LEFT SIDEBAR ══════════════════════════════════════════════════════ */}
      <div style={{
        width: sidebarOpen ? "230px" : "36px",
        minWidth: sidebarOpen ? "230px" : "36px",
        borderRight: "1px solid var(--border)",
        background: "rgba(0,0,0,0.3)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s, min-width 0.2s",
        flexShrink: 0,
        overflow: "hidden"
      }}>
        {/* Sidebar header */}
        <div style={{ display: "flex", alignItems: "center", padding: "12px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          {sidebarOpen && (
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase", flex: 1 }}>
              Portfolios
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "12px", padding: "2px", flexShrink: 0 }}
            title={sidebarOpen ? "Collapse" : "Expand"}
          >
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {sidebarOpen && (
          <SidebarTree
            families={families}
            selectedFamilyId={selectedFamilyId}
            selectedUserId={selectedUserId}
            selectedBrokerId={selectedBrokerId}
            onSelect={handleSelect}
            onReload={reloadFamilies}
          />
        )}
      </div>

      {/* ═══ MAIN PANEL ════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Context bar */}
        <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: "8px", minHeight: "42px", flexShrink: 0 }}>
          {scopeLabel ? (
            <>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {scopeLabel.crumbs.join("  /  ")}
              </span>
              <span style={{ marginLeft: "8px", fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: "rgba(204,164,61,0.12)", color: "var(--ms-gold)", fontWeight: 600, letterSpacing: "0.06em" }}>
                {scopeLabel.level}
              </span>
              {isFetching && <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--ms-gold)" }}>⟳ Loading…</span>}
              {hasUnsavedChanges && <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--color-warning)" }}>● Unsaved changes</span>}
            </>
          ) : (
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
              ← Select a Family, Client, or Portfolio from the left panel
            </span>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)", flexShrink: 0 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "11px 18px", cursor: "pointer", background: "transparent", border: "none",
                borderBottom: activeTab === tab.id ? "2px solid var(--ms-gold)" : "2px solid transparent",
                color: activeTab === tab.id ? "var(--ms-gold)" : "var(--text-secondary)",
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontFamily: "var(--font-heading)", fontSize: "11px", letterSpacing: "0.08em",
                textTransform: "uppercase", transition: "all 0.2s", whiteSpace: "nowrap"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, padding: "24px 20px", overflowY: "auto" }}>
          {!selectedFamilyId ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", gap: "16px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "48px" }}>📁</div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>No portfolio selected</div>
              <div style={{ fontSize: "12px" }}>Select or create a Family from the left panel to get started.</div>
            </div>
          ) : (
            <>
              {activeTab === "transactions" && <TransactionsTab familyId={selectedFamilyId} userId={selectedUserId} brokerId={selectedBrokerId} trades={trades} setTrades={setTrades} setHasUnsavedChanges={setHasUnsavedChanges} />}
              {activeTab === "tickers" && <TickersTab familyId={selectedFamilyId} userId={selectedUserId} brokerId={selectedBrokerId} trades={trades} />}
              {activeTab === "corporateActions" && <CorporateActionsTab familyId={selectedFamilyId} userId={selectedUserId} brokerId={selectedBrokerId} actions={actions} setActions={setActions} setHasUnsavedChanges={setHasUnsavedChanges} />}
              {activeTab === "holdings" && <HoldingsTab familyId={selectedFamilyId} userId={selectedUserId} brokerId={selectedBrokerId} />}
              {activeTab === "analytics" && <AnalyticsTab familyId={selectedFamilyId} userId={selectedUserId} brokerId={selectedBrokerId} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
