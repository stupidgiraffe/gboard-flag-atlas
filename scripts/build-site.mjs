import {readFileSync, writeFileSync, mkdirSync, rmSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dest = resolve(root, process.argv[2] || 'dist');
const BASE = 'https://gboard-flag-atlas.shipstatic.com';
const TOKEN = 'c7f16bb8b6a249ee91959e05496454be';
const data = JSON.parse(readFileSync(join(root, 'data/flags.json'), 'utf8'));
const all = data.entries;
const eligible = new Set(['Code-referenced','Community-referenced','Library-referenced','Interpreted']);
const publish = all.filter(e => eligible.has(e.confidence));
if (!all.length || !publish.length) throw Error('Missing catalog or no suitable entries for individual pages');
if (new Set(all.map(e=>e.name)).size !== all.length) throw Error('Duplicate flag identifiers');
const beacon = `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${TOKEN}"}'></script>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = category => category.toLowerCase().replaceAll('&','and').replace(/[^a-z0-9]+/g,'-').replace(/-+$/,'');
const href = e => eligible.has(e.confidence) ? `/flags/${encodeURIComponent(e.name)}/` : `/?flag=${encodeURIComponent(e.name)}`;
const trunc = (s,n=160) => (s.length>n ? s.slice(0,n-1).replace(/\s+\S*$/,'')+'…' : s);
const title = e => e.title.replace(/^\bAc\b/,'Auto-Correction').replace(/^\bKc\b/,'Key Correction');
const categories = [...new Set(all.map(e=>e.category))];
const groups = new Map(categories.map(cat=>[cat,all.filter(e=>e.category===cat)]));
const styles = `:root{color-scheme:light;--bg:#f6f8f5;--card:#fff;--text:#1c3332;--muted:#617571;--line:#dce7e0;--green:#16544a;--lime:#d6fa75;--soft:#ebf3ee}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.65 Inter,system-ui,-apple-system,Segoe UI,sans-serif;-webkit-font-smoothing:antialiased}a{color:inherit}a:focus-visible,button:focus-visible{outline:3px solid #d6ae58;outline-offset:3px}.wrap{width:min(980px,calc(100% - 36px));margin:auto}.top{display:flex;justify-content:space-between;align-items:center;padding:19px 0;gap:14px}.brand{font-size:21px;font-weight:800;text-decoration:none;letter-spacing:-.05em}.brand span{color:#30856a}.nav{display:flex;gap:15px;align-items:center;font-size:13px;font-weight:650}.nav a{text-decoration:none}.nav a:hover,.link:hover{text-decoration:underline}.support{background:var(--lime);color:#28412e;padding:7px 12px;border-radius:10px}.breadcrumbs{display:flex;gap:8px;flex-wrap:wrap;color:var(--muted);font-size:13px;margin:23px 0}.breadcrumbs a{text-decoration:none}.hero{background:linear-gradient(130deg,#0f2b27,#215848);border-radius:20px;color:#fff;padding:30px 34px}.eyebrow{text-transform:uppercase;letter-spacing:.13em;font-size:11px;color:#b7dacc;font-weight:750}h1{font-size:clamp(23px,5vw,36px);line-height:1.2;overflow-wrap:anywhere;letter-spacing:-.035em;margin:10px 0 12px}h2{font-size:18px;letter-spacing:-.02em;margin:0 0 14px}h3{margin:0 0 6px;font-size:16px}p{margin:0 0 13px}.lead{font-size:16px;line-height:1.75;color:#e4f5ea;max-width:800px}.id{display:block;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:#d6fa75;font-size:13px;overflow-wrap:anywhere;margin-top:18px}.grid{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:18px;margin-top:20px}.panel{border:1px solid var(--line);background:var(--card);border-radius:16px;padding:22px;margin-bottom:17px;min-width:0}.note{border-left:3px solid #c99a5b;padding:12px 15px;background:var(--soft);border-radius:5px;font-size:14px}.meta{display:grid;grid-template-columns:135px 1fr;gap:12px 14px}.meta dt{color:var(--muted);font-weight:650}.meta dd{margin:0}.tag{display:inline-block;border:1px solid #cfe5d6;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:700;color:var(--green);background:#eef8ec}.items{display:grid;gap:10px}.item{display:block;padding:13px 15px;border:1px solid var(--line);border-radius:11px;text-decoration:none}.item:hover{background:var(--soft)}.item small{display:block;color:var(--muted);overflow-wrap:anywhere}.item strong{font-weight:750}.references{padding-left:19px}.references li{margin:8px 0;overflow-wrap:anywhere}.references a{color:var(--green)}.actions{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 0}.btn{border:0;border-radius:10px;padding:10px 14px;background:var(--lime);color:#263c26;font:inherit;font-weight:750;cursor:pointer;text-decoration:none}.btn.secondary{background:var(--soft);color:var(--green)}.footer{margin:30px 0 46px;color:var(--muted);font-size:13px;border-top:1px solid var(--line);padding-top:18px}.footer a{color:var(--green)}.catgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@media(max-width:710px){.grid{grid-template-columns:1fr}.top{align-items:start}.nav{gap:10px}.hero{padding:23px 20px}.panel{padding:18px}.catgrid{grid-template-columns:1fr}.meta{grid-template-columns:112px 1fr}}@media(prefers-color-scheme:dark){:root{color-scheme:dark;--bg:#0d1716;--card:#172522;--text:#f3faf5;--muted:#a8bdb4;--line:#32433e;--soft:#23362f;--green:#86d9b4}.item:hover{background:#23362f}.tag{background:#23362f;border-color:#476358}.btn.secondary{color:#def8e3}}`;
function shell({pageTitle,desc,url,main,robots}) {
 const ld = JSON.stringify({ '@context':'https://schema.org','@type':'WebPage',name:pageTitle,description:desc,url });
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#153632"><title>${esc(pageTitle)}</title><meta name="description" content="${esc(trunc(desc,180))}"><meta name="robots" content="${robots||'index,follow'}"><link rel="canonical" href="${esc(url)}"><link rel="icon" href="/assets/icon.svg" type="image/svg+xml"><meta property="og:type" content="website"><meta property="og:title" content="${esc(pageTitle)}"><meta property="og:description" content="${esc(trunc(desc,180))}"><meta property="og:url" content="${esc(url)}"><style>${styles}</style><script type="application/ld+json">${ld.replace(/</g,'\\u003c')}</script></head><body><div class="wrap"><header class="top"><a href="/" class="brand">flag<span>atlas</span></a><nav class="nav"><a href="/#directory">Search</a><a href="https://github.com/stupidgiraffe/gboard-flag-atlas">GitHub</a><a class="support" href="https://buymeacoffee.com/stupidgiraffe">Support</a></nav></header>${main}<footer class="footer">Gboard Flag Atlas is an independent community reference, not affiliated with Google. Explanations are research-informed and may not describe behavior on every Gboard build. <a href="/">Search all 691 entries</a>.</footer></div>${beacon}</body></html>`;
}
function write(relative,body){const full=join(dest,relative);mkdirSync(dirname(full),{recursive:true});writeFileSync(full,body,'utf8')}
function related(e){return (groups.get(e.category)||[]).filter(x=>x.name!==e.name&&eligible.has(x.confidence)).sort((a,b)=>{const toks=new Set(e.name.split('_'));return b.name.split('_').filter(t=>toks.has(t)).length-a.name.split('_').filter(t=>toks.has(t)).length || a.name.localeCompare(b.name)}).slice(0,5)}
rmSync(dest,{force:true,recursive:true});mkdirSync(dest,{recursive:true});
for(const path of ['data/flags.json','assets/icon.svg','assets/coffee-qr.svg','assets/vendor/fuse.min.mjs','assets/vendor/LICENSE-FUSE.txt','assets/flag-search.mjs'])(mkdirSync(dirname(join(dest,path)),{recursive:true}),writeFileSync(join(dest,path),readFileSync(join(root,path))));
let homepage=readFileSync(join(root,'index.html'),'utf8');
if(homepage.includes('No login. No tracking.'))homepage=homepage.replace('No login. No tracking.','No login. Privacy-friendly analytics.');
if(!homepage.includes('Privacy-friendly analytics.'))throw Error('Homepage must accurately disclose analytics');
if(!homepage.includes('</head>'))throw Error('Homepage head missing');
if(!homepage.includes('rel="canonical"'))homepage=homepage.replace('</head>',`<link rel="canonical" href="${BASE}/"><meta property="og:title" content="Gboard Flag Atlas — Search Gboard developer flags"><meta property="og:url" content="${BASE}/"></head>`);
if(!homepage.includes('</body>'))throw Error('Homepage body missing');
if(!homepage.includes('static.cloudflareinsights.com/beacon.min.js'))homepage=homepage.replace('</body>',beacon+'</body>');
// All original search cards remain. Add dedicated page links for researched/interpreted entries and shareable deep links for the rest.
const linkInsertion="var cpy=mk('button','smallbtn right','Copy name ↗');";
if(!homepage.includes(linkInsertion))throw Error('Could not find existing card toolbar');
if(!homepage.includes("var permalink=mk('a'"))homepage=homepage.replace(linkInsertion,`var permalink=mk('a','smallbtn',(['Code-referenced','Community-referenced','Library-referenced','Interpreted'].includes(x.confidence)?'Flag page ↗':'Share ↗'));permalink.href=(['Code-referenced','Community-referenced','Library-referenced','Interpreted'].includes(x.confidence)?'/flags/'+encodeURIComponent(x.name)+'/':'/?flag='+encodeURIComponent(x.name));bar.appendChild(permalink);\n${linkInsertion}`);
const categoryNav=`<nav class="topiclinks" aria-label="Browse flag categories"><strong>Browse researched flags by topic:</strong> ${categories.map(c=>`<a href="/topics/${slug(c)}/">${esc(c)}</a>`).join(' · ')}</nav>`;
const anchor='<section id="directory">';if(!homepage.includes(anchor))throw Error('Cannot place category nav');
if(!homepage.includes('class="topiclinks"'))homepage=homepage.replace(anchor,categoryNav+anchor);
if(!homepage.includes('.topiclinks{'))homepage=homepage.replace('</style>',`.topiclinks{margin:22px 0;padding:14px 17px;border:1px solid var(--line);border-radius:14px;background:var(--card);font-size:12px;line-height:2}.topiclinks strong{color:var(--muted);display:block}.topiclinks a{color:var(--green);font-weight:650;text-decoration:none}.topiclinks a:hover{text-decoration:underline}</style>`);
write('index.html',homepage);
const sitemap=[`${BASE}/`];
for(const e of publish){
 const path=`flags/${e.name}/index.html`;
 const url=`${BASE}/flags/${encodeURIComponent(e.name)}/`;
 sitemap.push(url);
 const refs=(e.references||[]).map(r=>`<li><a target="_blank" rel="noopener noreferrer" href="${esc(r.url)}">${esc(r.label)}</a></li>`).join('');
 const rel=related(e).map(r=>`<a class="item" href="${href(r)}"><strong>${esc(title(r))}</strong><small>${esc(r.name)}</small></a>`).join('');
 const pageTitle=`${e.name} — Gboard flag explanation | Gboard Flag Atlas`;
 const info=`<nav class="breadcrumbs"><a href="/">Flag Atlas</a> / <a href="/topics/${slug(e.category)}/">${esc(e.category)}</a> / ${esc(e.name)}</nav><div class="hero"><div class="eyebrow">Gboard developer flag · ${esc(e.category)}</div><h1>${esc(title(e))}</h1><p class="lead">${esc(e.summary)}</p><code class="id">${esc(e.name)}</code></div><div class="actions"><button class="btn" id="copy" data-flag="${esc(e.name)}" type="button">Copy flag name</button><a class="btn secondary" href="/?flag=${encodeURIComponent(e.name)}">Find in full Atlas</a><a class="btn secondary" href="https://github.com/stupidgiraffe/gboard-flag-atlas/issues/new?title=${encodeURIComponent('Flag: '+e.name)}">Suggest correction ↗</a></div><div class="grid"><main><section class="panel"><h2>Interpretation and limitations</h2><p>This flag is classified under <strong>${esc(e.category)}</strong> with <strong>${esc(e.tier)}</strong> priority and an estimated impact of <strong>${esc(e.impact)}</strong>.</p><div class="note"><strong>Evidence level: ${esc(e.confidence)}.</strong> ${e.confidence==='Interpreted'?'This interpretation is based on the identifier and surrounding context; exact effects are not independently confirmed.':'A source mentions this feature or flag, but behavior can differ between builds.'}</div>${e.researchNote?`<p style="margin-top:13px"><strong>Research note:</strong> ${esc(e.researchNote)}</p>`:''}</section>${refs?`<section class="panel"><h2>Research references</h2><ul class="references">${refs}</ul></section>`:''}<section class="panel"><h2>Related flags</h2><div class="items">${rel||'<a class="item" href="/">Browse related features in the Atlas</a>'}</div></section></main><aside><section class="panel"><h2>Identifier details</h2><dl class="meta"><dt>Exact name</dt><dd><code style="overflow-wrap:anywhere">${esc(e.name)}</code></dd><dt>Category</dt><dd><a href="/topics/${slug(e.category)}/">${esc(e.category)}</a></dd><dt>Priority</dt><dd>${esc(e.tier)}</dd><dt>Estimated impact</dt><dd>${esc(e.impact)}</dd><dt>Identifier type</dt><dd>${esc(e.kind)}</dd><dt>Evidence</dt><dd><span class="tag">${esc(e.confidence)}</span></dd><dt>Default</dt><dd>Not independently verified</dd></dl></section></aside></div><script>document.getElementById('copy').addEventListener('click',async e=>{try{await navigator.clipboard.writeText(e.target.dataset.flag);e.target.textContent='Copied ✓'}catch{e.target.textContent='Copy unavailable'}})</script>`;
 write(path,shell({pageTitle,desc:e.summary,url,main:info}));
}
const categoryDescriptions={
 'Technical / other':'Technical settings and experimental switches that do not fit a single visible keyboard feature.',
 'Voice & dictation':'Speech recognition, voice typing, and transcription features used in Gboard.',
 'Languages & accessibility':'Language support, alternative input and accessibility-related keyboard features.',
 'Themes & layout':'Keyboard appearance, key arrangement, sizing, and visual layouts.',
 'Emoji & expression':'Emoji Kitchen, stickers, GIFs, and expressive search and suggestions.',
 'Toolbar & editing':'Typing toolbar, cursor, text-selection and editing controls.',
 'Predictions & corrections':'Word prediction, autocorrection, key correction and typing personalization.',
 'AI & writing tools':'On-device language models, AI rewriting, proofreading and writing assistance.',
 'Privacy & diagnostics':'Logging, debugging, privacy-sensitive settings, data retention and diagnostics.',
 'Internal & low-value':'Background infrastructure, troubleshooting and narrow experiments without a clear user-facing benefit.'
};
for (const [category,list] of groups){
 const url=`${BASE}/topics/${slug(category)}/`;sitemap.push(url);
 const summary=categoryDescriptions[category]||`Explore ${category} settings in Gboard`;
 const eligibleList=list.filter(e=>eligible.has(e.confidence));
 const items=eligibleList.map(e=>`<a class="item" href="${href(e)}"><strong>${esc(title(e))}</strong><small>${esc(e.name)}</small><small>${esc(e.summary)}</small></a>`).join('');
 const main=`<nav class="breadcrumbs"><a href="/">Flag Atlas</a> / ${esc(category)}</nav><div class="hero"><div class="eyebrow">Gboard Flag Atlas · Topic guide</div><h1>${esc(category)}</h1><p class="lead">${esc(summary)}</p><p>${eligibleList.length} independently described entries · ${list.length} identifiers in the searchable catalog</p></div><div class="grid"><main><section class="panel"><h2>Flag explanations</h2><div class="items">${items}</div></section></main><aside><section class="panel"><h2>About this topic</h2><p>These links lead to flags with researched or context-based descriptions. Name-only or unresolved entries are still available in the full Atlas.</p><a class="btn secondary" href="/#directory">Search all ${list.length} entries ↗</a></section></aside></div>`;
 write(`topics/${slug(category)}/index.html`,shell({pageTitle:`${category} Gboard flags | Gboard Flag Atlas`,desc:summary,url,main}));
}
write('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);
write('sitemap.xml',`<?xml version="1.0" encoding="utf-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap.map(u=>`<url><loc>${esc(u)}</loc></url>`).join('')}</urlset>`);
console.log(JSON.stringify({total:all.length,indexableFlags:publish.length,topics:categories.length,sitemapURLs:sitemap.length,dist:dest},null,2));
