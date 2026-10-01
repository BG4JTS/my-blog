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

展示仓库简介、语言、Star 数、Fork 数、许可证，数据由浏览器直接请求 `api.github.com`。

## 二、GitHub 个人主页卡片

```markdown
::github-user{user="BG4JTS"}
```

::github-user{user="BG4JTS"}

展示头像、昵称、简介、公开仓库数、关注者与关注中数量；`user` 填用户名，不要填 `owner/repo`，否则指令会静默失效。

## 三、B站视频卡片

```markdown
::bilibili{bvid="BV1GJ411x7h7"}
```

::bilibili{bvid="BV1GJ411x7h7"}

展示视频标题、UP 主、简介，以及**播放、点赞、投币、收藏**与时长。`bvid` 必须是 `BV` 开头的 12 位视频号。

## 四、B站个人主页卡片

```markdown
::bilibili-user{uid="2"}
```

::bilibili-user{uid="2"}

展示头像、昵称、签名，以及**粉丝数、获赞数、投稿数、等级**。`uid` 是数字 UID（个人空间地址 `space.bilibili.com/<uid>` 里的那串数字）。

## 五、实现说明（为什么两种取数方式不一样）

- **GitHub 卡片**：`api.github.com` 返回 `Access-Control-Allow-Origin: *`，浏览器可以直接 `fetch`，所以是实时数据。
- **B站视频卡片**：`api.bilibili.com` 不返回 CORS 头，而且一旦请求带上外部 `Origin` 就直接 403；但 `view` 接口接受外部 `Referer`，因此改用 JSONP（`<script>` 请求不带 `Origin`）实现，同样是实时数据。
- **B站个人主页卡片**：`x/web-interface/card` 对非 B站 `Referer` 一律 403，浏览器无法伪造 Referer，做不到实时。因此改为**构建时抓取**：`scripts/fetch-bilibili-users.mjs` 会扫描文章里的 `::bilibili-user{uid="..."}`，用 Node 带 B站 Referer 请求，把结果写进 `src/data/bilibili-users.json`，组件再服务端渲染。

更新 B站个人卡片数据只需：

```shellsession
pnpm fetch-bili
```

`pnpm build` 之前会自动执行这一步；抓取失败时会保留上一次的缓存数据，不会让构建挂掉。若缓存里没有对应 UID，卡片会显示为「暂无抓取数据」并仍然可点击跳转。

:::note
改动 `src/plugins/` 下的卡片组件后，需要先删除 `node_modules/.astro`（Astro 5 的内容渲染缓存）再构建，否则页面会继续用旧组件的 HTML。
:::

:::note
GitHub 卡片在浏览器端受 `api.github.com` 未认证限流（60 次/小时/IP）影响；B站卡片在极端网络下会停在失败态，但标题与链接始终可用。
:::
