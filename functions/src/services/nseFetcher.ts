import { CorporateAction } from "../advancedEngine";

export async function fetchNseCorporateActions(symbol: string): Promise<CorporateAction[]> {
  try {
    const rawSymbol = symbol.replace('.NS', '');
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    
    // 1. Fetch cookie
    const homeRes = await fetch('https://www.nseindia.com', { headers });
    const cookies = homeRes.headers.get('set-cookie');
    if (cookies) {
      headers['Cookie'] = cookies;
    }
    
    // 2. Fetch API
    const url = "https://www.nseindia.com/api/corporates-corporateActions?index=equities&symbol=" + rawSymbol;
    const apiRes = await fetch(url, { headers });
    
    if (!apiRes.ok) {
      console.warn("NSE API returned status: " + apiRes.status);
      return [];
    }
    
    const data = await apiRes.json();
    if (!Array.isArray(data)) return [];
    
    const actions: CorporateAction[] = [];
    
    for (const item of data) {
      if (!item.exDate || item.exDate === "-") continue;
      
      const dateParts = item.exDate.split('-'); // e.g. 05-Jun-2026
      if (dateParts.length !== 3) continue;
      
      const months: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
      const formattedDate = dateParts[2] + "-" + months[dateParts[1]] + "-" + dateParts[0].padStart(2, '0');
      
      const subject = (item.subject || "").toLowerCase();
      let actionType: any = null;
      
      if (subject.includes("arrangement") || subject.includes("demerger") || subject.includes("spin-off")) {
        actionType = "Merger Swap";
      } else if (subject.includes("amalgamation") || subject.includes("merger")) {
        actionType = "Merger Swap";
      } else if (subject.includes("rights")) {
        actionType = "Transfer In"; // Placeholder for rights
      }
      
      if (actionType) {
        actions.push({
          date: formattedDate,
          symbol: symbol,
          action: actionType,
          value: 1, // Placeholder ratio/value, user must edit this
          // @ts-ignore
          description: item.subject,
          status: "PENDING"
        });
      }
    }
    
    return actions;
  } catch (err: any) {
    console.error("NSE Scrape Error for " + symbol, err.message);
    return [];
  }
}
