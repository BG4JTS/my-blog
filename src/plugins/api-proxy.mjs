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
 * Build an absolute proxy URL.
 *
 * @param {string} route - Route name, e.g. "bilibili/video".
 * @param {Record<string, string>} [params] - Allow-listed query parameters.
 * @returns {string}
 */
export function apiProxyUrl(route, params = {}) {
	const search = new URLSearchParams(params).toString();
	return `${API_PROXY_BASE}/${route}${search ? `?${search}` : ""}`;
}
