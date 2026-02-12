import jwt from "jsonwebtoken";
import { unauthorized } from "./_utils.mjs";

export function signAdminToken(payload){
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  return jwt.sign(payload, secret, { expiresIn: "12h" });
}

export function verifyAdmin(event){
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  const auth = event.headers?.authorization || event.headers?.Authorization || "";
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  if (!m) return { ok:false, res: unauthorized("Missing token") };
  try{
    const decoded = jwt.verify(m[1], secret);
    return { ok:true, decoded };
  }catch(e){
    return { ok:false, res: unauthorized("Invalid token") };
  }
}
