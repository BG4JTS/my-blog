/**
 * Endpoint of the Cloudflare Worker that fronts every third-party API used by
 * the blog (source + routes: workers/api, deployed at https://api.bg4jts.cn).
 *
 * Cards try this proxy first (CORS headers, forged Referer, cached at the edge,
 * server-side GitHub token) and fall back to a direct request when the Worker is
 * unreachable, so the blog keeps working before/without the deployment.
 */
export const API_PROXY_BASE = "https://api.bg4jts.cn";

/**
 * Optional site token. Set `PUBLIC_API_TOKEN` in the build environment (e.g. the
 * Vercel project) and the matching `SITE_TOKEN` secret on the Worker to switch
 * the token gate on. It is embedded in the published HTML by design, so treat it
 * as abuse friction plus a rotation handle, never as a secret.
 */
export const API_PROXY_TOKEN =
	globalThis.process?.env?.PUBLIC_API_TOKEN?.trim() || "";

/**
 * Inline helper injected into card scripts. The token is read from the
 * `<meta name="api-token">` tag the layout renders on every build, so it is never
 * baked into the cached markdown render — rotating the token takes effect with
 * the next build instead of staying frozen in a stale content cache.
 */
export const CLIENT_API_TOKEN_HELPER = `
        const apiToken = document.querySelector('meta[name="api-token"]')?.content || "";
        const withToken = (url) => (apiToken
          ? url + (url.includes("?") ? "&" : "?") + "k=" + encodeURIComponent(apiToken)
          : url);`;

/**
 * Build an absolute proxy URL (without the token; the client helper adds it).
 *
 * @param {string} route - Route name, e.g. "bilibili/video".
 * @param {Record<string, string>} [params] - Allow-listed query parameters.
 * @returns {string}
 */
export function apiProxyUrl(route, params = {}) {
	const query = new URLSearchParams(params).toString();
	return `${API_PROXY_BASE}/${route}${query ? `?${query}` : ""}`;
}
