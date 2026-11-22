const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const T={
 ar:{d_h:"اربح بسعر عادل",d_s:"سجّل كسائق أو موصّل، وارفع وثائقك مرة واحدة.",phone_l:"رقم الهاتف",send_code:"إرسال الرمز",otp_h:"أدخل الرمز",otp_s:"أرسلناه إلى",demo_code:"رمز التجربة:",verify:"تأكيد",
  invalid:"رقم غير صحيح",bad_code:"الرمز غير صحيح",too_many:"محاولات كثيرة، انتظر قليلًا",net:"تعذّر الاتصال",otp_g:"رمز التحقق",
  prof_h:"بياناتك ومركبتك",prof_s:"تظهر للركاب عند تقديم عرضك.",name_l:"الاسم",veh_l:"نوع المركبة",veh_car:"سيارة",veh_moto:"دراجة",model_l:"الطراز",plate_l:"رقم اللوحة",woman_l:"أنا سائقة (يظهر لمن يطلب سائقة فقط)",next:"التالي",
  f_name:"اكتب اسمك",f_model:"اكتب طراز المركبة",f_plate:"اكتب رقم اللوحة",plate_taken:"رقم اللوحة مسجّل مسبقًا",
  docs_h:"الوثائق",docs_s:"نراجع كل وثيقة قبل أن تبدأ العمل. صوّرها بوضوح وبإضاءة جيدة.",docs_priv:"الصور تُخزَّن بأمان ويراها فريق المراجعة فقط، وتُحذف عند حذف حسابك.",
  vehicle_photo:"صورة المركبة",vehicle_photo_h:"صورة واضحة للمركبة من الأمام تظهر فيها اللوحة.",license:"رخصة السياقة",license_h:"الوجه الأمامي للرخصة، سارية المفعول.",
  registration:"البطاقة الرمادية",registration_h:"بطاقة تسجيل المركبة باسمك أو مع تفويض.",insurance:"وثيقة التأمين",insurance_h:"تأمين ساري المفعول للمركبة.",
  expires:"تاريخ الانتهاء",take:"التقاط أو رفع صورة",replace:"استبدال الصورة",uploading:"جارٍ الرفع…",uploaded:"تم الرفع",up_fail:"تعذّر رفع الصورة، جرّب صورة أصغر",
  st_missing:"لم تُرفع",st_pending:"قيد المراجعة",st_approved:"مقبولة",st_rejected:"مرفوضة",
  hello:"أهلًا،",online_l:"متاح لاستقبال الطلبات",
  b_missing:"أكمل رفع الوثائق لتبدأ العمل",b_pending:"وثائقك قيد المراجعة. سنخبرك عند القبول.",b_rejected:"رُفضت وثيقة، أعد رفعها من تبويب الوثائق",b_susp:"حسابك موقوف. تواصل مع الدعم.",b_ok:"حسابك مفعّل",go_docs:"الوثائق",
  dr_off:"غير متصل",dr_on:"بانتظار الطلبات…",dr_new:"طلب جديد",dr_del:"توصيل",it_food:"أكل",it_parcel:"طرد",bid_same:"اقبل بسعره",bid_counter:"اقترح",km:"كم",drv_wait:"بانتظار ردّ الطالب…",
  drv_ride:"رحلة جارية",nx_arrived:"وصلت",nx_in_progress:"ابدأ الرحلة",nx_completed:"أنهِ الرحلة",cash_due:"تحصيل نقدي معلّق",cash_method:"الدفع نقدًا",cash_pending:"بانتظار تأكيد استلام المبلغ",cash_confirm:"تأكيد استلام المبلغ",cash_done:"تم تأكيد استلام المبلغ",call_rider:"اتصل بالطالب",call_recv:"اتصل بالمستلم",offer_gone:"الطلب لم يعد متاحًا",loc_need:"فعّل خدمة الموقع لتستقبل الطلبات",no_online:"لا يمكنك الاتصال الآن",
  tab_home:"الرئيسية",tab_docs:"الوثائق",tab_acc:"حسابي",acc_h:"حسابي",logout:"تسجيل الخروج",delete:"حذف حسابي نهائيًا",del_ask:"سيُحذف حسابك ووثائقك نهائيًا. متابعة؟",not_driver:"هذا الرقم مسجّل كراكب. استخدم تطبيق الراكب.",
  k_phone:"الهاتف",k_veh:"المركبة",k_plate:"اللوحة",k_status:"حالة الوثائق",
  vc_appr:"معتمدة",vc_req:"طلب تغيير المركبة",vc_lock:"التغييرات تحتاج موافقة الإدارة. تبقى مركبتك الحالية فعّالة حتى ذلك الحين.",vc_free:"يُطبّق التغيير فورًا.",vc_submit:"إرسال",vc_close:"إغلاق",vc_pending:"بانتظار موافقة الإدارة",vc_rejected:"مرفوض",vc_cancel:"إلغاء الطلب",vc_keep:"إبقاء",vc_ask:"إلغاء الطلب؟",vc_edit:"تعديل الطلب",vc_sent:"أُرسل الطلب إلى الإدارة",vc_applied:"تم تحديث المركبة",vc_same:"لا يوجد تغيير",vc_cancelled:"أُلغي الطلب",vc_limit:"محاولات كثيرة، حاول لاحقًا",vc_title:"مركبتك",
  of_wait:"بانتظار اختيار الراكب",of_exp:"انتهى عرضك",of_dec:"اختار الراكب سائقًا آخر"},
 fr:{d_h:"Gagnez au juste prix",d_s:"Inscrivez-vous comme chauffeur ou livreur et envoyez vos documents une seule fois.",phone_l:"Numéro de téléphone",send_code:"Envoyer le code",otp_h:"Saisissez le code",otp_s:"Envoyé au",demo_code:"Code de démo :",verify:"Valider",
  invalid:"Numéro invalide",bad_code:"Code incorrect",too_many:"Trop d'essais, patientez",net:"Connexion impossible",otp_g:"Code de vérification",
  prof_h:"Vous et votre véhicule",prof_s:"Visible des clients quand vous proposez une offre.",name_l:"Prénom",veh_l:"Type de véhicule",veh_car:"Voiture",veh_moto:"Moto",model_l:"Modèle",plate_l:"Immatriculation",woman_l:"Je suis une conductrice (visible pour celles qui le demandent)",next:"Suivant",
  f_name:"Saisissez votre prénom",f_model:"Saisissez le modèle",f_plate:"Saisissez l'immatriculation",plate_taken:"Immatriculation déjà enregistrée",
  docs_h:"Documents",docs_s:"Chaque document est vérifié avant que vous commenciez. Photographiez-les nets et bien éclairés.",docs_priv:"Les photos sont stockées en sécurité, vues uniquement par l'équipe de vérification, et supprimées avec votre compte.",
  vehicle_photo:"Photo du véhicule",vehicle_photo_h:"Photo nette de face, plaque visible.",license:"Permis de conduire",license_h:"Recto du permis, en cours de validité.",
  registration:"Carte grise",registration_h:"Carte grise à votre nom ou avec autorisation.",insurance:"Assurance",insurance_h:"Attestation d'assurance en cours de validité.",
  expires:"Date d'expiration",take:"Prendre ou envoyer une photo",replace:"Remplacer la photo",uploading:"Envoi…",uploaded:"Envoyé",up_fail:"Échec de l'envoi, essayez une photo plus légère",
  st_missing:"Non envoyé",st_pending:"En vérification",st_approved:"Validé",st_rejected:"Refusé",
  hello:"Bonjour,",online_l:"Disponible pour les demandes",
  b_missing:"Envoyez tous vos documents pour commencer",b_pending:"Vos documents sont en vérification. Nous vous prévenons à la validation.",b_rejected:"Un document est refusé, renvoyez-le depuis l'onglet Documents",b_susp:"Compte suspendu. Contactez le support.",b_ok:"Compte activé",go_docs:"Documents",
  dr_off:"Hors ligne",dr_on:"En attente de demandes…",dr_new:"Nouvelle demande",dr_del:"Livraison",it_food:"Repas",it_parcel:"Colis",bid_same:"Accepter son prix",bid_counter:"Proposer",km:"km",drv_wait:"En attente du client…",
  drv_ride:"Course en cours",nx_arrived:"Arrivé",nx_in_progress:"Démarrer",nx_completed:"Terminer",cash_due:"Paiement en espèces à confirmer",cash_method:"Paiement en espèces",cash_pending:"En attente de confirmation de l’encaissement",cash_confirm:"Confirmer l’encaissement",cash_done:"Encaissement confirmé",call_rider:"Appeler le client",call_recv:"Appeler le destinataire",offer_gone:"Demande indisponible",loc_need:"Activez la localisation pour recevoir des demandes",no_online:"Connexion impossible pour le moment",
  tab_home:"Accueil",tab_docs:"Documents",tab_acc:"Mon compte",acc_h:"Mon compte",logout:"Se déconnecter",delete:"Supprimer mon compte",del_ask:"Votre compte et vos documents seront supprimés définitivement. Continuer ?",not_driver:"Ce numéro est inscrit comme passager. Utilisez l'application passager.",
  k_phone:"Téléphone",k_veh:"Véhicule",k_plate:"Plaque",k_status:"État des documents",
  vc_appr:"Validé",vc_req:"Demander un changement de véhicule",vc_lock:"Les changements nécessitent l'accord de l'administration. Votre véhicule actuel reste actif d'ici là.",vc_free:"Le changement s'applique immédiatement.",vc_submit:"Envoyer",vc_close:"Fermer",vc_pending:"En attente d'approbation",vc_rejected:"Refusé",vc_cancel:"Annuler la demande",vc_keep:"Garder",vc_ask:"Annuler la demande ?",vc_edit:"Modifier la demande",vc_sent:"Demande envoyée à l'administration",vc_applied:"Véhicule mis à jour",vc_same:"Aucun changement",vc_cancelled:"Demande annulée",vc_limit:"Trop d'essais, réessayez plus tard",vc_title:"Votre véhicule",
  of_wait:"En attente du choix du client",of_exp:"Votre offre a expiré",of_dec:"Le client a choisi un autre chauffeur"}
};
let L=(window.Kherja&&window.Kherja.lang)||'ar',ME=null,poll=null,sig='',locTimer=null,veh='car';
const t=k=>T[L][k]??k;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=async(m,p,b)=>{const r=await fetch(p,{method:m,headers:{'content-type':'application/json'},body:b?JSON.stringify(b):undefined,credentials:'same-origin'});let j={};try{j=await r.json()}catch{}if(!r.ok)throw Object.assign(new Error(j.error||r.status),{status:r.status});return j};
function applyI18n(){document.documentElement.lang=L;document.documentElement.dir=L==='ar'?'rtl':'ltr';
  $$('[data-i]').forEach(e=>{const v=t(e.dataset.i);if(typeof v==='string')e.textContent=v});$$('[data-aria]').forEach(e=>e.setAttribute('aria-label',t(e.dataset.aria)));
  $$('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.lang===L));if(ME)renderAll()}
function toast(m){const e=$('#toast');e.textContent=m;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),2600)}
function screen(id){$$('.screen').forEach(s=>s.classList.toggle('on',s.id===id));const tab=['s-home','s-docs','s-account'].includes(id);$('#app').classList.toggle('tabs',tab);
  $$('.tabbar button').forEach((b,i)=>{const on=('s-'+b.dataset.tab)===id;b.setAttribute('aria-current',on?'page':'false');if(on)$('.tabbar').style.setProperty('--i',i)})}
const stop=()=>{clearInterval(poll);poll=null;clearInterval(locTimer);locTimer=null};

/* auth */
/* profile */
$$('[data-veh]').forEach(b=>b.onclick=()=>{veh=b.dataset.veh;$$('[data-veh]').forEach(x=>x.setAttribute('aria-pressed',x===b))});
$('#save-prof').onclick=async()=>{const name=$('#name').value.trim(),model=$('#model').value.trim(),plate=$('#plate').value.trim(),e=$('#prof-err');
  if(!name)return e.textContent=t('f_name');if(!model)return e.textContent=t('f_model');if(!plate)return e.textContent=t('f_plate');e.textContent='';
  try{await api('POST','/api/driver/profile',{name,vehicle_type:veh,car:model,plate,is_woman:$('#woman').checked})}catch(x){e.textContent=x.status===409?t('plate_taken'):t('net');return}
  await boot('s-docs')};

/* documents */
const KINDS=['vehicle_photo','license','registration','insurance'];
function renderDocs(){const docs=Object.fromEntries(ME.docs.map(d=>[d.kind,d]));const n=KINDS.filter(k=>docs[k]).length;$('#docs-count').textContent=n;$('#docs-bar').style.width=(n*25)+'%';
  $('#docs-list').innerHTML='';
  KINDS.forEach(k=>{const d=docs[k],st=d?d.status:'missing';const card=document.createElement('div');card.className='card doc';
    card.innerHTML=`<div class="thumb">${d?`<img alt="${esc(t(k))}" src="/api/driver/docs/${d.id}/file?v=${d.id}">`:`<svg class="ic xl" aria-hidden="true"><use href="#i-${k==='vehicle_photo'?'camera':'file'}"/></svg>`}</div>
     <div><h3>${t(k)}</h3><p>${t(k+'_h')}</p><span class="st ${st}">${t('st_'+st)}</span>${d&&d.reason?`<p class="reason">${esc(d.reason)}</p>`:''}
     <div class="row">${k==='license'||k==='insurance'?`<label><span class="sr">${t('expires')}</span><input type="date" data-exp="${k}" value="${esc(d&&d.expires_on||'')}" aria-label="${t('expires')}"></label>`:''}
     <label class="btn ghost" style="cursor:pointer"><svg class="ic" aria-hidden="true"><use href="#i-camera"/></svg><span>${d?t('replace'):t('take')}</span><input class="sr" type="file" accept="image/*" capture="environment" data-kind="${k}" aria-label="${t(k)}"></label></div></div>`;
    $('#docs-list').appendChild(card)});
  $$('#docs-list input[type=file]').forEach(inp=>inp.onchange=()=>upload(inp))}
async function shrink(file){const bmp=await createImageBitmap(file);const k=Math.min(1,1280/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bmp.width*k));c.height=Math.max(1,Math.round(bmp.height*k));
  c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);let q=.82,blob;for(;;){blob=await new Promise(r=>c.toBlob(r,'image/jpeg',q));if(blob.size<1.4e6||q<.4)break;q-=.15}
  const buf=new Uint8Array(await blob.arrayBuffer());let bin='';for(let i=0;i<buf.length;i+=0x8000)bin+=String.fromCharCode.apply(null,buf.subarray(i,i+0x8000));return btoa(bin)}
async function upload(inp){const f=inp.files[0];if(!f)return;const kind=inp.dataset.kind;toast(t('uploading'));
  try{const exp=($(`[data-exp="${kind}"]`)||{}).value||undefined;await api('POST','/api/driver/docs',{kind,data:await shrink(f),expires_on:exp});toast(t('uploaded'));await refresh()}catch{toast(t('up_fail'))}}

/* home */
function banner(){const p=ME.profile,n=ME.docs.length;let cls='',txt='',btn=true;
  if(p.suspended){cls='bad';txt=t('b_susp');btn=false}else if(ME.can_go_online&&p.docs_status==='approved'){cls='ok';txt=t('b_ok');btn=false}
  else if(p.docs_status==='rejected'){cls='bad';txt=t('b_rejected')}else if(n<4){txt=t('b_missing')}else if(p.docs_status==='pending'&&!ME.can_go_online){txt=t('b_pending');btn=false}else{btn=false}
  $('#banner').innerHTML=txt?`<div class="banner ${cls}" role="status">${esc(txt)}${btn?`<button class="btn primary" id="b-docs">${t('go_docs')}</button>`:''}</div>`:'';const b=$('#b-docs');if(b)b.onclick=()=>go('docs')}
function renderHome(){$('#hello').textContent=t('hello')+' '+(ME.user.name||'');banner();const sw=$('#online');sw.disabled=!ME.can_go_online;sw.style.opacity=ME.can_go_online?1:.45;
  $('#dr-s').textContent=sw.getAttribute('aria-checked')==='true'?t('dr_on'):t('dr_off')}
function renderAccount(){const p=ME.profile;$('#acc-card').innerHTML=[['k_phone',`<span class="num">${esc(ME.user.phone)}</span>`],['k_veh',esc(p.car)+' · '+t(p.vehicle_type==='moto'?'veh_moto':'veh_car')],['k_plate',`<span class="num">${esc(p.plate)}</span>`],['k_status',t(ME.docs.length<4?'st_missing':'st_'+p.docs_status)]].map(([k,v])=>`<div class="kv"><span>${t(k)}</span><span>${v}</span></div>`).join('')}
let vcEdit=false;
function renderVehicle(){const p=ME.profile,c=ME.change_request,r=ME.last_rejection,ty=x=>t(x==='moto'?'veh_moto':'veh_car');
  let h=`<div class="vrow"><svg class="ic xl" aria-hidden="true"><use href="#i-${p.vehicle_type==='moto'?'moto':'car'}"/></svg><div><b>${esc(p.car)}</b><div class="sub"><span class="num">${esc(p.plate)}</span> · ${ty(p.vehicle_type)}</div></div><span class="st approved">${t('vc_appr')}</span></div>`;
  if(c)h+=`<div class="vpend" role="status"><span class="st pending">${t('vc_pending')}</span><p class="sub">${esc(c.car)} · ${ty(c.vehicle_type)} · <span class="num">${esc(c.plate)}</span></p><div class="vact" id="vact"><button class="btn ghost sm" id="vc-edit">${t('vc_edit')}</button><button class="btn ghost sm" id="vc-cancel">${t('vc_cancel')}</button></div></div>`;
  else{if(r)h+=`<div class="vpend" role="status"><span class="st rejected">${t('vc_rejected')}</span><p class="reason">${esc(r.reason||'')}</p></div>`;h+=`<div class="vact"><button class="btn ghost sm" id="vc-open">${t('vc_req')}</button></div>`}
  $('#veh-card').innerHTML=h;const o=$('#vc-open');if(o)o.onclick=()=>openSheet(false);const e=$('#vc-edit');if(e)e.onclick=()=>openSheet(true);
  const cb=$('#vc-cancel');if(cb)cb.onclick=()=>{$('#vact').innerHTML=`<span class="sub">${t('vc_ask')}</span><button class="btn danger sm" id="vc-yes">${t('vc_cancel')}</button><button class="btn ghost sm" id="vc-no">${t('vc_keep')}</button>`;
    $('#vc-no').onclick=renderVehicle;$('#vc-yes').onclick=async()=>{try{await api('POST','/api/driver/vehicle-change/cancel',{request_id:c.id});toast(t('vc_cancelled'))}catch(x){toast(x.status===429?t('vc_limit'):t('net'))}await refresh()}}}
const SHEET=()=>`<div class="vpanel"><h2 id="vtitle">${t('vc_title')}</h2>
  <div class="seg" role="group" aria-label="${t('veh_l')}"><button data-vveh="car" aria-pressed="true"><svg class="ic" aria-hidden="true"><use href="#i-car"/></svg><span>${t('veh_car')}</span></button><button data-vveh="moto" aria-pressed="false"><svg class="ic" aria-hidden="true"><use href="#i-moto"/></svg><span>${t('veh_moto')}</span></button></div>
  <label class="field"><span>${t('model_l')}</span><input class="input" id="vmodel" maxlength="60"></label>
  <label class="field"><span>${t('plate_l')}</span><input class="input num" id="vplate" maxlength="20" style="text-align:start"></label>
  <p class="sub" id="vnote" style="font-size:13px"></p><div class="err" id="verr" role="alert"></div>
  <div class="vact"><button class="btn primary sm" id="vsubmit">${t('vc_submit')}</button><button class="btn ghost sm" id="vclose">${t('vc_close')}</button></div></div>`;
let vcOpener=null;
function openSheet(edit){const p=ME.profile,c=edit?ME.change_request:null,src=c||p;vcOpener=document.activeElement;$('#vsheet').innerHTML=SHEET();veh=src.vehicle_type;
  $$('[data-vveh]').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.vveh===veh);b.onclick=()=>{veh=b.dataset.vveh;$$('[data-vveh]').forEach(x=>x.setAttribute('aria-pressed',x===b))}});
  $('#vmodel').value=src.car;$('#vplate').value=src.plate;$('#vnote').textContent=t(p.approval_required?'vc_lock':'vc_free');
  $('#vclose').onclick=closeSheet;$('#vsubmit').onclick=submitSheet;$('#vsheet').hidden=false;$('#vmodel').focus()}
function closeSheet(){$('#vsheet').hidden=true;$('#vsheet').innerHTML='';if(vcOpener&&vcOpener.isConnected)vcOpener.focus()}
$('#vsheet').onclick=e=>{if(e.target.id==='vsheet')closeSheet()};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#vsheet').hidden)closeSheet()});
async function submitSheet(){const car=$('#vmodel').value.trim(),plate=$('#vplate').value.trim(),e=$('#verr'),b=$('#vsubmit');if(!car)return e.textContent=t('f_model');if(!plate)return e.textContent=t('f_plate');e.textContent='';b.disabled=true;
  try{const r=await api('POST','/api/driver/profile',{vehicle_type:veh,car,plate});toast(t(r.change==='pending'?'vc_sent':r.change==='applied'?'vc_applied':'vc_same'));closeSheet();await refresh()}
  catch(x){e.textContent=x.status===409?t('plate_taken'):x.status===429?t('vc_limit'):t('net');b.disabled=false}}
function renderAll(){renderHome();renderDocs();renderAccount();renderVehicle()}
function go(tab){screen('s-'+tab)}
$$('.tabbar button').forEach(b=>b.onclick=()=>go(b.dataset.tab));
async function refresh(){ME=await api('GET','/api/driver/me');renderAll()}

let dskew=0;setInterval(()=>{$$('.of-st[data-exp]').forEach(e=>{const r=+e.dataset.exp-(Date.now()+dskew);const c=e.querySelector('.dcd');if(c)c.textContent=r>0?'00:'+String(Math.ceil(r/1000)).padStart(2,'0'):'';if(r<=0){e.textContent=t('of_exp');e.removeAttribute('data-exp')}})},250);
const NEXT={en_route:'arrived',arrived:'in_progress',in_progress:'completed'};
async function tick(){try{const on=$('#online').getAttribute('aria-checked')==='true';
  const [feed,act,mine,due]=await Promise.all([on?api('GET','/api/driver/requests'):Promise.resolve({requests:[]}),api('GET','/api/rides/active'),on?api('GET','/api/driver/offers'):Promise.resolve({offers:[],server_now:Date.now()}),api('GET','/api/driver/cash-due')]);const requests=feed.requests,ride=act.ride;
  dskew=mine.server_now-Date.now();const OF={};mine.offers.forEach(o=>{if(!OF[o.request_id])OF[o.request_id]=o});
  const s=JSON.stringify([requests.map(r=>[r.id,r.already_offered,r.price,OF[r.id]&&OF[r.id].status]),ride&&[ride.id,ride.status],due.rides.map(r=>[r.id,r.locked_price])]);if(s===sig)return;sig=s;const box=$('#dr-req');box.innerHTML='';
  if(ride){const nxt=NEXT[ride.status];const del=ride.kind==='delivery';
    box.innerHTML=`<div class="req"><div style="display:flex;justify-content:space-between;align-items:center"><b>${del?`<span class="tag">${t('dr_del')}</span>`:''}${t('drv_ride')}</b><span class="num" style="font-weight:800;font-size:22px">${ride.locked_price}</span></div>
     ${del?`<p class="sub" style="margin:6px 0 0">${t('it_'+ride.item_type)} · ${esc(ride.item_note)}</p>`:''}
     <p class="sub" style="margin:6px 0 0">${esc(ride.p_label)} → ${esc(ride.d_label)}</p>
     <div class="calls">${ride.contact?`<a class="btn ghost" href="tel:${esc(ride.contact.phone)}"><svg class="ic" aria-hidden="true"><use href="#i-phone"/></svg>${t('call_rider')} · <span class="num">${esc(ride.contact.phone)}</span></a>`:''}
     ${ride.recipient?`<a class="btn ghost" href="tel:${esc(ride.recipient.phone)}"><svg class="ic" aria-hidden="true"><use href="#i-phone"/></svg>${t('call_recv')} · ${esc(ride.recipient.name)}</a>`:''}</div>
     ${nxt?`<div class="row"><button class="btn primary" id="dr-next">${t('nx_'+nxt)}</button></div>`:''}</div>`;
    const nb=$('#dr-next');if(nb)nb.onclick=async()=>{try{await api('POST',`/api/rides/${ride.id}/status`,{status:nxt});sig='';tick()}catch{toast(t('net'))}};return}
  due.rides.forEach(r=>{const el=document.createElement('div');el.className='req';el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><b>${t('cash_due')}</b><span class="num" style="font-weight:800;font-size:22px">${r.locked_price} DZD</span></div><p class="sub" style="margin:6px 0 10px">${t('cash_pending')}</p><button class="btn primary" data-cash>${t('cash_confirm')}</button>`;el.querySelector('[data-cash]').onclick=async ev=>{const b=ev.currentTarget;b.disabled=true;try{await api('POST',`/api/rides/${r.id}/cash-collected`,{});toast(t('cash_done'));sig='';tick()}catch{b.disabled=false;toast(t('net'))}};box.appendChild(el)});
  requests.forEach(r=>{const el=document.createElement('div');el.className='req';const del=r.kind==='delivery';
    el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><b>${del?`<span class="tag">${t('dr_del')} · ${t('it_'+r.item_type)}</span>`:''}${t('dr_new')}</b><span class="num" style="font-weight:800;font-size:22px">${r.price}</span></div>
     ${del?`<p class="sub" style="margin:6px 0 0">${esc(r.item_note)}</p>`:''}<p class="sub" style="margin:6px 0 12px">${esc(r.p_label)} → ${esc(r.d_label)} · <span class="num">${r.dist_km}</span> ${t('km')}</p>`+
     (r.already_offered?(()=>{const o=OF[r.id],st=o?o.status:'pending';return `<p class="sub of-st ${st}" role="status" ${st==='pending'&&o?`data-exp="${o.expires_at}"`:''} style="margin:0">${st==='expired'?t('of_exp'):st==='declined'?t('of_dec'):`${t('of_wait')} <span class="num dcd"></span>`}</p>`})():`<div class="row" style="margin:0"><button class="btn ghost" data-c>${t('bid_counter')} <span class="num">${r.price+50}</span></button><button class="btn primary" data-a>${t('bid_same')}</button></div>`);
    const bid=p=>async()=>{try{await api('POST',`/api/requests/${r.id}/offers`,{price:p,eta_min:4});toast('✓');sig='';tick()}catch{toast(t('offer_gone'))}};
    const a=el.querySelector('[data-a]');if(a){a.onclick=bid(r.price);el.querySelector('[data-c]').onclick=bid(r.price+50)}box.appendChild(el)})}catch(e){if(e.status===401)location.reload()}}
/* Location goes through KJLoc (foreground only, runtime permission, explanation sheet). interactive=true only for the driver's own tap. */
async function position(interactive){const r=await KJLoc.ensure({role:'driver',interactive:interactive===true,high:true,timeout:8000,maxAge:15000});
  if(!r.ok)throw Object.assign(new Error('loc'),{reason:r.reason});return {lat:r.lat,lng:r.lng}}
/* Permission revoked or location lost while online: stop sharing, go offline on the server, tell the driver. Never keep a stale position live. */
function goOfflineNoLocation(){clearInterval(locTimer);locTimer=null;api('POST','/api/driver/online',{online:false}).catch(()=>{});
  const sw=$('#online');if(sw)sw.setAttribute('aria-checked','false');sig='';renderHome();toast(t('loc_need'))}
$('#online').onclick=async()=>{const sw=$('#online');if(sw.disabled)return;const on=sw.getAttribute('aria-checked')!=='true';
  try{if(on){let pos;try{pos=await position(true)}catch{toast(t('loc_need'));return}await api('POST','/api/driver/online',{online:true,...pos});
      clearInterval(locTimer);locTimer=setInterval(async()=>{try{await api('POST','/api/driver/online',{online:true,...await position(false)})}catch(e){if(e&&(e.reason==='denied'||e.reason==='unsupported'))goOfflineNoLocation()}},20000)}
    else{clearInterval(locTimer);locTimer=null;await api('POST','/api/driver/online',{online:false})}}catch{toast(t('no_online'));return}
  sw.setAttribute('aria-checked',on);sig='';renderHome();tick()};

/* account */
$('#logout').onclick=async()=>{stop();try{await api('POST','/api/auth/logout')}catch{}location.reload()};
$('#delete').onclick=async()=>{if(!confirm(t('del_ask')))return;stop();try{await api('DELETE','/api/me')}catch{}location.reload()};

/* start */
async function boot(to){try{ME=await api('GET','/api/driver/me')}catch(e){if(e.status===401){location.reload();return}Kherja.notice(e.status===403?'wrong_role':'net');return}
  if(!ME.profile){screen('s-profile');return}
  renderAll();stop();sig='';poll=setInterval(tick,1500);tick();
  const sw=$('#online');sw.setAttribute('aria-checked','false');go(to?to.replace('s-',''):(ME.docs.length<4?'docs':'home'))}
applyI18n();boot();
