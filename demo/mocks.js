/* Demo stand-ins for SpeakEasy: chrome.* and the extension's service worker, so the REAL side panel and
   settings page (React, built from src/ into demo/app/) run inside a plain web page. Summaries and
   narration come from demo/audio/, pre-generated with SpeakEasy's own code (scripts/demo-audio.ts);
   nothing here calls OpenAI. Loaded before the panel's bundle. The hash picks the scene for the
   explainer recorder: #open #listen #modes #voice #persist #setup. */
"use strict";
(() => {
  const realFetch = window.fetch.bind(window);
  const sceneId = location.hash.slice(1) || "open";
  const SCENES = {
    open: { tab: "night-trains", panelOpen: false },
    listen: { tab: "night-trains" },
    modes: { tab: "night-trains", autoPlay: true },
    voice: { tab: "night-trains", autoPlay: true, latency: 0.6 },
    persist: { tab: "night-trains", autoPlay: true, latency: 0.5 },
    setup: { tab: "night-trains", options: true, noKey: true, panelOpen: false },
  };
  const S = SCENES[sceneId] || SCENES.open;
  // Simulated latency (ms) so the footage paces like the real thing; off while a scene seeds its state
  const LAT = { summary: 1500, audio: 2600, validate: 700 };
  const DEMO_ONLY = "Demo page: only TL;DR in Marin or Cedar is pre-generated here. Install SpeakEasy to hear every mode, voice and style.";

  const D = (window.DEMO = {
    realFetch, sceneId, scene: S, fast: !!S.autoPlay,
    activeTabId: 1, tabs: [], // filled by stage.js: [{ id, article }]
    manifest: null, // demo/audio/manifest.json, loaded by stage.js
  });
  const lat = (k) => (D.fast ? 0 : LAT[k] * (S.latency ?? 1));
  const served = new Set(); // audio keys already generated this session: the real cache would answer these at once
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const listeners = () => {
    const fns = new Set();
    return { addListener: (f) => fns.add(f), removeListener: (f) => fns.delete(f), hasListener: (f) => fns.has(f), fire: (...a) => fns.forEach((f) => f(...a)) };
  };

  // ---- chrome.storage.sync, seeded like a configured extension (the setup scene starts without a key) ----
  const sync = { apiKey: S.noKey ? "" : "sk-proj-demo-key-not-a-real-key", defaultVoice: "marin", defaultSpeed: 1, defaultStyle: "Neutral" };
  const storageChanged = listeners();
  const pick = (store, keys) => {
    if (keys == null) return { ...store };
    const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
    const out = typeof keys === "object" && !Array.isArray(keys) ? { ...keys } : {};
    for (const k of list) if (k in store) out[k] = store[k];
    return out;
  };
  const area = (store, name) => ({
    async get(keys) { return pick(store, keys); },
    async set(obj) {
      const changes = {};
      for (const k of Object.keys(obj)) changes[k] = { oldValue: store[k], newValue: obj[k] };
      Object.assign(store, obj);
      storageChanged.fire(changes, name);
    },
    async remove(keys) { for (const k of [].concat(keys)) delete store[k]; },
  });
  const local = {};

  // ---- tabs: the fake Chrome window in stage.js keeps D.tabs / D.activeTabId current ----
  const tabsActivated = listeners();
  const tabsUpdated = listeners();
  const tabInfo = (t) => (t ? { id: t.id, active: t.id === D.activeTabId, windowId: 1, url: t.url, title: t.title } : null);
  const findTab = (id) => D.tabs.find((t) => t.id === id);
  D.activateTab = (id) => { D.activeTabId = id; tabsActivated.fire({ tabId: id, windowId: 1 }); };

  window.chrome = {
    runtime: {
      sendMessage: (msg) => handle(msg),
      openOptionsPage: async () => D.openOptions?.(),
      getURL: (p) => "app/" + p,
      onMessage: listeners(),
      onStartup: listeners(),
      lastError: undefined,
    },
    storage: { sync: area(sync, "sync"), local: area(local, "local"), onChanged: storageChanged },
    tabs: {
      query: async () => [tabInfo(findTab(D.activeTabId))].filter(Boolean),
      get: async (id) => tabInfo(findTab(id)),
      create: async (o) => D.openUrl?.(o.url),
      sendMessage: async () => ({ success: false, error: "demo" }),
      onActivated: tabsActivated,
      onUpdated: tabsUpdated,
    },
    windows: { getCurrent: async () => ({ id: 1 }) },
    sidePanel: { setPanelBehavior: async () => {} },
    scripting: { executeScript: async () => [] },
  };

  // ---- the service worker's message handlers, answered from the demo data ----
  const toArticle = (a) => {
    const bodyText = a.body.join("\n\n");
    return { title: a.title, author: a.author, bodyText, wordCount: bodyText.split(/\s+/).filter(Boolean).length, url: a.url };
  };
  const articleByUrl = (url) => D.tabs.map((t) => t.article).find((a) => a && a.url === url);
  const clipFor = (p) => {
    const a = articleByUrl(p.url);
    return D.manifest?.clips.find((c) => a && c.article === a.id && c.mode === p.mode && c.voice === p.voice && c.style === p.style) || null;
  };

  async function handle(msg) {
    const p = msg.payload || {};
    switch (msg.type) {
      case "GET_SETTINGS":
        return { ...sync };
      case "SAVE_SETTINGS":
        await window.chrome.storage.sync.set(p);
        return { success: true };
      case "GET_ARTICLE": {
        const tab = findTab(p.tabId === undefined ? D.activeTabId : p.tabId);
        if (!tab?.article) return { success: false, error: "No article found on this page" };
        return { success: true, article: toArticle(tab.article) };
      }
      case "SUMMARIZE": {
        const a0 = articleByUrl(p.url);
        const sumKey = `${p.url}:${p.mode}`;
        if (!served.has(sumKey)) await delay(lat("summary"));
        served.add(sumKey);
        const summary = p.mode === "full" ? p.text : D.manifest?.summaries?.[a0?.id]?.[p.mode];
        return { success: true, summary: summary || p.text, cached: false };
      }
      case "GET_AUDIO": {
        const clip = clipFor(p);
        if (!clip) return { success: false, error: DEMO_ONLY };
        const key = `${p.url}:${p.mode}:${p.voice}:${p.style}`;
        const cached = served.has(key);
        const blob = await (await realFetch("audio/" + clip.file, { cache: "force-cache" })).blob();
        await putAudio(key, blob, p);
        if (!cached) await delay(lat("audio"));
        served.add(key);
        return { success: true, cached };
      }
      case "CLEAR_CACHE":
        return { success: true };
      default:
        return { success: false, error: `Unknown message type: ${msg.type}` };
    }
  }

  // The panel reads audio straight from the extension's IndexedDB cache (src/lib/cache.ts), so write the
  // clip there under the same key and shape the service worker would use.
  function openCache() {
    return new Promise((res, rej) => {
      const req = indexedDB.open("speakeasy-cache", 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("summaries")) db.createObjectStore("summaries");
        if (!db.objectStoreNames.contains("audio")) db.createObjectStore("audio");
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  async function putAudio(key, blob, p) {
    const db = await openCache();
    await new Promise((res, rej) => {
      const tx = db.transaction("audio", "readwrite");
      const now = Date.now();
      tx.objectStore("audio").put({ blob, voice: p.voice, style: p.style, mode: p.mode, createdAt: now, expiresAt: now + 7 * 24 * 3600 * 1000 }, key);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }

  // The settings page validates a key with GET /v1/models; answer it here so no key ever leaves the page
  window.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes("api.openai.com/v1/models")) {
      await delay(lat("validate"));
      return new Response(JSON.stringify({ object: "list", data: [] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return realFetch(url, opts);
  };

  // Under the explainer recorder (Playwright, no user gesture) only muted playback is allowed to autoplay;
  // the footage has no sound track, so mute there. A person on the demo page hears the narration.
  if (navigator.webdriver) {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { this.muted = true; return play.call(this); };
  }
})();
