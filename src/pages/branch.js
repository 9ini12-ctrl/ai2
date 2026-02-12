import { h } from "../ui/dom.js";
import { Card, Row, Badge, LoadingCard, ErrorCard, EmptyCard } from "../ui/components.js";
import { apiGet } from "../ui/api.js";

export function BranchPage({ numfre }){
  const root = h("div", { class:"grid" }, LoadingCard("تحميل صفحة الفرع..."));

  async function load(){
    root.innerHTML = "";
    root.appendChild(LoadingCard("تحميل صفحة الفرع..."));
    try{
      const date = new Date().toLocaleDateString("en-CA", { timeZone:"Asia/Riyadh" });
      const data = await apiGet(`/api/branch/${encodeURIComponent(numfre)}`, { date });
      root.innerHTML = "";

      root.appendChild(Card("بيانات الفرع", "",
        Row("اسم الفرع", "", Badge(data.branch.name || data.branch.numfre)),
        h("div", { class:"btns", style:"margin-top:10px" },
          h("button", { class:"btn", onclick: load }, "تحديث الصفحة")
        )
      ));

      if (!data.plan){
        root.appendChild(EmptyCard("خطة اليوم للفرع", "لم يتم إعداد خطة للفروع لهذا التاريخ."));
      } else {
        root.appendChild(Card("خطة اليوم للفرع", data.plan.headline || "",
          ...((data.tasks||[]).length ? (data.tasks||[]).map(t => Row(
            t.title,
            t.task_mode === "auto" ? (t.metric && t.threshold != null ? `تلقائي: ${t.metric} ≥ ${t.threshold}` : "تلقائي") : (t.task_mode==="manual_admin" ? "يدوي (الإدارة)" : "يدوي"),
            Badge(t.is_done ? "أنجز" : "لم ينجز", t.is_done ? "good" : (t.task_mode==="manual_admin" ? "warn": ""))
          )) : [h("div", { class:"sub" }, "لا توجد مهام ضمن الخطة لهذا اليوم.")])
        ));
      }

      root.appendChild(Card("مستهدف اليوم", "",
        Row("الصناديق المفعلة", `${data.progress.boxes_target} مستهدف`, Badge(`${data.progress.boxes_actual}/${data.progress.boxes_target}`, data.progress.boxes_actual>=data.progress.boxes_target ? "good":"")),
        Row("هدف التبرعات", `${formatSAR(data.progress.donations_target)} مستهدف`, Badge(`${formatSAR(data.progress.donations_actual)}/${formatSAR(data.progress.donations_target)}`, data.progress.donations_actual>=data.progress.donations_target ? "good":""))
      ));

      const list = data.ambassadors || [];
      if (!list.length){
        root.appendChild(EmptyCard("مؤشرات السفراء", "لا يوجد سفراء مرتبطين بهذا الفرع."));
      } else {
        root.appendChild(Card("مؤشرات السفراء داخل الفرع", "تقرير اليوم لكل سفير.",
          h("table", { class:"table" },
            h("thead", {}, h("tr", {},
              h("th", {}, "#"),
              h("th", {}, "السفير"),
              h("th", {}, "تبرعات"),
              h("th", {}, "صناديق"),
              h("th", {}, "النسبة")
            )),
            h("tbody", {},
              ...list.map((a, i) => h("tr", {},
                h("td", {}, String(i+1)),
                h("td", {}, h("a", { href:`/safer/${encodeURIComponent(a.numsafer)}`, "data-nav":"" }, a.name || "فاعل خير")),
                h("td", {}, formatSAR(a.donations_actual)),
                h("td", {}, String(a.boxes_actual)),
                h("td", {}, `${Math.round((a.score||0)*100)}%`)
              ))
            )
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

function formatSAR(n){
  const v = Number(n || 0);
  return v.toLocaleString("ar-SA", { style:"currency", currency:"SAR", maximumFractionDigits:0 });
}
