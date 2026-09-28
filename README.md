# rndyt · 三维档案博客

直接基于 [RhineLabUI](https://github.com/LBEILC/RhineLabUI) 改造的个人博客。
保留原版的启动动画、玻璃档案阵列、自由拖动与惯性、波浪、镜头、抽取与解密、
音效和 360° 模型查看器，将档案内容替换成工程文章、AI 实践与项目记录。

## 运行

```sh
npm ci
npm run dev
```

按终端输出的本地地址访问。首页继续提供完整开场，右下按钮可跳过；
`/?scene=archive` 直接进入阵列。每篇文章的 `/?post=slug` 链接会直接定位并打开档案。

- 左右切换分类，上下切换文章，点击卡片或按 Enter 读取。
- 原搜索窗口支持标题、标签、作者、摘要/正文关键词和分类筛选。
- 详情提供 Markdown 正文、目录、相关文章、收藏、复制链接和 TXT 导出。
- 三维档案阵列页面底部的 2D 开关进入文章目录；文章目录通过“返回档案”回到三维阵列；`/posts/slug/` 提供独立阅读页，
  不依赖 WebGL、JavaScript 或音频加载。
- 手机上的正文独立滚动。减少动态效果继续遵循系统偏好。

## 写文章

文章现在来自 Obsidian 的 `~/Nutstore Files/ObsidianVault/Blog`，由 Astro 管理内容集合和静态页面。
先执行 `npm run sync:blog`，再启动开发或构建。完整说明见 [Obsidian 同步](docs/OBSIDIAN_SYNC.md)。
请在 Obsidian 修改原文；`content/posts/obsidian/` 为同步结果，不要手工改写。
历史七篇示例移至 `reference/blog-samples/`，不再发布。全部页面继续 `noindex`。

也可以在 `content/posts/` 的其他目录手工维护 Markdown，格式如下：

```yaml
---
archiveId: X-001
slug: your-next-post
category: 工程文章
author: rndyt
title: 文章标题
description: 用一句话说明文章讨论的问题。
date: 2026-09-10
tags: [Java, backend]
preview: true
kind: article
---
```

元数据后直接写 Markdown 正文，支持标题、段落、列表、引用、链接、图片、表格和代码块。
不要改用原始 HTML 组件；构建会清理危险标签和链接。本站部署在域名根路径。

- `archiveId` 必须唯一且稳定，格式 `X-001`；删除文章后不要把旧 ID 分配给另一篇文章。
- `slug` 是独立 URL 的稳定部分，小写英文、数字和短横线；不填写则取 Markdown 文件名。
- `category` 会自动成为一列，不再要求五类或每类八篇；每类至少有一篇文章。
- 分类默认按工程文章、AI 实践、项目记录排序，其他分类自动追加。
- `updated` 可选。更改日期或排序不影响收藏所使用的稳定 ID。
- `preview` 默认为 true。换成真实内容后可逐篇关闭示例提示；搜索引擎开放需单独调整站点预览策略。
- 开发服务器监听 Markdown 增删改并重新生成；构建前也会自动生成。

`content/archives.json` 与 `public/archives/` 是生成结果，请勿直接编辑。
Astro 页面源文件位于 `src/pages/`，文章目录和阅读页在构建时生成到 `dist/`。
原游戏档案数据保存在 `reference/original-archives.json`，不再作为博客内容发布。

## 验证与构建

```sh
npm run sync:blog
npm run check:sync
npm run build
npm run check:content
npm run check:viewport
```

构建输出为 `dist/`，包括三维入口、当前已发布文章的独立阅读页、文章目录与离线缓存。
内容测试覆盖不等长分类的循环映射、稳定编号、Markdown 清理、生成页面和 TXT 一致性。

本次改造使用 `codex/rhine-blog` 分支。Node.js 要求 22.12 或更新版本。
验证记录见 [verification/BLOG.md](verification/BLOG.md)。

## 来源与许可

原项目由 LBEILC 制作，代码采用 MIT 许可；保留 [LICENSE](LICENSE) 与原作者署名。
模型、视觉、原作来源和 MiSans 字体说明见 [上游说明](UPSTREAM-README.md)
以及 [设计记录](DESIGN.md)。博客设置中保留上游和字体许可入口。

此博客改造不代表《明日方舟》、鹰角网络或原项目作者的官方博客。
