import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {initializeAuth,browserLocalPersistence,browserSessionPersistence,inMemoryPersistence,signInAnonymously,signInWithEmailAndPassword,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,collection,getDoc,getDocFromServer,getDocs,getDocsFromServer,documentId,query,where,onSnapshot,setDoc,updateDoc,deleteDoc,runTransaction,writeBatch,serverTimestamp,Timestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {initializeAppCheck,ReCaptchaV3Provider} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js';
import {VERSION,MAX_UNITS,today,identity,code,emptyLedger,applyLedger,checkCapacity,canEdit,active,normal,reservedUnits} from './core.js';
export const ADMIN_UID='YvonyUCyvEbBs18WWf8MiAUwWYu2';
const app=initializeApp({apiKey:'AIzaSyA76crz6KOwbfzzBsIOr6HDD6uAYT6prVI',authDomain:'pide-tu-tostada.firebaseapp.com',projectId:'pide-tu-tostada',storageBucket:'pide-tu-tostada.firebasestorage.app',messagingSenderId:'712646065207',appId:'1:712646065207:web:34b244d2513792c15ad3b2'}, 'tostada-gestion');
// Fill with the public reCAPTCHA v3 site key only after registering this web app in App Check.
const APP_CHECK_SITE_KEY='';
if(APP_CHECK_SITE_KEY)initializeAppCheck(app,{provider:new ReCaptchaV3Provider(APP_CHECK_SITE_KEY),isTokenAutoRefreshEnabled:true});
export const auth=initializeAuth(app,{persistence:browserSessionPersistence}),db=getFirestore(app);
export {signInAnonymously,signInWithEmailAndPassword,onAuthStateChanged,signOut,doc,collection,getDoc,getDocFromServer,getDocs,getDocsFromServer,documentId,query,where,onSnapshot,setDoc,updateDoc,deleteDoc,runTransaction,writeBatch,serverTimestamp,Timestamp};
export const ref=(...p)=>doc(db,...p);
export const col=(...p)=>collection(db,...p);
export async function sha(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('')}
export function randomHex(bytes=16){return Array.from(crypto.getRandomValues(new Uint8Array(bytes)),b=>b.toString(16).padStart(2,'0')).join('')}
export const prettySecret=s=>s.match(/.{1,4}/g).join('-').toUpperCase();
export const cleanSecret=s=>s.trim().replace(/[^0-9a-f]/gi,'').toLowerCase();
export async function enterCode(s){const hash=await sha(s.trim()); await setDoc(ref('members',auth.currentUser.uid),{hash,createdAt:serverTimestamp()});return true}
export async function dayRead(d){const x=await getDocFromServer(ref('days',d));if(!x.exists())throw Error('Fecha no disponible. Contacta con cafetería.');return x.data()}
export async function grant(id,secret){const raw=cleanSecret(secret);if(raw.length!==32)throw Error('Contraseña incorrecta.');const hash=await sha(raw);await setDoc(ref('orders',id,'grants',auth.currentUser.uid),{hash,at:serverTimestamp()});}
export async function recover(secret){const raw=cleanSecret(secret);if(raw.length!==32)throw Error('Contraseña incorrecta.');const hash=await sha(raw);const r=await getDocFromServer(ref('recovery',hash));if(!r.exists())throw Error('No existe el pedido o ha caducado.');const id=r.data().id;await grant(id,secret);return readOrder(id)}
export async function findOwnOrder(id){const s=await getDocFromServer(ref('orders',id));return s.exists()?s.data():null}
export async function readOrder(id){const o=await findOwnOrder(id);if(!o)throw Error('Pedido no disponible.');return o}
const data=(s,def)=>s.exists()?s.data():def;
export async function saveOrder(input,{existingId=null,secret=null,admin=false,operationId=null,mode='save'}={}){
 const uid=auth.currentUser.uid,id=existingId||operationId||randomHex(), raw=existingId?null:(secret?cleanSecret(secret):randomHex()), hash=raw?await sha(raw):null;
 if(!existingId&&(!raw||raw.length!==32))throw Error('Identificador de solicitud inválido.');
 const orderRef=ref('orders',id);
 const result=await runTransaction(db,async tx=>{
   // Missing random IDs can be checked; existing orders are restricted to owner or authorized recovery.
   let old=null;const existing=await tx.get(orderRef);old=data(existing,null);if(existingId&&!old)throw Error('Pedido eliminado.');if(!existingId&&old){if(!admin&&old.owner!==uid)throw Error('Solicitud no autorizada.');return old;}
   const date=mode==='cancel'?old.date:input.date;
   const dates=[...new Set([date,old?.date].filter(Boolean))];
   const dayDocs={};for(const d of dates){const snap=await tx.get(ref('days',d));if(!snap.exists())throw Error('Fecha no disponible.');dayDocs[d]=snap.data()}
   const day=dayDocs[date];
   if(day.archived||day.archiving)throw Error('Fecha archivada.');
   if(old&&(dayDocs[old.date].archived||dayDocs[old.date].archiving))throw Error('Fecha archivada.');
   if(!admin&&old&&!canEdit(old,dayDocs[old.date]))throw Error('Plazo de cambios finalizado.');
   if(mode==='cancel'&&(old.cancelled||Object.keys(old.paid||{}).length===old.units.length))return old;
   const person=mode==='cancel'?old:input;
   const c=day.courses[person.course];if(mode!=='cancel'&&(!c?.active||!c.groups.includes(person.group)))throw Error('Curso o grupo no disponible.');
   const zone=mode==='cancel'?old.zone:(admin&&input.zone?input.zone:c.zone);
   const name=mode==='cancel'?old.name:input.name,surname=mode==='cancel'?old.surname:input.surname;
   const ident=await sha(identity(name,surname,person.course,person.group));
   const qkey=date+'_'+ident;
   const units=mode==='cancel'?old.units:[...input.units];
   if(mode!=='cancel'){
    if(!admin&&(!day.open||Date.now()<day.opensAt.toMillis()||Date.now()>=day.cutoffAt.toMillis()))throw Error('Pedidos cerrados para esa fecha.');
    if(!admin&&old&&Date.now()>=day.editAt.toMillis())throw Error('Plazo de cambios finalizado para la nueva fecha.');
    if(!units.length||units.length>MAX_UNITS)throw Error('Cantidad no válida.');
    if(units.some(p=>!day.products[p]||(!day.products[p].active&&!(admin&&old?.units.includes(p)&&old.date===date))))throw Error('Producto no disponible.');
    if(old&&Object.keys(old.paid||{}).length)throw Error('No se puede sustituir un pedido con cobros. Corrige primero la entrega.');
   }
   const next=mode==='cancel'?{...old,clientVersion:VERSION,cancelled:true,cancelReason:admin?(input.reason||'Cafetería'):'Alumno',version:old.version+1,updatedAt:serverTimestamp()}:{id,clientVersion:VERSION,owner:old?.owner||uid,date,zone,seq:old?.seq||0,name,surname,course:person.course,group:person.group,identity:ident,quotaKey:qkey,units,initialPrices:units.map(p=>day.products[p].price),notes:input.notes||'',allergy:day.allergyEnabled?input.allergy||'':'',prepared:[],paid:{},incident:false,incidentReason:'',cancelled:false,cancelReason:'',createdAt:old?.createdAt||serverTimestamp(),updatedAt:serverTimestamp(),version:old?old.version+1:1,test:false};
   if(old&&old.cancelled&&mode!=='cancel')throw Error('Pedido cancelado.');
   if(!admin&&old&&mode!=='cancel'&&(old.name!==name||old.surname!==surname||old.course!==person.course||old.group!==person.group))throw Error('No se permite cambiar la identidad.');
   const ledgers={};for(const d of dates)ledgers[d]=data(await tx.get(ref('daily',d)),emptyLedger());
   const keys=[...new Set([next.quotaKey,old?.quotaKey].filter(Boolean))],quotas={};for(const k of keys)quotas[k]=data(await tx.get(ref('limits',k)),{used:0,last:'',lastVersion:0});
   for(const d of dates){const l=applyLedger(ledgers[d],old,next,d);if(active(next)&&next.date===d)checkCapacity(l,dayDocs[d]);ledgers[d]=l;}
   if(!old||old.date!==next.date||old.zone!==next.zone)next.seq=ledgers[next.date]['seq'+next.zone];
   for(const k of keys){const q=quotas[k];const delta=(next&&next.quotaKey===k?reservedUnits(next).length:0)-(old&&old.quotaKey===k?reservedUnits(old).length:0);q.used+=delta;q.last=id;q.lastVersion=next.version;if(q.used<0)throw Error('Contador de alumno inconsistente.');if(delta>0&&q.used>day.limitUser&&!admin)throw Error('Has alcanzado el límite diario.');}
   for(const d of dates)tx.set(ref('daily',d),ledgers[d]);for(const k of keys)tx.set(ref('limits',k),quotas[k]);
   tx.set(orderRef,next);if(!old){tx.set(ref('privateOrders',id),{hash});tx.set(ref('recovery',hash),{id});}
   return next;
 });
 // Always wait for a server read after the atomic write before issuing a receipt.
 return {order:await readOrder(result.id),secret:raw?prettySecret(raw):secret};
}
