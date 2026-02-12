import { toast } from "./toast.js";

export async function shareMessage({ title, text, imageUrl }){
  // Best-effort:
  // 1) Try Web Share with file (if supported)
  // 2) Try Web Share with text + url
  // 3) Fallback: copy text
  const shareText = (text || "").trim();
  try{
    if (navigator.canShare && navigator.share && imageUrl){
      const blob = await fetch(imageUrl, { mode:"cors" }).then(r => r.blob());
      const file = new File([blob], "message.jpg", { type: blob.type || "image/jpeg" });
      if (navigator.canShare({ files:[file] })){
        await navigator.share({ title, text: shareText, files:[file] });
        toast("تمت المشاركة", "ممتاز");
        return;
      }
    }
  }catch(_){/* ignore */}
  try{
    if (navigator.share){
      await navigator.share({ title, text: shareText, url: imageUrl || undefined });
      toast("تمت المشاركة", "ممتاز");
      return;
    }
  }catch(_){/* ignore */}
  try{
    await navigator.clipboard.writeText([shareText, imageUrl].filter(Boolean).join("\n\n"));
    toast("تم النسخ", "تم نسخ النص (والصورة كرابط إن وجدت).");
  }catch(e){
    toast("تعذر النسخ", "انسخ يدويًا من النص.");
  }
}
