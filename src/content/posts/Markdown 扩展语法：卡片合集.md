---
title: Markdown 扩展语法：卡片合集
published: 2026-09-07
description: 'Fuwari 卡片指令合集与用法：GitHub 仓库、GitHub 个人主页、B站视频、B站个人主页。'
image: ''
tags: [Markdown, Fuwari, 博客搭建]
category: '技术分享'
draft: false
slug: card-showcase
---

这篇文章用来演示本站支持的四种「链接卡片」指令，写法都是**叶子指令**（后面不能跟内容），复制过去改掉里面的参数就能用。

:::tip
下面演示里的 GitHub 账号是本站的，B站账号与视频用的是**示例数据**，替换成你自己的即可。
:::

## 一、GitHub 仓库卡片

```markdown
::github{repo="bg4jts/my-blog"}
```

::github{repo="bg4jts/my-blog"}

展示仓库简介、语言、Star 数、Fork 数、许可证；数据经 `api.bg4jts.cn` 代理获取，代理不可用时回落到 `api.github.com`。

## 二、GitHub 个人主页卡片

```markdown
::github-user{user="BG4JTS"}
```

::github-user{user="BG4JTS"}

展示头像、昵称、简介、公开仓库数、关注者与关注中数量；`user` 填用户名，不要填 `owner/repo`，否则指令会静默失效。

## 三、B站视频卡片

```markdown
::bilibili{bvid="BV1daYNzrEQN"}
```

::bilibili{bvid="BV1daYNzrEQN"}

展示视频标题、UP 主、简介，以及**播放、点赞、投币、收藏**与时长。`bvid` 必须是 `BV` 开头的 12 位视频号。

## 四、B站个人主页卡片

```markdown
::bilibili-user{uid="2"}
```

::bilibili-user{uid="2"}

展示头像、昵称、签名，以及**粉丝数、获赞数、投稿数、等级**。`uid` 是数字 UID（个人空间地址 `space.bilibili.com/<uid>` 里的那串数字）。

## 五、实现说明（为什么需要 api.bg4jts.cn）

四张卡片都优先请求自建代理 **https://api.bg4jts.cn**（Cloudflare Worker，源码见仓库 `workers/api`），代理不可用时才回落到直连，因此 Worker 没部署时页面也不会坏。

| 上游 | 直接浏览器请求的问题 | 代理如何解决 |
| --- | --- | --- |
| `api.bilibili.com` | 无 CORS 头；带外部 `Origin` 直接 403；`card` 接口对非 B站 `Referer` 也 403 | Worker 设置合法 `User-Agent` + `Referer`，再补上 CORS 头 |
| `api.github.com` | 可用，但未认证限流 60 次/小时/IP | Worker 端可挂 `GITHUB_TOKEN`，提升到 5000 次/小时 |

代理统一返回 `{ ok, route, data }`，`data` 已经是上游 `data` 字段的直出。目前开放的路由：

```
GET https://api.bg4jts.cn/bilibili/video?bvid=BV...
GET https://api.bg4jts.cn/bilibili/user?mid=123456
GET https://api.bg4jts.cn/github/user?user=BG4JTS
GET https://api.bg4jts.cn/github/repo?repo=bg4jts/my-blog
GET https://api.bg4jts.cn/health          # 路由索引，部署自检
```

新增一个 API 只需在 `workers/api/src/index.js` 的 `ROUTES` 里加一条（参数正则 + 上游 URL + 缓存 TTL）。上游主机是硬编码白名单，所以它不是开放代理。

**关于 B站个人卡片的构建时缓存**：`x/web-interface/card` 对非 B站 `Referer` 一律 403，浏览器无法伪造，所以在代理部署之前它是靠构建时抓取（`scripts/fetch-bilibili-users.mjs` → `src/data/bilibili-users.json`）来出数据的。代理部署后，卡片会服务端先用缓存值渲染，再用代理静默刷新一次——既保证无 JS 也能看到内容，也保证数据尽量新。

:::note
改动 `src/plugins/` 下的卡片组件后，需要先删除 `node_modules/.astro`（Astro 5 的内容渲染缓存）再构建，否则页面会继续用旧组件的 HTML。
:::

:::note
GitHub 卡片在浏览器端受 `api.github.com` 未认证限流（60 次/小时/IP）影响；B站卡片在极端网络下会停在失败态，但标题与链接始终可用。
:::
