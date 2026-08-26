"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import AdvancedTabs from "@/components/advanced/AdvancedTabs";

export default function AdvancedPage() {
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // In a full version, this would fetch from /api/portfolio/advancedList
  // For MVP, we will construct a mock state or fetch
  useEffect(() => {
    fetch("/api/portfolio/advancedList")
      .then(res => (res.ok ? res.json() : { workspaces: [] }))
      .then(data => {
        setFamilies(data.workspaces || []);
      })
      .catch(err => {
        console.warn("Could not fetch workspaces, defaulting to empty:", err);
        setFamilies([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 className="brand-name">ADVANCED <span>MODE</span></h1>
          <p className="brand-sub">Multi-Broker, Family-Level Aggregation & Auditing</p>
        </div>
        <Link href="/" className="template-btn" style={{ textDecoration: "none" }}>
          ← Back to Base
        </Link>
      </header>

      {loading ? (
        <div>Loading advanced workspace...</div>
      ) : (
        <AdvancedTabs initialFamilies={families} />
      )}
    </div>
  );
}
