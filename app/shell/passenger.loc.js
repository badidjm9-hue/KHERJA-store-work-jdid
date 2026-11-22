/* Passenger location start-up + manual pickup fallback (runs after passenger.view.js; before passenger.init.js). */
(function(){
  /* Approximate district centres in Algiers for people who do not share their location. Deliberately coarse
     (the label says so). Replace with a real geocoder/map once a provider is approved (see STORE-RELEASE-PREP.md). */
  const AREAS=[['Alger Centre','الجزائر الوسطى',36.7737,3.0603],['Bab El Oued','باب الوادي',36.7894,3.0517],['Hussein Dey','حسين داي',36.7408,3.1006],
    ['El Harrach','الحراش',36.7219,3.1394],['Kouba','القبة',36.7261,3.0830],['Hydra','حيدرة',36.7436,3.0394],['Bab Ezzouar','باب الزوار',36.7233,3.1827],
    ['Aéroport Houari Boumediene','مطار هواري بومدين',36.6910,3.2154]];
  const host=document.querySelector('#map-search'),from=document.querySelector('#map-from');
  if(host&&from&&!document.querySelector('#kj-area')){
    const sel=document.createElement('select');sel.id='kj-area';sel.className='kj-area';
    const fill=()=>{const fr=document.documentElement.lang==='fr';sel.setAttribute('aria-label',fr?'Zone de départ':'منطقة الانطلاق');
      sel.replaceChildren(new Option(fr?'Choisir la zone de départ':'اختر منطقة الانطلاق',''),...AREAS.map((a,i)=>new Option(fr?a[0]:a[1],String(i))))};
    fill();sel.onfocus=fill;
    sel.onchange=()=>{const a=AREAS[+sel.value];if(!a)return;const fr=document.documentElement.lang==='fr';
      applyPickupFix({lat:a[2],lng:a[3]},(fr?a[0]:a[1])+(fr?' (zone approximative)':' (منطقة تقريبية)'))};
    host.insertBefore(sel,from);
  }
  /* First relevant use: when the map screen first appears, explain (once per install) and detect the current position. */
  const sm=document.querySelector('#s-map');let started=false;
  const start=()=>{if(started||!sm||!sm.classList.contains('on'))return;started=true;setTimeout(()=>locatePassenger(true),400)};
  if(sm){new MutationObserver(start).observe(sm,{attributes:true,attributeFilter:['class']});start()}
})();
