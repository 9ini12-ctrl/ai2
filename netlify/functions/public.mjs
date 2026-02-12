import { withClient } from "./_db.mjs";
import { json, getQuery, getRiyadhDate } from "./_utils.mjs";
import { applyTemplate, buildVars } from "./_template.mjs";

export const handler = async (event) => {
  const q = getQuery(event);
  const date = getRiyadhDate(q.date);
  const path = (q.path || "").replace(/^\/+/,"");

  if (event.httpMethod !== "GET") return json(405, { error:"Method Not Allowed" });

  if (path.startsWith("message")){
    return withClient(async (c)=>{
      const msg = await getMessage(c, date);
      return json(200, { date, message: msg });
    });
  }

  if (path.startsWith("summary")){
    return withClient(async (c)=>{
      const total = await c.query(
        `SELECT COALESCE(SUM(amount),0) AS total
         FROM donations
         WHERE (donation_date AT TIME ZONE 'Asia/Riyadh')::date = $1::date`,
        [date]
      );
      const message = await getMessage(c, date);

      // ranking
      const branches = await c.query(`
        WITH bp AS (
          SELECT b.id, b.numfre, b.name,
                 COALESCE((p.targets->>'donations')::numeric,0) AS donations_target,
                 COALESCE((p.targets->>'boxes')::numeric,0) AS boxes_target
          FROM branches b
          LEFT JOIN daily_plans_branches p ON p.date = $1::date
        ),
        donations_agg AS (
          SELECT a.branch_id, COALESCE(SUM(d.amount),0) AS donations_actual
          FROM donations d
          JOIN ambassadors a ON lower(a.referral_code)=lower(d.referral_code)
          WHERE (d.donation_date AT TIME ZONE 'Asia/Riyadh')::date = $1::date
          GROUP BY a.branch_id
        ),
        boxes_agg AS (
          SELECT a.branch_id, COUNT(*)::int AS boxes_actual
          FROM boxes bx
          JOIN ambassadors a ON lower(a.referral_code)=lower(bx.referral_code)
          WHERE (bx.created_at AT TIME ZONE 'Asia/Riyadh')::date = $1::date
          GROUP BY a.branch_id
        )
        SELECT bp.numfre, bp.name,
               COALESCE(don.donations_actual,0) AS donations_actual,
               COALESCE(box.boxes_actual,0) AS boxes_actual,
               bp.donations_target, bp.boxes_target,
               (
                 CASE WHEN bp.donations_target>0 THEN (COALESCE(don.donations_actual,0)/bp.donations_target) ELSE 0 END
                 +
                 CASE WHEN bp.boxes_target>0 THEN (COALESCE(box.boxes_actual,0)::numeric/bp.boxes_target) ELSE 0 END
               ) AS score
        FROM bp
        LEFT JOIN donations_agg don ON don.branch_id = bp.id
        LEFT JOIN boxes_agg box ON box.branch_id = bp.id
        ORDER BY score DESC, donations_actual DESC
        LIMIT 20
      `,[date]);

      return json(200, {
        date,
        total_donations_today: total.rows[0]?.total ?? 0,
        branches: branches.rows,
        message
      });
    });
  }

  return json(404, { error:"Unknown public endpoint" });
};

async function getMessage(c, date){
  const r = await c.query(`SELECT id, share_title, image_url, text_template FROM messages WHERE date=$1::date`, [date]);
  if (!r.rowCount) return null;
  const msg = r.rows[0];
  // public message has no vars
  return {
    id: msg.id,
    share_title: msg.share_title,
    image_url: msg.image_url,
    text: applyTemplate(msg.text_template, {}, { unknown:"" })
  };
}
