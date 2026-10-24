import { useState, useEffect, useCallback } from "react";
import React from "react";

import batchSizes from "./batch-sizes.json";
import { pendingBake, saveBake, sendSavedBake as sendExistingBake, guessSize } from "./production-client.js";

const DRAFT_KEY='jc-bake-draft-v1';
const RECEIPTS_KEY='jc-bake-receipts-v1';
function readDraft(storage=localStorage){
  try{
    const raw=storage.getItem(DRAFT_KEY);if(!raw)return {};
    const d=JSON.parse(raw);
    if(d.version!==1||!Array.isArray(d.selected)||!d.fd||typeof d.fd!=='object'||Array.isArray(d.fd)||![0,1,2].includes(d.step))throw Error();
    return d;
  }catch(e){return {unreadable:true};}
}
function writeDraft(draft,storage=localStorage){storage.setItem(DRAFT_KEY,JSON.stringify({...draft,version:1}));}
function readReceipts(storage=localStorage){try{const rows=JSON.parse(storage.getItem(RECEIPTS_KEY)||'[]');return Array.isArray(rows)?rows:[];}catch(e){return [];}}
function rememberReceipt(payload,result,storage=localStorage){
  const receipt={sessionId:payload.sessionId,timestamp:payload.timestamp,status:result.posted?'POSTED':'QUEUED',flavors:Object.entries(payload.flavors).map(([flavor,f])=>({flavor,totalOz:f.totalOz,bags:f.bags}))};
  storage.setItem(RECEIPTS_KEY,JSON.stringify([receipt,...readReceipts(storage).filter(x=>x.sessionId!==receipt.sessionId)].slice(0,20)));
  storage.removeItem(DRAFT_KEY);
}
function mergeReceipts(server,local){
  const rows=new Map(local.map(r=>[r.sessionId,r]));
  server.forEach(r=>rows.set(r.sessionId,r));
  return [...rows.values()].sort((a,b)=>String(b.timestamp||'').localeCompare(String(a.timestamp||''))).slice(0,20);
}

const displayNumber=v=>typeof v==='number'&&Number.isFinite(v)?new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(v):v===0?'0':v?String(v):'—';
const when=value=>{const d=new Date(value);return value&&!isNaN(d)?d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Not available';};
function useWorkspace(apiCall){
  const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const load=useCallback(async()=>{setLoading(true);const result=await apiCall('getBakeWorkspace');if(result.success&&Array.isArray(result.plan)&&Array.isArray(result.recent)){setData(result);setError('');}else setError('Current figures could not be loaded. Your entries are safe. Try loading the view again.');setLoading(false);},[]);
  useEffect(()=>{load();const visible=()=>{if(document.visibilityState==='visible')load();};window.addEventListener('jc-bake-saved',load);document.addEventListener('visibilitychange',visible);const timer=setInterval(()=>{if(document.visibilityState==='visible')load();},60000);return()=>{clearInterval(timer);window.removeEventListener('jc-bake-saved',load);document.removeEventListener('visibilitychange',visible);};},[load]);
  return {data,error,loading,load};
}
function ReadStatus({workspace}){
 const {data,error,loading,load}=workspace;
 return <div className="read-status"><p>{loading?'Loading saved figures…':data?'App last read these figures '+when(data.readAt):'No figures loaded.'} This does not run a spreadsheet or SOS update.</p>{error&&<p role="alert">{error}{data&&' Previously loaded figures remain below.'}</p>}<button className="sec-btn" disabled={loading} onClick={load}>Load latest saved figures</button></div>;
}
function ProductVisibility({workspace}){
 const [changes,setChanges]=useState({}),[message,setMessage]=useState(''),[saving,setSaving]=useState(false);
 const data=workspace.data;
 async function save(){setSaving(true);const result=await apiCall('saveProductVisibility',{products:changes});if(result.success){setChanges({});setMessage('Products shown in the app have been saved for all devices.');await workspace.load();}else setMessage(result.error||'The save could not be confirmed. Load the saved settings before trying again.');setSaving(false);}
 return <section className="panel"><h2>Products shown in the app</h2><p className="help">Turn a product off when you are not making it. It disappears from Inventory, the bake overview, and new Kitchen choices. Stock records, recipes, and bake history stay saved. Unfinished bakes already on this device are kept.</p><ReadStatus workspace={workspace}/>{data&&<><fieldset disabled={saving} style={{border:0,padding:0}}>{data.products.map(name=><label className="visibility-row" key={name}><input type="checkbox" checked={changes[name]??shown(data,name)} onChange={e=>setChanges(c=>({...c,[name]:e.target.checked}))}/><span>{name}{!data.productionProducts.includes(name)&&<small>Special order: select a production recipe before recording a bake.</small>}</span></label>)}<button className="sub-btn" disabled={saving||!Object.keys(changes).length} onClick={save}>{saving?'Saving products…':'Save products shown'}</button></fieldset>{message&&<p role="status">{message}</p>}<p className="help">Returning flavors can be added to this list using their existing product records. Turning one on does not create a recipe or change production settings.</p></>}</section>;
}
function PlanEditor({workspace}){
 const [edits,setEdits]=useState({}),[message,setMessage]=useState(''),[saving,setSaving]=useState(false);
 const data={...workspace.data,plan:workspace.data.plan.filter(r=>shown(workspace.data,r.flavor))};
 async function save(){
  setSaving(true);setMessage('');
  const result=await apiCall('saveBakePlan',{planDate:data.planDate,changes:Object.entries(edits).map(([flavor,e])=>({flavor,...e}))});
  if(result.success){setEdits({});setMessage('Plan saved. This has not recorded a bake.');await workspace.load();}
  else setMessage(result.error||'The save could not be confirmed. Keep these entries and load the saved plan before trying again.');
  setSaving(false);
 }
 return <section className="panel plan-editor"><h3>Plan this day’s batches</h3><p className="help">Choose the batch size and number of batches for {data.planDate}. These are planning choices. Confirm the actual batch size when you record a completed bake.</p>
 <fieldset disabled={saving} style={{border:0,padding:0}}>{data.plan.map(r=>{
  const e=edits[r.flavor],value=e||{batchSize:r.batchSize,plannedBatches:r.plannedBatches};
  const change=(key,v)=>setEdits(old=>({...old,[r.flavor]:{...(old[r.flavor]||{batchSize:r.batchSize,plannedBatches:r.plannedBatches,expected:[r.batchSize,r.plannedBatches]}),[key]:v===''?'':Number(v)}}));
  return <div className="planning-row" key={r.flavor}><strong>{r.flavor}</strong><label>Batch size<input aria-label={r.flavor+' planning batch size'} type="number" inputMode="decimal" min="0.01" step="any" value={value.batchSize??''} onChange={ev=>change('batchSize',ev.target.value)}/></label><label>Planned batches<input aria-label={r.flavor+' planned batches'} type="number" inputMode="decimal" min="0" step="any" value={value.plannedBatches??''} onChange={ev=>change('plannedBatches',ev.target.value)}/></label></div>;
 })}<button className="sub-btn" disabled={!Object.keys(edits).length||saving||Object.values(edits).some(e=>typeof e.batchSize!=='number'||e.batchSize<=0||typeof e.plannedBatches!=='number'||e.plannedBatches<0)} onClick={save}>{saving?'Saving plan…':'Save plan'}</button></fieldset>
 {message&&<p role="status" className="help">{message}</p>}</section>;
}
function PlanView({workspace,onKitchen,inventoryOnly=false}){
 const data=workspace.data?{...workspace.data,plan:workspace.data.plan.filter(r=>shown(workspace.data,r.flavor))}:null;
 return <><ReadStatus workspace={workspace}/>{data&&<>
 <div className="feed-status">{data.feeds.map(f=><div key={f.name}><strong>{f.name}:</strong> {f.status||'Unknown'} · Last success: {when(f.success)}{f.detail&&f.status!=='Updated'&&<p className="notice">{f.detail}</p>}</div>)}</div>
 <p className="help">{inventoryOnly?'Stock is shown by package size. A dash means that size is not supplied by this stock view.':'These are the existing plan’s figures. Combined amounts use regular-bag equivalents; package quantities are shown separately. Batch estimates use the size already entered in the plan.'}</p>
 {!inventoryOnly&&<PlanEditor workspace={workspace}/>}
 <div className="plan-list">{data.plan.map(r=><article className="plan-card" key={r.flavor}>
 <div className="plan-name"><h3>{r.flavor}</h3>{!inventoryOnly&&typeof r.needed==='number'&&r.needed>0&&<span className="badge b-pend">More needed</span>}</div>
 {inventoryOnly?<div className="plan-numbers"><Figure label="Regular / single" value={r.stock.s45}/><Figure label="15 oz bags" value={r.stock.s15}/><Figure label="45 oz bags" value={r.stock.s450}/></div>:<><div className="plan-numbers"><Figure label="Customers waiting" value={r.waiting}/><Figure label="In stock" value={r.stockEquivalent}/><Figure label="Still to bake" value={r.needed}/><Figure label="Batches estimated" value={r.batchesNeeded}/></div>
 <details><summary>Package quantities and plan details</summary><div className="package-details"><p>Stock: regular / single {displayNumber(r.stock.s45)} · 15 oz {displayNumber(r.stock.s15)} · 45 oz {displayNumber(r.stock.s450)}</p><p>Waiting: regular / single {displayNumber(r.demand.s45)} · 15 oz {displayNumber(r.demand.s15)} · 45 oz {displayNumber(r.demand.s450)} · 2 oz {displayNumber(r.demand.s2)}</p><p>Plan’s batch size: {displayNumber(r.batchSize)} · Planned batches: {displayNumber(r.plannedBatches)} · Planned output: {displayNumber(r.plannedOutput)}</p><p>{r.demandStatus}</p></div></details></>}
 {Object.values(r.stock).some(x=>typeof x==='number'&&x<0)&&<p className="notice">A stock figure is negative and needs attention. It has been kept visible.</p>}
 </article>)}</div>{!inventoryOnly&&<button className="sub-btn" onClick={onKitchen}>Record a completed bake</button>}
 </>}</>;
}
function Figure({label,value}){return <div><span>{label}</span><strong>{displayNumber(value)}</strong></div>;}
function RecentBakes({workspace}){
 const [local,setLocal]=useState(readReceipts);
 useEffect(()=>{const changed=()=>setLocal(readReceipts());window.addEventListener('jc-bake-saved',changed);return()=>window.removeEventListener('jc-bake-saved',changed);},[]);
 const recent=mergeReceipts(workspace.data?.recent||[],local);
 return <section className="recent-bakes"><h2>Recent bakes</h2><p className="help">Saved entries are shared through the app. Unfinished drafts stay on the device where you entered them.</p><ReadStatus workspace={workspace}/>
 {!recent.length&&<p className="panel">{workspace.loading?'Loading recent bakes…':workspace.error?'Recent bakes are unavailable. This does not mean there are none.':'No saved bake records to show yet.'}</p>}
 {recent.map(r=><article className="receipt" key={r.sessionId}>
 <div className="plan-name"><strong>{when(r.timestamp)}</strong><span className={'badge '+(r.status==='POSTED'?'b-ship':'b-pend')}>{r.status==='POSTED'?'Reached SOS':r.status==='ATTENTION'?'Needs attention':r.status==='LEGACY'?'Earlier bake':'Saved · waiting for SOS'}</span></div>
 <ul>{r.flavors.map(f=><li key={f.flavor}><strong>{f.flavor}</strong>{f.totalOz!=null&&<> · {displayNumber(f.totalOz)} oz</>}<div>{[['s45','4.5 oz'],['s15','15 oz'],['s450','45 oz'],['s2','2 oz']].filter(([key])=>f.bags?.[key]>0).map(([key,label])=>`${displayNumber(f.bags[key])} × ${label}`).join(' · ')}</div></li>)}</ul>
 {r.status==='POSTED'?<p>SOS has recorded this bake.{r.recordIds?.length>0&&' Record '+r.recordIds.join(', ')+'.'} Stock figures follow the existing stock update.</p>:r.status==='LEGACY'?<p>Saved before automatic SOS tracking. Its SOS result is not supplied here.</p>:r.status==='ATTENTION'?<p className="notice">The bake is saved, but posting needs review. Do not enter it again or adjust stock to compensate. Keep this receipt for review.</p>:<p>The bake is saved. SOS posting normally runs every five minutes. Do not enter it again.</p>}
 <small>Reference: {r.sessionId}</small></article>)}
 </section>;
}
function Dashboard({workspace,onKitchen}){
 const [view,setView]=useState('plan'),[orders,setOrders]=useState(null),[orderError,setOrderError]=useState('');
 useEffect(()=>{if(view!=='orders'||orders)return;fetch('/api/proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'getOrders'})}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(r=>{if(!r.success||!Array.isArray(r.orders))throw Error();setOrders(r.orders);}).catch(()=>setOrderError('Orders could not be loaded. No example orders are displayed.'));},[view,orders]);
 return <div className="content"><div className="form-hdr"><h2>Your bake overview</h2><p>See what is needed, then record what you actually made.</p></div><nav className="nav" aria-label="Dashboard views">{[['plan','What needs baking'],['inventory','Inventory'],['orders','Recent orders'],['bakes','Recent bakes'],['products','Products shown']].map(([key,label])=><button key={key} className={'nav-btn '+(view===key?'active':'')} aria-current={view===key?'page':undefined} onClick={()=>setView(key)}>{label}</button>)}</nav>
 {view==='plan'&&<div className="dashboard-grid"><section><PlanView workspace={workspace} onKitchen={onKitchen}/></section><RecentBakes workspace={workspace}/></div>}
 {view==='inventory'&&<PlanView workspace={workspace} inventoryOnly/>}
 {view==='bakes'&&<RecentBakes workspace={workspace}/>}
 {view==='products'&&<ProductVisibility workspace={workspace}/>}
 {view==='orders'&&<section className="panel"><h3>Latest 20 orders in the saved order view</h3><p className="help">For baking quantities, use What needs baking. Amounts are omitted when the source does not supply them.</p>{orderError&&<p role="alert">{orderError}</p>}{!orders&&!orderError&&<p>Loading orders…</p>}{orders?.length===0&&<p>No orders supplied by this view.</p>}{orders?.map((o,i)=><div className="order-row" key={`${o.id}:${i}`}><span>{o.id}</span><strong>{o.customer}</strong><span>{o.status}</span></div>)}</section>}
 </div>;
}
async function sendSavedBake(){const payload=pendingBake();const result=await sendExistingBake();try{rememberReceipt(payload,result);}catch(e){}return result;}

const APPS_SCRIPT_URL = "/api/proxy";
const FLAVORS = ["Red Wine","White Wine","Tomato Basil","Garlic Herb","Buttermilk Bacon","Lavender Rosemary","Cracked Pepper & Sage","Spicy Chocolate Mint","Chocolate Graham","Graham Crackers"];
const SHORTBREAD = ["Lavender Shortbread Single","Lavender Shortbread 6-Pack","Shortbread Cookies, Individually Packaged"];
const SIZES = [{key:"s45",label:"4.5oz",oz:4.5,mult:1},{key:"s15",label:"15oz",oz:15,mult:4},{key:"s450",label:"45oz",oz:45,mult:10}];
const KITCHEN_FLAVORS=[...FLAVORS,'Cluck Yeah!'];
const KITCHEN_BATCH_SIZES={...batchSizes,'Cluck Yeah!':[{size:40,recipeId:2940474,name:'Cluck Yeah! Crackers. 40'}]};
const shown=(data,name)=>data?.productVisibility?.[name]!==false;
const TWO_OZ_FLAVORS = ['Buttermilk Bacon','Red Wine','White Wine','Garlic Herb','Cracked Pepper & Sage'];
const TWO_OZ_SIZE={key:'s2',label:'2oz',oz:2,mult:2/4.5};
const kitchenSizes=flavor=>TWO_OZ_FLAVORS.includes(flavor)?[...SIZES,TWO_OZ_SIZE]:SIZES;
function computeKitchenFlavor(fd){
 const result=computeFlavor(fd),oz=fd.split.s2||0;
 result.bags.s2=floorBags(oz,2);result.rems.s2=remOz(oz,2);
 result.totalBags+=result.bags.s2;result.totalRetail+=result.bags.s2*2/4.5;
 result.allocOz+=oz;result.unalloc=Number((fd.totalOz-result.allocOz).toFixed(2));
 return result;
}
const ROLES = [{id:"admin",icon:"🧑‍💼",name:"Kevin",desc:"Full dashboard"},{id:"baker",icon:"🥐",name:"Kitchen",desc:"Log completed bakes"},{id:"bagger",icon:"📦",name:"Bag Construction",desc:"Log bags made"}];
const floorBags=(oz,sizeOz)=>oz<=0?0:Math.floor(oz/sizeOz);
const remOz=(oz,sizeOz)=>oz<=0?0:parseFloat((oz-floorBags(oz,sizeOz)*sizeOz).toFixed(2));

function computeFlavor(fd){
  const bags={},rems={};let totalBags=0,totalRetail=0;
  SIZES.forEach(sz=>{bags[sz.key]=floorBags(fd.split[sz.key],sz.oz);rems[sz.key]=remOz(fd.split[sz.key],sz.oz);totalBags+=bags[sz.key];totalRetail+=bags[sz.key]*sz.mult;});
  const allocOz=parseFloat(SIZES.reduce((s,sz)=>s+(fd.split[sz.key]||0),0).toFixed(2));
  const unalloc=parseFloat((fd.totalOz-allocOz).toFixed(2));
  return{bags,rems,totalBags,totalRetail,allocOz,unalloc};
}

const emptyFD=()=>({totalOz:0,split:{s45:0,s15:0,s450:0}});
const emptyQtys=()=>Object.fromEntries(FLAVORS.map(f=>[f,0]));
const barColor=(b,m)=>{const p=b/m;return p>0.4?"var(--gn-m)":p>0.2?"var(--am-m)":"var(--co-m)";};
const chStyle=ch=>ch==="Faire"?{bg:"var(--tl-bg)",color:"var(--tl)"}:ch==="WooCommerce"?{bg:"var(--co-bg)",color:"var(--co)"}:{bg:"var(--bl-bg)",color:"var(--bl)"};
const today=()=>new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});

async function apiCall(action, payload={}) {
  try {
    if (action === "verifyPin") {
      const params = new URLSearchParams({action, role: payload.role, pin: payload.pin});
      const res = await fetch(`${APPS_SCRIPT_URL}?${params}`);
      return await res.json();
    }
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({action, ...payload})
    });
    return await res.json();
  } catch(e) {
    return {success: false, error: e.message};
  }
}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Mulish:wght@400;600;700&family=Patrick+Hand+SC&display=swap');

@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,400;9..144,500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#faf9f6;--surf:#fff;--surf2:#f4f3ef;--bdr:rgba(0,0,0,0.08);--bdr2:rgba(0,0,0,0.15);--tx:#1a1a18;--mu:#6b6b65;--hi:#9b9b94;--gn:#3B6D11;--gn-bg:#EAF3DE;--gn-m:#639922;--am:#854F0B;--am-bg:#FAEEDA;--am-m:#BA7517;--co:#993C1D;--co-bg:#FAECE7;--co-m:#D85A30;--bl:#185FA5;--bl-bg:#E6F1FB;--bl-m:#378ADD;--tl:#0F6E56;--tl-bg:#E1F5EE;--tl-m:#1D9E75;--mono:'DM Mono',monospace;--serif:'Fraunces',serif;--r:10px;--rl:14px}
@media(prefers-color-scheme:dark){:root{--bg:#1c1c1a;--surf:#242422;--surf2:#2c2c2a;--bdr:rgba(255,255,255,0.08);--bdr2:rgba(255,255,255,0.15);--tx:#f0efe8;--mu:#9b9b94;--hi:#5f5e5a;--gn:#C0DD97;--gn-bg:#173404;--gn-m:#639922;--am:#FAC775;--am-bg:#412402;--am-m:#BA7517;--co:#F5C4B3;--co-bg:#4A1B0C;--co-m:#D85A30;--bl:#B5D4F4;--bl-bg:#042C53;--bl-m:#378ADD;--tl:#9FE1CB;--tl-bg:#04342C;--tl-m:#1D9E75}}
html,body{height:100%;background:var(--bg);font-family:var(--mono);color:var(--tx);-webkit-font-smoothing:antialiased}
.role-screen{min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;padding:32px 20px}
.brand h1{font-family:var(--serif);font-size:28px;font-weight:500;text-align:center;letter-spacing:-0.3px}
.brand p{font-size:11px;color:var(--hi);text-transform:uppercase;letter-spacing:1.5px;margin-top:6px;text-align:center}
.role-cards{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;width:100%;max-width:420px}
.role-card{flex:1;min-width:110px;background:var(--surf);border:0.5px solid var(--bdr2);border-radius:var(--rl);padding:24px 16px;cursor:pointer;text-align:center;transition:transform 0.15s;-webkit-tap-highlight-color:transparent}
.role-card:active{transform:scale(0.97)}
.role-icon{font-size:28px;margin-bottom:10px}.role-name{font-size:13px;font-weight:500}.role-desc{font-size:11px;color:var(--hi);margin-top:3px}
.shell{max-width:680px;margin:0 auto;padding:0 0 80px}
.topbar{position:sticky;top:0;z-index:10;background:var(--bg);border-bottom:0.5px solid var(--bdr);padding:14px 16px 12px}
.topbar-inner{display:flex;align-items:center;gap:8px}
.topbar h1{font-family:var(--serif);font-size:18px;font-weight:500;flex:1;letter-spacing:-0.2px}
.topbar-role{font-size:11px;color:var(--hi)}.topbar-date{font-size:11px;color:var(--hi);margin-left:auto}
.switch-btn{font-family:var(--mono);font-size:11px;padding:5px 10px;border:0.5px solid var(--bdr2);border-radius:20px;background:transparent;color:var(--mu);cursor:pointer;-webkit-tap-highlight-color:transparent}
.nav{display:flex;gap:6px;padding:12px 16px 0;overflow-x:auto;scrollbar-width:none}.nav::-webkit-scrollbar{display:none}
.nav-btn{font-family:var(--mono);font-size:11px;padding:6px 14px;border-radius:6px;border:0.5px solid var(--bdr);background:transparent;color:var(--mu);cursor:pointer;white-space:nowrap;text-transform:uppercase;letter-spacing:0.8px;transition:all 0.1s;-webkit-tap-highlight-color:transparent;flex-shrink:0}
.nav-btn.active{background:var(--tx);color:var(--bg);border-color:var(--tx)}
.content{padding:14px 16px}
.metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.metric{background:var(--surf2);border-radius:var(--r);padding:14px 14px 12px}
.m-label{font-size:10px;color:var(--hi);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px}
.m-val{font-size:24px;font-weight:500;font-family:var(--serif);line-height:1}.m-delta{font-size:10px;margin-top:4px;color:var(--hi)}
.m-green .m-val{color:var(--gn-m)}.m-amber .m-val{color:var(--am-m)}.m-coral .m-val{color:var(--co-m)}.m-blue .m-val{color:var(--bl-m)}
.panel{background:var(--surf);border:0.5px solid var(--bdr);border-radius:var(--rl);padding:16px;margin-bottom:12px}
.panel-title{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:var(--hi);margin-bottom:14px;display:flex;align-items:center;gap:7px}
.pdot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.order-row{display:grid;grid-template-columns:68px 1fr auto;align-items:center;gap:8px;padding:9px 0;border-bottom:0.5px solid var(--bdr);font-size:12px}
.order-row:last-child{border-bottom:none}
.o-id{color:var(--hi);font-size:11px}.o-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.o-right{display:flex;align-items:center;gap:6px}.o-amt{font-size:12px;color:var(--mu)}
.badge{font-size:10px;padding:3px 8px;border-radius:20px;font-weight:500;white-space:nowrap}
.b-ship{background:var(--gn-bg);color:var(--gn)}.b-pend{background:var(--am-bg);color:var(--am)}
.inv-row{display:grid;grid-template-columns:1fr 44px 80px;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--bdr);font-size:12px}
.inv-row:last-child{border-bottom:none}.i-qty{text-align:right;color:var(--mu);font-size:11px}
.bar-wrap{height:5px;background:var(--bdr);border-radius:3px;overflow:hidden}
.bar-fill{height:100%;border-radius:3px;transition:width 0.4s ease}
.ch-row{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:0.5px solid var(--bdr);font-size:12px}
.ch-row:last-child{border-bottom:none}.ch-left{display:flex;align-items:center;gap:8px}
.ch-icon{width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:500;flex-shrink:0}
.a-row{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:0.5px solid var(--bdr);font-size:12px}
.a-row:last-child{border-bottom:none}
.a-icon{width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;margin-top:1px}
.a-warn{background:var(--am-bg);color:var(--am)}.a-err{background:var(--co-bg);color:var(--co)}.a-info{background:var(--bl-bg);color:var(--bl)}
.int-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.int-card{background:var(--surf2);border-radius:8px;padding:10px 12px}
.int-name{font-size:11px;font-weight:500;margin-bottom:3px}
.int-st{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--hi)}
.d-live{width:5px;height:5px;border-radius:50%;background:var(--gn-m)}.d-warn{width:5px;height:5px;border-radius:50%;background:var(--am-m)}
.form-hdr{margin-bottom:20px}
.form-hdr h2{font-family:var(--serif);font-size:20px;font-weight:500;margin-bottom:4px}
.form-hdr p{font-size:12px;color:var(--mu);line-height:1.6}
.step-bar{display:flex;align-items:center;margin-bottom:24px}
.step-item{display:flex;align-items:center;gap:6px;font-size:11px}
.step-num{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:500;flex-shrink:0}
.step-num.done{background:var(--gn-m);color:#fff}.step-num.active{background:var(--tx);color:var(--bg)}.step-num.todo{background:var(--surf2);color:var(--hi)}
.step-lbl{color:var(--mu)}.step-lbl.active{color:var(--tx);font-weight:500}
.step-sep{flex:1;height:0.5px;background:var(--bdr);margin:0 8px}
.flavor-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px}
.f-chip{display:flex;align-items:center;gap:8px;background:var(--surf);border:0.5px solid var(--bdr2);border-radius:var(--r);padding:11px 12px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:border-color 0.1s}
.f-chip.sel{border-color:var(--gn-m);background:var(--gn-bg)}
.f-chip.sel .chip-lbl{color:var(--gn)}
.chip-chk{width:16px;height:16px;border-radius:4px;border:0.5px solid var(--bdr2);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px}
.f-chip.sel .chip-chk{background:var(--gn-m);border-color:var(--gn-m);color:#fff}
.chip-lbl{font-size:12px;color:var(--tx);line-height:1.3}
.f-block{background:var(--surf);border:0.5px solid var(--bdr);border-radius:var(--rl);padding:14px;margin-bottom:10px}
.fb-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.fb-name{font-size:13px;font-weight:500}
.fb-tot{font-size:11px;color:var(--hi)}.fb-tot.ok{color:var(--gn-m);font-weight:500}.fb-tot.over{color:var(--co-m);font-weight:500}
.oz-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}.oz-row:last-child{margin-bottom:0}
.oz-lbl{font-size:11px;color:var(--mu);width:38px;flex-shrink:0}
.oz-ctrl{display:flex;align-items:center;gap:8px;flex:1}
.q-btn{width:30px;height:30px;border-radius:7px;border:0.5px solid var(--bdr2);background:var(--surf2);color:var(--tx);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;flex-shrink:0}
.q-btn:active{background:var(--bdr2)}
.q-val{font-size:15px;font-weight:500;font-family:var(--serif);min-width:36px;text-align:center}
.q-val.nz{color:var(--gn-m)}
.oz-conv{font-size:15px;text-align:right;min-width:80px;color:var(--hi)}
.oz-conv .bags{color:var(--gn-m);font-weight:500}.oz-conv .rem{color:var(--am-m);font-size:12px}
.ab-wrap{height:4px;background:var(--bdr);border-radius:2px;overflow:hidden;margin-top:10px}
.ab{height:100%;border-radius:2px;transition:width 0.2s ease}
.ab.ok{background:var(--gn-m)}.ab.over{background:var(--co-m)}.ab.partial{background:var(--am-m)}
.ab-lbl{font-size:10px;margin-top:4px;color:var(--hi)}.ab-lbl.ok{color:var(--gn-m)}.ab-lbl.over{color:var(--co-m)}.ab-lbl.partial{color:var(--am-m)}
.sum-panel{background:var(--surf2);border-radius:var(--r);padding:14px 16px;margin-bottom:16px}
.sum-row{display:flex;justify-content:space-between;font-size:12px;padding:4px 0}
.sum-row .lbl{color:var(--mu)}.sum-row .val{font-weight:500}
.sum-div{border:none;border-top:0.5px solid var(--bdr);margin:8px 0}
.sum-warn{font-size:11px;color:var(--am);margin-top:8px;padding-top:8px;border-top:0.5px solid var(--bdr)}
.bf-row{background:var(--surf);border:0.5px solid var(--bdr);border-radius:var(--r);padding:12px 14px;display:flex;align-items:center;gap:10px;margin-bottom:8px}
.bf-name{flex:1;font-size:13px}
.action-row{display:flex;gap:10px;margin-bottom:16px}
.sec-btn{flex:1;padding:13px;border-radius:var(--r);border:0.5px solid var(--bdr2);background:transparent;font-family:var(--mono);font-size:12px;color:var(--mu);cursor:pointer;-webkit-tap-highlight-color:transparent}
.sub-btn{flex:2;padding:14px;border-radius:var(--r);border:none;background:var(--tx);color:var(--bg);font-family:var(--mono);font-size:13px;font-weight:500;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:opacity 0.15s}
.sub-btn:disabled{opacity:0.35;cursor:not-allowed}.sub-btn:active:not(:disabled){opacity:0.8}
.sub-btn.full{flex:unset;width:100%}
.suc-box{background:var(--gn-bg);color:var(--gn);border-radius:var(--r);padding:14px 16px;font-size:13px;text-align:center;margin-top:14px}
.err-box{background:var(--co-bg);color:var(--co);border-radius:var(--r);padding:14px 16px;font-size:13px;text-align:center;margin-top:14px}
.pc-toggle{display:flex;gap:6px;margin-bottom:16px}
.pc-toggle-btn{flex:1;padding:8px;border-radius:var(--r);border:0.5px solid var(--bdr2);background:transparent;font-family:var(--mono);font-size:12px;color:var(--mu);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:all 0.1s}
.pc-toggle-btn.active{background:var(--tx);color:var(--bg);border-color:var(--tx)}
.pc-total-badge{margin-left:auto;background:var(--am-m);color:#fff;font-size:12px;font-weight:500;padding:5px 12px;border-radius:20px;font-family:var(--mono)}
.pc-total-badge.has-count{background:var(--gn-m)}
.pc-flavor-block{background:var(--surf);border:0.5px solid var(--bdr);border-radius:var(--rl);padding:14px;margin-bottom:10px}
.pc-flavor-name{font-size:13px;font-weight:500;margin-bottom:12px;color:var(--tx)}
.pc-input-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.pc-input-row:last-of-type{margin-bottom:0}
.pc-input-lbl{font-size:11px;color:var(--mu);flex:1}
.pc-counter{display:flex;align-items:center;gap:8px}
.pc-bag-total{font-size:11px;color:var(--gn-m);font-weight:500;text-align:right;margin-top:8px;padding-top:8px;border-top:0.5px solid var(--bdr)}
.pc-bag-total.zero{color:var(--hi)}
.pc-summary-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:0.5px solid var(--bdr);font-size:12px}
.pc-summary-row:last-child{border-bottom:none}
.pc-summary-flavor{color:var(--tx)}
.pc-summary-bags{font-weight:500;color:var(--gn-m)}
.pc-summary-bags.zero{color:var(--hi);font-weight:400}
.pc-warn-box{background:var(--am-bg);color:var(--am);border-radius:var(--r);padding:12px 14px;font-size:12px;margin-bottom:14px;line-height:1.5}
@media(min-width:540px){.metrics{grid-template-columns:repeat(4,1fr)}.flavor-grid{grid-template-columns:repeat(3,1fr)}}
body .visibility-row{display:flex;gap:12px;align-items:center;min-height:56px;padding:12px 0;border-bottom:1px solid var(--bdr)}body .visibility-row input{width:24px;height:24px;accent-color:#e8be35}body .visibility-row small{display:block;font-size:13px;margin-top:4px;color:var(--mu)}
body .planning-row{display:grid;grid-template-columns:minmax(140px,2fr) 1fr 1fr;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--bdr)}
body .planning-row label{display:flex;flex-direction:column;gap:6px;font-size:14px}
body .planning-row input{width:100%;min-height:48px;padding:10px;border:1px solid var(--bdr2);border-radius:8px;font:inherit;background:var(--surf);color:var(--tx)}
body .plan-editor .sub-btn{margin-top:16px}
@media(max-width:539px){body .planning-row{grid-template-columns:1fr 1fr}body .planning-row strong{grid-column:1/-1}}
/* Additive sizing/layout only: bake arithmetic and bulk controls are unchanged. */
html body{font-family:'Mulish',sans-serif;font-size:16px}
body .shell{max-width:1280px;padding-bottom:48px}
body .topbar h1,body .form-hdr h2,body h2,body h3,body .brand h1{font-family:'Patrick Hand SC',sans-serif;font-weight:bold}
body .topbar h1{font-size:28px}body .form-hdr h2,body h2{font-size:30px}body h3{font-size:24px}
body .topbar-role,body .topbar-date{font-size:13px;color:var(--mu)}
body .section-nav{position:sticky;top:63px;z-index:9;display:flex;gap:8px;padding:10px 16px;background:var(--bg);border-bottom:1px solid var(--bdr)}
body button,body input,body select{font-family:'Mulish',sans-serif}
body .section-nav button{flex:1;min-height:48px;padding:8px;border:1px solid var(--bdr2);background:var(--surf);color:var(--tx);border-radius:8px;font-size:16px;font-weight:700}
body .section-nav button.active,body .sub-btn,body .nav-btn.active{background:#e8be35;color:#262626;border-color:#e8be35}
body .q-btn{width:46px;height:46px;font-size:22px}body .q-val{font-family:'Mulish',sans-serif;font-size:18px;min-width:40px}
body .nav{padding:0 0 16px;flex-wrap:wrap;overflow:visible}
body .nav-btn{min-height:44px;font-size:14px;letter-spacing:0;text-transform:none;white-space:normal;padding:8px 12px}
body .sec-btn,body .sub-btn{min-height:48px;font-size:16px;flex:initial;padding:12px 16px}
body .action-row .sub-btn{flex:2}body .action-row .sec-btn{flex:1}
body .form-hdr p,body .help{font-size:16px;line-height:1.55;color:var(--mu);margin:8px 0 16px}
body .f-chip{min-height:56px;text-align:left;font-size:16px;color:var(--tx)}body .chip-lbl{font-size:16px}
body .step-item,body .step-lbl{font-size:14px}body .step-num{width:28px;height:28px;font-size:14px}
body .fb-name,body .bf-name{font-size:17px}body .fb-tot{font-size:14px}
body .oz-lbl{font-size:15px;width:52px}body .oz-conv{font-size:17px;min-width:88px}
body .oz-row input{font-size:18px!important;min-height:48px}body .oz-row{gap:8px}
body .sum-row{font-size:16px}body .sum-warn{font-size:15px;line-height:1.5}
body .draft-note{font-size:14px;padding:12px;border-left:3px solid #e8be35;background:var(--surf2);margin-bottom:16px;line-height:1.5}
body .read-status{padding:12px;background:var(--surf2);border-radius:8px;margin-bottom:14px;font-size:14px;line-height:1.5}
body .read-status button{margin-top:8px;background:var(--surf);font-size:14px}
body .feed-status{font-size:14px;line-height:1.6;margin-bottom:16px}
body .plan-card,body .receipt{border:1px solid var(--bdr2);border-radius:12px;background:var(--surf);padding:16px;margin-bottom:12px;overflow-wrap:anywhere}
body .plan-name{display:flex;align-items:center;gap:10px;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap}
body .plan-numbers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:12px}
body .plan-numbers span{display:block;font-size:14px;color:var(--mu)}body .plan-numbers strong{display:block;font-size:23px;font-variant-numeric:tabular-nums;margin-top:4px}
body .badge{font-size:13px;white-space:normal}
body details summary{cursor:pointer;min-height:44px;padding:10px 0;font-size:15px}
body .package-details{font-size:14px;line-height:1.65}
body .notice{color:var(--co);background:var(--co-bg);padding:10px;border-radius:8px;font-size:15px;line-height:1.5;margin:8px 0}
body .receipt p,body .receipt li{font-size:15px;line-height:1.6;margin-bottom:8px}body .receipt ul{padding-left:20px}
body .receipt small{color:var(--mu);font-size:12px}body .recent-bakes h2{margin-bottom:10px}
body .running-row{padding:12px 0;border-bottom:1px solid var(--bdr)}body .running-row p{line-height:1.6;font-size:15px}
body .order-row{grid-template-columns:minmax(70px,1fr) minmax(0,2fr) auto;font-size:15px}
body [hidden]{display:none!important}body .kitchen-aside{margin-top:24px}
@media(min-width:850px){body .content{padding:24px}body .kitchen-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:28px;align-items:start}body .kitchen-aside{margin-top:0;position:sticky;top:135px;max-height:calc(100vh - 150px);overflow-y:auto}body .dashboard-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:28px;align-items:start}body .plan-numbers{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:400px){body .oz-row{flex-wrap:wrap}body .oz-conv{margin-left:auto}body .section-nav{gap:4px;padding:8px}body .section-nav button{font-size:14px;padding:6px}body .step-item{gap:4px}body .step-sep{margin:0 4px}body .topbar-date{display:none}}
body .content p,body .content label{font-size:16px!important}
body .content button{min-height:44px}
body .content button:not(.q-btn):not(.f-chip){font-size:15px!important}
body .ab-lbl{font-size:14px}body .chip-lbl{color:var(--tx)}

`;

function Panel({title,dot,children}){
  return <div className="panel"><div className="panel-title"><span className="pdot" style={{background:dot}}/>{title}</div>{children}</div>;
}

function StepBar({steps,current}){
  return(
    <div className="step-bar">
      {steps.map((s,i)=>(
        <React.Fragment key={i}>
          {i>0&&<div className="step-sep"/>}
          <div className="step-item">
            <span className={`step-num ${i<current?"done":i===current?"active":"todo"}`}>{i<current?"✓":i+1}</span>
            <span className={`step-lbl${i===current?" active":""}`}>{s}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function BakerForm({workspace}){
  const [draft]=useState(readDraft);
  const [step,setStep]=useState(draft.step||0);
  const [selected,setSelected]=useState(new Set((draft.selected||[]).filter(f=>KITCHEN_FLAVORS.includes(f))));
  const [fd,setFd]=useState(draft.fd||{});
  const [active,setActive]=useState(draft.active||null);
  const [draftError,setDraftError]=useState(draft.unreadable?'An unfinished entry could not be read. Keep this browser’s saved data and ask for recovery before entering another bake.':'');
  useEffect(()=>{
    if(draft.unreadable)return;
    try{writeDraft({step,selected:[...selected],fd,active});setDraftError('');}
    catch(e){setDraftError('This browser could not save your unfinished entry. Keep this page open until you submit.');}
  },[step,selected,fd,active]);
  const [status,setStatus]=useState(null);
  const [message,setMessage]=useState("");
  const [outbox,setOutbox]=useState(()=>{try{return pendingBake();}catch(e){return {invalid:true};}});
  const selFlavors=KITCHEN_FLAVORS.filter(f=>selected.has(f));

  function toggleFlavor(f){
    setSelected(s=>{const n=new Set(s);n.has(f)?n.delete(f):n.add(f);return n;});
    setFd(d=>d[f]?d:{...d,[f]:emptyFD()});
  }

  function setTotalOz(flavor,val){
    const oz=Math.max(0,val);
    setFd(d=>({...d,[flavor]:{...d[flavor],totalOz:oz,split:{s45:oz,s15:0,s450:0},size:undefined,sizeOk:false}}));
  }

  function setSplit(flavor,skey,val){
    setFd(d=>{
      const cur=d[flavor]||emptyFD();
      const newSplit={...cur.split,[skey]:Math.max(0,parseFloat(val)||0)};
      if(skey!=="s45"){
        const usedByLarger=(newSplit.s15||0)+(newSplit.s450||0)+(newSplit.s2||0);
        newSplit.s45=Math.max(0,parseFloat((cur.totalOz-usedByLarger).toFixed(2)));
      }
      return{...d,[flavor]:{...cur,split:newSplit}};
    });
  }

  function getAlloc(flavor){
    const data=fd[flavor]||emptyFD();
    const allocOz=parseFloat(kitchenSizes(flavor).reduce((s,sz)=>s+(data.split[sz.key]||0),0).toFixed(2));
    const rem=parseFloat((data.totalOz-allocOz).toFixed(2));
    const pct=data.totalOz>0?Math.min(100,Math.round(allocOz/data.totalOz*100)):0;
    return{allocOz,rem,pct,over:rem<-0.01,exact:Math.abs(rem)<0.01};
  }

  const fi=selFlavors.indexOf(active);
  const isLast=fi===selFlavors.length-1;

  function nextFlavor(){isLast?setStep(2):setActive(selFlavors[fi+1]);}
  function prevFlavor(){fi>0?setActive(selFlavors[fi-1]):setStep(0);}

  function getSummary(){
    let totOz=0,totBags={s45:0,s15:0,s450:0,s2:0},totRetail=0;const rems=[];
    selFlavors.forEach(f=>{
      const data=fd[f]||emptyFD();const comp=computeKitchenFlavor(data);
      totOz+=data.totalOz;
      kitchenSizes(f).forEach(sz=>{totBags[sz.key]+=comp.bags[sz.key];});
      totRetail+=comp.totalRetail;
      kitchenSizes(f).forEach(sz=>{if(comp.rems[sz.key]>0.01)rems.push(f+" "+sz.label);});
    });
    return{totOz:parseFloat(totOz.toFixed(2)),totBags,totRetail,rems};
  }

  async function submit(){
    if(status==="loading")return;
    setStatus("loading");setMessage("");
    try {
      if(outbox?.invalid)throw new Error("Saved entry needs recovery; do not clear browser storage.");
      if(!pendingBake()) {
        const flavors=Object.fromEntries(selFlavors.map(f=>{
          const data=fd[f]||emptyFD(),comp=computeKitchenFlavor(data);
          const opts=KITCHEN_BATCH_SIZES[f]||[],chosen=opts.find(o=>o.size===data.size);
          if(!data.sizeOk||!chosen)throw new Error("Confirm the batch size for "+f+".");
          if(["Chocolate Graham","Cluck Yeah!"].includes(f)&&comp.bags.s450>0)throw new Error(f+" with 45 oz bags cannot be sent automatically. Keep this entry for manual handling; do not submit it here.");
          if(data.totalOz<=0 || getAlloc(f).over || comp.totalBags<=0)throw new Error("Check the ounces and bag allocation.");
          return [f,{totalOz:data.totalOz,split:data.split,bags:comp.bags,batches:[{recipeId:chosen.recipeId,count:1}]}];
        }));
        saveBake({flavors,timestamp:new Date().toISOString()});
      }
      setOutbox(pendingBake());
      const result=await sendSavedBake();
      setStatus("success");setOutbox(null);setMessage(result.posted?"Bake already posted to SOS.":"Bake saved once. Inventory posting is pending; do not enter it again.");
      setSelected(new Set());setFd({});setStep(0);setActive(null);window.dispatchEvent(new Event("jc-bake-saved"));
    } catch(e) {setStatus("error");setMessage(e.message);try{setOutbox(pendingBake());}catch(_){}}
  }

  const summary=step===2?getSummary():null;
  const unsupportedBulk=["Chocolate Graham","Cluck Yeah!"].some(f=>selected.has(f)&&(fd[f]?.split?.s450||0)>0);

  return(
    <div className="content">
      <div className="form-hdr">
        <h2>Log completed bake</h2>
        <p>Record ounces produced per flavor—bags calculated automatically.</p>
      </div>
      <p className="draft-note" role="status">{draftError||'Unfinished entries save automatically on this device. They have not been submitted.'}</p>
      {message&&<div className={status==='error'?'err-box':'suc-box'} role="status">{message}</div>}
      {outbox&&<div className="sum-warn">A bake is saved on this device. {outbox.timestamp} {outbox.flavors&&Object.keys(outbox.flavors).join(", ")}
        <button disabled={status==="loading"||outbox.invalid} onClick={submit}>Send saved bake</button></div>}
      <div className="kitchen-layout"><section>
      <fieldset disabled={!!outbox || draft.unreadable || status==="loading"} style={{border:0,padding:0}}>
      <StepBar steps={["Flavors","Ounces","Review"]} current={step}/>
      {step===0&&(
        <>
          <p style={{fontSize:12,color:"var(--mu)",marginBottom:12}}>Which flavors were baked this session?</p>
          <div className="flavor-grid">
            {workspace.data&&KITCHEN_FLAVORS.filter(f=>shown(workspace.data,f)).map(f=>(
              <button type="button" key={f} aria-pressed={selected.has(f)} className={`f-chip${selected.has(f)?" sel":""}`} onClick={()=>toggleFlavor(f)}>
                <span className="chip-chk">{selected.has(f)?"✓":""}</span>
                <span className="chip-lbl">{f}</span>
              </button>
            ))}
          </div>
          {workspace.data&&SHORTBREAD.some(name=>shown(workspace.data,name))&&<details className="panel"><summary>Seasonal and special-order shortbread</summary><p className="help">Lavender Shortbread Single, Lavender Shortbread 6-Pack, and individually packaged Shortbread Cookies remain in the plan. A production recipe must be selected for the specific order before Kitchen can post them.</p></details>}
          <button className="sub-btn full" disabled={selected.size===0} onClick={()=>{setActive(selFlavors[0]);setStep(1);}}>
            Next — enter ounces ({selected.size} flavor{selected.size!==1?"s":""})
          </button>
        </>
      )}
      {unsupportedBulk&&<p className="notice" role="alert">This Chocolate Graham or Cluck entry allocates ounces to unsupported 45 oz bags. Automatic posting does not support that combination. Keep this draft; do not submit it here.</p>}
      {step===1&&active&&(()=>{
        const data=fd[active]||emptyFD();
        const alloc=getAlloc(active);
        return(
          <>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
              {selFlavors.map((f,i)=>{
                const done=(fd[f]||emptyFD()).totalOz>0&&i!==fi;
                return(
                  <button key={f} onClick={()=>setActive(f)} style={{fontSize:10,padding:"4px 10px",borderRadius:20,border:`0.5px solid ${f===active?"var(--tx)":"var(--bdr2)"}`,background:f===active?"var(--tx)":done?"var(--gn-bg)":"transparent",color:f===active?"var(--bg)":done?"var(--gn)":"var(--mu)",cursor:"pointer",fontFamily:"var(--mono)",WebkitTapHighlightColor:"transparent"}}>
                    {done?"✓ ":""}{f}
                  </button>
                );
              })}
            </div>
            <div className="f-block">
              <div className="fb-hdr">
                <span className="fb-name">{active}</span>
                <span className={`fb-tot${data.totalOz>0?(alloc.over?" over":alloc.exact?" ok":""):""}` }>
                  {data.totalOz>0?`${data.totalOz} oz total`:"enter total oz"}
                </span>
              </div>
              <div className="oz-row" style={{marginBottom:14,paddingBottom:12,borderBottom:"0.5px solid var(--bdr)"}}>
                <label htmlFor="bake-total-oz" style={{fontSize:16,color:"var(--tx)",fontWeight:500,marginRight:8,flexShrink:0}}>Total oz</label>
                <input id="bake-total-oz" type="number" min="0" inputMode="decimal" value={data.totalOz||""} placeholder="0"
                  onChange={e=>setTotalOz(active,parseFloat(e.target.value)||0)}
                  style={{width:80,padding:"6px 10px",border:"0.5px solid var(--bdr2)",borderRadius:"var(--r)",background:"var(--surf2)",color:"var(--tx)",fontFamily:"var(--mono)",fontSize:14,fontWeight:500,textAlign:"right"}}
                />
              </div>
              {data.totalOz>0&&(
                <>
                  <p style={{fontSize:11,color:"var(--hi)",marginBottom:10}}>Allocate ounces to bulk bags; 4.5oz fills automatically. Changing total ounces resets allocations.</p>
                  {TWO_OZ_FLAVORS.includes(active)&&<p className="help">You can also allocate ounces to 2 oz bags below. These use standard packaging for now.</p>}
                  {kitchenSizes(active).map(sz=>{
                    const soz=data.split[sz.key]||0;
                    const b=floorBags(soz,sz.oz);const r=remOz(soz,sz.oz);
                    const isAuto=sz.key==="s45";
                    return(
                      <div className="oz-row" key={sz.key}>
                        <span className="oz-lbl">{sz.label}{isAuto&&<span style={{fontSize:9,color:"var(--hi)",marginLeft:4}}>auto</span>}</span>
                        {isAuto?(
                          <input type="number" readOnly value={soz||""} style={{width:80,padding:"6px 10px",border:"0.5px solid var(--bdr)",borderRadius:"var(--r)",background:"var(--surf)",color:"var(--mu)",fontFamily:"var(--mono)",fontSize:14,fontWeight:500,textAlign:"right",cursor:"default"}}/>
                        ):(
                          <div className="oz-ctrl">
                            <button className="q-btn" onClick={()=>setSplit(active,sz.key,Math.max(0,soz-sz.oz))}>−</button>
                            <span className={`q-val${soz>0?" nz":""}`}>{soz}</span>
                            <button className="q-btn" onClick={()=>setSplit(active,sz.key,soz+sz.oz)}>+</button>
                          </div>
                        )}
                        <div className="oz-conv">
                          {soz>0&&<><span className="bags">{b} bag{b!==1?"s":""}</span>{r>0&&<span className="rem"> +{r}oz</span>}</>}
                        </div>
                      </div>
                    );
                  })}
                  <div className="ab-wrap">
                    <div className={`ab ${alloc.over?"over":alloc.exact?"ok":"partial"}`} style={{width:`${Math.min(100,alloc.pct)}%`}}/>
                  </div>
                  <div className={`ab-lbl ${alloc.over?"over":alloc.exact?"ok":"partial"}`}>
                    {alloc.over?`Over by ${Math.abs(alloc.rem).toFixed(2)} oz`:alloc.exact?"Fully allocated ✓":`${alloc.rem} oz unallocated`}
                  </div>
                </>
              )}
            </div>
            <div className="action-row">
              <button className="sec-btn" onClick={prevFlavor}>{fi===0?"← Flavors":"← Prev"}</button>
              <button className="sub-btn" disabled={data.totalOz===0} onClick={nextFlavor}>
                {isLast?"Review →":`Next: ${selFlavors[fi+1]?.split(" ")[0]} →`}
              </button>
            </div>
          </>
        );
      })()}
      {step===2&&summary&&(
        <>
          <div className="sum-panel">
            <div className="sum-row"><span className="lbl">Flavors this bake</span><span className="val">{selFlavors.length}</span></div>
            <div className="sum-row"><span className="lbl">Total ounces</span><span className="val">{summary.totOz} oz</span></div>
            <hr className="sum-div"/>
            {[...SIZES,TWO_OZ_SIZE].map(sz=>summary.totBags[sz.key]>0&&(
              <div className="sum-row" key={sz.key}><span className="lbl">{sz.label} bags</span><span className="val" style={{color:"var(--gn-m)"}}>{summary.totBags[sz.key]}</span></div>
            ))}
            <hr className="sum-div"/>
            <div className="sum-row"><span className="lbl">Retail bag equivalents</span><span className="val" style={{color:"var(--bl-m)"}}>{displayNumber(summary.totRetail)}</span></div>
            {summary.rems.length>0&&<div className="sum-warn">Leftover oz (not counted): {summary.rems.join(", ")}</div>}
          </div>
          {selFlavors.map(f=>{
            const data=fd[f]||emptyFD();const comp=computeKitchenFlavor(data);
            return(
              <div key={f} style={{background:"var(--surf)",border:"0.5px solid var(--bdr)",borderRadius:"var(--r)",padding:"10px 14px",marginBottom:8,fontSize:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontWeight:500}}>{f}</span><span style={{color:"var(--hi)"}}>{data.totalOz} oz</span>
                </div>
                <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                  {kitchenSizes(f).map(sz=>comp.bags[sz.key]>0&&(
                    <span key={sz.key} style={{fontSize:11,background:"var(--gn-bg)",color:"var(--gn)",padding:"2px 8px",borderRadius:20}}>
                      {comp.bags[sz.key]} × {sz.label}
                      {comp.rems[sz.key]>0&&<span style={{color:"var(--am-m)"}}> (+{comp.rems[sz.key]}oz)</span>}
                    </span>
                  ))}
                </div>
                {(()=>{const opts=KITCHEN_BATCH_SIZES[f]||[],size=data.size??guessSize(opts,data.totalOz);return(
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginTop:8}}>
                    <span style={{fontSize:11,color:"var(--mu)"}}>Batch size:</span>
                    {opts.map(o=>{const on=o.size===size;return(
                      <button key={o.size} onClick={()=>setFd(d=>({...d,[f]:{...d[f],size:o.size,sizeOk:true}}))}
                        style={{fontSize:12,padding:"6px 12px",borderRadius:20,border:"0.5px solid var(--bdr2)",background:on&&data.sizeOk?"var(--gn-m)":on?"var(--surf2)":"transparent",color:on&&data.sizeOk?"#fff":"var(--tx)",fontWeight:on?500:400,cursor:"pointer",fontFamily:"var(--mono)"}}>
                        {on&&data.sizeOk?"✓ ":on?"Confirm ":""}{o.size}
                      </button>);})}
                  </div>);})()}
              </div>
            );
          })}
          <div className="action-row">
            <button className="sec-btn" onClick={()=>setStep(1)}>← Edit</button>
            <button className="sub-btn" disabled={unsupportedBulk||status==="loading"||selFlavors.some(f=>!(fd[f]||{}).sizeOk)} onClick={submit}>
              {status==="loading"?"Submitting…":"Submit bake"}
            </button>
          </div>
          
          
        </>
      )}
      </fieldset>
      </section><aside className="kitchen-aside"><div className="panel"><h3>This unfinished bake</h3>{selFlavors.length===0?<p>No flavors selected yet.</p>:selFlavors.map(f=>{const data=fd[f]||emptyFD(),c=computeKitchenFlavor(data);return <div className="running-row" key={f}><strong>{f}</strong><p>{data.totalOz} oz total</p><p>{kitchenSizes(f).map(sz=>`${c.bags[sz.key]} × ${sz.label}`).join(' · ')}</p></div>;})}<p className="help">Calculated from your ounces and bulk allocation. These figures are not submitted yet.</p></div><RecentBakes workspace={workspace}/></aside></div>
    </div>
  );
}

function BaggerForm(){
  const [qtys,setQtys]=useState(emptyQtys());
  const [status,setStatus]=useState(null);
  const [receipt,setReceipt]=useState(()=>{try{return JSON.parse(localStorage.getItem('jc-empty-bag-receipt')||'null');}catch(e){return null;}});
  const total=Object.values(qtys).reduce((a,b)=>a+b,0);
  const set=(f,v)=>setQtys(q=>({...q,[f]:Math.max(0,v)}));

  async function submit(){
    if(total===0||status==="loading")return;
    setStatus("loading");
    const res=await apiCall("logBagging",{quantities:qtys,timestamp:new Date().toISOString()});
    setStatus(res.success?"success":"error");
    if(res.success){const saved={timestamp:res.timestamp||new Date().toISOString(),quantities:{...qtys},total};setReceipt(saved);try{localStorage.setItem('jc-empty-bag-receipt',JSON.stringify(saved));}catch(e){}setQtys(emptyQtys());}
  }

  return(
    <div className="content">
      <div className="form-hdr"><h2>Empty bag construction</h2><p>Record empty bags made for each flavor. This does not add finished crackers to stock.</p></div>
      {FLAVORS.map(f=>(
        <div key={f} className="bf-row">
          <span className="bf-name">{f}</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button className="q-btn" disabled={status==="loading"||status==="error"} onClick={()=>set(f,qtys[f]-1)}>−</button>
            <span className={`q-val${qtys[f]>0?" nz":""}`}>{qtys[f]}</span>
            <button className="q-btn" disabled={status==="loading"||status==="error"} onClick={()=>set(f,qtys[f]+1)}>+</button>
          </div>
        </div>
      ))}
      <div style={{fontSize:12,color:"var(--mu)",textAlign:"right",margin:"12px 0"}}>Total: <strong style={{color:"var(--tx)"}}>{total} bag{total!==1?"s":""}</strong></div>
      <button className="sub-btn full" disabled={total===0||status==="loading"||status==="error"} onClick={submit}>
        {status==="loading"?"Submitting…":`Submit session — ${total} bag${total!==1?"s":""}`}
      </button>
      {status==="success"&&<div className="suc-box">Empty-bag session saved. Your counts are shown below.</div>}
      {receipt&&<article className="receipt"><h3>Last saved empty-bag session</h3><p>{new Date(receipt.timestamp).toLocaleString()}</p>{Object.entries(receipt.quantities).filter(([,q])=>q>0).map(([f,q])=><p key={f}>{f}: {q} empty bags</p>)}<strong>Total: {receipt.total} empty bags</strong></article>}
      {status==="error"&&<div className="err-box">The save was not confirmed. Keep these counts and check the Bagger Log before sending again, so the session is not counted twice.</div>}
    </div>
  );
}

export default function App(){
  const [screen, setScreen] = useState("roles");
  const [role, setRole] = useState(null);
  const workspace=useWorkspace(apiCall);
  const roleLabel = ROLES.find(r => r.id === role)?.name;

  function selectRole(id) { setRole(id); setScreen("app"); }
  function switchRole() { setScreen("roles"); }

  if (screen === "roles") return (
    <>
      <style>{CSS}</style>
      <div className="role-screen">
        <div className="brand"><h1>Jack's Crackers</h1><p>Operations</p></div>
        <div className="role-cards">
          {ROLES.map(r => (
            <div className="role-card" key={r.id} onClick={() => selectRole(r.id)}>
              <div className="role-icon">{r.icon}</div>
              <div className="role-name">{r.name}</div>
              <div className="role-desc">{r.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="shell">
        <div className="topbar">
          <div className="topbar-inner">
            <h1>Jack's Crackers</h1>
            <span className="topbar-role">{roleLabel}</span>
            <span className="topbar-date">{today()}</span>

          </div>
        </div>
        <nav className="section-nav" aria-label="App sections">{ROLES.map(r=><button key={r.id} onClick={()=>setRole(r.id)} aria-current={role===r.id?'page':undefined} className={role===r.id?'active':''}>{r.name}</button>)}</nav>
        <div hidden={role!=="admin"}><Dashboard workspace={workspace} onKitchen={()=>setRole('baker')}/></div>
        <div hidden={role!=="baker"}><BakerForm workspace={workspace}/></div>
        <div hidden={role!=="bagger"}><BaggerForm/></div>
      </div>
    </>
  );
}
