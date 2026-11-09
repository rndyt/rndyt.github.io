#!/bin/zsh

set -eu

repo_dir="${OBSIDIAN_PUBLISH_REPO:-${HOME:?}/Library/Application Support/rndyt-blog-publisher/rhine-site}"
lock_dir="/tmp/rndyt-rhine-blog-sync.lock"

if ! mkdir "$lock_dir" 2>/dev/null; then
  existing_pid=""
  [[ -r "$lock_dir/pid" ]] && read -r existing_pid < "$lock_dir/pid"
  if [[ "$existing_pid" == <-> ]] && kill -0 "$existing_pid" 2>/dev/null; then
    exit 0
  fi
  rm -f "$lock_dir/pid"
  rmdir "$lock_dir" 2>/dev/null || exit 1
  mkdir "$lock_dir"
fi
print -r -- "$$" > "$lock_dir/pid"
cleanup() {
  rm -f "$lock_dir/pid"
  rmdir "$lock_dir" 2>/dev/null
}
trap cleanup EXIT
trap 'exit 143' HUP INT TERM

cd "$repo_dir"
[[ "$(git branch --show-current)" == 'codex/rhine-blog' ]] || {
  print -u2 '未发布：后台副本必须位于 codex/rhine-blog 分支。'
  exit 1
}
export GIT_TERMINAL_PROMPT=0
git fetch fork codex/rhine-blog
# Failed validation may leave content changes for the publisher to retry.
# Only fast-forward a clean checkout; publish:blog checks dirty paths itself.
if [[ -z "$(git status --porcelain)" ]]; then
  git merge --ff-only fork/codex/rhine-blog
fi
if [[ ! -x node_modules/.bin/astro ]] || ! cmp -s package-lock.json node_modules/.publisher-package-lock.json; then
  npm ci
  cp package-lock.json node_modules/.publisher-package-lock.json
fi
npm run publish:blog
