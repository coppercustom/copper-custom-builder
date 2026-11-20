(function(){
'use strict';
const host=document.getElementById('cc-employee-app');
if(!host)return;
// Do not rely on a saved data-ready HTML attribute: OpenCart may preserve it.
if(host.__ccEmployeeDashboardBound)return;
host.__ccEmployeeDashboardBound=true;
const BASE='https://cyrmysbcrpiadchcpsfa.supabase.co';
const KEY='sb_publishable_hnv_oiFbbIoPjOzBvB3ehA_BCzCe82X';
const STORAGE='cc_employee_session_v2';
// This marker changes only when the dashboard JavaScript actually executes.
host.setAttribute('data-js-running','true');
const $=id=>host.querySelector('#'+id);
const statuses=['New','Contacted','In Review','Quoted','Closed'];
let session=null,currentUser=null,staff=[],records=[],selected=null;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(s,bad=false){$('cc-msg').innerHTML=s?'<p class="'+(bad?'err':'ok')+'">'+escape(s)+'</p>':'';}
function show(logged){$('cc-login').classList.toggle('hidden',logged);$('cc-main').classList.toggle('hidden',!logged);$('cc-signout').classList.toggle('hidden',!logged);}
function saveSession(value){session=value;try{if(value)localStorage.setItem(STORAGE,JSON.stringify(value));else localStorage.removeItem(STORAGE);}catch(e){}}
function parseSession(){try{return JSON.parse(localStorage.getItem(STORAGE)||'null')}catch(e){return null}}
async function request(path,{method='GET',body=null,authenticated=true,headers={}}={}){
 const h={apikey:KEY,...headers};
 if(authenticated){if(!session?.access_token)throw Error('Please sign in.');h.Authorization='Bearer '+session.access_token;}
 if(body!==null){h['Content-Type']='application/json';body=JSON.stringify(body);}
 let response;
 try{response=await fetch(BASE+path,{method,headers:h,body,credentials:'omit',redirect:'error'});}catch(e){throw Error('Network request failed. Check the browser console and site Content Security Policy (connect-src).');}
 let data=null;const raw=await response.text();if(raw){try{data=JSON.parse(raw)}catch(e){data=raw}}
 if(!response.ok){const err=new Error(data?.message||data?.msg||data?.error_description||data?.error||data?.hint||('Request failed: HTTP '+response.status));err.status=response.status;throw err;}
 return data;
}
async function refreshSession(){
 if(!session?.refresh_token)throw Error('Your session expired. Please sign in again.');
 const data=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',authenticated:false,body:{refresh_token:session.refresh_token}});
 saveSession(data);currentUser=data.user||currentUser;return data;
}
async function authorizedRequest(path,options={}){
 if(session?.expires_at && Date.now()/1000>session.expires_at-60)await refreshSession();
 try{return await request(path,options)}catch(e){if(e.status===401){await refreshSession();return await request(path,options)}throw e;}
}
function table(name,query=''){return '/rest/v1/'+name+(query?'?'+query:'')}
async function load(){
 const [s,c]=await Promise.all([
  authorizedRequest(table('cc_staff','select=user_id,display_name&active=eq.true')),
  authorizedRequest(table('cc_consultations','select=*&order=created_at.desc&limit=250'))
 ]);
 staff=s||[];
 if(!staff.some(x=>x.user_id===currentUser?.id))throw Error('This account is not authorized as an active employee.');
 records=c||[];render();
}
function atomicAssuranceInbox(answers){
 if(typeof answers==='string'){try{answers=JSON.parse(answers)}catch{return '';}}
 const status=Array.isArray(answers?.summary)?answers.summary.find(row=>row?.label==='Atomic Assurance')?.value:null;
 return typeof status==='string'?'<br><strong>Atomic Assurance: '+escape(status)+'</strong>':'';
}
function renderAnswers(answers){
 let a=answers;if(typeof a==='string'){try{a=JSON.parse(a)}catch(e){return '<div class="answer-card"><div class="answer-value">'+escape(a)+'</div></div>'}}
 let entries=[];
 if(Array.isArray(a))entries=a.map(x=>Array.isArray(x)?[x[0],x[1]]:[x?.label??x?.name??'Answer',x?.value??x?.answer??x]);
 else if(a&&typeof a==='object'){if(Array.isArray(a.summary))return renderAnswers(a.summary);if(Array.isArray(a.rows))return renderAnswers(a.rows);entries=Object.entries(a);}
 else if(a!=null)entries=[['Answer',a]];
 if(!entries.length)return '<p class="muted">No answers recorded.</p>';
 return entries.map(([k,v],i)=>'<div class="answer-card'+''+'"><div class="answer-label">'+escape(k)+'</div><div class="answer-value">'+escape(v&&typeof v==='object'?JSON.stringify(v,null,2):v)+'</div></div>').join('');
}
function consultationHasUnsavedChanges(){
 const r=records.find(x=>x.id===selected);
 if(!r||!$('cc-status')||!$('cc-handler'))return false;
 if($('cc-status').value!==String(r.status||'')||$('cc-handler').value.trim()!==String(r.handled_by||'').trim())return true;
 if(($('cc-note-text')?.value||'').trim())return true;
 return [...$('cc-detail').querySelectorAll('[data-note-id]')].some(card=>{
  const editor=card.querySelector('.note-edit');
  return editor&&!editor.classList.contains('hidden')&&card.querySelector('[data-note-text]').value!==card.querySelector('.cc-note-display').textContent;
 });
}
function confirmConsultationLeave(){
 return !consultationHasUnsavedChanges()||window.confirm('This consultation has unsaved changes or a draft note. Leave without saving?');
}
window.addEventListener('beforeunload',e=>{if(consultationHasUnsavedChanges()){e.preventDefault();e.returnValue='';}});
function render(){
 $('cc-stats').innerHTML=statuses.map(name=>'<button type="button" class="card metric cc-status-filter" data-status="'+escape(name)+'" aria-pressed="'+String($('cc-filter').value===name)+'" title="Filter consultations by '+escape(name)+'"><strong>'+records.filter(r=>r.status===name).length+'</strong><span class="pill" data-status="'+escape(name)+'">'+escape(name)+'</span></button>').join('');
 const q=$('cc-search').value.toLowerCase().trim(),f=$('cc-filter').value,assignment=$('cc-assignment-filter').value;
 const shown=records.filter(r=>(!f||r.status===f)&&(!assignment||(assignment==='assigned'?!!String(r.handled_by||'').trim():!String(r.handled_by||'').trim()))&&(!q||[r.customer_name,r.customer_email,r.id,r.weapon_class,r.handled_by].some(v=>String(v||'').toLowerCase().includes(q))));
 $('cc-list-count').textContent='('+shown.length+' of '+records.length+')';
 $('cc-list').innerHTML=shown.length?shown.map(r=>'<button type="button" class="item'+(selected===r.id?' selected':'')+'" data-id="'+escape(r.id)+'" data-status="'+escape(r.status)+'"><span class="pill" data-status="'+escape(r.status)+'">'+escape(r.status)+'</span> <strong>'+escape(r.customer_name)+'</strong><br><span class="muted">'+escape(r.weapon_class||'Consultation')+' · '+escape(new Date(r.created_at).toLocaleDateString())+'</span><br><span class="assignment-label'+(r.handled_by?'':' unassigned')+'">'+(r.handled_by?'Assigned: '+escape(r.handled_by):'Unassigned')+'</span>'+atomicAssuranceInbox(r.answers)+'</button>').join(''):'<p>No matching consultations.</p>';
 if(selected){const r=records.find(x=>x.id===selected);if(r&&$('cc-detail').dataset.consultationId!==String(r.id))renderDetail(r);else if(!r) $('cc-detail').innerHTML='<p>Select a consultation to review.</p>';}
}
async function renderDetail(r){
 const stamp=selected=r.id;
 $('cc-detail').dataset.consultationId=String(r.id);
 $('cc-detail').innerHTML='<h3>'+escape(r.customer_name)+'</h3><p>'+escape(r.customer_email)+' '+escape(r.customer_phone||'')+'</p><p class="muted">'+escape(r.id)+' · '+escape(new Date(r.created_at).toLocaleString())+'</p><div class="row"><div class="grow"><label>Status</label><select id="cc-status">'+statuses.map(s=>'<option value="'+escape(s)+'" '+(s===r.status?'selected':'')+'>'+escape(s)+'</option>').join('')+'</select></div><div class="grow"><label>Handled by</label><input id="cc-handler" type="text" maxlength="120" autocomplete="off" placeholder="Enter employee name" value="'+escape(r.handled_by||'')+'"></div></div><div class="cc-detail-actions"><button type="button" class="secondary" id="cc-print-report">Print report</button><button type="button" id="cc-save-top">Save consultation changes</button><span class="muted">Status and assigned employee</span></div><h3 style="margin-top:20px">Customer answers</h3><div id="cc-answer-grid" class="answers">'+renderAnswers(r.answers)+'</div><div style="margin-top:20px"><button type="button" id="cc-show-supplier-links" class="secondary" aria-expanded="false">See supplier listings ▾</button><div id="cc-supplier-links" class="card hidden" style="margin-top:10px"></div></div><h3 style="margin-top:20px">Internal notes</h3><div id="cc-notes">Loading…</div><label>New internal note</label><textarea id="cc-note-text" rows="3" placeholder="Employee-only note"></textarea><div style="margin-top:10px"><button type="button" id="cc-add-note">Add note</button></div><div style="margin-top:24px;padding-top:18px;border-top:1px solid #414044"><button type="button" id="cc-save">Save Changes</button><span id="cc-save-status" role="status" class="muted" style="margin-left:12px"></span></div>';
 try{
 const notes=await authorizedRequest(table('cc_consultation_notes','select=id,note,created_at,updated_at,author_id&consultation_id=eq.'+encodeURIComponent(r.id)+'&order=created_at.desc'));
 if(selected!==stamp)return;
 $('cc-notes').innerHTML=notes.length?notes.map(n=>'<div class="card" data-note-id="'+escape(n.id)+'"><div class="muted">'+escape(staff.find(s=>s.user_id===n.author_id)?.display_name||'Employee')+' · '+escape(new Date(n.created_at).toLocaleString())+'</div><div class="muted" data-note-edited="1">'+(n.updated_at?'Last edited '+escape(new Date(n.updated_at).toLocaleString()):'Not edited')+'</div><div class="cc-note-display" style="white-space:pre-wrap">'+escape(n.note)+'</div><div class="note-actions"><button type="button" class="secondary" data-note-edit="1">Edit note</button></div><div class="note-edit hidden"><label>Edit internal note</label><textarea rows="3" maxlength="5000" data-note-text="1">'+escape(n.note)+'</textarea><div class="note-actions"><button type="button" data-note-save="1">Save note</button><button type="button" class="secondary" data-note-cancel="1">Cancel</button></div><div class="muted" role="status" data-note-status="1"></div></div></div>').join(''):'<p class="muted">No notes yet.</p>';
 }catch(e){if(selected===stamp)$('cc-notes').innerHTML='<p class="err">'+escape(e.message)+'</p>';}
}

async function loadConsultationSupplierLinks(r,stamp){
 const host=$('cc-supplier-links');
 if(!host)return;
 let a=r.answers;
 if(typeof a==='string'){try{a=JSON.parse(a)}catch(e){a={};}}
 const prefs=a?.selections?.primary?.preferences;
 const choices=Array.isArray(prefs)?prefs.filter(x=>x&&String(x.manufacturer||'').trim()&&String(x.model||'').trim()).slice(0,8):[];
 if(!choices.length){host.innerHTML='<p class="muted">No specific firearm model selected in this consultation.</p>';return;}
 host.innerHTML='<p class="muted">Looking up supplier records…</p>';
 const chunks=[];
 for(const choice of choices){
   const maker=String(choice.manufacturer).trim(),model=String(choice.model).trim();
   let content='<p class="muted">No matching supplier records.</p>';
   try{
     const response=await provisionalRequest({action:'supplier-links',manufacturer:maker,model,upc:choice.upc||'',manufacturer_part_number:choice.manufacturer_part_number||choice.mpn||'',caliber:choice.caliber||''});
     const matches=Array.isArray(response.matches)?response.matches:[];
     if(matches.length){
       content='<div class="muted" style="margin:6px 0">'+Number(response.total_matches||matches.length)+' matching supplier variant'+(matches.length===1?'':'s')+' — confirm exact configuration before ordering.</div>'+
       matches.map(x=>{
         const source=x.source==='lipseys'?"Lipsey's":"Sports South";
         const id=String(x.source_id||'');
         const url=String(x.listing_url||'');
         const safeUrl=/^https:\/\/(www\.)?(lipseys\.com|theshootingwarehouse\.com)\//i.test(url);
         const specs=[x.caliber,x.firearm_type].filter(Boolean).map(v=>escape(String(v))).join(' · ');
         return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid #414044;flex-wrap:wrap">'+
           '<div style="min-width:190px;flex:1"><strong>'+escape(source)+' · '+escape(x.model||model)+'</strong>'+
           (x.match_level&&x.match_level!=='model_family'?'<div class="muted">Match: '+escape(String(x.match_level).replaceAll('_',' '))+'</div>':'')+(specs?'<div class="muted">'+specs+'</div>':'')+
           '<div class="muted">SKU '+escape(id)+(x.upc?' · UPC '+escape(x.upc):'')+(x.manufacturer_part_number?' · MPN '+escape(x.manufacturer_part_number):'')+'</div></div>'+
           '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+
           (safeUrl?'<a href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">Open listing ↗</a>':'<span class="muted">No verified link</span>')+
           '<button type="button" class="secondary" data-copy-supplier-id="'+escape(id)+'">Copy SKU</button></div></div>';
       }).join('');
       if(response.truncated)content+='<p class="muted">Showing up to 30 results. Additional variants may exist.</p>';
     }
   }catch(e){content='<p class="err">'+escape(e.message||'Supplier lookup failed')+'</p>';}
   chunks.push('<details class="card" open><summary style="cursor:pointer;font-weight:600">'+escape(maker)+' — '+escape(model)+'</summary>'+content+'</details>');
 }
 if(selected===stamp&&$('cc-supplier-links')===host)host.innerHTML=chunks.join('');
}
async function signIn(e){
 e?.preventDefault();e?.stopPropagation();message('');
 const email=$('cc-email').value.trim(),password=$('cc-password').value;
 if(!email||!password){message('Enter your employee email and password.',true);return;}
 const button=$('cc-login-button');button.disabled=true;
 try{
  const data=await request('/auth/v1/token?grant_type=password',{method:'POST',authenticated:false,body:{email,password}});
  saveSession(data);currentUser=data.user;
  await load();$('cc-password').value='';show(true);
 }catch(err){saveSession(null);currentUser=null;show(false);message(err.message,true)}
 finally{button.disabled=false;}
}
// Prevent OpenCart or theme-level form handlers from submitting the entire page.
$('cc-login-button').type='button';
$('cc-login-button').addEventListener('click',signIn);
$('cc-password').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();signIn(e);}});
$('cc-email').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();$('cc-password').focus();}});
$('cc-signout').type='button';
$('cc-signout').addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();if(!confirmConsultationLeave())return;const token=session?.access_token;saveSession(null);currentUser=null;records=[];selected=null;show(false);message('Signed out.');if(token)try{await fetch(BASE+'/auth/v1/logout',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token}})}catch(_){}});
const CATALOG_API=BASE+'/functions/v1/public-lipseys-search';
let catalogMakerNames=[],catalogMakerRequest=0,catalogMakerCache=new Map();
function catalogStatus(s,bad=false){$('cc-cat-result').innerHTML='<p class="'+(bad?'err':'ok')+'">'+escape(s)+'</p>';}
function catalogFields(){
 const firearm=$('cc-cat-category').value==='Firearm',model=$('cc-cat-kind').value==='model';
 $('cc-cat-class-wrap').classList.toggle('hidden',!firearm);
 $('cc-cat-model-wrap').classList.remove('hidden');
 $('cc-cat-new-maker-wrap').classList.toggle('hidden',model);
 $('cc-cat-existing-maker-wrap').classList.toggle('hidden',!model);
 if(model)loadCatalogManufacturers();
}
function renderCatalogMakers(){
 const select=$('cc-cat-maker-select'),previous=select.value;
 const term=$('cc-cat-maker-search').value.trim().toLocaleLowerCase();
 const matches=catalogMakerNames.filter(n=>n.toLocaleLowerCase().includes(term));
 select.innerHTML='<option value="">Choose a manufacturer</option>'+matches.map(n=>'<option value="'+escape(n)+'">'+escape(n)+'</option>').join('');
 if(matches.includes(previous))select.value=previous;
 $('cc-cat-maker-hint').textContent=matches.length+' matching manufacturer(s)';
}
async function loadCatalogManufacturers(force=false){
 if($('cc-cat-kind').value!=='model')return;
 const category=$('cc-cat-category').value,weaponClass=category==='Firearm'?$('cc-cat-class').value:null;
 if(category==='Firearm'&&!weaponClass){catalogMakerNames=[];renderCatalogMakers();$('cc-cat-maker-hint').textContent='Choose a firearm class first.';return;}
 const cacheKey=category+'|'+(weaponClass||'');const token=++catalogMakerRequest;
 if(!force&&catalogMakerCache.has(cacheKey)){catalogMakerNames=catalogMakerCache.get(cacheKey);renderCatalogMakers();return;}
 $('cc-cat-maker-hint').textContent='Loading manufacturers…';$('cc-cat-maker-select').disabled=true;
 try{
  const payload=category==='Firearm'?{action:'firearm-manufacturers',weaponClass}: {action:'manufacturers',itemType:category==='Optic'?'Optic':'NFA'};
  const [publicResponse,customRows]=await Promise.all([
   fetch(CATALOG_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(async r=>{const j=await r.json();if(!r.ok||!j.success)throw Error(j.error||'Manufacturer catalog unavailable');return j;}),
   authorizedRequest(table('cc_catalog_additions','select=manufacturer,weapon_class&removed_at=is.null&category=eq.'+encodeURIComponent(category)+'&limit=1000'))
  ]);
  if(token!==catalogMakerRequest)return;
  const names=new Map();
  [...(publicResponse.manufacturers||[]),...(customRows||[]).filter(r=>category!=='Firearm'||!r.weapon_class||r.weapon_class===weaponClass)].forEach(item=>{
   const name=String(typeof item==='string'?item:item.name||item.manufacturer||'').trim();
   if(name&&!names.has(name.toLocaleLowerCase()))names.set(name.toLocaleLowerCase(),name);
  });
  catalogMakerNames=[...names.values()].sort((a,b)=>a.localeCompare(b));
  catalogMakerCache.set(cacheKey,catalogMakerNames);renderCatalogMakers();
 }catch(err){if(token===catalogMakerRequest)$('cc-cat-maker-hint').textContent='Unable to load manufacturers: '+err.message;}
 finally{if(token===catalogMakerRequest)$('cc-cat-maker-select').disabled=false;}
}
// Employee-only provisional catalog. All requests use the existing authenticated session.
const PROVISIONAL_API='/functions/v1/cc-provisional-accessories';
let provOffset=0,provHasMore=false,provBusy=false,provRequestId=0;
async function provisionalRequest(payload){return authorizedRequest(PROVISIONAL_API,{method:'POST',body:payload});}
function provisionalStatus(text){$('cc-prov-status').textContent=text;}
async function provisionalManufacturers(){
 const id=++provRequestId,category=$('cc-prov-category').value;
 provisionalStatus('Loading manufacturers…');
 try{
  const result=await provisionalRequest({action:'manufacturers',category});
  if(id!==provRequestId)return;
  if(!result?.success)throw Error('Catalog unavailable');
  const options=(result.manufacturers||[]);
  $('cc-prov-maker').innerHTML='<option value="">All manufacturers</option>'+options.map(x=>'<option value="'+escape(x.manufacturer)+'">'+escape(x.manufacturer)+' ('+Number(x.product_count||0)+')</option>').join('');
  await provisionalProducts(0);
 }catch(err){if(id===provRequestId)provisionalStatus('Unable to load: '+err.message);}
}
async function provisionalProducts(offset){
 if(provBusy)return;
 provBusy=true;provOffset=offset;
 $('cc-prov-prev').disabled=true;$('cc-prov-next').disabled=true;
 provisionalStatus('Loading catalog…');
 try{
  const result=await provisionalRequest({action:'products',category:$('cc-prov-category').value,manufacturer:$('cc-prov-maker').value,search:$('cc-prov-search').value.trim(),limit:25,offset});
  if(!result?.success)throw Error('Catalog unavailable');
  const products=result.products||[];provHasMore=!!result.hasMore;
  $('cc-prov-results').innerHTML=products.length?products.map(p=>{
   const specs=p.specifications&&typeof p.specifications==='object'&&!Array.isArray(p.specifications)?Object.entries(p.specifications).filter(([k,v])=>v!==null&&v!==''&&typeof v!=='object').slice(0,8).map(([k,v])=>escape(k)+': '+escape(String(v))).join(' · '):'';
   return '<div class="card"><strong>'+escape(p.manufacturer)+' — '+escape(p.model)+'</strong><div class="muted">UPC: '+escape(p.upc||'Not supplied')+' · MPN: '+escape(p.manufacturer_part_number||'Not supplied')+'</div>'+(specs?'<div class="muted">'+specs+'</div>':'')+'<div class="muted">Review: '+escape(p.review_status)+' · Source listings: '+Number(p.source_listing_count||0)+' · Internal ID: '+escape(p.id)+'</div></div>';
  }).join(''):'<p class="muted">No matching records.</p>';
  $('cc-prov-page').textContent=products.length?'Showing '+(offset+1)+'–'+(offset+products.length):'No results';
  provisionalStatus('Internal provisional records — not customer eligible.');
 }catch(err){provisionalStatus('Unable to load: '+err.message);}
 finally{provBusy=false;$('cc-prov-prev').disabled=provOffset===0;$('cc-prov-next').disabled=!provHasMore;}
}
$('cc-view-provisional').addEventListener('click',e=>{e.preventDefault();if(!confirmConsultationLeave())return;$('cc-inbox').classList.add('hidden');$('cc-catalog').classList.add('hidden');$('cc-builder-settings').classList.add('hidden');$('cc-provisional').classList.remove('hidden');provisionalManufacturers();});
function renderReviewSummary(s){
 $('cc-prov-review-summary').textContent='Flagged: '+Number(s.total||0)+' · Unreviewed: '+Number(s.unreviewed||0)+' · Distinct variants: '+Number(s.distinct_variant||0)+' · Suspected errors: '+Number(s.suspected_data_error||0)+' · Awaiting supplier verification: '+Number(s.needs_supplier_verification||0)+' (latest decision per product)';
}
async function loadProvisionalConflicts(){
 const category=$('cc-prov-category').value;
 const status=$('cc-prov-conflicts-status'),output=$('cc-prov-conflicts-results'),button=$('cc-prov-conflicts-load');
 status.textContent='Loading identifier conflicts…';output.textContent='';button.disabled=true;
 try{
  const result=await provisionalRequest({action:'conflicts',category});
  if(!result?.success)throw Error('Conflict review unavailable');
  if(category!==$('cc-prov-category').value)return;
  const records=Array.isArray(result.conflicts)?result.conflicts:[];
  const summaryResponse=await provisionalRequest({action:'review-summary',category});
  if(category!==$('cc-prov-category').value)return;
  if(!summaryResponse?.success)throw Error('Review summary unavailable');
  renderReviewSummary(summaryResponse.summary);
  status.textContent=records.length?records.length+' flagged records. Verify against supplier data before any decision.':'No identifier conflicts found for this category.';
  const filter=$('cc-conflict-filter').value;
  const visible=records.filter(p=>filter==='all'||(filter==='unreviewed'?!p.latest_staff_review:p.latest_staff_review?.decision===filter));
  status.textContent=visible.length+' of '+records.length+' flagged records shown.';
  output.innerHTML=visible.map(p=>'<div class="card" data-review-id="'+Number(p.id)+'"><strong>'+escape(p.manufacturer)+' — '+escape(p.model)+'</strong><div class="muted">Part number: '+escape(p.manufacturer_part_number||'Not supplied')+' · UPC: '+escape(p.upc||'Not supplied')+' · Internal ID: '+escape(p.id)+' · Group records: '+Number(p.conflict_group_size||0)+' · Catalog review: '+escape(p.review_status)+'</div><div class="muted cc-review-latest">'+(p.latest_staff_review?'Latest staff decision: '+escape(String(p.latest_staff_review.decision).replaceAll('_',' '))+' · '+escape(p.latest_staff_review.reviewer_display_name)+' · '+escape(new Date(p.latest_staff_review.created_at).toLocaleString()):'No staff decision recorded')+'</div><div style="margin-top:10px"><label>Staff review decision</label><select class="cc-review-decision"><option value="needs_supplier_verification">Needs supplier verification</option><option value="distinct_variant">Distinct variant</option><option value="suspected_data_error">Suspected data error</option></select><label>Review notes</label><textarea class="cc-review-notes" rows="2" maxlength="2000" placeholder="Evidence or reason for decision (required for verification or data errors)"></textarea><div class="row"><button type="button" class="secondary cc-review-save">Save review</button><button type="button" class="secondary cc-review-history">View history</button></div><div class="muted cc-review-feedback" role="status"></div><div class="cc-review-history-output"></div></div></div>').join('');
 }catch(err){status.textContent='Unable to load conflicts: '+err.message;}
 finally{button.disabled=false;}
}
$('cc-prov-conflicts-results').addEventListener('click',async event=>{
 const button=event.target.closest('button');
 if(!button||(!button.classList.contains('cc-review-save')&&!button.classList.contains('cc-review-history')))return;
 const card=button.closest('[data-review-id]');if(!card)return;
 const product_id=Number(card.dataset.reviewId),category=$('cc-prov-category').value;
 const feedback=card.querySelector('.cc-review-feedback'),history=card.querySelector('.cc-review-history-output');
 button.disabled=true;feedback.textContent='Working…';
 try{
  if(button.classList.contains('cc-review-save')){
   const decision=card.querySelector('.cc-review-decision').value;
   const notes=card.querySelector('.cc-review-notes').value.trim();
   if(decision!=='distinct_variant'&&notes.length<5)throw Error('Please provide at least five characters of review notes.');
   const response=await provisionalRequest({action:'submit-review',category,product_id,decision,notes});
   if(!response?.success)throw Error('Unable to save review');
   feedback.textContent='Review saved at '+new Date(response.review.created_at).toLocaleString()+'. This does not publish or merge the product.';
   button.dataset.saved='1';
   const latest=card.querySelector('.cc-review-latest');if(latest)latest.textContent='Latest staff decision: '+decision.replaceAll('_',' ')+' · Just saved';
   const summaryResponse=await provisionalRequest({action:'review-summary',category});if(summaryResponse?.success)renderReviewSummary(summaryResponse.summary);
  }else{
   const response=await provisionalRequest({action:'review-history',category,product_id});
   if(!response?.success)throw Error('Unable to load review history');
   const reviews=Array.isArray(response.reviews)?response.reviews:[];
   history.innerHTML=reviews.length?reviews.map(r=>'<div class="card" style="margin-top:8px"><strong>'+escape(String(r.decision).replaceAll('_',' '))+'</strong><div class="muted">'+escape(new Date(r.created_at).toLocaleString())+' · Reviewer: '+escape(r.reviewer_display_name||'Employee')+'</div><div>'+escape(r.notes||'No notes')+'</div></div>').join(''):'<p class="muted">No reviews recorded yet.</p>';
   feedback.textContent=reviews.length+' review event(s).';
  }
 }catch(err){feedback.textContent='Unable to complete request: '+err.message;}
 finally{button.disabled=button.dataset.saved==='1';}
});
$('cc-prov-conflicts-results').addEventListener('input',e=>{const card=e.target.closest('[data-review-id]');if(card&&e.target.matches('.cc-review-notes,.cc-review-decision')){const b=card.querySelector('.cc-review-save');if(b){b.dataset.saved='';b.disabled=false;}}});
$('cc-prov-conflicts-results').addEventListener('change',e=>{const card=e.target.closest('[data-review-id]');if(card&&e.target.matches('.cc-review-decision')){const b=card.querySelector('.cc-review-save');if(b){b.dataset.saved='';b.disabled=false;}}});
$('cc-prov-conflicts-load').addEventListener('click',loadProvisionalConflicts);
$('cc-conflict-filter').addEventListener('change',loadProvisionalConflicts);
$('cc-prov-category').addEventListener('change',provisionalManufacturers);
$('cc-prov-category').addEventListener('change',()=>{$('cc-prov-conflicts-status').textContent='';$('cc-prov-conflicts-results').textContent='';$('cc-prov-review-summary').textContent='Review summary loads with conflicts.';});
$('cc-prov-find').addEventListener('click',()=>provisionalProducts(0));
$('cc-prov-search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();provisionalProducts(0);}});
$('cc-prov-prev').addEventListener('click',()=>provisionalProducts(Math.max(0,provOffset-25)));
$('cc-prov-next').addEventListener('click',()=>{if(provHasMore)provisionalProducts(provOffset+25);});
$('cc-view-inbox').addEventListener('click',e=>{e.preventDefault();if(!confirmConsultationLeave())return;$('cc-catalog').classList.add('hidden');$('cc-builder-settings').classList.add('hidden');$('cc-provisional').classList.add('hidden');$('cc-inbox').classList.remove('hidden');});
$('cc-view-catalog').addEventListener('click',e=>{e.preventDefault();if(!confirmConsultationLeave())return;$('cc-inbox').classList.add('hidden');$('cc-builder-settings').classList.add('hidden');$('cc-provisional').classList.add('hidden');$('cc-catalog').classList.remove('hidden');catalogFields();loadCatalogEntries();});
async function loadBuilderSettings(){
 const status=$('cc-builder-settings-status');status.textContent='Loading…';
 try{const rows=await authorizedRequest(table('cc_builder_settings','id=eq.default&select=show_variants'));if(!Array.isArray(rows)||rows.length!==1)throw Error('Settings row not found. Run the SQL setup first.');$('cc-variants-toggle').value=String(rows[0].show_variants);status.textContent='Current setting loaded.';}
 catch(err){status.textContent='Unable to load: '+err.message;}
}
$('cc-view-settings').addEventListener('click',e=>{e.preventDefault();if(!confirmConsultationLeave())return;$('cc-inbox').classList.add('hidden');$('cc-catalog').classList.add('hidden');$('cc-provisional').classList.add('hidden');$('cc-builder-settings').classList.remove('hidden');loadBuilderSettings();});
$('cc-save-builder-settings').addEventListener('click',async e=>{
 e.preventDefault();e.stopPropagation();const btn=$('cc-save-builder-settings'),status=$('cc-builder-settings-status');btn.disabled=true;status.textContent='Saving…';
 try{const rows=await authorizedRequest(table('cc_builder_settings','id=eq.default&select=show_variants'),{method:'PATCH',body:{show_variants:$('cc-variants-toggle').value==='true'},headers:{Prefer:'return=representation'}});if(!Array.isArray(rows)||rows.length!==1)throw Error('Setting was not updated. Check staff permissions and RLS.');status.textContent='Saved. The public builder will use this setting on its next page load.';}
 catch(err){status.textContent='Not saved: '+err.message;}
 finally{btn.disabled=false;}
});
$('cc-cat-category').addEventListener('change',()=>{catalogMakerRequest++;$('cc-cat-maker-search').value='';catalogFields();});
$('cc-cat-class').addEventListener('change',()=>{catalogMakerRequest++;$('cc-cat-maker-search').value='';catalogFields();});
$('cc-cat-kind').addEventListener('change',catalogFields);
$('cc-cat-maker-search').addEventListener('input',renderCatalogMakers);
$('cc-cat-add').addEventListener('click',async e=>{
 e.preventDefault();e.stopPropagation();
 const category=$('cc-cat-category').value,kind=$('cc-cat-kind').value;
 const manufacturer=(kind==='model'?$('cc-cat-maker-select').value:$('cc-cat-maker').value).trim();
 const model=$('cc-cat-model').value.trim();
 const weapon_class=category==='Firearm'?($('cc-cat-class').value||null):null;
 const notes=$('cc-cat-notes').value.trim()||null;
 if(!manufacturer)return catalogStatus(kind==='model'?'Select an existing manufacturer.':'Enter a manufacturer name.',true);
 if(!model)return catalogStatus('Enter a model.',true);
 if(category==='Firearm'&&!weapon_class)return catalogStatus('Choose Rifle, Pistol, or Shotgun.',true);
 const btn=$('cc-cat-add');btn.disabled=true;catalogStatus('Saving…');
 try{
  await authorizedRequest(table('cc_catalog_additions'),{method:'POST',body:{category,weapon_class,manufacturer,model,notes,created_by:currentUser.id},headers:{Prefer:'return=minimal'}});
  catalogStatus('Catalog entry added successfully.');$('cc-cat-model').value='';$('cc-cat-notes').value='';loadCatalogEntries();
  catalogMakerCache.clear();if(kind==='manufacturer')$('cc-cat-maker').value='';
 }catch(err){catalogStatus(err.status===409?'This entry already exists.':err.message,true)}finally{btn.disabled=false;}
});

 let catalogEntries=[];
 async function loadCatalogEntries(){
  const status=$('cc-cat-manage-status');status.textContent='Loading custom entries…';
  try{
   const rows=await authorizedRequest(table('cc_catalog_additions','select=id,category,weapon_class,manufacturer,model,notes,removed_at,removed_by,created_at&order=created_at.desc&limit=1000'));
   catalogEntries=Array.isArray(rows)?rows:[];renderCatalogEntries();
  }catch(err){status.textContent='Unable to load: '+err.message;}
 }
 function renderCatalogEntries(){
  const term=$('cc-cat-manage-search').value.trim().toLowerCase(),filter=$('cc-cat-manage-filter').value;
  const rows=catalogEntries.filter(r=>(filter==='all'||(filter==='removed'?!!r.removed_at:!r.removed_at))&&(!term||[r.manufacturer,r.model,r.category,r.weapon_class].some(v=>String(v||'').toLowerCase().includes(term))));
  $('cc-cat-manage-status').textContent=rows.length+' matching custom entries ('+catalogEntries.length+' total).';
  $('cc-cat-manage-results').innerHTML=rows.length?rows.map(r=>'<div class="card row" data-catalog-entry="'+escape(r.id)+'"><div class="grow"><strong>'+escape(r.manufacturer)+' — '+escape(r.model)+'</strong><div class="muted">'+escape(r.category)+(r.weapon_class?' · '+escape(r.weapon_class):'')+(r.removed_at?' · Removed '+escape(new Date(r.removed_at).toLocaleString()):' · Active')+'</div></div><button type="button" class="'+(r.removed_at?'secondary':'')+'" data-catalog-toggle="1">'+(r.removed_at?'Restore':'Remove')+'</button></div>').join(''):'<p class="muted">No matching custom entries.</p>';
 }
 $('cc-cat-manage-search').addEventListener('input',renderCatalogEntries);
 $('cc-cat-manage-filter').addEventListener('change',renderCatalogEntries);
 $('cc-cat-manage-refresh').addEventListener('click',loadCatalogEntries);
 $('cc-cat-manage-results').addEventListener('click',async e=>{
  const btn=e.target.closest('[data-catalog-toggle]');if(!btn)return;
  const row=btn.closest('[data-catalog-entry]'),item=catalogEntries.find(x=>x.id===row?.dataset.catalogEntry);if(!item)return;
  const restoring=!!item.removed_at;
  if(!window.confirm((restoring?'Restore':'Remove')+' '+item.manufacturer+' — '+item.model+'?'))return;
  btn.disabled=true;
  try{
   const result=await authorizedRequest(table('cc_catalog_additions','id=eq.'+encodeURIComponent(item.id)+'&select=id,removed_at'),{method:'PATCH',body:{removed_at:restoring?null:new Date().toISOString(),removed_by:restoring?null:currentUser.id},headers:{Prefer:'return=representation'}});
   if(!Array.isArray(result)||result.length!==1)throw Error('Entry was not updated. Check staff permissions.');
   catalogMakerCache.clear();await loadCatalogEntries();catalogStatus(restoring?'Entry restored.':'Entry removed from active custom catalog.');
  }catch(err){catalogStatus('Unable to update entry: '+err.message,true);btn.disabled=false;}
 });
$('cc-refresh').type='button';
$('cc-refresh').addEventListener('click',async e=>{e.preventDefault();if(!confirmConsultationLeave())return;try{await load();message('Updated.')}catch(err){message(err.message,true)}});
$('cc-search').addEventListener('input',render);$('cc-filter').addEventListener('change',render);$('cc-assignment-filter').addEventListener('change',render);
$('cc-stats').addEventListener('click',e=>{const card=e.target.closest('button.cc-status-filter');if(!card)return;const filter=$('cc-filter');const next=filter.value===card.dataset.status?'':card.dataset.status;if(next===filter.value)return;filter.value=next;render();});
$('cc-detail').addEventListener('click',e=>{const toggle=e.target.closest('#cc-show-supplier-links');if(toggle){const host=$('cc-supplier-links');const opening=host.classList.contains('hidden');host.classList.toggle('hidden',!opening);toggle.setAttribute('aria-expanded',String(opening));toggle.textContent=opening?'Hide supplier listings ▴':'See supplier listings ▾';if(opening&&!host.dataset.loaded){host.dataset.loaded='1';const r=records.find(x=>x.id===selected);if(r)loadConsultationSupplierLinks(r,selected);}return;} });
$('cc-detail').addEventListener('click',e=>{const b=e.target.closest('[data-copy-supplier-id]');if(b){e.preventDefault();navigator.clipboard?.writeText(b.dataset.copySupplierId||'');}});
$('cc-list').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b){e.preventDefault();const r=records.find(x=>x.id===b.dataset.id);if(r){if(r.id!==selected&&!confirmConsultationLeave())return;if(r.id!==selected)renderDetail(r);$('cc-list').querySelectorAll('.item').forEach(x=>x.classList.toggle('selected',x.dataset.id===r.id));}}});
$('cc-detail').addEventListener('click',async e=>{
 const editButton=e.target.closest('[data-note-edit]');
 const cancelButton=e.target.closest('[data-note-cancel]');
 const saveButton=e.target.closest('[data-note-save]');
 if(editButton||cancelButton||saveButton){
  e.preventDefault();e.stopPropagation();
  const card=e.target.closest('[data-note-id]');if(!card)return;
  const editor=card.querySelector('.note-edit'),display=card.querySelector('.cc-note-display');
  if(editButton){editor.classList.remove('hidden');card.querySelector('[data-note-edit]').classList.add('hidden');card.querySelector('[data-note-text]').focus();return;}
  if(cancelButton){card.querySelector('[data-note-text]').value=display.textContent;editor.classList.add('hidden');card.querySelector('[data-note-edit]').classList.remove('hidden');return;}
  const id=card.dataset.noteId,consultationId=selected,txt=card.querySelector('[data-note-text]').value.trim(),status=card.querySelector('[data-note-status]');
  if(!txt){status.textContent='Note cannot be empty.';return;}
  saveButton.disabled=true;status.textContent='Saving note…';
  try{
   const rows=await authorizedRequest(table('cc_consultation_notes','id=eq.'+encodeURIComponent(id)+'&consultation_id=eq.'+encodeURIComponent(consultationId)+'&select=id,note,updated_at'),{method:'PATCH',body:{note:txt},headers:{Prefer:'return=representation'}});
   if(!Array.isArray(rows)||rows.length!==1||rows[0].id!==id)throw Error('No note was updated. Check note UPDATE permissions and RLS.');
   if(selected!==consultationId)return;
   display.textContent=rows[0].note;
   const edited=card.querySelector('[data-note-edited]');
   if(edited)edited.textContent=rows[0].updated_at?'Last edited '+new Date(rows[0].updated_at).toLocaleString():'Not edited';
   editor.classList.add('hidden');card.querySelector('[data-note-edit]').classList.remove('hidden');status.textContent='';message('Internal note updated.');
  }catch(err){status.textContent='Not saved: '+err.message;message('Note update failed: '+err.message,true)}finally{saveButton.disabled=false;}
  return;
 }
 if(e.target.id==='cc-print-report'){
  const r=records.find(x=>x.id===selected);
  if(!r)return;
  if(consultationHasUnsavedChanges()&&!window.confirm('This report uses the last saved consultation details and notes. Continue printing?'))return;
  const report=window.open('','_blank');
  if(!report){message('Allow pop-ups to print this report.',true);return;}
  const safe=(v)=>escape(v==null?'':String(v));
  const noteCards=[...$('cc-notes').querySelectorAll('[data-note-id]')].map(card=>{
   const author=card.querySelector('.muted')?.textContent||'Employee';
   const note=card.querySelector('.cc-note-display')?.textContent||'';
   return '<section class="note"><small>'+safe(author)+'</small><p>'+safe(note)+'</p></section>';
  }).join('');
  const body='<!doctype html><html><head><meta charset="utf-8"><title>Consultation report</title><style>body{font:14px/1.5 Arial,sans-serif;color:#171717;margin:30px auto;max-width:820px}header{border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:18px}h1{font-size:24px;margin:0}h2{font-size:18px;margin:25px 0 10px}.meta{color:#555}.answers{display:block}.answer-card,.note{border:1px solid #ccc;border-radius:6px;padding:10px 13px;margin:8px 0;break-inside:avoid}.answer-label{font-weight:bold;color:#555}.answer-value{white-space:pre-wrap;overflow-wrap:anywhere}.note p{white-space:pre-wrap}.report-actions{margin:16px 0}@media print{.report-actions{display:none}body{margin:0;max-width:none}}@page{margin:16mm}</style></head><body><div class="report-actions"><button onclick="window.print()">Print / Save as PDF</button></div><header><h1>Copper Custom — Consultation report</h1><div class="meta">Request ID: '+safe(r.id)+' · Submitted: '+safe(new Date(r.created_at).toLocaleString())+'</div></header><h2>Customer</h2><p>'+safe(r.customer_name)+'<br>'+safe(r.customer_email)+'<br>'+safe(r.customer_phone)+'</p><p><b>Status:</b> '+safe(r.status)+' &nbsp; <b>Assigned to:</b> '+safe(r.handled_by||'Unassigned')+'</p><h2>Customer answers</h2><div class="answers">'+renderAnswers(r.answers)+'</div><h2>Internal notes — employee use only</h2>'+(noteCards||'<p>No internal notes.</p>')+'</body></html>';
  report.document.open();report.document.write(body);report.document.close();report.focus();
  return;
 }
 if(e.target.id==='cc-save'||e.target.id==='cc-save-top'){
  e.preventDefault();const r=records.find(x=>x.id===selected);if(!r)return;
  const status=$('cc-status').value,handled_by=$('cc-handler').value.trim()||null;
  const buttons=[$('cc-save'),$('cc-save-top')].filter(Boolean);const indicator=$('cc-save-status');buttons.forEach(b=>b.disabled=true);indicator.textContent='Saving…';message('');
  try{
   const updated=await authorizedRequest(table('cc_consultations','id=eq.'+encodeURIComponent(r.id)+'&select=id,status,handled_by'),{method:'PATCH',body:{status,handled_by},headers:{Prefer:'return=representation'}});
   if(!Array.isArray(updated)||updated.length!==1||updated[0].id!==r.id)throw Error('No consultation was updated. Check the Supabase UPDATE permission and RLS policy.');
   r.status=updated[0].status;r.handled_by=updated[0].handled_by;
   const currentId=selected;
   if(currentId===r.id){indicator.textContent='Changes saved';$('cc-status').value=r.status;$('cc-handler').value=r.handled_by||'';}
   // Refresh the inbox and counters without rebuilding the detail panel.
   const q=$('cc-search').value.toLowerCase().trim(),f=$('cc-filter').value,assignment=$('cc-assignment-filter').value;
   $('cc-stats').innerHTML=statuses.map(name=>'<button type="button" class="card metric cc-status-filter" data-status="'+escape(name)+'" aria-pressed="'+String($('cc-filter').value===name)+'" title="Filter consultations by '+escape(name)+'"><strong>'+records.filter(x=>x.status===name).length+'</strong><span class="pill" data-status="'+escape(name)+'">'+escape(name)+'</span></button>').join('');
   const shown=records.filter(x=>(!f||x.status===f)&&(!assignment||(assignment==='assigned'?!!String(x.handled_by||'').trim():!String(x.handled_by||'').trim()))&&(!q||[x.customer_name,x.customer_email,x.id,x.weapon_class,x.handled_by].some(v=>String(v||'').toLowerCase().includes(q))));
   $('cc-list-count').textContent='('+shown.length+' of '+records.length+')';
 $('cc-list').innerHTML=shown.length?shown.map(x=>'<button type="button" class="item'+(selected===x.id?' selected':'')+'" data-id="'+escape(x.id)+'" data-status="'+escape(x.status)+'"><span class="pill" data-status="'+escape(x.status)+'">'+escape(x.status)+'</span> <strong>'+escape(x.customer_name)+'</strong><br><span class="muted">'+escape(x.weapon_class||'Consultation')+' · '+escape(new Date(x.created_at).toLocaleDateString())+'</span><br><span class="assignment-label'+(x.handled_by?'':' unassigned')+'">'+(x.handled_by?'Assigned: '+escape(x.handled_by):'Unassigned')+'</span>'+atomicAssuranceInbox(x.answers)+'</button>').join(''):'<p>No matching consultations.</p>';
   message('Changes saved successfully.');
  }catch(err){if(selected===r.id)indicator.textContent='Not saved';message('Save failed: '+err.message,true)}finally{buttons.forEach(b=>b.disabled=false);}
 }
 if(e.target.id==='cc-add-note'){
  e.preventDefault();const note=$('cc-note-text').value.trim();if(!note)return message('Enter a note first.',true);
  const id=selected;
  try{await authorizedRequest(table('cc_consultation_notes'),{method:'POST',body:{consultation_id:id,author_id:currentUser.id,note},headers:{Prefer:'return=minimal'}});const r=records.find(x=>x.id===id);if(r)await renderDetail(r);message('Internal note saved.');}catch(err){message(err.message,true)}
 }
});
(async()=>{
 try{
  saveSession(parseSession());
  if(session?.access_token){
   const user=await authorizedRequest('/auth/v1/user');currentUser=user;await load();show(true);
  }else show(false);
 }catch(e){saveSession(null);currentUser=null;show(false);message('Please sign in. '+e.message,true);}
})();
})();