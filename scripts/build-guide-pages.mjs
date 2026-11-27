import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {join,dirname} from "node:path";

export function buildGuidePages({root,dest,BASE,all,href,esc,shell}) {
  const guides=[...JSON.parse(readFileSync(join(root,"data/guides.json"),"utf8")),...JSON.parse(readFileSync(join(root,"data/guides-extended.json"),"utf8"))];
  if(guides.length!==40 || new Set(guides.map(g=>g.slug)).size!==40) throw Error("20 unique guides required");
  const flags=new Map(all.map(f=>[f.name,f]));
  const urls=[];
  const url=g=>"/guides/"+g.slug+"/";
  const write=(p,body)=>{const out=join(dest,p);mkdirSync(dirname(out),{recursive:true});writeFileSync(out,body,"utf8")};
  const item=g=>'<a class="item" href="'+url(g)+'"><strong>'+esc(g.title)+'</strong><small>'+esc(g.description)+'</small></a>';
  for(const g of guides) {
    if(g.sections.length<3||g.questions.length<2||g.flags.length<3||g.flags.some(n=>!flags.has(n))||g.sources.length===0) throw Error("Incomplete guide "+g.slug);
  }
  for(const g of guides.slice(20)) {
    const words=g.sections.map(s=>s[1]).join(" ").trim().split(/\s+/).length;
    if(g.sections.length<4||g.flags.length<4||g.sources.length<2||words<220) throw Error("New guide lacks sufficient original research: "+g.slug);
  }
  const groups=[
    ["Start here",guides.slice(0,4)],
    ["Autocorrection, touch accuracy and language",guides.slice(4,10)],
    ["Voice typing and AI",guides.slice(10,14)],
    ["Emoji, stickers, layout and editing",guides.slice(14,18)],
    ["Privacy and performance",guides.slice(18,20)],
    ["GboardWu, backups and privacy",guides.slice(20,25)],
    ["Editing, gestures and layouts",guides.slice(25,30)],
    ["Appearance, handwriting and language",guides.slice(30,35)],
    ["Punctuation, dictation, OCR and emoji search",guides.slice(35,40)]
  ];
  const hub='<nav class="breadcrumbs"><a href="/">Flag Atlas</a> / Guides</nav>'
    +'<div class="hero"><div class="eyebrow">40 independent guides</div><h1>Gboard hidden features, explained with evidence</h1><p class="lead">Learn how Gboard flags relate to corrections, AI features, voice typing, model downloads, Emoji Kitchen and diagnostics. Follow exact identifiers, original analysis and source references.</p></div>'
    +'<main class="grid"><div>'+groups.map(([heading,items])=>'<section class="panel"><h2>'+esc(heading)+'</h2><div class="items">'+items.map(item).join("")+'</div></section>').join("")+'</div><aside><section class="panel"><h2>How this reference works</h2><p>The Atlas documents 691 candidate identifiers from GboardWu 18.5.4. A matching identifier is not proof that a feature can be enabled on every phone.</p><p>Guides explain mechanisms and testing methods. The search shows exact IDs, evidence labels and research notes.</p><a class="btn secondary" href="/#directory">Search all flags</a></section></aside></main>';
  const hubURL=BASE+"/guides/";
  write("guides/index.html",shell({pageTitle:"20 Gboard Developer Flag Guides | Gboard Flag Atlas",desc:"40 original guides to GboardWu flags, keyboard corrections, voice typing, Emoji Kitchen, AI writing and safe flag testing.",url:hubURL,main:hub}));
  urls.push(hubURL);
  for(let i=0;i<guides.length;i++) {
    const g=guides[i],canonical=BASE+url(g);
    const paragraphs=g.sections.map(([heading,body])=>'<section class="panel"><h2>'+esc(heading)+'</h2><p>'+esc(body)+'</p></section>').join("");
    const faqs=g.questions.map(([q,a])=>'<div class="faq"><h3>'+esc(q)+'</h3><p>'+esc(a)+'</p></div>').join("");
    const sources=g.sources.map(([label,ref])=>'<li><a target="_blank" rel="noopener noreferrer" href="'+esc(ref)+'">'+esc(label)+'</a></li>').join("");
    const flaglist=g.flags.map(n=>{
      const f=flags.get(n);
      return '<a class="item" href="'+href(f)+'"><strong><code>'+esc(f.name)+'</code></strong><small>'+esc(f.summary)+'</small><small>Evidence: '+esc(f.confidence)+' | '+esc(f.category)+'</small></a>';
    }).join("");
    const neighbors=[guides[(i+1)%guides.length],guides[(i+guides.length-1)%guides.length]];
    const main='<nav class="breadcrumbs"><a href="/">Flag Atlas</a> / <a href="/guides/">Guides</a> / '+esc(g.title)+'</nav>'
      +'<div class="hero"><div class="eyebrow">Independent Gboard field guide | '+esc(g.audience)+'</div><h1>'+esc(g.title)+'</h1><p class="lead">'+esc(g.description)+'</p></div>'
      +'<div class="grid"><main>'
      +'<section class="panel"><h2>What you should know</h2><p><strong>'+esc(g.takeaway)+'</strong></p><div class="note">Evidence standard: these are real catalog identifiers, but their effects can be inferred, version-specific, or gated. Check the confidence and APK notes before changing settings.</div></section>'
      +paragraphs
      +'<section class="panel"><h2>Frequently asked questions</h2>'+faqs+'</section>'
      +'<section class="panel"><h2>References and context</h2><ul class="references">'+sources+'</ul><p>External sources support the cited general mechanisms or patch features. They do not independently verify the behavior of every individual undocumented flag.</p></section>'
      +'<section class="panel"><h2>Related reading</h2><div class="items">'+neighbors.map(item).join("")+'<a class="item" href="/guides/">All 40 guides</a></div></section>'
      +'</main><aside><section class="panel"><h2>Explore exact flags</h2><p>Identifiers from the current Atlas snapshot:</p><div class="items">'+flaglist+'</div></section><section class="panel"><h2>Use the Atlas</h2><p>Search all 691 identifiers, filter by evidence level, and save useful examples.</p><a class="btn secondary" href="/#directory">Search flags</a></section></aside></div>';
    write("guides/"+g.slug+"/index.html",shell({pageTitle:g.title+" | Gboard Flag Atlas",desc:g.description,url:canonical,main}));
    urls.push(canonical);
  }
  // Add a visible, crawlable entry point on the homepage. Guard against re-generating
  // from the already-generated index.html checked into the repository.
  const hp=join(dest,"index.html");
  let html=readFileSync(hp,"utf8");
  if(!html.includes('href="/guides/"')) {
    html=html.replace('<a data-hide href="#about">About</a>','<a data-hide href="/guides/">Guides</a><a data-hide href="#about">About</a>');
  }
  const picks=["gboard-developer-flags-explained","use-gboardwu-flag-editor","gboard-v2-klp-language-pack-loader","gboard-emoji-kitchen-experiments","gboardwu-vs-stock-gboard","gboard-flag-backup-restore-pb-xml","gboard-web-clipboard-sync-security","gboard-custom-themes-material-3-colors","gboard-rambler-voice-editing"];
  const featured='<section class="guide-preview" aria-labelledby="guide-preview-title"><div class="sectiontitle"><div><h2 id="guide-preview-title">Guides to Gboard hidden features</h2><p>Understand the evidence, test safely, and find the exact flags behind each feature.</p></div><a class="guide-all" href="/guides/">All 40 guides</a></div><div class="guide-tiles">'
   +picks.map(id=>{const g=guides.find(x=>x.slug===id);return '<a href="'+url(g)+'"><strong>'+esc(g.title)+'</strong><span>'+esc(g.description)+'</span></a>'}).join("")
   +'</div></section>';
  if(!html.includes('class="guide-preview"')) {
    html=html.replace('<section id="directory">',featured+'<section id="directory">');
  }
  if(!html.includes(".guide-preview{")) {
    html=html.replace("</style>",'.guide-preview{margin:24px 0}.guide-preview .sectiontitle{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.guide-all{font-weight:800;color:var(--green);font-size:13px}.guide-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:15px 0}.guide-tiles a{padding:15px;border-radius:14px;background:var(--card);border:1px solid var(--line);text-decoration:none}.guide-tiles a:hover{background:var(--soft)}.guide-tiles strong{display:block;font-size:14px;line-height:1.3}.guide-tiles span{display:block;color:var(--muted);font-size:12px;margin-top:8px;line-height:1.5}@media(max-width:800px){.guide-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.guide-tiles{grid-template-columns:1fr}}</style>');
  }
  writeFileSync(hp,html,"utf8");
  return urls;
}

