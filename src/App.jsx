import { useState, useEffect } from "react";
import React from "react";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxp0OOtSZKJ_bW8kSoU7Bc7PKYNEGy9bScswDWTjN8CbxaDg9Wwp5tymCDc_6tMdq_g/exec";
const FLAVORS = ["Red Wine","White Wine","Tomato Basil","Garlic Herb","Buttermilk Bacon","Lavender Rosemary","Cracked Pepper & Sage","Spicy Chocolate Mint","Chocolate Graham","Graham Crackers"];
const SIZES = [{key:"s45",label:"4.5oz",oz:4.5,mult:1},{key:"s15",label:"15oz",oz:15,mult:4},{key:"s450",label:"45oz",oz:45,mult:10}];
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

const MOCK_INV=FLAVORS.map((flavor,i)=>({flavor,bags:[48,52,18,35,22,14,40,28,9,31][i],max:60}));
const MOCK_ORDERS=[{id:"INV-101",customer:"Hanover Co-op",channel:"Faire",status:"pending",amount:186},{id:"INV-100",customer:"Website Retail",channel:"WooCommerce",status:"shipped",amount:34},{id:"INV-99",customer:"Monadnock Market",channel:"Direct",status:"shipped",amount:220},{id:"INV-98",customer:"Live Sales",channel:"Direct",status:"shipped",amount:62},{id:"INV-97",customer:"Peterborough Nat.",channel:"Direct",status:"pending",amount:155}];

async function apiCall(action,payload={}){
  try{
    if(action==="verifyPin"){
      const params=new URLSearchParams({action,role:payload.role,pin:payload.pin});
      const res=await fetch(`${APPS_SCRIPT_URL}?${params}`);
      return await res.json();
    }
    const res=await fetch(APPS_SCRIPT_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});
    return await res.json();
  }catch(e){return{success:false,error:e.message};}
}

const CSS=`
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
.a-sub{color:var(--mu);font-size:11px;display:block;margin-top:2px}
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
.demo-banner{background:var(--am-bg);color:var(--am);font-size:11px;text-align:center;padding:8px 16px}
@media(min-width:540px){.metrics{grid-template-columns:repeat(4,1fr)}.flavor-grid{grid-template-columns:repeat(3,1fr)}}
.pin-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100svh;padding:32px 20px;gap:0}
.pin-card{background:var(--surf);border:0.5px solid var(--bdr2);border-radius:var(--rl);padding:28px 24px;width:100%;max-width:300px;text-align:center}
.pin-role-icon{font-size:26px;margin-bottom:8px}
.pin-role-name{font-size:15px;font-weight:500;margin-bottom:3px}
.pin-prompt{font-size:11px;color:var(--hi);margin-bottom:20px;line-height:1.5}
.pin-dots{display:flex;gap:12px;justify-content:center;margin-bottom:22px}
.pin-dot{width:11px;height:11px;border-radius:50%;border:1.5px solid var(--bdr2);transition:all 0.12s}
.pin-dot.filled{background:var(--tx);border-color:var(--tx)}
.pin-dot.error{background:var(--co-m);border-color:var(--co-m)}
.pin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:220px;margin:0 auto}
.pin-key{height:50px;border-radius:var(--r);border:0.5px solid var(--bdr2);background:var(--surf2);font-family:var(--mono);font-size:18px;font-weight:500;color:var(--tx);cursor:pointer;transition:background 0.1s;-webkit-tap-highlight-color:transparent}
.pin-key:active:not(:disabled){background:var(--bdr2)}
.pin-key.del{font-size:13px;color:var(--mu)}
.pin-key.empty{border:none;background:transparent;cursor:default;pointer-events:none}
.pin-error{font-size:11px;color:var(--co-m);margin-top:12px;min-height:16px;text-align:center}
.pin-back{font-family:var(--mono);font-size:11px;color:var(--hi);background:none;border:none;cursor:pointer;padding:16px 0 0;display:block;margin:0 auto}
`;


// ── SHARED ────────────────────────────────────────────────────────────────────
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

// ── BAKER FORM ────────────────────────────────────────────────────────────────
function BakerForm(){
  const [step,setStep]=useState(0);
  const [selected,setSelected]=useState(new Set());
  const [fd,setFd]=useState({});
  const [active,setActive]=useState(null);
  const [status,setStatus]=useState(null);

  const selFlavors=FLAVORS.filter(f=>selected.has(f));

  function toggleFlavor(f){
    setSelected(s=>{const n=new Set(s);n.has(f)?n.delete(f):n.add(f);return n;});
    setFd(d=>d[f]?d:{...d,[f]:emptyFD()});
  }

  function setTotalOz(flavor,val){
    const oz=Math.max(0,val);
    // Auto-fill all oz into 4.5oz — larger sizes start at 0
    setFd(d=>({...d,[flavor]:{...d[flavor],totalOz:oz,split:{s45:oz,s15:0,s450:0}}}));
  }

  function setSplit(flavor,skey,val){
    setFd(d=>{
      const cur=d[flavor]||emptyFD();
      const newSplit={...cur.split,[skey]:Math.max(0,parseFloat(val)||0)};
      // Recalculate 4.5oz as remainder after larger sizes
      if(skey!=="s45"){
        const usedByLarger=(newSplit.s15||0)+(newSplit.s450||0);
        newSplit.s45=Math.max(0,parseFloat((cur.totalOz-usedByLarger).toFixed(2)));
      }
      return{...d,[flavor]:{...cur,split:newSplit}};
    });
  }

  function getAlloc(flavor){
    const data=fd[flavor]||emptyFD();
    const allocOz=parseFloat(SIZES.reduce((s,sz)=>s+(data.split[sz.key]||0),0).toFixed(2));
    const rem=parseFloat((data.totalOz-allocOz).toFixed(2));
    const pct=data.totalOz>0?Math.min(100,Math.round(allocOz/data.totalOz*100)):0;
    return{allocOz,rem,pct,over:rem<-0.01,exact:Math.abs(rem)<0.01};
  }

  const fi=selFlavors.indexOf(active);
  const isLast=fi===selFlavors.length-1;

  function nextFlavor(){isLast?setStep(2):setActive(selFlavors[fi+1]);}
  function prevFlavor(){fi>0?setActive(selFlavors[fi-1]):setStep(0);}

  function getSummary(){
    let totOz=0,totBags={s45:0,s15:0,s450:0},totRetail=0;const rems=[];
    selFlavors.forEach(f=>{
      const data=fd[f]||emptyFD();const comp=computeFlavor(data);
      totOz+=data.totalOz;
      SIZES.forEach(sz=>{totBags[sz.key]+=comp.bags[sz.key];});
      totRetail+=comp.totalRetail;
      SIZES.forEach(sz=>{if(comp.rems[sz.key]>0.01)rems.push(f+" "+sz.label);});
    });
    return{totOz:parseFloat(totOz.toFixed(2)),totBags,totRetail,rems};
  }

  async function submit(){
    if(status==="loading")return;
    setStatus("loading");
    const payload={
      flavors:Object.fromEntries(selFlavors.map(f=>{
        const data=fd[f]||emptyFD();const comp=computeFlavor(data);
        return[f,{totalOz:data.totalOz,split:data.split,bags:comp.bags,rems:comp.rems,totalBags:comp.totalBags,totalRetail:comp.totalRetail}];
      })),
      summary:getSummary(),
      timestamp:new Date().toISOString(),
    };
    const res=await apiCall("logBake",payload);
    setStatus(res.success?"success":"error");
    if(res.success)setTimeout(()=>{setStep(0);setSelected(new Set());setFd({});setStatus(null);},2500);
  }

  const summary=step===2?getSummary():null;

  return(
    <div className="content">
      <div className="form-hdr">
        <h2>Log completed bake</h2>
        <p>Record ounces produced per flavor — bags calculated automatically.</p>
      </div>
      <StepBar steps={["Flavors","Ounces","Review"]} current={step}/>

      {/* STEP 0: SELECT FLAVORS */}
      {step===0&&(
        <>
          <p style={{fontSize:12,color:"var(--mu)",marginBottom:12}}>Which flavors were baked this session?</p>
          <div className="flavor-grid">
            {FLAVORS.map(f=>(
              <div key={f} className={`f-chip${selected.has(f)?" sel":""}`} onClick={()=>toggleFlavor(f)}>
                <span className="chip-chk">{selected.has(f)?"✓":""}</span>
                <span className="chip-lbl">{f}</span>
              </div>
            ))}
          </div>
          <button className="sub-btn full" disabled={selected.size===0} onClick={()=>{setActive(selFlavors[0]);setStep(1);}}>
            Next — enter ounces ({selected.size} flavor{selected.size!==1?"s":""})
          </button>
        </>
      )}

      {/* STEP 1: OZ ENTRY */}
      {step===1&&active&&(()=>{
        const data=fd[active]||emptyFD();
        const alloc=getAlloc(active);
        return(
          <>
            {/* flavor nav pills */}
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

              {/* total oz */}
              <div className="oz-row" style={{marginBottom:14,paddingBottom:12,borderBottom:"0.5px solid var(--bdr)"}}>
                <span style={{fontSize:12,color:"var(--tx)",fontWeight:500,marginRight:8,flexShrink:0}}>Total oz</span>
                <input
                  type="number" min="0" inputMode="numeric"
                  value={data.totalOz||""}
                  placeholder="0"
                  onChange={e=>setTotalOz(active,parseFloat(e.target.value)||0)}
                  style={{width:80,padding:"6px 10px",border:"0.5px solid var(--bdr2)",borderRadius:"var(--r)",
                    background:"var(--surf2)",color:"var(--tx)",fontFamily:"var(--mono)",fontSize:14,
                    fontWeight:500,textAlign:"right"}}
                />
              </div>

              {/* size split */}
              {data.totalOz>0&&(
                <>
                  <p style={{fontSize:11,color:"var(--hi)",marginBottom:10}}>Enter 15oz and 45oz quantities — 4.5oz fills automatically:</p>
                  {SIZES.map(sz=>{
                    const soz=data.split[sz.key]||0;
                    const b=floorBags(soz,sz.oz);const r=remOz(soz,sz.oz);
                    const isAuto=sz.key==="s45";
                    return(
                      <div className="oz-row" key={sz.key}>
                        <span className="oz-lbl">{sz.label}{isAuto&&<span style={{fontSize:9,color:"var(--hi)",marginLeft:4}}>auto</span>}</span>
                        {isAuto?(
                          <input
                            type="number" readOnly value={soz||""}
                            style={{width:80,padding:"6px 10px",
                              border:"0.5px solid var(--bdr)",borderRadius:"var(--r)",
                              background:"var(--surf)",color:"var(--mu)",
                              fontFamily:"var(--mono)",fontSize:14,fontWeight:500,
                              textAlign:"right",cursor:"default"}}
                          />
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

      {/* STEP 2: REVIEW */}
      {step===2&&summary&&(
        <>
          <div className="sum-panel">
            <div className="sum-row"><span className="lbl">Flavors this bake</span><span className="val">{selFlavors.length}</span></div>
            <div className="sum-row"><span className="lbl">Total ounces</span><span className="val">{summary.totOz} oz</span></div>
            <hr className="sum-div"/>
            {SIZES.map(sz=>summary.totBags[sz.key]>0&&(
              <div className="sum-row" key={sz.key}>
                <span className="lbl">{sz.label} bags</span>
                <span className="val" style={{color:"var(--gn-m)"}}>{summary.totBags[sz.key]}</span>
              </div>
            ))}
            <hr className="sum-div"/>
            <div className="sum-row"><span className="lbl">Retail bag equivalents</span><span className="val" style={{color:"var(--bl-m)"}}>{summary.totRetail}</span></div>
            {summary.rems.length>0&&<div className="sum-warn">Leftover oz (not counted): {summary.rems.join(", ")}</div>}
          </div>

          {selFlavors.map(f=>{
            const data=fd[f]||emptyFD();const comp=computeFlavor(data);
            return(
              <div key={f} style={{background:"var(--surf)",border:"0.5px solid var(--bdr)",borderRadius:"var(--r)",padding:"10px 14px",marginBottom:8,fontSize:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontWeight:500}}>{f}</span>
                  <span style={{color:"var(--hi)"}}>{data.totalOz} oz</span>
                </div>
                <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                  {SIZES.map(sz=>comp.bags[sz.key]>0&&(
                    <span key={sz.key} style={{fontSize:11,background:"var(--gn-bg)",color:"var(--gn)",padding:"2px 8px",borderRadius:20}}>
                      {comp.bags[sz.key]} × {sz.label}
                      {comp.rems[sz.key]>0&&<span style={{color:"var(--am-m)"}}> (+{comp.rems[sz.key]}oz)</span>}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="action-row">
            <button className="sec-btn" onClick={()=>setStep(1)}>← Edit</button>
            <button className="sub-btn" disabled={status==="loading"} onClick={submit}>
              {status==="loading"?"Submitting…":"Submit bake"}
            </button>
          </div>
          {status==="success"&&<div className="suc-box">Bake logged — Bake Planner updated.</div>}
          {status==="error"&&<div className="err-box">Something went wrong — try again or update the sheet directly.</div>}
        </>
      )}
    </div>
  );
}

// ── BAGGER FORM ───────────────────────────────────────────────────────────────
function BaggerForm(){
  const [qtys,setQtys]=useState(emptyQtys());
  const [status,setStatus]=useState(null);
  const total=Object.values(qtys).reduce((a,b)=>a+b,0);
  const set=(f,v)=>setQtys(q=>({...q,[f]:Math.max(0,v)}));
  async function submit(){
    if(total===0||status==="loading")return;
    setStatus("loading");
    const res=await apiCall("logBagging",{quantities:qtys,timestamp:new Date().toISOString()});
    setStatus(res.success?"success":"error");
    if(res.success)setQtys(emptyQtys());
  }
  return(
    <div className="content">
      <div className="form-hdr"><h2>Log bags made</h2><p>Enter the number of bags made per flavor for this session.</p></div>
      {FLAVORS.map(f=>(
        <div key={f} className="bf-row">
          <span className="bf-name">{f}</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button className="q-btn" onClick={()=>set(f,qtys[f]-1)}>−</button>
            <span className={`q-val${qtys[f]>0?" nz":""}`}>{qtys[f]}</span>
            <button className="q-btn" onClick={()=>set(f,qtys[f]+1)}>+</button>
          </div>
        </div>
      ))}
      <div style={{fontSize:12,color:"var(--mu)",textAlign:"right",margin:"12px 0"}}>Total: <strong style={{color:"var(--tx)"}}>{total} bag{total!==1?"s":""}</strong></div>
      <button className="sub-btn full" disabled={total===0||status==="loading"} onClick={submit}>
        {status==="loading"?"Submitting…":`Submit session — ${total} bag${total!==1?"s":""}`}
      </button>
      {status==="success"&&<div className="suc-box">Session logged — thank you!</div>}
      {status==="error"&&<div className="err-box">Something went wrong — try again or contact Kevin.</div>}
    </div>
  );
}

// ── ADMIN DASHBOARD ───────────────────────────────────────────────────────────
function AdminDashboard(){
  const [tab,setTab]=useState("today");
  const [inv,setInv]=useState(MOCK_INV);
  const [orders,setOrders]=useState(MOCK_ORDERS);
  const [alerts,setAlerts]=useState([]);

  useEffect(()=>{
    Promise.all([
      apiCall("getInventory"),
      apiCall("getOrders"),
      apiCall("getAlerts"),
    ]).then(([i,o,a])=>{
      if(i.success&&i.inventory) setInv(i.inventory);
      if(o.success&&o.orders)    setOrders(o.orders);
      if(a.success&&a.alerts)    setAlerts(a.alerts);
    });
  },[]);

  async function dismiss(id){
    setAlerts(a=>a.filter(x=>x.id!==id));
    await apiCall("clearAlert",{alertId:id});
  }

  const unread=alerts.length;

  // Format relative time for alert timestamps
  function relTime(ts){
    try{
      const diff=Date.now()-new Date(ts).getTime();
      const m=Math.floor(diff/60000);
      if(m<1)  return "just now";
      if(m<60) return m+"m ago";
      const h=Math.floor(m/60);
      if(h<24) return h+"h ago";
      return Math.floor(h/24)+"d ago";
    }catch(e){return "";}
  }

  return(
    <>
      <div className="nav">
        {["today","orders","inventory"].map(t=>(
          <button key={t} className={`nav-btn${tab===t?" active":""}`} onClick={()=>setTab(t)}>
            {t}
            {t==="today"&&unread>0&&(
              <span style={{
                display:"inline-flex",alignItems:"center",justifyContent:"center",
                width:16,height:16,borderRadius:"50%",background:"var(--co-m)",
                color:"#fff",fontSize:9,fontWeight:700,marginLeft:6,verticalAlign:"middle",
              }}>{unread}</span>
            )}
          </button>
        ))}
      </div>
      <div className="content">
        {tab==="today"&&(
          <>
            <div className="metrics" style={{marginTop:14}}>
              <div className="metric m-green"><div className="m-label">Orders today</div><div className="m-val">7</div><div className="m-delta">+3 vs yesterday</div></div>
              <div className="metric m-amber"><div className="m-label">Pending ship</div><div className="m-val">4</div><div className="m-delta">2 due today</div></div>
              <div className="metric m-blue"><div className="m-label">Revenue 7d</div><div className="m-val">$1,240</div><div className="m-delta">all channels</div></div>
              <div className="metric m-coral"><div className="m-label">Low stock</div><div className="m-val">2</div><div className="m-delta">below 20 bags</div></div>
            </div>

            {/* ── Production notifications ── */}
            {unread>0&&(
              <div className="panel" style={{marginBottom:12}}>
                <div className="panel-title">
                  <span className="pdot" style={{background:"var(--co-m)"}}/>
                  production updates
                  <span style={{marginLeft:"auto",fontSize:10,background:"var(--co-bg)",color:"var(--co)",
                    padding:"2px 8px",borderRadius:10,fontWeight:500}}>{unread} new</span>
                </div>
                {alerts.map(a=>(
                  <div key={a.id} style={{
                    display:"flex",alignItems:"flex-start",gap:10,
                    padding:"10px 0",borderBottom:"0.5px solid var(--bdr)",
                  }}>
                    <div style={{
                      width:22,height:22,borderRadius:6,flexShrink:0,marginTop:1,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,
                      background:a.type==="bake"?"var(--am-bg)":"var(--tl-bg)",
                      color:a.type==="bake"?"var(--am)":"var(--tl)",
                    }}>
                      {a.type==="bake"?"B":"P"}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500}}>{a.title}</div>
                      <div style={{fontSize:11,color:"var(--mu)",marginTop:2,
                        whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.summary}</div>
                      <div style={{fontSize:10,color:"var(--hi)",marginTop:2}}>{relTime(a.timestamp)}</div>
                    </div>
                    <button onClick={()=>dismiss(a.id)} style={{
                      fontSize:14,color:"var(--hi)",background:"none",border:"none",
                      cursor:"pointer",padding:"0 4px",lineHeight:1,flexShrink:0,
                      fontFamily:"var(--mono)",marginTop:2,
                    }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <Panel title="Recent orders" dot="var(--bl-m)">
              {orders.slice(0,5).map(o=>{const cs=chStyle(o.channel);return(
                <div className="order-row" key={o.id}>
                  <span className="o-id">{o.id}</span><span className="o-name">{o.customer}</span>
                  <div className="o-right">
                    <span className="badge" style={{background:cs.bg,color:cs.color}}>{o.channel==="WooCommerce"?"WooComm":o.channel}</span>
                    <span className="o-amt">${o.amount}</span>
                  </div>
                </div>
              );})}
            </Panel>
            <Panel title="Channels — 7 days" dot="var(--tl-m)">
              {[{name:"WooCommerce",code:"WC",rev:340},{name:"Faire",code:"FA",rev:620},{name:"Direct",code:"DI",rev:280}].map(c=>{const cs=chStyle(c.name);return(
                <div className="ch-row" key={c.name}>
                  <span className="ch-left"><span className="ch-icon" style={{background:cs.bg,color:cs.color}}>{c.code}</span>{c.name}</span>
                  <span style={{fontSize:12,color:"var(--mu)"}}>${c.rev}</span>
                </div>
              );})}
            </Panel>
            <Panel title="System alerts" dot="var(--am-m)">
              <div className="alert-row"><div className="a-icon a-warn">!</div><div><div>Choc Graham 15oz</div><span className="a-sub">SKU unmapped in SOS</span></div></div>
              <div className="alert-row"><div className="a-icon a-err">!</div><div><div>Spicy Choc Mint 45oz</div><span className="a-sub">column AD pending</span></div></div>
              <div className="alert-row"><div className="a-icon a-info">i</div><div><div>INV-97</div><span className="a-sub">2 days without fulfillment</span></div></div>
            </Panel>
            <Panel title="Integrations" dot="var(--hi)">
              <div className="int-grid">
                {[{n:"SOS Inv.",ok:true},{n:"ShipStation",ok:true},{n:"WooComm.",ok:true},{n:"HubSpot",ok:true},{n:"Klaviyo",ok:true},{n:"QuickBooks",ok:true},{n:"Zapier",ok:true},{n:"G Workspace",ok:true},{n:"Faire SKU",ok:false,note:"-R active"}].map(s=>(
                  <div className="int-card" key={s.n}><div className="int-name">{s.n}</div><div className="int-st"><span className={s.ok?"d-live":"d-warn"}/>{s.note||(s.ok?"live":"warn")}</div></div>
                ))}
              </div>
            </Panel>
          </>
        )}
        {tab==="orders"&&(
          <Panel title="All orders" dot="var(--bl-m)">
            {orders.map(o=>(
              <div className="order-row" key={o.id}>
                <span className="o-id">{o.id}</span><span className="o-name">{o.customer}</span>
                <div className="o-right"><span className={`badge ${o.status==="shipped"?"b-ship":"b-pend"}`}>{o.status}</span><span className="o-amt">${o.amount}</span></div>
              </div>
            ))}
          </Panel>
        )}
        {tab==="inventory"&&(
          <Panel title="On hand — all flavors" dot="var(--gn-m)">
            {inv.map(i=>(
              <div className="inv-row" key={i.flavor}>
                <span style={{fontSize:12}}>{i.flavor}</span>
                <span className="i-qty">{i.bags}</span>
                <div className="bar-wrap"><div className="bar-fill" style={{width:`${Math.round(i.bags/i.max*100)}%`,background:barColor(i.bags,i.max)}}/></div>
              </div>
            ))}
          </Panel>
        )}
      </div>
    </>
  );
}

// ── PIN SCREEN ────────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 5 * 60 * 1000; // 5 minutes

function PinScreen({ role, onSuccess, onBack }) {
  const [digits, setDigits]       = useState([]);
  const [error, setError]         = useState("");
  const [attempts, setAttempts]   = useState(0);
  const [lockedUntil, setLocked]  = useState(null);
  const [checking, setChecking]   = useState(false);

  const r = ROLES.find(x => x.id === role);

  // Check lockout on mount / digit change
  const isLocked = lockedUntil && Date.now() < lockedUntil;
  const remaining = isLocked ? Math.ceil((lockedUntil - Date.now()) / 1000) : 0;

  async function checkPin(pin) {
    setChecking(true);
    const res = await apiCall("verifyPin", { role, pin });
    setChecking(false);
    if (res.success && res.valid) {
      onSuccess();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setDigits([]);
      if (newAttempts >= MAX_ATTEMPTS) {
        setLocked(Date.now() + LOCKOUT_MS);
        setError("Too many attempts — locked for 5 minutes.");
      } else {
        setError(`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? "s" : ""} remaining.`);
      }
    }
  }

  function press(d) {
    if (isLocked || checking) return;
    setError("");
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 4) {
      checkPin(next.join(""));
    }
  }

  function del() {
    if (isLocked || checking) return;
    setError("");
    setDigits(d => d.slice(0, -1));
  }

  const keys = ["1","2","3","4","5","6","7","8","9","","0","del"];

  return (
    <div className="pin-screen">
      <div className="pin-card">
        <div className="pin-role-icon">{r?.icon}</div>
        <div className="pin-role-name">{r?.name}</div>
        <div className="pin-prompt">
          {isLocked ? `Locked — try again in ${remaining}s` : "Enter your PIN to continue"}
        </div>
        <div className="pin-dots">
          {[0,1,2,3].map(i => (
            <div key={i} className={`pin-dot${digits.length > i ? " filled" : ""}${error && digits.length === 0 ? " error" : ""}`} />
          ))}
        </div>
        <div className="pin-grid">
          {keys.map((k, i) => {
            if (k === "")  return <div key={i} className="pin-key empty" />;
            if (k === "del") return (
              <button key={i} className="pin-key del" onClick={del} disabled={isLocked || checking}>⌫</button>
            );
            return (
              <button key={i} className="pin-key" onClick={() => press(k)}
                disabled={isLocked || checking || digits.length >= 4}>{k}</button>
            );
          })}
        </div>
        {error && <div className="pin-error">{error}</div>}
        <button className="pin-back" onClick={onBack}>← back</button>
      </div>
    </div>
  );
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App(){
  const [screen, setScreen]     = useState("roles");   // "roles" | "pin" | "app"
  const [role, setRole]         = useState(null);
  const isDemo = APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_URL_HERE";
  const roleLabel = ROLES.find(r => r.id === role)?.name;

  function selectRole(id) {
    setRole(id);
    setScreen("pin");
  }

  function onPinSuccess() {
    setScreen("app");
  }

  function switchRole() {
    setRole(null);
    setScreen("roles");
  }

  // ── ROLE SELECTOR
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

  // ── PIN ENTRY
  if (screen === "pin") return (
    <>
      <style>{CSS}</style>
      {isDemo && <div className="demo-banner">Demo mode — any 4-digit PIN works</div>}
      <PinScreen
        role={role}
        onSuccess={onPinSuccess}
        onBack={() => { setRole(null); setScreen("roles"); }}
      />
    </>
  );

  // ── MAIN APP
  return (
    <>
      <style>{CSS}</style>
      {isDemo && <div className="demo-banner">Demo mode — connect Apps Script to go live</div>}
      <div className="shell">
        <div className="topbar">
          <div className="topbar-inner">
            <h1>Jack's Crackers</h1>
            <span className="topbar-role">{roleLabel}</span>
            <span className="topbar-date">{today()}</span>
            <button className="switch-btn" onClick={switchRole}>Switch</button>
          </div>
        </div>
        {role === "admin"  && <AdminDashboard />}
        {role === "baker"  && <BakerForm />}
        {role === "bagger" && <BaggerForm />}
      </div>
    </>
  );
}
