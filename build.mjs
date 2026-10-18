import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { Marked } = await import(pathToFileURL(require.resolve('marked')).href);
const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(await fs.readFile(path.join(root, 'site.json'), 'utf8'));
const base = (process.env.BASE_PATH ?? config.basePath).replace(/\/$/, '');
if (base && !/^\/[a-zA-Z0-9_./-]+$/.test(base)) throw new Error('Invalid base path');
const siteUrl = (process.env.SITE_URL ?? config.siteUrl).replace(/\/$/, '');
const repository = process.env.REPOSITORY_URL ?? config.repositoryUrl;
const out = path.join(root, 'dist');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url = p => `${base}/${p}`;
const absolute = p => `${siteUrl}/${p}`;
const readableDate = d => new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'long', year:'numeric', timeZone:'UTC'}).format(new Date(`${d}T00:00:00Z`));
const markdown = new Marked({gfm:true});

function renderMarkdown(source) {
  const seen = new Map();
  const toc = [];
  const html = markdown.parse(source).replace(/<h([1-6])>(.*?)<\/h\1>/gs, (_, level, text) => {
    let id = text.replace(/<[^>]*>/g, '').toLowerCase().replace(/&[^;]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count) id += `-${count + 1}`;
    if (Number(level) === 2) toc.push({id, text});
    return `<h${level} id="${id}">${text}<a class="heading-anchor" href="#${id}" aria-label="Link to this section">#</a></h${level}>`;
  });
  return {html, toc};
}

function readFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error('Post needs metadata between --- lines');
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    meta[line.slice(0,colon).trim()] = line.slice(colon+1).trim().replace(/^("|')(.*)\1$/, '$2');
  }
  return {...meta, body:match[2]};
}

function shell({title, description=config.description, active='', canonical='', body, article=false}) {
  const nav = [['','Notes','notes'],['labs/','Labs','labs'],['about/','About','about']].map(([p,label,key]) => `<a href="${url(p)}"${active===key?' aria-current="page"':''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(config.author)}</title><meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#f7f6f2"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="${article?'article':'website'}">
${canonical?`<link rel="canonical" href="${esc(canonical)}"><meta property="og:url" content="${esc(canonical)}">`:''}
${siteUrl?`<link rel="alternate" type="application/rss+xml" title="${esc(config.title)}" href="${url('feed.xml')}">`:''}
<link rel="icon" type="image/svg+xml" href="${url('assets/favicon.svg')}"><link rel="stylesheet" href="${url('assets/style.css')}"><script src="${url('assets/site.js')}" defer></script></head>
<body><a class="skip" href="#main">Skip to content</a><div class="site-shell">
<header class="site-header"><a class="brand" href="${url('')}" aria-label="Junyeong Kim — home"><span class="monogram">JK<span></span></span><span class="brand-text">Junyeong Kim<span>NETWORK & SECURITY NOTES</span></span></a><nav aria-label="Main navigation">${nav}${repository?`<a class="repo" href="${esc(repository)}">GitHub <span aria-hidden="true">↗</span></a>`:''}</nav></header>
<main id="main">${body}</main>
<footer class="site-footer"><span>© 2026 Junyeong Kim</span><span>Personal labs. Practical questions. Clear notes.</span><a href="${siteUrl?url('feed.xml'):url('about/')}">${siteUrl?'RSS feed':'About this blog'} <span aria-hidden="true">↗</span></a></footer>
</div></body></html>`;
}

await fs.rm(out, {recursive:true, force:true});
await fs.mkdir(out, {recursive:true});
await fs.cp(path.join(root, 'assets'), path.join(out, 'assets'), {recursive:true});
await fs.cp(path.join(root, 'labs'), path.join(out, 'labs'), {recursive:true});
const posts = [];
const slugs = new Set();
for (const filename of (await fs.readdir(path.join(root,'content/posts'))).filter(f=>f.endsWith('.md'))) {
  const post = readFrontmatter(await fs.readFile(path.join(root,'content/posts', filename),'utf8'));
  if (post.draft === 'true') continue;
  for (const key of ['title','description','date','category','slug']) if (!post[key]) throw new Error(`Missing ${key}: ${filename}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug) || slugs.has(post.slug)) throw new Error(`Invalid or duplicate slug: ${post.slug}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date) || Number.isNaN(Date.parse(post.date))) throw new Error(`Invalid date: ${filename}`);
  slugs.add(post.slug);
  post.reading = Math.max(1, Math.ceil(post.body.split(/\s+/).length / 200));
  post.route = `posts/${post.slug}/`;
  post.rendered = renderMarkdown(post.body);
  posts.push(post);
}
posts.sort((a,b)=>b.date.localeCompare(a.date));
async function write(route, html) {
  const destination = path.join(out,route,'index.html');
  await fs.mkdir(path.dirname(destination), {recursive:true});
  await fs.writeFile(destination,html);
}

const rows = posts.map((p,i)=>`<article class="note-row"><div class="note-meta"><span class="note-number">${String(i+1).padStart(2,'0')}</span><span>${esc(p.category)}</span><time datetime="${p.date}">${readableDate(p.date)}</time></div><div class="note-detail"><h3><a href="${url(p.route)}">${esc(p.title)}</a></h3><p>${esc(p.description)}</p><a class="text-link" href="${url(p.route)}">Read the note <span aria-hidden="true">↗</span></a></div><span class="reading">${p.reading} min read</span></article>`).join('');
const diagram = `<div class="method-figure"><div class="figure-label"><span>FIELD NOTES / 001</span><span>MY APPROACH</span></div><svg viewBox="0 0 440 250" role="img" aria-labelledby="method-title"><title id="method-title">Troubleshooting process: observe, investigate, change and verify, then document the result</title><defs><pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#d4d9d4"/></pattern></defs><rect width="440" height="250" fill="url(#dots)"/><g fill="none" stroke="#718174" stroke-width="1.4"><path d="M91 83H349V166H91V83"/><path d="M177 83H263" stroke="#c25232" stroke-width="3"/><path d="m215 77 7 6-7 6" stroke="#c25232"/><path d="m355 122-6 7-6-7M224 172l-7-6 7-6"/></g><g fill="#f7f6f2" stroke="#bac4ba"><rect x="37" y="57" width="108" height="52" rx="4"/><rect x="295" y="57" width="108" height="52" rx="4"/><rect x="295" y="140" width="108" height="52" rx="4"/><rect x="37" y="140" width="108" height="52" rx="4"/></g><g fill="#22352c" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11"><text x="91" y="88">01 OBSERVE</text><text x="349" y="88">02 INVESTIGATE</text><text x="349" y="171">03 CHANGE</text><text x="91" y="171">04 VERIFY</text></g><text x="220" y="232" text-anchor="middle" fill="#617066" font-family="ui-monospace,monospace" font-size="11">DOCUMENT THE EVIDENCE, NOT JUST THE FIX.</text></svg><p>One symptom. A few hypotheses.<br>A result I can explain.</p></div>`;

await write('',shell({title:config.title,active:'notes',canonical:siteUrl?absolute(''):'',body:`
<section class="hero"><div><p class="eyebrow"><span class="tiny-line"></span> NETWORKING · LINUX · SECURITY OPERATIONS</p><h1>Small labs.<br>Clear evidence.<br><em>Better troubleshooting.</em></h1><p class="hero-intro">I’m Junyeong, an information security professional in South Korea. These are my notes as I build stronger hands-on network and security skills.</p><div class="hero-actions"><a class="button" href="#notes">Explore the notes <span aria-hidden="true">↓</span></a><a class="quiet-link" href="${url('about/')}">A little about me <span aria-hidden="true">↗</span></a></div></div>${diagram}</section>
<section class="notes-section" id="notes"><div class="section-heading"><p class="eyebrow">THE NOTEBOOK</p><h2>Learning, made visible.</h2><p>Reasoning, observations, and the questions that follow.</p></div>${rows||'<p>The first note is on its way.</p>'}</section>
<section class="focus-section"><div class="focus-title"><p class="eyebrow">CURRENT FOCUS</p><h2>Building the foundations.</h2><p>CCNA in progress.<br>Practical understanding, one lab at a time.</p></div><div class="focus-list"><div><span>01</span><h3>Networking</h3><p>VLANs, routing, traffic flow, and systematic connectivity checks.</p></div><div><span>02</span><h3>Linux</h3><p>Interfaces, name resolution, services, and the logs behind a symptom.</p></div><div><span>03</span><h3>Security operations</h3><p>Firewall policies, useful evidence, and clear incident documentation.</p></div></div></section>
<section class="lab-callout"><div><p class="eyebrow">FROM READING TO DOING</p><h2>A small lab. A useful question.</h2><p>My planned Packet Tracer series starts with a working baseline and introduces one fault at a time.</p></div><a class="button button-outline" href="${url('labs/')}">See the lab plan <span aria-hidden="true">↗</span></a></section>`}));

for (const p of posts) {
  const toc = p.rendered.toc.map(t=>`<li><a href="#${t.id}">${t.text}</a></li>`).join('');
  await write(p.route,shell({title:p.title,description:p.description,active:'notes',article:true,canonical:siteUrl?absolute(p.route):'',body:`<div class="article-back"><a href="${url('')}#notes">← All notes</a></div><header class="article-header"><p class="eyebrow">${esc(p.category)}</p><h1>${esc(p.title)}</h1><p class="article-deck">${esc(p.description)}</p><div class="article-meta"><span>By Junyeong Kim</span><time datetime="${p.date}">${readableDate(p.date)}</time><span>${p.reading} min read</span></div></header><div class="article-layout"><article class="prose">${p.rendered.html}<div class="article-end"><span>END OF NOTE</span><p>Still learning. Still checking the evidence.</p><a href="${url('labs/')}">Explore the lab plan →</a></div></article><aside class="toc"><p class="eyebrow">IN THIS NOTE</p><ol>${toc}</ol><div class="side-note">Personal learning notes.<br>Lab work is kept separate from production experience.</div></aside></div>`}));
}

const about = renderMarkdown((await fs.readFile(path.join(root,'content/about.md'),'utf8')).replace(/^# .+\n/,''));
await write('about',shell({title:'About',active:'about',canonical:siteUrl?absolute('about/'):'',body:`<header class="page-header"><p class="eyebrow">BEHIND THE NOTES</p><h1>A little about me.</h1><p class="article-deck">An operations background. A growing technical practice.</p></header><div class="about-layout"><aside class="author-block"><div class="author-initials" aria-hidden="true">JK<span>↗</span></div><h2>Junyeong Kim</h2><p>Information security<br>South Korea</p><span class="status-label">CCNA IN PROGRESS</span></aside><article class="prose">${about.html}</article></div>`}));

await write('labs',shell({title:'Lab notebook',active:'labs',canonical:siteUrl?absolute('labs/'):'',body:`<header class="page-header"><p class="eyebrow">LAB NOTEBOOK</p><h1>Reproduce. Investigate.<br><em>Understand.</em></h1><p class="article-deck">A place for small, focused experiments and the files behind them.</p></header><div class="lab-layout"><section><div class="planned-label">PLANNED SERIES · PACKET TRACER</div><h2>Five faults. One working baseline.</h2><p class="lab-description">The exercise guide is ready to use. I plan to document the actual observations and recovery checks as I work through each case.</p><div class="lab-sequence"><div><span>01</span><p>Build and verify a working network.</p></div><div><span>02</span><p>Introduce one fault in a separate copy.</p></div><div><span>03</span><p>Investigate, repair, and repeat the failed test.</p></div><div><span>04</span><p>Write down the evidence and what changed.</p></div></div><a class="button" href="${url('labs/packet-tracer-guide.md')}" download>Download the guide <span aria-hidden="true">↓</span></a><p class="file-caption">Markdown · Korean · Exercise design, not a completed lab report.</p></section><aside class="lab-aside"><p class="eyebrow">WHAT YOU WILL FIND</p><h3>Topology & addressing</h3><p>A small network with VLANs, routers, a remote DHCP service, and a web server.</p><h3>Fault injection & diagnosis</h3><p>Instructions for introducing and investigating individual faults.</p><h3>Actual lab files</h3><p>Completed .pkt files and observed outputs will be added after I run and verify the exercises.</p></aside></div>`}));

const notFound = shell({title:'Page not found',body:`<section class="page-header"><p class="eyebrow">404 / ROUTE NOT FOUND</p><h1>This path leads nowhere.</h1><p class="article-deck">The note may have moved. Let’s return to the notebook.</p><a class="button" href="${url('')}">Back to the notes →</a></section>`});
await fs.writeFile(path.join(out,'404.html'),notFound);
await fs.writeFile(path.join(out,'.nojekyll'),'');
if (siteUrl) {
  const feed = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(config.title)}</title><link>${esc(absolute(''))}</link><description>${esc(config.description)}</description><language>en</language>${posts.map(p=>`<item><title>${esc(p.title)}</title><link>${esc(absolute(p.route))}</link><guid>${esc(absolute(p.route))}</guid><description>${esc(p.description)}</description><pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`;
  await fs.writeFile(path.join(out,'feed.xml'),feed);
  await fs.writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['','about/','labs/',...posts.map(p=>p.route)].map(p=>`<url><loc>${esc(absolute(p))}</loc></url>`).join('')}</urlset>`);
  await fs.writeFile(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${absolute('sitemap.xml')}\n`);
}
console.log(`Built ${posts.length} published article(s) and 4 site pages in dist/.`);
