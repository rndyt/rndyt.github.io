# Obsidian → Astro → 三维档案

本分支参考 PersonelPage 的 `scripts/sync-obsidian-blog.mjs`，从相同的本机目录同步：

```sh
npm run sync:blog
npm run dev
```

默认来源为 `~/Nutstore Files/ObsidianVault/Blog`。也可指定来源：

```sh
npm run sync:blog -- "/path/to/ObsidianVault/Blog"
# 或设置 OBSIDIAN_BLOG_DIR
```

命令只读取原笔记，不修改 Obsidian。同步结果写入 `content/posts/obsidian/`，引用的附件写入
`public/post-assets/`；随后生成三维界面与 TXT 共用的数据。Astro 通过内容集合加载数据，
生成 `/blog/` 和 `/posts/<slug>/`，首页继续加载现有 Three.js 客户端。

## 写作与元数据

在 Blog 内写普通 `.md`，最少可以不写元数据：同步会从标题/文件名提取标题、从正文提取摘要，
并用文件创建日期补齐日期。建议明确填写日期和标题，避免跨设备文件时间变化：

```yaml
---
title: 一篇文章
date: 2026-09-21
description: 文章摘要
category: AI 实践
author: rndyt
tags: [LLM, Agent]
slug: my-article
preview: false
draft: false
---
```

- `draft: true` 或 `publish: false` 不发布；普通笔记默认发布。
- 未指定分类时使用第一层文件夹名；`Agent` 映射为 `AI 实践`，根目录默认 `工程文章`。
- `archiveId` 自动分配，`slug` 优先使用明确配置，其次英文文件名，中文文件名默认 `post-x-001` 这样的稳定地址。
- `content/posts/.obsidian-sync-manifest.json` 保存路径与编号/地址映射，必须提交。删除文章不回收编号。
- 已同步文章不可修改编号或 slug。若重命名/移动原笔记，需要同步修改清单 `entries` 的路径键以保留原身份，否则按新文章分配编号。
- 七篇历史示例存于 `reference/blog-samples/`，不参与构建，也不占用编号。正式文章从 X-001 起分配；已删除的正式文章编号仍保留，不重复使用。
- `preview` 默认为 false；站点仍保留原分支的 `noindex` 预览策略。

## 链接与附件

支持 `[[文章]]`、`[[文章#标题|别名]]`、`![[图片.png]]` 和普通 Markdown 相对链接/图片。
附件必须位于 Blog 内；只复制已发布文章引用的附件。隐藏文件、配置及符号链接不读取。
同名文件请使用相对路径。找不到或未发布的链接目标会降为文字并报告警告；代码示例保持原文。
笔记嵌入会变成文章链接，不展开整篇正文；图片尺寸别名忽略。提示块沿用普通引用显示。
MDX、Obsidian 插件语法、块引用 ID 不支持；不会执行笔记中的组件代码。

## 同步、校验与发布

```sh
npm run sync:blog
npm run check:sync
npm run build
npm run check:content
npm run check:viewport
```

同步先校验完整的候选内容，再替换输出。内容错误、重复编号/slug 或没有任何可发布文章时，
保留之前的发布内容。只删除清单记录的旧同步文件，其他手写文件保留。

开发服务器监听项目中的 Markdown 修改；Obsidian 原目录修改后需再运行 `npm run sync:blog`。
云端构建读取已经提交的同步结果，不依赖本机路径。Astro 的页面、脚本、样式和附件均纳入 PWA 版本缓存。

PersonelPage 的每分钟后台同步仍只服务它自己的发布副本。本次未修改其 LaunchAgent，
也未给此分支新增定时推送；同步后正常提交、推送本分支即可触发配置好的部署流程。
