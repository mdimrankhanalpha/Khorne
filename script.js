"use strict";
/* KHORNE — infinite archive. To add posts, edit ONLY Post.txt.

   Post.txt: one record per line, fields separated by $
     TYPE$TITLE$DESCRIPTION$URL1$URL2$URL3...
   Types: TEXT PHOTO PHOTOS VIDEO VIDEOS PHOTO_VIDEO MIXED YOUTUBE AUDIO
   Blank lines and lines starting with # are ignored. Title, description and URLs are optional.
   Literal dollar sign: \$    Line break in a description: \n
   Lines without a TYPE word (TITLE$DESCRIPTION$URL...) are accepted; the type is detected from the URLs.
   Media kind is detected from the URL (YouTube patterns, extensions, data: MIME), with the TYPE as a hint.
   Block layout also works: if a line holds only $, it separates posts, and each line between two such lines is one field of that post.
   Identical records are treated as one. New records should be appended to the end of the file. */

const POST_SOURCE_URL = "https://github.com/mdimrankhanalpha/Khorne/blob/main/Post.txt";
const PROFILE_IMAGE_URL = "https://github.com/mdimrankhanalpha/Khorne/blob/main/761cdbe4a78cbfc8285553c930f21361.jpg";
const BATCH = 10, REFRESH_MS = 60000;

const TYPES = ["TEXT", "PHOTO", "PHOTOS", "VIDEO", "VIDEOS", "PHOTO_VIDEO", "MIXED", "YOUTUBE", "AUDIO"];
const IMG = /\.(jpe?g|png|webp|gif|avif|bmp|svg|apng|ico)$/i, VID = /\.(mp4|webm|ogv|mov|m4v)$/i, AUD = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)$/i;
const $ = s => document.querySelector(s);
function h(t, c, x) { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }

/* ---------- URLs ---------- */
function toRaw(u) { // normal GitHub blob/raw URL -> raw.githubusercontent.com
  u = u.trim();
  const m = u.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/i);
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3].split("?")[0]}` : u;
}
function yt(u) { const m = u.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([\w-]{11})/i); return m && m[1]; }
function kind(u, hint) {
  if (yt(u)) return "yt";
  const d = u.match(/^data:(\w+)/i);
  if (d) return { image: "img", video: "vid", audio: "aud" }[d[1].toLowerCase()] || "img";
  const p = u.split(/[?#]/)[0];
  if (IMG.test(p)) return "img"; if (VID.test(p)) return "vid"; if (AUD.test(p)) return "aud";
  return { VIDEO: "vid", VIDEOS: "vid", AUDIO: "aud" }[hint] || "img";
}
const isU = s => !/\s/.test(s) && (/^(https?:)?\/\//i.test(s) || /^data:/i.test(s) || IMG.test(s) || VID.test(s) || AUD.test(s));

/* ---------- Parser ---------- */
function splitFields(line) {
  const out = []; let cur = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\" && i + 1 < line.length) {
      const n = line[i + 1];
      if (n === "$") { cur += "$"; i++; continue; }
      if (n === "n") { cur += "\n"; i++; continue; }
      if (n === "\\") { cur += "\\"; i++; continue; }
    }
    if (c === "$") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}
function hash(s) { let x = 5381; for (let i = 0; i < s.length; i++) x = (x * 33 ^ s.charCodeAt(i)) >>> 0; return x.toString(36) + s.length; }
function autoType(ms) {
  const k = ms.map(m => m.k), n = (x) => k.filter(y => y === x).length;
  if (!k.length) return "TEXT";
  if (k.every(x => x === "yt")) return "YOUTUBE";
  if (k.every(x => x === "aud")) return "AUDIO";
  if (k.every(x => x === "img")) return k.length > 1 ? "PHOTOS" : "PHOTO";
  if (k.every(x => x === "vid")) return k.length > 1 ? "VIDEOS" : "VIDEO";
  return n("img") && n("vid") && k.length === n("img") + n("vid") ? "PHOTO_VIDEO" : "MIXED";
}
function rec(line, id) {
  const f = splitFields(line);
  let type = f[0].toUpperCase().replace(/[\s-]+/g, "_"), title = "", desc = "", urls = [];
  if (TYPES.includes(type)) {
    f.shift();
    [title, desc] = [f[0] || "", f[1] || ""];
    if (isU(title)) { urls.push(title); title = ""; }
    if (isU(desc)) { urls.push(desc); desc = ""; }
    f.slice(2).forEach(s => { if (isU(s)) urls.push(s); else if (s) desc += (desc ? " " : "") + s; });
  } else {
    const txt = f.filter(s => s && !isU(s));
    urls = f.filter(isU); title = txt[0] || ""; desc = txt.slice(1).join("\n"); type = "";
  }
  const media = urls.map(u => ({ k: kind(u, type), u: toRaw(u) }));
  if (!title && !desc && !media.length) return null;
  const s = (title + " " + desc).toLowerCase();
  return { id, title, desc, media, type: type || autoType(media), s, x: s + " " + (type || autoType(media)).toLowerCase() };
}
function parse(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map(l => l.trim());
  const units = [];
  if (lines.some(l => l === "$")) { // block mode: a line holding only $ separates posts
    let cur = [];
    lines.forEach(l => { if (l === "$") { if (cur.length) units.push(cur.join("$")); cur = []; } else if (l && l[0] !== "#") cur.push(l); });
    if (cur.length) units.push(cur.join("$"));
  } else lines.forEach(l => { if (l && l[0] !== "#") units.push(l); }); // one post per line
  const seen = new Set(), out = [];
  units.forEach(u => {
    const id = hash(u); if (seen.has(id)) return; seen.add(id);
    try { const r = rec(u, id); if (r) out.push(r); } catch (e) { /* skip malformed record */ }
  });
  return out;
}

/* ---------- Media ---------- */
let cur; function solo(m) { if (cur && cur !== m) cur.pause(); cur = m; }
const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { io.unobserve(e.target); fill(e.target); }
}), { rootMargin: "800px 400px" }) : null;
function lazy(el) { io ? io.observe(el) : fill(el); }
function fill(el) { el.src = el.dataset.src; if (el.tagName === "VIDEO") el.preload = "metadata"; }
const fmt = s => isFinite(s) ? Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0") : "0:00";
const lb = $("#lb"), lbi = lb.querySelector("img");
function zoom(u) { lbi.src = u; lb.hidden = false; document.body.style.overflow = "hidden"; }
function unzoom() { lb.hidden = true; lbi.removeAttribute("src"); document.body.style.overflow = ""; }
lb.onclick = e => { if (e.target === lb) unzoom(); };
$("#lbx").onclick = unzoom;
$("#lbf").onclick = () => { const f = lb.requestFullscreen || lb.webkitRequestFullscreen; if (f) f.call(lb); };
addEventListener("keydown", e => { if (e.key === "Escape") { if (!lb.hidden) unzoom(); else if (!$("#about").hidden) about(false); } });

function slot(cls, build) { // placeholder box with retry on failure
  const w = h("div", "m " + cls);
  const run = () => {
    w.className = "m " + cls;
    w.replaceChildren(build(() => {
      w.classList.add("bad");
      const b = h("button", "retry", "Retry"); b.onclick = run;
      w.replaceChildren(h("span", "", "Media unavailable"), b);
    }));
  };
  run(); return w;
}
function mk(m, r) {
  if (m.k === "aud") return slot("a", fail => {
    const w = h("div", "aud"), a = new Audio(), b = h("button", "pp", "▶"), g = h("input"), t = h("span", "tm", "0:00");
    a.preload = "none"; g.type = "range"; g.min = 0; g.max = 1000; g.value = 0; b.setAttribute("aria-label", "Play or pause"); g.setAttribute("aria-label", "Seek");
    b.onclick = () => { if (!a.src) a.src = m.u; a.paused ? a.play().catch(fail) : a.pause(); };
    a.onplay = () => { b.textContent = "❚❚"; solo(a); }; a.onpause = () => b.textContent = "▶";
    a.ontimeupdate = () => { g.value = a.duration ? a.currentTime / a.duration * 1000 : 0; t.textContent = fmt(a.currentTime) + " / " + fmt(a.duration); };
    g.oninput = () => { if (a.duration) a.currentTime = g.value / 1000 * a.duration; };
    a.onerror = fail; w.append(b, g, t); return w;
  });
  if (m.k === "img") return slot("", fail => {
    const i = new Image(); i.alt = r.title || "Khorne archive image"; i.decoding = "async"; i.dataset.src = m.u;
    i.onload = () => i.parentNode && i.parentNode.classList.add("ok"); i.onerror = fail; i.onclick = () => zoom(m.u); lazy(i); return i;
  });
  if (m.k === "vid") return slot("v", fail => {
    const v = document.createElement("video"); v.controls = true; v.playsInline = true; v.preload = "none"; v.dataset.src = m.u;
    v.onloadedmetadata = () => v.parentNode && v.parentNode.classList.add("ok"); v.onerror = fail; v.onplay = () => solo(v); lazy(v); return v;
  });
  return slot("v", () => {
    const f = document.createElement("iframe"); f.dataset.src = "https://www.youtube-nocookie.com/embed/" + yt(m.u);
    f.allow = "encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true; f.referrerPolicy = "strict-origin-when-cross-origin";
    f.title = r.title || "YouTube video"; f.onload = () => f.parentNode && f.parentNode.classList.add("ok"); lazy(f); return f;
  });
}
function gallery(ms, r) {
  const g = h("div", "gal"), t = h("div", "track"), c = h("span", "cnt", "1 / " + ms.length), p = h("button", "nav pv", "‹"), n = h("button", "nav nx", "›");
  ms.forEach(m => t.append(mk(m, r)));
  const go = d => t.scrollBy({ left: d * t.clientWidth, behavior: "smooth" });
  p.onclick = () => go(-1); n.onclick = () => go(1); p.setAttribute("aria-label", "Previous"); n.setAttribute("aria-label", "Next");
  t.onscroll = () => { c.textContent = (Math.round(t.scrollLeft / t.clientWidth) + 1) + " / " + ms.length; };
  g.append(t, p, n, c); return g;
}
function card(r) { // external text only ever goes in via textContent
  const a = h("article", "post" + (r.media.length ? "" : " txt")), hd = h("header");
  hd.append(h("span", "ty", "☠ " + r.type.replace(/_/g, " ")));
  if (r.title) hd.append(h("h3", "", r.title));
  a.append(hd);
  if (r.media.length) a.append(r.media.length > 1 ? gallery(r.media, r) : mk(r.media[0], r));
  if (r.desc) a.append(h("p", "ds", r.desc));
  return a;
}

/* ---------- Categories, state, feed ---------- */
const re = x => r => x.test(r.s), has = (r, k) => r.media.some(m => m.k === k);
const CATS = [
  ["The Blood God", re(/khorne|blood god|skull throne|brass citadel/)],
  ["Chaos Gods", re(/tzeentch|nurgle|slaanesh|chaos gods?|great game/)],
  ["Daemons", re(/daemon|bloodletter|flesh hound|juggernaut|bloodcrusher|skull cannon/)],
  ["Greater Daemons", re(/bloodthirster|greater daemon|skarbrand|ka.?bandha/)],
  ["Champions", re(/champion|kh[aâ]rn|valkia|warlord|angron/)],
  ["World Eaters", re(/world eaters?|war hounds|angron/)],
  ["Khorne Berzerkers", re(/berz?erker|eightbound/)],
  ["Weapons", re(/\baxe|blade|chainaxe|weapon|butcher.?s nails|artefact|artifact/)],
  ["Battles", re(/battle|siege|campaign|invasion|slaughter|\bwar\b/)],
  ["History", re(/heresy|history|chronicle|millennium|nuceria|signus|era indomitus/)],
  ["The Warp", re(/\bwarp\b|immaterium|empyrean/)],
  ["Artwork", r => has(r, "img") && /\bart(work)?\b|illustrat|paint|concept|render|sculpt|miniature/.test(r.s)],
  ["Photography", r => has(r, "img")],
  ["Videos", r => has(r, "vid") || has(r, "yt")],
  ["Audio", r => has(r, "aud")],
  ["All Posts", () => true]
];
const S = { all: [], ids: new Set(), view: [], n: 0, cat: 15, terms: [], text: null, fails: 0, busy: false, loaded: false, raf: 0, t: 0 };
const feed = $("#feed"), sent = $("#sent"), st = $("#st"), sync = $("#sync"), q = $("#q");
const match = r => CATS[S.cat][1](r) && S.terms.every(w => r.x.includes(w));
function note(t, btn) { st.replaceChildren(); if (t) st.append(h("span", "", t)); if (btn) { const b = h("button", "btn", btn[0]); b.onclick = btn[1]; st.append(b); } }
function empty() {
  if (!S.loaded) return;
  if (!S.all.length) note("The archive is empty. Add records to Post.txt; see the archivist’s guide under About Khorne.");
  else if (!S.view.length) note("No posts match. Try another search or category.", ["Clear filters", clear]);
  else note("");
}
function more() { const f = document.createDocumentFragment(); for (let i = 0; i < BATCH && S.n < S.view.length; i++) f.append(card(S.view[S.n++])); feed.append(f); }
function pump() { // render batches until the sentinel is well below the viewport
  if (S.raf) return;
  S.raf = requestAnimationFrame(() => { S.raf = 0; if (S.n < S.view.length && sent.getBoundingClientRect().top < innerHeight + 1600) { more(); pump(); } });
}
function rebuild() { feed.replaceChildren(); S.view = S.all.filter(match); S.n = 0; more(); pump(); empty(); }
function add(rs) {
  const f = rs.filter(r => !S.ids.has(r.id));
  f.forEach(r => { S.ids.add(r.id); S.all.push(r); if (match(r)) S.view.push(r); });
  if (f.length) pump();
}
if (io) new IntersectionObserver(es => { if (es[0].isIntersecting) pump(); }, { rootMargin: "1600px 0px" }).observe(sent);
else { addEventListener("scroll", pump, { passive: true }); addEventListener("resize", pump); }

/* ---------- Loading and revalidation ---------- */
async function load() {
  if (S.busy) return; S.busy = true;
  if (!S.loaded) note("Summoning the archive…");
  try {
    const u = toRaw(POST_SOURCE_URL); let r;
    try { r = await fetch(u, { cache: "no-cache" }); if (!r.ok) throw 0; } // browser sends conditional request (ETag)
    catch (e) { r = await fetch(u + (u.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "reload" }); if (!r.ok) throw 0; } // cache-bust retry
    const t = await r.text(); S.fails = 0; S.loaded = true;
    if (t !== S.text) { S.text = t; add(parse(t)); }
    sync.textContent = "Synced " + new Date().toLocaleTimeString(); empty();
  } catch (e) {
    S.fails++; sync.textContent = "Source unreachable, retrying";
    if (!S.loaded) note("Could not reach Post.txt. Check POST_SOURCE_URL and your connection.", ["Retry", load]);
  } finally { S.busy = false; clearTimeout(S.t); S.t = setTimeout(load, REFRESH_MS * 2 ** Math.min(S.fails, 4)); }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
addEventListener("online", load);

/* ---------- Search, categories, chrome ---------- */
const lore = [...document.querySelectorAll("#lore details")].map(d => ({ d, t: d.textContent.toLowerCase() }));
function search() {
  S.terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
  lore.forEach(({ d, t }) => { const ok = S.terms.every(w => t.includes(w)); d.hidden = !ok; if (S.terms.length) d.open = ok; });
  rebuild();
}
const bar = document.querySelector(".bar");
function box(on) { bar.classList.toggle("s", on); $("#sbtn").setAttribute("aria-expanded", on); if (on) q.focus(); else if (q.value) { q.value = ""; search(); } }
$("#sbtn").onclick = () => box(!bar.classList.contains("s"));
q.onkeydown = e => { if (e.key === "Escape") box(false); };
function about(on) { $("#about").hidden = !on; document.body.style.overflow = on ? "hidden" : ""; if (on) $("#about").scrollTop = 0; }
$("#abtn").onclick = () => about(true); $("#aclose").onclick = () => about(false);
let dt; q.oninput = () => { clearTimeout(dt); dt = setTimeout(search, 200); };
function setCat(i) { S.cat = i; [...$("#cats").children].forEach((b, j) => b.setAttribute("aria-pressed", j === i)); rebuild(); }
function clear() { q.value = ""; S.terms = []; lore.forEach(({ d }) => d.hidden = false); setCat(15); }
CATS.forEach(([n], i) => {
  const b = h("button"); b.append(h("b", "", String(i + 1).padStart(2, "0")), document.createTextNode(n));
  b.onclick = () => setCat(i); $("#cats").append(b);
});
$("#cats").children[15].setAttribute("aria-pressed", true);

document.querySelectorAll(".av").forEach(i => {
  i.src = toRaw(PROFILE_IMAGE_URL);
  i.onerror = () => { i.onerror = null; i.src = "761cdbe4a78cbfc8285553c930f21361.jpg"; }; // same-folder fallback
});
setTimeout(() => $("#splash").classList.add("gone"), 1400);
setTimeout(() => $("#splash").remove(), 2400);
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const e = $("#embers"), n = innerWidth < 600 ? 10 : 18;
  for (let i = 0; i < n; i++) {
    const s = h("i"), z = 2 + Math.random() * 3;
    s.style.cssText = `left:${Math.random() * 100}%;width:${z}px;height:${z}px;animation-duration:${9 + Math.random() * 10}s;animation-delay:${-Math.random() * 15}s`;
    e.append(s);
  }
}
load();
