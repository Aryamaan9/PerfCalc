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

        const familyId = fields["familyId"] || "defaultFamily";
        const userId = fields["userId"];
        const brokerId = fields["brokerId"];
        
        if (!userId || !brokerId) {
          res.status(400).json({ error: "userId and brokerId are required" }); return;
        }

        const trades = files["trades"] ? parseTrades(files["trades"]) : (fields["tradesJson"] ? JSON.parse(fields["tradesJson"]) : []);
        const actions = files["actions"] ? parseCorporateActions(files["actions"]) : (fields["actionsJson"] ? JSON.parse(fields["actionsJson"]) : []);

        const db = getFirestore(admin.app(), "default");
        const docRef = db.collection("advanced_workspaces")
                         .doc(familyId)
                         .collection("users")
                         .doc(userId)
                         .collection("brokers")
                         .doc(brokerId);
                         
        await docRef.set({
          trades,
          actions,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        res.status(200).json({ success: true, trades, actions });
      } catch (err: any) {
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
