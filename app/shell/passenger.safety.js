/* ===== Contacts de confiance + SOS (no fake notification: device call/SMS links only) ===== */
Object.assign(T.ar,{contacts_h:"جهات الاتصال",contacts_s:"أضف جهات اتصال موثوقة للحصول على مساعدة سريعة.",c_name:"اسم جهة الاتصال",c_phone:"رقم الهاتف",add_contact:"إضافة جهة اتصال",save:"حفظ",
  auto_note:"تنبيه: التنبيهات التلقائية غير متوفرة حالياً.",c_call:"اتصال",c_sms:"رسالة",sos_h:"تنبيه الطوارئ",c_none:"لا توجد جهات اتصال بعد",c_bad:"رقم الهاتف غير صالح",c_max:"الحد الأقصى 5 جهات اتصال",c_fail:"تعذّر الحفظ، حاول مرة أخرى",c_name_req:"أدخل الاسم"});
Object.assign(T.fr,{contacts_h:"Contacts de confiance",contacts_s:"Ajoutez vos contacts de confiance pour une assistance rapide.",c_name:"Nom du contact",c_phone:"Numéro de téléphone",add_contact:"Ajouter un contact",save:"Enregistrer",
  auto_note:"L'alerte automatique n'est pas connectée pour le moment.",c_call:"Appeler",c_sms:"Envoyer SMS",sos_h:"Alerte d'urgence",c_none:"Aucun contact pour le moment",c_bad:"Numéro invalide",c_max:"Maximum 5 contacts",c_fail:"Enregistrement impossible, réessayez",c_name_req:"Saisissez un nom"});
const C={list:null};
const telHref=p=>"tel:"+String(p).replace(/[^+\d]/g,"");
const smsHref=p=>"sms:"+String(p).replace(/[^+\d]/g,"");
function contactRow(c,full){const nm=esc(c.name);
  return `<div class="card ct-row"><span class="av" aria-hidden="true">${esc((c.name||"?").trim().charAt(0))}</span><span class="ct-id"><b>${nm}</b><small dir="ltr">${esc(c.phone)}</small></span>
   ${full?`<span class="ct-acts"><a class="btn primary" href="${telHref(c.phone)}"><svg class="ic" aria-hidden="true"><use href="#i-phone"/></svg>${t("c_call")}</a><a class="btn ghost" href="${smsHref(c.phone)}"><svg class="ic" aria-hidden="true"><use href="#i-sms"/></svg>${t("c_sms")}</a></span>`
   :`<span class="ct-icons"><a class="round" href="${telHref(c.phone)}" aria-label="${t("c_call")} ${nm}"><svg class="ic" aria-hidden="true"><use href="#i-phone"/></svg></a><a class="round alt" href="${smsHref(c.phone)}" aria-label="${t("c_sms")} ${nm}"><svg class="ic" aria-hidden="true"><use href="#i-sms"/></svg></a></span>`}</div>`}
async function fetchContacts(target,full,retry){
  const box=$(target);box.innerHTML=stateBox("loading");
  try{const j=await kapi("GET","/api/safety/contacts");C.list=j.contacts||[];
    box.innerHTML=C.list.length?`<div class="hlist">${C.list.map(c=>contactRow(c,full)).join("")}</div>`:`<div class="st-box"><b>${t("c_none")}</b></div>`;
    return C.list}
  catch{box.innerHTML=stateBox("error");const b=box.querySelector("[data-retry]");if(b)b.onclick=retry;return null}
}
NAV.load["s-contacts"]=()=>{$("#ct-form").hidden=true;$("#ct-add").hidden=false;fetchContacts("#ct-list",false,NAV.load["s-contacts"])};
NAV.load["s-sos"]=async()=>{const l=await fetchContacts("#sos-list",true,NAV.load["s-sos"]);$("#sos-add").hidden=!(l&&!l.length)};
$("#sos-add").onclick=()=>go("s-contacts");
$("#ct-add").onclick=()=>{$("#ct-form").hidden=false;$("#ct-add").hidden=true;$("#ct-err").hidden=true;$("#ct-name").focus()};
$("#ct-cancel").onclick=()=>{$("#ct-form").hidden=true;$("#ct-add").hidden=false};
$("#ct-form").onsubmit=async ev=>{ev.preventDefault();const err=$("#ct-err"),btn=$("#ct-save"),name=$("#ct-name").value.trim(),phone=$("#ct-phone").value.trim();
  const fail=m=>{err.textContent=m;err.hidden=false};err.hidden=true;
  if(!name)return fail(t("c_name_req"));if(!phone)return fail(t("c_bad"));
  btn.classList.add("loading");
  try{await kapi("POST","/api/safety/contacts",{name,phone});$("#ct-name").value="";$("#ct-phone").value="";NAV.load["s-contacts"]()}
  catch(e){fail(e.status===409?t("c_max"):e.status===400?t("c_bad"):t("c_fail"))}
  finally{btn.classList.remove("loading")}};
/* The SOS chip used to show a toast claiming contacts were notified, but nothing is sent. It now opens the SOS screen (call / SMS via the device). */
$("#sos").onclick=()=>go("s-sos");
/* The in-ride "share" button only showed a "link copied" toast without copying anything (no share-link backend exists): hidden instead of faking success. */
{const sh=$("#share");if(sh)sh.hidden=true}
