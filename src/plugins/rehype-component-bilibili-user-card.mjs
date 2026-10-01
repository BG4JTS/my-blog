/// <reference types="mdast" />
import { readFileSync } from "node:fs";
import { h } from "hastscript";
import { apiProxyUrl } from "./api-proxy.mjs";

/**
 * Creates a Bilibili user (space) card component.
 *
 * api.bilibili.com rejects the space/card endpoints with HTTP 403 when the
 * request carries a foreign `Referer`, and a browser cannot forge one, so the
 * data is fetched at BUILD time by scripts/fetch-bilibili-users.mjs (Node may
 * send a bilibili Referer) and read from src/data/bilibili-users.json here.
 *
 * Usage: ::bilibili-user{uid="123456"}
 *
 * @param {Object} properties - The properties of the component.
 * @param {string} properties.uid - The Bilibili user id (mid).
 * @param {import('mdast').RootContent[]} children - The children elements of the component.
 * @returns {import('mdast').Parent} The created Bilibili user card component.
 */
const DATA_URL = new URL("../data/bilibili-users.json", import.meta.url);

function loadUsers() {
	try {
		return JSON.parse(readFileSync(DATA_URL, "utf8"));
	} catch {
		return {};
	}
}

function compact(n) {
	return Intl.NumberFormat("zh-CN", {
		notation: "compact",
		maximumFractionDigits: 1,
	})
		.format(n || 0)
		.replace(/[\u202f\u00a0]/g, "");
}

export function BilibiliUserCardComponent(properties, children) {
	if (Array.isArray(children) && children.length !== 0)
		return h("div", { class: "hidden" }, [
			'Invalid directive. ("bilibili-user" directive must be leaf type "::bilibili-user{uid="123456"}")',
		]);

	const uid = String(properties.uid || properties.mid || "").trim();
	if (!/^\d+$/.test(uid))
		return h(
			"div",
			{ class: "hidden" },
			'Invalid uid. ("uid" attribute must be a numeric Bilibili mid, e.g. "123456")',
		);

	const info = loadUsers()[uid];
	const cardUuid = `BU${Math.random().toString(36).slice(-6)}`; // Collisions are not important
	const proxyUrl = apiProxyUrl("bilibili/user", { mid: uid });

	const avatarStyle = info?.face
		? `background-image: url(${info.face}); background-color: transparent`
		: "";
	const nAvatar = h(`div#${cardUuid}-avatar`, {
		class: "gc-avatar",
		style: avatarStyle,
	});
	const nName = h(
		`div#${cardUuid}-name`,
		{ class: "gc-user" },
		info?.name || `UP主 ${uid}`,
	);

	const nDescription = info
		? h(
				`div#${cardUuid}-description`,
				{ class: "gc-description" },
				info.sign || "这个人很懒，什么都没写",
			)
		: h(
				`div#${cardUuid}-description`,
				{ class: "gc-description" },
				"暂无抓取数据：运行 pnpm fetch-bili 后重新构建即可显示。",
			);

	const nFans = h(
		`div#${cardUuid}-fans`,
		{ class: "gc-stars" },
		info ? compact(info.fans) : "--",
	);
	const nLikes = h(
		`div#${cardUuid}-likes`,
		{ class: "gc-forks" },
		info ? compact(info.likes) : "--",
	);
	const nArchives = h(
		`div#${cardUuid}-archives`,
		{ class: "gc-coin" },
		info ? compact(info.archives) : "--",
	);
	const nLevel = h(
		`div#${cardUuid}-level`,
		{ class: "gc-license" },
		info?.level ? `LV${info.level}` : "--",
	);

	// 服务端已渲染抓取缓存，再用 API 代理静默刷新一次；代理不可用时保留缓存值
	const nScript = h(
		`script#${cardUuid}-script`,
		{ type: "text/javascript" },
		`
      (function () {
        const id = '${cardUuid}';
        const card = document.getElementById(id + '-card');
        const compact = (n) => Intl.NumberFormat('zh-CN', { notation: "compact", maximumFractionDigits: 1 }).format(n || 0).replace(/[\\u202f\\u00a0]/g, '');
        const set = (suffix, value) => {
          const el = document.getElementById(id + '-' + suffix);
          if (el && value !== undefined && value !== null && value !== '') el.innerText = value;
        };
        fetch('${proxyUrl}', { referrerPolicy: "no-referrer" })
          .then((res) => res.json())
          .then((json) => {
            if (!json || json.ok !== true || !json.data) throw new Error('proxy unavailable');
            const d = json.data;
            const c = d.card || d;
            set('name', c.name);
            set('description', c.sign);
            set('fans', compact(d.follower != null ? d.follower : c.fans));
            set('likes', compact(d.like_num));
            set('archives', compact(d.archive_count));
            if (c.level_info?.current_level) set('level', 'LV' + c.level_info.current_level);
            const avatarEl = document.getElementById(id + '-avatar');
            if (avatarEl && c.face) {
              avatarEl.style.backgroundImage = 'url(' + c.face + ')';
              avatarEl.style.backgroundColor = 'transparent';
            }
            card?.classList.remove('fetch-error');
          })
          .catch(() => { /* 代理不可用：保留服务端渲染的缓存值 */ });
      })();
    `,
	);

	return h(
		`a#${cardUuid}-card`,
		{
			class: `card-bilibili-user no-styling${info ? "" : " fetch-error"}`,
			href: `https://space.bilibili.com/${uid}`,
			target: "_blank",
			uid,
		},
		[
			h("div", { class: "gc-titlebar" }, [
				h("div", { class: "gc-titlebar-left" }, [
					h("div", { class: "gc-owner" }, [nAvatar, nName]),
					h("div", { class: "gc-divider" }, "/"),
					h("div", { class: "gc-repo" }, `UID ${uid}`),
				]),
				h("div", { class: "bilibili-logo" }),
			]),
			nDescription,
			h("div", { class: "gc-infobar" }, [nFans, nLikes, nArchives, nLevel]),
			nScript,
		],
	);
}
