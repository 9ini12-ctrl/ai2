import { h } from "./dom.js";

let el;
export function toast(title, subtitle=""){
  if (!el){
    el = h("div", { class:"toast" },
      h("div", { class:"t" }),
      h("div", { class:"s" })
    );
    document.body.appendChild(el);
  }
  el.querySelector(".t").textContent = title;
  el.querySelector(".s").textContent = subtitle;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> el.classList.remove("show"), 2600);
}
