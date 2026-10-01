var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
var UPSTREAM_TIMEOUT_MS = 8e3;
var MAX_BODY_BYTES = 512 * 1024;
var ROUTES = {
  "bilibili/video": {
    docs: "B\u7AD9\u89C6\u9891\u4FE1\u606F\uFF08\u6807\u9898/\u7B80\u4ECB/UP\u4E3B/\u64AD\u653E/\u70B9\u8D5E/\u6295\u5E01/\u6536\u85CF/\u65F6\u957F\uFF09",
    upstream: /* @__PURE__ */ __name((q) => `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(q.bvid)}`, "upstream"),
    validate: { bvid: /^BV[0-9A-Za-z]{10}$/ },
    required: ["bvid"],
    ttl: 600,
    referer: "https://www.bilibili.com/",
    headers: bilibiliHeaders
  },
  "bilibili/user": {
    docs: "B\u7AD9\u7528\u6237\u4FE1\u606F\uFF08\u6635\u79F0/\u5934\u50CF/\u7B7E\u540D/\u7C89\u4E1D/\u83B7\u8D5E/\u6295\u7A3F/\u7B49\u7EA7\uFF09",
    upstream: /* @__PURE__ */ __name((q) => `https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(q.mid)}&photo=false`, "upstream"),
    validate: { mid: /^\d{1,12}$/ },
    required: ["mid"],
    ttl: 1800,
    referer: "https://www.bilibili.com/",
    headers: bilibiliHeaders
  },
  "github/user": {
    docs: "GitHub \u7528\u6237\u4FE1\u606F\uFF08\u6635\u79F0/\u7B80\u4ECB/\u4ED3\u5E93\u6570/\u5173\u6CE8\u8005\uFF09",
    // Values are regex-validated below, so they are safe to interpolate raw.
    upstream: /* @__PURE__ */ __name((q) => `https://api.github.com/users/${q.user}`, "upstream"),
    validate: { user: /^[A-Za-z0-9-]{1,39}$/ },
    required: ["user"],
    ttl: 1800,
    headers: githubHeaders
  },
  "github/repo": {
    docs: "GitHub \u4ED3\u5E93\u4FE1\u606F\uFF08\u7B80\u4ECB/\u8BED\u8A00/Star/Fork/\u8BB8\u53EF\u8BC1\uFF09",
    // Must stay raw: encoding the "/" would turn the path into owner%2Fname.
    upstream: /* @__PURE__ */ __name((q) => `https://api.github.com/repos/${q.repo}`, "upstream"),
    validate: { repo: /^[A-Za-z0-9._-]{1,39}\/[A-Za-z0-9._-]{1,100}$/ },
    required: ["repo"],
    ttl: 1800,
    headers: githubHeaders
  }
};
function githubHeaders(env) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return headers;
}
__name(githubHeaders, "githubHeaders");
var BILIBILI_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Origin: "https://www.bilibili.com",
  Referer: "https://www.bilibili.com/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site"
};
var buvidCache = { cookie: "", expiresAt: 0 };
async function getBuvidCookie() {
  if (buvidCache.cookie && Date.now() < buvidCache.expiresAt) {
    return buvidCache.cookie;
  }
  try {
    const res = await fetch("https://api.bilibili.com/x/frontend/finger/spi", {
      headers: { "User-Agent": USER_AGENT, ...BILIBILI_HEADERS },
      cf: { cacheTtl: 1800, cacheEverything: true }
    });
    const json2 = await res.json();
    const buvid3 = json2?.data?.b_3;
    const buvid4 = json2?.data?.b_4;
    if (!buvid3) return "";
    const parts = [`buvid3=${buvid3}`];
    if (buvid4) parts.push(`buvid4=${buvid4}`);
    parts.push(`b_nut=${Math.floor(Date.now() / 1e3)}`);
    buvidCache.cookie = parts.join("; ");
    buvidCache.expiresAt = Date.now() + 6 * 3600 * 1e3;
    return buvidCache.cookie;
  } catch {
    return "";
  }
}
__name(getBuvidCookie, "getBuvidCookie");
async function bilibiliHeaders() {
  const cookie = await getBuvidCookie();
  return cookie ? { ...BILIBILI_HEADERS, Cookie: cookie } : BILIBILI_HEADERS;
}
__name(bilibiliHeaders, "bilibiliHeaders");
function corsHeaders(request, env) {
  const allow = (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS).trim();
  const origin = request.headers.get("Origin") || "";
  const allowed = allow === "*" ? "*" : allow.split(",").map((value) => value.trim()).filter(Boolean).includes(origin) ? origin : allow.split(",")[0].trim();
  const headers = {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "X-Robots-Tag": "noindex"
  };
  if (allowed !== "*") headers["Access-Control-Allow-Credentials"] = "false";
  return headers;
}
__name(corsHeaders, "corsHeaders");
function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}
__name(json, "json");
var DEFAULT_ALLOWED_ORIGINS = "https://bg4jts.cn,https://www.bg4jts.cn,http://localhost:4321,http://127.0.0.1:4321";
var DEFAULT_RATE_LIMIT_PER_MIN = 120;
function allowedOriginList(env) {
  return (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS).split(",").map((value) => value.trim()).filter(Boolean);
}
__name(allowedOriginList, "allowedOriginList");
function isOriginAllowed(origin, env) {
  if (!origin) return true;
  const list = allowedOriginList(env);
  if (list.includes("*")) return true;
  return list.some(
    (pattern) => pattern.startsWith("*.") ? origin.endsWith(pattern.slice(1)) : pattern === origin
  );
}
__name(isOriginAllowed, "isOriginAllowed");
async function isRateLimited(request, env) {
  const limit = Number(env.RATE_LIMIT_PER_MIN ?? DEFAULT_RATE_LIMIT_PER_MIN);
  if (!Number.isFinite(limit) || limit <= 0) return false;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const window = Math.floor(Date.now() / 6e4);
  const key = new Request(
    `https://ratelimit.bg4jts.invalid/${encodeURIComponent(ip)}/${window}`
  );
  const cache = caches.default;
  const hit = await cache.match(key);
  const used = hit ? Number(await hit.text()) || 0 : 0;
  if (used >= limit) return true;
  await cache.put(
    key,
    new Response(String(used + 1), {
      headers: { "Cache-Control": "max-age=60" }
    })
  );
  return false;
}
__name(isRateLimited, "isRateLimited");
function siteTokenIssue(request, url, env) {
  const expected = env.SITE_TOKEN;
  if (!expected) return null;
  const provided = url.searchParams.get("k") || request.headers.get("X-Api-Key") || "";
  if (!provided) {
    return {
      status: 401,
      error: "missing_token",
      message: "Provide ?k=<token> or the X-Api-Key header."
    };
  }
  if (provided !== expected) {
    return {
      status: 403,
      error: "invalid_token",
      message: "The provided token is not valid."
    };
  }
  return null;
}
__name(siteTokenIssue, "siteTokenIssue");
function routeIndex() {
  return Object.fromEntries(
    Object.entries(ROUTES).map(([name, route]) => [
      name,
      {
        docs: route.docs || "",
        params: Object.keys(route.validate),
        required: route.required,
        ttl: route.ttl
      }
    ])
  );
}
__name(routeIndex, "routeIndex");
var src_default = {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/^\/+|\/+$/g, "");
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json(
        {
          ok: false,
          error: "method_not_allowed",
          message: "Only GET/HEAD/OPTIONS are supported."
        },
        405,
        cors
      );
    }
    const origin = request.headers.get("Origin") || "";
    if (!isOriginAllowed(origin, env)) {
      return json(
        {
          ok: false,
          error: "origin_not_allowed",
          message: `Origin "${origin}" is not allowed to call this API.`
        },
        403,
        { "Cache-Control": "no-store", Vary: "Origin" }
      );
    }
    if (pathname === "" || pathname === "health") {
      return json(
        {
          ok: true,
          service: "bg4jts-api",
          routes: routeIndex()
        },
        200,
        { ...cors, "Cache-Control": "no-store" }
      );
    }
    const route = ROUTES[pathname];
    if (!route) {
      return json(
        {
          ok: false,
          route: pathname,
          error: "unknown_route",
          message: `Unknown route. Available: ${Object.keys(ROUTES).join(", ")}`
        },
        404,
        { ...cors, "Cache-Control": "no-store" }
      );
    }
    if (await isRateLimited(request, env)) {
      return json(
        {
          ok: false,
          route: pathname,
          error: "rate_limited",
          message: "Too many requests. Try again in a minute."
        },
        429,
        { ...cors, "Cache-Control": "no-store", "Retry-After": "60" }
      );
    }
    const tokenIssue = siteTokenIssue(request, url, env);
    if (tokenIssue) {
      return json(
        {
          ok: false,
          route: pathname,
          error: tokenIssue.error,
          message: tokenIssue.message
        },
        tokenIssue.status,
        { ...cors, "Cache-Control": "no-store" }
      );
    }
    const params = {};
    for (const [name, pattern] of Object.entries(route.validate)) {
      const value = url.searchParams.get(name);
      if (value === null) continue;
      if (!pattern.test(value)) {
        return json(
          {
            ok: false,
            route: pathname,
            error: "invalid_param",
            message: `Parameter "${name}" did not match ${pattern}`
          },
          400,
          { ...cors, "Cache-Control": "no-store" }
        );
      }
      params[name] = value;
    }
    for (const name of route.required) {
      if (!params[name]) {
        return json(
          {
            ok: false,
            route: pathname,
            error: "missing_param",
            message: `Missing required parameter "${name}".`
          },
          400,
          { ...cors, "Cache-Control": "no-store" }
        );
      }
    }
    const directUrl = route.upstream(params);
    const upstreamUrl = env.BILI_PROXY_BASE && pathname.startsWith("bilibili/") ? `${env.BILI_PROXY_BASE.replace(/\/$/, "")}?url=${encodeURIComponent(directUrl)}` : directUrl;
    const upstreamHeaders = {
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
    };
    if (route.referer) upstreamHeaders.Referer = route.referer;
    if (route.headers) Object.assign(upstreamHeaders, await route.headers(env));
    let upstream;
    try {
      upstream = await fetch(upstreamUrl, {
        method: "GET",
        headers: upstreamHeaders,
        redirect: "follow",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cf: { cacheTtl: route.ttl, cacheEverything: true }
      });
    } catch (error) {
      return json(
        {
          ok: false,
          route: pathname,
          error: "upstream_unreachable",
          message: String(error?.message ?? error)
        },
        504,
        { ...cors, "Cache-Control": "no-store" }
      );
    }
    const text = (await upstream.text()).slice(0, MAX_BODY_BYTES);
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      return json(
        {
          ok: false,
          route: pathname,
          error: "upstream_error",
          upstreamStatus: upstream.status,
          message: "Upstream did not return JSON (likely rate limiting or anti-bot)."
        },
        502,
        { ...cors, "Cache-Control": "no-store" }
      );
    }
    if (typeof payload.code === "number" && payload.code !== 0) {
      return json(
        {
          ok: false,
          route: pathname,
          error: "upstream_error",
          upstreamStatus: upstream.status,
          upstreamCode: payload.code,
          message: payload.message || "Upstream returned a non-zero code."
        },
        502,
        { ...cors, "Cache-Control": "no-store" }
      );
    }
    if (!upstream.ok) {
      return json(
        {
          ok: false,
          route: pathname,
          error: "upstream_error",
          upstreamStatus: upstream.status,
          message: payload.message || `Upstream responded ${upstream.status}.`
        },
        502,
        { ...cors, "Cache-Control": "no-store" }
      );
    }
    const data = payload.data !== void 0 ? payload.data : payload;
    const response = json(
      {
        ok: true,
        route: pathname,
        cached: upstream.headers.get("cf-cache-status") === "HIT",
        data
      },
      200,
      {
        ...cors,
        "Cache-Control": `public, max-age=${route.ttl}, s-maxage=${route.ttl}`,
        "X-Proxy-Route": pathname
      }
    );
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(Promise.resolve());
    }
    return response;
  }
};

// C:/Users/zzz/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/zzz/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-oh5ltC/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// C:/Users/zzz/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-oh5ltC/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
