import { Client } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

const schemaPath = path.join(process.cwd(), "db", "schema.sql");
const sqlText = fs.readFileSync(schemaPath, "utf-8");

// Split statements safely for our schema (no stored procedures beyond DO $$ $$ blocks which contain semicolons)
// We'll keep DO blocks intact by splitting on ';\n' and re-joining when inside $$.
function splitStatements(input){
  const out = [];
  let cur = "";
  let inDollar = false;
  for (let i=0;i<input.length;i++){
    const ch = input[i];
    cur += ch;
    if (cur.endsWith("$$")) inDollar = !inDollar;
    if (!inDollar && cur.endsWith(";\n")){
      out.push(cur.trim());
      cur = "";
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(s => s && !s.startsWith("--"));
}

const stmts = splitStatements(sqlText);

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();

try{
  for (const s of stmts){
    await client.query(s);
  }
  console.log("DB schema applied successfully.");
}finally{
  await client.end();
}
