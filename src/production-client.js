// Persistent immutable outbox; credentials are held only by the caller, never stored.
const KEY = 'jc-production-outbox-v1';
export function pendingBake(storage=localStorage) {
  const raw=storage.getItem(KEY); if(!raw)return null;
  const record=JSON.parse(raw);
  if(record.version!==1 || !record.payload?.sessionId)throw new Error('Saved entry needs recovery; do not overwrite it');
  return record.payload;
}
export function saveBake(payload,storage=localStorage) {
  const existing=pendingBake(storage);
  if(existing)throw new Error('A saved bake is pending. Send that entry before starting another.');
  const record={...payload,sessionId:crypto.randomUUID()};
  storage.setItem(KEY,JSON.stringify({version:1,payload:record}));
  return record;
}
export async function sendSavedBake(_unused,storage=localStorage,fetcher=fetch) {
  const payload=pendingBake(storage);if(!payload)throw new Error('No saved bake');
  const response=await fetcher('/api/proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,action:'productionSubmit',role:'baker'})});
  if(!response.ok)throw new Error('Entry remains saved; server did not confirm receipt');
  const result=await response.json();
  if(!result.success || !result.accepted || result.sessionId!==payload.sessionId)throw new Error(result.error || 'Receipt not confirmed; entry remains saved');
  // Do not erase another tab's newer outbox entry.
  if(pendingBake(storage)?.sessionId===payload.sessionId)storage.removeItem(KEY);
  return result;
}

// Guess the batch size from finished weight: the largest size whose nominal yield (size x 4.5 oz) fits; else the smallest.
export function guessSize(options,totalOz){
  const sizes=(options||[]).map(o=>o.size).sort((a,b)=>a-b);if(!sizes.length)return undefined;
  const fit=sizes.filter(s=>s*4.5<=totalOz);return fit.length?fit[fit.length-1]:sizes[0];
}
