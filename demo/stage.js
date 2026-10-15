/* Builds the demo window: the tab strip, the fictional article, the settings tab, and the extension's
   real side panel (demo/app/popup.html + its bundle) or settings page (demo/app/options.html) mounted
   into the page. Signals readiness for the explainer recorder by appending #stageReady. */
"use strict";
(() => {
  const D = window.DEMO;
  const S = D.scene;
  const el = (id) => document.getElementById(id);
  const ARTICLES = window.DEMO_ARTICLES;
  const OPTIONS_URL = "chrome-extension://speakeasy/src/options/options.html";

  // ---- Tabs: one per article, plus the settings page when it is opened ----
  const tabs = ARTICLES.map((a, i) => ({ id: i + 1, kind: "article", article: a, title: a.tabTitle, url: a.url, omni: a.path }));
  D.tabs = tabs;
  let active = tabs.find((t) => t.article.id === S.tab) || tabs[0];

  function renderTabs() {
    el("tabStrip").innerHTML = tabs
      .map((t) => `
        <div class="cx-tab${t === active ? " active" : ""}" data-tab="${t.id}">
          <span class="cx-fav ${t.kind === "options" ? "cx-fav-se" : "cx-fav-mr"}">${t.kind === "options" ? "" : "M"}</span>
          <span class="cx-tab-title">${t.title}</span><span class="cx-x">&times;</span>
        </div>`)
      .join("");
    el("tabStrip").querySelectorAll(".cx-tab").forEach((n) => n.addEventListener("click", () => switchTab(+n.dataset.tab)));
    el("omniText").textContent = active.omni;
    document.title = active.title;
  }

  function renderArticle(a) {
    const initials = a.author.split(" ").map((w) => w[0]).join("");
    el("article").innerHTML = `
      <div class="ar-col">
        <div class="ar-kicker">${a.section}</div>
        <h1 class="ar-h1">${a.title}</h1>
        <p class="ar-dek">${a.dek}</p>
        <div class="ar-byline">
          <span class="ar-av" style="background:${a.art === "train" ? "#2f4b7c" : "#8a5a2b"}">${initials}</span>
          <span>By <b>${a.author}</b></span><span class="ar-dot"></span><span>${a.date}</span><span class="ar-dot"></span><span>${a.readTime}</span>
        </div>
        <figure class="ar-hero ${a.art}"></figure>
        <div class="ar-cap">${a.art === "train" ? "A sleeper leaves the platform a little after nine. Illustration for The Meridian Review." : "Saturday at the Alder Street repair café. Illustration for The Meridian Review."}</div>
        <div class="ar-body">${a.body.map((p) => `<p>${p}</p>`).join("")}</div>
      </div>`;
  }

  function showPage(tab) {
    el("articlePage").classList.toggle("cx-hidden", tab.kind !== "article");
    el("optionsPage").classList.toggle("cx-hidden", tab.kind !== "options");
    if (tab.kind === "article") renderArticle(tab.article);
  }

  // Switching tabs is what the side panel listens for (chrome.tabs.onActivated): with audio loaded it offers
  // the new page instead of interrupting; idle, it switches to the new article.
  function switchTab(id) {
    const t = tabs.find((x) => x.id === id);
    if (!t || t === active) return;
    active = t;
    renderTabs();
    showPage(t);
    D.activateTab(t.id);
  }
  D.switchTab = switchTab;

  function setSide(open) {
    el("side").classList.toggle("open", open);
    el("extBtn").classList.toggle("on", open);
  }
  D.setSide = setSide;

  // ---- Mounting the real pages. Each bundle renders into #root, so the id is handed over after each mount. ----
  async function mount(kind, container) {
    const html = await (await D.realFetch(`app/${kind}.html`, { cache: "no-store" })).text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const fix = (u) => u.replace(/^\//, "app/");
    const root = document.createElement("div");
    root.id = "root";
    container.appendChild(root);
    const loads = [];
    doc.querySelectorAll('link[rel="stylesheet"][href]').forEach((l) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = fix(l.getAttribute("href"));
      loads.push(new Promise((r) => { link.onload = link.onerror = r; }));
      document.head.appendChild(link);
    });
    await Promise.all(loads);
    const src = doc.querySelector('script[type="module"][src]')?.getAttribute("src");
    if (!src) throw new Error(`No module script in app/${kind}.html`);
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.type = "module";
      s.src = fix(src);
      s.onload = res;
      s.onerror = () => rej(new Error(`Failed to load ${s.src}`));
      document.body.appendChild(s);
    });
    root.id = `${kind}Root`;
    return root;
  }

  let optionsTab = null;
  let optionsMounted = false;
  D.openOptions = async () => {
    if (!optionsTab) {
      optionsTab = { id: tabs.length + 1, kind: "options", title: "SpeakEasy Settings", url: OPTIONS_URL, omni: OPTIONS_URL };
      tabs.push(optionsTab);
    }
    if (!optionsMounted) {
      optionsMounted = true;
      await mount("options", el("optionsPage"));
    }
    switchTab(optionsTab.id);
  };
  D.openUrl = (url) => window.open(url, "_blank");

  // The window is laid out at 1600x900 and scaled to the viewport; at 2400x1350 (the recorder) that is 1.5x.
  function fit() {
    const z = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    document.documentElement.style.setProperty("--z", String(z));
  }
  window.addEventListener("resize", fit);
  fit();

  // The recorder's spotlight is a fixed rectangle; while window.__follow names an element, keep it on that element
  // (the panel's banners come and go above the player, which would otherwise leave the spotlight off target).
  (function follow() {
    const f = window.__follow;
    const spot = document.getElementById("__spot");
    if (f && spot && spot.classList.contains("on")) {
      const e = document.querySelector(f.sel);
      const b = e?.getBoundingClientRect();
      if (b && (b.width || b.height)) {
        const set = (k, v) => { if (spot.style[k] !== v) spot.style[k] = v; };
        set("left", `${b.left - f.pad}px`);
        set("top", `${b.top - f.pad}px`);
        set("width", `${b.width + 2 * f.pad}px`);
        set("height", `${b.height + 2 * f.pad}px`);
      }
    }
    requestAnimationFrame(follow);
  })();

  const until = async (fn, ms = 15000) => {
    const end = Date.now() + ms;
    while (!fn() && Date.now() < end) await new Promise((r) => setTimeout(r, 30));
    return fn();
  };

  (async () => {
    if (navigator.webdriver) el("stage").classList.add("recording");
    renderTabs();
    showPage(active);
    D.activeTabId = active.id;
    setSide(S.panelOpen !== false);
    el("extBtn").addEventListener("click", () => setSide(!el("side").classList.contains("open")));

    D.manifest = await (await D.realFetch("audio/manifest.json", { cache: "no-store" })).json().catch(() => ({ summaries: {}, clips: [] }));
    await mount("popup", el("panel"));
    if (S.options) await D.openOptions();

    // Scenes that start mid-listen press Play themselves (no simulated latency), then hand over
    if (S.autoPlay) {
      await until(() => document.querySelector(".play-btn"));
      document.querySelector(".play-btn").click();
      await until(() => document.querySelector(".card.playing"));
    }
    D.fast = false;

    const ready = document.createElement("div");
    ready.id = "stageReady";
    ready.hidden = true;
    ready.textContent = "ready";
    document.body.appendChild(ready);
  })().catch((e) => {
    console.error(e);
    const bad = document.createElement("div");
    bad.id = "stageError";
    bad.textContent = String(e && e.message || e);
    document.body.appendChild(bad);
  });
})();
