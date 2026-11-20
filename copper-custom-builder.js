(function(){
'use strict';
var root=document.getElementById('cc-builder-v400');if(!root||root.__ready)return;root.__ready=true;
var assuranceStyles=document.createElement('style');
assuranceStyles.textContent=`#cc-builder-v400 .cc-welcome .cc-benefits{grid-template-columns:1fr}
#cc-builder-v400 .cc-assurance-aside{display:grid;gap:4px;justify-items:center;width:fit-content;max-width:100%;margin:22px auto 0;padding:11px clamp(14px,4vw,32px);color:#dfcfc1;text-align:center;font-size:13px;line-height:1.55;border:1px solid #9a6e49;border-radius:7px;background:radial-gradient(ellipse at 50% 0%,#66442e 0%,#30231d 56%,#201a18 100%);box-shadow:inset 0 1px 0 #e6b58645,0 5px 20px #0004}
#cc-builder-v400 .cc-assurance-aside strong{color:#f4c999;font:700 12px/1.35 Arial,sans-serif;letter-spacing:.15em;text-transform:uppercase}
#cc-builder-v400 .cc-assurance-coverage{display:grid;grid-template-columns:1fr 1fr;gap:5px 20px;padding-left:20px}
#cc-builder-v400 .cc-assurance-preview{margin:18px 0}
#cc-builder-v400 .cc-assurance-preview summary{cursor:pointer;color:#efc99f;font-weight:700}
#cc-builder-v400 .cc-assurance-report{margin-top:14px;background:#f9f5ee;color:#282320;border-top:5px solid #a46e45;padding:clamp(14px,4vw,36px);font-size:14px;overflow-wrap:anywhere}
#cc-builder-v400 .cc-assurance-report header{border-bottom:1px solid #d6c5b5;padding-bottom:12px}
#cc-builder-v400 .cc-assurance-report h3,#cc-builder-v400 .cc-assurance-report h4,#cc-builder-v400 .cc-assurance-report p{color:inherit;margin:0 0 6px}
#cc-builder-v400 .cc-assurance-report h3{font:700 clamp(20px,4vw,30px)/1.2 Georgia,serif}
#cc-builder-v400 .cc-assurance-report .report-brand{font-size:11px;font-weight:700;letter-spacing:.13em;color:#774d30}
#cc-builder-v400 .cc-assurance-report .report-sample{font-size:12px;color:#695b50}
#cc-builder-v400 .cc-assurance-report .report-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin:14px 0 0}
#cc-builder-v400 .cc-assurance-report dd{margin:0}
#cc-builder-v400 .cc-assurance-report section,#cc-builder-v400 .cc-assurance-report footer{border-top:1px solid #d6c5b5;margin-top:14px;padding-top:12px}
#cc-builder-v400 .cc-assurance-report table{border-collapse:collapse;width:100%;margin-bottom:8px;text-align:left}
#cc-builder-v400 .cc-assurance-report th,#cc-builder-v400 .cc-assurance-report td{padding:5px;border-bottom:1px solid #e0d4c8;vertical-align:top}
#cc-builder-v400 .cc-assurance-report a{color:#713c1d;text-decoration:underline}
@media(max-width:580px){#cc-builder-v400 .cc-assurance-coverage{grid-template-columns:1fr}#cc-builder-v400 .cc-assurance-report table{font-size:12px}}
`;
root.appendChild(assuranceStyles);
var API='https://cyrmysbcrpiadchcpsfa.supabase.co/functions/v1/public-lipseys-search';
var SUBMIT_API='https://cyrmysbcrpiadchcpsfa.supabase.co/functions/v1/submit-copper-consultation';
var TURNSTILE_SITE_KEY='0x4AAAAAAF6Q79oPFdIIVvhy';
var turnstileWidget=null,turnstileToken='',submittedId='',submitting=false;
var content=root.querySelector('#cc-content'),progress=root.querySelector('#cc-progress'),back=root.querySelector('#cc-back'),next=root.querySelector('#cc-next');
var step=-1,loading=false,error='',requestId=0,searchSequence=0;
var steps=['category','type','goals','primary','optics','lights','suppressors','extras','review'];
var extraTopics=[{id:'mounts',name:'Mounts & Accessories'},{id:'finishes',name:'Custom Finishes'},{id:'slings',name:'Slings or Cases'},{id:'ergonomics',name:'Ergonomics & Fit'},{id:'other',name:'Other Options'}];
function newPreference(){return{manufacturer:'',model:'',source:'',sourceId:'',barrelLength:'',variant:null};}
function newSection(){return{interest:'',design:'',material:'',opticType:'',mountingSolution:'',preferences:[newPreference()],suggestion:false,notListed:false,unlisted:''};}
function newExtras(){var out={};extraTopics.forEach(function(t){out[t.id]={answer:'',notes:''};});return out;}
var atomicAssurance={name:'Atomic Assurance',price:100,currency:'USD'};
var atomicAssurancePrice=new Intl.NumberFormat('en-US',{style:'currency',currency:atomicAssurance.currency,minimumFractionDigits:0}).format(atomicAssurance.price);
var contact={atomicAssuranceRequested:null,name:'',email:'',phone:'',method:'Email',representativeChoice:'',preferredRepresentative:''};
var state={category:'',firearmType:'',firearmAction:'',pistolType:'',pistolMechanism:'',pistolTriggerAction:'',pistolOtherType:'',shotgunPurpose:'',shotgunAction:'',shotgunFeed:'',productType:'',purpose:[],purposeOther:'',budget:'',goals:'',primary:newSection(),optics:newSection(),lights:newSection(),suppressors:newSection(),extras:newExtras(),notes:''};
var data={filters:[],categories:[],manufacturers:{primary:[],optics:[],lights:[],suppressors:[]},loaded:{primary:false,optics:false,lights:false,suppressors:false}};
var searches={},variantLoads={},variantSequence=0;
var showVariants=true; // Fail open to the current public experience
var SETTINGS_URL='https://cyrmysbcrpiadchcpsfa.supabase.co/rest/v1/cc_builder_settings?id=eq.default&select=show_variants';
var SETTINGS_KEY='sb_publishable_hnv_oiFbbIoPjOzBvB3ehA_BCzCe82X';
function loadDisplaySetting(){fetch(SETTINGS_URL,{headers:{apikey:SETTINGS_KEY}}).then(function(r){if(!r.ok)throw Error('Settings unavailable');return r.json();}).then(function(rows){if(Array.isArray(rows)&&rows.length&&typeof rows[0].show_variants==='boolean'){showVariants=rows[0].show_variants;if(step===3)render();}}).catch(function(){/* Keep existing variants visible if settings cannot be read. */});}

function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function isFirearm(){return ['Rifle','Pistol','Shotgun'].indexOf(state.category)!==-1;}
function requireFirearmClass(){if(!isFirearm())throw new Error('Choose Rifle, Pistol, or Shotgun before browsing firearm models.');return state.category;}
function itemTypeFor(key){return key==='optics'?'Optic':key==='suppressors'?'NFA':'Accessory';}
function api(body){return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){if(!r.ok||!j.success)throw Error(j.error||'Catalog request failed');return j;});});}
function beginRequest(){var id=++requestId;loading=true;error='';render();return id;}
function finishRequest(id,cb){if(id!==requestId)return;loading=false;cb();render();}
function failRequest(id,e){if(id!==requestId)return;loading=false;error=e.message||'Catalog unavailable';render();}
function invalidateSearches(){searchSequence++;Object.keys(searches).forEach(function(k){clearTimeout(searches[k].timer);});searches={};}
function resetCatalog(){variantLoads={};state.firearmType='';state.firearmAction='';state.pistolType='';state.pistolMechanism='';state.pistolTriggerAction='';state.pistolOtherType='';state.shotgunPurpose='';state.shotgunAction='';state.shotgunFeed='';state.productType='';state.primary=newSection();state.optics=newSection();state.lights=newSection();state.suppressors=newSection();data.filters=[];data.categories=[];data.manufacturers={primary:[],optics:[],lights:[],suppressors:[]};data.loaded={primary:false,optics:false,lights:false,suppressors:false};invalidateSearches();}
function resetPrimaryCatalog(){variantLoads={};state.primary=newSection();data.manufacturers.primary=[];data.loaded.primary=false;invalidateSearches();}
function loadTypes(){if(state.category==='Pistol'||state.category==='Shotgun'){render();return;}var id=beginRequest();api({action:'unified-firearm-filters',weaponClass:state.category,firearmType:null}).then(function(j){finishRequest(id,function(){data.filters=j.filters||[];var types=data.filters.filter(function(x){return x.field==='firearm_type';});if(types.length===1)state.firearmType=types[0].name;});}).catch(function(e){failRequest(id,e);});}
function loadActions(){var id=beginRequest();api({action:'unified-firearm-filters',weaponClass:state.category,firearmType:state.firearmType}).then(function(j){finishRequest(id,function(){data.filters=data.filters.filter(function(x){return x.field==='firearm_type';}).concat((j.filters||[]).filter(function(x){return x.field==='action';}));});}).catch(function(e){failRequest(id,e);});}
function primaryCatalogFilters(){
 var firearmType=state.firearmType||null,firearmAction=state.firearmAction||null;
 if(state.category==='Pistol'){
  firearmType=state.pistolType==='Semi-Auto'?'Semi-Auto Pistol':state.pistolType==='Revolver'?'Revolver':(state.pistolType==='Single Shot'||state.pistolType==='Other')?'Specialty Handgun':null;
  firearmAction=null;
  if(state.pistolType==='Semi-Auto'){
   if(state.pistolMechanism==='Striker-Fired')firearmAction='Striker Fired';
   else if(state.pistolMechanism==='Hammer-Fired'){
    if(state.pistolTriggerAction==='Single Action')firearmAction='Single Action';
    else if(state.pistolTriggerAction==='Double Action')firearmAction='Double Action Only';
    else if(state.pistolTriggerAction==='DA/SA')firearmAction='Double / Single Action';
   }
  }else if(state.pistolType==='Single Shot')firearmAction='Single Shot';
 }else if(state.category==='Shotgun'){
  // Shotgun preference labels do not yet have verified catalog action mappings.
  firearmType=null;firearmAction=null;
 }
 return{weaponClass:requireFirearmClass(),firearmType:firearmType,firearmAction:firearmAction};
}
function manufacturerRequest(key){if(key==='primary'){var f=primaryCatalogFilters();return{action:'unified-firearm-manufacturers',weaponClass:f.weaponClass,firearmType:f.firearmType,firearmAction:f.firearmAction};}if(key==='lights')return{action:'light-manufacturers'};return{action:'manufacturers',itemType:itemTypeFor(key),productType:null};}
function loadManufacturers(key){if(data.loaded[key]){render();return;}var id=beginRequest();(key==='lights'?api(manufacturerRequest(key)).then(function(j){if(j.manufacturers&&j.manufacturers.length)return j;return api({action:'manufacturers',itemType:'Accessory',productType:'Accessory-Lights'});}).catch(function(){return api({action:'manufacturers',itemType:'Accessory',productType:'Accessory-Lights'});}):api(manufacturerRequest(key))).then(function(j){finishRequest(id,function(){data.manufacturers[key]=j.manufacturers||[];data.loaded[key]=true;});}).catch(function(e){failRequest(id,e);});}
function modelRequest(key,m,term,offset){if(key==='primary'){var f=primaryCatalogFilters();return{action:'unified-firearm-products',weaponClass:f.weaponClass,firearmType:f.firearmType,firearmAction:f.firearmAction,manufacturer:m,search:term||null,limit:50,offset:offset};}if(key==='lights')return{action:'light-products',manufacturer:m,search:term||null,limit:50,offset:offset};return{action:'products',itemType:itemTypeFor(key),productType:null,manufacturer:m,search:term||null,limit:50,offset:offset};}
function getSearch(key,index){var id=key+'-'+index;if(!searches[id])searches[id]={term:'',rows:[],seen:Object.create(null),hasMore:false,offset:0,loading:false,error:'',loaded:false,token:0,timer:null};return searches[id];}
function productLabel(p){return String(p.model||p.description_1||p.manufacturer_model_no||p.lipseys_item_no||'Unnamed catalog item').trim();}
function addUniqueModels(s,products){(products||[]).forEach(function(p){var name=productLabel(p),norm=name.toLowerCase().replace(/[^a-z0-9]+/g,'');if(!norm)return;var candidate={name:name,source:p.source||'',sourceId:p.source_id||p.lipseys_item_no||''};var existing=s.seen[norm];if(existing){if(existing.source!=='lipseys'&&candidate.source==='lipseys'){existing.name=candidate.name;existing.source=candidate.source;existing.sourceId=candidate.sourceId;}return;}s.seen[norm]=candidate;s.rows.push(candidate);});s.rows.sort(function(a,b){return a.name.localeCompare(b.name);});}
function runModelSearch(key,index,term,append){var pref=state[key].preferences[index];if(!pref||!pref.manufacturer)return;var s=getSearch(key,index);if(append&&s.loading)return;var token=++searchSequence;s.token=token;if(!append){s.term=term;s.rows=[];s.seen=Object.create(null);s.offset=0;s.hasMore=false;}s.loading=true;s.error='';updateModelDropdown(key,index);var manufacturer=pref.manufacturer,offset=append?s.offset:0,requestedClass=key==='primary'?state.category:null;(key==='lights'?api(modelRequest(key,manufacturer,term,offset)).catch(function(){return api({action:'products',itemType:'Accessory',productType:'Accessory-Lights',manufacturer:manufacturer,search:term||null,limit:50,offset:offset});}):api(modelRequest(key,manufacturer,term,offset))).then(function(j){if(s.token!==token)return;if(key==='primary'&&state.category!==requestedClass)return;var cur=state[key].preferences[index];if(!cur||cur.manufacturer!==manufacturer)return;var products=j.products||[];if(key==='primary'){products=products.filter(function(p){return p.weapon_class===requestedClass;});}addUniqueModels(s,products);s.offset=offset+(j.products||[]).length;s.hasMore=!!j.hasMore;s.loading=false;s.loaded=true;updateModelDropdown(key,index);}).catch(function(e){if(s.token!==token||(key==='primary'&&state.category!==requestedClass))return;s.loading=false;s.error=e.message||'Search failed';s.loaded=true;updateModelDropdown(key,index);});}
function scheduleModelSearch(key,index,term){var s=getSearch(key,index);clearTimeout(s.timer);s.term=term;s.loading=true;s.error='';updateModelDropdown(key,index);s.timer=setTimeout(function(){runModelSearch(key,index,term,false);},300);}
function modelOptionsHtml(key,index){var s=getSearch(key,index),html='';s.rows.forEach(function(item,i){html+='<button type="button" data-model-pick="1" data-section="'+key+'" data-index="'+index+'" data-row="'+i+'">'+esc(item.name)+'</button>';});if(s.loading)html+='<div class="dropdown-status">Searching catalog…</div>';else if(s.error)html+='<div class="dropdown-status">'+esc(s.error)+'</div>';else if(!s.rows.length)html+='<div class="dropdown-status">'+(s.loaded?'No matching catalog models.':'Start typing to search the catalog.')+'</div>';if(s.hasMore&&!s.loading)html+='<button type="button" class="load-more" data-load-more="1" data-section="'+key+'" data-index="'+index+'">Load more models…</button>';return html;}
function updateModelDropdown(key,index){var input=root.querySelector('[data-model-input="cc-model-'+key+'-'+index+'"]');if(!input)return;var menu=input.closest('.select-wrap').querySelector('.dropdown');if(!menu)return;menu.innerHTML=modelOptionsHtml(key,index);menu.hidden=false;}
function variantDetails(v){return [v.caliber,v.capacity?v.capacity+' capacity':'',v.barrel_length?v.barrel_length+' barrel':'',v.finish].filter(Boolean).join(' · ')||'Configuration details to be confirmed';}
function variantGroups(rows){
 var groups=[],seen=Object.create(null);
 (rows||[]).forEach(function(v,i){
  var label=variantDetails(v),key=label.toLowerCase().replace(/\s+/g,' ').trim();
  if(!seen[key]){seen[key]={label:label,items:[],firstIndex:i};groups.push(seen[key]);}
  seen[key].items.push({variant:v,index:i});
 });
 return groups;
}
function variantEditor(index,pref){
  if(!showVariants)return '';
 if(!pref.model)return '';
 var load=variantLoads[index],html='<div class="field cc-variants"><label>Preferred configuration (optional)</label>';
 if(!load||load.manufacturer!==pref.manufacturer||load.model!==pref.model)return html+'<p class="muted">Loading configurations…</p></div>';
 if(load.loading)return html+'<p class="muted">Loading configurations…</p></div>';
 if(load.error)return html+'<p class="error">'+esc(load.error)+'</p><button type="button" class="btn" data-variant-retry="1" data-index="'+index+'">Retry configurations</button></div>';
 if(!load.rows.length)return html+'<p class="muted">No catalog configurations found. You can still describe your preferences in your consultation.</p></div>';
 html+='<p class="muted">Choose the specifications that matter to you, or leave the configuration open for your representative. Similar listings are grouped; your representative will verify exact availability and compatibility.</p><div class="grid">';
 html+='<button type="button" class="choice'+(!pref.variant?' selected':'')+'" data-variant-pick="1" data-index="'+index+'" data-row="-1" aria-pressed="'+(!pref.variant)+'"><span class="choice-text"><strong>No specific configuration</strong><small>Let my representative recommend one</small></span><span class="mark">'+(!pref.variant?'✓':'')+'</span></button>';
 variantGroups(load.rows).forEach(function(g){
  var selected=!!pref.variant&&g.items.some(function(item){return item.variant.source===pref.variant.source&&item.variant.source_id===pref.variant.source_id;});
  html+='<button type="button" class="choice'+(selected?' selected':'')+'" data-variant-pick="1" data-index="'+index+'" data-row="'+g.firstIndex+'" aria-pressed="'+selected+'"><span class="choice-text"><strong>'+esc(g.label)+'</strong>'+(g.items.length>1?'<small>Multiple catalog listings share these specifications</small>':'')+'</span><span class="mark">'+(selected?'✓':'')+'</span></button>';
 });
 html+='</div>';
 if(load.hasMore)html+='<button type="button" class="btn" data-variant-more="1" data-index="'+index+'">Load more configurations…</button>';
 return html+'</div>';
}
function loadVariants(index,append){
 var pref=state.primary.preferences[index];if(!pref||!pref.manufacturer||!pref.model)return;
 var f=primaryCatalogFilters(),existing=variantLoads[index];
 var offset=append&&existing?existing.rows.length:0;
 var load=append&&existing?existing:{manufacturer:pref.manufacturer,model:pref.model,rows:[],loading:false,error:'',hasMore:false,token:0};
 if(load.loading)return;
 variantLoads[index]=load;var token=++variantSequence;load.token=token;load.loading=true;load.error='';render();
 api({action:'unified-firearm-model-variants',manufacturer:pref.manufacturer,model:pref.model,weaponClass:f.weaponClass,firearmType:f.firearmType,limit:99,offset:offset}).then(function(j){
  if(variantLoads[index]!==load||load.token!==token)return;
  var current=state.primary.preferences[index];if(!current||current.manufacturer!==load.manufacturer||current.model!==load.model)return;
  load.rows=append?load.rows.concat(j.variants||[]):j.variants||[];load.hasMore=!!j.hasMore;load.loading=false;render();
 }).catch(function(e){if(variantLoads[index]!==load||load.token!==token)return;load.loading=false;load.error=e.message||'Variant lookup failed';render();});
}
function heading(title,desc){return '<h3>'+esc(title)+'</h3><p class="help">'+esc(desc)+'</p>';}
function choices(items,selected,kind){return '<div class="grid">'+items.map(function(item){var name=typeof item==='string'?item:item.name,count=typeof item==='string'?null:(item.product_count!=null?item.product_count:item.count),active=selected===name;return '<button type="button" class="choice'+(active?' selected':'')+'" data-kind="'+esc(kind)+'" data-value="'+esc(name)+'" aria-pressed="'+active+'"><span class="choice-text"><strong>'+esc(name)+'</strong>'+(count!=null?'<small>'+esc(count)+' catalog items</small>':'')+'</span><span class="mark">'+(active?'✓':'')+'</span></button>';}).join('')+'</div>';}
function multiChoices(items,selected,kind){return '<div class="grid">'+items.map(function(name){var active=selected.indexOf(name)!==-1;return '<button type="button" class="choice'+(active?' selected':'')+'" data-kind="'+esc(kind)+'" data-value="'+esc(name)+'" aria-pressed="'+active+'"><span class="choice-text"><strong>'+esc(name)+'</strong></span><span class="mark">'+(active?'✓':'')+'</span></button>';}).join('')+'</div>';}
function manufacturerDropdown(key,index,pref){var html='<div class="select-wrap"><input type="text" data-manufacturer-input="1" data-section="'+key+'" data-index="'+index+'" autocomplete="off" placeholder="Search or select manufacturer" value="'+esc(pref.manufacturer)+'"><div class="dropdown" hidden>';data.manufacturers[key].forEach(function(item){var name=typeof item==='string'?item:(item.manufacturer||item.name);html+='<button type="button" data-manufacturer-pick="1" data-section="'+key+'" data-index="'+index+'" data-value="'+esc(name)+'">'+esc(name)+'</button>';});return html+'</div></div>';}
function modelDropdown(key,index,pref){return '<div class="select-wrap"><input type="text" data-model-input="cc-model-'+key+'-'+index+'" data-section="'+key+'" data-index="'+index+'" autocomplete="off" placeholder="'+(pref.manufacturer?'Search all catalog models':'Choose a manufacturer first')+'" value="'+esc(pref.model)+'"><div class="dropdown" hidden>'+modelOptionsHtml(key,index)+'</div></div>';}
function preferenceEditor(key){var s=state[key],html='';s.preferences.forEach(function(pref,i){html+='<div class="preference"><div class="pref-head"><h4>Preference '+(i+1)+' of 3</h4>'+(i>0?'<button type="button" class="link" data-action="remove-pref" data-section="'+key+'" data-index="'+i+'">Remove</button>':'')+'</div><div class="field"><label>Preferred manufacturer</label>'+manufacturerDropdown(key,i,pref)+'</div><div class="field"><label>Preferred model (optional)</label>'+modelDropdown(key,i,pref)+'<p class="muted">Model names appear once. Select a configuration below, if desired.</p></div>'+(key==='primary'?variantEditor(i,pref):'')+(key==='primary'&&(state.category==='Rifle'||state.category==='Shotgun')?'<div class="field"><label>Preferred barrel length (optional)</label><input type="text" data-barrel-length="1" data-index="'+i+'" maxlength="120" placeholder="e.g., 10.5 in, 16 in, or 18–20 in" value="'+esc(pref.barrelLength||'')+'"></div>':'')+'</div>';});if(s.preferences.length<3)html+='<button type="button" class="btn" data-action="add-pref" data-section="'+key+'">+ Add another preference</button>';html+='<div class="divider"></div><label class="check-row"><input type="checkbox" data-check="notListed" data-section="'+key+'"'+(s.notListed?' checked':'')+'><span>My preferred manufacturer or model isn\'t listed here</span></label>';if(s.notListed)html+='<div class="field"><label>Unlisted preference</label><textarea data-unlisted="'+key+'" maxlength="1000" placeholder="Manufacturer, model, or details…">'+esc(s.unlisted)+'</textarea></div>';html+='<label class="check-row"><input type="checkbox" data-check="suggestion" data-section="'+key+'"'+(s.suggestion?' checked':'')+'><span>Unsure? Get a suggestion from your rep.</span></label>';return html;}
function repChoice(selected,kind){var value='Not Sure — Representative Guidance';var active=selected===value;return '<div class="cc-rep-choice"><button type="button" class="choice'+(active?' selected':'')+'" data-kind="'+esc(kind)+'" data-value="'+esc(value)+'" aria-pressed="'+active+'"><span class="choice-text"><strong>Not sure? Get a suggestion from your rep.</strong><small>We will note that you would like guidance on this selection.</small></span><span class="mark">'+(active?'✓':'')+'</span></button></div>';}
function pistolTypeHtml(){
 var html=heading('Choose a pistol type','Tell us which type of pistol you are interested in.');
 html+=choices(['Semi-Auto','Revolver','Single Shot','Other'],state.pistolType,'pistolType');
 html+=repChoice(state.pistolType,'pistolType');
 if(state.pistolType==='Semi-Auto'){
  html+='<div class="divider"></div><p class="section-label">Firing Mechanism</p>';
  html+=choices(['Striker-Fired','Hammer-Fired'],state.pistolMechanism,'pistolMechanism');
  html+=repChoice(state.pistolMechanism,'pistolMechanism');
  if(state.pistolMechanism==='Hammer-Fired'){
   html+='<div class="divider"></div><p class="section-label">Trigger Action</p>';
   html+=choices(['Single Action','Double Action','DA/SA'],state.pistolTriggerAction,'pistolTriggerAction');
   html+=repChoice(state.pistolTriggerAction,'pistolTriggerAction');
  }
 }else if(state.pistolType==='Other'){
  html+='<div class="divider"></div><p class="section-label">Other Pistol Type</p>';
  html+=choices(['Derringer / Multi-Barrel','Lever-Action','Other / Unclassified'],state.pistolOtherType,'pistolOtherType');
  html+=repChoice(state.pistolOtherType,'pistolOtherType');
 }
 return html;
}
function shotgunTypeHtml(){
 var html=heading('Choose your shotgun preferences','Tell your representative what kind of shotgun you are interested in.');
 html+='<div class="section"><p class="section-label">01 · Shotgun Category</p><h4>What style are you interested in?</h4>'+choices(['Hunting','Tactical','Defensive'],state.shotgunPurpose,'shotgunPurpose')+'</div>';
 if(state.shotgunPurpose){html+='<div class="divider"></div><div class="section"><p class="section-label">02 · Operating Action</p><h4>Which action do you prefer?</h4>'+choices(['Pump','Semi-Auto'],state.shotgunAction,'shotgunAction')+'</div>';}
 if(state.shotgunAction==='Semi-Auto'){html+='<div class="divider"></div><div class="section"><p class="section-label">03 · Feeding System</p><h4>Which feeding system do you prefer?</h4>'+choices(['Tube Fed','Mag Fed'],state.shotgunFeed,'shotgunFeed')+'</div>';}
 return html;
}
function typeHtml(){if(state.category==='Pistol')return pistolTypeHtml();if(state.category==='Shotgun')return shotgunTypeHtml();var types=data.filters.filter(function(x){return x.field==='firearm_type';}),actions=data.filters.filter(function(x){if(x.field!=='action')return false;if(state.category!=='Rifle')return true;var n=String(x.name||'').toLowerCase().replace(/[–—-]/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');return !(/\bside by side\b|\bpump(?: action)?\b|\bsingle action\b|\bda sa\b|\bdouble action single action\b|\bsingle double action\b/.test(n));});if(!state.firearmType)return heading('Choose a firearm type','Select a catalog classification.')+choices(types,'','firearmType');var html=heading('Choose an action','Select an action or continue without narrowing.');html+='<p class="help">Firearm type: '+esc(state.firearmType);if(types.length>1)html+=' · <button type="button" class="link" data-action="change-type">Change type</button>';html+='</p>'+choices(actions,state.firearmAction,'firearmAction')+'<p class="note">Action selection is optional.</p>';return html;}
function introHtml(){return '<div class="cc-welcome"><div class="cc-welcome-glow"></div><div class="cc-welcome-inner"><p class="cc-eyebrow">COPPER CUSTOM ARMAMENT <span> / </span> PRIVATE CONSULTATION</p><h1>Your vision.<br><em>Our expertise.</em></h1><p class="cc-welcome-lead">An exceptional build begins with a conversation.</p><p class="cc-welcome-copy">Tell us what matters most to you. A dedicated Copper Custom representative will personally review your preferences and explore available options with you.</p><div class="cc-welcome-rule"></div><div class="cc-benefits"><div class="cc-benefit"><span class="cc-benefit-accent"></span><strong>Personal Guidance</strong><p>A real representative throughout your consultation</p></div></div><p class="cc-assurance-aside"><strong>'+atomicAssurance.name+'</strong><span>Build warranty and in-depth testing available</span></p></div></div>';}
function goalsHtml(){var html=heading('Tell us about your ideal build','Help your representative understand your goals.');html+='<div class="section"><p class="section-label">01 · Intended Use</p><h4>What will you primarily use this for?</h4><p class="help">Select all that apply. Your build can accommodate multiple intended uses.</p>'+multiChoices(['Range & Recreation','Home Defense','Competition','Hunting & Outdoors','Professional Use','Collection & Customization','Not Sure Yet','Other'],state.purpose,'purpose')+(state.purpose.indexOf('Other')!==-1?'<div class="field interest-notes"><label for="cc-purpose-other">Describe your intended use</label><textarea id="cc-purpose-other" maxlength="2000" placeholder="Tell us how you plan to use your firearm…">'+esc(state.purposeOther)+'</textarea></div>':'')+'</div><div class="divider"></div><div class="section"><p class="section-label">02 · Budget</p><h4>What is your approximate budget?</h4><p class="help">An estimate is fine.</p>'+choices(['Under $500','$500–$1,000','$1,000–$2,000','$2,000–$3,500','$3,500+','Flexible / Need Guidance'],state.budget,'budget')+'</div><div class="divider"></div><div class="section"><p class="section-label">03 · Desired Goals</p><h4>What would you like to achieve with your build?</h4><p class="help">Tell us about your vision, priorities, or the functionality you are looking for. Please write at least 20 characters.</p><div class="field"><label for="cc-goals">Desired goals *</label><textarea id="cc-goals" maxlength="2000" placeholder="Tell us what you have in mind…">'+esc(state.goals)+'</textarea></div></div>';return html;}
function optionalHtml(key){
 var s=state[key],optics=key==='optics';
 var html=heading(optics?'Interested in optics?':'Interested in suppressors?', 'Tell us whether you would like to discuss this category.');
 html+=choices(['Yes','No','Not Sure Yet'],s.interest,'interest-'+key);
 if(s.interest==='Not Sure Yet')return html+'<div class="highlight"><strong>We can discuss this with you.</strong><p>Your representative will see that you are unsure.</p></div>';
 if(s.interest!=='Yes')return html;
 html+='<div class="divider"></div>';
 if(optics){
  html+='<p class="section-label">Optic Type</p><h4>What type of optic interests you?</h4><p class="help">Select one, or ask your representative for guidance.</p>';
  html+=choices(['Red Dot','Red Dot / Magnifier Combo','Low Power Variable Scope','Mid Power Variable Scope','High Power Variable Scope','Fixed Power Scope','Iron Sights','Thermal / Night Vision'],s.opticType,'opticType');
  html+=repChoice(s.opticType,'opticType');
  if(!s.opticType)return html;
 }else{
  html+='<p class="section-label">Suppressor Design</p><h4>What design interests you?</h4><p class="help">Select one, or ask your representative for guidance.</p>';
  html+=choices(['Flow-Through','Reduced Back Pressure','Traditional Baffle'],s.design,'suppressorDesign');
  html+=repChoice(s.design,'suppressorDesign');
  if(!s.design)return html;
  if(s.design!=='Not Sure — Representative Guidance'){
   html+='<div class="divider"></div><p class="section-label">Preferred Material</p><h4>Do you have a material preference?</h4>';
   html+=choices(['Aluminum','Steel','Titanium','Inconel'],s.material,'suppressorMaterial');
   html+=repChoice(s.material,'suppressorMaterial');
   if(!s.material)return html;
  }
 }
 html+='<div class="divider"></div><p class="section-label">Catalog Preferences</p><h4>Preferred manufacturers & models</h4><p class="help">Choose up to three preferences. Catalog results are not filtered by the selections above.</p>';
 return html+preferenceEditor(key)+(key==='suppressors'?'<div class="divider"></div><div class="field"><label>Preferred mounting solution (optional)</label><textarea id="cc-mounting-solution" maxlength="1000" placeholder="Mounting interface, manufacturer/model, thread pitch, or other preferences…">'+esc(s.mountingSolution||'')+'</textarea><p class="muted">Leave blank if unsure. Your representative can help verify compatibility.</p></div>':'');
}
function lightsHtml(){var s=state.lights,html=heading('Interested in a weapon light?','Tell us whether you would like to explore lighting options.');html+=choices(['Yes','No','Not Sure Yet'],s.interest,'interest-lights');if(s.interest==='Not Sure Yet')return html+'<div class="highlight"><strong>Let your representative guide you.</strong><p>We will note that you would like a recommendation.</p></div>';if(s.interest!=='Yes')return html;return html+'<div class="divider"></div><p class="section-label">LIGHT PREFERENCES</p><h4>Preferred manufacturer & model</h4><p class="help">Choose from available catalog listings, request a suggestion, or tell us about an unlisted light. Your representative will confirm options and compatibility.</p>'+preferenceEditor('lights');}
function extrasHtml(){var html=heading('Additional interests','Let us know which other areas you would like to discuss.');extraTopics.forEach(function(t,i){var a=state.extras[t.id];html+='<div class="interest-card"><p class="section-label">0'+(i+1)+' · Additional Interest</p><h4>'+esc(t.name)+'</h4>'+choices(['Yes','No'],a.answer,'extra-'+t.id);if(a.answer==='Yes')html+='<div class="field interest-notes"><label>Tell us what you have in mind (optional)</label><textarea data-extra-notes="'+t.id+'" maxlength="1000" placeholder="Describe your preferences, desired configuration, or questions…">'+esc(a.notes)+'</textarea></div>';html+='</div>';});html+='<div class="divider"></div><div class="field"><label>General additional notes (optional)</label><textarea id="cc-notes" maxlength="2000" placeholder="Anything else your representative should know?">'+esc(state.notes)+'</textarea></div>';return html;}
function sectionRows(key,title){var s=state[key],rows=[];if(key!=='primary'){rows.push([title+' Interest',s.interest||'Not specified']);if(s.interest!=='Yes')return rows;}s.preferences.forEach(function(p,i){if(p.manufacturer||p.model)rows.push([title+' Preference '+(i+1),[p.manufacturer,p.model].filter(Boolean).join(' — ')]);if(key==='primary'&&p.variant)rows.push(['Primary Product Variant '+(i+1),variantDetails(p.variant)]),rows.push(['Primary Product Catalog ID '+(i+1),p.variant.source+' / '+p.variant.source_id]);if(key==='primary'&&(state.category==='Rifle'||state.category==='Shotgun')&&(p.barrelLength||'').trim())rows.push(['Preferred Barrel Length '+(i+1),(p.barrelLength||'').trim()]);});if(key==='suppressors'&&s.interest==='Yes'&&(s.mountingSolution||'').trim())rows.push(['Preferred Suppressor Mounting Solution',s.mountingSolution.trim()]);if(s.notListed)rows.push([title+' Unlisted Preference',s.unlisted||'Not specified']);if(s.suggestion)rows.push([title+' Representative Guidance','Requested']);return rows;}
function atomicAssuranceStatus(){
 if(contact.atomicAssuranceRequested===null)return '';
 return contact.atomicAssuranceRequested?'Requested — '+atomicAssurancePrice:'Declined';
}
function atomicAssuranceHtml(){
 const coverage = ['One-year build warranty','Documented assembly torque specifications','Witness marking record and photos','Test-fire footage','A copy of the test target','Decibel reading for suppressed builds'];
 return `<fieldset class="cc-contact-next cc-documentation-package">
 <legend>${atomicAssurance.name} — ${atomicAssurancePrice}</legend>
 <p><strong>Precision. Protection. Proof.</strong></p>
 <h3>What the package covers</h3>
 <ul class="cc-assurance-coverage">${coverage.map(item=>'<li>'+item+'</li>').join('')}</ul>
 <p>You’ll receive your completed report at pickup.</p>
 <details class="cc-assurance-preview"><summary>Preview a sample report</summary>
 <article class="cc-assurance-report" aria-labelledby="sample-report-title">
 <header><p class="report-brand">COPPER CUSTOM ARMAMENT</p><h3 id="sample-report-title">Atomic Assurance Build Report</h3><p class="report-sample">Sample report · Fictional customer and results</p></header>
 <dl class="report-meta">
 <div><dt>Report ID</dt><dd>AA-2026-0142</dd></div>
 <div><dt>Prepared for</dt><dd>Jordan Bennett</dd></div>
 <div><dt>Build reference</dt><dd>CC-261142 · Suppressed build</dd></div>
 <div><dt>Pickup date</dt><dd>November 20, 2026</dd></div>
 </dl>
 <section><h4>Warranty</h4><p><strong>Coverage period</strong> · November 20, 2026 to November 20, 2027</p><p>One-year build warranty entered at pickup. Refer to the signed warranty agreement for coverage terms.</p></section>
 <section><h4>Assembly and inspection record</h4>
 <table><thead><tr><th scope="col">Record</th><th scope="col">Result</th><th scope="col">Reference</th></tr></thead><tbody>
 <tr><td>Torque documentation</td><td>Recorded and verified</td><td>AA-0142-A<br><a href="https://example.invalid/atomic-assurance/AA-2026-0142/torque-documentation" data-demo-report-link>View torque documentation</a> <span class="report-sample">(sample link)</span></td></tr>
 <tr><td>Witness marking</td><td>Verified and photographed</td><td>AA-0142-W<br><a href="https://example.invalid/atomic-assurance/AA-2026-0142/witness-marking-photos" data-demo-report-link>View witness marking photos</a> <span class="report-sample">(sample link)</span></td></tr>
 </tbody></table>
 <p>Reviewed November 19, 2026 by Casey Morgan, build technician.</p></section>
 <section><h4>Test-fire and target record</h4><p><strong>Test date</strong> · November 19, 2026</p><p><strong>Result</strong> · Function check completed and signed off.</p>
 <p><strong>Target</strong> · T-0142 · Printed target included with the pickup packet.</p>
 <p><a href="https://example.invalid/atomic-assurance/AA-2026-0142/test-fire" data-demo-report-link>View test-fire footage</a> <span class="report-sample">(sample link)</span></p></section>
 <section><h4>Suppressed sound reading</h4><p><strong>Peak sound level</strong> · 136.8 dB (illustrative)</p><p><strong>Measurement record</strong> · SPL-0142 · Logged with the test record on November 19, 2026.</p></section>
 <footer><strong>Reviewed by Avery Ellis</strong><br>Quality review completed November 20, 2026</footer>
 </article></details>`+
 '<label class="check-row"><input type="radio" name="cc-atomic-assurance" value="requested" required'+(contact.atomicAssuranceRequested===true?' checked':'')+'><span>Add '+atomicAssurance.name+' — '+atomicAssurancePrice+'</span></label>'+
 '<label class="check-row"><input type="radio" name="cc-atomic-assurance" value="declined" required'+(contact.atomicAssuranceRequested===false?' checked':'')+'><span>Continue Without '+atomicAssurance.name+'</span></label>'+
 '<p>Selecting '+atomicAssurance.name+' adds it to your consultation request. Your Copper Custom representative will arrange payment directly and confirm warranty terms.</p></fieldset>';
}

function summaryRows(){var rows=[['Category',state.category],['Firearm Type',state.firearmType],['Action',state.firearmAction],['Pistol Type',state.pistolType],['Pistol Firing Mechanism',state.pistolMechanism],['Pistol Trigger Action',state.pistolTriggerAction],['Other Pistol Type',state.pistolOtherType],['Shotgun Category',state.shotgunPurpose],['Shotgun Action',state.shotgunAction],['Shotgun Feeding System',state.shotgunAction==='Semi-Auto'?state.shotgunFeed:''],['Primary Intended Uses',state.purpose.join(', ')],['Other Intended Use',state.purpose.indexOf('Other')!==-1?state.purposeOther:''],['Approximate Budget',state.budget],['Desired Goals',state.goals]];rows=rows.concat([['Optic Type',state.optics.interest==='Yes'?state.optics.opticType:''],['Suppressor Design',state.suppressors.interest==='Yes'?state.suppressors.design:''],['Suppressor Material',state.suppressors.interest==='Yes'?state.suppressors.material:'']]);rows=rows.concat(sectionRows('primary','Primary Product'),sectionRows('optics','Optics'),sectionRows('lights','Weapon Lights'),sectionRows('suppressors','Suppressors'));extraTopics.forEach(function(t){var a=state.extras[t.id];rows.push([t.name,a.answer||'Not answered']);if(a.answer==='Yes'&&a.notes.trim())rows.push([t.name+' · Notes',a.notes]);});rows.push(['General Additional Notes',state.notes]);rows.push(['Representative Preference',contact.representativeChoice==='preferred'?'Preferred representative':contact.representativeChoice==='first'?'First available representative':'']);if(contact.representativeChoice==='preferred')rows.push(['Requested Representative',contact.preferredRepresentative.trim()]);rows.unshift([atomicAssurance.name,atomicAssuranceStatus()]);return rows.filter(function(r){return !!r[1];});}
function summaryText(){return 'COPPER CUSTOM — CONSULTATION SUMMARY\n\n'+summaryRows().map(function(r){return r[0]+': '+r[1];}).join('\n\n');}
function reviewHtml(){
 if(submittedId){var byPhone=contact.method==='Phone';var followUp=byPhone?'A Copper Custom representative will contact you by phone at <strong>'+esc(contact.phone)+'</strong> to discuss your build and next steps.':'A Copper Custom representative will email you at <strong>'+esc(contact.email)+'</strong> to discuss your build and next steps.';return '<div class="cc-complete"><div class="cc-complete-symbol">✓</div><p class="cc-eyebrow">CONSULTATION REQUEST RECEIVED</p><h2>The next step is personal.</h2><p class="cc-complete-lead">Thank you for sharing your vision with Copper Custom Armament.</p><div class="cc-contact-next"><span class="cc-eyebrow">WHAT HAPPENS NEXT</span><p>'+followUp+'</p><p>Your preferences will be reviewed personally, and your representative will help guide the configuration and available options.</p></div><div class="cc-complete-divider"></div><p><strong>'+atomicAssurance.name+': '+atomicAssuranceStatus()+'</strong></p>'+(contact.atomicAssuranceRequested?'<p>Your Copper Custom representative will arrange payment directly.</p>':'')+'<div class="cc-reference"><span>YOUR CONSULTATION REFERENCE</span><strong>'+esc(submittedId)+'</strong></div><p class="cc-complete-fine">Keep this reference for your records. Your consultation request is not a finalized order.</p></div>'};
 var html=heading('Review your consultation','Review your selections, then enter your contact information to submit.');
 html+='<div class="summary">'+summaryRows().filter(function(r){return r[0]!==atomicAssurance.name;}).map(function(r){return '<div class="summary-item"><small>'+esc(r[0])+'</small><strong>'+esc(r[1])+'</strong></div>';}).join('')+'</div>';
 html+='<div class="divider"></div><div class="section"><p class="section-label">Contact Details</p><h3>How can we reach you?</h3><p class="help">Both email and phone number are required.</p>';
 html+='<div class="field"><label for="cc-customer-name">Full name *</label><input id="cc-customer-name" type="text" maxlength="120" autocomplete="name" value="'+esc(contact.name)+'"></div>';
 html+='<div class="field"><label for="cc-customer-email">Email address *</label><input id="cc-customer-email" type="email" maxlength="254" autocomplete="email" value="'+esc(contact.email)+'"></div>';
 html+='<div class="field"><label for="cc-customer-phone">Phone number *</label><input id="cc-customer-phone" type="tel" maxlength="40" autocomplete="tel" value="'+esc(contact.phone)+'"></div>';
 html+='<div class="field"><label for="cc-contact-method">Preferred contact method (optional)</label><select id="cc-contact-method" class="cc-contact-select"><option value="Email"'+(contact.method==='Email'?' selected':'')+'>Email</option><option value="Phone"'+(contact.method==='Phone'?' selected':'')+'>Phone</option></select></div>';
 html+='<div class="divider"></div><div class="section"><p class="section-label">Representative Preference</p><h3>Who would you like to work with?</h3><p class="help">Choose one option.</p>';
 html+='<label class="check-row"><input type="checkbox" data-representative-choice="preferred"'+(contact.representativeChoice==='preferred'?' checked':'')+'><span>Choose your preferred representative</span></label>';
 if(contact.representativeChoice==='preferred')html+='<div class="field"><label for="cc-preferred-representative">Preferred representative name *</label><input id="cc-preferred-representative" type="text" maxlength="120" autocomplete="off" placeholder="Enter the representative’s name" value="'+esc(contact.preferredRepresentative)+'"><p class="muted">We will share your preference with the team. Availability is not guaranteed.</p></div>';
 html+='<label class="check-row"><input type="checkbox" data-representative-choice="first"'+(contact.representativeChoice==='first'?' checked':'')+'><span>First available representative</span></label></div>';
 html+=atomicAssuranceHtml();
 html+='<div class="cc-trap" aria-hidden="true"><label>Leave this field blank<input id="cc-company-site" type="text" tabindex="-1" autocomplete="off"></label></div>';
 html+='<div class="field"><label>Verification *</label><div id="cc-turnstile"></div></div>';
 html+='<div class="highlight"><h3>Personally guided, from concept to configuration</h3><p>Every configuration is reviewed with a Copper Custom representative.</p></div><p class="help">By submitting, you request a follow-up about your consultation. This is not an order or a guarantee of product availability.</p></div>';
 return html;
}
function clearTurnstile(){
 turnstileToken='';
 if(window.turnstile&&turnstileWidget!==null){try{window.turnstile.remove(turnstileWidget);}catch(_){}}
 turnstileWidget=null;
}
function mountTurnstile(){
 var holder=content.querySelector('#cc-turnstile');
 if(step!==steps.length-1||submittedId||!holder||turnstileWidget!==null)return;
 function isCurrent(){return holder.isConnected&&step===steps.length-1&&!submittedId&&content.querySelector('#cc-turnstile')===holder;}
 function fail(){holder.textContent='Verification could not load. Refresh this page and try again.';}
 if(TURNSTILE_SITE_KEY.indexOf('PASTE_')===0){fail();return;}
 var deadline=Date.now()+10000;
 function mount(){
  if(!isCurrent()||turnstileWidget!==null)return;
  if(!window.turnstile||typeof window.turnstile.render!=='function'){
   if(Date.now()>=deadline){fail();return;}
   holder.textContent='Loading verification…';
   setTimeout(mount,250);
   return;
  }
  holder.textContent='';
  try{
   turnstileWidget=window.turnstile.render(holder,{
    sitekey:TURNSTILE_SITE_KEY,theme:'dark',
    callback:function(token){if(isCurrent())turnstileToken=token;},
    'expired-callback':function(){if(isCurrent())turnstileToken='';},
    'error-callback':function(){if(isCurrent())turnstileToken='';}
   });
  }catch(e){fail();}
 }
 mount();
}
function validContact(){
 if(contact.name.trim().length<2||contact.name.trim().length>120)return 'Please enter your full name.';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())||contact.email.length>254)return 'Please enter a valid email address.';
 var digits=contact.phone.replace(/\D/g,'');if(digits.length<10||digits.length>15)return 'Please enter a valid phone number.';
 if(!['preferred','first'].includes(contact.representativeChoice))return 'Please choose a representative preference.';
 if(contact.representativeChoice==='preferred'&&(!contact.preferredRepresentative.trim()||contact.preferredRepresentative.trim().length>120))return 'Please enter your preferred representative’s name.';
 if(contact.atomicAssuranceRequested===null)return 'Please choose whether to add Atomic Assurance.';
 if(!turnstileToken)return 'Please complete the verification challenge.';
 return '';
}
async function submitConsultation(){
 if(submitting||submittedId)return;
 error=validContact();if(error){var status=content.querySelector('#cc-submit-error');if(status)status.textContent=error;return;}
 if(content.querySelector('#cc-company-site')&&content.querySelector('#cc-company-site').value)return;
 submitting=true;next.disabled=true;back.disabled=true;next.textContent='Submitting…';
 try{
  var payload={customer_name:contact.name.trim(),customer_email:contact.email.trim(),customer_phone:contact.phone.trim(),preferred_contact_method:contact.method,weapon_class:state.category,answers:{schema_version:1,selections:state,documentation_package_requested:contact.atomicAssuranceRequested,representative_preference:{choice:contact.representativeChoice,requested_name:contact.representativeChoice==='preferred'?contact.preferredRepresentative.trim():null},summary:summaryRows().map(function(r){return {label:r[0],value:r[1]};})},turnstile_token:turnstileToken};
  var response=await fetch(SUBMIT_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  var json=await response.json().catch(function(){return {};});
  if(!response.ok||!json.success||!json.reference)throw new Error(json.error||'Submission could not be completed. Please try again.');
  submittedId=json.reference;error='';render();
 }catch(e){error=e.message||'Unable to submit. Please try again.';var status=content.querySelector('#cc-submit-error');if(status)status.textContent=error;if(window.turnstile&&turnstileWidget!==null){try{window.turnstile.reset(turnstileWidget);}catch(_){}}turnstileToken='';}
 finally{submitting=false;next.disabled=!!submittedId;back.disabled=!!submittedId;next.textContent=submittedId?'Submitted':'Submit Consultation →';}
}

function render(){clearTurnstile();root.classList.toggle('cc-intro-mode',step===-1);root.classList.toggle('cc-success-mode',!!submittedId);progress.style.display=step===-1||!!submittedId?'none':'';progress.innerHTML=steps.map(function(_,i){return '<span class="'+(i<=step?'active':'')+'"></span>';}).join('');var html=step===-1?introHtml():submittedId?'':'<div class="meta"><span>Guided Consultation</span><span>Step '+(step+1)+' of '+steps.length+'</span></div>';if(step===0)html+=heading('Where would you like to begin?','Select a category to explore.')+choices(['Rifle','Pistol','Shotgun'],state.category,'category');if(step===1)html+=loading?'<div class="loading">Loading catalog categories…</div>':typeHtml();if(step===2)html+=goalsHtml();if(step===3)html+=loading?'<div class="loading">Loading manufacturers…</div>':heading('Preferred manufacturers & models','Select up to three catalog preferences, or request representative guidance.')+preferenceEditor('primary');if(step===4)html+=loading?'<div class="loading">Loading optics catalog…</div>':optionalHtml('optics');if(step===5)html+=loading?'<div class="loading">Loading weapon light catalog…</div>':lightsHtml();if(step===6)html+=loading?'<div class="loading">Loading suppressor catalog…</div>':optionalHtml('suppressors');if(step===7)html+=extrasHtml();if(step===8)html+=reviewHtml();if(error)html+='<p class="error">'+esc(error)+'</p><button type="button" class="btn" data-action="retry">Retry</button>';content.innerHTML=html;if(step===8&&!submittedId){var status=document.createElement('p');status.id='cc-submit-error';status.className='error';status.setAttribute('role','alert');content.appendChild(status);mountTurnstile();}back.style.display=step===-1||!!submittedId?'none':'';back.disabled=step<=0||loading||!!submittedId;next.disabled=loading||!!submittedId;next.style.display=submittedId?'none':'';next.textContent=step===-1?'Begin Your Consultation →':step===8?'Submit Consultation →':'Continue →';}
function loadForStep(){if(step===1){loadTypes();return;}if(step===3){loadManufacturers('primary');state.primary.preferences.forEach(function(p,i){if(showVariants&&p.manufacturer&&p.model&&!variantLoads[i])loadVariants(i,false);});return;}if(step===4&&state.optics.interest==='Yes'){loadManufacturers('optics');return;}if(step===5&&state.lights.interest==='Yes'){loadManufacturers('lights');return;}if(step===6&&state.suppressors.interest==='Yes'){loadManufacturers('suppressors');return;}render();}
function validateSection(key){var s=state[key];if(key!=='primary'&&s.interest!=='Yes')return true;var has=s.preferences.some(function(p){return !!p.manufacturer;});if(!has&&!s.suggestion&&!s.notListed){error='Choose a manufacturer, request representative guidance, or select the unlisted option.';return false;}if(s.notListed&&!s.unlisted.trim()){error='Please describe your unlisted preference.';return false;}return true;}
function advance(){if(loading)return;if(step===-1){step=0;render();return;}error='';if(step===0&&!state.category)error='Please select a category.';if(step===1){if(state.category==='Pistol'){if(!state.pistolType)error='Please select a pistol type.';else if(state.pistolType==='Semi-Auto'&&!state.pistolMechanism)error='Please select a firing mechanism.';else if(state.pistolMechanism==='Hammer-Fired'&&!state.pistolTriggerAction)error='Please select a trigger action.';else if(state.pistolType==='Other'&&!state.pistolOtherType)error='Please select an additional pistol type.';}else if(state.category==='Shotgun'){if(!state.shotgunPurpose)error='Please select a shotgun category.';else if(!state.shotgunAction)error='Please select Pump or Semi-Auto.';else if(state.shotgunAction==='Semi-Auto'&&!state.shotgunFeed)error='Please select Tube Fed or Mag Fed.';}else if(!state.firearmType)error='Please select a firearm type.';}if(step===2){if(!state.purpose.length)error='Please select at least one intended use.';else if(state.purpose.indexOf('Other')!==-1&&!state.purposeOther.trim())error='Please describe your intended use.';else if(!state.budget)error='Please select an approximate budget.';else if(state.goals.trim().length<20)error='Please tell us a little more about what you are looking to achieve with your build (at least 20 characters).';}if(step===3&&!validateSection('primary')){render();return;}if(step===4){if(!state.optics.interest)error='Please select Yes, No, or Not Sure Yet.';else if(state.optics.interest==='Yes'&&!state.optics.opticType)error='Please choose an optic type or request representative guidance.';else if(state.optics.interest==='Yes'&&!validateSection('optics')){render();return;}}if(step===5){if(!state.lights.interest)error='Please select Yes, No, or Not Sure Yet for weapon lights.';else if(state.lights.interest==='Yes'&&!validateSection('lights')){render();return;}}if(step===6){if(!state.suppressors.interest)error='Please select Yes, No, or Not Sure Yet.';else if(state.suppressors.interest==='Yes'&&!state.suppressors.design)error='Please choose a suppressor design or request representative guidance.';else if(state.suppressors.interest==='Yes'&&state.suppressors.design!=='Not Sure — Representative Guidance'&&!state.suppressors.material)error='Please choose a material or request representative guidance.';else if(state.suppressors.interest==='Yes'&&!validateSection('suppressors')){render();return;}}if(step===7&&extraTopics.some(function(t){return !state.extras[t.id].answer;}))error='Please answer Yes or No for each additional interest.';if(error){render();if(step===2&&state.goals.trim().length<20){var gf=content.querySelector('#cc-goals');if(gf)gf.focus();}return;}if(step===8){submitConsultation();return;}invalidateSearches();step++;loadForStep();}
function copySummary(){var txt=summaryText(),status=content.querySelector('#cc-copy-status');function show(s){if(status)status.textContent=s;}function fallback(){var ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand('copy');}catch(e){}document.body.removeChild(ta);show(ok?'Summary copied to clipboard.':'Unable to copy automatically.');}if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(function(){show('Summary copied to clipboard.');}).catch(fallback);else fallback();}
function select(kind,value){error='';if(kind==='category'){if(state.category!==value){state.category=value;resetCatalog();}}else if(kind==='firearmType'){if(state.firearmType!==value){state.firearmType=value;state.firearmAction='';state.primary=newSection();data.loaded.primary=false;invalidateSearches();loadActions();return;}}else if(kind==='firearmAction'){state.firearmAction=state.firearmAction===value?'':value;state.primary=newSection();data.loaded.primary=false;invalidateSearches();}else if(kind==='shotgunPurpose'){state.shotgunPurpose=value;state.shotgunAction='';state.shotgunFeed='';}else if(kind==='shotgunAction'){state.shotgunAction=value;state.shotgunFeed='';}else if(kind==='shotgunFeed'){state.shotgunFeed=value;}else if(kind==='pistolType'){state.pistolType=value;state.pistolMechanism='';state.pistolTriggerAction='';state.pistolOtherType='';resetPrimaryCatalog();}else if(kind==='pistolMechanism'){state.pistolMechanism=value;state.pistolTriggerAction='';resetPrimaryCatalog();}else if(kind==='pistolTriggerAction'){state.pistolTriggerAction=value;resetPrimaryCatalog();}else if(kind==='pistolOtherType'){state.pistolOtherType=value;resetPrimaryCatalog();}else if(kind==='opticType'){state.optics.opticType=value;}else if(kind==='suppressorDesign'){state.suppressors.design=value;state.suppressors.material='';}else if(kind==='suppressorMaterial'){state.suppressors.material=value;}else if(kind==='purpose'){if(value==='Not Sure Yet'){state.purpose=['Not Sure Yet'];}else{state.purpose=state.purpose.filter(function(v){return v!=='Not Sure Yet';});var pi=state.purpose.indexOf(value);if(pi===-1)state.purpose.push(value);else state.purpose.splice(pi,1);}}else if(kind==='budget')state.budget=value;else if(kind.indexOf('interest-')===0){var key=kind.substring(9);state[key].interest=value;if(value==='Yes'&&!data.loaded[key]){loadManufacturers(key);return;}}else if(kind.indexOf('extra-')===0){var extraId=kind.substring(6);if(state.extras[extraId])state.extras[extraId].answer=value;}render();}
function closeDropdowns(){root.querySelectorAll('.dropdown').forEach(function(m){m.hidden=true;});}
function restoreInput(input){var key=input.dataset.section,index=Number(input.dataset.index),pref=state[key]&&state[key].preferences[index];if(!pref)return;if(input.dataset.manufacturerInput)input.value=pref.manufacturer;else if(input.dataset.modelInput)input.value=pref.model;}
function filterManufacturers(input){var menu=input.closest('.select-wrap').querySelector('.dropdown');closeDropdowns();var term=input.value.toLowerCase();menu.querySelectorAll('button[data-manufacturer-pick]').forEach(function(b){b.hidden=b.dataset.value.toLowerCase().indexOf(term)===-1;});menu.hidden=false;}
content.addEventListener('click',function(e){if(e.target.closest('[data-demo-report-link]')){e.preventDefault();return;}var b=e.target.closest('button');if(!b)return;if(b.dataset.manufacturerPick){var key=b.dataset.section,index=Number(b.dataset.index),pref=state[key].preferences[index];if(pref.manufacturer!==b.dataset.value){pref.manufacturer=b.dataset.value;pref.model='';pref.source='';pref.sourceId='';pref.variant=null;if(key==='primary')delete variantLoads[index];invalidateSearches();}render();return;}if(b.dataset.modelPick){var section=b.dataset.section,idx=Number(b.dataset.index),item=getSearch(section,idx).rows[Number(b.dataset.row)];if(!item)return;var pref=state[section].preferences[idx];pref.model=item.name;pref.source=item.source;pref.sourceId=item.sourceId;pref.variant=null;if(section==='primary'){delete variantLoads[idx];if(showVariants)loadVariants(idx,false);else render();}else render();return;}if(b.dataset.variantPick){var vi=Number(b.dataset.index),vp=state.primary.preferences[vi],vl=variantLoads[vi];if(!vp||!vl||vl.loading)return;var row=Number(b.dataset.row);vp.variant=row<0?null:vl.rows[row]||null;if(vp.variant){vp.source=vp.variant.source;vp.sourceId=vp.variant.source_id;}render();return;}if(b.dataset.variantRetry){loadVariants(Number(b.dataset.index),false);return;}if(b.dataset.variantMore){loadVariants(Number(b.dataset.index),true);return;}if(b.dataset.loadMore){var k=b.dataset.section,i=Number(b.dataset.index),s=getSearch(k,i);runModelSearch(k,i,s.term,true);return;}if(b.dataset.kind){select(b.dataset.kind,b.dataset.value);return;}var action=b.dataset.action,key=b.dataset.section;if(action==='change-type'){state.firearmType='';state.firearmAction='';state.primary=newSection();data.loaded.primary=false;invalidateSearches();loadTypes();return;}if(action==='add-pref'){if(state[key].preferences.length<3){state[key].preferences.push(newPreference());if(key==='primary')variantLoads={};invalidateSearches();render();}return;}if(action==='remove-pref'){state[key].preferences.splice(Number(b.dataset.index),1);if(key==='primary')variantLoads={};invalidateSearches();render();return;}if(action==='retry'){if(step===3)data.loaded.primary=false;if(step===4)data.loaded.optics=false;if(step===5)data.loaded.suppressors=false;loadForStep();}});
content.addEventListener('input',function(e){var t=e.target;if(t.dataset.manufacturerInput){filterManufacturers(t);return;}if(t.dataset.modelInput){var key=t.dataset.section,index=Number(t.dataset.index),pref=state[key].preferences[index];if(pref&&pref.manufacturer)scheduleModelSearch(key,index,t.value.trim());return;}if(t.id==='cc-preferred-representative')contact.preferredRepresentative=t.value;if(t.id==='cc-customer-name')contact.name=t.value;if(t.id==='cc-customer-email')contact.email=t.value;if(t.id==='cc-customer-phone')contact.phone=t.value;if(t.id==='cc-goals')state.goals=t.value;if(t.id==='cc-purpose-other')state.purposeOther=t.value;if(t.id==='cc-notes')state.notes=t.value;if(t.dataset.barrelLength){var bp=state.primary.preferences[Number(t.dataset.index)];if(bp)bp.barrelLength=t.value;}if(t.id==='cc-mounting-solution')state.suppressors.mountingSolution=t.value;if(t.dataset.unlisted)state[t.dataset.unlisted].unlisted=t.value;if(t.dataset.extraNotes)state.extras[t.dataset.extraNotes].notes=t.value;});
content.addEventListener('change',function(e){var t=e.target;if(t.name==='cc-atomic-assurance'){contact.atomicAssuranceRequested=t.value==='requested';return;}if(t.id==='cc-contact-method'){contact.method=t.value;return;}if(t.dataset.representativeChoice){contact.representativeChoice=t.checked?t.dataset.representativeChoice:'';if(contact.representativeChoice!=='preferred')contact.preferredRepresentative='';render();return;}var key=t.dataset.section,check=t.dataset.check;if(!key||!check)return;if(check==='suggestion')state[key].suggestion=t.checked;if(check==='notListed'){state[key].notListed=t.checked;render();}});
content.addEventListener('focusin',function(e){var t=e.target;if(t.dataset.manufacturerInput)filterManufacturers(t);if(t.dataset.modelInput){var key=t.dataset.section,index=Number(t.dataset.index),pref=state[key].preferences[index];if(!pref||!pref.manufacturer)return;var s=getSearch(key,index);if(!s.loaded&&!s.loading)scheduleModelSearch(key,index,'');else updateModelDropdown(key,index);}});
content.addEventListener('focusout',function(e){var t=e.target;if(!t.dataset.manufacturerInput&&!t.dataset.modelInput)return;setTimeout(function(){if(!root.contains(t))return;restoreInput(t);closeDropdowns();},180);});
content.addEventListener('keydown',function(e){if(e.key==='Escape'&&(e.target.dataset.manufacturerInput||e.target.dataset.modelInput)){restoreInput(e.target);closeDropdowns();e.target.blur();}});
document.addEventListener('click',function(e){if(root.contains(e.target)&&!e.target.closest('.select-wrap'))closeDropdowns();});
back.addEventListener('click',function(){if(step<=0||loading||submittedId)return;requestId++;invalidateSearches();error='';step--;loadForStep();});next.addEventListener('click',advance);render();loadDisplaySetting();
})();

/* Employee dashboard: executes only on #cc-employee-app pages. */
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
  const payload=category==='Firearm'?{action:'unified-firearm-manufacturers',weaponClass}:category==='Light'?{action:'light-manufacturers'}:{action:'manufacturers',itemType:category==='Optic'?'Optic':'NFA'};
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
if(!$('cc-cat-category').querySelector('option[value="Light"]')){$('cc-cat-category').add(new Option('Lights','Light'));}
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


 // Unified removal workflow for employee-added and supplier-backed catalog models.
 (function(){
  const oldPanel=$('cc-cat-manage-results').parentElement;
  oldPanel.style.display='none'; // Keep existing event targets intact; replace the two UIs with one.
  const panel=document.createElement('div');
  panel.className='card';panel.style.marginTop='20px';
  panel.innerHTML='<h3>Remove listing</h3><p class="muted">Search employee-added and supplier-backed listings together. Removal hides the selected listing without deleting supplier data. You can restore removed listings.</p><div class="row"><select id="cc-remove-category" aria-label="Catalog category"><option value="Firearm">Firearms</option><option value="Light">Lights</option><option value="Optic">Optics (custom)</option><option value="Suppressor">Suppressors (custom)</option></select><input class="grow" id="cc-remove-search" type="search" placeholder="Search manufacturer or model"><select id="cc-remove-filter" aria-label="Visibility"><option value="active">Active</option><option value="removed">Removed</option><option value="all">All</option></select><button type="button" class="secondary" id="cc-remove-refresh">Search</button></div><p id="cc-remove-status" class="muted" role="status">Search for a model or manufacturer to manage listings.</p><div id="cc-remove-results"></div>';
  oldPanel.insertAdjacentElement('afterend',panel);
  const el=id=>panel.querySelector('#'+id);
  let results=[],exclusions=[],sequence=0,timer=null;
  const key=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const isRemoved=x=>x.origin==='custom'?!!x.removed_at:!!exclusions.find(e=>e.category===x.category&&key(e.manufacturer)===key(x.manufacturer)&&key(e.model)===key(x.model)&&(!e.weapon_class||e.weapon_class===x.weapon_class)&&!e.restored_at);
  function exclusionFor(x){return exclusions.find(e=>e.category===x.category&&key(e.manufacturer)===key(x.manufacturer)&&key(e.model)===key(x.model)&&(!e.weapon_class||e.weapon_class===x.weapon_class)&&!e.restored_at);}
  function renderRemoval(){
   const mode=el('cc-remove-filter').value;
   const visible=results.map((x,i)=>({x,i})).filter(({x})=>mode==='all'||(mode==='removed'?isRemoved(x):!isRemoved(x)));
   el('cc-remove-status').textContent=visible.length+' matching '+mode+' listings'+(results.length>=50?' (showing first results; refine your search)':'');
   el('cc-remove-results').innerHTML=visible.length?visible.map(({x,i})=>{
    const removed=isRemoved(x);
    return '<div class="card row" style="margin:8px 0"><div class="grow"><strong>'+escape(x.manufacturer)+' — '+escape(x.model)+'</strong><div class="muted">'+escape(x.category)+(x.weapon_class?' · '+escape(x.weapon_class):'')+' · '+(x.origin==='custom'?'Employee added':'Supplier catalog')+' · '+(removed?'Removed':'Active')+'</div></div><button type="button" data-remove-index="'+i+'" class="'+(removed?'secondary':'')+'">'+(removed?'Restore':'Remove')+'</button></div>';
   }).join(''):'<p class="muted">No matching listings. Try another search or filter.</p>';
  }
  async function searchRemoval(){
   const seq=++sequence,category=el('cc-remove-category').value,term=el('cc-remove-search').value.trim();
   if(term.length<2){results=[];el('cc-remove-results').innerHTML='';el('cc-remove-status').textContent='Enter at least two characters to search.';return;}
   el('cc-remove-status').textContent='Searching catalog…';
   try{
    const requests=[
     authorizedRequest(table('cc_catalog_additions','select=id,category,weapon_class,manufacturer,model,removed_at&category=eq.'+encodeURIComponent(category)+'&limit=1000')),
    ];
    if(category==='Firearm'||category==='Light'){
     requests.push(authorizedRequest('/rest/v1/rpc/cc_employee_catalog_search',{method:'POST',body:{p_category:category,p_search:term,p_limit:50}}));
     requests.push(authorizedRequest(table('cc_catalog_exclusions','select=id,category,manufacturer,model,weapon_class,restored_at&category=eq.'+encodeURIComponent(category)+'&restored_at=is.null&limit=1000')));
    }
    const data=await Promise.all(requests);
    if(seq!==sequence)return;
    const custom=(Array.isArray(data[0])?data[0]:[]).filter(x=>[x.manufacturer,x.model].some(v=>String(v||'').toLowerCase().includes(term.toLowerCase()))).map(x=>({...x,origin:'custom'}));
    const supplier=(Array.isArray(data[1])?data[1]:[]).map(x=>({...x,origin:'supplier'}));
    exclusions=Array.isArray(data[2])?data[2]:[];
    results=[...custom,...supplier].sort((a,b)=>a.manufacturer.localeCompare(b.manufacturer)||a.model.localeCompare(b.model)||a.origin.localeCompare(b.origin));
    renderRemoval();
   }catch(err){if(seq===sequence)el('cc-remove-status').textContent='Unable to search: '+err.message;}
  }
  el('cc-remove-search').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(searchRemoval,350);});
  el('cc-remove-refresh').addEventListener('click',searchRemoval);
  el('cc-remove-category').addEventListener('change',searchRemoval);
  el('cc-remove-filter').addEventListener('change',renderRemoval);
  el('cc-remove-results').addEventListener('click',async e=>{
   const btn=e.target.closest('[data-remove-index]');if(!btn)return;
   const x=results[Number(btn.dataset.removeIndex)];if(!x)return;
   const restoring=isRemoved(x);
   if(!window.confirm((restoring?'Restore':'Remove')+' '+x.manufacturer+' — '+x.model+' ('+(x.origin==='custom'?'employee-added':'supplier')+')?'))return;
   btn.disabled=true;
   try{
    if(x.origin==='custom'){
     const changed=await authorizedRequest(table('cc_catalog_additions','id=eq.'+encodeURIComponent(x.id)+'&select=id'),{method:'PATCH',body:{removed_at:restoring?null:new Date().toISOString(),removed_by:restoring?null:currentUser.id},headers:{Prefer:'return=representation'}});
     if(!Array.isArray(changed)||changed.length!==1)throw Error('No custom entry was updated.');
     await loadCatalogEntries();catalogMakerCache.clear();
    }else if(restoring){
     const ex=exclusionFor(x);
     const changed=await authorizedRequest(table('cc_catalog_exclusions','id=eq.'+ex.id+'&select=id'),{method:'PATCH',body:{restored_at:new Date().toISOString(),restored_by:currentUser.id},headers:{Prefer:'return=representation'}});
     if(!Array.isArray(changed)||changed.length!==1)throw Error('No exclusion was restored.');
    }else{
     await authorizedRequest(table('cc_catalog_exclusions'),{method:'POST',body:{category:x.category,manufacturer:x.manufacturer,model:x.model,weapon_class:x.weapon_class||null,created_by:currentUser.id},headers:{Prefer:'return=minimal'}});
    }
    await searchRemoval();catalogStatus(restoring?'Listing restored.':'Listing removed from customer catalog.');
   }catch(err){catalogStatus('Unable to update listing: '+err.message,true);btn.disabled=false;}
  });
 })();

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