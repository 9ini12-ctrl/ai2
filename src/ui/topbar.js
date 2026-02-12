import { h } from "./dom.js";
import { router } from "./router.js";

export function Topbar(){
  const today = new Date().toLocaleDateString("en-CA", { timeZone:"Asia/Riyadh" });
  return h("div", { class:"topbar" },
    h("div", { class:"brand" },
      h("div", { class:"logo" }, "رم"),
      h("div", {},
        h("h1", {}, "منصة رمضان"),
        h("div", { class:"sub", style:"margin:0" }, `تاريخ اليوم: ${today}`)
      )
    ),
    h("div", { class:"pills" },
      h("a", { class:"pill", href:"/", "data-nav":"" }, "الرئيسية"),
      h("a", { class:"pill", href:"/cpadmin", "data-nav":"" }, "الإدارة")
    )
  );
}
