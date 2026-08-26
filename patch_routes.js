const fs = require('fs');
const endpoints = ['advancedList','advancedSave','advancedAnalyze','advancedRawData','advancedRegroup','advancedAutoFetch','advancedValidate'];

for (const ep of endpoints) {
  const filePath = `src/app/api/portfolio/${ep}/route.ts`;
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('force-dynamic')) {
    content = `export const dynamic = 'force-dynamic';\n` + content;
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${ep}`);
  }
}
console.log('Done');
