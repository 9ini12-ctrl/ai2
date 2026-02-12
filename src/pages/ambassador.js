import { h } from "../ui/dom.js";
import { Card, Row, Badge, LoadingCard, ErrorCard, EmptyCard } from "../ui/components.js";
import { apiGet, apiFetch } from "../ui/api.js";
import { shareMessage } from "../ui/share.js";
import { toast } from "../ui/toast.js";

export function AmbassadorPage({ numsafer }){
  const root = h("div", { class:"grid" }, LoadingCard("تحميل صفحة السفير..."));

  async function load(){
    root.innerHTML = "";
    root.appendChild(LoadingCard("تحميل صفحة السفير..."));
    try{
      const date = new Date().toLocaleDateString("en-CA", { timeZone:"Asia/Riyadh" });
      const data = await apiGet(`/api/ambassador/${encodeURIComponent(numsafer)}`, { date });

      root.innerHTML = "";
      // Card 1: info
      root.appendChild(Card("بيانات السفير", "",
        Row("الاسم", "", Badge(data.ambassador.name || "فاعل خير")),
        Row("رقم الجوال", "", Badge(data.ambassador.phone || "—")),
        Row("كود الإحالة", "", Badge(data.ambassador.referral_code || "—")),
        h("div", { class:"btns", style:"margin-top:10px" },
          h("button", { class:"btn", onclick: load }, "تحديث الصفحة")
        )
      ));

      // Card 2: plan + tasks
      const plan = data.plan;
      if (!plan){
        root.appendChild(EmptyCard("خطة اليوم", "لم يتم إعداد خطة للسفراء لهذا التاريخ."));
      } else {
        root.appendChild(Card("خطة اليوم", plan.headline || "",
          ...((data.tasks||[]).length ? (data.tasks||[]).map(t => TaskRow(t, data, async ()=>{
            await load(); // after toggle
          })) : [h("div", { class:"sub" }, "لا توجد مهام ضمن الخطة لهذا اليوم.")])
        ));
      }

      // Card 3: targets/progress + coupon
      root.appendChild(Card("مستهدف اليوم", "",
        Row("الصناديق المفعلة", `${data.progress.boxes_target} مستهدف`, Badge(`${data.progress.boxes_actual}/${data.progress.boxes_target}`, data.progress.boxes_actual>=data.progress.boxes_target ? "good":"")),
        Row("هدف التبرعات", `${formatSAR(data.progress.donations_target)} مستهدف`, Badge(`${formatSAR(data.progress.donations_actual)}/${formatSAR(data.progress.donations_target)}`, data.progress.donations_actual>=data.progress.donations_target ? "good":"")),
        h("hr", { class:"sep" }),
        CouponBlock(data.coupon)
      ));

      // Card 4: message
      if (!data.message){
        root.appendChild(EmptyCard("رسالة اليوم", "لم يتم إعداد رسالة لهذا اليوم."));
      } else {
        root.appendChild(Card("رسالة اليوم", "مهيأة للنسخ/المشاركة مع استبدال المتغيرات.",
          data.message.image_url ? h("img", { src: data.message.image_url, style:"width:100%; border-radius: 18px; border:1px solid rgba(255,255,255,.10); margin: 6px 0 10px" }) : null,
          h("div", { class:"sub", style:"white-space:pre-wrap" }, data.message.text || ""),
          h("div", { class:"btns" },
            h("button", { class:"btn primary", onclick: ()=> shareMessage({ title: data.message.share_title || "رسالة اليوم", text: data.message.text || "", imageUrl: data.message.image_url || "" }) }, "مشاركة"),
            h("button", { class:"btn", onclick: async ()=> {
              await navigator.clipboard.writeText(data.message.text || "");
              toast("تم نسخ النص", "جاهز للمشاركة");
            } }, "نسخ النص")
          )
        ));
      }

    }catch(err){
      root.innerHTML = "";
      root.appendChild(ErrorCard(err.message, load));
    }
  }

  load();
  return root;
}

function TaskRow(t, data, onChanged){
  const right = (t.task_mode === "manual_ambassador")
    ? h("button", { class:`btn small ${t.is_done ? "primary":""}`, onclick: async ()=>{
        await apiFetch(`/api/ambassador/${encodeURIComponent(data.ambassador.numsafer)}/task/${t.id}/toggle`, { method:"POST", body: JSON.stringify({ date: data.date }) });
        onChanged && onChanged();
      }}, t.is_done ? "✅ أنجز" : "⬜ لم ينجز")
    : Badge(t.is_done ? "أنجز" : "لم ينجز", t.is_done ? "good" : (t.task_mode==="manual_admin" ? "warn" : ""));

  const meta = t.task_mode === "auto"
    ? (t.metric && t.threshold != null ? `تلقائي: ${t.metric} ≥ ${t.threshold}` : "تلقائي")
    : (t.task_mode === "manual_admin" ? "يدوي (تحدده الإدارة)" : "يدوي (السفير)");

  return Row(t.title, meta, right);
}

function CouponBlock(c){
  if (!c) return h("div", { class:"sub" }, "الكوبون: غير متاح (تأكد من إعداد الكوبونات وتفعيلها).");
  if (c.status === "locked"){
    return Row("الكوبون", "يفتح بعد تحقيق المستهدفات", Badge("مغلق", "bad"));
  }
  return h("div", {},
    Row("الكوبون", c.title ? `هدية: ${c.title}` : "مبروك! تم فتح كوبونك.", Badge("مفتوح", "good")),
    Row("الكود", "", Badge(c.code || "—")),
    h("div", { class:"btns", style:"margin-top:10px" },
      h("button", { class:"btn primary", onclick: async ()=>{
        await navigator.clipboard.writeText(c.code || "");
        toast("تم نسخ الكوبون", "تم حفظه في محفظتك.");
        try{
          await apiFetch(`/api/ambassador/${encodeURIComponent(c.numsafer)}/coupon/copied`, { method:"POST", body: JSON.stringify({ date: c.date }) });
        }catch(_){}
      } }, "نسخ الكوبون")
    )
  );
}

function formatSAR(n){
  const v = Number(n || 0);
  return v.toLocaleString("ar-SA", { style:"currency", currency:"SAR", maximumFractionDigits:0 });
}
