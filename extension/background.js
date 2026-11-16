import { decodeCode } from './codigo.js';

// Mantiene al día la sesión de Canvas en Educai:
// - manda la cookie cuando cambia (al iniciar sesión, cuando Canvas la renueva);
// - cada 10 minutos usa Canvas para que no cierre la sesión por inactividad;
// - si la cookie no cambió, la reenvía como mucho cada 30 minutos.
// Solo lee las cookies del Canvas vinculado y solo las manda al Educai que dio el código.

const ALARM = 'educai-renovar';
const RESEND_MS = 30 * 60 * 1000;
const KEYS = ['server', 'canvas', 'key', 'account', 'lastSync', 'lastDigest', 'error'];

const load = () => chrome.storage.local.get(KEYS);
const save = (patch) => chrome.storage.local.set(patch);

function badge(state) {
  chrome.action.setBadgeText({ text: state === 'ok' || state === 'off' ? '' : '!' });
  chrome.action.setBadgeBackgroundColor({ color: '#c4281c' });
}

async function digest(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function cookieHeader(canvas) {
  const list = await chrome.cookies.getAll({ url: canvas });
  if (!list.some((c) => c.name === 'canvas_session')) return null;
  return list.map((c) => `${c.name}=${c.value}`).join('; ');
}

async function sync({ force = false } = {}) {
  const s = await load();
  if (!s.key) {
    badge('off');
    return { ok: false, unlinked: true };
  }
  const header = await cookieHeader(s.canvas);
  if (!header) {
    const error = 'Entrá a Canvas e iniciá sesión. La extensión manda la sesión sola apenas entres.';
    await save({ error });
    badge('error');
    return { ok: false, needsLogin: true, error };
  }
  const hash = await digest(header);
  if (!force && hash === s.lastDigest && Date.now() - (s.lastSync || 0) < RESEND_MS && !s.error) {
    return { ok: true, account: s.account, skipped: true };
  }
  let res;
  try {
    res = await fetch(`${s.server}/api/lms/extension/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${s.key}` },
      body: JSON.stringify({ cookies: header }),
    });
  } catch {
    const error = 'No hay conexión con Educai. Se reintenta en unos minutos.';
    await save({ error });
    badge('error');
    return { ok: false, error };
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data.unlinked) {
    await chrome.storage.local.clear();
    badge('off');
    return { ok: false, unlinked: true, error: data.error };
  }
  if (!res.ok) {
    const error = data.error || 'Educai no pudo usar la sesión de Canvas.';
    await save({ error });
    badge('error');
    return { ok: false, error };
  }
  await save({ account: data.accountName, lastSync: Date.now(), lastDigest: hash, error: null });
  badge('ok');
  return { ok: true, account: data.accountName };
}

async function link(raw) {
  const code = decodeCode(raw);
  if (!code) return { ok: false, error: 'Ese código no es de Educai. Copialo de nuevo con el botón «Copiar código».' };
  let res;
  try {
    res = await fetch(`${code.server}/api/lms/extension/link`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: code.secret }),
    });
  } catch {
    return { ok: false, error: 'No pude llegar a Educai. Revisá la conexión y probá de nuevo.' };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || 'Educai rechazó el código.' };
  await chrome.storage.local.clear();
  await save({ server: code.server, canvas: data.canvasUrl || code.canvas, key: data.key });
  schedule();
  return sync({ force: true });
}

async function keepAlive() {
  const { key, canvas } = await load();
  if (!key) return;
  try {
    // Usar Canvas evita que cierre la sesión por inactividad; si la renueva, cambia la cookie.
    await fetch(`${canvas}/api/v1/users/self/profile`, { credentials: 'include', headers: { accept: 'application/json' } });
  } catch {}
  await sync();
}

function schedule() {
  chrome.alarms.create(ALARM, { periodInMinutes: 10 });
}

let pending = null;
chrome.cookies.onChanged.addListener(async ({ cookie, removed }) => {
  if (cookie.name !== 'canvas_session' || removed) return;
  const { canvas, key } = await load();
  if (!key || !canvas) return;
  const host = new URL(canvas).hostname;
  if (cookie.domain.replace(/^\./, '') !== host && !host.endsWith(cookie.domain)) return;
  clearTimeout(pending);
  pending = setTimeout(() => sync(), 3000);
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'link') link(msg.code).then(reply);
  else if (msg?.type === 'sync') sync({ force: true }).then(reply);
  else if (msg?.type === 'unlink') chrome.storage.local.clear().then(() => { badge('off'); reply({ ok: true }); });
  else return false;
  return true;
});

chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(() => {
  schedule();
  keepAlive();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) keepAlive();
});
