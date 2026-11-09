import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

async function worker(network) {
  const listeners = {};
  const article = 'https://example.test/posts/post-x-001/index.html';
  const stored = new Map([[article, new Response('old article')], ['https://example.test/index.html', new Response('old app')]]);
  const cache = {
    match: async key => stored.get(key)?.clone(),
    put: async (key, response) => stored.set(key, response.clone()),
  };
  const source = (await readFile(new URL('./pwa-worker.js', import.meta.url), 'utf8'))
    .replace('__CACHE_VERSION__', '"test"')
    .replace('__PRECACHE_FILES__', '["index.html","posts/post-x-001/index.html"]');
  runInNewContext(source, {
    URL, Request, self: { registration: { scope: 'https://example.test/' }, location: { origin: 'https://example.test' }, addEventListener: (name, fn) => { listeners[name] = fn; } },
    caches: { open: async () => cache }, fetch: network,
  });
  return {
    stored, article,
    async visit(path) {
      let response;
      const pending = [];
      listeners.fetch({ request: new Request('https://example.test' + path), respondWith: value => { response = value; }, waitUntil: value => pending.push(value) });
      const result = await response;
      await Promise.all(pending);
      return result;
    },
  };
}

test('online reader bypasses the old offline article and saves the latest body', async () => {
  let request;
  const w = await worker(async value => { request = value; return new Response('new article'); });
  assert.equal(await (await w.visit('/posts/post-x-001/')).text(), 'new article');
  assert.equal(request.cache, 'no-cache');
  assert.equal(await w.stored.get(w.article).text(), 'new article');
});
test('offline reader retains the cached article', async () => {
  const w = await worker(async () => { throw Error('offline'); });
  assert.equal(await (await w.visit('/posts/post-x-001/')).text(), 'old article');
});
test('removed articles return the online 404 rather than stale content', async () => {
  const w = await worker(async () => new Response('removed', { status: 404 }));
  assert.equal((await w.visit('/posts/post-x-001/')).status, 404);
});
test('application shell keeps its existing release cache policy', async () => {
  const w = await worker(async () => { throw Error('app must stay cached'); });
  assert.equal(await (await w.visit('/index.html')).text(), 'old app');
});
