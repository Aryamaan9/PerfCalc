import { getStorage } from "firebase-admin/storage";
import { v4 as uuidv4 } from "uuid";
import { parseHoldingStatement } from "./advancedEngine";
import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";
import Busboy from "busboy";
import cors from "cors";

import { fetchHistoricalPrices } from "./services/yahooFinanceFetcher";
import { parseTrades, parseCorporateActions, computePortfolio, Trade, CorporateAction, normalizeSymbol } from "./advancedEngine";
import { fetchCorporateActions, validateTickers } from "./advancedFeatures";

const corsHandler = cors({ origin: true });

export const advancedList = functions
  .runWith({ memory: "256MB" })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }
      try {
        const db = getFirestore(admin.app(), "default");
        
        // Use collectionGroup to find all brokers, then reconstruct the hierarchy
        const brokersSnap = await db.collectionGroup("brokers").get();
        const tree: any = {};
        
        brokersSnap.forEach(doc => {
          const parts = doc.ref.path.split('/');
          if (parts.length < 6) return;
          const fId = parts[1];
          const uId = parts[3];
          const bId = parts[5];

          if (!tree[fId]) tree[fId] = { id: fId, users: {} };
          if (!tree[fId].users[uId]) tree[fId].users[uId] = { id: uId, brokers: [] };
          tree[fId].users[uId].brokers.push({ id: bId });
        });

        // Convert object mapping to arrays
        const workspaces = Object.values(tree).map((f: any) => ({
          ...f,
          users: Object.values(f.users)
        }));

        res.status(200).json({ workspaces });
      } catch (err: any) {
        console.error("advancedList Error:", err);
        res.status(500).json({ error: err.message });
      }
    });
  });

export const advancedSave = functions
  .runWith({ memory: "256MB" })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      try {
        let familyId, userId, brokerId, trades, actions, rawTransactionsUrl, rawActionsUrl;

        if (req.headers["content-type"]?.includes("multipart/form-data")) {
          const files: Record<string, Buffer> = {};
          const fields: Record<string, string> = {};
          const bb = Busboy({ headers: req.headers });

          await new Promise<void>((resolve, reject) => {
            bb.on("file", (fieldname: string, file: NodeJS.ReadableStream) => {
              const chunks: Buffer[] = [];
              file.on("data", (d) => chunks.push(d));
              file.on("end", () => { files[fieldname] = Buffer.concat(chunks); });
            });
            bb.on("field", (name, val) => { fields[name] = val; });
            bb.on("finish", resolve);
            bb.on("error", reject);
            if ((req as any).rawBody) bb.end((req as any).rawBody);
            else req.pipe(bb);
          });

          familyId = fields["familyId"] || "defaultFamily";
          userId = fields["userId"];
          brokerId = fields["brokerId"];
          rawTransactionsUrl = fields["rawTransactionsUrl"];
          rawActionsUrl = fields["rawActionsUrl"];
          
          if (files["trades"]) {
            rawTransactionsUrl = await uploadFileToStorage(familyId, userId, brokerId, "trades", files["trades"], "text/csv");
          }
          if (files["actions"]) {
            rawActionsUrl = await uploadFileToStorage(familyId, userId, brokerId, "actions", files["actions"], "text/csv");
          }
          
          trades = fields["tradesJson"] ? JSON.parse(fields["tradesJson"]) : (files["trades"] ? parseTrades(files["trades"]) : []);
          actions = fields["actionsJson"] ? JSON.parse(fields["actionsJson"]) : (files["actions"] ? parseCorporateActions(files["actions"]) : []);
        } else {
          // JSON payload
          familyId = req.body.familyId || "defaultFamily";
          userId = req.body.userId;
          brokerId = req.body.brokerId;
          rawTransactionsUrl = req.body.rawTransactionsUrl;
          rawActionsUrl = req.body.rawActionsUrl;
          
          if (req.body.tradesJson !== undefined) trades = JSON.parse(req.body.tradesJson);
          else if (req.body.trades !== undefined) trades = req.body.trades;
          
          if (req.body.actionsJson !== undefined) actions = JSON.parse(req.body.actionsJson);
          else if (req.body.actions !== undefined) actions = req.body.actions;
        }

        if (!userId) {
          res.status(400).json({ error: "userId is required" }); return;
        }

        const db = getFirestore(admin.app(), "default");
        const batch = db.batch();
        const brokersRef = db.collection("advanced_workspaces").doc(familyId).collection("users").doc(userId).collection("brokers");

        if (brokerId) {
          // Saving for a specific broker
          const docRef = brokersRef.doc(brokerId);
          const updateData: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
          if (trades !== undefined) updateData.trades = trades;
          if (actions !== undefined) updateData.actions = actions;
          if (rawTransactionsUrl !== undefined) updateData.rawTransactionsUrl = rawTransactionsUrl; if (rawActionsUrl !== undefined) updateData.rawActionsUrl = rawActionsUrl; batch.set(docRef, updateData, { merge: true });
        } else {
          // Saving at the user level (multi-broker routing)
          const grouped: Record<string, { trades?: any[], actions?: any[] }> = {};
          
          if (trades !== undefined) {
            for (const t of trades) {
              const b = t.broker || "Default";
              if (!grouped[b]) grouped[b] = {};
              if (!grouped[b].trades) grouped[b].trades = [];
              grouped[b].trades!.push(t);
            }
          }
          if (actions !== undefined) {
            for (const a of actions) {
              const b = a.broker || "Default";
              if (!grouped[b]) grouped[b] = {};
              if (!grouped[b].actions) grouped[b].actions = [];
              grouped[b].actions!.push(a);
            }
          }

          for (const [bId, data] of Object.entries(grouped)) {
            const docRef = brokersRef.doc(bId);
            const updateData: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
            if (data.trades !== undefined) updateData.trades = data.trades;
            if (data.actions !== undefined) updateData.actions = data.actions;
            if (rawTransactionsUrl !== undefined) updateData.rawTransactionsUrl = rawTransactionsUrl; if (rawActionsUrl !== undefined) updateData.rawActionsUrl = rawActionsUrl; batch.set(docRef, updateData, { merge: true });
          }

          // But what about brokers that were completely cleared out?
          // We must read existing brokers and clear their arrays if they are not in grouped!
          const existingBrokers = await brokersRef.get();
          for (const doc of existingBrokers.docs) {
            const bId = doc.id;
            const updateData: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
            
            if (trades !== undefined && (!grouped[bId] || grouped[bId].trades === undefined)) {
              updateData.trades = []; // clear it
            }
            if (actions !== undefined && (!grouped[bId] || grouped[bId].actions === undefined)) {
              updateData.actions = []; // clear it
            }
            if (updateData.trades !== undefined || updateData.actions !== undefined) {
              batch.set(doc.ref, updateData, { merge: true });
            }
          }
        }
        
        await batch.commit();

        res.status(200).json({ success: true, trades, actions });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
  });

export const advancedRawData = functions
  .runWith({ memory: "256MB" })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      try {
        const { familyId = "defaultFamily", userId, brokerId } = req.body;
        const db = getFirestore(admin.app(), "default");

        let trades: Trade[] = [];
        let actions: CorporateAction[] = [];

        const usersRef = db.collection("advanced_workspaces").doc(familyId).collection("users");
        
        const fetchBrokerData = async (uid: string, bid: string) => {
           const doc = await usersRef.doc(uid).collection("brokers").doc(bid).get();
           if (doc.exists) {
             const data = doc.data();
             if (data?.trades) {
               // Assign broker ID to trades for editing in aggregated view
               data.trades.forEach((t: any) => t.broker = bid);
               trades.push(...data.trades);
             }
             if (data?.actions) {
               data.actions.forEach((a: any) => a.broker = bid);
               actions.push(...data.actions);
             }
           }
        };

        if (userId && brokerId) {
           await fetchBrokerData(userId, brokerId);
        } else {
           // We must use collectionGroup because parent documents (users) might not explicitly exist
           const bSnap = await db.collectionGroup("brokers").get();
           for (const doc of bSnap.docs) {
             const parts = doc.ref.path.split('/');
             if (parts.length < 6) continue;
             const fId = parts[1];
             const uId = parts[3];
             const bId = parts[5];
             
             if (fId === familyId) {
                if (!userId || uId === userId) {
                   const data = doc.data();
                   if (data?.trades) {
                     data.trades.forEach((t: any) => t.broker = bId);
                     trades.push(...data.trades);
                   }
                   if (data?.actions) {
                     data.actions.forEach((a: any) => a.broker = bId);
                     actions.push(...data.actions);
                   }
                }
             }
           }
        }

        trades.sort((a, b) => a.date.localeCompare(b.date));
        actions.sort((a, b) => a.date.localeCompare(b.date));

        let holdingStatements: any[] = [];
        if (req.body.includeStatements) {
          let stmtsRef;
          if (userId && brokerId) {
            stmtsRef = db.collection("advanced_workspaces").doc(familyId)
              .collection("users").doc(userId)
              .collection("brokers").doc(brokerId)
              .collection("holding_statements");
          } else if (userId) {
            stmtsRef = db.collection("advanced_workspaces").doc(familyId)
              .collection("users").doc(userId)
              .collection("holding_statements");
          } else {
            stmtsRef = db.collection("advanced_workspaces").doc(familyId)
              .collection("holding_statements");
          }
          const snap = await stmtsRef.get();
          holdingStatements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        res.status(200).json({ trades, actions, holdingStatements });
      } catch (err: any) {
        console.error("Advanced Raw Data error:", err);
        res.status(500).json({ error: err.message });
      }
    });
  });

export const advancedAnalyze = functions
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      try {
        const { familyId = "defaultFamily", userId, brokerId } = req.body;
        const db = getFirestore(admin.app(), "default");

        let trades: Trade[] = [];
        let actions: CorporateAction[] = [];

        // Dynamic aggregation
        const usersRef = db.collection("advanced_workspaces").doc(familyId).collection("users");
        
        const fetchBrokerData = async (uid: string, bid: string) => {
           const doc = await usersRef.doc(uid).collection("brokers").doc(bid).get();
           if (doc.exists) {
             const data = doc.data();
             if (data?.trades) trades.push(...data.trades);
             if (data?.actions) actions.push(...data.actions);
           }
        };

        if (userId && brokerId) {
           await fetchBrokerData(userId, brokerId);
        } else {
           const bSnap = await db.collectionGroup("brokers").get();
           for (const doc of bSnap.docs) {
             const parts = doc.ref.path.split('/');
             if (parts.length < 6) continue;
             const fId = parts[1];
             const uId = parts[3];
             const bId = parts[5];
             
             if (fId === familyId) {
                if (!userId || uId === userId) {
                   const data = doc.data();
                   if (data?.trades) trades.push(...data.trades);
                   if (data?.actions) actions.push(...data.actions);
                }
             }
           }
        }

        // Sort properly since we merged arrays
        trades.sort((a, b) => {
          const dateComp = a.date.localeCompare(b.date);
          if (dateComp !== 0) return dateComp;
          if (a.side.includes("Transfer") && !b.side.includes("Transfer")) return -1;
          if (!a.side.includes("Transfer") && b.side.includes("Transfer")) return 1;
          if (a.side === "Buy" && b.side === "Sell") return -1;
          if (a.side === "Sell" && b.side === "Buy") return 1;
          return 0;
        });
        actions.sort((a, b) => a.date.localeCompare(b.date));

        trades.forEach(t => { t.rawSymbol = t.rawSymbol || t.symbol; t.symbol = normalizeSymbol(t.symbol); });
        actions.forEach(a => { a.symbol = normalizeSymbol(a.symbol); });
        const minimalTrades = trades.map(t => ({ symbol: t.symbol, date: t.date }));
        const minimalActions = actions.map(a => ({ symbol: a.symbol, date: a.date }));
        const prices = await fetchHistoricalPrices(minimalTrades, minimalActions);

        // Merge Global Custom Prices
        const globalSnap = await db.collection("advanced_global_prices").get();
        const globalCustomPrices: any[] = [];
        for (const doc of globalSnap.docs) {
           const ticker = doc.id;
           const pMap = doc.data().prices || {};
           for (const [date, close] of Object.entries(pMap)) {
               globalCustomPrices.push({ ticker, date, close: close as number });
           }
        }
        prices.push(...globalCustomPrices);

        const result = computePortfolio(trades, prices, actions);
        res.status(200).json(result);
      } catch (err: any) {
        console.error("Advanced Analysis error:", err);
        res.status(500).json({ error: err.message });
      }
    });
  });

export const advancedAutoFetchActions = functions
  .runWith({ memory: "512MB" })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      try {
        const { familyId, userId, brokerId } = req.body;
        if (!familyId || !userId) {
          res.status(400).json({ error: "familyId and userId required" }); return;
        }
        
        const db = getFirestore(admin.app(), "default");
        const brokersRef = db.collection("advanced_workspaces").doc(familyId).collection("users").doc(userId).collection("brokers");
        
        const snapshots = brokerId 
          ? [await brokersRef.doc(brokerId).get()] 
          : (await brokersRef.get()).docs;
          
        let newActionsAdded = 0;
        const batch = db.batch();

        for (const snap of snapshots) {
          if (!snap.exists) continue;
          const data = snap.data();
          if (!data) continue;

          const trades = data.trades || [];
          trades.forEach((t: any) => { t.rawSymbol = t.rawSymbol || t.symbol; t.symbol = normalizeSymbol(t.symbol); });
          const existingActions = data.actions || [];
          existingActions.forEach((a: any) => { a.symbol = normalizeSymbol(a.symbol); });

          if (trades.length === 0) continue;

          const symbols = new Set<string>();
          let minDate = "9999-12-31";
          let maxDate = "0000-01-01";
          
          for (const t of trades) {
            if (t.symbol === "$CASH") continue;
            symbols.add(t.symbol);
            if (t.date < minDate) minDate = t.date;
            if (t.date > maxDate) maxDate = t.date;
          }

          if (symbols.size === 0) continue;
          
          let updatedActions = [...existingActions];
          for (const sym of Array.from(symbols)) {
            const fetched = await fetchCorporateActions(sym, minDate, maxDate);
            
            for (const fa of fetched) {
              const exists = updatedActions.some(
                (ea: any) => ea.symbol === fa.symbol && ea.date === fa.date && ea.action === fa.action && Math.abs(ea.value - fa.value) < 0.01
              );
              if (!exists) {
                updatedActions.push({ ...fa, status: "PENDING" });
                newActionsAdded++;
              }
            }
          }

          if (updatedActions.length > existingActions.length) {
            batch.update(snap.ref, { actions: updatedActions });
          }
        }

        await batch.commit();

        res.status(200).json({ success: true, newActionsAdded });
      } catch (err: any) {
        console.error("AutoFetch Error:", err);
        res.status(500).json({ error: err.message });
      }
    });
  });

export const advancedValidateTickers = functions
  .runWith({ memory: "256MB" })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      try {
        const { tickers } = req.body;
        if (!tickers || !Array.isArray(tickers)) {
          res.status(400).json({ error: "tickers array required" }); return;
        }
        const validations = await validateTickers(tickers);
        res.status(200).json({ validations });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
  });

export const advancedRegroup = functions
  .runWith({ memory: "256MB" })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      try {
        // e.g., move a broker from oldUser -> newUser, or user from oldFamily -> newFamily
        const { targetType, oldFamilyId, oldUserId, oldBrokerId, newFamilyId, newUserId, newBrokerId } = req.body;
        
        const db = getFirestore(admin.app(), "default");
        const batch = db.batch();

        if (targetType === "broker") {
           // Move a specific broker to a new user/family
           const oldRef = db.collection("advanced_workspaces").doc(oldFamilyId).collection("users").doc(oldUserId).collection("brokers").doc(oldBrokerId);
           const doc = await oldRef.get();
           if (doc.exists) {
              const newRef = db.collection("advanced_workspaces").doc(newFamilyId || oldFamilyId).collection("users").doc(newUserId || oldUserId).collection("brokers").doc(newBrokerId || oldBrokerId);
              batch.set(newRef, doc.data()!);
              batch.delete(oldRef);
           }
        } else if (targetType === "user") {
           // Move a user (and all their brokers) to a new family
           const brokersSnap = await db.collection("advanced_workspaces").doc(oldFamilyId).collection("users").doc(oldUserId).collection("brokers").get();
           for (const b of brokersSnap.docs) {
              const newRef = db.collection("advanced_workspaces").doc(newFamilyId).collection("users").doc(newUserId || oldUserId).collection("brokers").doc(b.id);
              batch.set(newRef, b.data());
              batch.delete(b.ref);
           }
           // Delete the old user doc itself if it existed
           const userRef = db.collection("advanced_workspaces").doc(oldFamilyId).collection("users").doc(oldUserId);
           batch.delete(userRef);
        }

        await batch.commit();
        res.status(200).json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
  });

export const advancedDelete = functions
  .runWith({ memory: "256MB" })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      try {
        const { targetType, familyId, userId, brokerId } = req.body;
        const db = getFirestore(admin.app(), "default");
        const batch = db.batch();

        if (targetType === "broker") {
          const bRef = db.collection("advanced_workspaces").doc(familyId).collection("users").doc(userId).collection("brokers").doc(brokerId);
          batch.delete(bRef);
        } else if (targetType === "user") {
          const brokersSnap = await db.collection("advanced_workspaces").doc(familyId).collection("users").doc(userId).collection("brokers").get();
          brokersSnap.docs.forEach(d => batch.delete(d.ref));
          const uRef = db.collection("advanced_workspaces").doc(familyId).collection("users").doc(userId);
          batch.delete(uRef);
        } else if (targetType === "family") {
          const bSnap = await db.collectionGroup("brokers").get();
          bSnap.docs.forEach(doc => {
            if (doc.ref.path.split('/')[1] === familyId) batch.delete(doc.ref);
          });
          const uSnap = await db.collection("advanced_workspaces").doc(familyId).collection("users").get();
          uSnap.docs.forEach(doc => batch.delete(doc.ref));
          const fRef = db.collection("advanced_workspaces").doc(familyId);
          batch.delete(fRef);
        }

        await batch.commit();
        res.status(200).json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
  });

// Utility for uploading directly to Firebase Storage bucket
async function uploadFileToStorage(
  familyId: string, userId: string | undefined, brokerId: string | undefined, 
  prefix: string, buffer: Buffer, contentType: string
): Promise<string> {
  let bucket = getStorage().bucket("portfolio-alyzr-83921.appspot.com");
  
  const fileName = `${prefix}_${Date.now()}_${uuidv4().slice(0, 6)}.${contentType === "text/csv" ? "csv" : "xlsx"}`;
  let filePath = `advanced_workspaces/${familyId}/`;
  if (userId) filePath += `${userId}/`;
  if (brokerId) filePath += `${brokerId}/`;
  filePath += `raw_uploads/${fileName}`;
  
  try {
    const file = bucket.file(filePath);
    await file.save(buffer, { contentType });
    const [url] = await file.getSignedUrl({ action: "read", expires: "01-01-2100" });
    return url;
  } catch (err) {
    console.error("Storage upload failed on appspot.com:", err);
    try {
      bucket = getStorage().bucket("portfolio-alyzr-83921.firebasestorage.app");
      const file = bucket.file(filePath);
      await file.save(buffer, { contentType });
      const [url] = await file.getSignedUrl({ action: "read", expires: "01-01-2100" });
      return url;
    } catch (err2) {
      console.error("Storage upload failed on firebasestorage.app:", err2);
      return `data:${contentType};base64,${buffer.toString("base64")}`;
    }
  }
}

export const advancedUploadHoldingStatement = functions
  .runWith({ memory: "256MB" })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      try {
        let familyId, userId, brokerId;
        const files: Record<string, Buffer> = {};
        const fields: Record<string, string> = {};

        if (req.headers["content-type"]?.includes("multipart/form-data")) {
          const bb = Busboy({ headers: req.headers });
          await new Promise<void>((resolve, reject) => {
            bb.on("file", (fieldname: string, file: NodeJS.ReadableStream) => {
              const chunks: Buffer[] = [];
              file.on("data", (d) => chunks.push(d));
              file.on("end", () => { files[fieldname] = Buffer.concat(chunks); });
            });
            bb.on("field", (name, val) => { fields[name] = val; });
            bb.on("finish", resolve);
            bb.on("error", reject);
            if ((req as any).rawBody) bb.end((req as any).rawBody);
            else req.pipe(bb);
          });
        } else {
          res.status(400).json({ error: "Requires multipart/form-data" });
        }

        familyId = fields["familyId"] || "defaultFamily";
        userId = fields["userId"];
        brokerId = fields["brokerId"];
        const customDate = fields["date"]; // User can override date

        if (!files["file"]) {
          res.status(400).json({ error: "Missing file" });
          return;
        }

        // determine basic content type by looking at first few bytes
        const buf = files["file"];
        let contentType = "application/octet-stream";
        if (buf.length > 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
          contentType = "application/pdf";
        } else if (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4B) {
          contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; // xlsx
        } else {
          contentType = "text/csv";
        }

        const rawUrl = await uploadFileToStorage(familyId, userId, brokerId, "holding", buf, contentType);
        
        let parsed: { date: string; holdings: any[] } = { date: "", holdings: [] };
        try {
          if (contentType !== "application/pdf") {
            parsed = parseHoldingStatement(buf);
          }
        } catch (e) {
          console.error("Failed to parse holding statement", e);
        }
        
        const finalDate = customDate || parsed.date || new Date().toISOString().split("T")[0];

        const db = getFirestore(admin.app(), "default");
        let stmtRef;
        if (userId && brokerId) {
          stmtRef = db.collection("advanced_workspaces").doc(familyId)
            .collection("users").doc(userId)
            .collection("brokers").doc(brokerId)
            .collection("holding_statements").doc();
        } else if (userId) {
          stmtRef = db.collection("advanced_workspaces").doc(familyId)
            .collection("users").doc(userId)
            .collection("holding_statements").doc();
        } else {
          stmtRef = db.collection("advanced_workspaces").doc(familyId)
            .collection("holding_statements").doc();
        }

        await stmtRef.set({
          date: finalDate,
          holdings: parsed.holdings,
          rawFileUrl: rawUrl,
          uploadedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({ success: true, date: finalDate, id: stmtRef.id, url: rawUrl });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
  });

export const advancedReconcile = functions
  .runWith({ memory: "512MB", timeoutSeconds: 60 })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      try {
        const { familyId = "defaultFamily", userId, brokerId, statementId } = req.body;
        if (!statementId) { res.status(400).json({ error: "Missing statementId" }); return; }

        const db = getFirestore(admin.app(), "default");
        let statementsRef;
        if (userId && brokerId) {
          statementsRef = db.collection("advanced_workspaces").doc(familyId)
            .collection("users").doc(userId)
            .collection("brokers").doc(brokerId)
            .collection("holding_statements");
        } else if (userId) {
          statementsRef = db.collection("advanced_workspaces").doc(familyId)
            .collection("users").doc(userId)
            .collection("holding_statements");
        } else {
          statementsRef = db.collection("advanced_workspaces").doc(familyId)
            .collection("holding_statements");
        }

        const stmtSnap = await statementsRef.doc(statementId).get();
        if (!stmtSnap.exists) { res.status(404).json({ error: "Statement not found" }); return; }
        const stmtData = stmtSnap.data()!;
        const asOfDate = stmtData.date;
        const brokerHoldings = stmtData.holdings || [];

        let trades: Trade[] = [];
        let actions: CorporateAction[] = [];

        // Dynamic aggregation
        const usersRef = db.collection("advanced_workspaces").doc(familyId).collection("users");
        
        const fetchBrokerData = async (uid: string, bid: string) => {
           const doc = await usersRef.doc(uid).collection("brokers").doc(bid).get();
           if (doc.exists) {
             const data = doc.data();
             if (data?.trades) trades.push(...data.trades);
             if (data?.actions) actions.push(...data.actions);
           }
        };

        if (userId && brokerId) {
           await fetchBrokerData(userId, brokerId);
        } else {
           const bSnap = await db.collectionGroup("brokers").get();
           for (const doc of bSnap.docs) {
             const parts = doc.ref.path.split('/');
             if (parts.length < 6) continue;
             const fId = parts[1];
             const uId = parts[3];
             
             if (fId === familyId) {
                if (!userId || uId === userId) {
                   const data = doc.data();
                   if (data?.trades) trades.push(...data.trades);
                   if (data?.actions) actions.push(...data.actions);
                }
             }
           }
        }

        // Sort properly since we merged arrays
        trades.sort((a, b) => {
          const dateComp = a.date.localeCompare(b.date);
          if (dateComp !== 0) return dateComp;
          if (a.side.includes("Transfer") && !b.side.includes("Transfer")) return -1;
          if (!a.side.includes("Transfer") && b.side.includes("Transfer")) return 1;
          if (a.side === "Buy" && b.side === "Sell") return -1;
          if (a.side === "Sell" && b.side === "Buy") return 1;
          return 0;
        });
        actions.sort((a, b) => a.date.localeCompare(b.date));

        trades.forEach(t => { t.rawSymbol = t.rawSymbol || t.symbol; t.symbol = normalizeSymbol(t.symbol); });
        actions.forEach(a => { a.symbol = normalizeSymbol(a.symbol); });

        const minimalTrades = trades.map(t => ({ symbol: t.symbol, date: t.date }));
        const minimalActions = actions.map(a => ({ symbol: a.symbol, date: a.date }));
        
        // Fetch prices (only up to asOfDate to be safe)
        const prices = await fetchHistoricalPrices(minimalTrades, minimalActions);

        // 3. Compute Portfolio exactly on asOfDate
        // Merge Global Custom Prices
          const globalSnap = await db.collection("advanced_global_prices").get();
          const globalCustomPrices: any[] = [];
          for (const doc of globalSnap.docs) {
            const ticker = doc.id;
            const pMap = doc.data().prices || {};
            for (const [date, close] of Object.entries(pMap)) {
                globalCustomPrices.push({ ticker, date, close: close as number });
            }
          }
          prices.push(...globalCustomPrices);
          
          const calcResult = computePortfolio(trades, prices, actions);

        // 4. Perform Full Outer Join
        
        const targetDaily = calcResult.dailyPortfolio.find(d => d.date === asOfDate) || calcResult.dailyPortfolio.filter(d => d.date <= asOfDate).pop();
        const finalDaily = targetDaily ? targetDaily.holdings : {};
        const calcHoldingsMap = new Map();
        for (const [sym, data] of Object.entries(finalDaily)) {
          calcHoldingsMap.set(sym, data);
        }

        const brokerHoldingsMap = new Map(brokerHoldings.map((h: any) => [h.symbol, h]));
        
        const allSymbols = new Set([...calcHoldingsMap.keys(), ...brokerHoldingsMap.keys()]);
        
        const diffReport: any[] = [];
        
        for (const sym of allSymbols) {
          const ch = calcHoldingsMap.get(sym);
          const bh = brokerHoldingsMap.get(sym);

          const calcQty = ch ? ch.shares : 0;
          const brokerQty = bh ? (bh as any).qty : 0;
          
          if (calcQty === 0 && brokerQty === 0) continue; // Ghost from a past trade that the broker also agrees is 0

          diffReport.push({
            symbol: sym,
            calcQty,
            brokerQty,
            qtyDiff: calcQty - brokerQty,
            calcCost: ch ? (ch as any).cost : 0,
            brokerCost: bh ? (bh as any).avgCost * (bh as any).qty : 0,
            brokerAvgCost: bh ? (bh as any).avgCost : 0,
            currentValue: ch ? (ch as any).value : 0, // from our price engine
          });
        }

        res.status(200).json({
          asOfDate,
          rawFileUrl: stmtData.rawFileUrl,
          diffReport
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
  });

export const advancedGlobalPrices = functions
  .runWith({ memory: "256MB" })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      try {
        const db = getFirestore(admin.app(), "default");
        const globalPricesRef = db.collection("advanced_global_prices");

        if (req.method === "GET") {
          const snapshot = await globalPricesRef.get();
          const tickers = snapshot.docs.map(doc => doc.id);
          res.status(200).json({ tickers });
          return;
        }

        if (req.method === "POST") {
          const bb = Busboy({ headers: req.headers });
          const files: Record<string, Buffer> = {};
          const fields: Record<string, string> = {};

          await new Promise<void>((resolve, reject) => {
            bb.on("file", (fieldname: string, file: NodeJS.ReadableStream) => {
              const chunks: Buffer[] = [];
              file.on("data", (d) => chunks.push(d));
              file.on("end", () => { files[fieldname] = Buffer.concat(chunks); });
            });
            bb.on("field", (name, val) => { fields[name] = val; });
            bb.on("finish", resolve);
            bb.on("error", reject);
            if ((req as any).rawBody) bb.end((req as any).rawBody);
            else req.pipe(bb);
          });

          const ticker = fields["ticker"];
          const fileBuf = files["file"];

          if (!ticker || !fileBuf) {
            res.status(400).json({ error: "Missing ticker or file" });
            return;
          }

          const XLSX = await import("xlsx");
          const wb = XLSX.read(fileBuf, { type: "buffer", cellDates: false });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

          const priceMap: Record<string, number> = {};
          rows.forEach(r => {
            let d = r["Date"] || r["date"] || "";
            let p = parseFloat(r["Close"] || r["close"] || r["Price"] || r["price"]);
            if (d && !isNaN(p)) {
              // try parse date to YYYY-MM-DD
              const parsedDate = new Date(d);
              if (!isNaN(parsedDate.getTime())) {
                const dateStr = parsedDate.toISOString().split("T")[0];
                priceMap[dateStr] = p;
              }
            }
          });

          if (Object.keys(priceMap).length === 0) {
            res.status(400).json({ error: "No valid Date/Close rows found" });
            return;
          }

          await globalPricesRef.doc(ticker.toUpperCase()).set({
            prices: priceMap,
            updatedAt: new Date().toISOString()
          }, { merge: true });

          res.status(200).json({ success: true, count: Object.keys(priceMap).length });
          return;
        }

        res.status(405).json({ error: "Method not allowed" });
      } catch (err: any) {
        console.error("advancedGlobalPrices error:", err);
        res.status(500).json({ error: err.message });
      }
    });
  });
