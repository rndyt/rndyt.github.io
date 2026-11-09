import { readdir, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parse } from 'yaml';
import { Marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import sanitize from 'sanitize-html';
import { replayMarkdown } from './workflow-replay.mjs';

// Ship reader styles with the document so an installed offline cache cannot
// pair current article HTML with an older version of its typography.
const readerStyles = readFileSync('public/blog-reader.css', 'utf8');

export const escape = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderMarkdown(body) {
  const headings = [];
  const math = [];
  const extension = markedKatex({ nonStandard: true, throwOnError: false, trust: false, strict: false });
  for (const rule of extension.extensions) {
    if (rule.name === 'blockKatex') rule.tokenizer = function(src) {
      const match = /^(\${2})[\t ]*\n([\s\S]+?)\n\1[\t ]*(?:\n|$)/.exec(src);
      if (match) return { type: 'blockKatex', raw: match[0], text: match[2].trim(), displayMode: true };
    };
    const render = rule.renderer;
    rule.renderer = token => {
      if (token.displayMode && /\\\\/.test(token.text) && !/\\begin\s*\{/.test(token.text)) {
        token = { ...token, text: `\\begin{aligned}${token.text}\\end{aligned}` };
      }
      // Only trusted KaTeX output bypasses the Markdown HTML sanitizer. Keep
      // arbitrary source HTML under the original, restrictive allowlist.
      const index = math.push(render(token)) - 1;
      return `<span data-rendered-math="${index}"></span>`;
    };
  }
  const markdown = new Marked({ renderer: {
    heading({ tokens, depth }) {
      const html = this.parser.parseInline(tokens);
      const text = sanitize(html, { allowedTags: [], allowedAttributes: {} });
      const id = `section-${headings.length + 1}`;
      headings.push({ id, text, depth });
      return `<h${depth} id="${id}">${html}</h${depth}>`;
    }
  }});
  markdown.use(extension);
  const bodyHtml = sanitize(markdown.parse(body), {
    allowedTags: [...sanitize.defaults.allowedTags, 'img'],
    allowedAttributes: { ...sanitize.defaults.allowedAttributes, '*': ['id'], span: ['data-rendered-math'], img: ['src', 'alt', 'title', 'width', 'height'], code: ['class'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
  }).replace(/<span data-rendered-math="(\d+)"><\/span>/g, (_match, index) => math[Number(index)] ?? '');
  return { bodyHtml, headings };
}
export async function readPosts(directory = new URL('../content/posts/', import.meta.url)) {
  const paths = (await readdir(directory, { recursive: true })).filter(path => path.endsWith('.md')).sort();
  const posts = [];
  for (const path of paths) {
    const raw = (await readFile(new URL(path, directory), 'utf8')).replace(/\r\n/g, '\n');
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
    if (!match) throw Error(`${path}: 缺少 YAML 元数据`);
    const data = parse(match[1]);
    for (const key of ['archiveId','category','title','description','author','date']) {
      if (typeof data?.[key] !== 'string' || !data[key].trim()) throw Error(`${path}: ${key} 必须是非空文本`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !Number.isFinite(Date.parse(data.date))) throw Error(`${path}: 日期格式应为 YYYY-MM-DD`);
    if (data.updated && (!/^\d{4}-\d{2}-\d{2}$/.test(data.updated) || !Number.isFinite(Date.parse(data.updated)))) throw Error(`${path}: updated 日期无效`);
    if (data.preview !== undefined && typeof data.preview !== 'boolean') throw Error(`${path}: preview 必须是布尔值`);
    const slug = data.slug ?? basename(path, '.md');
    if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw Error(`${path}: slug 必须是小写英文、数字和短横线`);
    const tags = data.tags ?? [];
    if (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string' && tag.trim())) throw Error(`${path}: tags 必须是文本数组`);
    const sourceBody = match[2].trim();
    const body = sourceBody + (data.replay ? replayMarkdown : "");
    if (!sourceBody) throw Error(`${path}: 正文不能为空`);
    const readingMinutes = Math.max(1, Math.ceil(body.length / 400));
    posts.push({
      id: data.archiveId, slug, title: data.title, en: data.kind?.toUpperCase() ?? 'ARTICLE',
      department: tags.join(' / ') || data.category, category: data.category,
      date: data.updated ?? data.date, lead: data.author, clearance: data.preview !== false ? 'PREVIEW / 示例' : 'PUBLIC / 公开',
      abstract: data.description, findings: [data.description], source: `/posts/${slug}/`,
      body, ...renderMarkdown(body), tags, readingMinutes, preview: data.preview !== false,
    });
  }
  // Stable IDs survive date changes, content reordering, and removed posts.
  posts.sort((a, b) => a.id.localeCompare(b.id));
  const preferred = ['工程文章', 'AI 实践', '项目记录'];
  const present = [...new Set(posts.map(post => post.category))];
  const columns = [...preferred.filter(name => present.includes(name)), ...present.filter(name => !preferred.includes(name))];
  return { categories: columns, columns, records: posts };
}
export function readerPage(record, all) {
  const related = all.filter(item => item.category === record.category && item.id !== record.id);
  const tocHeadings = record.headings.filter(h => h.depth === 1);
  const tocLinks = tocHeadings.map(h => `<a href="#${h.id}">${h.text}</a>`).join('');
  const content = record ? `<div class="reader-column"><nav class="reader-topbar" aria-label="文章导航">${readerBack(`/?post=${record.slug}`)}</nav><header><div class="eyebrow">${escape(record.category)} / ${record.id}</div><h1>${escape(record.title)}</h1><p class="meta">${escape(record.lead)} · ${escape(record.date)} · ${record.readingMinutes} 分钟阅读</p><div class="tags">${record.tags.map(tag => `<span>#${escape(tag)}</span>`).join(' ')}</div></header>${record.preview ? '<aside class="notice">示例内容 · 尚未替换为真实文章或项目资料。</aside>' : ''}${tocHeadings.length ? `<details class="mobile-toc"><summary>本文目录</summary><nav class="toc" aria-label="本文目录">${tocLinks}</nav></details>` : ''}<article class="prose">${record.bodyHtml}</article>${related.length ? `<section class="related"><h2>同类文章</h2>${related.map(post => `<a href="${post.source}">${escape(post.title)} ↗</a>`).join('')}</section>` : ''}</div>${tocHeadings.length ? `<aside class="reader-sidebar"><nav class="toc" aria-label="本文目录"><span class="toc-label">本文目录</span>${tocLinks}</nav></aside>` : ''}` : '';
  return page(record.title, content, record.abstract, tocHeadings.length ? "reader-layout" : "");
}
export function indexPage(records, categories) {
  const sorted = [...records].sort((a,b) => b.date.localeCompare(a.date));
  return page('文章目录', `<header><div class="eyebrow">RNDYT / PERSONAL ARCHIVE</div><h1>文章目录</h1><p class="description">工程文章、AI 实践与项目记录。</p>${readerBack('/')}</header>${records.some(r => r.preview) ? '<aside class="notice">当前包含示例内容，不代表真实经历或成果。</aside>' : ''}${categories.map(category => `<section class="collection"><h2>${escape(category)}</h2>${sorted.filter(post => post.category === category).map(post => `<a class="post-row" href="${post.source}"><span class="meta">${post.date} / ${post.id}</span><h3>${escape(post.title)}</h3><p>${escape(post.abstract)}</p><span class="meta">${post.readingMinutes} 分钟阅读 ↗</span></a>`).join('')}</section>`).join('')}`);
}
function readerBack(href) {
  return `<a class="reader-back" href="${href}" aria-label="返回档案" title="返回档案">← 返回档案</a>`;
}
function page(title, content, description = 'rndyt 的个人博客', mainClass = '') {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="description" content="${escape(description)}"><title>${escape(title)} · rndyt</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/math/katex.min.css"><style>${readerStyles}</style><link rel="stylesheet" href="/reader-transition.css"><script src="/reader-transition.js"></script></head><body><main class="${mainClass}">${content}</main><footer>rndyt · 个人博客 · 三维档案 <a href="https://github.com/LBEILC/RhineLabUI">界面基于 RhineLabUI</a></footer></body></html>`;
}
