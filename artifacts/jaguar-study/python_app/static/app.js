(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const MAX_SOURCE_CHARS = 180000;
  const modesInfo = [
    ["summary", "Note summary"], ["tutor", "Tutor lesson"], ["cram", "Cram sheet"],
    ["objective", "Objective questions"], ["theory", "Theory"], ["timed", "Time-based exam"]
  ];
  const state = { signedIn: false, sets: [], selected: null, mode: "summary", files: [], working: false, loadingSets: false, pendingAuth: false, answers: {}, exam: null, examScheduleKey: "", examSchedule: { subject:"", date:"", pace:"1" }, sourceFiles: [], sourceLoaded: false, sourceIndex: 0, sourceUrls: [], sourceResizeObserver: null };
  const storage = {
    read(key, fallback = "") { try { return localStorage.getItem("jaguar-" + key) || fallback; } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem("jaguar-" + key, value); return true; } catch { return false; } }
  };
  const sourceDb = (() => {
    let opening;
    return () => {
      if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB is unavailable."));
      if (!opening) opening = new Promise((resolve, reject) => {
        const request = indexedDB.open("jaguar-original-sources", 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("studySets")) db.createObjectStore("studySets", { keyPath:"studySetId" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Could not open local source storage."));
      });
      return opening;
    };
  })();
  async function saveOriginals(studySetId, files) {
    const originals = files.filter(item => /\.(pdf|pptx)$/i.test(item.name)).map(item => ({
      name:item.name, type:item.file.type || (/\.pdf$/i.test(item.name) ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
      blob:item.file, slides:item.slides || []
    }));
    if (!originals.length) return;
    const db = await sourceDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("studySets","readwrite");
      tx.objectStore("studySets").put({ studySetId:String(studySetId), files:originals });
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }
  async function getOriginals(studySetId) {
    const db = await sourceDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction("studySets","readonly").objectStore("studySets").get(String(studySetId));
      request.onsuccess = () => resolve(request.result?.files || []);
      request.onerror = () => reject(request.error || new Error("Could not restore original documents."));
    });
  }
  async function removeOriginals(studySetId) {
    try {
      const db = await sourceDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction("studySets","readwrite");
        tx.objectStore("studySets").delete(String(studySetId));
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
    } catch {}
  }
  let pptxParserPromise;
  function loadPptxParser() {
    if (!pptxParserPromise) {
      pptxParserPromise = import("./pptx-parser.js").catch(error => {
        pptxParserPromise = null;
        throw error;
      });
    }
    return pptxParserPromise;
  }
  async function parsePowerPoint(blob) {
    const parser = await loadPptxParser();
    return parser.parsePptx(blob);
  }
  function slideText(slide) {
    return (slide.elements || []).flatMap(element =>
      element.text?.paragraphs?.map(paragraph =>
        (paragraph.runs || []).filter(run => !run.br).map(run => run.text || "").join("")
      ) || []
    ).map(line => line.trim()).filter(Boolean).join("\n");
  }
  function safeSlideColor(value) {
    return /^#[0-9a-f]{3,8}$/i.test(String(value || "")) ? value : "transparent";
  }
  function applySlideFill(node, fill) {
    if (!fill || fill.kind === "none") return;
    if (fill.kind === "solid") node.style.background = safeSlideColor(fill.color);
    else if (fill.kind === "grad") {
      const stops = (fill.stops || []).map(stop => `${safeSlideColor(stop.color)} ${Math.max(0, Math.min(100, Number(stop.pos) || 0))}%`);
      if (stops.length) node.style.background = `linear-gradient(${((Number(fill.angle) || 0) + 90) % 360}deg, ${stops.join(", ")})`;
    } else if (fill.kind === "image" && fill.src) {
      node.style.backgroundImage = `url("${String(fill.src).replace(/["\\\n\r]/g, "")}")`;
      node.style.backgroundRepeat = fill.tile ? "repeat" : "no-repeat";
      node.style.backgroundSize = fill.tile ? "auto" : "100% 100%";
    }
  }
  function createSlideText(textBody) {
    const root = document.createElement("div");
    root.className = "pptx-text";
    root.style.justifyContent = textBody.anchor === "middle" ? "center" : textBody.anchor === "bottom" ? "flex-end" : "flex-start";
    root.style.padding = `${textBody.insets[0]}px ${textBody.insets[1]}px ${textBody.insets[2]}px ${textBody.insets[3]}px`;
    root.style.whiteSpace = textBody.wrap ? "pre-wrap" : "pre";
    if (textBody.vertical) root.style.writingMode = "vertical-rl";
    (textBody.paragraphs || []).forEach(paragraph => {
      const p = document.createElement("p");
      const size = (paragraph.runs || []).reduce((max, run) => Math.max(max, Number(run.sizePt) || 0), 0) || Number(paragraph.emptySizePt) || 12;
      p.style.textAlign = paragraph.align || "left";
      p.style.marginLeft = `${Number(paragraph.marL) || 0}px`;
      p.style.textIndent = `${Number(paragraph.indent) || 0}px`;
      p.style.lineHeight = paragraph.lineSpacing ? `${Math.max(.7,Math.min(3.5,Number(paragraph.lineSpacing)*1.2))}` : "1.2";
      p.style.marginTop = paragraph.spaceBefore ? `${paragraph.spaceBefore}pt` : "0";
      p.style.marginBottom = paragraph.spaceAfter ? `${paragraph.spaceAfter}pt` : "0";
      p.style.fontSize = `${size}pt`;
      if (!paragraph.runs?.length) p.style.minHeight = `${(Number(paragraph.emptySizePt) || size) * 1.2}pt`;
      if (paragraph.bullet) {
        const bullet = document.createElement("span");
        bullet.className = "pptx-bullet";
        bullet.textContent = paragraph.bullet;
        p.append(bullet);
      }
      (paragraph.runs || []).forEach(run => {
        if (run.br) { p.append(document.createElement("br")); return; }
        const span = document.createElement("span");
        span.textContent = run.text || "";
        span.style.fontSize = `${Math.max(1,Math.min(200,Number(run.sizePt)||size))}pt`;
        span.style.fontWeight = run.bold ? "700" : "400";
        if (run.italic) span.style.fontStyle = "italic";
        if (run.underline) span.style.textDecoration = "underline";
        const runColor = safeSlideColor(run.color);
        span.style.color = runColor === "transparent" ? "#1c1622" : runColor;
        const font = String(run.font || "").replace(/[^a-z0-9 _-]/gi, "").slice(0,80);
        const fallback = /serif|garamond|times|georgia|cambria|book|palatino|baskerville/i.test(font) && !/sans/i.test(font)
          ? 'Georgia, "Times New Roman", serif'
          : /mono|courier|consol/i.test(font) ? "ui-monospace, monospace" : 'Calibri, Carlito, "Segoe UI", system-ui, sans-serif';
        span.style.fontFamily = font ? `"${font}", ${fallback}` : fallback;
        p.append(span);
      });
      root.append(p);
    });
    return root;
  }
  function createSlideShape(element) {
    const box = document.createElement("div");
    box.className = "pptx-element";
    box.dataset.layer = element.layer || "slide";
    Object.assign(box.style, {
      left: `${element.x}px`, top: `${element.y}px`, width: `${element.w}px`, height: `${element.h}px`,
      transform: element.rot || element.flipH || element.flipV
        ? `rotate(${Number(element.rot) || 0}deg) scale(${element.flipH ? -1 : 1}, ${element.flipV ? -1 : 1})`
        : ""
    });
    const geom = element.geom || { kind: "rect" };
    const radius = geom.kind === "ellipse" ? "50%" : geom.kind === "roundRect" ? `${Number(geom.radius) || 0}px` : "";
    const line = element.line;
    if (geom.kind === "path") {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.classList.add("pptx-fill");
      svg.setAttribute("viewBox", `0 0 ${Number(geom.vw) || 1} ${Number(geom.vh) || 1}`);
      svg.setAttribute("preserveAspectRatio", "none");
      const fillStyle = element.fill || { kind:"none" };
      let fillValue = "none";
      if (fillStyle.kind === "solid") fillValue = safeSlideColor(fillStyle.color);
      else if (fillStyle.kind === "grad") {
        const id = `gradient-${String(element.id || "shape").replace(/[^a-z0-9_-]/gi,"")}`;
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
        gradient.id = id;
        gradient.setAttribute("gradientTransform", `rotate(${Number(fillStyle.angle)||0} .5 .5)`);
        (fillStyle.stops || []).forEach(stop => {
          const point = document.createElementNS("http://www.w3.org/2000/svg", "stop");
          point.setAttribute("offset", `${Math.max(0,Math.min(100,Number(stop.pos)||0))}%`);
          point.setAttribute("stop-color", safeSlideColor(stop.color));
          gradient.append(point);
        });
        defs.append(gradient); svg.append(defs); fillValue = `url(#${id})`;
      } else if (fillStyle.kind === "image" && fillStyle.src) {
        const id = `pattern-${String(element.id || "shape").replace(/[^a-z0-9_-]/gi,"")}`;
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
        pattern.id = id; pattern.setAttribute("width","1"); pattern.setAttribute("height","1");
        pattern.setAttribute("patternContentUnits","objectBoundingBox");
        const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
        image.setAttribute("href", fillStyle.src); image.setAttribute("width","1"); image.setAttribute("height","1");
        image.setAttribute("preserveAspectRatio","none");
        pattern.append(image); defs.append(pattern); svg.append(defs); fillValue = `url(#${id})`;
      }
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", String(geom.d || ""));
      path.setAttribute("fill", fillValue);
      path.setAttribute("stroke", line?.color ? safeSlideColor(line.color) : "none");
      path.setAttribute("stroke-width", String(Math.max(0, Number(line?.width) || 0)));
      if (line?.dash) path.setAttribute("stroke-dasharray", "6 4");
      svg.append(path);
      box.append(svg);
    } else if (element.fill?.kind !== "none" || line) {
      const fill = document.createElement("div");
      fill.className = "pptx-fill";
      applySlideFill(fill, element.fill);
      if (radius) fill.style.borderRadius = radius;
      if (line) fill.style.border = `${Math.max(0, Number(line.width) || 0)}px ${line.dash ? "dashed" : "solid"} ${safeSlideColor(line.color)}`;
      box.append(fill);
    }
    if (element.image?.src) {
      const wrap = document.createElement("div");
      wrap.className = "pptx-fill pptx-image";
      if (radius) wrap.style.borderRadius = radius;
      const img = document.createElement("img");
      img.src = element.image.src;
      img.alt = "";
      img.draggable = false;
      const crop = element.image.crop || [0,0,0,0];
      const left = Number(crop[0]) || 0, top = Number(crop[1]) || 0;
      const width = Math.max(0.01, 1-left-(Number(crop[2])||0)), height = Math.max(0.01, 1-top-(Number(crop[3])||0));
      Object.assign(img.style, {
        position:"absolute", left:`${(-left/width)*100}%`, top:`${(-top/height)*100}%`,
        width:`${100/width}%`, height:`${100/height}%`, maxWidth:"none"
      });
      wrap.append(img);
      box.append(wrap);
    }
    if (element.text) {
      const text = document.createElement("div");
      text.className = "pptx-fill";
      if (element.flipH || element.flipV) text.style.transform = `scale(${element.flipH ? -1 : 1}, ${element.flipV ? -1 : 1})`;
      text.append(createSlideText(element.text));
      box.append(text);
    }
    return box;
  }
  function renderPptxSlide(mount, file, slideNumber) {
    const deck = file._deck, slide = deck?.slides?.[slideNumber];
    if (!mount || !deck || !slide) return;
    state.sourceResizeObserver?.disconnect();
    const frame = document.createElement("div");
    frame.className = "pptx-slide-frame";
    frame.style.aspectRatio = String(deck.ratio || 16/9);
    const stage = document.createElement("div");
    stage.className = "pptx-stage";
    stage.style.width = `${deck.width}px`;
    stage.style.height = `${deck.height}px`;
    applySlideFill(stage, slide.background);
    (slide.elements || []).forEach(element => stage.append(createSlideShape(element)));
    frame.append(stage);
    mount.replaceChildren(frame);
    const fit = () => {
      const scale = frame.clientWidth / (Number(deck.width) || 1);
      stage.style.transform = `scale(${scale})`;
    };
    requestAnimationFrame(fit);
    if ("ResizeObserver" in window) {
      state.sourceResizeObserver = new ResizeObserver(fit);
      state.sourceResizeObserver.observe(frame);
    }
  }
  const safeText = (value) => String(value ?? "").replace(/<\?xml[\s\S]*?\?>/gi, "").replace(/<\/?(?:w|a|r|p|m|xml):[^>]*>/gi, "").replace(/<[^>]*>/g, "").trim();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
  const toast = (message) => { const el = $("#toast"); el.textContent = message; el.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 3000); };
  const setError = (message) => { const el = $("#builder-error"); el.textContent = message; el.hidden = !message; };
  const api = async (url, options = {}) => {
    const response = await fetch(url, { credentials: "include", ...options, cache:"no-store", headers: { ...(options.body ? { "Content-Type":"application/json" } : {}), ...(options.headers || {}) } });
    if (response.status === 401 || response.status === 403) {
      state.signedIn = false;
      $("#public-home").hidden = false; $("#workspace").hidden = true;
      throw new Error("Please sign in to open your study workspace.");
    }
    if (!response.ok) {
      let reason = `Request failed (${response.status}).`;
      try { const body = await response.json(); reason = body.detail || body.error || reason; } catch {}
      throw new Error(reason);
    }
    if (response.status === 204) return null;
    return response.json();
  };
  function modeList(set) {
    const allowed = new Set((set.modes || []).map(String));
    return modesInfo.filter(([id]) => allowed.has(id));
  }
  function sourceName(set) { return safeText(set.sourceName || "Course notes"); }
  function title(set) { return safeText(set.title || sourceName(set)); }
  function subjectOf(set) {
    const label = title(set);
    return label.split(/\s+(?:—|–|-|:)\s+/)[0].trim() || label;
  }
  function createdTime(set) {
    const time = Date.parse(set.createdAt || "");
    return Number.isFinite(time) ? time : 0;
  }
  function formatSavedTime(value) {
    const time = Date.parse(value || "");
    if (!Number.isFinite(time)) return "Date unavailable";
    const days = Math.floor((Date.now() - time) / 86400000);
    if (days < 0) return `Saved ${new Date(time).toLocaleDateString(undefined, { month:"short", day:"numeric" })}`;
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return new Date(time).toLocaleDateString(undefined, { month:"short", day:"numeric" });
  }
  function renderExamSchedule() {
    const schedule = state.examSchedule;
    const daysLabel = $("#exam-days"), countdown = $("#exam-countdown-text"), estimate = $("#exam-estimate");
    const clearButton = $("#clear-exam-schedule");
    $("#exam-subject").value = schedule.subject;
    $("#exam-date").value = schedule.date;
    $("#exam-pace").value = schedule.pace;
    clearButton.hidden = !schedule.subject && !schedule.date;
    if (!schedule.date) {
      daysLabel.textContent = "—";
      countdown.textContent = "Add an exam date to start a countdown.";
      estimate.hidden = true;
      return;
    }
    const examDay = new Date(`${schedule.date}T00:00:00`);
    if (Number.isNaN(examDay.getTime())) {
      daysLabel.textContent = "—";
      countdown.textContent = "Choose a valid exam date.";
      estimate.hidden = true;
      return;
    }
    const today = new Date();
    today.setHours(0,0,0,0);
    const days = Math.round((examDay.getTime() - today.getTime()) / 86400000);
    daysLabel.textContent = days < 0 ? "Done" : days === 0 ? "Today" : String(days);
    countdown.textContent = days < 0
      ? "That date has passed."
      : days === 0
        ? `${schedule.subject || "Your exam"} is today.`
        : `${days === 1 ? "day" : "days"} to ${schedule.subject || "your exam"}`;
    if (days < 0) estimate.hidden = true;
    else {
      const hours = Math.round(days * Number(schedule.pace || 1) * 10) / 10;
      estimate.textContent = `${hours} study hours at your pace`;
      estimate.hidden = false;
    }
  }
  function initExamSchedule(userId) {
    const key = `jaguar-exam-schedule-${userId}`;
    if (!userId || state.examScheduleKey === key) return;
    state.examScheduleKey = key;
    const validPaces = new Set(["0.5","1","1.5","2","3","4"]);
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      state.examSchedule = {
        subject: typeof saved.subject === "string" ? saved.subject.slice(0,60) : "",
        date: typeof saved.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(saved.date) ? saved.date : "",
        pace: validPaces.has(String(saved.pace)) ? String(saved.pace) : "1",
      };
    } catch {
      state.examSchedule = { subject:"", date:"", pace:"1" };
    }
    const save = () => {
      state.examSchedule = {
        subject: $("#exam-subject").value.slice(0,60),
        date: $("#exam-date").value,
        pace: validPaces.has($("#exam-pace").value) ? $("#exam-pace").value : "1",
      };
      try { localStorage.setItem(key, JSON.stringify(state.examSchedule)); } catch {}
      renderExamSchedule();
    };
    $("#exam-subject").addEventListener("input", save);
    $("#exam-date").addEventListener("change", save);
    $("#exam-pace").addEventListener("change", save);
    $("#clear-exam-schedule").addEventListener("click", () => {
      state.examSchedule = { subject:"", date:"", pace:"1" };
      try { localStorage.setItem(key, JSON.stringify(state.examSchedule)); } catch {}
      renderExamSchedule();
    });
    renderExamSchedule();
  }
  function setModesView(items, target) {
    const container = $(target);
    container.innerHTML = "";
    items.forEach(([id,label]) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "nav-button" + (state.mode === id ? " active" : "");
      button.textContent = label; button.addEventListener("click", () => { state.mode = id; renderStudy(); });
      container.append(button);
    });
  }
  function showView(view) {
    ["home","saved","study","settings"].forEach((name) => { $("#view-" + name).hidden = name !== view; });
    $$(".nav-button[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    $("#top-context").textContent = view === "study" && state.selected ? title(state.selected) : view === "home" ? "Study sets" : view === "saved" ? "Your library" : "Preferences";
    if (view === "saved") renderSaved();
    if (view === "study") renderStudy();
    $("#main-content").focus({ preventScroll:true });
  }
  function markdown(source) {
    let text = safeText(source);
    if (!text) return '<p class="muted">This study mode has no content yet.</p>';
    // Strip accidental serialization fragments; source material is never rendered as markup.
    text = text.replace(/<\?xml[\s\S]*?\?>/gi, "").replace(/<[^>]+>/g, "");
    const inline = (s) => {
      let out = esc(s);
      out = out.replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
      return out;
    };
    const lines = text.replace(/\r/g,"").split("\n");
    let html = "", list = null, paragraph = [];
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
    const flushParagraph = () => { if (paragraph.length) { html += `<p>${paragraph.map(inline).join("<br>")}</p>`; paragraph = []; } };
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { flushParagraph(); closeList(); continue; }
      const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (heading) { flushParagraph(); closeList(); html += `<h${Math.min(4, heading[1].length)}>${inline(heading[2])}</h${Math.min(4, heading[1].length)}>`; continue; }
      if (/^\$\$.*\$\$$/.test(trimmed) || /^\\\[.*\\\]$/.test(trimmed)) {
        flushParagraph(); closeList(); html += `<div class="math-line" role="math" aria-label="${esc(trimmed.replace(/^\$\$|^\s*\\\[|\$\$$|\\\]\s*$/g,""))}">${inline(trimmed.replace(/^\$\$|^\s*\\\[|\$\$$|\\\]\s*$/g,""))}</div>`; continue;
      }
      const item = trimmed.match(/^([-*+]|\d+[.)])\s+(.+)$/);
      if (item) {
        flushParagraph(); const nextList = /^\d/.test(item[1]) ? "ol" : "ul";
        if (list !== nextList) { closeList(); html += `<${nextList}>`; list = nextList; }
        html += `<li>${inline(item[2])}</li>`; continue;
      }
      const quote = trimmed.match(/^>\s?(.*)$/);
      if (quote) { flushParagraph(); closeList(); html += `<blockquote>${inline(quote[1])}</blockquote>`; continue; }
      closeList(); paragraph.push(trimmed);
    }
    flushParagraph(); closeList();
    return html;
  }
  function renderSaved() {
    const target = $("#saved-page-list");
    if (!state.sets.length) {
      target.innerHTML = '<div class="empty"><strong>No saved study sets yet</strong><p>Once you make materials from your notes, your sets will appear here.</p></div>';
      return;
    }
    const groups = new Map();
    state.sets.forEach((set) => { const subject = subjectOf(set); if (!groups.has(subject)) groups.set(subject, []); groups.get(subject).push(set); });
    target.innerHTML = [...groups].sort(([a],[b]) => a.localeCompare(b)).map(([subject,sets]) => `
      <section class="subject-group"><h2>${esc(subject)}</h2><table class="set-table"><tbody>${sets.map(set => `
        <tr><td><button class="set-title-button" data-open="${esc(set.id)}">${esc(title(set))}</button><div class="faint">${esc(sourceName(set))} · ${esc((set.modes || []).map(m => modesInfo.find(x=>x[0]===m)?.[1] || m).join(", "))}</div></td>
        <td><button class="quiet" data-open="${esc(set.id)}">Open</button> <button class="danger-button" data-delete="${esc(set.id)}" aria-label="Delete ${esc(title(set))}">Delete</button></td></tr>`).join("")}</tbody></table></section>`).join("");
    $$("[data-open]", target).forEach((button) => button.addEventListener("click", () => openSet(button.dataset.open)));
    $$("[data-delete]", target).forEach((button) => button.addEventListener("click", () => deleteSet(button.dataset.delete)));
  }
  function renderHomeSets() {
    $("#saved-count").textContent = state.sets.length ? `(${state.sets.length})` : "";
    $("#activity-total").textContent = String(state.sets.length);
    const weekAgo = Date.now() - 7 * 86400000;
    $("#activity-week").textContent = String(state.sets.filter(set => {
      const time = createdTime(set);
      return time >= weekAgo && time <= Date.now();
    }).length);
  }
  async function loadSets() {
    if (state.loadingSets) return;
    state.loadingSets = true;
    try {
      const [data, profile] = await Promise.all([api("/api/study-sets"), api("/api/profile")]);
      state.sets = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      initExamSchedule(profile?.userId);
      state.signedIn = true;
      $("#public-home").hidden = true; $("#workspace").hidden = false;
      $("#public-load-error").hidden = true;
      $("#top-signin").hidden = true;
      renderHomeSets(); renderSaved();
      const initial = storage.read("profile-picture");
      const initialName = storage.read("display-name", "Study workspace");
      $("#sidebar-user").textContent = initialName;
      setAvatar(initial, initialName);
    } catch (error) {
      if (error.message.includes("sign in")) return;
      $("#public-load-message").textContent = error.message;
      $("#public-load-error").hidden = false;
    } finally { state.loadingSets = false; }
  }
  function setAvatar(data, fallback = "Jaguar") {
    const initial = (fallback.trim()[0] || "J").toUpperCase();
    ["#sidebar-avatar","#profile-preview"].forEach(sel => {
      const el = $(sel); if (!el) return;
      el.innerHTML = data ? `<img alt="" src="${data}">` : esc(initial);
    });
  }
  function openSet(id) {
    const found = state.sets.find(set => String(set.id) === String(id));
    if (!found) { toast("That study set is no longer in your library."); return; }
    state.sourceResizeObserver?.disconnect(); state.sourceResizeObserver = null;
    state.sourceUrls.forEach(url => URL.revokeObjectURL(url)); state.sourceUrls = [];
    state.selected = found; state.mode = modeList(found)[0]?.[0] || "summary"; state.answers = {};
    state.sourceFiles = []; state.sourceLoaded = false; state.sourceIndex = 0; state.sourceSlide = 0;
    state.exam = null;
    $("#mode-navigation").hidden = false;
    setModesView(modeList(found), "#side-modes"); setModesView(modeList(found), "#mobile-modes");
    showView("study");
    getOriginals(found.id).then(files => {
      if (state.selected?.id !== found.id) return;
      state.sourceFiles = files; state.sourceLoaded = true; sourcePane(found);
    }).catch(() => {
      if (state.selected?.id !== found.id) return;
      state.sourceFiles = []; state.sourceLoaded = true; sourcePane(found);
    });
  }
  function sourcePane(set) {
    state.sourceResizeObserver?.disconnect(); state.sourceResizeObserver = null;
    const source = safeText(set.sourceText || "");
    const previewable = state.sourceFiles;
    if (!state.sourceLoaded) {
      $("#study-sources").innerHTML = `<div class="source-name">${esc(sourceName(set))}</div><div class="source-empty" role="status">Checking this browser for the original documents…</div>`;
      return;
    }
    if (!previewable.length) {
      $("#study-sources").innerHTML = `<div class="source-name">${esc(sourceName(set))}</div><div class="source-empty"><div><strong>Original preview unavailable</strong><p class="helper">No original PDF or PowerPoint file is saved in this browser. The extracted source text remains available below.</p></div></div><details class="source-extracted"><summary>Read extracted source text</summary><div class="source-text">${esc(source || "Source text is not available in this saved set.")}</div></details>`;
      return;
    }
    state.sourceIndex = Math.min(state.sourceIndex, previewable.length-1);
    const selected = previewable[state.sourceIndex];
    const selector = previewable.length > 1
      ? `<label class="sr-only" for="source-doc-select">Choose original source</label><select id="source-doc-select" class="field" aria-label="Choose original source">${previewable.map((file,index)=>`<option value="${index}" ${index===state.sourceIndex?"selected":""}>${esc(file.name)}</option>`).join("")}</select>`
      : `<span class="source-name" style="flex:1">${esc(selected.name)}</span>`;
    let preview = "";
    if (/\.pdf$/i.test(selected.name)) {
      let url = selected._objectUrl;
      if (!url) { url = URL.createObjectURL(selected.blob); selected._objectUrl = url; state.sourceUrls.push(url); }
      preview = `<div class="source-preview"><iframe src="${url}#toolbar=1&navpanes=0" title="PDF preview: ${esc(selected.name)}"></iframe></div>`;
    } else {
      const textSlides = selected.slides || [];
      const slideCount = selected._deck?.slides.length || textSlides.length;
      if (selected._deckError) {
        preview = `<div class="source-empty" role="status">${esc(selected._deckError)}</div>`;
      } else if (!selected._deck) {
        preview = '<div class="source-preview"><div class="source-empty" role="status">Opening the original slide layout…</div></div>';
        if (!selected._deckLoading) {
          selected._deckLoading = true;
          parsePowerPoint(selected.blob).then(deck => {
            selected._deckLoading = false;
            if (state.selected?.id !== set.id || state.sourceFiles[state.sourceIndex] !== selected) {
              deck.urls.forEach(url => URL.revokeObjectURL(url));
              return;
            }
            selected._deck = deck;
            state.sourceUrls.push(...deck.urls);
            sourcePane(set);
          }).catch(error => {
            selected._deckLoading = false;
            selected._deckError = error.message || "These slides could not be opened for preview.";
            if (state.selected?.id === set.id && state.sourceFiles[state.sourceIndex] === selected) sourcePane(set);
          });
        }
      } else if (!slideCount) {
        preview = '<div class="source-empty">No slides were found in this PowerPoint file.</div>';
      } else {
        state.sourceSlide = Math.min(state.sourceSlide, slideCount - 1);
        const slide = selected._deck.slides[state.sourceSlide];
        const fonts = (selected._deck.fonts || []).filter(font => !/^(calibri|calibri light|arial|georgia|times new roman)$/i.test(font));
        const notes = [
          slide?.skipped ? `${slide.skipped} complex chart, table, diagram, or picture may be simplified.` : "",
          fonts.length ? `Some fonts use a close substitute (${fonts.slice(0, 3).join(", ")}).` : ""
        ].filter(Boolean).join(" ");
        preview = `<div class="source-preview"><div id="pptx-slide-mount"></div></div><div class="slide-caption"><span>Slide layout reconstructed from the PowerPoint</span><span>${esc(notes || "Text, images, colors, and placement are retained where supported.")}</span></div><div class="source-actions"><button type="button" data-slide="prev" ${state.sourceSlide===0?"disabled":""} aria-label="Previous slide">Previous</button><span class="faint" aria-live="polite">Slide ${state.sourceSlide+1} of ${slideCount}</span><button type="button" data-slide="next" ${state.sourceSlide>=slideCount-1?"disabled":""} aria-label="Next slide">Next</button></div>`;
      }
    }
    $("#study-sources").innerHTML = `<div class="source-name">${esc(sourceName(set))}</div><div class="source-tools">${selector}</div>${preview}<details class="source-extracted"><summary>Read extracted source text</summary><div class="source-text">${esc(source || "Source text is not available in this saved set.")}</div></details>`;
    if (selected._deck && /\.pptx$/i.test(selected.name)) {
      renderPptxSlide($("#pptx-slide-mount"), selected, state.sourceSlide);
    }
    $("#source-doc-select")?.addEventListener("change", event => { state.sourceIndex=Number(event.target.value); state.sourceSlide=0; sourcePane(set); });
    $$("[data-slide]", $("#study-sources")).forEach(button=>button.addEventListener("click",()=>{
      state.sourceSlide += button.dataset.slide==="next" ? 1 : -1; sourcePane(set);
    }));
  }
  function renderTerms(set) {
    const terms = Array.isArray(set.keyTerms) ? set.keyTerms : [];
    if (!terms.length) return '<p class="empty">No terms were saved for this set.</p>';
    return `<div class="term-list">${terms.map((term,i) => {
      const word = safeText(term.term || term.name || `Term ${i+1}`);
      const definition = safeText(term.definition || term.meaning || "");
      const mastered = (set.masteredTerms || []).includes(word);
      return `<article class="term"><button type="button" data-master="${esc(word)}" aria-pressed="${mastered}">${mastered ? "Mastered" : "Mark learned"}</button><div><strong>${esc(word)}</strong><p>${esc(definition)}</p></div></article>`;
    }).join("")}</div>`;
  }
  function questionsHtml(set, isExam = false) {
    const questions = Array.isArray(set.questions) ? set.questions : [];
    if (!questions.length) return '<p class="empty">No objective questions were saved for this set.</p>';
    return questions.map((q,i) => {
      const choices = Array.isArray(q.choices) ? q.choices : [];
      const chosen = state.answers[i] ?? state.exam?.answers?.[i];
      const reveal = chosen !== undefined;
      const answerIndex = Number(q.answerIndex);
      return `<article class="question"><h3>${i+1}. ${esc(safeText(q.prompt || ""))}</h3><div class="choices">${choices.map((choice,j)=>`<button class="choice ${chosen===j?"selected":""}" type="button" data-answer="${i}:${j}" aria-pressed="${chosen===j}"><span class="choice-letter">${String.fromCharCode(65+j)}</span>${esc(safeText(choice))}</button>`).join("")}</div>${reveal ? `<p class="feedback">${chosen===answerIndex ? "Correct." : `The answer is ${String.fromCharCode(65+answerIndex)}.`} ${esc(safeText(q.explanation || ""))}</p>` : ""}</article>`;
    }).join("");
  }
  function theoryHtml(set) {
    const items = Array.isArray(set.theoryQuestions) ? set.theoryQuestions : [];
    if (!items.length) return '<p class="empty">No theory questions were saved for this set.</p>';
    return items.map((q,i) => `<article class="theory-card"><h3>${i+1}. ${esc(safeText(q.prompt || ""))}</h3>${(q.parts || []).map(part=>{ const key=`${i}-${part.label}`; return `<div class="theory-part"><label for="theory-${i}-${esc(part.label)}">${esc(safeText(part.question || ""))}</label><textarea class="field" id="theory-${i}-${esc(part.label)}" data-written="${esc(key)}" placeholder="Write your answer...">${esc(state.exam?.written?.[key] || "")}</textarea>${part.modelAnswer ? `<details style="margin-top:8px"><summary class="muted">Show model answer</summary><div class="answer-block"><p>${esc(safeText(part.modelAnswer))}</p></div></details>` : ""}</div>`; }).join("")}</article>`).join("");
  }
  function timedHtml(set) {
    const questions = Array.isArray(set.questions) ? set.questions : [];
    const theory = Array.isArray(set.theoryQuestions) ? set.theoryQuestions : [];
    const duration = Math.max(1, Number(set.examMinutes) || 60);
    if (!questions.length || !theory.length) return '<div class="empty"><strong>This set does not contain both parts of a combined paper.</strong><p>Choose Time-based exam when creating a new set to generate the combined paper.</p></div>';
    if (!state.exam || state.exam.status === "idle") {
      return `<div class="exam-intro"><h2>Combined examination paper</h2><p class="muted">Time allowed: ${duration} minutes. Complete the objective section and written theory practice in one sitting.</p><ul class="helper"><li>One clock covers both sections.</li><li>Objective answers are scored after submission.</li><li>Theory responses can be reviewed against the saved model answers.</li></ul><button class="primary" id="start-exam" type="button">Start paper</button></div>`;
    }
    if (state.exam.status === "running") {
      const remain = Math.max(0, state.exam.deadline-Date.now());
      const mins = Math.floor(remain/60000), secs = Math.floor(remain/1000)%60;
      if (remain <= 0) {
        state.exam.status = "done";
        state.exam.score = questions.reduce((n,q,i)=>n+(state.answers[i]===Number(q.answerIndex)?1:0),0);
        storage.write(`exam-${set.id}`, JSON.stringify(state.exam));
        return timedHtml(set);
      }
      return `<div class="exam-bar"><strong>Paper in progress</strong><span id="live-timer" class="timer" role="timer">${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")} remaining</span></div><h3 style="margin:22px 0 8px">Section A · Objective</h3>${questionsHtml(set,true)}<h3 style="margin:28px 0 8px">Section B · Theory</h3>${theoryHtml(set)}<div class="exam-bar"><span class="helper">${Object.keys(state.answers).length}/${questions.length} objective answers</span><button id="submit-exam" class="primary" type="button">Submit paper</button></div>`;
    }
    return `<div class="empty"><strong>Paper submitted · score ${state.exam.score}/${questions.length}</strong><p>Theory answers are self-reviewed against the model answers below.</p><button id="restart-exam" class="quiet" type="button">Start a fresh attempt</button></div>${questionsHtml(set)}${theoryHtml(set)}`;
  }
  function renderStudy() {
    const set = state.selected;
    if (!set) { showView("saved"); return; }
    $("#study-title").textContent = title(set);
    $("#study-source").textContent = `${sourceName(set)}${set.createdAt ? " · " + new Date(set.createdAt).toLocaleDateString() : ""}`;
    sourcePane(set);
    const modes = modeList(set);
    if (!modes.some(([id]) => id === state.mode)) state.mode = modes[0]?.[0] || "summary";
    $("#study-tabs").innerHTML = modes.map(([id,label])=>`<button type="button" role="tab" class="tab" aria-selected="${state.mode===id}" data-mode="${id}">${esc(label)}</button>`).join("");
    const content = $("#study-content");
    if (state.mode === "summary") content.innerHTML = `<article class="markdown">${markdown(set.summary)}</article>`;
    else if (state.mode === "tutor") content.innerHTML = `<article class="markdown">${markdown(set.tutorLesson)}</article>`;
    else if (state.mode === "cram") content.innerHTML = (set.cramPoints || []).length ? `<ol class="cram-list">${set.cramPoints.map(x=>`<li>${markdown(x)}</li>`).join("")}</ol>` : '<p class="empty">No cram points were saved for this set.</p>';
    else if (state.mode === "objective") content.innerHTML = questionsHtml(set);
    else if (state.mode === "theory") content.innerHTML = theoryHtml(set);
    else if (state.mode === "timed") content.innerHTML = timedHtml(set);
    $$("#study-tabs [data-mode]").forEach(b => b.addEventListener("click", () => { state.mode = b.dataset.mode; renderStudy(); }));
    $$("[data-answer]", content).forEach(b => b.addEventListener("click", () => {
      const [i,j] = b.dataset.answer.split(":").map(Number); state.answers[i] = j;
      if (state.exam?.status === "running") { state.exam.answers = { ...state.answers }; storage.write(`exam-${set.id}`, JSON.stringify(state.exam)); }
      renderStudy();
    }));
    $$("[data-written]", content).forEach(input => input.addEventListener("input", () => {
      if (state.exam?.status !== "running") return;
      state.exam.written = { ...(state.exam.written || {}), [input.dataset.written]:input.value };
      storage.write(`exam-${set.id}`, JSON.stringify(state.exam));
    }));
    $$("[data-master]", content).forEach(b => b.addEventListener("click", () => { void toggleMaster(b.dataset.master); }));
    $("#start-exam")?.addEventListener("click", () => {
      state.exam = { status:"running", deadline:Date.now()+(Number(set.examMinutes)||60)*60000, score:0, answers:{}, written:{} };
      state.answers = {};
      storage.write(`exam-${set.id}`, JSON.stringify(state.exam));
      renderStudy(); startTimer();
    });
    $("#submit-exam")?.addEventListener("click", () => {
      if (!confirm("Submit this paper now?")) return;
      state.exam.status = "done"; state.exam.score = (set.questions||[]).reduce((n,q,i)=>n+(state.answers[i]===Number(q.answerIndex)?1:0),0);
      storage.write(`exam-${set.id}`, JSON.stringify(state.exam)); renderStudy();
    });
    $("#restart-exam")?.addEventListener("click", () => { state.exam = null; state.answers = {}; storage.write(`exam-${set.id}`,""); renderStudy(); });
    $("#mode-navigation").hidden = !modes.length;
    setModesView(modes, "#side-modes"); setModesView(modes, "#mobile-modes");
  }
  function startTimer() {
    clearInterval(startTimer.interval);
    startTimer.interval = setInterval(() => {
      if (state.mode !== "timed" || state.exam?.status !== "running") { clearInterval(startTimer.interval); return; }
      const time = $("#live-timer");
      if (!time) { renderStudy(); return; }
      const remain = Math.max(0,state.exam.deadline-Date.now());
      if (remain <= 0) {
        const set = state.selected;
        state.exam.status = "done";
        state.exam.score = (set.questions||[]).reduce((n,q,i)=>n+(state.answers[i]===Number(q.answerIndex)?1:0),0);
        storage.write(`exam-${set.id}`,JSON.stringify(state.exam)); renderStudy(); clearInterval(startTimer.interval); return;
      }
      time.textContent = `${String(Math.floor(remain/60000)).padStart(2,"0")}:${String(Math.floor(remain/1000)%60).padStart(2,"0")} remaining`;
    }, 1000);
  }
  async function toggleMaster(term) {
    const set = state.selected;
    const mastered = new Set(set.masteredTerms || []);
    mastered.has(term) ? mastered.delete(term) : mastered.add(term);
    const updated = { ...set, masteredTerms:[...mastered] };
    try {
      await api(`/api/study-sets/${encodeURIComponent(set.id)}`, { method:"PUT", body:JSON.stringify(toInput(updated)) });
      state.selected = updated; state.sets = state.sets.map(s=>s.id===set.id?updated:s);
      renderStudy(); toast("Study progress saved.");
    } catch (error) { toast(error.message); }
  }
  function toInput(set) {
    const keys = ["title","sourceName","sourceText","modes","summary","tutorLesson","keyTerms","cramPoints","questions","theoryQuestions","studyPlan","examMinutes","masteredTerms"];
    const out = {};
    keys.forEach(key => { if (set[key] !== undefined) out[key] = set[key]; });
    return out;
  }
  async function deleteSet(id) {
    const set = state.sets.find(s => String(s.id) === String(id));
    if (!set || !confirm(`Delete “${title(set)}” from your saved study sets?`)) return;
    try {
      await api(`/api/study-sets/${encodeURIComponent(set.id)}`, { method:"DELETE" });
      await removeOriginals(set.id);
      state.sets = state.sets.filter(s => s.id !== set.id);
      if (state.selected?.id === set.id) { state.selected = null; $("#mode-navigation").hidden = true; showView("saved"); }
      renderHomeSets(); renderSaved(); toast("Study set deleted.");
    } catch (error) { toast(error.message); }
  }
  async function readFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "txt" || ext === "md" || ext === "csv" || file.type.startsWith("text/")) return await file.text();
    if (ext === "pdf") {
      try {
        const pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
        const pdf = await pdfjs.getDocument({ data:new Uint8Array(await file.arrayBuffer()) }).promise;
        let text = "";
        for (let i=1;i<=pdf.numPages;i++) {
          const page = await pdf.getPage(i), content = await page.getTextContent();
          text += content.items.map(item=>item.str || "").join(" ") + "\n";
        }
        return text;
      } catch { throw new Error(`Could not extract readable text from ${file.name}. Try a text-based PDF or export it as text.`); }
    }
    if (ext === "docx") {
      try {
        const mammoth = await import("https://cdn.jsdelivr.net/npm/mammoth@1.8.0/+esm");
        const result = await mammoth.extractRawText({ arrayBuffer:await file.arrayBuffer() });
        return result.value;
      } catch { throw new Error(`Could not extract text from ${file.name}. Try a plain-text export.`); }
    }
    if (ext === "pptx") return await readPowerPoint(file);
    throw new Error(`${file.name} is not a supported text document.`);
  }
  async function readPowerPoint(file) {
    let deck;
    try {
      deck = await parsePowerPoint(file);
      const slides = deck.slides.map((slide, index) => {
        const text = slideText(slide);
        return { title:text.split("\n")[0] || `Slide ${index+1}`, text };
      });
      if (!slides.some(slide => slide.text)) throw new Error("No readable slide text was found.");
      return { text:slides.map((slide,index)=>`Slide ${index+1}: ${slide.text}`).join("\n\n"), slides };
    } catch (error) {
      const reason = error instanceof Error && error.message ? ` ${error.message}` : "";
      throw new Error(`Could not read the slides in ${file.name}.${reason}`);
    } finally {
      deck?.urls?.forEach(url => URL.revokeObjectURL(url));
    }
  }
  const fileSize = (n) => n < 1048576 ? `${Math.max(1,Math.round(n/1024))} KB` : `${(n/1048576).toFixed(1)} MB`;
  async function addFiles(list) {
    const files = [...list];
    for (const file of files) {
      const record = { file, name:file.name, status:"reading", text:"", error:"" };
      state.files.push(record); renderFiles();
      try {
        const parsed = await readFile(file);
        if (typeof parsed === "string") record.text = parsed.trim();
        else { record.text = parsed.text.trim(); record.slides = parsed.slides; }
        if (!record.text) throw new Error("No readable text was found.");
        record.status = "ready";
      } catch(error) { record.status = "error"; record.error = error.message; }
      renderFiles();
    }
  }
  function combinedSourceText() {
    return state.files.map(f=>`=== Source: ${f.name} ===\n${f.text}`).join("\n\n");
  }
  function renderFiles() {
    $("#file-list").innerHTML = state.files.map((f,i)=>`<div class="file-row"><span>${esc(f.name)} · ${fileSize(f.file.size)} · ${f.status==="reading"?"Reading…":f.status==="error"?esc(f.error):"Text ready"}</span><button type="button" data-remove-file="${i}" aria-label="Remove ${esc(f.name)}">Remove</button></div>`).join("");
    $$("[data-remove-file]").forEach(b=>b.addEventListener("click",()=>{state.files.splice(Number(b.dataset.removeFile),1);renderFiles();}));
    const total = combinedSourceText().length;
    const meter = $("#source-character-meter");
    meter.classList.toggle("over", total > MAX_SOURCE_CHARS);
    meter.setAttribute("aria-valuenow", String(Math.min(total, MAX_SOURCE_CHARS)));
    meter.setAttribute("aria-valuetext", `${total.toLocaleString()} of ${MAX_SOURCE_CHARS.toLocaleString()} characters`);
    $("span", meter).style.transform = `scaleX(${Math.min(1, total / MAX_SOURCE_CHARS)})`;
    $("#source-character-count").textContent = `${total.toLocaleString()} / ${MAX_SOURCE_CHARS.toLocaleString()} characters combined`;
  }
  async function generate() {
    if (state.working) return;
    setError("");
    const modes = $$('input[name="mode"]:checked').map(input=>input.value);
    if (!modes.length) return setError("Choose at least one study format.");
    const count = Number($("#question-count").value), minutes = Number($("#exam-minutes").value);
    if ((modes.includes("objective") || modes.includes("timed")) && (!Number.isInteger(count)||count<1||count>50)) return setError("Objective question count must be a whole number from 1 to 50.");
    if (modes.includes("timed") && (!Number.isInteger(minutes)||minutes<1||minutes>180)) return setError("Exam duration must be a whole number from 1 to 180 minutes.");
    if (!state.files.length) return setError("Add at least one source document first.");
    if (state.files.some(f=>f.status==="reading")) return setError("Wait for all source documents to finish reading.");
    if (state.files.some(f=>f.status==="error")) return setError("Remove any source document that could not be read.");
    const sourceText = combinedSourceText();
    const readable = sourceText.replace(/=== Source[^\n]*===/g,"").trim();
    if (readable.length < 120) return setError("There is not enough readable text in these documents. Add a longer note or a text-based PDF.");
    if (sourceText.length > MAX_SOURCE_CHARS) return setError(`The combined source text exceeds ${MAX_SOURCE_CHARS.toLocaleString()} characters. Remove a document or choose smaller files.`);
    const sourceName = state.files.map(f=>f.name).join(", ").slice(0,160);
    state.working = true;
    $("#generate-button").disabled = true; $("#generate-button").textContent = "Generating…";
    $("#builder-status").textContent = "Reading your sources and preparing the selected formats.";
    try {
      const payload = { sourceName, sourceText, hoursPerDay:1, questionCount:(modes.includes("objective")||modes.includes("timed"))?count:10, modes, ...(modes.includes("timed")?{examMinutes:minutes}:{}) };
      const result = await api("/api/study/generate", { method:"POST", body:JSON.stringify(payload) });
      const set = { ...result, id:result.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`), createdAt:result.createdAt || new Date().toISOString(), modes:result.modes || modes, sourceName, sourceText, examMinutes:result.examMinutes || (modes.includes("timed")?minutes:undefined), masteredTerms:result.masteredTerms || [] };
      const saved = await api(`/api/study-sets/${encodeURIComponent(set.id)}`, { method:"PUT", body:JSON.stringify(toInput(set)) });
      const finalSet = saved && typeof saved === "object" ? { ...set, ...saved, sourceName, sourceText } : set;
      try { await saveOriginals(finalSet.id, state.files); }
      catch { toast("The study set was saved, but original previews could not be kept in this browser."); }
      state.sets = [finalSet, ...state.sets.filter(s=>s.id!==finalSet.id)];
      state.files = []; renderFiles(); renderHomeSets(); renderSaved();
      openSet(finalSet.id); toast("Your study materials are ready.");
    } catch(error) {
      setError(error.message || "We could not generate this study set. Try again.");
    } finally {
      state.working = false; $("#generate-button").disabled = false; $("#generate-button").textContent = "Generate study materials"; $("#builder-status").textContent = "";
    }
  }
  function initSettings() {
    const accent = storage.read("accent","violet");
    document.documentElement.dataset.accent = accent;
    $("#accent-rose").setAttribute("aria-pressed",String(accent==="rose"));
    $("#accent-violet").setAttribute("aria-pressed",String(accent==="violet"));
    const picture = storage.read("profile-picture"), banner = storage.read("profile-banner");
    setAvatar(picture, storage.read("display-name","Jaguar"));
    if (banner) $("#banner-preview").style.backgroundImage = `url("${banner}")`;
    [["rose","#accent-rose"],["violet","#accent-violet"]].forEach(([value,selector])=>$(selector).addEventListener("click",()=>{
      storage.write("accent",value); document.documentElement.dataset.accent = value;
      $("#accent-rose").setAttribute("aria-pressed",String(value==="rose")); $("#accent-violet").setAttribute("aria-pressed",String(value==="violet"));
    }));
    $("#profile-picture").addEventListener("change", e=>storeImage(e.target.files?.[0],"profile-picture"));
    $("#profile-banner").addEventListener("change", e=>storeImage(e.target.files?.[0],"profile-banner"));
  }
  function storeImage(file,key) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { $("#settings-status").textContent="Choose an image file."; return; }
    if (file.size > 4*1024*1024) { $("#settings-status").textContent="Please choose an image under 4 MB."; return; }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result);
      if (!storage.write(key,data)) { $("#settings-status").textContent="This browser cannot save that image. Try a smaller file."; return; }
      if (key==="profile-picture") setAvatar(data,storage.read("display-name","Jaguar"));
      else $("#banner-preview").style.backgroundImage = `url("${data}")`;
      $("#settings-status").textContent="Saved in this browser.";
    };
    reader.readAsDataURL(file);
  }
  function bind() {
    $$("[data-view]").forEach(button=>button.addEventListener("click", e=>{ e.preventDefault(); showView(button.dataset.view); }));
    $$("[data-auth-link]").forEach(link=>link.addEventListener("click",()=>{state.pendingAuth=true;}));
    $("#retry-public-load").addEventListener("click",()=>{ void loadSets(); });
    window.addEventListener("focus",()=>{ if (state.pendingAuth) { state.pendingAuth=false; void loadSets(); } });
    $("#study-back").addEventListener("click",()=>showView("saved"));
    $("#study-delete").addEventListener("click",()=>state.selected && deleteSet(state.selected.id));
    $("#generate-button").addEventListener("click",generate);
    $("#source-files").addEventListener("change",e=>{ void addFiles(e.target.files || []); e.target.value=""; });
    const zone=$("#dropzone");
    zone.addEventListener("dragover",e=>{e.preventDefault();zone.classList.add("drag");});
    zone.addEventListener("dragleave",()=>zone.classList.remove("drag"));
    zone.addEventListener("drop",e=>{e.preventDefault();zone.classList.remove("drag");void addFiles(e.dataTransfer.files);});
    $("#mode-list").addEventListener("change",()=>{
      const modes=$$('input[name="mode"]:checked').map(i=>i.value);
      $("#mode-fields").hidden=!(modes.includes("objective")||modes.includes("timed"));
      $("#question-count-wrap").hidden=!(modes.includes("objective")||modes.includes("timed"));
      $("#exam-minutes-wrap").hidden=!modes.includes("timed");
    });
  }
  bind(); initSettings();
  $("#public-home").hidden = false; $("#workspace").hidden = true;
  showView("home");
  void loadSets();
  // Recover a timed attempt only after the corresponding saved set has loaded.
  const originalOpenSet = openSet;
  openSet = function(id) {
    originalOpenSet(id);
    if (!state.selected) return;
    try {
      const saved = JSON.parse(storage.read(`exam-${state.selected.id}`,"null"));
      if (saved?.status==="running" && saved.deadline>Date.now()) { state.exam=saved; state.answers=saved.answers || {}; state.mode="timed"; renderStudy(); startTimer(); }
      else if (saved?.status==="running") {
        state.exam={...saved,status:"done",score:(state.selected.questions||[]).reduce((n,q,i)=>n+((saved.answers || {})[i]===Number(q.answerIndex)?1:0),0)};
        storage.write(`exam-${state.selected.id}`,JSON.stringify(state.exam));
        state.answers=saved.answers || {};
      } else if (saved?.status==="done") { state.exam=saved; state.answers=saved.answers || {}; }
    } catch {}
  };
})();
