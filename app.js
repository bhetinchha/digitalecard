'use strict';

/* Digital Business Card: offline preview / local storage starter.
 * No production authentication or public publishing is claimed here.
 */
const $ = (selector) => document.querySelector(selector);
const DEFAULT_PROFILE = {
  name: 'Nirajan Aryal', title: 'Digital Entrepreneur',
  company: 'Digital Business Card', location: 'Kathmandu, Nepal',
  phone: '9851113811', email: '', website: '',
  about: 'Connect smarter with a modern digital business identity.'
};
const STORAGE_KEY = 'dbc_local_preview_v1';
let state = readState();
let toastTimeout;

function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}) },
      cards: Array.isArray(parsed.cards) ? parsed.cards : [],
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      demoUser: parsed.demoUser || ''
    };
  } catch (error) {
    return { profile: { ...DEFAULT_PROFILE }, cards: [], saved: [], demoUser: '' };
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function notify(message, kind = '') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast show ${kind}`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.className = 'toast'; }, 3800);
}

async function withBusy(button, operation) {
  if (button.disabled) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Processing…';
  try {
    await operation();
  } catch (error) {
    notify(error.message || 'Something went wrong.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function showView(name) {
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('active', view.id === name);
  });
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.view === name);
  });
  $('#navigation').classList.remove('open');
  if (name === 'wallet') renderWallet();
  if (name === 'explore') renderDirectory();
}

function setText(selector, value) {
  $(selector).textContent = value || '—';
}

function renderProfile() {
  const p = state.profile;
  setText('#displayName', p.name);
  setText('#displayTitle', p.title);
  setText('#displayCompany', p.company);
  setText('#displayLocation', p.location);
  setText('#displayAbout', p.about);
  $('#portrait').textContent = (p.name || 'DB').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  $('#callLink').href = `tel:${(p.phone || '').replace(/[^+\d]/g, '')}`;
  $('#whatsappLink').href = `https://wa.me/${(p.phone || '').replace(/\D/g, '').replace(/^0/, '977')}`;
  $('#emailLink').href = `mailto:${p.email || ''}`;
  $('#websiteLink').href = /^https?:\/\//i.test(p.website || '') ? p.website : '#';
}

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function cardMarkup(card, isPublic = false) {
  const photo = card.front ? `<img src="${card.front}" alt="Original visiting card">` : '';
  return `<article class="wallet-card">
    ${photo}<h3>${escapeText(card.name)}</h3>
    <p>${escapeText(card.business)}</p><p>${escapeText(card.phone)}</p>
    <p>${escapeText(card.category)}</p><p>${escapeText(card.address)}</p>
    <div class="wallet-actions">
      <button class="button outline small" data-action="contact" data-id="${escapeText(card.id)}">Save Contact</button>
      ${isPublic ? `<button class="button small" data-action="save" data-id="${escapeText(card.id)}">Save to Wallet</button>` : `<button class="button small" data-action="delete" data-id="${escapeText(card.id)}">Remove</button>`}
    </div>
  </article>`;
}

function renderWallet() {
  const query = $('#walletSearch').value.trim().toLowerCase();
  const cards = state.cards.filter((card) =>
    [card.name, card.business, card.phone, card.email, card.category, card.address]
      .join(' ').toLowerCase().includes(query)
  );
  $('#walletList').innerHTML = cards.length ? cards.map((card) => cardMarkup(card)).join('') :
    '<div class="empty-state"><h3>No cards found</h3><p>Scan or add your first private visiting card.</p></div>';
}

function renderDirectory() {
  // The private collection is never used as the source of public directory results.
  $('#directoryList').innerHTML = '<div class="empty-state"><h3>No published cards yet</h3><p>Public profiles will appear only after owner verification and explicit publication consent through the secure backend.</p></div>';
}

function makeVCard(card) {
  const clean = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, '\\$&');
  return [
    'BEGIN:VCARD', 'VERSION:3.0', `FN:${clean(card.name)}`,
    `ORG:${clean(card.business || card.company)}`, `TITLE:${clean(card.title)}`,
    `TEL:${clean(card.phone)}`, `EMAIL:${clean(card.email)}`,
    `ADR:;;${clean(card.address || card.location)};;;;`,
    'END:VCARD'
  ].join('\r\n');
}

function downloadVCard(card) {
  const blob = new Blob([makeVCard(card)], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(card.name || 'contact').replace(/[^\w\- ]/g, '').trim() || 'contact'}.vcf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  notify('Contact file downloaded. Open it to import into your phone.', 'success');
}

function readImage(file) {
  if (!file) return Promise.resolve('');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return Promise.reject(new Error('Only JPG, PNG and WebP images are supported.'));
  }
  if (file.size > 2 * 1024 * 1024) {
    return Promise.reject(new Error('Each image must be smaller than 2 MB.'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function bindEvents() {
  $('#menuButton').addEventListener('click', () => $('#navigation').classList.toggle('open'));
  document.querySelectorAll('.nav-link').forEach((button) => {
    button.addEventListener('click', () => showView(button.dataset.view));
  });
  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => document.getElementById(button.dataset.close).close());
  });
  $('#editButton').addEventListener('click', () => {
    const form = $('#profileForm');
    Object.entries(state.profile).forEach(([key, value]) => {
      if (form.elements.namedItem(key)) form.elements.namedItem(key).value = value;
    });
    $('#editorDialog').showModal();
  });
  $('#profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    await withBusy($('#profileSave'), async () => {
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      state.profile = { ...state.profile, ...data };
      persist();
      renderProfile();
      $('#editorDialog').close();
      notify('Profile saved in this browser preview.', 'success');
    });
  });
  $('#addCardButton').addEventListener('click', () => $('#uploadDialog').showModal());
  $('#uploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    await withBusy($('#uploadSave'), async () => {
      const form = event.currentTarget;
      const data = new FormData(form);
      const phone = String(data.get('phone') || '').replace(/\D/g, '');
      const name = String(data.get('name') || '').trim();
      const business = String(data.get('business') || '').trim();
      const duplicate = state.cards.some((card) =>
        card.name.toLowerCase() === name.toLowerCase() &&
        card.business.toLowerCase() === business.toLowerCase() &&
        String(card.phone).replace(/\D/g, '') === phone
      );
      if (duplicate) throw new Error('This contact already exists in your wallet.');
      const card = {
        id: crypto.randomUUID(), name, business,
        phone: data.get('phone'), email: data.get('email'),
        category: data.get('category'), address: data.get('address'),
        notes: data.get('notes'), front: await readImage(data.get('front')),
        back: await readImage(data.get('back')), createdAt: new Date().toISOString()
      };
      state.cards.unshift(card);
      try { persist(); } catch (error) {
        state.cards.shift();
        throw new Error('Browser storage is full. Use smaller images or remove old cards.');
      }
      form.reset();
      $('#uploadDialog').close();
      renderWallet();
      notify('Card saved privately on this device.', 'success');
    });
  });
  $('#walletSearch').addEventListener('input', renderWallet);
  $('#directorySearch').addEventListener('input', renderDirectory);
  $('#walletList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const card = state.cards.find((item) => item.id === button.dataset.id);
    if (!card) return;
    if (button.dataset.action === 'contact') downloadVCard(card);
    if (button.dataset.action === 'delete') {
      // Confirm through a branded dialog in the production version.
      state.cards = state.cards.filter((item) => item.id !== card.id);
      persist();
      renderWallet();
      notify('Card removed from this browser.', 'success');
    }
  });
  $('#vcardButton').addEventListener('click', () => downloadVCard(state.profile));
  $('#shareButton').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify('Current page link copied. A public card URL requires backend publishing.', 'success');
    } catch (error) { notify('Could not copy link. Check browser permissions.', 'error'); }
  });
  $('#qrButton').addEventListener('click', async () => {
    const panel = $('#qrPanel');
    panel.hidden = !panel.hidden;
    if (panel.hidden) return;
    if (typeof QRCode === 'undefined') {
      notify('QR library unavailable. Check your internet connection.', 'error');
      return;
    }
    $('#qrCanvas').replaceChildren();
    try { await QRCode.toCanvas(window.location.href, { width: 180 }, (error, canvas) => {
      if (error) { notify('Could not generate QR.', 'error'); return; }
      $('#qrCanvas').appendChild(canvas);
    }); } catch (error) { notify('Could not generate QR.', 'error'); }
  });
  $('#loginButton').addEventListener('click', () => $('#authDialog').showModal());
  $('#authForm').addEventListener('submit', (event) => {
    event.preventDefault();
    state.demoUser = new FormData(event.currentTarget).get('display');
    persist();
    updateLoginUI();
    $('#authDialog').close();
    notify('Local preview activated. This is not a secure login.', 'success');
  });
  $('#logoutButton').addEventListener('click', async (event) => {
    await withBusy(event.currentTarget, async () => {
      state.demoUser = '';
      persist();
      updateLoginUI();
      showView('profile');
      notify('Local preview session closed.', 'success');
    });
  });
}

function updateLoginUI() {
  $('#loginButton').hidden = Boolean(state.demoUser);
  $('#logoutButton').hidden = !state.demoUser;
}

bindEvents();
renderProfile();
renderWallet();
renderDirectory();
updateLoginUI();
