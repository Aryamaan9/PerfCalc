const fs = require('fs');
const endpoints = [
  'advancedList', 'advancedSave', 'advancedAnalyze', 
  'advancedRawData', 'advancedRegroup', 'advancedAutoFetch', 'advancedValidate'
];

for (const ep of endpoints) {
  const dir = 'src/app/api/portfolio/' + ep;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  const content = `import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const text = await req.text();
    const body = text ? JSON.parse(text) : {};
    const res = await fetch('https://portfolio-alyzr-83921.web.app/api/portfolio/${ep}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const res = await fetch('https://portfolio-alyzr-83921.web.app/api/portfolio/${ep}');
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
`;

  fs.writeFileSync(dir + '/route.ts', content);
}
console.log('Created Next.js API proxy routes.');
