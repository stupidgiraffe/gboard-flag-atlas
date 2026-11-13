/* Gboard Flag Atlas: offline, weighted, token-aware search with Fuse.js typo fallback.
 * Exact identifiers and acronym tokens outrank general prose; no fuzzy matches for queries under four characters.
 * Pure module, independent of the UI. */
const norm = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_-]+/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const tokenize = (s) => s ? s.split(' ') : [];
const ALIASES = {
  ac: ['auto correction', 'autocorrection', 'autocorrect'],
  kc: ['key correction'],
  pc: ['post correction'],
  nwp: ['next word prediction'],
  ek: ['emoji kitchen'],
  llm: ['large language model'],
  mdd: ['mobile data download'],
  pk: ['physical keyboard'],
  tflite: ['tensorflow lite'],
  autocorrect: ['auto correction', 'autocorrection', 'ac'],
  autocorrection: ['auto correction', 'autocorrect', 'ac'],
  spellcheck: ['spell checker', 'spell check'],
  dictation: ['voice typing', 'speech recognition'],
  gif: ['animated image'],
  clipboard: ['copy paste']
};
function hasPhrase(text, phrase) {
  return text === phrase || text.startsWith(phrase + ' ') || text.endsWith(' ' + phrase) || text.includes(' ' + phrase + ' ');
}
function tokenScore(row, term) {
  // Flag IDs are the primary key. A short acronym must match a complete token, never "access" or "tracking".
  if (row.nameTokens.includes(term)) return 650;
  if (row.titleTokens.includes(term)) return 540;
  if (term.length >= 3 && row.nameTokens.some(s => s.startsWith(term))) return 380;
  if (term.length >= 3 && row.titleTokens.some(s => s.startsWith(term))) return 300;
  for (const a of ALIASES[term] || []) {
    if (hasPhrase(row.name, a)) return 310;
    if (hasPhrase(row.title, a)) return 255;
  }
  if (row.summaryTokens.includes(term)) return 140;
  if (row.categoryTokens.includes(term)) return 85;
  for (const a of ALIASES[term] || []) {
    if (hasPhrase(row.summary, a)) return 65;
    if (hasPhrase(row.category, a)) return 40;
  }
  if (term.length >= 4 && row.summaryTokens.some(s => s.startsWith(term))) return 63;
  if (term.length >= 4 && row.categoryTokens.some(s => s.startsWith(term))) return 35;
  // No arbitrary substring matches. They turn a query such as AC into hundreds of unrelated results.
  return 0;
}
export function createFlagSearch(entries, Fuse) {
  const rows = entries.map((entry) => {
    const name = norm(entry.name);
    const title = norm(entry.title);
    const summary = norm(entry.summary);
    const category = norm(entry.category);
    return {entry,name,title,summary,category,
      nameTokens:tokenize(name),titleTokens:tokenize(title),
      summaryTokens:tokenize(summary),categoryTokens:tokenize(category)};
  });
  const fuzzy = typeof Fuse === 'function' ? new Fuse(rows, {
    keys: [{name:'name',weight:0.46},{name:'title',weight:0.32},{name:'summary',weight:0.19},{name:'category',weight:0.03}],
    useTokenSearch:true, tokenMatch:'all', includeScore:true,
    threshold:0.28,ignoreLocation:true,ignoreDiacritics:true
  }) : null;
  return function findFlags(query) {
    const q = norm(query);
    if (!q) return entries.slice();
    const terms = tokenize(q);
    const found = new Map();
    for (const row of rows) {
      let score = 0;
      for (const term of terms) {
        const s = tokenScore(row,term);
        if (!s) {score=0;break;}
        score += s;
      }
      if (!score) continue;
      if (row.name === q) score += 2500;
      else if (row.title === q) score += 1700;
      else if (hasPhrase(row.name,q)) score += 850 + Math.max(0, 70 - row.nameTokens.length * 6);
      else if (hasPhrase(row.title,q)) score += 610 + Math.max(0, 60 - row.titleTokens.length * 5);
      else if (hasPhrase(row.summary,q)) score += 160;
      found.set(row.entry.name,{entry:row.entry,score});
    }
    // Only longer queries get typo-tolerant results. Exact matches always stay ahead of fuzzy matches.
    if (q.length >= 4 && fuzzy && found.size < 20) {
      const fuzzyResults = fuzzy.search(q,{limit:48});
      for (const hit of fuzzyResults) {
        if (found.has(hit.item.entry.name)) continue;
        if (hit.score == null || hit.score > 0.58) continue;
        found.set(hit.item.entry.name,{entry:hit.item.entry,score:Math.max(1,Math.round(48 * (1-hit.score)))});
      }
    }
    return [...found.values()].sort((a,b)=>b.score-a.score || a.entry.name.localeCompare(b.entry.name)).map(r=>r.entry);
  };
}
