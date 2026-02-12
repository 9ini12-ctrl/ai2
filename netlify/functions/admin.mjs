import { withClient } from "./_db.mjs";
import { json, badRequest, notFound, methodNotAllowed, getQuery, readJson } from "./_utils.mjs";
import { verifyAdmin, signAdminToken } from "./_auth.mjs";
import { parseCsv, validateDonations, validateBoxes } from "./_csv.mjs";

export const handler = async (event) => {
  const q = getQuery(event);
  const path = (q.path || "").replace(/^\/+/,""); // e.g. "login" OR "ambassadors/1"
  const parts = path.split("/").filter(Boolean);

  // login is public
  if (parts[0] === "login"){
    if (event.httpMethod !== "POST") return methodNotAllowed();
    const body = await readJson(event);
    const seedKey = (body.seed_key || "").trim();
    const username = (body.username || "").trim();
    const password = body.password || "";

    const envSeed = (process.env.ADMIN_SEED_KEY || "").trim();
    const envUser = (process.env.ADMIN_USERNAME || "admin").trim();
    const envPass = (process.env.ADMIN_PASSWORD || "").trim();

    const okBySeed = envSeed && seedKey && seedKey === envSeed;
    const okByUser = username && password && username === envUser && password === envPass;

    if (!okBySeed && !okByUser) return json(401, { error:"بيانات الدخول غير صحيحة" });

    const token = signAdminToken({ role:"admin", sub: username || "admin" });
    return json(200, { token });
  }

  // other endpoints protected
  const auth = verifyAdmin(event);
  if (!auth.ok) return auth.res;

  // task completions (manual_admin)
  if (parts[0] === "task-completions"){
    if (event.httpMethod !== "POST") return methodNotAllowed();
    const body = await readJson(event);
    const { date, scope, subject, task_id, is_done } = body || {};
    if (!date || !scope || !subject || !task_id) return badRequest("Missing fields");
    return withClient(async (c)=>{
      if (scope === "ambassador"){
        const amb = await c.query(`SELECT id FROM ambassadors WHERE numsafer=$1`, [subject]);
        if (!amb.rowCount) return notFound("Ambassador not found");
        await c.query(`
          INSERT INTO task_completions(task_id,date,ambassador_id,is_done,done_at,done_by)
          VALUES($1,$2::date,$3,$4,CASE WHEN $4 THEN NOW() ELSE NULL END,'admin')
          ON CONFLICT (task_id, date, ambassador_id)
          DO UPDATE SET is_done=$4, done_at=CASE WHEN $4 THEN NOW() ELSE NULL END, done_by='admin'
        `,[task_id, date, amb.rows[0].id, !!is_done]);
        return json(200, { ok:true, message:"Saved" });
      }
      if (scope === "branch"){
        const br = await c.query(`SELECT id FROM branches WHERE numfre=$1`, [subject]);
        if (!br.rowCount) return notFound("Branch not found");
        await c.query(`
          INSERT INTO task_completions(task_id,date,branch_id,is_done,done_at,done_by)
          VALUES($1,$2::date,$3,$4,CASE WHEN $4 THEN NOW() ELSE NULL END,'admin')
          ON CONFLICT (task_id, date, branch_id)
          DO UPDATE SET is_done=$4, done_at=CASE WHEN $4 THEN NOW() ELSE NULL END, done_by='admin'
        `,[task_id, date, br.rows[0].id, !!is_done]);
        return json(200, { ok:true, message:"Saved" });
      }
      return badRequest("Unknown scope");
    });
  }

  // uploads
  if (parts[0] === "upload"){
    if (event.httpMethod !== "POST") return methodNotAllowed();
    const kind = parts[1];
    const body = await readJson(event);
    const csv = String(body.csv || "");
    if (!csv.trim()) return badRequest("CSV is empty");

    return withClient(async (c)=>{
      if (kind === "donations"){
        const rows = parseCsv(csv);
        const { accepted, rejected } = validateDonations(rows);

        let duplicates = 0;
        let inserted = 0;
        for (const r of accepted){
          const res = await c.query(`
            INSERT INTO donations(donation_date,amount,donor_phone,referral_code,source_row_hash)
            VALUES($1::timestamptz,$2,$3,$4,$5)
            ON CONFLICT (source_row_hash) DO NOTHING
          `,[r.donation_date, r.amount, r.donor_phone, r.referral_code, r.source_row_hash]);
          if (res.rowCount) inserted += 1; else duplicates += 1;
        }
        return json(200, {
          accepted: inserted,
          duplicates,
          rejected: rejected.length,
          rejected_samples: rejected.slice(0,10).map(x=> ({ reason:x.reason }))
        });
      }

      if (kind === "boxes"){
        const rows = parseCsv(csv);
        const { accepted, rejected } = validateBoxes(rows);

        let duplicates = 0;
        let inserted = 0;
        for (const r of accepted){
          const res = await c.query(`
            INSERT INTO boxes(created_at,box_number,donor_phone,referral_code,source_row_hash)
            VALUES($1::timestamptz,$2,$3,$4,$5)
            ON CONFLICT (source_row_hash) DO NOTHING
          `,[r.created_at, r.box_number, r.donor_phone, r.referral_code, r.source_row_hash]);
          if (res.rowCount) inserted += 1; else duplicates += 1;
        }
        return json(200, {
          accepted: inserted,
          duplicates,
          rejected: rejected.length,
          rejected_samples: rejected.slice(0,10).map(x=> ({ reason:x.reason }))
        });
      }

      return badRequest("Unknown upload kind");
    });
  }

  // CRUD
  const resource = parts[0] || "";
  const id = parts[1] || null;

  if (resource === "ambassadors") return ambassadorsCrud(event, id);
  if (resource === "branches") return branchesCrud(event, id);
  if (resource === "coupons") return couponsCrud(event, id);
  if (resource === "messages") return messagesCrud(event, id);
  if (resource === "plans" && parts[1] === "ambassadors") return plansAmbCrud(event, parts[2] || null);
  if (resource === "plans" && parts[1] === "branches") return plansBrCrud(event, parts[2] || null);

  return notFound("Unknown admin endpoint");
};

// --- CRUD implementations ---
function ambassadorsCrud(event, id){
  if (event.httpMethod === "GET"){
    return withClient(async (c)=>{
      const r = await c.query(`
        SELECT a.id, a.numsafer, a.name, a.phone, a.referral_code, b.numfre AS branch_numfre, a.vars
        FROM ambassadors a
        LEFT JOIN branches b ON b.id = a.branch_id
        ORDER BY a.id DESC
        LIMIT 500
      `);
      return json(200, { items: r.rows });
    });
  }
  if (event.httpMethod === "POST"){
    return withClient(async (c)=>{
      const body = await readJson(event);
      const { numsafer, name, phone, referral_code, branch_numfre, vars } = body || {};
      if (!numsafer || !phone || !referral_code) return badRequest("numsafer, phone, referral_code are required");
      const br = branch_numfre ? await c.query(`SELECT id FROM branches WHERE numfre=$1`, [branch_numfre]) : null;
      const branch_id = br && br.rowCount ? br.rows[0].id : null;
      const r = await c.query(`
        INSERT INTO ambassadors(numsafer,name,phone,referral_code,branch_id,vars)
        VALUES($1,$2,$3,$4,$5,$6::jsonb)
        RETURNING id
      `,[numsafer, name || null, phone, referral_code, branch_id, JSON.stringify(vars || {})]);
      return json(200, { id: r.rows[0].id });
    });
  }
  if (event.httpMethod === "PUT"){
    if (!id) return badRequest("Missing id");
    return withClient(async (c)=>{
      const body = await readJson(event);
      const { numsafer, name, phone, referral_code, branch_numfre, vars } = body || {};
      const br = branch_numfre ? await c.query(`SELECT id FROM branches WHERE numfre=$1`, [branch_numfre]) : null;
      const branch_id = br && br.rowCount ? br.rows[0].id : null;
      await c.query(`
        UPDATE ambassadors
        SET numsafer=COALESCE($2,numsafer),
            name=$3,
            phone=COALESCE($4,phone),
            referral_code=COALESCE($5,referral_code),
            branch_id=$6,
            vars=COALESCE($7::jsonb,vars),
            updated_at=NOW()
        WHERE id=$1
      `,[id, numsafer || null, (name===undefined?null:name), phone || null, referral_code || null, branch_id, vars ? JSON.stringify(vars) : null]);
      return json(200, { ok:true });
    });
  }
  if (event.httpMethod === "DELETE"){
    if (!id) return badRequest("Missing id");
    return withClient(async (c)=>{
      await c.query(`DELETE FROM ambassadors WHERE id=$1`, [id]);
      return json(200, { ok:true });
    });
  }
  return methodNotAllowed();
}

function branchesCrud(event, id){
  if (event.httpMethod === "GET"){
    return withClient(async (c)=>{
      const r = await c.query(`SELECT id, numfre, name, vars FROM branches ORDER BY id DESC LIMIT 200`);
      return json(200, { items: r.rows });
    });
  }
  if (event.httpMethod === "POST"){
    return withClient(async (c)=>{
      const body = await readJson(event);
      const { numfre, name, vars } = body || {};
      if (!numfre || !name) return badRequest("numfre, name required");
      const r = await c.query(`
        INSERT INTO branches(numfre,name,vars)
        VALUES($1,$2,$3::jsonb)
        RETURNING id
      `,[numfre, name, JSON.stringify(vars || {})]);
      return json(200, { id: r.rows[0].id });
    });
  }
  if (event.httpMethod === "PUT"){
    if (!id) return badRequest("Missing id");
    return withClient(async (c)=>{
      const body = await readJson(event);
      const { numfre, name, vars } = body || {};
      await c.query(`
        UPDATE branches
        SET numfre=COALESCE($2,numfre),
            name=COALESCE($3,name),
            vars=COALESCE($4::jsonb,vars),
            updated_at=NOW()
        WHERE id=$1
      `,[id, numfre || null, name || null, vars ? JSON.stringify(vars) : null]);
      return json(200, { ok:true });
    });
  }
  if (event.httpMethod === "DELETE"){
    if (!id) return badRequest("Missing id");
    return withClient(async (c)=>{
      await c.query(`DELETE FROM branches WHERE id=$1`, [id]);
      return json(200, { ok:true });
    });
  }
  return methodNotAllowed();
}

function couponsCrud(event, id){
  if (event.httpMethod === "GET"){
    return withClient(async (c)=>{
      const r = await c.query(`SELECT id, code, title, is_active, meta FROM coupons ORDER BY id DESC LIMIT 500`);
      return json(200, { items: r.rows });
    });
  }
  if (event.httpMethod === "POST"){
    return withClient(async (c)=>{
      const body = await readJson(event);
      const { code, title, is_active, meta } = body || {};
      if (!code) return badRequest("code required");
      const r = await c.query(`
        INSERT INTO coupons(code,title,is_active,meta)
        VALUES($1,$2,$3,$4::jsonb)
        RETURNING id
      `,[code, title || null, String(is_active).toLowerCase()==="false" ? false : true, JSON.stringify(meta || {})]);
      return json(200, { id: r.rows[0].id });
    });
  }
  if (event.httpMethod === "PUT"){
    if (!id) return badRequest("Missing id");
    return withClient(async (c)=>{
      const body = await readJson(event);
      const { code, title, is_active, meta } = body || {};
      const isAct = (is_active === undefined || is_active === null || is_active === "") ? null : (String(is_active).toLowerCase() !== "false");
      await c.query(`
        UPDATE coupons
        SET code=COALESCE($2,code),
            title=$3,
            is_active=COALESCE($4,is_active),
            meta=COALESCE($5::jsonb,meta),
            updated_at=NOW()
        WHERE id=$1
      `,[id, code || null, (title===undefined?null:title), isAct, meta ? JSON.stringify(meta) : null]);
      return json(200, { ok:true });
    });
  }
  if (event.httpMethod === "DELETE"){
    if (!id) return badRequest("Missing id");
    return withClient(async (c)=>{
      await c.query(`DELETE FROM coupons WHERE id=$1`, [id]);
      return json(200, { ok:true });
    });
  }
  return methodNotAllowed();
}

function messagesCrud(event, id){
  if (event.httpMethod === "GET"){
    return withClient(async (c)=>{
      const r = await c.query(`SELECT id, date, share_title, image_url, text_template FROM messages ORDER BY date DESC LIMIT 120`);
      return json(200, { items: r.rows });
    });
  }
  if (event.httpMethod === "POST"){
    return withClient(async (c)=>{
      const body = await readJson(event);
      const { date, share_title, image_url, text_template } = body || {};
      if (!date || !image_url) return badRequest("date and image_url required");
      const r = await c.query(`
        INSERT INTO messages(date,share_title,image_url,text_template)
        VALUES($1::date,$2,$3,$4)
        RETURNING id
      `,[date, share_title || null, image_url, text_template || ""]);
      return json(200, { id: r.rows[0].id });
    });
  }
  if (event.httpMethod === "PUT"){
    if (!id) return badRequest("Missing id");
    return withClient(async (c)=>{
      const body = await readJson(event);
      const { date, share_title, image_url, text_template } = body || {};
      await c.query(`
        UPDATE messages
        SET date=COALESCE($2::date,date),
            share_title=$3,
            image_url=COALESCE($4,image_url),
            text_template=COALESCE($5,text_template)
        WHERE id=$1
      `,[id, date || null, (share_title===undefined?null:share_title), image_url || null, text_template || null]);
      return json(200, { ok:true });
    });
  }
  if (event.httpMethod === "DELETE"){
    if (!id) return badRequest("Missing id");
    return withClient(async (c)=>{
      await c.query(`DELETE FROM messages WHERE id=$1`, [id]);
      return json(200, { ok:true });
    });
  }
  return methodNotAllowed();
}

function plansAmbCrud(event, id){
  if (event.httpMethod === "GET"){
    return withClient(async (c)=>{
      const r = await c.query(`SELECT id, date, headline, targets FROM daily_plans_ambassadors ORDER BY date DESC LIMIT 120`);
      return json(200, { items: r.rows });
    });
  }
  if (event.httpMethod === "POST"){
    return withClient(async (c)=>{
      const body = await readJson(event);
      const { date, headline, targets } = body || {};
      if (!date) return badRequest("date required");
      const r = await c.query(`
        INSERT INTO daily_plans_ambassadors(date,headline,targets)
        VALUES($1::date,$2,$3::jsonb)
        RETURNING id
      `,[date, headline || "", JSON.stringify(targets || { boxes:0, donations:0 })]);
      return json(200, { id: r.rows[0].id });
    });
  }
  if (event.httpMethod === "PUT"){
    if (!id) return badRequest("Missing id");
    return withClient(async (c)=>{
      const body = await readJson(event);
      const { date, headline, targets } = body || {};
      await c.query(`
        UPDATE daily_plans_ambassadors
        SET date=COALESCE($2::date,date),
            headline=COALESCE($3,headline),
            targets=COALESCE($4::jsonb,targets)
        WHERE id=$1
      `,[id, date || null, headline || null, targets ? JSON.stringify(targets) : null]);
      return json(200, { ok:true });
    });
  }
  if (event.httpMethod === "DELETE"){
    if (!id) return badRequest("Missing id");
    return withClient(async (c)=>{
      await c.query(`DELETE FROM daily_plans_ambassadors WHERE id=$1`, [id]);
      return json(200, { ok:true });
    });
  }
  return methodNotAllowed();
}

function plansBrCrud(event, id){
  if (event.httpMethod === "GET"){
    return withClient(async (c)=>{
      const r = await c.query(`SELECT id, date, headline, targets FROM daily_plans_branches ORDER BY date DESC LIMIT 120`);
      return json(200, { items: r.rows });
    });
  }
  if (event.httpMethod === "POST"){
    return withClient(async (c)=>{
      const body = await readJson(event);
      const { date, headline, targets } = body || {};
      if (!date) return badRequest("date required");
      const r = await c.query(`
        INSERT INTO daily_plans_branches(date,headline,targets)
        VALUES($1::date,$2,$3::jsonb)
        RETURNING id
      `,[date, headline || "", JSON.stringify(targets || { boxes:0, donations:0 })]);
      return json(200, { id: r.rows[0].id });
    });
  }
  if (event.httpMethod === "PUT"){
    if (!id) return badRequest("Missing id");
    return withClient(async (c)=>{
      const body = await readJson(event);
      const { date, headline, targets } = body || {};
      await c.query(`
        UPDATE daily_plans_branches
        SET date=COALESCE($2::date,date),
            headline=COALESCE($3,headline),
            targets=COALESCE($4::jsonb,targets)
        WHERE id=$1
      `,[id, date || null, headline || null, targets ? JSON.stringify(targets) : null]);
      return json(200, { ok:true });
    });
  }
  if (event.httpMethod === "DELETE"){
    if (!id) return badRequest("Missing id");
    return withClient(async (c)=>{
      await c.query(`DELETE FROM daily_plans_branches WHERE id=$1`, [id]);
      return json(200, { ok:true });
    });
  }
  return methodNotAllowed();
}

function methodNotAllowed(){
  return json(405, { error:"Method Not Allowed" });
}
