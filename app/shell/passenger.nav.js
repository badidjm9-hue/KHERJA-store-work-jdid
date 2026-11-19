/* ===== passenger navigation: tab bar (Accueil / Historique / Profil) + back stack for the extra screens ===== */
const NAV={stack:[],load:{},tabs:["home","hist","prof"]};
Object.assign(T.ar,{tab_home:"الرئيسية",tab_hist:"رحلاتي",tab_prof:"حسابي",tabs_l:"التنقل الرئيسي",back:"رجوع",loading:"جاري التحميل...",
  offline_h:"لا يوجد اتصال بالإنترنت",offline_s:"تحقق من اتصالك بالإنترنت ثم أعد المحاولة",retry:"إعادة المحاولة",load_fail:"تعذّر التحميل، حاول مرة أخرى"});
Object.assign(T.fr,{tab_home:"Accueil",tab_hist:"Historique",tab_prof:"Profil",tabs_l:"Navigation principale",back:"Retour",loading:"Chargement...",
  offline_h:"Pas de connexion internet",offline_s:"Vérifiez votre connexion puis réessayez",retry:"Réessayer",load_fail:"Chargement impossible, réessayez"});
const curScreen=()=>{const e=$$(".screen.on")[0];return e?e.id:"s-map"};
function go(id,{back=false}={}){
  const cur=curScreen();
  if(!back&&cur!==id){NAV.stack.push(cur)}
  screen(id);
  const sc=$("#"+id);if(sc){const pb=sc.querySelector(".pb");if(pb)pb.scrollTop=0}
  $$("#"+id+" [data-tab], #sh-home [data-tab]").forEach(b=>b.setAttribute("aria-current",String(b.dataset.tab===({"s-hist":"hist","s-hdet":"hist","s-prof":"prof","s-set":"prof","s-help":"prof","s-contacts":"prof","s-report":"hist"}[id]||"home"))));
  if(NAV.load[id])NAV.load[id]();
}
function goBack(){const to=NAV.stack.pop()||"s-map";go(to,{back:true})}
function tabGo(tab){NAV.stack.length=0;if(tab==="home"){screen("s-map");$$("[data-tab]").forEach(b=>b.setAttribute("aria-current",String(b.dataset.tab==="home")));return}go(tab==="hist"?"s-hist":"s-prof")}
function buildTabbar(){
  const items={home:"home",hist:"hist",prof:"user"};
  $$("[data-ptabs]").forEach(n=>{n.setAttribute("aria-label",t("tabs_l"));
    n.innerHTML=NAV.tabs.map(k=>`<button type="button" class="ptab" data-tab="${k}" aria-current="${n.dataset.ptabs===k}"><svg class="ic" aria-hidden="true"><use href="#i-${items[k]}"/></svg><span>${t("tab_"+k)}</span></button>`).join("");
    n.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>tabGo(b.dataset.tab))});
}
$$("[data-back]").forEach(b=>{b.onclick=goBack;b.setAttribute("aria-label",t("back"))});
/* shared loading / error / offline states for list screens */
function stateBox(kind,retry){
  if(kind==="loading")return `<div class="st-box" role="status" aria-live="polite"><span class="spin" aria-hidden="true"></span><p>${t("loading")}</p></div>`;
  const off=!navigator.onLine;
  return `<div class="st-box" role="alert"><svg class="ic xl" aria-hidden="true"><use href="#i-alert"/></svg><b>${off?t("offline_h"):t("load_fail")}</b>${off?`<p>${t("offline_s")}</p>`:""}<button type="button" class="btn ghost" data-retry>${t("retry")}</button></div>`;
}
function fmtDate(v){let d=v;if(typeof v==="string"){d=/^\d+$/.test(v)?+v:v.includes("T")?v:v.replace(" ","T")+"Z"}
  const dt=new Date(d);if(isNaN(dt))return"";return new Intl.DateTimeFormat(L==="ar"?"ar-DZ-u-nu-latn":"fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(dt)}
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
/* own fetch helper: the view's api() lives in a block scope and is not reachable from here */
const kapi=async(m,p,b)=>{const r=await fetch(p,{method:m,headers:{'content-type':'application/json'},body:b?JSON.stringify(b):undefined,credentials:'same-origin'});
  let j={};try{j=await r.json()}catch{} if(!r.ok)throw Object.assign(new Error(j.error||r.status),{status:r.status});return j};
