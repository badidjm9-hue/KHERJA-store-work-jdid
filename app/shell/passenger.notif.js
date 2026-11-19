/* ===== Notifications (real server events only) + account deletion ===== */
Object.assign(T.ar,{m_notif:"الإشعارات",nt_readall:"قراءة الكل",nt_empty:"لا توجد إشعارات",nt_new_offer:"وصلك عرض جديد",nt_offer_accepted:"تم قبول عرضك",nt_report_status:"تحديث بلاغك",
  nt_s_arrived:"السائق وصل",nt_s_in_progress:"بدأت الرحلة",nt_s_completed:"انتهت الرحلة",nt_s_cancelled:"أُلغيت الرحلة",nt_s_en_route:"السائق في الطريق",
  nt_r_open:"مفتوح",nt_r_reviewing:"قيد المراجعة",nt_r_closed:"مغلق",
  del_h:"حذف الحساب",del_p:"يحذف حسابك ورحلاتك وبلاغاتك نهائيًا ولا يمكن التراجع.",del_btn:"حذف حسابي",del_confirm:"نعم، احذف نهائيًا",del_cancel:"تراجع",del_fail:"تعذّر حذف الحساب، حاول مرة أخرى"});
Object.assign(T.fr,{m_notif:"Notifications",nt_readall:"Tout lire",nt_empty:"Aucune notification",nt_new_offer:"Nouvelle offre reçue",nt_offer_accepted:"Votre offre a été acceptée",nt_report_status:"Mise à jour de votre signalement",
  nt_s_arrived:"Le chauffeur est arrivé",nt_s_in_progress:"La course a commencé",nt_s_completed:"Course terminée",nt_s_cancelled:"Course annulée",nt_s_en_route:"Le chauffeur est en route",
  nt_r_open:"Ouvert",nt_r_reviewing:"En cours d'examen",nt_r_closed:"Clos",
  del_h:"Supprimer le compte",del_p:"Supprime définitivement votre compte, vos courses et vos signalements. Action irréversible.",del_btn:"Supprimer mon compte",del_confirm:"Oui, supprimer définitivement",del_cancel:"Annuler",del_fail:"Suppression impossible, réessayez"});
function ntText(n){const d=n.detail||"";
  if(n.kind==="ride_status")return t("nt_s_"+d)||t("nt_report_status");
  if(n.kind==="report_status")return t("nt_report_status")+" · "+(t("nt_r_"+d)||"");
  if(n.kind==="new_offer")return t("nt_new_offer")+(d?" · "+esc(d)+" "+t("dzd"):"");
  if(n.kind==="offer_accepted")return t("nt_offer_accepted")+(d?" · "+esc(d)+" "+t("dzd"):"");return ""}
async function loadNotif(){const box=$("#nt-list");box.innerHTML=stateBox("loading");
  try{const j=await kapi("GET","/api/notifications");const l=j.notifications||[];
    box.innerHTML=l.length?`<div class="hlist">${l.map(n=>`<div class="hrow card${n.read_at?"":" unread"}"><span class="hr-main"><b>${ntText(n)}</b><small>${esc(fmtDate(n.created_at))}</small></span></div>`).join("")}</div>`
      :`<div class="st-box"><svg class="ic xl" aria-hidden="true"><use href="#i-bell"/></svg><b>${t("nt_empty")}</b></div>`;
    $("#nt-all").hidden=!j.unread;
  }catch{box.innerHTML=stateBox(navigator.onLine===false?"offline":"error",loadNotif)}}
NAV.load["s-notif"]=loadNotif;
$("#nt-all").onclick=async()=>{try{await kapi("POST","/api/notifications/read",{});loadNotif()}catch{}};
/* account deletion (settings) */
$("#del-start").onclick=()=>{$("#del-ask").hidden=false;$("#del-start").hidden=true};
$("#del-no").onclick=()=>{$("#del-ask").hidden=true;$("#del-start").hidden=false;$("#del-err").hidden=true};
$("#del-yes").onclick=async()=>{const e=$("#del-err");e.hidden=true;
  try{await kapi("DELETE","/api/me");location.reload()}catch{e.textContent=t("del_fail");e.hidden=false}};
