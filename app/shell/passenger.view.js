const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const T={
 ar:{brand_h:"طريقك، بسعرك",brand_s:"اقترح سعر رحلتك واختر السائق الذي يناسبك.",continue:"متابعة",
  phone_h:"رقم هاتفك",phone_s:"سنرسل لك رمز التحقق.",phone_l:"رقم الهاتف",send_code:"إرسال الرمز",
  otp_h:"أدخل الرمز",otp_s:"أرسلناه إلى",demo_code:"رمز التجربة:",verify:"تأكيد",
  prof_h:"عرّفنا بنفسك",prof_s:"الاسم يظهر للسائق.",name_l:"الاسم",city_l:"المدينة",start:"ابدأ",
  online_l:"متصل بالطلبات",my_location:"موقعي",call_l:"اتصال بالسائق",share_l:"مشاركة الرحلة",otp_g:"رمز التحقق",hello:"إلى أين نذهب؟",from_val:"موقعك الحالي · باب الزوار",to_val:"المطار الدولي هواري بومدين",set_price:"حدّد سعرك",
  your_fare:"سعرك",dzd:"د.ج",recommended:"السعر المقترح",fare_context:"تخفيض نهاري: السيارة 5% والدراجة 10% · زيادة الليل 15% والذروة 10% (تقديرية)",low_warn:"سعرك أقل بكثير من المقترح، قد لا يقبله السائقون.",
  note_l:"ملاحظة",note_ph:"ملاحظة للسائق (مثال: عند المدخل الرئيسي)",cash:"نقدًا",women_pref:"سائقة فقط",back:"رجوع",find_driver:"ابحث عن سائق",
  searching:"نبحث عن سائقين قريبين…",cancel:"إلغاء",offers_h:"العروض",offer_expired:"انتهى العرض",no_offers:"لا عروض الآن، بانتظار السائقين…",veh_group:"نوع المركبة",accept:"قبول",decline:"رفض",accepts_price:"يقبل سعرك",
  eta:"دقائق",cancels:"إلغاء",rides:"رحلة",locked:"السعر مثبّت:",st_en:"السائق في الطريق إليك",st_ar:"السائق وصل",st_in:"أنت في الرحلة",
  sim_next:"التالي",done_h:"وصلت بسلامة",pay_cash:"ادفع نقدًا للسائق",submit:"إرسال التقييم",rate:"قيّم رحلتك",
  tags:["سائق محترم","سيارة نظيفة","قيادة آمنة","التزم بالسعر"],sos:"طوارئ",share_ok:"تم نسخ رابط الرحلة",sos_ok:"تم إخطار جهات الاتصال الموثوقة",
  mode_d:"وضع السائق",mode_r:"وضع الراكب",dr_h:"أنت متصل",dr_off:"غير متصل",dr_on:"بانتظار الطلبات…",dr_new:"طلب جديد",
  bid_same:"اقبل بسعره",bid_counter:"اقترح",km:"كم",thanks:"شكرًا لتقييمك",cancelled:"أُلغي الطلب",invalid:"رقم غير صحيح",bad_code:"الرمز غير صحيح",
  recents:["البيت","العمل","محطة القطار","الجامعة"],good:"أضفناها للتقييم",
  choose_car:"سيارة",car_desc:"رحلة مريحة",choose_moto:"دراجة نارية",moto_desc:"أسرع داخل المدينة",
  names:["كريم","ياسين","سامي"],cars:["رونو سامبول","داسيا لوغان","هيونداي أكسنت"]},
 fr:{brand_h:"Votre route, votre prix",brand_s:"Proposez votre tarif et choisissez le chauffeur qui vous convient.",continue:"Continuer",
  phone_h:"Votre numéro",phone_s:"Nous vous envoyons un code de vérification.",phone_l:"Numéro de téléphone",send_code:"Envoyer le code",
  otp_h:"Saisissez le code",otp_s:"Envoyé au",demo_code:"Code de démo :",verify:"Valider",
  prof_h:"Faisons connaissance",prof_s:"Le prénom est visible du chauffeur.",name_l:"Prénom",city_l:"Ville",start:"Commencer",
  online_l:"En ligne",my_location:"Ma position",call_l:"Appeler le chauffeur",share_l:"Partager le trajet",otp_g:"Code de vérification",hello:"Où allons-nous ?",from_val:"Votre position · Bab Ezzouar",to_val:"Aéroport Houari Boumediene",set_price:"Fixer mon prix",
  your_fare:"Votre prix",dzd:"DA",recommended:"Prix conseillé",fare_context:"Promo jour : voiture −5 %, moto −10 % · nuit +15 %, heures de pointe +10 % (estimé)",low_warn:"Votre prix est bien en dessous du conseillé, les chauffeurs risquent de refuser.",
  note_l:"Note",note_ph:"Note au chauffeur (ex. entrée principale)",cash:"Espèces",women_pref:"Chauffeuse uniquement",back:"Retour",find_driver:"Trouver un chauffeur",
  searching:"Recherche de chauffeurs proches…",cancel:"Annuler",offers_h:"Offres",offer_expired:"Offre expirée",no_offers:"Aucune offre pour le moment…",veh_group:"Type de véhicule",accept:"Accepter",decline:"Refuser",accepts_price:"Accepte votre prix",
  eta:"min",cancels:"annul.",rides:"courses",locked:"Prix verrouillé :",st_en:"Le chauffeur arrive",st_ar:"Le chauffeur est arrivé",st_in:"Course en cours",
  sim_next:"Suivant",done_h:"Vous êtes arrivé",pay_cash:"Payez le chauffeur en espèces",submit:"Envoyer la note",rate:"Notez votre course",
  tags:["Chauffeur respectueux","Voiture propre","Conduite sûre","Prix respecté"],sos:"SOS",share_ok:"Lien de trajet copié",sos_ok:"Vos contacts de confiance sont prévenus",
  mode_d:"Mode chauffeur",mode_r:"Mode passager",dr_h:"Vous êtes en ligne",dr_off:"Hors ligne",dr_on:"En attente de demandes…",dr_new:"Nouvelle demande",
  bid_same:"Accepter son prix",bid_counter:"Proposer",km:"km",thanks:"Merci pour votre avis",cancelled:"Demande annulée",invalid:"Numéro invalide",bad_code:"Code incorrect",
  recents:["Maison","Travail","Gare","Université"],good:"",
  choose_car:"Voiture",car_desc:"Trajet confortable",choose_moto:"Moto",moto_desc:"Plus rapide en ville",
  names:["Karim","Yacine","Sami"],cars:["Renault Symbol","Dacia Logan","Hyundai Accent"]}
};
let L=(window.Kherja&&window.Kherja.lang)||"ar",S={price:450,stars:0,tags:new Set(),offer:null,timers:[],vehicleType:"car"};
const t=k=>T[L][k];
function applyI18n(){
  document.documentElement.lang=L;document.documentElement.dir=L==="ar"?"rtl":"ltr";
  $$("[data-i]").forEach(e=>{const v=t(e.dataset.i);if(typeof v==="string")e.textContent=v});
  $$("[data-ph]").forEach(e=>e.placeholder=t(e.dataset.ph));
  $$("[data-aria]").forEach(e=>e.setAttribute("aria-label",t(e.dataset.aria)));
  $("#hello").textContent=t("hello");
  $("#recents").innerHTML=t("recents").map(r=>`<button>${r}</button>`).join("");
  $("#tags").innerHTML=t("tags").map((x,i)=>`<button aria-pressed="false" data-t="${i}">${x}</button>`).join("");
  $$("#tags button").forEach(b=>b.onclick=()=>{const on=b.getAttribute("aria-pressed")!=="true";b.setAttribute("aria-pressed",on)});
  drawStars();
}
let state="lang";
function screen(id){$$(".screen").forEach(s=>s.classList.toggle("on",s.id===id))}
function sheet(id){
  $$(".sheet").forEach(s=>s.classList.toggle("on",s.id===id));
  $("#sos").hidden=!["sh-way","sh-done"].includes(id);
}
function toast(m){const e=$("#toast");e.textContent=m;e.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove("on"),2400)}
function later(fn,ms){const id=setTimeout(fn,ms);S.timers.push(id);return id}
function clear(){S.timers.forEach(clearTimeout);S.timers=[]}

/* map: original stylised SVG, no third-party tiles */
function drawMap(){
  const roads=[];
  for(let i=0;i<9;i++){roads.push(`<path d="M${-20+i*55} -20 L${40+i*50} 900" stroke="var(--road)" stroke-width="${i%3?7:14}" fill="none"/>`)}
  for(let i=0;i<10;i++){roads.push(`<path d="M-20 ${i*95} Q200 ${i*95+30} 450 ${i*95-20}" stroke="var(--road)" stroke-width="${i%4?7:14}" fill="none"/>`)}
  $("#map").innerHTML=`<svg viewBox="0 0 430 880" preserveAspectRatio="xMidYMid slice">
   <defs><radialGradient id="g1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></radialGradient><radialGradient id="g2"><stop offset="0" stop-color="var(--price)" stop-opacity=".30"/><stop offset="1" stop-color="var(--price)" stop-opacity="0"/></radialGradient></defs><rect width="430" height="880" fill="var(--map1)"/><circle cx="120" cy="720" r="200" fill="url(#g1)"/><circle cx="360" cy="780" r="170" fill="url(#g2)"/>
   <path d="M0 640 C120 600 200 700 430 650 L430 880 L0 880Z" fill="var(--water)"/>
   <rect x="250" y="120" width="130" height="90" rx="26" fill="var(--park)"/><rect x="30" y="300" width="100" height="80" rx="24" fill="var(--park)"/>
   ${roads.join("")}
   <path id="route" d="M110 520 C140 430 230 440 250 360 S330 240 330 170" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" fill="none" stroke-dasharray="1 0"/>
   <g transform="translate(110 520)"><circle r="18" fill="var(--accent)" opacity=".2"/><circle r="9" fill="var(--accent)" stroke="#fff" stroke-width="3"/></g>
   <g transform="translate(330 170)"><rect x="-10" y="-10" width="20" height="20" rx="5" fill="var(--price)" stroke="#fff" stroke-width="3"/></g>
   <g id="car" style="transition:none" transform="translate(40 700)"><circle r="16" fill="var(--text)"/><path d="M-7 3l7-12 7 12-7-3z" fill="var(--bg)"/></g></svg>`;
  initLeafletMap();
}
let leafletMap=null,leafletUserMarker=null,routeLayer=null,pickupMarker=null,dropoffMarker=null,routePoints=null,mapPickNext='pickup',routeDistanceKm=null,fareTouched=false;
function fareFactors(date=new Date()){
 const h=date.getHours(),night=(h>=22||h<6),peak=((h>=7&&h<10)||(h>=16&&h<20));
 // Affordable, capped demand adjustment: night +15%, rush hour +10%; never compound beyond 1.30.
 let multiplier=1;if(night)multiplier+=.15;if(peak)multiplier+=.10;multiplier=Math.min(multiplier,1.30);
 // Introductory vehicle promotions during ordinary hours.
 const promo=!night&&!peak?(S.vehicleType==='moto'?.10:.05):0;
 return {night,peak,multiplier,promo};
}
function suggestedFare(){const km=routeDistanceKm,f=fareFactors();if(!Number.isFinite(km)||km<=0)return S.vehicleType==='moto'?350:450;
 const base=S.vehicleType==='moto'?200:250,rate=S.vehicleType==='moto'?20:60;
 const raw=base+km*rate;return Math.max(350,Math.round((raw*f.multiplier*(1-f.promo))/50)*50);
}
let quoteSeq=0;
async function updateSuggestedFare(){const seq=++quoteSeq;let rec=suggestedFare();if(routePoints?.pickup&&routePoints?.dropoff&&location.protocol.startsWith('http')){try{const q=await api('POST','/api/fare/quote',{pickup:routePoints.pickup,dropoff:routePoints.dropoff,vehicle_type:S.vehicleType});if(seq!==quoteSeq)return;rec=q.suggested_fare_dzd;}catch(err){console.warn('Server fare quote unavailable; using local fallback',err);}}if(seq!==quoteSeq)return;const node=$('#recommended-price');if(node)node.textContent=rec;const info=$('#fare-context');if(info){const f=fareFactors();info.textContent=f.night?(L==='ar'?'زيادة ليلية +15%':'Majoration nuit +15%'):f.peak?(L==='ar'?'زيادة ذروة +10% (تقديرية)':'Pointe +10% (estimée)'):(L==='ar'?(S.vehicleType==='moto'?'عرض الدراجة النهاري −10%':'عرض السيارة النهاري −5%'):(S.vehicleType==='moto'?'Promo moto jour −10%':'Promo voiture jour −5%'));}if(!fareTouched){S.price=rec;upd();}}
function initLeafletMap(){
  const host=$('#map');if(!host||!window.L||typeof window.L.map!=='function')return;const LF=window.L;
  try{host.replaceChildren();leafletMap=LF.map(host,{zoomControl:false,scrollWheelZoom:true}).setView([36.7538,3.0588],13);
    LF.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(leafletMap);
    LF.control.zoom({position:'bottomright'}).addTo(leafletMap);
    leafletUserMarker=LF.circleMarker([36.7538,3.0588],{radius:8,color:'#fff',weight:3,fillColor:'#075BFF',fillOpacity:1}).addTo(leafletMap);
    leafletMap.on('click',async e=>{const key=mapPickNext;mapPickNext=key==='pickup'?'dropoff':'pickup';if(!routePoints)routePoints={};routePoints[key]={lat:e.latlng.lat,lng:e.latlng.lng,label:`${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`};const marker=key==='pickup'?pickupMarker:dropoffMarker;if(marker)leafletMap.removeLayer(marker);const fresh=LF.marker(e.latlng).addTo(leafletMap).bindPopup(key==='pickup'?'نقطة الانطلاق':'نقطة الوصول');if(key==='pickup')pickupMarker=fresh;else dropoffMarker=fresh;try{const label=await reverseGeocode(e.latlng.lat,e.latlng.lng);routePoints[key].label=label;$('#map-'+(key==='pickup'?'from':'to')).value=label;}catch{}if(routePoints.pickup&&routePoints.dropoff)drawRoute(routePoints.pickup,routePoints.dropoff);});
    setTimeout(()=>leafletMap.invalidateSize(),100);
  }catch(err){console.warn('Leaflet map initialization failed; keeping local fallback.',err)}
}
async function geocodeAddress(q){const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(q);const r=await fetch(url,{headers:{'Accept-Language':L==='ar'?'ar':'fr'}});if(!r.ok)throw new Error('search unavailable');const a=await r.json();if(!a.length)throw new Error('not found');return {lat:Number(a[0].lat),lng:Number(a[0].lon),label:a[0].display_name};}
async function reverseGeocode(lat,lng){const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,{headers:{'Accept-Language':L==='ar'?'ar':'fr'}});if(!r.ok)throw new Error('reverse unavailable');const a=await r.json();return a.display_name||`${lat.toFixed(5)}, ${lng.toFixed(5)}`;}
async function drawRoute(a,b){try{const r=await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`);if(!r.ok)throw new Error('route unavailable');const data=await r.json();if(!data.routes?.length)throw new Error('route not found');const route=data.routes[0];if(routeLayer)leafletMap.removeLayer(routeLayer);routeLayer=window.L.geoJSON(route.geometry,{style:{color:'#075BFF',weight:6,opacity:.85}}).addTo(leafletMap);leafletMap.fitBounds(routeLayer.getBounds(),{padding:[60,60]});routeDistanceKm=route.distance/1000;$('#map-route-info').textContent=`${routeDistanceKm.toFixed(1)} km · ${Math.round(route.duration/60)} min`;updateSuggestedFare();return route;}catch(e){$('#map-route-info').textContent=L==='ar'?'تعذر حساب المسار حالياً':'Route indisponible';throw e;}}
$('#map-route').onclick=async()=>{const from=$('#map-from').value.trim(),to=$('#map-to').value.trim();if(!from||!to){$('#map-route-info').textContent=L==='ar'?'أدخل نقطة الانطلاق والوصول':'Saisissez départ et destination';return;}const btn=$('#map-route');btn.disabled=true;$('#map-route-info').textContent=L==='ar'?'جاري البحث…':'Recherche…';try{const a=await geocodeAddress(from);await new Promise(r=>setTimeout(r,1100));const b=await geocodeAddress(to);routePoints={pickup:a,dropoff:b};mapPickNext='pickup';if(pickupMarker)leafletMap.removeLayer(pickupMarker);if(dropoffMarker)leafletMap.removeLayer(dropoffMarker);pickupMarker=window.L.marker([a.lat,a.lng]).addTo(leafletMap).bindPopup(a.label);dropoffMarker=window.L.marker([b.lat,b.lng]).addTo(leafletMap).bindPopup(b.label);await drawRoute(a,b);}catch(e){$('#map-route-info').textContent=L==='ar'?'لم نجد العنوان أو الخدمة غير متاحة':'Adresse introuvable / service indisponible';}finally{btn.disabled=false;}};
let locBusy=false;
function applyPickupFix(p,label){ // the detected device position becomes the real pickup point of the ride request
  if(!routePoints)routePoints={};
  routePoints.pickup={lat:p.lat,lng:p.lng,label};
  const f=$('#map-from');if(f)f.value=label;
  if(leafletMap){leafletMap.setView([p.lat,p.lng],16);if(leafletUserMarker)leafletUserMarker.setLatLng([p.lat,p.lng]);}
  updateSuggestedFare();
}
async function locatePassenger(auto){ // auto=true: silent start-up attempt (never shows the denied sheet, never re-prompts)
  if(locBusy)return;locBusy=true;const b=$('#my-location');if(b)b.setAttribute('aria-busy','true');
  try{
    const r=await KJLoc.ensure({role:'rider',interactive:auto!==true,high:true,timeout:12000});
    if(r.ok){applyPickupFix(r,KJLoc.text('here'));toast(r.approx?KJLoc.text('approx'):KJLoc.text('ok'))}
    else if(auto!==true){const f=$('#kj-area')||$('#map-from');if(f)f.focus()} // not granted: manual pickup stays fully available
  }finally{locBusy=false;if(b)b.removeAttribute('aria-busy')}
}
$('#my-location').onclick=()=>locatePassenger(false);
let carRaf;
function moveCar(from,to,ms,done){ // car follows route from t=from..to (0..1); along route, approach from outside
  const route=$("#route"),len=route.getTotalLength(),car=$("#car");cancelAnimationFrame(carRaf);
  const start=performance.now(),p0=from;
  const approach=(from<0);
  (function tick(now){
    let k=Math.min(1,(now-start)/ms);k=1-Math.pow(1-k,2.2);
    let x,y;
    if(approach){const a=route.getPointAtLength(0);x=40+(a.x-40)*k;y=700+(a.y-700)*k}
    else{const p=route.getPointAtLength(len*(from+(to-from)*k));x=p.x;y=p.y}
    car.setAttribute("transform",`translate(${x} ${y})`);
    if(k<1)carRaf=requestAnimationFrame(tick);else done&&done();
  })(start);
}

/* sheet drag: direct manipulation, spring-ish settle, never trapped */
function dragify(el){
  let y0=0,dy=0,drag=false,v=0,last=0,lt=0;
  el.addEventListener("pointerdown",e=>{if(e.target.closest("button,input,select,label,.offers"))return;drag=true;y0=e.clientY;last=y0;lt=e.timeStamp;el.setPointerCapture(e.pointerId);el.style.transition="none"});
  el.addEventListener("pointermove",e=>{if(!drag)return;dy=e.clientY-y0;const r=dy<0?-Math.sqrt(-dy)*3:dy; v=(e.clientY-last)/(e.timeStamp-lt||1);last=e.clientY;lt=e.timeStamp;el.style.transform=`translateY(${r}px)`});
  const end=()=>{if(!drag)return;drag=false;const proj=dy+v*180;el.style.transition="";el.style.transform=proj>120?"translateY(calc(100% - 96px))":"";if(proj<=120)el.style.transform=""; dy=0};
  el.addEventListener("pointerup",end);el.addEventListener("pointercancel",end);
}
$$(".sheet").forEach(dragify);

/* flow */
$$("[data-lang]").forEach(b=>b.onclick=()=>{L=b.dataset.lang;$$("[data-lang]").forEach(x=>{const on=x===b;x.setAttribute("aria-pressed",on);x.lastElementChild.textContent=on?"✓":""});applyI18n()});
$("#finish").onclick=()=>{S.name=$("#name").value.trim()||"—";$("#hello").textContent=t("hello");state="rider";screen("s-map");drawMap();sheet("sh-home")};
$("#to-request").onclick=()=>{sheet("sh-request");upd()};
$("#back-home").onclick=()=>sheet("sh-home");
function upd(){$("#pval").textContent=S.price;$("#lowwarn").hidden=S.price>=315}
$("#minus").onclick=()=>{S.price=Math.max(100,S.price-50);upd()};$("#plus").onclick=()=>{S.price+=50;upd()};
$("#order").onclick=()=>{clear();$("#wprice").textContent=S.price;sheet("sh-wait");later(showOffers,2200)};
$("#cancel-wait").onclick=()=>{clear();sheet("sh-home");toast(t("cancelled"))};

const ICS='<svg class="ic sm" aria-hidden="true"><use href="#i-star"/></svg>';
const COLORS=["#FFD2B0","#9BE5D2","#FDE3A7"];
function showOffers(){
  sheet("sh-offers");$("#offers").innerHTML="";$("#ocount").textContent=0;let n=0;
  const data=[{p:S.price,eta:3,r:4.9,c:2,rides:1240},{p:S.price+50,eta:5,r:4.8,c:5,rides:870},{p:Math.max(100,S.price-0),eta:7,r:4.7,c:8,rides:410}];
  data.forEach((d,i)=>later(()=>{
    const same=d.p<=S.price;
    const el=document.createElement("div");el.className="offer";
    el.innerHTML=`<div class="av" style="background:${COLORS[i]}">${t("names")[i][0]}</div>
     <div><div class="nm">${t("names")[i]}</div><div class="meta"><span class="star">${ICS} <span class="num">${d.r}</span></span><span>${t("cars")[i]}</span><span><span class="num">${d.eta}</span> ${t("eta")}</span><span><span class="num">${d.c}%</span> ${t("cancels")}</span></div></div>
     <div class="pr"><b class="num">${d.p}</b>${same?`<span class="ok">${t("accepts_price")}</span>`:""}</div>
     <div class="timer"><i style="width:100%"></i></div>
     <div class="acts"><button class="btn ghost" data-x>${t("decline")}</button><button class="btn primary" data-ok>${t("accept")}</button></div>`;
    el.querySelector("[data-x]").onclick=()=>{el.remove();$("#ocount").textContent=--n};
    el.querySelector("[data-ok]").onclick=()=>pick(i,d);
    $("#offers").appendChild(el);$("#ocount").textContent=++n;
  },i*1400));
}
function pick(i,d){
  clear();S.offer={i,d};
  $("#d-av").textContent=t("names")[i][0];$("#d-av").style.background=COLORS[i];$("#d-name").textContent=t("names")[i];
  $("#d-car").textContent=t("cars")[i];$("#d-plate").textContent=`0${i+4}${i+7}21-${116+i} 16`;$("#d-rate").textContent=d.r;$("#d-price").textContent=d.p;
  S.step=0;way();sheet("sh-way");moveCar(-1,0,7000,()=>{});
  later(()=>{if(S.step===0)adv()},8000);
}
function way(){$("#sh-way").dataset.step=S.step;$("#way-status").textContent=[t("st_en"),t("st_ar"),t("st_in")][S.step];$("#cancel-ride").hidden=S.step>0}
function adv(){
  S.step++;
  if(S.step>2){finish();return}
  way();if(S.step===2)moveCar(0,1,8000,finish);
}
function finish(){cancelAnimationFrame(carRaf);$("#f-price").textContent=S.offer.d.p;if(!$("#sh-done").classList.contains("on")){S.stars=0;drawStars()}sheet("sh-done")}
$("#sim-next").onclick=()=>{if(S.step===2){moveCar(1,1,1,()=>{});finish()}else adv()};
$("#cancel-ride").onclick=()=>{clear();cancelAnimationFrame(carRaf);sheet("sh-home");toast(t("cancelled"))};
$("#call").onclick=()=>toast("+213 …");
$("#share").onclick=()=>toast(t("share_ok"));
$("#sos").onclick=()=>toast(t("sos_ok"));
function drawStars(){
  $("#stars").innerHTML=[1,2,3,4,5].map(n=>`<button role="radio" aria-checked="${S.stars===n}" aria-label="${n}" class="${n<=S.stars?"on":""}" data-n="${n}"><svg class="ic xl" aria-hidden="true"><use href="#i-star"/></svg></button>`).join("");
  $$("#stars button").forEach(b=>b.onclick=()=>{S.stars=+b.dataset.n;drawStars()});
}
$("#submit-rate").onclick=()=>{toast(t("thanks"));S.price=450;upd();sheet("sh-home")};

applyI18n();
;
/* Delivery: same negotiation as rides, plus item, addresses and recipient. */
Object.assign(T.ar,{k_ride:"رحلة",k_del:"توصيل",kind_g:"نوع الطلب",item_g:"نوع الطلب المراد توصيله",it_food:"أكل",it_parcel:"طرد",
 hello_d:"ماذا نوصّل؟",set_price_d:"حدّد سعر التوصيل",fare_d:"سعر التوصيل",find_d:"ابحث عن موصّل",dl_note_l:"وصف الطلب",dl_note_ph:"مثال: بيتزا وعصير، أو كيس ملابس",
 dl_from_l:"عنوان الاستلام",dl_from_ph:"المطعم أو المحل أو الشخص",dl_to_l:"عنوان التسليم",dl_to_ph:"عنوانك أو عنوان المستلم",dl_rn_l:"اسم المستلم",dl_rp_l:"هاتف المستلم",
 dl_rules:"ممنوع توصيل المواد الممنوعة قانونًا، والأسلحة، والأموال النقدية. الموصّل يتصل بالمستلم عند وصوله.",dl_need:"اكتب وصف الطلب",
 st_en_d:"الموصّل في طريقه لاستلام الطلب",st_ar_d:"الموصّل وصل لاستلام الطلب",st_in_d:"طلبك في الطريق إليك",done_d:"تم التسليم",
 dl_after:"سيصل الموصّل إلى عنوانك ويتصل بك.",dl_badge:"توصيل",dl_food:"أكل",dl_parcel:"طرد",call_rider:"اتصل بالطالب",call_recv:"اتصل بالمستلم",
 nxd:{arrived:"وصلت للاستلام",in_progress:"استلمت الطلب",completed:"تم التسليم"},dl_ride_d:"توصيل جارٍ",no_phone:"الرقم يظهر بعد قبول العرض"});
Object.assign(T.fr,{k_ride:"Course",k_del:"Livraison",kind_g:"Type de demande",item_g:"Type de colis",it_food:"Repas",it_parcel:"Colis",
 hello_d:"Que livrer ?",set_price_d:"Fixer le prix de livraison",fare_d:"Prix de livraison",find_d:"Trouver un livreur",dl_note_l:"Description",dl_note_ph:"Ex. pizza et jus, ou sac de vêtements",
 dl_from_l:"Adresse de retrait",dl_from_ph:"Restaurant, magasin ou personne",dl_to_l:"Adresse de livraison",dl_to_ph:"Votre adresse ou celle du destinataire",dl_rn_l:"Nom du destinataire",dl_rp_l:"Téléphone du destinataire",
 dl_rules:"Interdit : produits illégaux, armes, argent liquide. Le livreur appelle le destinataire à son arrivée.",dl_need:"Décrivez la commande",
 st_en_d:"Le livreur va récupérer la commande",st_ar_d:"Le livreur est arrivé au retrait",st_in_d:"Votre commande est en route",done_d:"Livré",
 dl_after:"Le livreur viendra à votre adresse et vous appellera.",dl_badge:"Livraison",dl_food:"Repas",dl_parcel:"Colis",call_rider:"Appeler le client",call_recv:"Appeler le destinataire",
 nxd:{arrived:"Arrivé au retrait",in_progress:"Commande récupérée",completed:"Livré"},dl_ride_d:"Livraison en cours",no_phone:"Le numéro s'affiche après acceptation"});
S.kind='ride';S.item='food';S.contactPhone=null;
function applyKind(){const d=S.kind==='delivery';
  $$('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.kind===S.kind));
  $('#vehicle-choice').hidden=d;
  $('#hello').textContent=t(d?'hello_d':'hello');$('#to-request').textContent=t(d?'set_price_d':'set_price');
  $('#sh-request h2').textContent=t(d?'fare_d':'your_fare');$('#order').textContent=t(d?'find_d':'find_driver');
  $('#dl').hidden=!d;$('#women').closest('label').hidden=d;
  $$('[data-item]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.item===S.item));}
$$('[data-kind]').forEach(b=>b.onclick=()=>{S.kind=b.dataset.kind;applyKind()});
$$('[data-ride-vehicle]').forEach(b=>b.onclick=()=>{S.vehicleType=b.dataset.rideVehicle;fareTouched=false;$$('[data-ride-vehicle]').forEach(x=>{const on=x===b;x.setAttribute('aria-pressed',String(on));x.classList.toggle('selected',on)});updateSuggestedFare()});
$$('[data-item]').forEach(b=>b.onclick=()=>{S.item=b.dataset.item;applyKind()});
{const _ai=applyI18n;applyI18n=function(){_ai();applyKind()}}
$('#order').addEventListener('click',e=>{ if(S.kind!=='delivery')return;
  if(!$('#dl-note').value.trim()){e.stopImmediatePropagation();$('#dl-err').textContent=t('dl_need');$('#dl-note').focus();return}
  $('#dl-err').textContent='';const it=t(S.item==='food'?'it_food':'it_parcel');
  S.summary=it+': '+$('#dl-note').value.trim()+' · '+($('#dl-to').value.trim()||'');},true);
{const _w=way;way=function(){const d=S.kind==='delivery';$('#way-status').textContent=[t(d?'st_en_d':'st_en'),t(d?'st_ar_d':'st_ar'),t(d?'st_in_d':'st_in')][S.step];$('#cancel-ride').hidden=S.step>0;
  $('#dl-info').hidden=!d;if(d)$('#dl-info-t').textContent=(S.summary||'')+' — '+t('dl_after');
  const ph=$('#d-phone');ph.hidden=!S.contactPhone;if(S.contactPhone){ph.textContent=S.contactPhone;ph.href='tel:'+S.contactPhone}}}
{const _f=finish;finish=function(){_f();$('#sh-done h2').textContent=t(S.kind==='delivery'?'done_d':'done_h')}}
$('#call').onclick=()=>{S.contactPhone?(location.href='tel:'+S.contactPhone):toast(t('no_phone'))};
applyI18n();
;
/* API mode: when served over http by backend/server.js. Opened as a file it stays a demo with fake data. */
const API=location.protocol.startsWith('http');
if(API){
Object.assign(T.ar,{logout:"تسجيل الخروج",lo_fail:"تعذّر تسجيل الخروج، حاول مرة أخرى",too_many:"محاولات كثيرة، انتظر قليلًا",open_exists:"عندك طلب مفتوح",req_fail:"تعذّر إرسال الطلب",offer_gone:"العرض لم يعد متاحًا",dev_only:"وضع السائق للتجربة فقط",
  drv_wait:"بانتظار ردّ الراكب…",nx:{arrived:"وصلت",in_progress:"ابدأ الرحلة",completed:"أنهِ الرحلة"},drv_ride:"رحلة جارية",cancelled_r:"أُلغيت الرحلة",net:"تعذّر الاتصال"});
Object.assign(T.fr,{logout:"Se déconnecter",lo_fail:"Déconnexion impossible, réessayez",too_many:"Trop d'essais, patientez",open_exists:"Une demande est déjà ouverte",req_fail:"Envoi impossible",offer_gone:"Offre indisponible",dev_only:"Mode chauffeur : démo uniquement",
  drv_wait:"En attente du passager…",nx:{arrived:"Arrivé",in_progress:"Démarrer",completed:"Terminer"},drv_ride:"Course en cours",cancelled_r:"Course annulée",net:"Connexion impossible"});
const api=async(m,p,b)=>{const r=await fetch(p,{method:m,headers:{'content-type':'application/json'},body:b?JSON.stringify(b):undefined,credentials:'same-origin'});
  let j={};try{j=await r.json()}catch{} if(!r.ok)throw Object.assign(new Error(j.error||r.status),{status:r.status}); return j};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let phoneN='',poll=null,reqId=null,rideId=null,declined=new Set(),drSig='';
const stop=()=>{clearInterval(poll);poll=null};
const PK=()=>routePoints?.pickup&&Number.isFinite(routePoints.pickup.lat)&&Number.isFinite(routePoints.pickup.lng)?routePoints.pickup:({lat:36.7538,lng:3.0588,label:t('from_val')}),DS=()=>routePoints?.dropoff&&Number.isFinite(routePoints.dropoff.lat)&&Number.isFinite(routePoints.dropoff.lng)?routePoints.dropoff:({lat:36.6910,lng:3.2154,label:t('to_val')});
function reqPayload(){const base={pickup:PK(),dropoff:DS(),price:S.price,note:$('#note').value.trim()||undefined,women_only:$('#women').checked,vehicle_type:S.vehicleType};
  if(S.kind!=='delivery')return base; // demo coordinates: no geocoder yet, addresses are typed labels
  return {...base,women_only:false,kind:'delivery',pickup:{lat:PK().lat,lng:PK().lng,label:$('#dl-from').value.trim()||t('dl_from_ph')},dropoff:{lat:36.7332,lng:3.0870,label:$('#dl-to').value.trim()||t('dl_to_ph')},
    item_type:S.item,item_note:$('#dl-note').value.trim(),recipient_name:$('#dl-rn').value.trim()||undefined,recipient_phone:$('#dl-rp').value.trim()||undefined}}
$('#sim-next').hidden=true;

$('#finish').onclick=async()=>{try{await api('POST','/api/me',{name:$('#name').value.trim()||undefined,city:$('#city').value,lang:L})}catch{}
  state='rider';screen('s-map');drawMap();sheet('sh-home')};

$('#order').onclick=async()=>{
  try{const r=await api('POST','/api/requests',reqPayload());reqId=r.id}
  catch(e){toast(e.status===409?t('open_exists'):t('req_fail'));return}
  declined=new Set();$('#offers').innerHTML='';$('#wprice').textContent=S.price;sheet('sh-wait');stop();let shown=false;
  poll=setInterval(async()=>{try{const {offers,server_now,offer_ttl_ms}=await api('GET',`/api/requests/${reqId}/offers`);skew=server_now-Date.now();ttl=offer_ttl_ms||15000;const o2=offers.filter(o=>!declined.has(o.id));
    if(o2.length&&!shown){shown=true;sheet('sh-offers')} renderOffers(o2)}catch{}},1200)};
$('#cancel-wait').onclick=async()=>{stop();try{await api('POST',`/api/requests/${reqId}/cancel`)}catch{} sheet('sh-home');toast(t('cancelled'))};

/* 15 s countdown: the server's expires_at is authoritative; the client only displays it (skew = server clock - local clock) */
let skew=0,ttl=15000;
function tickCd(){const box=$('#offers');[...box.children].forEach(c=>{const r=+c.dataset.exp-(Date.now()+skew);if(r<=0){c.remove();return}
  c.querySelector('.cdn').textContent='00:'+String(Math.ceil(r/1000)).padStart(2,'0');c.querySelector('.timer i').style.width=Math.min(100,100*r/ttl)+'%'});
  const n=box.children.length;$('#ocount').textContent=n;$('#oempty').hidden=n>0}
setInterval(tickCd,250);
function renderOffers(list){const box=$('#offers'),ids=new Set(list.map(o=>String(o.id)));
  [...box.children].forEach(c=>{if(!ids.has(c.dataset.id))c.remove()});
  list.forEach((o,i)=>{if(box.querySelector(`[data-id="${o.id}"]`))return;const d=o.driver,nm=d.name||'—';
    const el=document.createElement('div');el.className='offer';el.dataset.id=o.id;el.dataset.exp=o.expires_at;
    el.innerHTML=`<div class="av" style="background:${COLORS[o.id%3]}">${esc(nm[0]||'?')}</div>
     <div><div class="nm">${esc(nm)}</div><div class="meta"><span class="star">${ICS} <span class="num">${esc(d.rating)}</span></span><span>${esc(d.car)}</span><span><span class="num">${o.eta_min}</span> ${t('eta')}</span><span><span class="num">${d.cancel_pct}%</span> ${t('cancels')}</span></div><div class="cd" role="timer"><span class="cdn num">00:15</span></div></div>
     <div class="pr"><b class="num">${o.price}</b>${o.price<=S.price?`<span class="ok">${t('accepts_price')}</span>`:''}</div>
     <div class="timer"><i></i></div>
     <div class="acts"><button class="btn ghost" data-x>${t('decline')}</button><button class="btn primary" data-ok>${t('accept')}</button></div>`;
    el.querySelector('[data-x]').onclick=()=>{declined.add(o.id);el.remove();tickCd()};
    el.querySelector('[data-ok]').onclick=()=>acceptApi(o);box.appendChild(el)});
  tickCd()} // refresh countdown text/bar and the empty state immediately, not on the next 250 ms timer
async function acceptApi(o){
  try{const r=await api('POST',`/api/offers/${o.id}/accept`);rideId=r.ride_id;stop();const d=o.driver,nm=d.name||'—';S.contactPhone=null;api('GET',`/api/rides/${rideId}`).then(v=>{S.contactPhone=v.contact.phone;way()}).catch(()=>{});
    S.offer={d:{p:r.locked_price,r:d.rating}};$('#d-av').textContent=nm[0]||'?';$('#d-av').style.background=COLORS[o.id%3];$('#d-name').textContent=nm;$('#d-car').textContent=d.car;
    $('#d-plate').textContent=d.plate;$('#d-rate').textContent=d.rating;$('#d-price').textContent=r.locked_price;S.step=0;way();sheet('sh-way');moveCar(-1,0,7000,()=>{});
    let last='en_route';poll=setInterval(async()=>{try{const x=await api('GET',`/api/rides/${rideId}`);if(x.status===last)return;last=x.status;
      if(x.status==='arrived'){S.step=1;way()}
      else if(x.status==='in_progress'){S.step=2;way();moveCar(0,1,8000,()=>{})}
      else if(x.status==='completed'){stop();finish()}
      else if(x.status==='cancelled'){stop();cancelAnimationFrame(carRaf);sheet('sh-home');toast(t('cancelled_r'))}}catch{}},1200)}
  catch(e){if(e.status===409){const c=$(`#offers [data-id="${o.id}"]`);if(c)c.remove();tickCd()}toast(e.status===409?t('offer_expired'):t('offer_gone'))}}
$('#cancel-ride').onclick=async()=>{stop();try{await api('POST',`/api/rides/${rideId}/status`,{status:'cancelled'})}catch{} cancelAnimationFrame(carRaf);sheet('sh-home');toast(t('cancelled'))};
$('#submit-rate').onclick=async()=>{if(S.stars){try{await api('POST',`/api/rides/${rideId}/rating`,{stars:S.stars,tags:$$('#tags button[aria-pressed=true]').map(b=>b.textContent)})}catch{}}
  toast(t('thanks'));S.price=450;upd();sheet('sh-home')};
$('#share').onclick=()=>toast(t('share_ok'));
/* ---- logout (only ever triggered by this button; no error path calls it) ---- */
$('#p-logout').onclick=async()=>{
  try{await api('POST','/api/auth/logout')}catch(e){if(e.status!==401){toast(t('lo_fail'));return}} // failure other than an already-expired session: stay signed in
  stop();S.timers.forEach(clearTimeout);S.timers=[];cancelAnimationFrame(carRaf);location.reload()}; // reload drops all in-memory state; /api/me then answers 401 and the shared gate shows
applyI18n(); // the logout label is added with the API strings above, after the first applyI18n()
}

/* ---- one-app start: the shell has already authenticated and authorised this account as a rider (passenger) ---- */
{const u=(window.Kherja&&window.Kherja.user)||{};S.name=u.name||'—';
 if(u.name){state='rider';screen('s-map');drawMap();sheet('sh-home')}else{screen('s-profile');$('#name').focus()}}
