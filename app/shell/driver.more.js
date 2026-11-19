/* ===== Driver extra screens (real endpoints: /api/rides, /api/driver/earnings, /api/notifications, /api/safety/contacts, /api/me, /api/rides/:id/report) ===== */
Object.assign(T.ar,{m_act:"النشاط والأرباح",m_notif:"الإشعارات",m_contacts:"جهات الاتصال",m_settings:"الإعدادات",report_btn:"تبليغ عن مشكلة",
  earn_note:"إجمالي أجور الرحلات المكتملة، بدون أي عمولة محسوبة.",e_today:"اليوم",e_week:"آخر 7 أيام",e_all:"الكل",dzd:"دج",trips:"رحلة",hist_empty:"لا توجد رحلات بعد",ride_no:"رحلة رقم",
  st_completed:"مكتملة",st_cancelled:"ملغاة",st_live:"جارية",loading:"جارٍ التحميل…",load_fail:"تعذّر التحميل",retry:"إعادة المحاولة",
  nt_readall:"قراءة الكل",nt_empty:"لا توجد إشعارات",nt_offer_accepted:"تم قبول عرضك",nt_new_offer:"وصلك عرض جديد",nt_report_status:"تحديث بلاغك",
  nt_s_arrived:"وصل السائق",nt_s_in_progress:"بدأت الرحلة",nt_s_completed:"انتهت الرحلة",nt_s_cancelled:"أُلغيت الرحلة",nt_s_en_route:"في الطريق",nt_r_open:"مفتوح",nt_r_reviewing:"قيد المراجعة",nt_r_closed:"مغلق",
  c_note:"أرقام تتصل بها أو تراسلها بنفسك عند الحاجة. لا يُرسل التطبيق أي رسالة تلقائيًا.",c_name:"اسم جهة الاتصال",c_phone:"رقم الهاتف",c_add:"إضافة",c_none:"لا توجد جهات اتصال بعد",c_bad:"رقم غير صحيح",c_fail:"تعذّر الحفظ",c_call:"اتصال",c_sms:"رسالة",
  appearance:"المظهر",language:"اللغة",th_sys:"النظام",th_light:"فاتح",th_dark:"داكن",lang_fail:"تعذّر تغيير اللغة",
  k_price:"خلاف حول السعر",k_safety:"السلامة",k_other:"أخرى",rp_desc:"تفاصيل إضافية (اختياري)",rp_send:"إرسال البلاغ",rp_ok:"تم إرسال البلاغ",rp_fail:"تعذّر الإرسال، حاول مرة أخرى",rp_none:"لا توجد رحلة للتبليغ عنها",rp_pick:"اختر نوع المشكلة"});
Object.assign(T.fr,{m_act:"Activité et gains",m_notif:"Notifications",m_contacts:"Contacts de confiance",m_settings:"Paramètres",report_btn:"Signaler un problème",
  earn_note:"Total brut des courses terminées, sans commission appliquée.",e_today:"Aujourd'hui",e_week:"7 derniers jours",e_all:"Total",dzd:"DZD",trips:"courses",hist_empty:"Aucune course pour le moment",ride_no:"Course n°",
  st_completed:"Terminée",st_cancelled:"Annulée",st_live:"En cours",loading:"Chargement…",load_fail:"Chargement impossible",retry:"Réessayer",
  nt_readall:"Tout lire",nt_empty:"Aucune notification",nt_offer_accepted:"Votre offre a été acceptée",nt_new_offer:"Nouvelle offre reçue",nt_report_status:"Mise à jour de votre signalement",
  nt_s_arrived:"Le chauffeur est arrivé",nt_s_in_progress:"La course a commencé",nt_s_completed:"Course terminée",nt_s_cancelled:"Course annulée",nt_s_en_route:"En route",nt_r_open:"Ouvert",nt_r_reviewing:"En cours d'examen",nt_r_closed:"Clos",
  c_note:"Numéros que vous appelez ou contactez vous-même en cas de besoin. L'application n'envoie aucun message automatiquement.",c_name:"Nom du contact",c_phone:"Téléphone",c_add:"Ajouter",c_none:"Aucun contact pour le moment",c_bad:"Numéro invalide",c_fail:"Enregistrement impossible",c_call:"Appeler",c_sms:"SMS",
  appearance:"Apparence",language:"Langue",th_sys:"Système",th_light:"Mode clair",th_dark:"Mode sombre",lang_fail:"Changement de langue impossible",
  k_price:"Désaccord sur le prix",k_safety:"Sécurité",k_other:"Autre",rp_desc:"Description (optionnel)",rp_send:"Envoyer le signalement",rp_ok:"Signalement envoyé",rp_fail:"Envoi impossible, réessayez",rp_none:"Aucune course à signaler",rp_pick:"Choisissez un type de problème"});
const DM={stack:[]};
const dmGo=id=>{DM.stack.push($(".screen.on")?.id||"s-account");screen(id);const f=DM.load[id];if(f)f()};
const dmBack=()=>{screen(DM.stack.pop()||"s-account")};
$$("[data-dmback]").forEach(b=>b.onclick=dmBack);
const dmFmt=s=>{try{return new Date(String(s).replace(" ","T")+"Z").toLocaleString(L==="ar"?"ar-DZ-u-nu-latn":"fr-FR",{dateStyle:"medium",timeStyle:"short"})}catch{return s||""}};
const dmBox=(k,retry)=>k==="loading"?`<p class="dm-st" role="status">${t("loading")}</p>`:`<div class="dm-st" role="alert"><b>${t("load_fail")}</b><button type="button" class="btn ghost" data-retry>${t("retry")}</button></div>`;
const dmRetry=(box,fn)=>{const b=box.querySelector("[data-retry]");if(b)b.onclick=fn};
DM.load={};
/* activity + earnings */
DM.load["dm-act"]=async function ld(){const box=$("#dm-hist"),eb=$("#dm-earn");box.innerHTML=dmBox("loading");
  try{const [e,r]=await Promise.all([api("GET","/api/driver/earnings"),api("GET","/api/rides")]);
    eb.innerHTML=[["e_today",e.today],["e_week",e.week],["e_all",e.all]].map(([k,v])=>`<div class="dm-card"><small>${t(k)}</small><b class="num">${v.total} ${t("dzd")}</b><small>${v.n} ${L==="fr"&&v.n<2?"course":t("trips")}</small></div>`).join("");
    const l=r.rides||[];const det={};await Promise.all(l.slice(0,20).map(async x=>{try{det[x.id]=await api("GET","/api/rides/"+x.id)}catch{}}));
    box.innerHTML=l.length?l.map(x=>{const d=det[x.id]||{};const k=x.status==="completed"?"completed":x.status==="cancelled"?"cancelled":"live";
      return `<div class="dm-row"><span><b>${d.p_label?esc(d.p_label)+" → "+esc(d.d_label||"—"):t("ride_no")+" "+x.id}</b><small>${esc(dmFmt(x.created_at))}</small></span><span class="dm-end"><b class="num">${x.locked_price} ${t("dzd")}</b><small class="dm-b ${k}">${t("st_"+k)}</small></span></div>`}).join("")
      :`<p class="dm-st">${t("hist_empty")}</p>`;
    DM.lastRide=l[0]?l[0].id:null;
  }catch{box.innerHTML=dmBox("error");dmRetry(box,ld)}};
/* notifications */
const dmNt=n=>{const d=n.detail||"";return n.kind==="ride_status"?t("nt_s_"+d):n.kind==="report_status"?t("nt_report_status")+" · "+t("nt_r_"+d):n.kind==="new_offer"?t("nt_new_offer"):t("nt_offer_accepted")+(d?" · "+esc(d)+" "+t("dzd"):"")};
DM.load["dm-notif"]=async function ld(){const box=$("#dm-n-list");box.innerHTML=dmBox("loading");
  try{const j=await api("GET","/api/notifications");const l=j.notifications||[];
    box.innerHTML=l.length?l.map(n=>`<div class="dm-row${n.read_at?"":" unread"}"><span><b>${dmNt(n)}</b><small>${esc(dmFmt(n.created_at))}</small></span></div>`).join(""):`<p class="dm-st">${t("nt_empty")}</p>`;
    $("#dm-n-all").hidden=!j.unread}catch{box.innerHTML=dmBox("error");dmRetry(box,ld)}};
$("#dm-n-all").onclick=async()=>{try{await api("POST","/api/notifications/read",{});DM.load["dm-notif"]()}catch{}};
/* contacts (tel:/sms: links only: nothing is sent by the app) */
DM.load["dm-cont"]=async function ld(){const box=$("#dm-c-list");box.innerHTML=dmBox("loading");
  try{const j=await api("GET","/api/safety/contacts");const l=j.contacts||[];
    box.innerHTML=l.length?l.map(c=>`<div class="dm-row"><span><b>${esc(c.name)}</b><small class="num" dir="ltr">${esc(c.phone)}</small></span><span class="dm-end"><a class="dm-link" href="tel:${esc(c.phone)}">${t("c_call")}</a><a class="dm-link" href="sms:${esc(c.phone)}">${t("c_sms")}</a></span></div>`).join(""):`<p class="dm-st">${t("c_none")}</p>`;
  }catch{box.innerHTML=dmBox("error");dmRetry(box,ld)}};
$("#dm-c-form").onsubmit=async ev=>{ev.preventDefault();const e=$("#dm-c-err");e.textContent="";
  try{await api("POST","/api/safety/contacts",{name:$("#dm-c-name").value.trim(),phone:$("#dm-c-phone").value.trim()});$("#dm-c-name").value="";$("#dm-c-phone").value="";DM.load["dm-cont"]()}
  catch(x){e.textContent=x.status===400?t("c_bad"):t("c_fail")}};
/* settings */
const dmTheme=()=>{try{const v=localStorage.getItem("kherja-theme");return v==="light"||v==="dark"?v:"system"}catch{return"system"}};
DM.load["dm-set"]=()=>{const th=dmTheme();$$("#dm-theme button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.th===th)));$$("#dm-lang button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.lg===L)))};
$$("#dm-theme button").forEach(b=>b.onclick=()=>{const v=b.dataset.th;try{v==="system"?localStorage.removeItem("kherja-theme"):localStorage.setItem("kherja-theme",v)}catch{}
  v==="system"?delete document.documentElement.dataset.theme:document.documentElement.dataset.theme=v;DM.load["dm-set"]()});
$$("#dm-lang button").forEach(b=>b.onclick=async()=>{if(b.dataset.lg===L)return;$("#dm-s-err").textContent="";try{await api("POST","/api/me",{lang:b.dataset.lg});location.reload()}catch{$("#dm-s-err").textContent=t("lang_fail")}});
/* report (latest ride) */
DM.rk=null;
DM.load["dm-rep"]=()=>{DM.rk=null;$("#dm-r-body").value="";$("#dm-r-err").textContent="";$("#dm-r-form").hidden=false;$("#dm-r-done").hidden=true;$$("#dm-r-kinds button").forEach(b=>b.setAttribute("aria-checked","false"))};
$$("#dm-r-kinds button").forEach(b=>b.onclick=()=>{DM.rk=b.dataset.k;$$("#dm-r-kinds button").forEach(x=>x.setAttribute("aria-checked",String(x===b)))});
$("#dm-r-form").onsubmit=async ev=>{ev.preventDefault();const e=$("#dm-r-err");e.textContent="";if(!DM.rk){e.textContent=t("rp_pick");return}
  try{const r=((await api("GET","/api/rides")).rides||[])[0];if(!r){e.textContent=t("rp_none");return}
    await api("POST",`/api/rides/${r.id}/report`,{kind:DM.rk,body:$("#dm-r-body").value.trim()||undefined});$("#dm-r-form").hidden=true;$("#dm-r-done").hidden=false}catch{e.textContent=t("rp_fail")}};
/* account menu (inserted above logout) */
{const m=document.createElement("ul");m.className="dm-menu";m.id="dm-menu";
  const it=[["dm-act","hist","m_act"],["dm-notif","bell","m_notif"],["dm-cont","users","m_contacts"],["dm-set","gear","m_settings"],["dm-rep","alert","report_btn"]];
  m.innerHTML=it.map(([id,ic,k])=>`<li><button type="button" data-dm="${id}"><svg class="ic" aria-hidden="true"><use href="#dmi-${ic}"/></svg><span data-i="${k}"></span><svg class="ic row-chev" aria-hidden="true"><use href="#dmi-chev"/></svg></button></li>`).join("");
  $("#s-account").insertBefore(m,$("#logout"));$$("#dm-menu [data-dm]").forEach(b=>b.onclick=()=>dmGo(b.dataset.dm))}
applyI18n();
