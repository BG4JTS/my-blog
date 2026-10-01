/// <reference types="mdast" />
import { h } from "hastscript";
import { apiProxyUrl, CLIENT_API_TOKEN_HELPER } from "./api-proxy.mjs";

/**
 * Creates a Bilibili video card component.
 *
 * Data is loaded with JSONP: api.bilibili.com does not send CORS headers and
 * rejects requests carrying a foreign `Origin` header (HTTP 403), so a normal
 * `fetch()` from the blog origin can never work. A classic <script> request
 * sends no `Origin`, and a foreign `Referer` is accepted, so JSONP works.
 *
 * Usage: ::bilibili{bvid="BV1GJ411x7h7"}
 *
 * @param {Object} properties - The properties of the component.
 * @param {string} properties.bvid - The Bilibili video id, e.g. "BV1GJ411x7h7".
 * @param {import('mdast').RootContent[]} children - The children elements of the component.
 * @returns {import('mdast').Parent} The created Bilibili video card component.
 */
export function BilibiliCardComponent(properties, children) {
	if (Array.isArray(children) && children.length !== 0)
		return h("div", { class: "hidden" }, [
			'Invalid directive. ("bilibili" directive must be leaf type "::bilibili{bvid="BV1GJ411x7h7"}")',
		]);

	const bvid = String(properties.bvid || properties.id || "").trim();
	if (!/^BV[0-9A-Za-z]{10}$/.test(bvid))
		return h(
			"div",
			{ class: "hidden" },
			'Invalid bvid. ("bvid" attribute must look like "BV1GJ411x7h7")',
		);

	const cardUuid = `BL${Math.random().toString(36).slice(-6)}`; // Collisions are not important
	const proxyUrl = apiProxyUrl("bilibili/video", { bvid });

	const nAvatar = h(`div#${cardUuid}-avatar`, { class: "gc-avatar" });
	const nUp = h(`div#${cardUuid}-up`, { class: "gc-user" }, "Waiting...");
	const nBvid = h("div", { class: "gc-repo" }, bvid);
	const nTitle = h(
		`div#${cardUuid}-title`,
		{ class: "gc-title" },
		"Waiting for api.bilibili.com...",
	);
	const nDescription = h(
		`div#${cardUuid}-description`,
		{ class: "gc-description" },
		"",
	);
	const nView = h(`div#${cardUuid}-view`, { class: "gc-stars" }, "0");
	const nLike = h(`div#${cardUuid}-like`, { class: "gc-forks" }, "0");
	const nCoin = h(`div#${cardUuid}-coin`, { class: "gc-coin" }, "0");
	const nFavorite = h(`div#${cardUuid}-favorite`, { class: "gc-license" }, "0");

	const nScript = h(
		`script#${cardUuid}-script`,
		{ type: "text/javascript" },
		`
${CLIENT_API_TOKEN_HELPER}
      (function () {
        const id = '${cardUuid}';
        const card = document.getElementById(id + '-card');
        let done = false;
        const fail = () => {
          if (done) return;
          done = true;
          card?.classList.add("fetch-error");
        };
        const num = (n) => Intl.NumberFormat('zh-CN', { notation: "compact", maximumFractionDigits: 1 }).format(n || 0).replace(/[\\u202f\\u00a0]/g, '');
        const time = (s) => {
          const total = Math.floor(s || 0);
          const hh = Math.floor(total / 3600);
          const mm = Math.floor((total % 3600) / 60);
          const ss = total % 60;
          const pad = (v) => (v < 10 ? '0' + v : '' + v);
          return hh > 0 ? hh + ':' + pad(mm) + ':' + pad(ss) : mm + ':' + pad(ss);
        };
        const render = (d) => {
          if (done || !d) return;
          done = true;
          try {
            document.getElementById(id + '-up').innerText = d.owner?.name || '未知UP主';
            document.getElementById(id + '-title').innerText = d.title || '';
            document.getElementById(id + '-description').innerText = d.desc && d.desc !== '-' ? d.desc : 'UP主没有写简介';
            document.getElementById(id + '-view').innerText = num(d.stat?.view);
            document.getElementById(id + '-like').innerText = num(d.stat?.like);
            document.getElementById(id + '-coin').innerText = num(d.stat?.coin);
            document.getElementById(id + '-favorite').innerText = num(d.stat?.favorite) + ' · ' + time(d.duration);
            const avatarEl = document.getElementById(id + '-avatar');
            if (d.pic) {
              avatarEl.style.backgroundImage = 'url(' + String(d.pic).replace(/^http:/, 'https:') + ')';
              avatarEl.style.backgroundColor = 'transparent';
            }
            card?.classList.remove("fetch-waiting");
          } catch (err) {
            console.warn("[BILIBILI-CARD] render failed for ${bvid}.", err);
            card?.classList.add("fetch-error");
          }
        };
        // 1) 优先走自有 API 代理（带 CORS + 边缘缓存）
        fetch(withToken('${proxyUrl}'), { referrerPolicy: "no-referrer" })
          .then((res) => res.json())
          .then((json) => {
            if (!json || json.ok !== true || !json.data) throw new Error('proxy unavailable');
            render(json.data);
          })
          .catch(() => jsonp());
        // 2) 代理不可用则回落到直连 JSONP（classic script 请求不带 Origin）
        function jsonp() {
          const callback = '__bili_cb_' + id;
          window[callback] = (res) => {
            try {
              if (!res || res.code !== 0) throw new Error('bilibili code ' + (res && res.code));
              render(res.data);
            } catch (err) {
              console.warn("[BILIBILI-CARD] JSONP fallback failed for ${bvid}.", err);
              fail();
            } finally {
              try { delete window[callback]; } catch (_) { /* ignore */ }
            }
          };
          const s = document.createElement('script');
          s.src = 'https://api.bilibili.com/x/web-interface/view?bvid=${bvid}&jsonp=jsonp&callback=' + callback;
          s.async = true;
          s.onerror = fail;
          document.head.appendChild(s);
        }
        setTimeout(() => { if (card?.classList.contains("fetch-waiting")) fail(); }, 12000);
      })();
    `,
	);

	return h(
		`a#${cardUuid}-card`,
		{
			class: "card-bilibili fetch-waiting no-styling",
			href: `https://www.bilibili.com/video/${bvid}`,
			target: "_blank",
			bvid,
		},
		[
			h("div", { class: "gc-titlebar" }, [
				h("div", { class: "gc-titlebar-left" }, [
					h("div", { class: "gc-owner" }, [nAvatar, nUp]),
					h("div", { class: "gc-divider" }, "/"),
					nBvid,
				]),
				h("div", { class: "bilibili-logo" }),
			]),
			nTitle,
			nDescription,
			h("div", { class: "gc-infobar" }, [nView, nLike, nCoin, nFavorite]),
			nScript,
		],
	);
}
