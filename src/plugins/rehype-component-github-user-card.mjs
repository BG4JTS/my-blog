/// <reference types="mdast" />
import { h } from "hastscript";
import { apiProxyUrl } from "./api-proxy.mjs";

/**
 * Creates a GitHub user (profile) card component.
 *
 * Usage: ::github-user{user="BG4JTS"}
 *
 * @param {Object} properties - The properties of the component.
 * @param {string} properties.user - The GitHub username (not "owner/repo").
 * @param {import('mdast').RootContent[]} children - The children elements of the component.
 * @returns {import('mdast').Parent} The created GitHub user card component.
 */
export function GithubUserCardComponent(properties, children) {
	if (Array.isArray(children) && children.length !== 0)
		return h("div", { class: "hidden" }, [
			'Invalid directive. ("github-user" directive must be leaf type "::github-user{user="user"}")',
		]);

	const user = String(properties.user || "")
		.replace(/^@/, "")
		.trim();
	if (!user || user.includes("/"))
		return h(
			"div",
			{ class: "hidden" },
			'Invalid user. ("user" attribute must be a GitHub username like "BG4JTS", not "owner/repo")',
		);

	const cardUuid = `GU${Math.random().toString(36).slice(-6)}`; // Collisions are not important
	const proxyUrl = apiProxyUrl("github/user", { user });

	const nAvatar = h(`div#${cardUuid}-avatar`, { class: "gc-avatar" });
	const nLogin = h(`div#${cardUuid}-login`, { class: "gc-user" }, user);
	const nName = h(`div#${cardUuid}-name`, { class: "gc-repo" }, "Waiting...");
	const nDescription = h(
		`div#${cardUuid}-description`,
		{ class: "gc-description" },
		"Waiting for api.github.com...",
	);
	const nRepos = h(`div#${cardUuid}-repos`, { class: "gc-stars" }, "0");
	const nFollowers = h(`div#${cardUuid}-followers`, { class: "gc-forks" }, "0");
	const nFollowing = h(
		`div#${cardUuid}-following`,
		{ class: "gc-license" },
		"0",
	);
	const nLocation = h(
		`span#${cardUuid}-location`,
		{ class: "gc-language" },
		"",
	);

	const nScript = h(
		`script#${cardUuid}-script`,
		{ type: "text/javascript" },
		`
      const apply = (data) => {
        if (!data || data.message) throw new Error(data && data.message ? data.message : "empty response");
        document.getElementById('${cardUuid}-name').innerText = data.name || data.login || "${user}";
        document.getElementById('${cardUuid}-login').innerText = data.login || "${user}";
        document.getElementById('${cardUuid}-description').innerText = data.bio?.replace(/:[a-zA-Z0-9_]+:/g, '') || "这个人很懒，什么都没写";
        const fmt = (n) => Intl.NumberFormat('en-us', { notation: "compact", maximumFractionDigits: 1 }).format(n || 0).replaceAll("\\u202f", '');
        document.getElementById('${cardUuid}-repos').innerText = fmt(data.public_repos);
        document.getElementById('${cardUuid}-followers').innerText = fmt(data.followers);
        document.getElementById('${cardUuid}-following').innerText = fmt(data.following);
        document.getElementById('${cardUuid}-location').innerText = data.location || "";
        const avatarEl = document.getElementById('${cardUuid}-avatar');
        avatarEl.style.backgroundImage = 'url(' + data.avatar_url + ')';
        avatarEl.style.backgroundColor = 'transparent';
        document.getElementById('${cardUuid}-card').classList.remove("fetch-waiting");
      };
      // 1) 优先走自有 API 代理（可服务端挂 token，提升限流）
      fetch('${proxyUrl}')
        .then((res) => res.json())
        .then((json) => {
          if (!json || json.ok !== true || !json.data) throw new Error("proxy unavailable");
          apply(json.data);
        })
        .catch(() => fetch('https://api.github.com/users/${user}', { referrerPolicy: "no-referrer" })
          .then((res) => res.json())
          .then((data) => apply(data))
          .catch((err) => {
            const c = document.getElementById('${cardUuid}-card');
            c?.classList.add("fetch-error");
            console.warn("[GITHUB-USER-CARD] (Error) Loading card for ${user}.", err);
          }));
    `,
	);

	return h(
		`a#${cardUuid}-card`,
		{
			class: "card-github-user fetch-waiting no-styling",
			href: `https://github.com/${user}`,
			target: "_blank",
			user,
		},
		[
			h("div", { class: "gc-titlebar" }, [
				h("div", { class: "gc-titlebar-left" }, [
					h("div", { class: "gc-owner" }, [nAvatar, nLogin]),
					h("div", { class: "gc-divider" }, "/"),
					nName,
				]),
				h("div", { class: "github-logo" }),
			]),
			nDescription,
			h("div", { class: "gc-infobar" }, [
				nRepos,
				nFollowers,
				nFollowing,
				nLocation,
			]),
			nScript,
		],
	);
}
