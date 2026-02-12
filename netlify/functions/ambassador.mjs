import { withClient } from "./_db.mjs";
import { json, badRequest, notFound, methodNotAllowed, getQuery, getRiyadhDate, readJson } from "./_utils.mjs";
import { applyTemplate, buildVars } from "./_template.mjs";

export const handler = async (event) => {
  const q = getQuery(event);
  const date = getRiyadhDate(q.date);
  const splat = (q.path || "").replace(/^\/+/,""); // e.g. "83923"
  const parts = splat.split("/").filter(Boolean);

  if (!parts[0]) return badRequest("Missing numsafer");

  // Toggle manual_ambassador task
  if (parts.length >= 4 && parts[1] === "task" && parts[3] === "toggle"){
    if (event.httpMethod !== "POST") return methodNotAllowed();
    const numsafer = decodeURIComponent(parts[0]);
    const taskId = parts[2];
    const body = await readJson(event);
    const d = body.date || date;
    return withClient(async (c)=>{
      const amb = await getAmbassador(c, numsafer);
      if (!amb) return notFound("Ambassador not found");

      const task = await c.query(`SELECT id, task_mode, plan_type FROM plan_tasks WHERE id=$1`, [taskId]);
      if (!task.rowCount) return notFound("Task not found");
      if (task.rows[0].task_mode !== "manual_ambassador") return json(403, { error:"Task is not toggleable by ambassador" });

      const now = new Date().toISOString();
      await c.query(`
        INSERT INTO task_completions(task_id,date,ambassador_id,is_done,done_at,done_by)
        VALUES($1,$2::date,$3,true,$4::timestamptz,'ambassador')
        ON CONFLICT (task_id, date, ambassador_id)
        DO UPDATE SET is_done = NOT task_completions.is_done,
                      done_at = CASE WHEN task_completions.is_done THEN NULL ELSE $4::timestamptz END,
                      done_by = 'ambassador'
      `,[taskId, d, amb.id, now]);

      return json(200, { ok:true });
    });
  }

  // Mark coupon as copied
  if (parts.length >= 2 && parts[1] === "coupon" && parts[2] === "copied"){
    if (event.httpMethod !== "POST") return methodNotAllowed();
    const numsafer = decodeURIComponent(parts[0]);
    const body = await readJson(event);
    const d = body.date || date;
    return withClient(async (c)=>{
      const amb = await getAmbassador(c, numsafer);
      if (!amb) return notFound("Ambassador not found");
      await c.query(`
        UPDATE coupon_wallet
        SET copied_at = NOW(), status='copied'
        WHERE ambassador_id=$1 AND date_unlocked=$2::date
      `,[amb.id, d]);
      return json(200, { ok:true });
    });
  }

  // Get ambassador data
  if (event.httpMethod !== "GET") return methodNotAllowed();
  const numsafer = decodeURIComponent(parts[0]);

  return withClient(async (c)=>{
    const amb = await getAmbassador(c, numsafer);
    if (!amb) return notFound("Ambassador not found");

    const branch = amb.branch_id ? await getBranchById(c, amb.branch_id) : null;

    const planR = await c.query(`SELECT id, date, headline, targets FROM daily_plans_ambassadors WHERE date=$1::date`, [date]);
    const plan = planR.rowCount ? planR.rows[0] : null;

    const progress = await getAmbassadorProgress(c, amb, date, plan);

    const tasks = plan ? await getPlanTasksWithStatus(c, plan.id, "ambassador", { ambassador: amb, branch, date, progress }) : [];

    const coupon = await ensureCoupon(c, amb, date, progress);

    const message = await getMessageForAmbassador(c, date, amb, branch);

    return json(200, {
      date,
      ambassador: {
        id: amb.id,
        numsafer: amb.numsafer,
        name: amb.name || "فاعل خير",
        phone: amb.phone,
        referral_code: amb.referral_code,
        branch_id: amb.branch_id,
        vars: amb.vars || {}
      },
      branch: branch ? { id: branch.id, numfre: branch.numfre, name: branch.name, vars: branch.vars || {} } : null,
      plan: plan ? { id: plan.id, date: plan.date, headline: plan.headline, targets: plan.targets } : null,
      tasks,
      progress,
      coupon,
      message
    });
  });
};

async function getAmbassador(c, numsafer){
  const r = await c.query(`SELECT id, numsafer, name, phone, referral_code, branch_id, vars FROM ambassadors WHERE numsafer=$1`, [numsafer]);
  return r.rowCount ? r.rows[0] : null;
}

async function getBranchById(c, id){
  const r = await c.query(`SELECT id, numfre, name, vars FROM branches WHERE id=$1`, [id]);
  return r.rowCount ? r.rows[0] : null;
}

async function getAmbassadorProgress(c, amb, date, plan){
  const boxesTarget = Number(plan?.targets?.boxes ?? plan?.targets?.["boxes"] ?? (plan?.targets?.["boxes"] ?? 0) ) || Number(plan?.targets?.["boxes"] ?? 0) || Number(plan?.targets?.["boxes"] ?? 0) || 0;
  const donationsTarget = Number(plan?.targets?.donations ?? plan?.targets?.["donations"] ?? 0) || 0;

  const boxes = await c.query(
    `SELECT COUNT(*)::int AS c
     FROM boxes
     WHERE lower(referral_code)=lower($1)
       AND (created_at AT TIME ZONE 'Asia/Riyadh')::date = $2::date`,
    [amb.referral_code, date]
  );
  const dons = await c.query(
    `SELECT COALESCE(SUM(amount),0) AS s
     FROM donations
     WHERE lower(referral_code)=lower($1)
       AND (donation_date AT TIME ZONE 'Asia/Riyadh')::date = $2::date`,
    [amb.referral_code, date]
  );
  return {
    boxes_target: Number(boxesTarget || 0),
    donations_target: Number(donationsTarget || 0),
    boxes_actual: Number(boxes.rows[0]?.c || 0),
    donations_actual: Number(dons.rows[0]?.s || 0)
  };
}

async function getPlanTasksWithStatus(c, planId, planType, ctx){
  const r = await c.query(`SELECT id, title, task_mode, metric, threshold, rule FROM plan_tasks WHERE plan_type=$1 AND plan_id=$2 ORDER BY id ASC`, [planType, planId]);
  const tasks = [];
  for (const t of r.rows){
    const done = await computeTaskDone(c, t, ctx);
    tasks.push({ ...t, is_done: done });
  }
  return tasks;
}

async function computeTaskDone(c, task, ctx){
  if (task.task_mode === "auto"){
    if (task.metric === "boxes"){
      return Number(ctx.progress.boxes_actual) >= Number(task.threshold || 0);
    }
    if (task.metric === "donations"){
      return Number(ctx.progress.donations_actual) >= Number(task.threshold || 0);
    }
    return false;
  }
  // manual modes
  const r = await c.query(`
    SELECT is_done
    FROM task_completions
    WHERE task_id=$1 AND date=$2::date AND ambassador_id=$3
    LIMIT 1
  `,[task.id, ctx.date, ctx.ambassador.id]);
  return r.rowCount ? !!r.rows[0].is_done : false;
}

async function ensureCoupon(c, amb, date, progress){
  const existing = await c.query(`
    SELECT cw.date_unlocked, cw.status, cw.copied_at, cp.code, cp.title
    FROM coupon_wallet cw
    JOIN coupons cp ON cp.id = cw.coupon_id
    WHERE cw.ambassador_id=$1 AND cw.date_unlocked=$2::date
    LIMIT 1
  `,[amb.id, date]);
  if (existing.rowCount){
    const x = existing.rows[0];
    return { status: x.status === "copied" ? "copied" : "unlocked", code: x.code, title: x.title, date, numsafer: amb.numsafer };
  }

  // locked until both targets met (if targets are 0 -> treat as met)
  const meetsBoxes = progress.boxes_target <= 0 ? true : (progress.boxes_actual >= progress.boxes_target);
  const meetsDon = progress.donations_target <= 0 ? true : (progress.donations_actual >= progress.donations_target);
  if (!(meetsBoxes && meetsDon)) return { status:"locked", date, numsafer: amb.numsafer };

  // allocate an active unused coupon (safe under concurrency)
  // Uses row-level locking with SKIP LOCKED so concurrent unlocks don't fight for the same coupon
  const ins = await c.query(`
    WITH candidate AS (
      SELECT c.id
      FROM coupons c
      WHERE c.is_active = true
        AND NOT EXISTS (SELECT 1 FROM coupon_wallet cw WHERE cw.coupon_id = c.id)
      ORDER BY c.id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    INSERT INTO coupon_wallet(ambassador_id, coupon_id, date_unlocked, status)
    SELECT $1, candidate.id, $2::date, 'unlocked'
    FROM candidate
    RETURNING coupon_id
  `,[amb.id, date]);

  if (!ins.rowCount) return { status:"locked", date, numsafer: amb.numsafer };

  const cp = await c.query(`SELECT code, title FROM coupons WHERE id=$1`, [ins.rows[0].coupon_id]);
  return { status:"unlocked", code: cp.rows[0]?.code || "", title: cp.rows[0]?.title || null, date, numsafer: amb.numsafer };
}

async function getMessageForAmbassador(c, date, amb, branch){
  const r = await c.query(`SELECT id, share_title, image_url, text_template FROM messages WHERE date=$1::date`, [date]);
  if (!r.rowCount) return null;
  const msg = r.rows[0];
  const vars = buildVars({ ambassador: amb, branch });
  const text = applyTemplate(msg.text_template, vars, { unknown:"" });
  return { id: msg.id, share_title: msg.share_title, image_url: msg.image_url, text };
}
