import "./styles.css";
import { mount, h } from "./ui/dom.js";
import { router } from "./ui/router.js";
import { Topbar } from "./ui/topbar.js";
import { toast } from "./ui/toast.js";

const app = document.getElementById("app");

function AppShell(contentNode){
  return h("div", { class: "container" },
    Topbar(),
    contentNode,
    h("div", { class:"footer-note" },
      "© منصة تشغيل رمضان — نسخة 1.0 — ",
      h("span", { style:"opacity:.8" }, "Static + Netlify Functions + Neon")
    )
  );
}

router.setRenderer((node) => {
  mount(app, AppShell(node));
});

router.start();

// global for debugging
window.__toast = toast;
