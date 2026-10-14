import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const branch = 'codex/rhine-blog';
const paths = ['content/posts/obsidian', 'content/posts/.obsidian-sync-manifest.json', 'content/archives.json', 'public/archives', 'public/post-assets'];
const run = (command, args, capture = false) => execFileSync(command, args, {
  cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
});
const git = (...args) => run('git', args, true).trim();
const allowed = path => paths.some(root => path === root || path.startsWith(root + '/'));
const names = output => output.split('\0').filter(Boolean);

try {
  if (git('branch', '--show-current') !== branch) throw Error(`请先切换到 ${branch}。`);
  const remote = git('remote', 'get-url', '--push', 'fork');
  if (!['https://github.com/rndyt/rndyt.github.io.git', 'git@github.com:rndyt/rndyt.github.io.git'].includes(remote)) throw Error('fork 推送地址与博客仓库不符。');
  if (git('diff', '--cached', '--name-only')) throw Error('暂存区已有改动，请先处理，避免混入发布。');
  const changed = [...names(run('git', ['diff', '--name-only', '-z', 'HEAD'], true)), ...names(run('git', ['ls-files', '--others', '--exclude-standard', '-z'], true))];
  if (changed.some(path => !allowed(path))) throw Error('工作区存在非博客同步改动，请先提交或另行保存后重试。');
  run('git', ['fetch', 'fork', branch]);
  const upstream = `refs/remotes/fork/${branch}`;
  if (git('rev-list', '--count', `HEAD..${upstream}`) !== '0') throw Error('远程有本地尚未合入的提交，请先同步分支。');
  const pending = names(run('git', ['diff', '--name-only', '-z', `${upstream}...HEAD`], true));
  if (pending.some(path => !allowed(path))) throw Error('存在未推送的非博客改动，请先单独处理。');
  run('npm', ['run', 'sync:blog', ... (process.argv[2] ? ['--', process.argv[2]] : [])]);
  const status = git('status', '--porcelain', '--', ...paths);
  if (status) {
    for (const task of ['check:sync', 'build', 'check:content', 'check:viewport']) run('npm', ['run', task]);
    // Add only existing or tracked paths; optional asset folders may not exist yet.
    const files = [...new Set([...names(run('git', ['diff', '--name-only', '-z', 'HEAD'], true)), ...names(run('git', ['ls-files', '--others', '--exclude-standard', '-z'], true))])];
    if (files.some(path => !allowed(path))) throw Error('校验期间出现非同步改动，已停止提交。');
    run('git', ['add', '--', ...files]);
    run('git', ['commit', '-m', 'Sync Obsidian blog content']);
  }
  if (git('rev-list', '--count', `${upstream}..HEAD`) !== '0') {
    run('git', ['push', 'fork', `HEAD:refs/heads/${branch}`]);
    console.log('已推送，GitHub Pages 将自动构建发布。');
  } else {
    console.log('没有待发布的内容变化。');
  }
  console.log('部署状态：https://github.com/rndyt/rndyt.github.io/actions/workflows/deploy-pages.yml');
} catch (error) {
  console.error(error.message);
  console.error('发布未完成；修复问题后重新运行 npm run publish:blog。已同步的内容和已提交的记录会保留。');
  process.exitCode = 1;
}
