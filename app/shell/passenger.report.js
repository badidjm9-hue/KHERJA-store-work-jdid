/* ===== Signaler un problème (real endpoint) ===== */
Object.assign(T.ar,{rp_type:"نوع المشكلة",k_price:"خلاف حول السعر",k_safety:"السلامة",k_other:"أخرى",rp_desc:"تفاصيل إضافية (اختياري)",rp_ph:"صف المشكلة...",rp_send:"إرسال البلاغ",
  rp_ok:"تم إرسال البلاغ",rp_fail:"تعذّر الإرسال، حاول مرة أخرى",rp_none:"لا توجد رحلة للتبليغ عنها",rp_pick:"اختر نوع المشكلة",report_btn:"تبليغ عن مشكلة"});
Object.assign(T.fr,{rp_type:"Type de problème",k_price:"Désaccord sur le prix",k_safety:"Sécurité",k_other:"Autre",rp_desc:"Description (optionnel)",rp_ph:"Décrivez le problème...",rp_send:"Envoyer le signalement",
  rp_ok:"Signalement envoyé",rp_fail:"Envoi impossible, réessayez",rp_none:"Aucune course à signaler",rp_pick:"Choisissez un type de problème",report_btn:"Signaler un problème"});
const R={ride:null,kind:null};
function openReport(id){R.ride=id;R.kind=null;$("#rp-body").value="";$("#rp-err").hidden=true;$("#rp-form").hidden=false;$("#rp-done").hidden=true;
  $$("#s-report .rp-kinds button").forEach(b=>b.setAttribute("aria-checked","false"));go("s-report")}
async function openReportLatest(){
  try{const j=await kapi("GET","/api/rides");const r=(j.rides||[])[0];if(!r){toast(t("rp_none"));return}openReport(r.id)}catch{toast(t("load_fail"))}}
window.openReport=openReport;window.openReportLatest=openReportLatest;
$$("#s-report .rp-kinds button").forEach(b=>b.onclick=()=>{R.kind=b.dataset.k;$$("#s-report .rp-kinds button").forEach(x=>x.setAttribute("aria-checked",String(x===b)));$("#rp-err").hidden=true});
$("#rp-form").onsubmit=async ev=>{ev.preventDefault();const err=$("#rp-err"),btn=$("#rp-send");
  if(!R.kind){err.textContent=t("rp_pick");err.hidden=false;return}
  btn.classList.add("loading");err.hidden=true;
  try{await kapi("POST",`/api/rides/${R.ride}/report`,{kind:R.kind,body:$("#rp-body").value.trim()||undefined});$("#rp-form").hidden=true;$("#rp-done").hidden=false}
  catch{err.textContent=t("rp_fail");err.hidden=false}
  finally{btn.classList.remove("loading")}};
$("#rp-close").onclick=goBack;
// reveal the report buttons now that the endpoint wiring exists
{const hb=$("#hd-report");if(hb)hb.hidden=false;const h2=$("#help-report");if(h2)h2.hidden=false}
