const admin = require('firebase-admin');

// Initialize app with local credentials or default env
admin.initializeApp({
  projectId: "portfolio-alyzr-83921"
});

const db = admin.firestore();

async function deleteMocks() {
  const brokersSnap = await db.collectionGroup("brokers").get();
  
  const docsToDelete = [];
  
  brokersSnap.forEach(doc => {
    const parts = doc.ref.path.split('/');
    if (parts.length < 6) return;
    const fId = parts[1];
    
    // Check if it's a mock
    if (fId.startsWith('TestFam_') || fId.startsWith('HoldFam_') || 
        fId.startsWith('Fam1_') || fId.startsWith('Fam2_') || 
        fId.startsWith('WarnFam_') || fId.startsWith('FlowFam_') || 
        fId === 'trt' || fId === 'AnotherFam' || fId === 'TestFamily') {
      
      docsToDelete.push(doc.ref);
    }
  });

  console.log(`Found ${docsToDelete.length} mock broker docs to delete...`);
  
  const batch = db.batch();
  let count = 0;
  for (const ref of docsToDelete) {
    batch.delete(ref);
    count++;
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`Committed ${count} deletes...`);
    }
  }
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log('Finished deleting mock broker documents.');

  // Also delete corporate actions
  const actionsSnap = await db.collectionGroup("corporate_actions").get();
  const actionsToDelete = [];
  actionsSnap.forEach(doc => {
    const parts = doc.ref.path.split('/');
    if (parts.length < 6) return;
    const fId = parts[1];
    if (fId.startsWith('TestFam_') || fId.startsWith('HoldFam_') || 
        fId.startsWith('Fam1_') || fId.startsWith('Fam2_') || 
        fId.startsWith('WarnFam_') || fId.startsWith('FlowFam_') || 
        fId === 'trt' || fId === 'AnotherFam' || fId === 'TestFamily') {
      actionsToDelete.push(doc.ref);
    }
  });

  console.log(`Found ${actionsToDelete.length} mock corporate action docs to delete...`);
  
  const batch2 = db.batch();
  count = 0;
  for (const ref of actionsToDelete) {
    batch2.delete(ref);
    count++;
  }
  if (count > 0) {
    await batch2.commit();
  }
  console.log('Finished deleting mock corporate actions.');
  
  // Also delete the family documents themselves if they exist
  const familiesSnap = await db.collection('advanced_portfolios').get();
  const famsToDelete = [];
  familiesSnap.forEach(doc => {
    const fId = doc.id;
    if (fId.startsWith('TestFam_') || fId.startsWith('HoldFam_') || 
        fId.startsWith('Fam1_') || fId.startsWith('Fam2_') || 
        fId.startsWith('WarnFam_') || fId.startsWith('FlowFam_') || 
        fId === 'trt' || fId === 'AnotherFam' || fId === 'TestFamily') {
      famsToDelete.push(doc.ref);
    }
  });

  console.log(`Found ${famsToDelete.length} mock family docs to delete...`);
  const batch3 = db.batch();
  count = 0;
  for (const ref of famsToDelete) {
    batch3.delete(ref);
    count++;
  }
  if (count > 0) {
    await batch3.commit();
  }
  console.log('Finished deleting mock family docs.');
  
  process.exit(0);
}

deleteMocks().catch(console.error);
