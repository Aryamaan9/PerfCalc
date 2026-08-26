export function formatDateUI(dateStr: string): string {
  if (!dateStr) return "";
  
  // Trim and take only the first 10 characters (YYYY-MM-DD or DD-MM-YYYY)
  const clean = dateStr.trim().split(/[\sT]/)[0];
  
  // 1) Match YYYY-MM-DD or YYYY/MM/DD
  const m1 = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m1) {
    return `${m1[3].padStart(2, "0")}-${m1[2].padStart(2, "0")}-${m1[1]}`;
  }

  // 2) Match DD-MM-YYYY or DD/MM/YYYY
  const m2 = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m2) {
    return `${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}-${m2[3]}`;
  }

  // 3) Match DD-MM-YY or DD/MM/YY
  const m3 = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (m3) {
    const yy = parseInt(m3[3]);
    const yyyy = yy < 70 ? 2000 + yy : 1900 + yy;
    return `${m3[1].padStart(2, "0")}-${m3[2].padStart(2, "0")}-${yyyy}`;
  }

  return dateStr;
}
