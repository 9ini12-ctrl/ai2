import { withClient } from "./_db.mjs";
import { json, badRequest, notFound, methodNotAllowed, getQuery, getRiyadhDate } from "./_utils.mjs";

export const handler = async (event) => {
  const q = getQuery(event);
  const date = getRiyadhDate(q.date);
  const splat = getSplat(event, q, "branch");
  const parts = splat.split("/").filter(Boolean);
  if (!parts[0]) return badRequest("Missing numfre");
  if (event.httpMethod !== "GET") return methodNotAllowed();

  const numfre = decodeURIComponent(parts[0]);

  return withClient(async (c)=>{
    const branch = await getBranch(c, numfre);
    if (!branch) return notFound("Branch not found");

    const planR = await c.query(`SELECT id, date, headline, targets FROM daily_plans_branches WHERE date=$1::date`, [date]);
    const plan = planR.rowCount ? planR.rows[0] : null;

    const progress = await getBranchProgress(c, branch.id, date, plan);

    const tasks = plan ? await getPlanTasksWithStatus(c, plan.id, "branch", { branch, date, progress }) : [];

    const ambassadors = await getBranchAmbassadorsProgress(c, branch.id, date);

    return json(200, {
      date,
      branch: { id: branch.id, numfre: branch.numfre, name: branch.name, vars: branch.vars || {} },
      plan: plan ? { id: plan.id, date: plan.date, headline: plan.headline, targets: plan.targets } : null,
      tasks,
      progress,
      ambassadors
    });
  });
};

function getSplat(event, q, fnName){
  const qp = String(q.path || "").replace(/^\/+/, "");
  if (qp && qp !== ":splat") return qp;
  let pathname = "";
  try { pathname = new URL(event.rawUrl).pathname || ""; } catch { pathname = event.path || ""; }
  pathname = String(pathname || "");
  pathname = pathname.replace(new RegExp(`^/\\.netlify/functions/${fnName}/?`), "");
  pathname = pathname.replace(new RegExp(`^/api/${fnName}/?`), "");
  return pathname.replace(/^\/+/, "");
}


async function getBranch(c, numfre){
  const r = await c.query(`SELECT id, numfre, name, vars FROM branches WHERE numfre=$1`, [numfre]);
  return r.rowCount ? r.rows[0] : null;
}

async function getBranchProgress(c, branchId, date, plan){
  const boxesTarget = Number(plan?.targets?.boxes ?? plan?.targets?.["boxes"] ?? 0) || 0;
  const donationsTarget = Number(plan?.targets?.donations ?? plan?.targets?.["donations"] ?? 0) || 0;

  const boxes = await c.query(`
    SELECT COUNT(*)::int AS c
    FROM boxes bx
    JOIN ambassadors a ON lower(a.referral_code)=lower(bx.referral_code)
    WHERE a.branch_id=$1
      AND (bx.created_at AT TIME ZONE 'Asia/Riyadh')::date = $2::date
  `,[branchId, date]);

  const dons = await c.query(`
    SELECT COALESCE(SUM(d.amount),0) AS s
    FROM donations d
    JOIN ambassadors a ON lower(a.referral_code)=lower(d.referral_code)
    WHERE a.branch_id=$1
      AND (d.donation_date AT TIME ZONE 'Asia/Riyadh')::date = $2::date
  `,[branchId, date]);

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
  const r = await c.query(`
    SELECT is_done
    FROM task_completions
    WHERE task_id=$1 AND date=$2::date AND branch_id=$3
    LIMIT 1
  `,[task.id, ctx.date, ctx.branch.id]);
  return r.rowCount ? !!r.rows[0].is_done : false;
}

async function getBranchAmbassadorsProgress(c, branchId, date){
  // targets from ambassadors plan
  const plan = await c.query(`SELECT targets FROM daily_plans_ambassadors WHERE date=$1::date`, [date]);
  const targets = plan.rowCount ? plan.rows[0].targets : { boxes:0, donations:0 };
  const boxesTarget = Number(targets?.boxes ?? targets?.["boxes"] ?? 0) || 0;
  const donationsTarget = Number(targets?.donations ?? targets?.["donations"] ?? 0) || 0;

  const r = await c.query(`
    SELECT a.id, a.numsafer, COALESCE(a.name,'فاعل خير') AS name, a.referral_code
    FROM ambassadors a
    WHERE a.branch_id=$1
    ORDER BY a.id ASC
  `,[branchId]);

  if (!r.rowCount) return [];

  const out = [];
  for (const a of r.rows){
    const boxes = await c.query(
      `SELECT COUNT(*)::int AS c FROM boxes WHERE lower(referral_code)=lower($1) AND (created_at AT TIME ZONE 'Asia/Riyadh')::date=$2::date`,
      [a.referral_code, date]
    );
    const dons = await c.query(
      `SELECT COALESCE(SUM(amount),0) AS s FROM donations WHERE lower(referral_code)=lower($1) AND (donation_date AT TIME ZONE 'Asia/Riyadh')::date=$2::date`,
      [a.referral_code, date]
    );
    const boxes_actual = Number(boxes.rows[0]?.c || 0);
    const donations_actual = Number(dons.rows[0]?.s || 0);
    const score =
      (donationsTarget>0 ? (donations_actual/donationsTarget) : 0) +
      (boxesTarget>0 ? (boxes_actual/boxesTarget) : 0);

    out.push({
      numsafer: a.numsafer,
      name: a.name,
      boxes_actual,
      donations_actual,
      boxes_target: boxesTarget,
      donations_target: donationsTarget,
      score
    });
  }
  out.sort((x,y)=> (y.score - x.score) || (y.donations_actual - x.donations_actual));
  return out;
}
