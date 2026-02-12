import { h } from "../ui/dom.js";
import { Card, Kpi, Row, Badge, LoadingCard, ErrorCard, EmptyCard } from "../ui/components.js";
import { apiGet } from "../ui/api.js";
import { shareMessage } from "../ui/share.js";

export function HomePage(){
  const root = h("div", { class:"grid cols2" },
    LoadingCard("تحميل ملخص اليوم..."),
    LoadingCard("تحميل ترتيب الفروع..."),
    LoadingCard("تحميل رسالة اليوم...")
  );

  async function load(){
    root.innerHTML = "";
    root.appendChild(LoadingCard("تحميل ملخص اليوم..."));
    root.appendChild(LoadingCard("تحميل ترتيب الفروع..."));
    root.appendChild(LoadingCard("تحميل رسالة اليوم..."));
    try{
      const date = new Date().toLocaleDateString("en-CA", { timeZone:"Asia/Riyadh" });
      const data = await apiGet("/api/public/summary", { date });
      root.innerHTML = "";

      // Summary card
      root.appendChild(Card("إجمالي المحفظة الاستثمارية", "حسب سجلات التبرعات (اليوم).",
        Kpi(formatSAR(data.total_donations_today), "إجمالي تبرعات اليوم"),
        h("div", { class:"sub", style:"margin-top:10px" }, `التاريخ: ${data.date}`)
      ));

      // Branch ranking
      const list = (data.branches || []);
      if (!list.length){
        root.appendChild(EmptyCard("ترتيب الفروع", "لا يوجد بيانات كافية لهذا اليوم."));
      } else {
        root.appendChild(Card("ترتيب الفروع الأعلى تفاعلاً", "الترتيب يعتمد على (تبرعات/المستهدف) + (صناديق/المستهدف).",
          h("table", { class:"table" },
            h("thead", {},
              h("tr", {},
                h("th", {}, "#"),
                h("th", {}, "الفرع"),
                h("th", {}, "تبرعات"),
                h("th", {}, "صناديق"),
                h("th", {}, "النسبة"),
              )
            ),
            h("tbody", {},
              ...list.map((b, idx)=> h("tr", {},
                h("td", {}, String(idx+1)),
                h("td", {},
                  h("a", { href:`/fre/${encodeURIComponent(b.numfre)}`, "data-nav":"" }, b.name || b.numfre)
                ),
                h("td", {}, formatSAR(b.donations_actual)),
                h("td", {}, String(b.boxes_actual)),
                h("td", {}, `${Math.round((b.score||0)*100)}%`)
              ))
            )
          )
        ));
      }

      // Message
      const msg = data.message;
      if (!msg){
        root.appendChild(EmptyCard("رسالة اليوم", "لم يتم إعداد رسالة لهذا اليوم عبر الإدارة."));
      } else {
        root.appendChild(Card("رسالة اليوم", "شارك الرسالة مباشرة (صورة + نص) حسب دعم جهازك.",
          msg.image_url ? h("img", { src: msg.image_url, style:"width:100%; border-radius: 18px; border:1px solid rgba(255,255,255,.10); margin: 6px 0 10px" }) : null,
          h("div", { class:"sub", style:"white-space:pre-wrap" }, msg.text || ""),
          h("div", { class:"btns" },
            h("button", { class:"btn primary", onclick: ()=> shareMessage({ title: msg.share_title || "رسالة اليوم", text: msg.text || "", imageUrl: msg.image_url || "" }) }, "مشاركة"),
            h("a", { class:"btn", href:"/cpadmin", "data-nav":"" }, "تعديل من الإدارة")
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
