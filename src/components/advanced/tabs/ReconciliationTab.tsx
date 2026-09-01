"use client";

import React, { useState, useEffect, useRef } from "react";
import "./ReconciliationTab.css";

interface ReconTabProps {
  familyId: string;
  userId: string;
  brokerId: string;
}

export default function ReconciliationTab({ familyId, userId, brokerId }: ReconTabProps) {
  const [statements, setStatements] = useState<any[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [diffReport, setDiffReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Date confirmation modal state
  const [showDateModal, setShowDateModal] = useState(false);
  const [detectedDate, setDetectedDate] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // We would ideally fetch the list of statements from the DB.
    // For now, we need to create an endpoint for listStatements, OR fetch it directly.
    // Since we don't have listStatements endpoint, we can add it or just rely on a unified fetch...
    // Let's assume we will build `advancedListStatements` or we just fetch from `/api/portfolio/advancedRawData`.
    // Wait, advancedRawData doesn't return holding_statements.
    // Let me just add `holding_statements` to `advancedRawData`!
    fetchStatements();
  }, [brokerId]);

  const fetchStatements = async () => {
    try {
      const res = await fetch("/api/portfolio/advancedRawData", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId, userId, brokerId, includeStatements: true })
      });
      const data = await res.json();
      if (data.holdingStatements) {
        setStatements(data.holdingStatements);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setDetectedDate(new Date().toISOString().split("T")[0]);
      setShowDateModal(true);
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setPendingFile(file);
      // We don't parse date on frontend yet, so we just default to today and let them change it
      setDetectedDate(new Date().toISOString().split("T")[0]);
      setShowDateModal(true);
    }
  };

  const confirmUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setShowDateModal(false);

    try {
      const formData = new FormData();
      formData.append("familyId", familyId);
      formData.append("userId", userId);
      formData.append("brokerId", brokerId);
      formData.append("date", detectedDate);
      formData.append("file", pendingFile);

      const res = await fetch("/api/portfolio/advancedUploadHoldingStatement", {
        method: "POST",
        body: formData
      });
      
      const data = await res.json();
      if (data.success) {
        await fetchStatements();
        selectStatement(data.id);
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
      alert("Upload failed.");
    } finally {
      setUploading(false);
      setPendingFile(null);
    }
  };

  const selectStatement = async (id: string) => {
    setSelectedStatementId(id);
    setLoading(true);
    try {
      const res = await fetch("/api/portfolio/advancedReconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId, userId, brokerId, statementId: id })
      });
      const data = await res.json();
      setDiffReport(data.diffReport || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const activeStatement = statements.find(s => s.id === selectedStatementId);

  return (
    <div className="recon-container">
      <div className="recon-sidebar">
        <h3>Holding Statements</h3>
        <input 
          type="file" 
          ref={fileInput} 
          style={{ display: "none" }} 
          accept=".csv,.xlsx,.xls,.pdf" 
          onChange={handleFileSelect} 
        />
        <div 
          className="upload-zone"
          onDragOver={e => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? "Uploading..." : "Click or Drag & Drop (CSV/XLSX/PDF)"}
        </div>
        
        <ul className="statement-list">
          {statements.map(s => (
            <li 
              key={s.id} 
              className={selectedStatementId === s.id ? "active" : ""}
              onClick={() => selectStatement(s.id)}
            >
              Statement: {s.date}
            </li>
          ))}
        </ul>
      </div>

      <div className="recon-main">
        {!selectedStatementId && (
          <div className="empty-state">Select a statement to view the reconciliation diff.</div>
        )}

        {selectedStatementId && loading && (
          <div className="loading">Running reconciliation engine...</div>
        )}

        {selectedStatementId && !loading && (
          <>
            <div className="recon-header">
              <h2>Reconciliation As Of {activeStatement?.date}</h2>
              {activeStatement?.rawFileUrl && (
                <a href={activeStatement.rawFileUrl} target="_blank" rel="noreferrer" className="btn-download">
                  Download Original Source
                </a>
              )}
            </div>

            <table className="recon-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th style={{ textAlign: "right" }}>Calc Qty</th>
                  <th style={{ textAlign: "right" }}>Broker Qty</th>
                  <th style={{ textAlign: "right" }}>Diff</th>
                  <th style={{ textAlign: "right" }}>Calc Cost</th>
                  <th style={{ textAlign: "right" }}>Broker Cost</th>
                </tr>
              </thead>
              <tbody>
                {diffReport.map((row, i) => (
                  <tr key={i} className={row.qtyDiff !== 0 ? "row-error" : ""}>
                    <td>{row.symbol}</td>
                    <td style={{ textAlign: "right" }}>{row.calcQty}</td>
                    <td style={{ textAlign: "right" }}>{row.brokerQty}</td>
                    <td style={{ textAlign: "right" }} className={row.qtyDiff !== 0 ? "error-text" : ""}>
                      {row.qtyDiff > 0 ? "+" : ""}{row.qtyDiff}
                    </td>
                    <td style={{ textAlign: "right" }}>₹{row.calcCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: "right" }}>₹{row.brokerCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {showDateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Statement Date</h3>
            <p>We use this date to "freeze time" on your transaction ledger for an accurate comparison.</p>
            <input 
              type="date" 
              value={detectedDate} 
              onChange={e => setDetectedDate(e.target.value)} 
            />
            <div className="modal-actions">
              <button onClick={() => setShowDateModal(false)}>Cancel</button>
              <button className="primary" onClick={confirmUpload}>Confirm & Upload</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
