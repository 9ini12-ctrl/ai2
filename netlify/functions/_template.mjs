export function applyTemplate(template, varsMap, { unknown="__EMPTY__" } = {}){
  const t = String(template || "");
  return t.replace(/#([^\s#]+)/g, (_, key)=>{
    const k = String(key || "").trim();
    const v = varsMap[k];
    if (v === undefined || v === null) return unknown === "__EMPTY__" ? "" : unknown;
    return String(v);
  });
}

export function buildVars({ ambassador, branch }){
  const vars = {};
  // fixed fields
  if (ambassador){
    vars["كود-الإحالة"] = ambassador.referral_code || "";
    vars["رقم-السفير"] = ambassador.numsafer || "";
    vars["اسم-السفير"] = ambassador.name || "فاعل خير";
    vars["جوال-السفير"] = ambassador.phone || "";
    for (const [k,v] of Object.entries(ambassador.vars || {})){
      vars[k] = v;
    }
  }
  if (branch){
    vars["رقم-الفرع"] = branch.numfre || "";
    vars["اسم-الفرع"] = branch.name || "";
    for (const [k,v] of Object.entries(branch.vars || {})){
      vars[k] = v;
    }
  }
  return vars;
}
