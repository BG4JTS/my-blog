/**
 * bg4jts API proxy — Cloudflare Worker
 * Deployed at https://api.bg4jts.cn
 *
 * Why this exists
 * ---------------
 * Bilibili's public API sends no CORS headers and answers any request that
 * carries a foreign `Origin` header with HTTP 403, and the space/card
 * endpoints additionally 403 a foreign `Referer` — which a browser cannot
 * forge. A Worker may set both, so it can fetch on the visitor's behalf.
 * GitHub's API does allow CORS but is limited to 60 requests/hour/IP; routing
 * it through the Worker lets us attach a server-side token.
 *
 * Contract (never changes shape, so the blog code stays simple)
 * ------------------------------------------------------------
 *   GET /<route>?<params>
 *   200 { "ok": true,  "route": "bilibili/video", "cached": false, "data": {...} }
 *   4xx { "ok": false, "route": "bilibili/video", "error": "invalid_param", "message": "..." }
 *   5xx { "ok": false, "route": "...", "error": "upstream_error", "upstreamStatus": 403, "message": "..." }
 *
 * Adding an API later
 * -------------------
 * Add one entry to ROUTES below. Only allow-listed routes can reach the
 * network, so this Worker is NOT an open proxy.
 */

const USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const UPSTREAM_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 512 * 1024;

/**
 * @typedef {Object} Route
 * @property {(q: Record<string, string>) => string} upstream Builds the upstream URL.
 * @property {Record<string, RegExp>} validate Allow-listed params and their patterns.
 * @property {string[]} required Params that must be present.
 * @property {number} ttl Edge + browser cache TTL in seconds.
 * @property {string} [referer] Referer header sent upstream.
 * @property {(env: Env) => Record<string, string>} [headers] Extra upstream headers.
 * @property {string} [docs] One-line description, shown by the route index.
 */

/** @type {Record<string, Route>} */
const ROUTES = {
	"bilibili/video": {
		docs: "B站视频信息（标题/简介/UP主/播放/点赞/投币/收藏/时长）",
		upstream: (q) =>
			`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(q.bvid)}`,
		validate: { bvid: /^BV[0-9A-Za-z]{10}$/ },
		required: ["bvid"],
		ttl: 600,
		referer: "https://www.bilibili.com/",
		headers: bilibiliHeaders,
	},
	"bilibili/user": {
		docs: "B站用户信息（昵称/头像/签名/粉丝/获赞/投稿/等级）",
		upstream: (q) =>
			`https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(q.mid)}&photo=false`,
		validate: { mid: /^\d{1,12}$/ },
		required: ["mid"],
		ttl: 1800,
		referer: "https://www.bilibili.com/",
		headers: bilibiliHeaders,
	},
	"github/user": {
		docs: "GitHub 用户信息（昵称/简介/仓库数/关注者）",
		// Values are regex-validated below, so they are safe to interpolate raw.
		upstream: (q) => `https://api.github.com/users/${q.user}`,
		validate: { user: /^[A-Za-z0-9-]{1,39}$/ },
		required: ["user"],
		ttl: 1800,
		headers: githubHeaders,
	},
	"github/repo": {
		docs: "GitHub 仓库信息（简介/语言/Star/Fork/许可证）",
		// Must stay raw: encoding the "/" would turn the path into owner%2Fname.
		upstream: (q) => `https://api.github.com/repos/${q.repo}`,
		validate: { repo: /^[A-Za-z0-9._-]{1,39}\/[A-Za-z0-9._-]{1,100}$/ },
		required: ["repo"],
		ttl: 1800,
		headers: githubHeaders,
	},
};

/** Attach a server-side token when configured, to lift GitHub's 60/h limit. */
function githubHeaders(env) {
	/** @type {Record<string, string>} */
	const headers = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
	};
	if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
	return headers;
}

/**
 * Bilibili risk-controls datacenter IPs: `api.bilibili.com` answers HTTP 412 /
 * code -412 `request was banned`. The community-standard mitigation is to look
 * like a browser that has already visited bilibili.com — send the full browser
 * header set and the anonymous buvid3/buvid4 device cookies, which need no login
 * and come from the finger/spi endpoint. The ban is IP-driven, so this is a
 * best effort: the client-side JSONP path, the build-time snapshot and
 * BILI_PROXY_BASE remain the guarantees.
 */
const BILIBILI_HEADERS = {
	Accept: "application/json, text/plain, */*",
	"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
	Origin: "https://www.bilibili.com",
	Referer: "https://www.bilibili.com/",
	"Sec-Fetch-Dest": "empty",
	"Sec-Fetch-Mode": "cors",
	"Sec-Fetch-Site": "same-site",
};

/** Module-scope cache: buvid3 lives for months, we refresh it every 6 hours. */
const buvidCache = { cookie: "", expiresAt: 0 };

async function getBuvidCookie() {
	if (buvidCache.cookie && Date.now() < buvidCache.expiresAt) {
		return buvidCache.cookie;
	}
	try {
		const res = await fetch("https://api.bilibili.com/x/frontend/finger/spi", {
			headers: { "User-Agent": USER_AGENT, ...BILIBILI_HEADERS },
			cf: { cacheTtl: 1800, cacheEverything: true },
		});
		const json = await res.json();
		const buvid3 = json?.data?.b_3;
		const buvid4 = json?.data?.b_4;
		if (!buvid3) return "";
		const parts = [`buvid3=${buvid3}`];
		if (buvid4) parts.push(`buvid4=${buvid4}`);
		parts.push(`b_nut=${Math.floor(Date.now() / 1000)}`);
		buvidCache.cookie = parts.join("; ");
		buvidCache.expiresAt = Date.now() + 6 * 3600 * 1000;
		return buvidCache.cookie;
	} catch {
		return "";
	}
}

async function bilibiliHeaders() {
	const cookie = await getBuvidCookie();
	return cookie ? { ...BILIBILI_HEADERS, Cookie: cookie } : BILIBILI_HEADERS;
}

function corsHeaders(request, env) {
	const allow = (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS).trim();
	const origin = request.headers.get("Origin") || "";
	const allowed =
		allow === "*"
			? "*"
			: allow
						.split(",")
						.map((value) => value.trim())
						.filter(Boolean)
						.includes(origin)
				? origin
				: allow.split(",")[0].trim();

	/** @type {Record<string, string>} */
	const headers = {
		"Access-Control-Allow-Origin": allowed,
		"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
		"Access-Control-Allow-Headers": "*",
		"Access-Control-Max-Age": "86400",
		Vary: "Origin",
		"X-Robots-Tag": "noindex",
	};
	if (allowed !== "*") headers["Access-Control-Allow-Credentials"] = "false";
	return headers;
}

function json(body, status, extraHeaders) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			...extraHeaders,
		},
	});
}

/**
 * Abuse protection (auth layer).
 *
 * 1. Origin allow-list — browser scope only: any client can omit or forge the
 *    Origin header, so this is friction, not authentication.
 * 2. Per-IP rate limit — edge-cache fixed window, counted per colo, so the
 *    effective limit can be a small multiple across colos.
 * 3. Site token (opt-in) — active only once the SITE_TOKEN secret exists. The
 *    token must ship to the browser to be usable, so it is NOT a secret: it
 *    deters casual scraping and can be rotated to cut off abuse. Real
 *    authentication for privileged routes belongs behind Cloudflare Access.
 */
const DEFAULT_ALLOWED_ORIGINS =
	"https://bg4jts.cn,https://www.bg4jts.cn,http://localhost:4321,http://127.0.0.1:4321";
const DEFAULT_RATE_LIMIT_PER_MIN = 120;

function allowedOriginList(env) {
	return (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
}

/** `*` allows everything; `*.vercel.app` matches by suffix. */
function isOriginAllowed(origin, env) {
	if (!origin) return true; // curl / server-to-server clients send no Origin
	const list = allowedOriginList(env);
	if (list.includes("*")) return true;
	return list.some((pattern) =>
		pattern.startsWith("*.")
			? origin.endsWith(pattern.slice(1))
			: pattern === origin,
	);
}

async function isRateLimited(request, env) {
	const limit = Number(env.RATE_LIMIT_PER_MIN ?? DEFAULT_RATE_LIMIT_PER_MIN);
	if (!Number.isFinite(limit) || limit <= 0) return false;
	const ip = request.headers.get("CF-Connecting-IP") || "unknown";
	const window = Math.floor(Date.now() / 60_000);
	const key = new Request(
		`https://ratelimit.bg4jts.invalid/${encodeURIComponent(ip)}/${window}`,
	);
	const cache = caches.default;
	const hit = await cache.match(key);
	const used = hit ? Number(await hit.text()) || 0 : 0;
	if (used >= limit) return true;
	await cache.put(
		key,
		new Response(String(used + 1), {
			headers: { "Cache-Control": "max-age=60" },
		}),
	);
	return false;
}

/** Returns a `{status, error, message}` issue when the token gate rejects. */
function siteTokenIssue(request, url, env) {
	const expected = env.SITE_TOKEN;
	if (!expected) return null; // gate disabled
	const provided =
		url.searchParams.get("k") || request.headers.get("X-Api-Key") || "";
	if (!provided) {
		return {
			status: 401,
			error: "missing_token",
			message: "Provide ?k=<token> or the X-Api-Key header.",
		};
	}
	if (provided !== expected) {
		return {
			status: 403,
			error: "invalid_token",
			message: "The provided token is not valid.",
		};
	}
	return null;
}

function routeIndex() {
	return Object.fromEntries(
		Object.entries(ROUTES).map(([name, route]) => [
			name,
			{
				docs: route.docs || "",
				params: Object.keys(route.validate),
				required: route.required,
				ttl: route.ttl,
			},
		]),
	);
}

export default {
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
					message: "Only GET/HEAD/OPTIONS are supported.",
				},
				405,
				cors,
			);
		}
		const origin = request.headers.get("Origin") || "";
		if (!isOriginAllowed(origin, env)) {
			return json(
				{
					ok: false,
					error: "origin_not_allowed",
					message: `Origin "${origin}" is not allowed to call this API.`,
				},
				403,
				{ "Cache-Control": "no-store", Vary: "Origin" },
			);
		}

		if (pathname === "" || pathname === "health") {
			return json(
				{
					ok: true,
					service: "bg4jts-api",
					routes: routeIndex(),
				},
				200,
				{ ...cors, "Cache-Control": "no-store" },
			);
		}

		const route = ROUTES[pathname];
		if (!route) {
			return json(
				{
					ok: false,
					route: pathname,
					error: "unknown_route",
					message: `Unknown route. Available: ${Object.keys(ROUTES).join(", ")}`,
				},
				404,
				{ ...cors, "Cache-Control": "no-store" },
			);
		}

		if (await isRateLimited(request, env)) {
			return json(
				{
					ok: false,
					route: pathname,
					error: "rate_limited",
					message: "Too many requests. Try again in a minute.",
				},
				429,
				{ ...cors, "Cache-Control": "no-store", "Retry-After": "60" },
			);
		}

		const tokenIssue = siteTokenIssue(request, url, env);
		if (tokenIssue) {
			return json(
				{
					ok: false,
					route: pathname,
					error: tokenIssue.error,
					message: tokenIssue.message,
				},
				tokenIssue.status,
				{ ...cors, "Cache-Control": "no-store" },
			);
		}

		// ----- validate params against the per-route allow-list -----
		/** @type {Record<string, string>} */
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
						message: `Parameter "${name}" did not match ${pattern}`,
					},
					400,
					{ ...cors, "Cache-Control": "no-store" },
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
						message: `Missing required parameter "${name}".`,
					},
					400,
					{ ...cors, "Cache-Control": "no-store" },
				);
			}
		}

		// ----- fetch upstream (edge-cached for route.ttl seconds) -----
		const directUrl = route.upstream(params);
		// Escape hatch: relay Bilibili traffic through a China-capable proxy that
		// accepts ?url=<encoded target>, for when the edge egress IP is banned.
		const upstreamUrl =
			env.BILI_PROXY_BASE && pathname.startsWith("bilibili/")
				? `${env.BILI_PROXY_BASE.replace(/\/$/, "")}?url=${encodeURIComponent(directUrl)}`
				: directUrl;
		/** @type {Record<string, string>} */
		const upstreamHeaders = {
			"User-Agent": USER_AGENT,
			Accept: "application/json, text/plain, */*",
			"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
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
				cf: { cacheTtl: route.ttl, cacheEverything: true },
			});
		} catch (error) {
			return json(
				{
					ok: false,
					route: pathname,
					error: "upstream_unreachable",
					message: String(error?.message ?? error),
				},
				504,
				{ ...cors, "Cache-Control": "no-store" },
			);
		}

		const text = (await upstream.text()).slice(0, MAX_BODY_BYTES);
		let payload;
		try {
			payload = JSON.parse(text);
		} catch {
			// Never leak an anti-bot HTML page: report a generic upstream error.
			return json(
				{
					ok: false,
					route: pathname,
					error: "upstream_error",
					upstreamStatus: upstream.status,
					message:
						"Upstream did not return JSON (likely rate limiting or anti-bot).",
				},
				502,
				{ ...cors, "Cache-Control": "no-store" },
			);
		}

		// Bilibili wraps everything in { code, message, data }.
		if (typeof payload.code === "number" && payload.code !== 0) {
			return json(
				{
					ok: false,
					route: pathname,
					error: "upstream_error",
					upstreamStatus: upstream.status,
					upstreamCode: payload.code,
					message: payload.message || "Upstream returned a non-zero code.",
				},
				502,
				{ ...cors, "Cache-Control": "no-store" },
			);
		}
		if (!upstream.ok) {
			return json(
				{
					ok: false,
					route: pathname,
					error: "upstream_error",
					upstreamStatus: upstream.status,
					message: payload.message || `Upstream responded ${upstream.status}.`,
				},
				502,
				{ ...cors, "Cache-Control": "no-store" },
			);
		}

		const data = payload.data !== undefined ? payload.data : payload;
		const response = json(
			{
				ok: true,
				route: pathname,
				cached: upstream.headers.get("cf-cache-status") === "HIT",
				data,
			},
			200,
			{
				...cors,
				"Cache-Control": `public, max-age=${route.ttl}, s-maxage=${route.ttl}`,
				"X-Proxy-Route": pathname,
			},
		);
		if (ctx && typeof ctx.waitUntil === "function") {
			ctx.waitUntil(Promise.resolve());
		}
		return response;
	},
};
