---
title: 本站的 Markdown 卡片：GitHub 与 B 站
published: 2026-09-07
description: '本站文章支持的四种链接卡片：GitHub 仓库、GitHub 个人主页、B 站视频、B 站 UP 主；附数据来源与降级说明。'
image: ''
tags: [Markdown, 博客搭建]
category: '技术分享'
draft: false
slug: card-showcase
---

文章里直接贴裸链接总有点干巴。所以本站支持几种「卡片」：给一个仓库、一个主页、一个视频号，页面自己把标题、简介和数据取回来铺开。这一页把它们一次摆全，顺便交代数据是怎么来的。

## GitHub 仓库

丢一个仓库地址进去，出来的是简介、主要语言、Star / Fork 数和许可证：

::github{repo="bg4jts/my-blog"}

## GitHub 个人主页

同类还有个人主页卡片，展示头像、昵称、简介，以及公开仓库数、关注者与关注中：

::github-user{user="BG4JTS"}

## B 站视频

分享视频时，卡片会带出封面、UP 主、**标题与简介**，底下是播放、点赞、投币、收藏与时长：

::bilibili{bvid="BV1GJ411x7h7"}

> 视频是随手挑的示例，点开前请做好心理准备 🙂

## B 站 UP 主

UP 主卡片展示头像、昵称、签名，以及粉丝数、获赞数、投稿数与等级：

::bilibili-user{uid="2"}

## 数据是怎么来的

四张卡片都在页面加载后向 **api.bg4jts.cn** 取数——那是一个自建的 Cloudflare Worker 代理，负责补上跨域头、带上 B 站要求的请求身份，并把结果按分钟级缓存在边缘节点。

有两个现实限制值得记下来：

- **B 站对数据中心 IP 有风控**：代理从 Cloudflare 访问 `api.bilibili.com` 会被判 `-412`。于是视频卡会退回到「由你的浏览器直接向 B 站请求」，UP 主卡片则使用构建时抓好的快照——两种路径都不影响正常浏览。
- **GitHub 未认证接口限流**为 60 次/小时/IP；代理侧挂了服务端令牌，可把额度提上去。

取不到数据时，卡片会退化成一条普通链接，不会甩出一个报错框。

## 用法

如果你也在维护 Fuwari 或类似的 Astro 博客，这些卡片就是几种 Markdown 叶子指令（后面不能跟内容）：

```markdown
::github{repo="owner/repo"}
::github-user{user="用户名"}
::bilibili{bvid="BV1xxxxxxxxx"}
::bilibili-user{uid="数字UID"}
```
