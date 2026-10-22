import QRCode from 'qrcode';
import './style.css';

const state = { type: 'url', value: '', size: 512, dark: '#171717', light: '#ffffff', level: 'M' };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const canvas = $('#qrCanvas');
const emptyState = $('#emptyState');
let renderTimer;
let lastValue = '';

const escapeWifi = (value) => value.replace(/([\\;,:"])/g, '\\$1');
const escapeVCard = (value) => value.replace(/\\/g, '\\\\').replace(/([;,])/g, '\\$1').replace(/\r?\n/g, '\\n');

function getValue() {
  if (state.type === 'text') return $('#textInput').value.trim();
  if (state.type === 'wifi') {
    const ssid = $('#ssidInput').value.trim();
    if (!ssid) return '';
    const security = $('#securityInput').value;
    const password = $('#passwordInput').value;
    return `WIFI:T:${security};S:${escapeWifi(ssid)};P:${escapeWifi(password)};;`;
  }
  if (state.type === 'contact') {
    const name = $('#contactName').value.trim();
    if (!name) return '';
    const phone = $('#contactPhone').value.trim();
    const email = $('#contactEmail').value.trim();
    const company = $('#contactCompany').value.trim();
    const website = $('#contactUrl').value.trim();
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:;${escapeVCard(name)};;;`, `FN:${escapeVCard(name)}`];
    if (company) lines.push(`ORG:${escapeVCard(company)}`);
    if (phone) lines.push(`TEL;TYPE=CELL:${escapeVCard(phone)}`);
    if (email) lines.push(`EMAIL:${escapeVCard(email)}`);
    if (website) lines.push(`URL:${escapeVCard(website)}`);
    lines.push('END:VCARD');
    return lines.join('\n');
  }
  const url = $('#urlInput').value.trim();
  if (!url || url === 'https://') return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function currentOptions(width = state.size) {
  return { width, margin: 3, errorCorrectionLevel: state.level, color: { dark: state.dark, light: state.light } };
}

async function renderQr() {
  const value = getValue();
  state.value = value;
  const isEmpty = !value;
  emptyState.hidden = !isEmpty;
  canvas.hidden = isEmpty;
  $('#qrCaption').classList.toggle('is-hidden', isEmpty);
  $('#downloadPng').disabled = isEmpty;
  $('#downloadSvg').disabled = isEmpty;
  $('#copyButton').disabled = isEmpty;
  $('#liveStatus').classList.toggle('is-off', isEmpty);

  if (isEmpty) return;
  try {
    await QRCode.toCanvas(canvas, value, currentOptions(state.size));
    lastValue = value;
  } catch (error) {
    showToast('El contenido es demasiado largo');
    console.error(error);
  }
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderQr, 120);
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

$$('.type-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    state.type = tab.dataset.type;
    $$('.type-tab').forEach((item) => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', active);
    });
    $$('.content-fields').forEach((group) => { group.hidden = true; });
    $(`#${state.type}Fields`).hidden = false;
    scheduleRender();
  });
});

['#urlInput', '#textInput', '#ssidInput', '#passwordInput', '#securityInput', '#contactName', '#contactPhone', '#contactEmail', '#contactCompany', '#contactUrl'].forEach((selector) => {
  $(selector).addEventListener('input', () => {
    if (selector === '#textInput') $('#charCount').textContent = $('#textInput').value.length;
    scheduleRender();
  });
});

$('#darkColor').addEventListener('input', (event) => {
  state.dark = event.target.value;
  $('#darkColorValue').textContent = state.dark.toUpperCase();
  scheduleRender();
});

$('#lightColor').addEventListener('input', (event) => {
  state.light = event.target.value;
  $('#lightColorValue').textContent = state.light.toUpperCase();
  scheduleRender();
});

$('#sizeInput').addEventListener('input', (event) => {
  state.size = Number(event.target.value);
  $('#sizeOutput').textContent = `${state.size} px`;
  const progress = ((state.size - 256) / (1024 - 256)) * 100;
  event.target.style.setProperty('--range-progress', `${progress}%`);
  scheduleRender();
});

$$('input[name="level"]').forEach((radio) => {
  radio.addEventListener('change', (event) => {
    state.level = event.target.value;
    scheduleRender();
  });
});

$('#downloadPng').addEventListener('click', () => {
  if (!state.value) return;
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, 'codigo-qr.png');
  }, 'image/png');
  showToast('PNG preparado para descargar');
});

$('#downloadSvg').addEventListener('click', async () => {
  if (!state.value) return;
  const svg = await QRCode.toString(state.value, { ...currentOptions(), type: 'svg' });
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'codigo-qr.svg');
  showToast('SVG preparado para descargar');
});

$('#copyButton').addEventListener('click', async () => {
  if (!state.value) return;
  try {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    showToast('Imagen copiada al portapapeles');
  } catch {
    showToast('Tu navegador no permite copiar imágenes');
  }
});

$('#sizeInput').dispatchEvent(new Event('input'));
renderQr();

window.addEventListener('focus', () => {
  if (state.value && state.value !== lastValue) renderQr();
});
