export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const isFormData = contentType.includes("multipart/form-data");
    
    let body: any;
    let headers: any = {};
    
    if (isFormData) {
      body = await req.formData();
    } else {
      return NextResponse.json({ error: "Requires multipart/form-data" }, { status: 400 });
    }

    const res = await fetch('https://portfolio-alyzr-83921.web.app/api/portfolio/advancedGlobalPrices', {
      method: 'POST',
      headers,
      body: body,
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const res = await fetch('https://portfolio-alyzr-83921.web.app/api/portfolio/advancedGlobalPrices');
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
