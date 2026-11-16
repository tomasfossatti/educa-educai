import { decodeCode, originsFor } from './codigo.js';

const $ = (id) => document.getElementById(id);

function ago(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.round(min / 60)} h`;
}

function message(text, error = false) {
  $('msg').textContent = text || '';
  $('msg').className = error ? 'err' : 'small';
}

async function render() {
  const s = await chrome.storage.local.get(['server', 'canvas', 'key', 'account', 'lastSync', 'error']);
  const linked = Boolean(s.key);
  $('unlinked').hidden = linked;
  $('linked').hidden = !linked;
  if (!linked) return;
  const state = $('state');
  state.textContent = '';
  if (s.error) {
    const p = document.createElement('span');
    p.className = 'err';
    p.textContent = s.error;
    state.append(p);
  } else {
    const ok = document.createElement('span');
    ok.className = 'ok';
    ok.textContent = 'Conectado';
    state.append(ok, document.createTextNode(s.account ? ` como ${s.account}` : ''), document.createElement('br'));
    const when = document.createElement('span');
    when.className = 'small';
    when.textContent = s.lastSync ? `Última sincronización: ${ago(s.lastSync)}` : '';
    state.append(when);
  }
  $('where').textContent = `Canvas: ${new URL(s.canvas).host} · Educai: ${new URL(s.server).host}`;
  $('open').hidden = !s.error;
}

$('link').addEventListener('click', () => {
  const raw = $('code').value;
  const code = decodeCode(raw);
  if (!code) return message('Ese código no es de Educai. Copialo de nuevo con el botón «Copiar código».', true);
  $('link').disabled = true;
  message('');
  // El permiso se pide en el clic (Chrome lo exige) y solo para los dos sitios del código.
  chrome.permissions.request({ origins: originsFor(code) }).then(async (granted) => {
    if (!granted) {
      $('link').disabled = false;
      return message('Sin permiso para esos dos sitios la extensión no puede leer tu sesión de Canvas.', true);
    }
    const r = await chrome.runtime.sendMessage({ type: 'link', code: raw });
    $('link').disabled = false;
    if (r?.ok) {
      $('code').value = '';
      message('Listo. Volvé a Educai: la conexión aparece sola.');
    } else if (r?.needsLogin) {
      message('Vinculada. Ahora entrá a Canvas e iniciá sesión.');
    } else {
      message(r?.error || 'No se pudo vincular.', true);
    }
    render();
  });
});

$('sync').addEventListener('click', async () => {
  $('sync').disabled = true;
  const r = await chrome.runtime.sendMessage({ type: 'sync' });
  $('sync').disabled = false;
  message(r?.ok ? 'Sincronizado.' : r?.error || 'No se pudo sincronizar.', !r?.ok);
  render();
});

$('open').addEventListener('click', async () => {
  const { canvas } = await chrome.storage.local.get('canvas');
  if (canvas) chrome.tabs.create({ url: canvas });
});

$('unlink').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'unlink' });
  message('Desvinculada. Educai deja de recibir tu sesión.');
  render();
});

render();
