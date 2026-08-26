import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const text = await req.text();
    const body = text ? JSON.parse(text) : {};
    const res = await fetch('https://portfolio-alyzr-83921.web.app/api/portfolio/advancedAnalyze', {
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
    const res = await fetch('https://portfolio-alyzr-83921.web.app/api/portfolio/advancedAnalyze');
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
