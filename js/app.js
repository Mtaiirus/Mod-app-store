
import { getCourses, getFolder, getVideoStreams, getPdfUrl, proxiedVideoUrl, pdfViewerUrl, ROOT_PARENT_BY_COURSE } from "./extracted-api.js";

const app = document.getElementById("app");
const toastEl = document.getElementById("toast");
const state = { courses: [], selectedCourse: null, crumbs: [], items: [], loading: false, actionLoading: false, search: "" };

const icons = {
  FOLDER: "<svg viewBox='0 0 24 24'><path d='M3 6.8A2.8 2.8 0 0 1 5.8 4h4.5l2 2h5.9A2.8 2.8 0 0 1 21 8.8v8.4a2.8 2.8 0 0 1-2.8 2.8H5.8A2.8 2.8 0 0 1 3 17.2V6.8Z'/></svg>",
  VIDEO: "<svg viewBox='0 0 24 24'><path d='M8 5.8v12.4L18.5 12 8 5.8Z'/></svg>",
  PDF: "<svg viewBox='0 0 24 24'><path d='M7 2.8h7.2L19 7.6v13.6H7a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2Z'/><path d='M14 3v5h5M8 14h8M8 17h5'/></svg>",
  IMAGE: "<svg viewBox='0 0 24 24'><rect x='3' y='4' width='18' height='16' rx='3'/><circle cx='9' cy='10' r='1.8'/><path d='M4 17l4.8-4.8a2 2 0 0 1 2.8 0L14 14.6l1.3-1.3a2 2 0 0 1 2.8 0L21 16.2'/></svg>",
  ITEM: "<svg viewBox='0 0 24 24'><path d='M12 3 3.5 7.5 12 12l8.5-4.5L12 3Z'/><path d='M4 12.5 12 17l8-4.5M4 17l8 4.5 8-4.5'/></svg>"
};
function h(s = "") { return String(s).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); setTimeout(() => toastEl.classList.remove("show"), 3200); }
function skeletonCards(n = 6) { return Array.from({length:n}, () => `<div class="skeleton card"></div>`).join(""); }
function isImageType(type = "") { return ["IMAGE", "IMG", "PHOTO", "PICTURE"].includes(String(type).toUpperCase()); }
function getInlineUrl(item = {}) {
  return item.url || item.file_url || item.image_url || item.image || item.link || item.download_url || item.attachment || item.thumbnail || "";
}
function bindCourseButtons() {
  document.querySelectorAll("[data-course]").forEach(btn => btn.addEventListener("click", () => openCourse(btn.dataset.course)));
}
function renderCourseGridOnly() {
  const grid = document.querySelector(".courses");
  if (!grid) return;
  grid.innerHTML = courseCards();
  bindCourseButtons();
}
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function withContentLoader(task, minimumMs = 3000) {
  const overlay = document.createElement("div");
  overlay.className = "content-loader";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `<div class="loader-card scale-in">
    <div class="loader-symbol"><span></span></div>
    <div class="loader-copy">
      <strong>Loading your content...</strong>
      <small>POWERED BY STOIC WORKS</small>
    </div>
    <div class="loader-bar"><i></i></div>
  </div>`;
  document.body.appendChild(overlay);
  try {
    const [result] = await Promise.all([task(), wait(minimumMs)]);
    return result;
  } finally {
    overlay.classList.add("leaving");
    setTimeout(() => overlay.remove(), 240);
  }
}

async function init() {
  renderHome(true);
  try { state.courses = await getCourses(); }
  catch (err) { console.error(err); toast("Could not load courses. Check API/proxy deployment."); }
  renderHome(false);
}
function layout(inner) {
  app.innerHTML = `<section class="shell fade-in">${inner}<footer class="site-footer">© 2026 VIBRANT•STOIC WORKS</footer></section>`;
}
function header(subtitle = "") {
  return `<header class="hero">
    <div class="brand-mark"><img src="https://iili.io/BrtJBu1.jpg" alt="Vibrant" onerror="this.style.display='none'"></div>
    <div class="eyebrow">VIBRANT ACADEMY</div>
    <h1>Learn in focus mode.</h1>
    <p>${h(subtitle || "A rebuilt dark, minimal interface powered by the same API flow.")}</p>
  </header>`;
}
function renderHome(loading = false) {
  layout(`${header("Select a course and keep moving through lectures, folders and study material.")}
    <div class="toolbar glass">
      <div><span class="dot"></span>${state.courses.length || ""} courses available</div>
      <input id="search" value="${h(state.search)}" placeholder="Search courses" autocomplete="off" />
    </div>
    <section class="grid courses">
      ${loading ? skeletonCards(6) : courseCards()}
    </section>`);
  document.getElementById("search")?.addEventListener("input", e => { state.search = e.target.value; renderCourseGridOnly(); });
  bindCourseButtons();
}
function courseCards() {
  const q = state.search.trim().toLowerCase();
  const courses = q ? state.courses.filter(c => c.name.toLowerCase().includes(q)) : state.courses;
  if (!courses.length) return `<div class="empty">No courses found.</div>`;
  return courses.map((c, i) => `<button class="course-card lift" style="--d:${i*45}ms" data-course="${h(c.id)}">
    <div class="course-art">${c.thumbnail ? `<img src="${h(c.thumbnail)}" alt="${h(c.name)}">` : `<span>${icons.ITEM}</span>`}</div>
    <div class="course-copy"><small>COURSE</small><h2>${h(c.name)}</h2><p>Open library →</p></div>
  </button>`).join("");
}
async function openCourse(id) {
  const course = state.courses.find(c => String(c.id) === String(id));
  if (!course) return;
  state.selectedCourse = course;
  const rootId = ROOT_PARENT_BY_COURSE[course.id] ?? 13;
  state.crumbs = [{ id: rootId, title: course.name }];
  await loadFolder(rootId);
}
async function loadFolder(parentId) {
  state.loading = true; renderLibrary();
  try { state.items = await getFolder(state.selectedCourse.id, parentId); }
  catch (err) { console.error(err); state.items = []; toast("Could not load this folder."); }
  state.loading = false; renderLibrary();
}
function renderLibrary() {
  const course = state.selectedCourse;
  layout(`<nav class="topbar">
      <button class="ghost" id="backHome">← Courses</button>
      <div class="status-pill">${h(course?.name || "Library")}</div>
    </nav>
    <section class="library-head glass">
      <div><div class="eyebrow">CONTENT LIBRARY</div><h1>${h(course?.name || "Course")}</h1></div>
      <div class="pulse">${state.actionLoading ? "Loading item…" : "Ready"}</div>
    </section>
    <div class="crumbs">${state.crumbs.map((c, i) => `<button data-crumb="${i}" class="${i===state.crumbs.length-1?'active':''}">${h(c.title)}</button>`).join("<span>/</span>")}</div>
    <section class="list">
      ${state.loading ? skeletonRows(7) : itemRows()}
    </section>`);
  document.getElementById("backHome")?.addEventListener("click", () => { state.selectedCourse = null; state.items = []; state.crumbs = []; renderHome(false); });
  document.querySelectorAll("[data-crumb]").forEach(b => b.addEventListener("click", async () => {
    const idx = Number(b.dataset.crumb); state.crumbs = state.crumbs.slice(0, idx + 1); await loadFolder(state.crumbs[idx].id);
  }));
  document.querySelectorAll("[data-item]").forEach(b => b.addEventListener("click", () => openItem(Number(b.dataset.index))));
}
function skeletonRows(n) { return Array.from({length:n}, () => `<div class="skeleton row"></div>`).join(""); }
function itemRows() {
  if (!state.items.length) return `<div class="empty">This folder is empty.</div>`;
  return state.items.map((item, i) => {
    const type = String(item.material_type || "ITEM").toUpperCase();
    const icon = icons[type] || (type === "STUDY_MATERIAL" ? icons.PDF : (isImageType(type) ? icons.IMAGE : icons.ITEM));
    return `<button class="item-row lift" data-item="${h(item.id)}" data-index="${i}" style="--d:${i*25}ms">
      <div class="thumb ${type.toLowerCase()}">${item.thumbnail ? `<img src="${h(item.thumbnail)}" alt="${h(item.title)}">` : icon}</div>
      <div class="item-main"><small>${h(type.replace(/_/g," "))}</small><h3>${h(item.title)}</h3></div>
      <div class="arrow">${type === "FOLDER" ? "›" : "↗"}</div>
    </button>`;
  }).join("");
}
async function openItem(index) {
  const item = state.items[index];
  if (!item) return;
  const type = String(item.material_type || "").toUpperCase();
  if (type === "FOLDER") {
    state.crumbs.push({ id: item.id, title: item.title });
    await loadFolder(item.id);
    return;
  }
  try {
    if (type === "VIDEO") {
      const streams = await withContentLoader(async () => {
        const result = await getVideoStreams(state.selectedCourse.id, item);
        if (!result.length) throw new Error("No streams returned");
        return result;
      });
      showPlayer(item.title, streams);
    } else if (type === "PDF" || type === "STUDY_MATERIAL") {
      const url = await withContentLoader(async () => {
        const result = await getPdfUrl(state.selectedCourse.id, item);
        if (!result) throw new Error("No PDF URL returned");
        return result;
      });
      window.open(pdfViewerUrl(url), "_blank");
    } else if (isImageType(type)) {
      const url = await withContentLoader(async () => {
        const result = await getPdfUrl(state.selectedCourse.id, item).catch(() => "");
        return result || getInlineUrl(item);
      });
      if (!url) throw new Error("No image URL returned");
      showImageViewer(item.title, url);
    } else toast(`Unsupported item type: ${type || "unknown"}`);
  } catch (err) { console.error(err); toast("Unable to open this item."); }
}

function showImageViewer(title, url) {
  const overlay = document.createElement("div");
  overlay.className = "modal image-modal";
  overlay.innerHTML = `<div class="image-panel scale-in">
    <button class="close" aria-label="Close">×</button>
    <div class="player-title"><small>IMAGE VIEWER</small><h2>${h(title)}</h2></div>
    <div class="image-stage"><img src="${h(url)}" alt="${h(title)}"></div>
    <a class="open-original" href="${h(url)}" target="_blank" rel="noopener">Open original ↗</a>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".close").onclick = () => overlay.remove();
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}
function showPlayer(title, streams) {
  const overlay = document.createElement("div");
  overlay.className = "modal";
  const first = streams[0];
  overlay.innerHTML = `<div class="player-panel scale-in">
    <button class="close" aria-label="Close">×</button>
    <div class="player-title"><small>NOW PLAYING</small><h2>${h(title)}</h2></div>
    <video id="video" controls autoplay playsinline src="${h(proxiedVideoUrl(first.url))}"></video>
    <div class="quality-strip">${streams.map((s,i)=>`<button class="${i===0?'active':''}" data-stream="${i}">${h(s.quality)}</button>`).join("")}</div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".close").onclick = () => overlay.remove();
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelectorAll("[data-stream]").forEach(btn => btn.onclick = () => {
    overlay.querySelectorAll("[data-stream]").forEach(b => b.classList.remove("active")); btn.classList.add("active");
    overlay.querySelector("video").src = proxiedVideoUrl(streams[Number(btn.dataset.stream)].url);
  });
}
init();
