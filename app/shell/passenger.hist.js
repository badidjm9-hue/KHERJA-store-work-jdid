/* ===== Mes courses + détails (real data only) ===== */
Object.assign(T.ar,{hist_h:"رحلاتي",hist_f:"تصفية الرحلات",f_all:"الكل",f_done:"مكتملة",f_canc:"ملغاة",hdet_h:"تفاصيل الرحلة",hist_empty:"لا توجد رحلات بعد",
  st_completed:"مكتملة",st_cancelled:"ملغاة",st_live:"جارية",route_l:"المسار",amount_l:"المبلغ",from_l:"من",to_l:"إلى",report_btn:"تبليغ عن مشكلة",ride_no:"رحلة رقم"});
Object.assign(T.fr,{hist_h:"Mes courses",hist_f:"Filtrer les courses",f_all:"Toutes",f_done:"Terminées",f_canc:"Annulées",hdet_h:"Détails de la course",hist_empty:"Aucune course pour le moment",
  st_completed:"Terminée",st_cancelled:"Annulée",st_live:"En cours",route_l:"Trajet",amount_l:"Montant",from_l:"De",to_l:"À",report_btn:"Signaler un problème",ride_no:"Course n°"});
const H={rides:null,filter:"all",det:{}};
const stKey=s=>s==="completed"?"completed":s==="cancelled"?"cancelled":"live";
const badge=s=>`<span class="badge ${s==="completed"?"ok":s==="cancelled"?"no":""}">${t("st_"+stKey(s))}</span>`;
function histRow(r){const d=H.det[r.id];
  return `<button type="button" class="hrow card" data-id="${r.id}"><span class="hr-main"><b class="hr-route">${d?`${esc(d.p_label||"—")} → ${esc(d.d_label||"—")}`:`${t("ride_no")} ${r.id}`}</b><small>${esc(fmtDate(r.created_at))}</small></span><span class="hr-end"><b>${r.locked_price!=null?r.locked_price+" "+t("dzd"):""}</b>${badge(r.status)}</span></button>`}
function renderHist(){
  const box=$("#hist-list");if(!H.rides)return;
  const list=H.rides.filter(r=>H.filter==="all"||(H.filter==="completed"?r.status==="completed":r.status==="cancelled"));
  if(!list.length){box.innerHTML=`<div class="st-box"><svg class="ic xl" aria-hidden="true"><use href="#i-hist"/></svg><b>${t("hist_empty")}</b></div>`;return}
  box.innerHTML=`<div class="hlist">${list.map(histRow).join("")}</div>`;
  box.querySelectorAll(".hrow").forEach(b=>b.onclick=()=>openDetail(+b.dataset.id));
}
async function loadHist(){
  const box=$("#hist-list");box.innerHTML=stateBox("loading");
  try{const j=await kapi("GET","/api/rides");H.rides=j.rides||[];renderHist();
    // route labels come from the ride detail endpoint; fetch the visible ones (max 20) in parallel and fill rows in place
    await Promise.all(H.rides.slice(0,20).map(async r=>{if(H.det[r.id])return;try{H.det[r.id]=await kapi("GET","/api/rides/"+r.id)}catch{}}));renderHist();
  }catch(e){box.innerHTML=stateBox("error");const b=box.querySelector("[data-retry]");if(b)b.onclick=loadHist}
}
$$("#s-hist .chips button").forEach(b=>b.onclick=()=>{H.filter=b.dataset.f;$$("#s-hist .chips button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));renderHist()});
NAV.load["s-hist"]=loadHist;
async function openDetail(id){
  go("s-hdet");const body=$("#hdet-body");body.innerHTML=stateBox("loading");
  try{const d=H.det[id]=await kapi("GET","/api/rides/"+id);const dr=d.driver;
    const row=H.rides&&H.rides.find(r=>r.id===id);
    body.innerHTML=`<div class="card hd-card">${badge(d.status)}${dr?`<div class="hd-driver"><span class="av" aria-hidden="true">${esc((dr.name||"?").trim().charAt(0))}</span><span><b>${esc(dr.name||"")}</b><small>${esc(dr.car||"")}${dr.plate?" · "+esc(dr.plate):""}</small></span><span class="star">★ ${dr.rating}</span></div>`:""}</div>
      <div class="card hd-card"><h2>${t("route_l")}</h2><div class="hd-route"><span class="pi"><svg class="ic" aria-hidden="true"><use href="#i-pin"/></svg></span><span><small>${t("from_l")}</small><b>${esc(d.p_label||"—")}</b></span></div><div class="hd-route"><span class="pi"><svg class="ic" aria-hidden="true"><use href="#i-flag"/></svg></span><span><small>${t("to_l")}</small><b>${esc(d.d_label||"—")}</b></span></div></div>
      <div class="card hd-card hd-amt"><span>${t("amount_l")}</span><b>${d.locked_price!=null?d.locked_price+" "+t("dzd"):"—"}</b></div>
      ${row?`<p class="hd-date">${esc(fmtDate(row.created_at))}</p>`:""}
      <button type="button" class="btn ghost" id="hd-report" data-id="${id}">${t("report_btn")}</button>`;
    const rb=$("#hd-report");rb.onclick=()=>{if(window.openReport)openReport(id)};
    if(!window.openReport)rb.hidden=true;
  }catch(e){body.innerHTML=stateBox("error");const b=body.querySelector("[data-retry]");if(b)b.onclick=()=>openDetail(id)}
}
