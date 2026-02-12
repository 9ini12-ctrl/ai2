// Browser-safe lightweight CSV preview parser (no Node deps)
// Supports quoted fields, escaped quotes (""), and quoted newlines.

function stripBOM(s){
  return String(s || "").replace(/^\uFEFF/, "");
}

function getFirstRecord(text){
  let inQuotes = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (c === '"'){
      if (inQuotes && text[i+1] === '"'){ i++; continue; }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (c === "\n" || c === "\r")){
      return text.slice(0, i);
    }
  }
  return text;
}

function countDelimiterOutsideQuotes(record, delim){
  let inQuotes = false;
  let count = 0;
  for (let i = 0; i < record.length; i++){
    const c = record[i];
    if (c === '"'){
      if (inQuotes && record[i+1] === '"'){ i++; continue; }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && c === delim) count++;
  }
  return count;
}

function detectDelimiter(text){
  const rec = getFirstRecord(text);
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates){
    const n = countDelimiterOutsideQuotes(rec, d);
    if (n > bestCount){ bestCount = n; best = d; }
  }
  return best;
}

function parseRows(text, delim, maxRows){
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++){
    const c = text[i];

    if (c === '"'){
      if (inQuotes && text[i+1] === '"'){
        field += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && c === delim){
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (c === "\n" || c === "\r")){
      // handle CRLF
      if (c === "\r" && text[i+1] === "\n") i++;
      row.push(field);
      field = "";
      // ignore completely empty trailing row
      const isEmpty = row.length === 1 && row[0].trim() === "";
      if (!isEmpty){
        rows.push(row);
        if (rows.length >= maxRows) return rows;
      }
      row = [];
      continue;
    }

    field += c;
  }

  // last row
  if (field.length || row.length){
    row.push(field);
    const isEmpty = row.length === 1 && row[0].trim() === "";
    if (!isEmpty) rows.push(row);
  }
  return rows;
}

// Preview helper (client-side)
export function parseCsvPreview(csvText, limit = 20){
  const text = stripBOM(csvText || "");
  const delim = detectDelimiter(text);
  const rowsArr = parseRows(text, delim, limit + 1); // + header
  if (!rowsArr.length) return { headers: [], rows: [] };

  const headers = (rowsArr[0] || []).map(h => String(h || "").trim());
  const out = [];
  for (let i = 1; i < rowsArr.length && out.length < limit; i++){
    const r = rowsArr[i] || [];
    const obj = {};
    for (let c = 0; c < headers.length; c++){
      const key = headers[c] || `col_${c+1}`;
      obj[key] = (r[c] ?? "").toString();
    }
    out.push(obj);
  }
  return { headers, rows: out };
}

// Normalizes common Arabic/English headers (for preview only)
export function normalizeCsvHeaders(headers){
  return (headers || []).map(h => String(h || "").trim());
}
