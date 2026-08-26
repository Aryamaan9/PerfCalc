import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";
import Busboy from "busboy";
import cors from "cors";

import { fetchHistoricalPrices } from "./services/yahooFinanceFetcher";
import { parseTrades, parseCorporateActions, computePortfolio, Trade, CorporateAction } from "./advancedEngine";
import { fetchCorporateActions, validateTickers } from "./advancedFeatures";

const corsHandler = cors({ origin: true });

export const advancedList = functions
  .runWith({ memory: "256MB" })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }
      try {
        const db = getFirestore(admin.app(), "default");
        // Structure: advanced_workspaces / {familyId} / users / {userId} / brokers / {brokerId} / data
        // For simplicity of MVP endpoint: we will just return the raw config of families/users/brokers
        const snap = await db.collection("advanced_workspaces").get();
        const workspaces = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json({ workspaces });
      } catch (err: any) {
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
        let familyId, userId, brokerId, trades, actions;

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
          trades = files["trades"] ? parseTrades(files["trades"]) : (fields["tradesJson"] ? JSON.parse(fields["tradesJson"]) : []);
          actions = files["actions"] ? parseCorporateActions(files["actions"]) : (fields["actionsJson"] ? JSON.parse(fields["actionsJson"]) : []);
        } else {
          // JSON payload
          familyId = req.body.familyId || "defaultFamily";
          userId = req.body.userId;
          brokerId = req.body.brokerId;
          trades = req.body.tradesJson !== undefined ? JSON.parse(req.body.tradesJson) : undefined;
          actions = req.body.actionsJson !== undefined ? JSON.parse(req.body.actionsJson) : undefined;
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
          batch.set(docRef, updateData, { merge: true });
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
            batch.set(docRef, updateData, { merge: true });
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
        } else if (userId) {
           const bSnap = await usersRef.doc(userId).collection("brokers").get();
           for (const b of bSnap.docs) await fetchBrokerData(userId, b.id);
        } else {
           const uSnap = await usersRef.get();
           for (const u of uSnap.docs) {
             const bSnap = await usersRef.doc(u.id).collection("brokers").get();
             for (const b of bSnap.docs) await fetchBrokerData(u.id, b.id);
           }
        }

        trades.sort((a, b) => a.date.localeCompare(b.date));
        actions.sort((a, b) => a.date.localeCompare(b.date));

        res.status(200).json({ trades, actions });
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
        } else if (userId) {
           const bSnap = await usersRef.doc(userId).collection("brokers").get();
           for (const b of bSnap.docs) await fetchBrokerData(userId, b.id);
        } else {
           const uSnap = await usersRef.get();
           for (const u of uSnap.docs) {
             const bSnap = await usersRef.doc(u.id).collection("brokers").get();
             for (const b of bSnap.docs) await fetchBrokerData(u.id, b.id);
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

        const minimalTrades = trades.map(t => ({ symbol: t.symbol, date: t.date }));
        const minimalActions = actions.map(a => ({ symbol: a.symbol, date: a.date }));
        const prices = await fetchHistoricalPrices(minimalTrades, minimalActions);

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
        const { symbol, startDate, endDate } = req.body;
        if (!symbol || !startDate || !endDate) {
          res.status(400).json({ error: "symbol, startDate, endDate required" }); return;
        }
        
        const actions = await fetchCorporateActions(symbol, startDate, endDate);
        res.status(200).json({ actions });
      } catch (err: any) {
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
