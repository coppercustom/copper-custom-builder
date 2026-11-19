/* Copper Custom staff weapon-light review panel.
 * Usage: CopperWeaponLightReview.mount(document.querySelector('#light-review'), {
 *   getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token
 * });
 * Must be embedded only in an authenticated employee dashboard.
 */
(function(global){
  'use strict';
  const ENDPOINT='https://cyrmysbcrpiadchcpsfa.supabase.co/functions/v1/cc-weapon-light-review';
  const priorities=[['','All categories'],['weapon_light_candidate','Weapon-light candidates'],['manufacturer_alias_review','Manufacturer discrepancies'],['category_conflict','Category conflicts'],['unclassified','Unclassified']];
  const el=(tag,attrs={},value)=>{const node=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='className')node.className=v;else if(k==='type'||k==='placeholder'||k==='value'||k==='aria-label')node.setAttribute(k,v);}if(value!==undefined)node.textContent=String(value);return node;};
  function mount(root,options={}){
    if(!root||typeof options.getAccessToken!=='function')throw Error('Review panel needs a root and getAccessToken callback.');
    root.replaceChildren();
    const wrap=el('section',{className:'cc-light-review'});
    const heading=el('h2',{},'Weapon-light catalog review');
    const description=el('p',{},'Supplier listings remain unpublished until reviewed. Approval records a staff decision; it does not automatically publish a product.');
    const controls=el('div',{className:'cc-light-review-controls'});
    const filter=el('select',{'aria-label':'Review category'});
    for(const [value,label] of priorities){const opt=el('option',{value},label);filter.append(opt);}
    const search=el('input',{type:'search',placeholder:'Search manufacturer, model or UPC','aria-label':'Search products'});
    const load=el('button',{type:'button'},'Search');
    const status=el('p',{'aria-label':'Review status'});
    const table=el('div',{className:'cc-light-review-results'});
    const pager=el('div');
    const previous=el('button',{type:'button'},'Previous');
    const next=el('button',{type:'button'},'Next');
    const pageLabel=el('span');
    controls.append(filter,search,load);pager.append(previous,pageLabel,next);
    wrap.append(heading,description,controls,status,table,pager);root.append(wrap);
    let offset=0,total=0,busy=false;
    async function call(payload){
      const token=await options.getAccessToken();
      if(!token)throw Error('Employee session expired. Please sign in again.');
      const res=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+token},body:JSON.stringify(payload)});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.success)throw Error(data.error||'Request failed');
      return data;
    }
    async function refresh(){
      if(busy)return;busy=true;load.disabled=true;status.textContent='Loading review queue…';table.replaceChildren();
      try{
        const data=await call({action:'list',priority:filter.value,search:search.value,offset,limit:25});
        total=data.total||0;status.textContent=total+' products found';
        for(const product of data.products||[]){
          const card=el('article',{className:'cc-light-review-item'});
          const name=el('h3',{},(product.manufacturer||'Unknown manufacturer')+' — '+(product.model||'Unnamed model'));
          const meta=el('p',{},'UPC: '+(product.upc||'N/A')+' · '+product.review_priority.replaceAll('_',' ')+' · '+product.supplier_listing_count+' supplier listing(s)');
          const sources=el('p',{},'Sources: '+(product.suppliers||[]).join(', '));
          const current=el('p',{},'Latest review: '+(product.latest_review?.decision||'Not reviewed'));
          const decision=el('select',{'aria-label':'Review decision for '+product.model});
          for(const [value,label] of [['','Choose decision'],['approve_weapon_light','Approve as weapon light'],['reject_non_weapon','Reject: not a weapon light'],['needs_research','Needs more research']])decision.append(el('option',{value},label));
          const notes=el('textarea',{placeholder:'Required: reason for decision (at least 8 characters)'});
          notes.rows=2;notes.maxLength=2000;
          const submit=el('button',{type:'button'},'Save review');
          const feedback=el('span',{'aria-label':'Save result'});
          submit.addEventListener('click',async()=>{
            if(!decision.value||notes.value.trim().length<8){feedback.textContent='Choose a decision and enter a reason of at least 8 characters.';return;}
            if(!global.confirm('Save this review decision? This will be recorded in the audit history.'))return;
            submit.disabled=true;feedback.textContent='Saving…';
            try{await call({action:'review',product_id:product.catalog_product_id,decision:decision.value,notes:notes.value.trim()});feedback.textContent='Saved';current.textContent='Latest review: '+decision.value;}
            catch(err){feedback.textContent=err.message||'Save failed';}
            finally{submit.disabled=false;}
          });
          card.append(name,meta,sources,current,decision,notes,submit,feedback);table.append(card);
        }
        if(!data.products?.length)table.append(el('p',{},'No matching products.'));
        pageLabel.textContent=' Page '+(Math.floor(offset/25)+1)+' of '+Math.max(1,Math.ceil(total/25))+' ';
        previous.disabled=offset===0;next.disabled=offset+25>=total;
      }catch(err){status.textContent=err.message||'Could not load reviews';previous.disabled=true;next.disabled=true;}
      finally{busy=false;load.disabled=false;}
    }
    load.addEventListener('click',()=>{offset=0;refresh();});
    search.addEventListener('keydown',e=>{if(e.key==='Enter'){offset=0;refresh();}});
    filter.addEventListener('change',()=>{offset=0;refresh();});
    previous.addEventListener('click',()=>{offset=Math.max(0,offset-25);refresh();});
    next.addEventListener('click',()=>{offset+=25;refresh();});
    refresh();
    return {refresh};
  }
  global.CopperWeaponLightReview={mount};
})(window);
