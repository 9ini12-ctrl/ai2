import { h } from "./dom.js";
import { HomePage } from "../pages/home.js";
import { AmbassadorPage } from "../pages/ambassador.js";
import { BranchPage } from "../pages/branch.js";
import { AdminPage } from "../pages/admin.js";

function match(path){
  // returns {name, params}
  const clean = path.replace(/\/+$/,"") || "/";
  if (clean === "/") return { name:"home", params:{} };

  const safer = clean.match(/^\/safer\/([^\/]+)$/);
  if (safer) return { name:"ambassador", params:{ numsafer: decodeURIComponent(safer[1]) } };

  const fre = clean.match(/^\/fre\/([^\/]+)$/);
  if (fre) return { name:"branch", params:{ numfre: decodeURIComponent(fre[1]) } };

  if (clean === "/cpadmin") return { name:"admin", params:{} };

  return { name:"404", params:{} };
}

function setMeta({ title, robots }){
  document.title = title || "منصة رمضان";
  let m = document.querySelector('meta[name="robots"]');
  if (!m){
    m = document.createElement("meta");
    m.setAttribute("name","robots");
    document.head.appendChild(m);
  }
  m.setAttribute("content", robots || "index,follow");
}

export const router = {
  _render: null,
  setRenderer(fn){ this._render = fn; },
  nav(to){
    history.pushState({}, "", to);
    this._handle();
  },
  start(){
    window.addEventListener("popstate", ()=> this._handle());
    document.addEventListener("click", (e)=>{
      const a = e.target.closest("a[data-nav]");
      if (!a) return;
      e.preventDefault();
      this.nav(a.getAttribute("href"));
    });
    this._handle();
  },
  _handle(){
    const { name, params } = match(location.pathname);
    if (name === "home"){ setMeta({title:"الرئيسية — منصة رمضان", robots:"index,follow"}); this._render(HomePage()); return; }
    if (name === "ambassador"){ setMeta({title:`السفير ${params.numsafer} — منصة رمضان`, robots:"noindex,nofollow"}); this._render(AmbassadorPage(params)); return; }
    if (name === "branch"){ setMeta({title:`الفرع ${params.numfre} — منصة رمضان`, robots:"noindex,nofollow"}); this._render(BranchPage(params)); return; }
    if (name === "admin"){ setMeta({title:"الإدارة — منصة رمضان", robots:"noindex,nofollow"}); this._render(AdminPage()); return; }

    setMeta({title:"غير موجود — منصة رمضان", robots:"noindex,nofollow"});
    this._render(h("div", { class:"card" },
      h("h2", {}, "الصفحة غير موجودة"),
      h("p", { class:"sub" }, "تحقق من الرابط أو ارجع للرئيسية."),
      h("a", { class:"btn primary", href:"/", "data-nav":"" }, "العودة للرئيسية")
    ));
  }
};
