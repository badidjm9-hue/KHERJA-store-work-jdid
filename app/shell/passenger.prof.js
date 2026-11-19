/* ===== Profil / Paramètres / Aide ===== */
Object.assign(T.ar,{prof2_h:"حسابي",m_rides:"رحلاتي",m_contacts:"جهات الاتصال",m_settings:"الإعدادات",m_help:"المساعدة",appearance:"المظهر",language:"اللغة",
  th_sys:"النظام",th_light:"فاتح",th_dark:"داكن",lang_fail:"تعذّر تغيير اللغة، حاول مرة أخرى",
  faq:[["كيف يعمل السعر؟","تقترح سعر رحلتك ويرسل لك السائقون عروضهم. عند قبول عرض يصبح السعر مثبّتًا."],["كم تبقى صلاحية العرض؟","كل عرض صالح 15 ثانية."],["هل يمكنني الإلغاء؟","نعم، طالما أن السائق في الطريق إليك."],["كيف أبلّغ عن مشكلة؟","افتح الرحلة من «رحلاتي» ثم اضغط «تبليغ عن مشكلة»."]]});
Object.assign(T.fr,{prof2_h:"Mon profil",m_rides:"Mes courses",m_contacts:"Contacts de confiance",m_settings:"Paramètres",m_help:"Aide & Support",appearance:"Apparence",language:"Langue",
  th_sys:"Système",th_light:"Mode clair",th_dark:"Mode sombre",lang_fail:"Changement de langue impossible, réessayez",
  faq:[["Comment fonctionne le prix ?","Vous proposez votre prix et les chauffeurs vous envoient leurs offres. Une fois une offre acceptée, le prix est verrouillé."],["Combien de temps une offre reste-t-elle valable ?","Chaque offre est valable 15 secondes."],["Puis-je annuler ?","Oui, tant que le chauffeur est en route."],["Comment signaler un problème ?","Ouvrez la course dans « Mes courses » puis touchez « Signaler un problème »."]]});
async function loadProf(){
  const me=(window.Kherja&&window.Kherja.user)||{};
  $("#pf-name").textContent=me.name||"—";$("#pf-av").textContent=(me.name||"?").trim().charAt(0);
  try{const j=await kapi("GET","/api/me");$("#pf-name").textContent=j.name||"—";$("#pf-av").textContent=(j.name||"?").trim().charAt(0);$("#pf-phone").textContent=j.phone||""}catch{$("#pf-phone").textContent=""}
}
NAV.load["s-prof"]=loadProf;
$$("#pf-menu [data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
$$("#pf-menu [data-needs]").forEach(li=>{if(!$("#"+li.dataset.needs))li.hidden=true});
$("#pf-logout").onclick=()=>$("#p-logout").click(); // same handler as the map's logout button (POST /api/auth/logout, then reload)
/* settings */
function themeNow(){try{const v=localStorage.getItem("kherja-theme");return v==="light"||v==="dark"?v:"system"}catch{return"system"}}
function paintSettings(){const th=themeNow();$$("#set-theme button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.th===th)));$$("#set-lang button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.lg===L)))}
$$("#set-theme button").forEach(b=>b.onclick=()=>{const v=b.dataset.th;try{if(v==="system")localStorage.removeItem("kherja-theme");else localStorage.setItem("kherja-theme",v)}catch{}
  if(v==="system")delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=v;paintSettings()});
$$("#set-lang button").forEach(b=>b.onclick=async()=>{if(b.dataset.lg===L)return;const e=$("#set-err");e.hidden=true;
  try{await kapi("POST","/api/me",{lang:b.dataset.lg});location.reload()}catch{e.textContent=t("lang_fail");e.hidden=false}});
NAV.load["s-set"]=paintSettings;
/* help */
function buildFaq(){$("#faq").innerHTML=t("faq").map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
NAV.load["s-help"]=()=>{buildFaq();const b=$("#help-report");b.hidden=!window.openReportLatest};
$("#help-report").onclick=()=>{if(window.openReportLatest)openReportLatest()};
