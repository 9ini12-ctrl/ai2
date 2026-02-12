import { Pool } from "@neondatabase/serverless";

let _pool;

export function getPool(){
  if (_pool) return _pool;
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error("Missing DATABASE_URL");
  _pool = new Pool({ connectionString: cs });
  return _pool;
}

export async function withClient(fn){
  const pool = getPool();
  const client = await pool.connect();
  try{
    return await fn(client);
  } finally {
    client.release();
  }
}
