const XLSX = require('xlsx');

const MONTH_MAP = {
  jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
  jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
  january:"01",february:"02",march:"03",april:"04",june:"06",
  july:"07",august:"08",september:"09",october:"10",november:"11",december:"12",
};

function formatDateLocal(dt) {
  if (isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(raw) {
  if (!raw && raw !== 0) return "";

  // Handle JS Date objects
  if (raw instanceof Date) {
    return formatDateLocal(raw);
  }

  // Handle Excel serial date numbers
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return "";
    return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }

  // Everything else: coerce to string and try patterns
  const s = String(raw).trim();
  if (!s) return "";

  // Split to get only the date portion (ignore time part)
  const datePart = s.split(/[\sT]/)[0].trim();
  if (!datePart) return "";

  // 1) YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
  const mIso = datePart.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (mIso) {
    return `${mIso[1]}-${mIso[2].padStart(2,"0")}-${mIso[3].padStart(2,"0")}`;
  }

  // 2) DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const mDmy4 = datePart.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (mDmy4) {
    return `${mDmy4[3]}-${mDmy4[2].padStart(2,"0")}-${mDmy4[1].padStart(2,"0")}`;
  }

  // 3) DD/MM/YY or DD-MM-YY or DD.MM.YY
  const mDmy2 = datePart.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (mDmy2) {
    const yy = parseInt(mDmy2[3]);
    const yyyy = yy < 70 ? 2000 + yy : 1900 + yy;
    return `${yyyy}-${mDmy2[2].padStart(2,"0")}-${mDmy2[1].padStart(2,"0")}`;
  }

  // 4) 8 digits without separator (e.g. "26052021" or "20210526")
  if (/^\d{8}$/.test(datePart)) {
    const first4 = parseInt(datePart.slice(0, 4));
    const last4 = parseInt(datePart.slice(4, 8));
    if (first4 >= 1900 && first4 <= 2100) {
      return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
    } else if (last4 >= 1900 && last4 <= 2100) {
      return `${datePart.slice(4, 8)}-${datePart.slice(2, 4)}-${datePart.slice(0, 2)}`;
    }
  }

  // 4b) 5 digits Excel serial date string (e.g. "44342")
  if (/^\d{5}$/.test(datePart)) {
    const num = parseInt(datePart);
    const d = XLSX.SSF.parse_date_code(num);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
    }
  }

  // 5) 6 digits without separator (e.g. "260521")
  if (/^\d{6}$/.test(datePart)) {
    const dd = datePart.slice(0, 2);
    const mm = datePart.slice(2, 4);
    const yy = parseInt(datePart.slice(4, 6));
    const yyyy = yy < 70 ? 2000 + yy : 1900 + yy;
    return `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
  }

  // 6) DD-Mon-YYYY  /  DD Mon YYYY  /  DD/Mon/YYYY  (e.g. "01-Jun-2021")
  const m3 = s.match(/^(\d{1,2})[\/\-\s]([A-Za-z]{3,9})[\/\-\s,]*(\d{2,4})/);
  if (m3) {
    const mon = MONTH_MAP[m3[2].toLowerCase().slice(0, 3)];
    if (mon) {
      const yr = m3[3].length === 2 ? `20${m3[3]}` : m3[3];
      return `${yr}-${mon}-${m3[1].padStart(2,"0")}`;
    }
  }

  // 7) Mon DD, YYYY  (e.g. "Jun 01, 2021")
  const m4 = s.match(/^([A-Za-z]{3,9})[\/\-\s,]*(\d{1,2})[\/\-\s,]*(\d{4})/);
  if (m4) {
    const mon = MONTH_MAP[m4[1].toLowerCase().slice(0, 3)];
    if (mon) return `${m4[3]}-${mon}-${m4[2].padStart(2,"0")}`;
  }

  // 8) Fallback: let JS Date constructor try to parse it
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return formatDateLocal(parsed);
  }

  console.warn(`[parseDate] Unable to parse date: "${s}"`);
  return "";
}

// Test cases
const cases = [
  "31-03-2021",
  "07-04-2021",
  "26-05-2021",
  "30-07-2021",
  "01-07-2022",
  "04-07-2022",
  "12-07-2022",
  "14-07-2022",
  "12-09-2022",
  "13-09-2022",
  "13-12-2022",
  "28-12-2022",
  "09-01-2023",
  "31/12/28",
  "31/12/26",
  "28/12/26",
  "28-12-26",
  "44908" // Excel serial for 13-12-2022
];

for (const c of cases) {
  console.log(`Input: "${c}" -> Parsed: "${parseDate(c)}"`);
}
