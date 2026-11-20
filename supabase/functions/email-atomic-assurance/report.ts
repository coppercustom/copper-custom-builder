const reportCss=`
.aa-paper{box-sizing:border-box;background:#faf7f2;color:#28221e;font:15px/1.55 Arial,sans-serif;overflow-wrap:anywhere;text-align:left}
.aa-paper *{box-sizing:border-box}
.aa-paper .aa-mast{background:#241b15;color:#fff5e9;padding:clamp(18px,4vw,42px)}
.aa-paper .aa-title{margin:6px 0;font:normal clamp(24px,5vw,46px)/1.13 Georgia,serif;color:inherit}
.aa-paper .aa-brand,.aa-paper .aa-label{display:block;font-size:11px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase}
.aa-paper .aa-brand{color:#ecc29d}
.aa-paper .aa-label{color:#874b27}
.aa-paper .aa-body{padding:clamp(16px,4vw,42px)}
.aa-paper .aa-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:10px 16px}
.aa-paper .aa-section{border-top:1px solid #d9cabe;margin-top:16px;padding-top:12px}
.aa-paper .aa-heading{font:normal 24px/1.2 Georgia,serif;margin:0 0 8px;color:inherit}
.aa-paper .aa-line{margin:0 0 7px;white-space:pre-wrap;color:inherit}
.aa-paper a{color:#874b27;text-decoration:underline}
@media print{.aa-paper{print-color-adjust:exact;-webkit-print-color-adjust:exact}.aa-paper .aa-section{break-inside:avoid}#assurance-print{display:none}}
`;
function reportMarkup(customer:string,row:Record<string,any>,sample=false){
 const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=(value:string)=>value?new Intl.DateTimeFormat('en-US',{dateStyle:'long',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z')):'';
 const line=(label:string,value:unknown)=>value?'<div class="aa-line"><span class="aa-label">'+label+'</span>'+esc(value)+'</div>':'';
 const link=(label:string,value:string)=>{
  try{
   const url=new URL(value);
   if(url.protocol!=='https:'||url.username||url.password)return '';
   return '<div class="aa-line"><a href="'+esc(url.href)+'" '+(sample?'data-demo-report-link':'target="_blank" rel="noopener noreferrer"')+'>'+label+'</a>'+(sample?' (sample link)':'')+'</div>';
  }catch{return '';}
 };
 const section=(title:string,body:string)=>body?'<div class="aa-section"><div class="aa-heading">'+title+'</div>'+body+'</div>':'';
 return '<article class="aa-paper"><div class="aa-mast"><span class="aa-brand">Copper Custom Armament</span><div class="aa-title">Build Documentation</div><div>Atomic Assurance · '+(sample?'Sample pickup packet':'Customer pickup packet')+'</div></div><div class="aa-body"><div class="aa-meta">'+
  line('Prepared for',customer)+line('Build reference',row.build_reference)+line('Pickup date',date(row.pickup_date))+'</div>'+
  section('One-year warranty',line('Coverage period',[date(row.pickup_date),date(row.warranty_end_date)].filter(Boolean).join(' – ')))+
  section('Assembly record',line('Inspection summary',row.inspection_summary)+link('View torque documentation',row.torque_url)+link('View witness marking photos',row.witness_url))+
  section('Test-fire record',line('Test date',date(row.test_date))+line('Test summary',row.test_summary)+link('View test-fire footage',row.footage_url)+line('Suppressed build sound reading',row.sound_reading_db==null?'':row.sound_reading_db+' dB')+link('View test target',row.target_url))+
  section(sample?'Sample only':'Report prepared by',sample?'<div class="aa-line">Fictional records throughout. Your pickup packet will reflect your completed build.</div>':line('Prepared by',row.prepared_by))+'</div></article>';
}

export { reportCss, reportMarkup };
