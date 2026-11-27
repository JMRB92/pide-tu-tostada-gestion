// Data protocol v1.08; existing order documents retain their format.
export const VERSION='1.08';
export const MAX_UNITS=5;
export const TZ='Europe/Madrid';
export const ALLERGENS=['Cereales con gluten','Crustáceos','Huevos','Pescado','Cacahuetes','Soja','Leche','Frutos de cáscara','Apio','Mostaza','Sésamo','Sulfitos','Altramuces','Moluscos'];
export const money=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format((n||0)/100);
export const today=(d=new Date())=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`};
export function addDays(d,n){const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)}
export function localInstant(day,hm='00:00'){const guess=new Date(`${day}T${hm}:00Z`); const f=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}); const p=Object.fromEntries(f.formatToParts(guess).map(x=>[x.type,x.value])); const local=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);return new Date(2*guess.getTime()-local)}
export const dayLabel=d=>d?d.split('-').reverse().join('/'):'—';
export const code=o=>`${o.zone}-${String(o.seq).padStart(3,'0')}`;
export const normal=s=>s.toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'');
export const identity=(n,a,c,g)=>normal(n)+'|'+normal(a)+'|'+c+'|'+g;
export const textClean=s=>String(s??'').trim().replace(/\s+/g,' ');
export const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
export const count=(arr,id)=>arr.filter(x=>x===id).length;
export const grouped=arr=>Object.fromEntries([...new Set(arr)].map(x=>[x,count(arr,x)]));
export const emptyLedger=()=>({ESO:0,CAF:0,seqESO:0,seqCAF:0,products:{},last:'',lastVersion:0});
export const active=o=>o&&!o.cancelled;
export const reservedUnits=o=>!o?[]:o.cancelled?o.units.filter((_,i)=>Object.hasOwn(o.paid||{},String(i))):o.units;
export function merge(a,b){const r=structuredClone(a);for(const [k,v] of Object.entries(b||{})){r[k]=v&&typeof v==='object'&&!Array.isArray(v)&&r[k]&&typeof r[k]==='object'&&!Array.isArray(r[k])?merge(r[k],v):structuredClone(v)}return r}
export function effective(master,day){
 const b=(master.changes||[]).filter(x=>x.date<=day).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).reduce((a,c)=>merge(a,c.patch),structuredClone(master.base));
 // Retirements take precedence over scheduled edits; keep historical metadata for existing orders.
 for(const x of (master.retirements||[]))if(x.date<=day){if(x.kind==='product'&&b.products[x.id])b.products[x.id]={...b.products[x.id],active:false,retired:true};if(x.kind==='course'&&b.courses[x.id])b.courses[x.id]={...b.courses[x.id],active:false,retired:true};if(x.kind==='category')b.categories=b.categories.filter(c=>c!==x.id)}
 b.settings.limitUser=Math.max(1,Math.min(MAX_UNITS,Number.isFinite(b.settings.limitUser)?Math.floor(b.settings.limitUser):3));
 return b;
}
export function retireCatalogue(master,kind,id,date){
 const b=effective(master,date);
 if(kind==='product'&&(!b.products[id]||b.products[id].retired))throw Error('El producto ya no está en el catálogo.');
 if(kind==='course'&&(!b.courses[id]||b.courses[id].retired))throw Error('El curso ya no está disponible.');
 if(kind==='category'){
  if(!b.categories.includes(id))throw Error('La categoría ya no existe.');
  const dates=[date,...(master.changes||[]).filter(x=>x.date>date).map(x=>x.date)];
  if(dates.some(d=>Object.values(effective(master,d).products).some(p=>!p.retired&&p.category===id)))throw Error('Mueve o elimina antes los productos de esta categoría, incluidos los cambios programados.');
 }
 if(!['product','course','category'].includes(kind))throw Error('Elemento no válido.');
 return {...master,retirements:[...(master.retirements||[]),{kind,id,date}]};
}
export const catalogueProducts=(d,category='all')=>sortedProducts(d).filter(([,p])=>!p.retired&&(category==='all'||p.category===category));
export const catalogueCourses=d=>Object.entries(d?.courses||{}).filter(([,c])=>!c.retired);

export function dayConfig(master,day){const b=effective(master,day),s=b.settings;const weekend=[0,6].includes(new Date(day+'T12:00:00Z').getUTCDay());return {date:day,open:s.enabled&&(!weekend||s.weekend)&&!b.closed[day],products:b.products,courses:b.courses,zones:b.zones,categories:b.categories,limitUser:s.limitUser,limitDay:s.limitDay,limitESO:s.limitESO,limitCAF:s.limitCAF,allergyEnabled:s.allergyEnabled,editMinutes:s.editMinutes,opensAt:localInstant(addDays(day,-s.advance)),cutoffAt:localInstant(day,s.cutoff),editAt:localInstant(day,s.editCutoff),pickupStart:s.pickupStart,pickupEnd:s.pickupEnd,announcement:s.announcement,revision:master.revision||1}}
export function priceOf(o,i,d){return Object.hasOwn(o.paid||{},String(i))?o.paid[i]:(d?.products?.[o.units[i]]?.price??o.initialPrices?.[i]??0)}
export const paidTotal=o=>Object.values(o.paid||{}).reduce((a,b)=>a+b,0);
export const total=(o,d)=>o.units.reduce((n,_,i)=>n+priceOf(o,i,d),0);
export const remaining=(o,d)=>o.cancelled?0:total(o,d)-paidTotal(o);
export const status=o=>o.cancelled?'Cancelado':o.incident?'Incidencia':Object.keys(o.paid||{}).length===o.units.length?'Entregado y pagado':Object.keys(o.paid||{}).length?'Entrega parcial':'Pendiente';
export function deadline(o,d){return Math.min(o.createdAt.toMillis()+d.editMinutes*60000,d.editAt.toMillis())}
export const canEdit=(o,d,now=Date.now())=>!o.cancelled&&!Object.keys(o.paid||{}).length&&now<deadline(o,d);
export function applyLedger(l,old,next,date){const r=structuredClone(l||emptyLedger());for(const [o,sign] of [[old,-1],[next,1]])if(o&&o.date===date){const u=reservedUnits(o);r[o.zone]+=sign*u.length;for(const id of u)r.products[id]=(r.products[id]||0)+sign}if(next&&next.date===date&&(!old||old.date!==next.date||old.zone!==next.zone))r['seq'+next.zone]++;r.last=(next||old).id;r.lastVersion=(next||old).version;return r}
export function checkCapacity(l,d){if(l.ESO<0||l.CAF<0)throw Error('Contador inconsistente. Contacta con cafetería.');if(d.limitDay&&l.ESO+l.CAF>d.limitDay)throw Error('Capacidad diaria agotada.');for(const z of ['ESO','CAF'])if(d['limit'+z]&&l[z]>d['limit'+z])throw Error('Capacidad de recogida agotada.');for(const [id,n] of Object.entries(l.products))if(d.products[id]?.limit&&n>d.products[id].limit)throw Error('Producto agotado: '+d.products[id].name)}
export function aggregate(orders,products){const r={requested:0,delivered:0,zones:{}};for(const o of orders){if(o.test)continue;const z=r.zones[o.zone]??={};o.units.forEach((id,i)=>{const x=z[id]??={name:products?.[id]?.name||id,requested:0,delivered:0};x.requested++;r.requested++;if(Object.hasOwn(o.paid||{},String(i))){x.delivered++;r.delivered++}})}return r}
export function csv(rows){return '\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replace(/"/g,'""')+'"').join(';')).join('\r\n')}

// Public status contains only operational information, never student data.
export function availableDates(status,now=Date.now(),editing=false){return (status?.available||[]).filter(x=>x.date>=today(new Date(now))&&now>=x.opensAt.toMillis()&&now<(editing?Math.min(x.cutoffAt.toMillis(),x.editAt.toMillis()):x.cutoffAt.toMillis())).map(x=>x.date)}
export function validSummary(s,date){if(!s||s.date!==date||!Number.isInteger(s.requested)||!Number.isInteger(s.delivered)||s.requested<0||s.delivered<0||s.delivered>s.requested||!s.zones||typeof s.zones!=='object')return false;let requested=0,delivered=0;for(const z of Object.values(s.zones)){for(const p of Object.values(z)){if(!Number.isInteger(p.requested)||!Number.isInteger(p.delivered)||p.requested<0||p.delivered<0||p.delivered>p.requested)return false;requested+=p.requested;delivered+=p.delivered}}return requested===s.requested&&delivered===s.delivered}

// Presentation order only: never reorder persisted unit indexes (payments/preparation).
export function productCompare(a,b,d={}){const ps=d?.products||{},p=ps[a]||{},q=ps[b]||{},cats=d?.categories||[];const rank=c=>{const i=cats.indexOf(c);return i<0?cats.length:i};return rank(p.category)-rank(q.category)||String(p.category||'Otros').localeCompare(String(q.category||'Otros'),'es')||(p.price??Infinity)-(q.price??Infinity)||String(p.name||a).localeCompare(String(q.name||b),'es',{sensitivity:'base'})||String(a).localeCompare(String(b),'es');}
export const sortedProducts=(d)=>Object.entries(d?.products||{}).sort(([a],[b])=>productCompare(a,b,d));
export const sortedGroups=(units,d)=>Object.entries(grouped(units)).sort(([a],[b])=>productCompare(a,b,d));
export const sortedUnits=(units,d)=>units.map((id,i)=>({id,i})).sort((a,b)=>productCompare(a.id,b.id,d)||a.i-b.i);
export function productCategory(id,d){return d?.products?.[id]?.category||'Otros';}

export function categoryGroups(rows,d,idOf=x=>x[0]){const groups=new Map();for(const row of rows){const cat=productCategory(idOf(row),d);if(!groups.has(cat))groups.set(cat,[]);groups.get(cat).push(row)}return [...groups];}

// Presentation helpers; data protocol remains v1.08.
const COURSE_ORDER=['1ESO','2ESO','3ESO','4ESO','1BACH','2BACH','1DIVER','2DIVER','FPB','ESPA','1MC','2MC','PROF','PND','OTROS'];
export function courseCompare(a,b){const rank=x=>{const i=COURSE_ORDER.indexOf(x);return i<0?100:i};return rank(a)-rank(b)||String(a).localeCompare(String(b),'es',{numeric:true});}
export function sortedCourses(d){return Object.entries(d?.courses||{}).sort(([a],[b])=>courseCompare(a,b));}
export function fullDate(d){return new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',timeZone:TZ}).format(new Date(d+'T12:00:00Z'));}
// Never mark a partial, cancelled, archived or wrong-zone order as paid automatically.
export function rapidDelivery(o,d,{date,zone='all',station=''}={}){
 if(!o)return {kind:'missing',message:'Pedido no encontrado'};
 if(o.cancelled||o.removed)return {kind:'cancelled',message:'Pedido cancelado o eliminado'};
 if(o.date!==date)return {kind:'date',message:'Pedido de otro día'};
 if(zone!=='all'&&o.zone!==zone)return {kind:'zone',message:'Pedido de otra zona'};
 if(!d||d.archiving||d.archived)return {kind:'archived',message:'Fecha no disponible'};
 const paid=Object.keys(o.paid||{}).length;
 if(o.units?.length&&paid===o.units.length)return {kind:'already',message:'Pedido ya entregado y pagado'};
 if(paid||o.incident||o.allergy||!o.units?.length||o.units.length>MAX_UNITS)return {kind:'manual',message:'Requiere revisión manual'};
 const prices=o.units.map((_,i)=>priceOf(o,i,d));
 if(prices.some(n=>!Number.isInteger(n)||n<0))return {kind:'manual',message:'Revisa el importe'};
 const next={...o,prepared:o.units.map((_,i)=>i),paid:Object.fromEntries(prices.map((n,i)=>[String(i),n])),markerReset:false,version:o.version+1,deliveryStation:station};
 return {kind:'paid',message:'Entregado y pagado',next,amount:prices.reduce((a,b)=>a+b,0)};
}

export async function commitRapidDelivery({transact,reference,timestamp,id,collection='orders',date,zone,station}){
 const r=reference(collection,id);
 return transact(async tx=>{const snap=await tx.get(r),o=snap.exists()?snap.data():null;
 if(!o)return {...rapidDelivery(null,null,{date,zone}),before:null};
 const dd=await tx.get(reference('days',o.date));const res=rapidDelivery(o,dd.exists()?dd.data():null,{date,zone,station});
 if(res.kind==='paid')tx.set(r,{...res.next,deliveredAt:timestamp(),updatedAt:timestamp()});
 return {...res,before:o};});
}
