import { parse } from "csv-parse/sync";

// Preview helper (client-side)
export function parseCsvPreview(csvText, limit=20){
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true
  });
  const headers = records.length ? Object.keys(records[0]) : [];
  return { headers, rows: records.slice(0, limit) };
}

// Normalizes common Arabic/English headers (for preview only)
export function normalizeCsvHeaders(headers){
  return (headers||[]).map(h => String(h||"").trim());
}
