
const API_BASE = "";
const VIDEO_PROXY = "https://vbplay.onrender.com/api/proxy?url=";
const PDF_VIEWER = "https://pdfweb.classx.co.in/pdfjs/web/viewer-new.html";
const HMAC_SECRET = "vb-x7k9m2p4q8r1t5w3y6";
const CLIENT_KEY = "kyu-re-madarchod";
const JWT_SECRET = "vb-jwt-s3cr3t-k3y-2024";
let cachedJwt = null;
let cachedJwtExpiry = 0;

const enc = new TextEncoder();
function b64url(bytesOrString) {
  const bytes = typeof bytesOrString === "string" ? enc.encode(bytesOrString) : new Uint8Array(bytesOrString);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function toHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function hmac(message, secret) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, enc.encode(message));
}
async function makeJwt() {
  const now = Date.now();
  if (cachedJwt && now < cachedJwtExpiry - 2000) return cachedJwt;
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iat: now, exp: now + 30000 }));
  const signingInput = `${header}.${payload}`;
  const sig = b64url(await hmac(signingInput, JWT_SECRET));
  cachedJwt = `${signingInput}.${sig}`;
  cachedJwtExpiry = now + 30000;
  return cachedJwt;
}
async function authHeaders() {
  const nonce = crypto.randomUUID();
  const timestamp = String(Date.now());
  return {
    "x-client-key": CLIENT_KEY,
    "x-nonce": nonce,
    "x-timestamp": timestamp,
    "x-signature": toHex(await hmac(nonce + timestamp, HMAC_SECRET)),
    "Authorization": `Bearer ${await makeJwt()}`
  };
}
async function request(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: await authHeaders() });
  if (!res.ok) {
    let detail = "";
    try { detail = JSON.stringify(await res.json()); } catch { detail = await res.text().catch(() => ""); }
    throw new Error(`Request failed (${res.status}) ${detail}`.trim());
  }
  return res.json();
}
export async function getCourses() {
  const data = await request(`/api/purchases`);
  const list = Array.isArray(data) ? data : data.data ?? data.courses ?? [];
  return list.map(row => {
    const course = row?.coursedt?.[0] ?? row;
    return {
      id: course.id ?? row.itemid ?? row.id,
      name: course.course_name ?? course.name ?? row.name ?? "Untitled",
      thumbnail: course.course_thumbnail ?? course.course_image_url ?? course.course_logo ?? "",
      raw: row
    };
  }).filter(c => c.id !== undefined && c.id !== null);
}
export async function getFolder(courseId, parentId) {
  const data = await request(`/api/folders?course_id=${encodeURIComponent(courseId)}&parent_id=${encodeURIComponent(parentId)}`);
  const list = Array.isArray(data) ? data : data.items ?? data.data ?? data.children ?? [];
  return list.map(item => ({
    ...item,
    id: item.id ?? item.content_id ?? item.video_id,
    title: item.Title || item.title || item.name || "Untitled",
    thumbnail: item.thumbnail || item.image_url || item.cover_image || "",
    material_type: item.material_type || item.type || item.content_type || "ITEM"
  }));
}
export async function getVideoStreams(courseId, item) {
  const videoId = item.video_id && item.video_id !== "" ? item.video_id : String(item.id);
  const data = await request(`/api/play?course_id=${encodeURIComponent(item.course_id || courseId)}&video_id=${encodeURIComponent(videoId)}`);
  const streams = [];
  if (Array.isArray(data.all)) {
    for (const stream of data.all) if (stream.url) streams.push({ quality: stream.quality || "Unknown", url: stream.url });
  } else if (data.best?.url) {
    streams.push({ quality: data.best.quality || "Best", url: data.best.url });
  } else if (data.url) {
    streams.push({ quality: "Default", url: data.url });
  }
  return streams;
}
export async function getPdfUrl(courseId, item) {
  const contentId = item.content_id || String(item.id);
  const data = await request(`/api/pdf?course_id=${encodeURIComponent(courseId)}&content_id=${encodeURIComponent(contentId)}`);
  return data.url || data.pdf_url || data.link || "";
}
export function proxiedVideoUrl(url) { return `${VIDEO_PROXY}${url}`; }
export function pdfViewerUrl(url) { return `${PDF_VIEWER}?file=${encodeURIComponent(url)}&save_flag=1`; }
export const ROOT_PARENT_BY_COURSE = { 35: 3929, 8: 13 };
setInterval(() => { makeJwt().catch(() => {}); }, 25000);
