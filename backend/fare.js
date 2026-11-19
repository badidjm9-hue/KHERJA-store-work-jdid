// Server-authoritative fare calculator. All amounts are Algerian dinars (DZD).
const MIN_FARE = 350;
const round50 = n => Math.round(n / 50) * 50;
function distanceKm(a,b){
  const R=6371, rad=Math.PI/180;
  const dLat=(b.lat-a.lat)*rad, dLng=(b.lng-a.lng)*rad;
  const lat1=a.lat*rad, lat2=b.lat*rad;
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
function fareFactors(date=new Date(), timezone='Africa/Algiers'){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const hour=Number(parts.find(p=>p.type==='hour').value);
  const night=hour>=22||hour<6, peak=(hour>=7&&hour<10)||(hour>=16&&hour<20);
  let multiplier=1+(night?.15:0)+(peak?.10:0);
  multiplier=Math.min(multiplier,1.30);
  const promo=!night&&!peak;
  return {night,peak,multiplier,promoRate:promo?0.05:0};
}
function quoteFare({distanceKm,vehicle='car',date=new Date(),timezone='Africa/Algiers'}){
  if(!Number.isFinite(distanceKm)||distanceKm<0) throw new TypeError('distanceKm must be a non-negative finite number');
  if(!['car','moto'].includes(vehicle)) throw new TypeError('vehicle must be car or moto');
  const f=fareFactors(date,timezone);
  const base=vehicle==='moto'?200:250, rate=vehicle==='moto'?20:60;
  const raw=base+distanceKm*rate;
  const promoRate=f.promoRate*(vehicle==='moto'?2:1); const suggested=Math.max(MIN_FARE,round50(raw*f.multiplier*(1-promoRate)));
  return {distance_km:Number(distanceKm.toFixed(3)),vehicle,base_dzd:base,rate_dzd_per_km:rate,minimum_dzd:MIN_FARE,night:f.night,peak:f.peak,promo_rate:promoRate,multiplier:f.multiplier,suggested_fare_dzd:suggested};
}
module.exports={MIN_FARE,distanceKm,fareFactors,quoteFare};
