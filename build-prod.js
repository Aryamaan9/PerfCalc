/**
 * Production build script.
 * The advanced api proxy routes only work in `next dev` (local dev).
 * They are incompatible with `output: 'export'` (static build).
 * This script temporarily removes them before build, then restores them.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const advancedRoutes = [
  'advancedList', 'advancedSave', 'advancedAnalyze',
  'advancedRawData', 'advancedRegroup', 'advancedAutoFetch', 'advancedValidate', 'advancedDelete'
];

const baseDir = path.join(__dirname, 'src/app/api/portfolio');
const backupDir = path.join(__dirname, '.route_backup');

// Backup and remove advanced routes
console.log('Backing up advanced proxy routes...');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

for (const ep of advancedRoutes) {
  const src = path.join(baseDir, ep);
  const dest = path.join(backupDir, ep);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
    fs.rmSync(src, { recursive: true, force: true });
    console.log(`  Removed ${ep}`);
  }
}

try {
  // Run the actual Next.js build
  console.log('\nRunning next build...');
  execSync('next build', { stdio: 'inherit' });
  
  // Clean up the /out/api folder (remaining legacy routes)
  const outApi = path.join(__dirname, 'out/api');
  if (fs.existsSync(outApi)) {
    fs.rmSync(outApi, { recursive: true, force: true });
    console.log('\nCleaned out/api');
  }
} finally {
  // Always restore the routes
  console.log('\nRestoring advanced proxy routes...');
  for (const ep of advancedRoutes) {
    const src = path.join(backupDir, ep);
    const dest = path.join(baseDir, ep);
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true });
      console.log(`  Restored ${ep}`);
    }
  }
  fs.rmSync(backupDir, { recursive: true, force: true });
}

console.log('\nBuild complete!');
