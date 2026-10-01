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

## 鉴权与防滥用

三层，按强度递增：

| 层 | 作用 | 开启方式 |
| --- | --- | --- |
| Origin 白名单 | 只允许博客域名在浏览器里读取数据（外部网站拿不到响应）；curl 等服务端客户端不受限——Origin 只是浏览器作用域，不是鉴权 | 改 `ALLOWED_ORIGINS`（支持 `*.vercel.app` 后缀匹配） |
| 按 IP 限流 | 固定窗口计数（默认 120 次/分钟/IP），超限返回 `429 rate_limited` + `Retry-After: 60`；按机房各自计数，跨机房上限是近似值 | 改 `RATE_LIMIT_PER_MIN`（`0` = 关闭） |
| 站点令牌 | 开启后数据路由必须带 `?k=<token>` 或 `X-Api-Key`，否则 401 / 403 | `npx wrangler secret put SITE_TOKEN`，并把博客构建环境变量 `PUBLIC_API_TOKEN` 设成同一个值 |

令牌必须随页面发到浏览器（否则前端读不到数据），**所以它是防爬门槛 + 轮换开关，不是秘密**。将来需要真正保密的写接口（例如把抓取结果推进 KV）应放在 Cloudflare Access 之后，另用 `ADMIN_TOKEN` 校验。

已实测（本地 `wrangler dev` + 线上）：外部 Origin → `403 origin_not_allowed`；缺令牌 → `401 missing_token`；错令牌 → `403 invalid_token`；`X-Api-Key` 与 `?k=` 等价；连续超限 → `429 rate_limited`；`/health` 始终公开且不计数。

## 已知限制：B站路由会被风控

实测：Cloudflare Workers 的出口 IP 访问 `api.bilibili.com` 返回 **HTTP 412 / code -412 `request was banned`**（B站按来源 IP 风控；同一请求从国内家宽直连是 200）。因此：

- `bilibili/video`、`bilibili/user` 在这台 Worker 上通常拿不到数据，返回 `502 {"error":"upstream_error","upstreamCode":-412}`；
- GitHub 两条路由不受影响（实测 200）；
- 博客侧已对 B站 做容错：视频卡回落到客户端 JSONP（访客自己的 IP，可用），个人卡保留构建时快照（`pnpm fetch-bili`，走本机家宽，可用）。

已内置三种缓解手段（都无效时仍有回落兜底）：

1. **浏览器级请求头 + buvid3/buvid4 设备 cookie**：先向 `x/frontend/finger/spi` 取匿名设备号（无需登录），再把完整浏览器头（`Origin` / `Sec-Fetch-*` / `Accept-Language`）一起发出去。这是社区常用的 -412 解法。
2. **Smart Placement**（`wrangler.toml` 里的 `[placement] mode = "smart"`）：让 Worker 尽量在离上游更近的机房执行，出口 IP 可能不再落在美国机房。
3. **`BILI_PROXY_BASE` 逃生通道**：设置后 `bilibili/*` 改为请求该代理（约定 `?url=<编码后的目标地址>`），可指向你自己的国内小机器，彻底不依赖 CF 出口。

仍不通时的确定性方案：把 B站数据改成「本地抓取 → 推送到 Worker KV」，CF 完全不直连 B站。

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
