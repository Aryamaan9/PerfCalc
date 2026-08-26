const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "portfolio-alyzr-83921"
});

async function run() {
  try {
    const db = admin.firestore(); // default
    db.settings({ databaseId: 'default' }); // Is this possible?
  } catch(e) {}
  
  try {
    // getFirestore was introduced in newer versions, or maybe it's exposed on admin.firestore
    const { getFirestore } = require('firebase-admin/firestore');
    const db2 = getFirestore(admin.app(), 'default');
    const snap = await db2.collection("portfolios").get();
    console.log("Success with getFirestore! Count:", snap.size);
  } catch(err) {
    console.error("Error:", err.message);
  }
}

run();
