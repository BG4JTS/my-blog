#!/usr/bin/env node
/**
 * Collects Bilibili user (space) card data for every `::bilibili-user{uid="..."}`
 * directive found under src/content and caches it in src/data/bilibili-users.json.
 *
 * Why build time instead of the browser: api.bilibili.com answers the space/card
 * endpoints with HTTP 403 for requests carrying a foreign `Referer`, and a browser
 * cannot forge one. Node can send a bilibili Referer, so we fetch once per build and
 * let the rehype component render the cached values server-side.
 *
 * This script never fails the build: on error the previously cached entry is kept.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = join(root, "src", "content");
const outFile = join(root, "src", "data", "bilibili-users.json");
const API = "https://api.bilibili.com/x/web-interface/card";
const UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function walkMarkdown(dir) {
	/** @type {string[]} */
	const files = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...walkMarkdown(full));
		else if (entry.name.endsWith(".md")) files.push(full);
	}
	return files;
}

function collectUids() {
	const uids = new Set();
	for (const file of walkMarkdown(contentDir)) {
		const source = readFileSync(file, "utf8");
		for (const directive of source.matchAll(/::bilibili-user\{([^}]*)\}/g)) {
			const uid = directive[1].match(/uid\s*=\s*"?(\d+)"?/);
			if (uid) uids.add(uid[1]);
		}
	}
	return [...uids].sort();
}

function readCache() {
	try {
		return JSON.parse(readFileSync(outFile, "utf8"));
	} catch {
		return {};
	}
}

async function fetchUser(uid) {
	const response = await fetch(`${API}?mid=${uid}&photo=false`, {
		headers: { "User-Agent": UA, Referer: "https://www.bilibili.com/" },
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const json = await response.json();
	if (json.code !== 0) throw new Error(`code ${json.code}: ${json.message}`);
	const card = json.data.card;
	return {
		name: card.name ?? null,
		face: card.face ?? null,
		sign: card.sign ?? null,
		level: card.level_info?.current_level ?? null,
		fans: json.data.follower ?? card.fans ?? null,
		following: card.friend ?? null,
		likes: json.data.like_num ?? null,
		archives: json.data.archive_count ?? null,
		fetchedAt: new Date().toISOString(),
	};
}

const uids = collectUids();
if (uids.length === 0) {
	console.log(
		"[bili] no ::bilibili-user{uid=...} directive found, nothing to fetch.",
	);
} else {
	const cache = readCache();
	let changed = false;
	for (const uid of uids) {
		try {
			cache[uid] = await fetchUser(uid);
			changed = true;
			console.log(
				`[bili] uid=${uid} ok -> ${cache[uid].name} (粉丝 ${cache[uid].fans})`,
			);
		} catch (error) {
			const kept = cache[uid] ? " (keeping cached data)" : "";
			console.warn(`[bili] uid=${uid} failed: ${error.message}${kept}`);
		}
	}
	if (changed || !existsSync(outFile)) {
		const sorted = Object.fromEntries(
			Object.keys(cache)
				.sort()
				.map((key) => [key, cache[key]]),
		);
		writeFileSync(outFile, `${JSON.stringify(sorted, null, 2)}\n`);
		console.log(
			`[bili] wrote ${outFile} (${Object.keys(sorted).length} entries)`,
		);
	} else {
		console.log("[bili] nothing changed, cache untouched.");
	}
}
