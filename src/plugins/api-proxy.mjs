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
const API_TOKEN = globalThis.process?.env?.PUBLIC_API_TOKEN?.trim() || "";

/**
 * Build an absolute proxy URL.
 *
 * @param {string} route - Route name, e.g. "bilibili/video".
 * @param {Record<string, string>} [params] - Allow-listed query parameters.
 * @returns {string}
 */
export function apiProxyUrl(route, params = {}) {
	const search = new URLSearchParams(params);
	if (API_TOKEN) search.set("k", API_TOKEN);
	const query = search.toString();
	return `${API_PROXY_BASE}/${route}${query ? `?${query}` : ""}`;
}
