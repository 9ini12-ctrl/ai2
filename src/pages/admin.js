import { h } from "../ui/dom.js";
import { Card, Row, Badge } from "../ui/components.js";
import { apiFetch, apiGet, session } from "../ui/api.js";
import { toast } from "../ui/toast.js";
import { parseCsvPreview, normalizeCsvHeaders } from "../ui/csv.js";

export function AdminPage(){
  const root = h("div", { class:"grid" });

  function renderLogin(){
    root.innerHTML = "";
    const key = h("input", { placeholder:"ADMIN_SEED_KEY (اختياري)" });
    const user = h("input", { placeholder:"اسم المستخدم", value:"admin" });
    const pass = h("input", { placeholder:"كلمة المرور", type:"password" });

    root.appendChild(Card("تسجيل دخول الإدارة", "الدخول عبر (مفتاح) أو (اسم مستخدم + كلمة مرور).",
      h("label", {}, "مفتاح الإدارة (إن كنت تستخدم ADMIN_SEED_KEY)"),
      key,
      h("hr", { class:"sep" }),
      h("label", {}, "اسم المستخدم"),
      user,
      h("label", {}, "كلمة المرور"),
      pass,
      h("div", { class:"btns", style:"margin-top:10px" },
        h("button", { class:"btn primary", onclick: async ()=>{
          const body = { seed_key: key.value.trim(), username: user.value.trim(), password: pass.value };
          const data = await apiFetch("/api/admin/login", { method:"POST", body: JSON.stringify(body) });
          session.token = data.token;
          toast("تم الدخول", "أهلاً بك");
          renderPanel();
        } }, "دخول")
      )
    ));
  }

  function tabButton(label, isActive, onClick){
    return h("button", { class:`btn small ${isActive ? "primary":""}`, onclick:onClick }, label);
  }

  function renderPanel(){
    root.innerHTML = "";
    const tabs = ["السفراء","الفروع","الكوبونات","خطط السفراء","خطط الفروع","الرسائل","رفع CSV","إنجازات المهام"];
    let active = tabs[0];

    const tabBar = h("div", { class:"btns" },
      ...tabs.map(t => tabButton(t, t===active, ()=>{ active=t; paint(); }))
    );

    const content = h("div", { class:"grid" });

    const header = Card("لوحة الإدارة", "إدارة القوائم والخطط والرسائل ورفع السجلات.",
      Row("الجلسة", "", Badge(session.token ? "Active" : "—", session.token ? "good":"")),
      h("div", { class:"btns", style:"margin-top:10px" },
        tabBar,
        h("button", { class:"btn danger small", onclick: ()=>{ session.clear(); renderLogin(); } }, "تسجيل خروج")
      )
    );

    function paint(){
      // update buttons states
      tabBar.innerHTML = "";
      tabs.forEach(t => tabBar.appendChild(tabButton(t, t===active, ()=>{ active=t; paint(); })));
      content.innerHTML = "";
      if (active==="السفراء") content.appendChild(AmbassadorsSection());
      if (active==="الفروع") content.appendChild(BranchesSection());
      if (active==="الكوبونات") content.appendChild(CouponsSection());
      if (active==="خطط السفراء") content.appendChild(PlansSection("ambassadors"));
      if (active==="خطط الفروع") content.appendChild(PlansSection("branches"));
      if (active==="الرسائل") content.appendChild(MessagesSection());
      if (active==="رفع CSV") content.appendChild(UploadsSection());
      if (active==="إنجازات المهام") content.appendChild(TaskCompletionsSection());
    }

    root.appendChild(header);
    root.appendChild(content);
    paint();
  }

  // --- Sections ---
  function ListSection({ title, subtitle, resource, fields }){
    const wrap = Card(title, subtitle);
    const table = h("div", { class:"card", style:"padding:12px" });
    const form = h("div", { class:"card", style:"padding:12px" });

    const itemsEl = h("div", { class:"sub" }, "جارٍ التحميل...");
    table.appendChild(itemsEl);

    const inputs = {};
    fields.forEach(f => {
      form.appendChild(h("label", {}, f.label));
      inputs[f.key] = (f.type==="textarea")
        ? h("textarea", { placeholder: f.placeholder || "" })
        : h("input", { placeholder: f.placeholder || "", type: f.type || "text" });
      form.appendChild(inputs[f.key]);
    });

    const idEl = h("input", { type:"hidden" });
    form.appendChild(idEl);

    const btns = h("div", { class:"btns", style:"margin-top:10px" },
      h("button", { class:"btn primary", onclick: async ()=>{
        const payload = {};
        fields.forEach(f => payload[f.key] = inputs[f.key].value);
        // allow JSON fields
        for (const k of Object.keys(payload)){
          if (k.endsWith("_json")){
            try{ payload[k.replace(/_json$/,"")] = payload[k] ? JSON.parse(payload[k]) : {}; }
            catch(e){ toast("JSON غير صالح", `الحقل: ${k}`); return; }
            delete payload[k];
          }
        }
        if (idEl.value){
          await apiFetch(`/api/admin/${resource}/${idEl.value}`, { method:"PUT", body: JSON.stringify(payload) });
          toast("تم التحديث","");
        } else {
          await apiFetch(`/api/admin/${resource}`, { method:"POST", body: JSON.stringify(payload) });
          toast("تمت الإضافة","");
        }
        idEl.value = "";
        fields.forEach(f => inputs[f.key].value = "");
        await load();
      }}, idEl.value ? "تحديث" : "إضافة"),
      h("button", { class:"btn", onclick: ()=>{ idEl.value=""; fields.forEach(f=> inputs[f.key].value=""); } }, "تفريغ")
    );
    form.appendChild(btns);

    async function load(){
      itemsEl.textContent = "جارٍ التحميل...";
      const list = await apiGet(`/api/admin/${resource}`, {});
      itemsEl.innerHTML = "";
      if (!list?.items?.length){
        itemsEl.appendChild(h("div", { class:"sub" }, "لا توجد عناصر."));
        return;
      }
      itemsEl.appendChild(h("table", { class:"table" },
        h("thead", {}, h("tr", {},
          h("th", {}, "#"),
          ...fields.map(f => h("th", {}, f.label)),
          h("th", {}, "إجراءات")
        )),
        h("tbody", {},
          ...list.items.map((it, idx)=> h("tr", {},
            h("td", {}, String(idx+1)),
            ...fields.map(f => h("td", {}, formatCell(it[f.mapFrom || f.key]))),
            h("td", {},
              h("div", { class:"btns" },
                h("button", { class:"btn small", onclick: ()=> {
                  idEl.value = it.id;
                  fields.forEach(f => {
                    if ((f.key||"").endsWith("_json")){
                      const src = f.mapFrom || f.key.replace(/_json$/,"");
                      inputs[f.key].value = JSON.stringify(it[src] || {}, null, 2);
                    } else {
                      inputs[f.key].value = it[f.mapFrom || f.key] ?? "";
                    }
                  });
                  toast("تم تحميل العنصر", "عدّل ثم اضغط تحديث");
                } }, "تعديل"),
                h("button", { class:"btn danger small", onclick: async ()=>{
                  if (!confirm("حذف هذا العنصر؟")) return;
                  await apiFetch(`/api/admin/${resource}/${it.id}`, { method:"DELETE" });
                  toast("تم الحذف","");
                  await load();
                } }, "حذف")
              )
            )
          ))
        )
      ));
    }

    load();
    wrap.appendChild(table);
    wrap.appendChild(form);
    return wrap;
  }

  function AmbassadorsSection(){
    return ListSection({
      title:"إدارة قائمة السفراء",
      subtitle:"إضافة/تعديل/حذف السفراء (يدعم vars كـ JSON).",
      resource:"ambassadors",
      fields:[
        { key:"numsafer", label:"رقم السفير (numsafer)", placeholder:"83923" },
        { key:"name", label:"اسم السفير (اختياري)", placeholder:"زيد" },
        { key:"phone", label:"رقم الجوال", placeholder:"05xxxxxxxx" },
        { key:"referral_code", label:"كود الإحالة", placeholder:"ABC123" },
        { key:"branch_numfre", label:"رقم الفرع (numfre)", placeholder:"0123" },
        { key:"vars_json", label:"vars (JSON)", type:"textarea", placeholder:'{"رابط-الفرع":"...","رابط-بوابة-الفرع":"..."}' }
      ]
    });
  }

  function BranchesSection(){
    return ListSection({
      title:"إدارة قائمة الفروع",
      subtitle:"إضافة/تعديل/حذف الفروع (يدعم vars كـ JSON).",
      resource:"branches",
      fields:[
        { key:"numfre", label:"رقم الفرع (numfre)", placeholder:"0123" },
        { key:"name", label:"اسم الفرع", placeholder:"مجمع ..." },
        { key:"vars_json", label:"vars (JSON)", type:"textarea", placeholder:'{"رابط-الفرع":"..."}' }
      ]
    });
  }

  function CouponsSection(){
    return ListSection({
      title:"إدارة قائمة الكوبونات",
      subtitle:"أضف كوبونات جاهزة. سيتم تخصيص كوبون واحد لكل سفير عند فتحه.",
      resource:"coupons",
      fields:[
        { key:"code", label:"الكود", placeholder:"RAMADAN-2026-001" },
        { key:"title", label:"العنوان (اختياري)", placeholder:"هدية" },
        { key:"is_active", label:"مفعل؟ (true/false)", placeholder:"true" },
        { key:"meta_json", label:"meta (JSON)", type:"textarea", placeholder:'{"value":"..."}' }
      ]
    });
  }

  function PlansSection(kind){
    const title = kind==="ambassadors" ? "قائمة خطط الأيام للسفراء" : "قائمة خطط الأيام للفروع";
    const resource = kind==="ambassadors" ? "plans/ambassadors" : "plans/branches";
    return ListSection({
      title,
      subtitle:"خطة اليوم + مستهدفات JSON. (مهم: date فريد لكل يوم).",
      resource,
      fields:[
        { key:"date", label:"التاريخ (YYYY-MM-DD)", placeholder:"2026-03-01" },
        { key:"headline", label:"نص خطة اليوم", type:"textarea", placeholder:"خطة اليوم..." },
        { key:"targets_json", label:"targets (JSON) مثال", type:"textarea", placeholder:'{"boxes":10,"donations":1000}' }
      ]
    });
  }

  function MessagesSection(){
    return ListSection({
      title:"قائمة الرسائل",
      subtitle:"رسالة اليوم (صورة + نص Template). المتغيرات بصيغة #اسم-العمود",
      resource:"messages",
      fields:[
        { key:"date", label:"التاريخ (YYYY-MM-DD)", placeholder:"2026-03-01" },
        { key:"share_title", label:"عنوان المشاركة (اختياري)", placeholder:"رسالة اليوم" },
        { key:"image_url", label:"رابط الصورة", placeholder:"https://..." },
        { key:"text_template", label:"نص الرسالة (Template)", type:"textarea", placeholder:"اكتب النص هنا... واستخدم #كود-الإحالة" }
      ]
    });
  }

  function UploadsSection(){
    const wrap = Card("رفع CSV", "رفع سجلات التبرعات والصناديق مع منع التكرار (Dedup).");
    const date = new Date().toLocaleDateString("en-CA", { timeZone:"Asia/Riyadh" });

    const fileDon = h("input", { type:"file", accept:".csv,text/csv" });
    const fileBox = h("input", { type:"file", accept:".csv,text/csv" });
    const preview = h("div", { class:"sub" }, "اختر ملفًا لمعاينة أول 20 صف.");

    async function readFile(file){
      return new Promise((resolve, reject)=>{
        const fr = new FileReader();
        fr.onload = ()=> resolve(String(fr.result || ""));
        fr.onerror = reject;
        fr.readAsText(file, "utf-8");
      });
    }

    async function previewCsv(file){
      const text = await readFile(file);
      const { headers, rows } = parseCsvPreview(text, 20);
      const norm = normalizeCsvHeaders(headers);
      return { text, headers:norm, rows };
    }

    function tableFrom(rows){
      if (!rows?.length) return h("div", { class:"sub" }, "لا توجد صفوف.");
      const cols = Object.keys(rows[0] || {});
      return h("table", { class:"table" },
        h("thead", {}, h("tr", {}, ...cols.map(c => h("th", {}, c)) )),
        h("tbody", {}, ...rows.map(r => h("tr", {}, ...cols.map(c => h("td", {}, String(r[c] ?? ""))) )))
      );
    }

    const btnUploadDon = h("button", { class:"btn primary", onclick: async ()=>{
      if (!fileDon.files?.[0]) return;
      const p = await previewCsv(fileDon.files[0]);
      preview.innerHTML = "";
      preview.appendChild(h("div", { class:"sub" }, "معاينة (تبرعات):"));
      preview.appendChild(tableFrom(p.rows));
      if (!confirm("اعتماد ورفع ملف التبرعات؟")) return;
      const res = await apiFetch("/api/admin/upload/donations", { method:"POST", body: JSON.stringify({ csv: p.text, date }) });
      showUploadReport(res);
    } }, "معاينة/رفع التبرعات");

    const btnUploadBox = h("button", { class:"btn primary", onclick: async ()=>{
      if (!fileBox.files?.[0]) return;
      const p = await previewCsv(fileBox.files[0]);
      preview.innerHTML = "";
      preview.appendChild(h("div", { class:"sub" }, "معاينة (صناديق):"));
      preview.appendChild(tableFrom(p.rows));
      if (!confirm("اعتماد ورفع ملف الصناديق؟")) return;
      const res = await apiFetch("/api/admin/upload/boxes", { method:"POST", body: JSON.stringify({ csv: p.text, date }) });
      showUploadReport(res);
    } }, "معاينة/رفع الصناديق");

    function showUploadReport(r){
      preview.innerHTML = "";
      preview.appendChild(h("div", { class:"sub" }, "تقرير الرفع:"));
      preview.appendChild(h("div", { class:"grid cols2" },
        Card("مقبول", "", h("div", { class:"kpi" }, h("div",{class:"big"}, String(r.accepted||0)), h("div",{class:"label"},"صف"))),
        Card("مكرر", "", h("div", { class:"kpi" }, h("div",{class:"big"}, String(r.duplicates||0)), h("div",{class:"label"},"صف"))),
      ));
      preview.appendChild(Card("مرفوض", "الأسباب (أول 10).",
        h("div", { class:"sub", style:"white-space:pre-wrap" }, (r.rejected_samples||[]).map(x=> `- ${x.reason}`).join("\n") || "لا يوجد")
      ));
    }

    wrap.appendChild(Card("رفع سجل التبرعات", "اختر ملف CSV ثم ارفع.", 
      h("label", {}, "ملف التبرعات CSV"),
      fileDon,
      h("div", { class:"btns", style:"margin-top:10px" }, btnUploadDon)
    ));
    wrap.appendChild(Card("رفع سجل الصناديق", "اختر ملف CSV ثم ارفع.",
      h("label", {}, "ملف الصناديق CSV"),
      fileBox,
      h("div", { class:"btns", style:"margin-top:10px" }, btnUploadBox)
    ));
    wrap.appendChild(Card("المعاينة والتقرير", "", preview));
    return wrap;
  }

  function TaskCompletionsSection(){
    const wrap = Card("إنجازات المهام (يدوي للإدارة)", "تحديد إنجاز مهام (manual_admin) لسفير أو فرع في تاريخ محدد.");
    const date = h("input", { placeholder:"YYYY-MM-DD", value: new Date().toLocaleDateString("en-CA", { timeZone:"Asia/Riyadh" }) });
    const scope = h("select", {}, 
      h("option", { value:"ambassador" }, "سفير"),
      h("option", { value:"branch" }, "فرع"),
    );
    const subject = h("input", { placeholder:"رقم السفير (numsafer) أو رقم الفرع (numfre)" });
    const taskId = h("input", { placeholder:"Task ID" });
    const isDone = h("select", {}, h("option", { value:"true" }, "أنجز"), h("option", { value:"false" }, "لم ينجز"));
    const btn = h("button", { class:"btn primary", onclick: async ()=>{
      const payload = { date: date.value.trim(), scope: scope.value, subject: subject.value.trim(), task_id: taskId.value.trim(), is_done: isDone.value==="true" };
      const r = await apiFetch("/api/admin/task-completions", { method:"POST", body: JSON.stringify(payload) });
      toast("تم الحفظ", r.message || "");
    }}, "حفظ");
    wrap.appendChild(h("label", {}, "التاريخ"));
    wrap.appendChild(date);
    wrap.appendChild(h("label", {}, "النوع"));
    wrap.appendChild(scope);
    wrap.appendChild(h("label", {}, "الرقم"));
    wrap.appendChild(subject);
    wrap.appendChild(h("label", {}, "معرف المهمة Task ID"));
    wrap.appendChild(taskId);
    wrap.appendChild(h("label", {}, "الحالة"));
    wrap.appendChild(isDone);
    wrap.appendChild(h("div", { class:"btns", style:"margin-top:10px" }, btn));
    wrap.appendChild(h("div", { class:"sub" }, "ملاحظة: Task ID يظهر عند إنشاء المهام عبر قاعدة البيانات (حاليًا يتم إدارتها من خلال SQL أو تطوير لاحق في لوحة الإدارة)."));
    return wrap;
  }

  function formatCell(v){
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  // initial
  if (session.token) renderPanel(); else renderLogin();
  return root;
}
