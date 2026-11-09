import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, readerPage } from './blog-content.mjs';

test('desktop and mobile outlines include only level-one headings, preserving deeper anchors', () => {
  const rendered = renderMarkdown('# Main\n\n## Detail\n\n### Nested\n\n# Next');
  const html = readerPage({ ...rendered, title: 'Title', category: 'AI', id: 'X-001', slug: 'test', lead: 'rndyt', date: '2026-11-09', readingMinutes: 1, tags: [] }, []);
  assert.equal(rendered.headings[1].depth, 2);
  assert.match(rendered.bodyHtml, /<h2 id="section-2">Detail/);
  assert.match(rendered.bodyHtml, /<h3 id="section-3">Nested/);
  for (const toc of html.matchAll(/<nav class="toc"[^>]*>([\s\S]*?)<\/nav>/g)) {
    assert.match(toc[1], /href="#section-1"/);
    assert.match(toc[1], /href="#section-4"/);
    assert.doesNotMatch(toc[1], /Detail|Nested/);
  }
  const withoutMain = readerPage({ ...rendered, headings: rendered.headings.filter(h => h.depth !== 1), title: 'Title', tags: [] }, []);
  assert.doesNotMatch(withoutMain, /class="toc"|class="reader-sidebar"|class="mobile-toc"/);
});
test('Obsidian inline and display math render while code remains literal', () => {
  const { bodyHtml } = renderMarkdown(String.raw`维度为$[B,L,D]$，缩放 $\frac{QK^T}{\sqrt{d_k}}$。

$$  
\operatorname{Attention}(Q,K,V)=\operatorname{softmax}\left(\frac{QK^T}{\sqrt{d_k}}+M\right)V
$$

~~~tex
$$not math$$
~~~` + '\n\n`$literal$`');
  assert.match(bodyHtml, /class="katex"/);
  assert.match(bodyHtml, /class="katex-display"/);
  assert.match(bodyHtml, /<math /);
  assert.match(bodyHtml, /<code>\$literal\$<\/code>/);
  assert.match(bodyHtml, /\$\$not math\$\$/);
  assert.doesNotMatch(bodyHtml, /katex-error|data-rendered-math/);
});
test('math rendering does not allow executable markup or trusted TeX commands', () => {
  const { bodyHtml } = renderMarkdown(String.raw`$\href{javascript:alert(1)}{click}$ <img src="x" onerror="alert(1)"><script>alert(1)</script>`);
  assert.doesNotMatch(bodyHtml, /<script|onerror=|href="javascript:/i);
});
test('multiline display equations retain their rows', () => {
  const { bodyHtml } = renderMarkdown('$$\nH=X+Y \\\\\nY=H+Z\n$$');
  assert.match(bodyHtml, /class="mtable"/);
  assert.doesNotMatch(bodyHtml, /katex-error/);
});
