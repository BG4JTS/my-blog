# bg4jts API proxy（Cloudflare Worker）

统一出口：**https://api.bg4jts.cn**。博客前端所有需要「跨域 / 伪装 Referer / 藏 token」的第三方 API 都走这里。

## 为什么需要

| 上游 | 直接浏览器请求的问题 | Worker 如何解决 |
| --- | --- | --- |
| `api.bilibili.com` | 无 CORS 头；带外部 `Origin` 直接 403；`card` 接口对非 B站 `Referer` 也 403 | Worker 设置合法 `User-Agent` + `Referer`，再补上 CORS 头 |
| `api.github.com` | 可用，但未认证限流 60 次/小时/IP | Worker 端持有 `GITHUB_TOKEN`，限流提升到 5000 次/小时 |

同时 Worker 用 `cf.cacheTtl` 做边缘缓存，访客越多越不容易触发上游限流。

## 接口契约

```
GET https://api.bg4jts.cn/<route>?<params>

200  { "ok": true,  "route": "bilibili/video", "cached": false, "data": { ... } }
400  { "ok": false, "route": "...", "error": "invalid_param", "message": "..." }
404  { "ok": false, "route": "...", "error": "unknown_route", "message": "..." }
502  { "ok": false, "route": "...", "error": "upstream_error", "upstreamStatus": 403, "message": "..." }
```

`data` 是上游 `data` 字段的直出（B站的 `{code,message,data}` 信封已被拆掉），因此前端不需要了解各家上游的差异。

## 已集成路由

| 路由 | 参数 | TTL | 上游 |
| --- | --- | --- | --- |
| `GET /bilibili/video` | `bvid=BV...`（12 位） | 600s | `x/web-interface/view` |
| `GET /bilibili/user` | `mid=数字 UID` | 1800s | `x/web-interface/card` |
| `GET /github/user` | `user=用户名` | 1800s | `users/{user}` |
| `GET /github/repo` | `repo=owner/name` | 1800s | `repos/{repo}` |
| `GET /` 或 `/health` | — | 不缓存 | 返回路由索引（部署自检用） |

示例：

```shellsession
curl "https://api.bg4jts.cn/bilibili/video?bvid=BV1GJ411x7h7"
curl "https://api.bg4jts.cn/github/user?user=BG4JTS"
```

## 部署

```shellsession
cd workers/api
npx wrangler login                     # 只需一次
npx wrangler secret put GITHUB_TOKEN   # 可选，提升 GitHub 限流
npx wrangler deploy
```

`wrangler.toml` 里 `custom_domain = true` 会自动把 `api.bg4jts.cn` 绑到 Worker（前提：`bg4jts.cn` 的 DNS 在这个 Cloudflare 账号里）。部署后访问 `https://api.bg4jts.cn/health` 应返回路由索引。

本地调试：

```shellsession
cd workers/api
npx wrangler dev          # 默认 http://localhost:8787
```

## 再加一个 API

只改 `src/index.js` 的 `ROUTES` 一处：

```js
"zhihu/question": {
  docs: "知乎问题信息",
  upstream: (q) => `https://www.zhihu.com/api/v4/questions/${encodeURIComponent(q.id)}`,
  validate: { id: /^\d{1,20}$/ },
  required: ["id"],
  ttl: 1800,
  referer: "https://www.zhihu.com/",
},
```

只有路由表里的地址能出网，参数必须匹配白名单正则，**因此它不是开放代理**，不会被拿去做任意转发的肉鸡。

## 安全说明

- 只允许 `GET/HEAD/OPTIONS`；上游主机硬编码。
- 上游返回 HTML（反爬页）一律转成 `502 + JSON`，不会把上游页面透给访客。
- `GITHUB_TOKEN` 只以 secret 形式存在 Worker 环境，不会进前端产物。
- 需要收紧来源时把 `ALLOWED_ORIGINS` 改成具体域名列表。
- 建议在 Cloudflare 控制台给该 Worker 加 Rate limiting 规则，防止被刷。
