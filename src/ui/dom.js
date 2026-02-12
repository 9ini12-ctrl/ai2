export function h(tag, attrs = {}, ...children){
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs || {})){
    if (k === "class") el.className = v;
    else if (k === "style") el.setAttribute("style", v);
    else if (k.startsWith("on") && typeof v === "function"){
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === false || v === null || v === undefined){
      // skip
    } else {
      el.setAttribute(k, String(v));
    }
  }
  for (const c of children.flat()){
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return el;
}

export function mount(root, node){
  root.innerHTML = "";
  root.appendChild(node);
}
