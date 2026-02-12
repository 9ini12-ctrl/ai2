import { h } from "./dom.js";

export function Card(title, subtitle, ...children){
  return h("div", { class:"card" },
    title ? h("h2", {}, title) : null,
    subtitle ? h("p", { class:"sub" }, subtitle) : null,
    ...children
  );
}

export function Row(title, meta, rightNode){
  return h("div", { class:"row" },
    h("div", { class:"left" },
      h("div", { class:"title" }, title),
      meta ? h("div", { class:"meta" }, meta) : null
    ),
    rightNode
  );
}

export function Badge(text, kind=""){
  return h("span", { class:`badge ${kind}` }, text);
}

export function Kpi(big, label){
  return h("div", { class:"kpi" },
    h("div", { class:"big" }, big),
    h("div", { class:"label" }, label)
  );
}

export function LoadingCard(title="جارٍ التحميل..."){
  return Card(title, "", 
    h("div", { class:"skeleton", style:"height:14px; margin:10px 0" }),
    h("div", { class:"skeleton", style:"height:14px; width:70%; margin:10px 0" }),
    h("div", { class:"skeleton", style:"height:14px; width:50%; margin:10px 0" })
  );
}

export function ErrorCard(msg, onRetry){
  return Card("تعذر تحميل البيانات", msg || "حدث خطأ غير متوقع.",
    h("div", { class:"btns" },
      h("button", { class:"btn primary", onclick: onRetry }, "إعادة المحاولة")
    )
  );
}

export function EmptyCard(title, msg){
  return Card(title, msg || "لا توجد بيانات متاحة حاليًا.");
}
