'use strict';
/* Umumiy UI yordamchilari: element yaratish, xabar, modal oyna */
window.UI = (function () {
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v; // faqat o'zimiz yozgan statik belgilar uchun
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return el;
  }
  function toast(msg, isErr) {
    let box = document.querySelector('.toast-box');
    if (!box) { box = h('div', { class: 'toast-box', 'aria-live': 'polite' }); document.body.append(box); }
    const t = h('div', { class: 'toast' + (isErr ? ' err' : ''), text: msg });
    box.append(t);
    setTimeout(() => t.classList.add('out'), 3800);
    setTimeout(() => t.remove(), 4300);
  }
  function modal(title, bodyEl, opts) {
    opts = opts || {};
    const prevFocus = document.activeElement;
    const close = () => {
      overlay.classList.add('closing');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => { overlay.remove(); if (!document.querySelector('.overlay')) document.documentElement.classList.remove('locked'); if (opts.onClose) opts.onClose(); if (prevFocus && prevFocus.focus) prevFocus.focus(); }, 180);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, onclick: (e) => { if (e.target === overlay) close(); } },
      h('div', { class: 'modal ' + (opts.wide ? 'wide ' : '') + (opts.cls || '') },
        h('div', { class: 'modal-head' }, h('h3', { text: title }),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Yopish', onclick: close, text: '✕' })),
        bodyEl));
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    document.documentElement.classList.add('locked');
    const first = overlay.querySelector('[autofocus],input,textarea,select');
    if (first) first.focus(); else overlay.querySelector('.icon-btn').focus();
    return { close, el: overlay };
  }
  function confirmBox(text, okText) {
    return new Promise((resolve) => {
      let done = false;
      const body = h('div', { class: 'stack' }, h('p', { text }),
        h('div', { class: 'row-end' },
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Bekor qilish', onclick: () => m.close() }),
          h('button', { class: 'btn btn-danger btn-sm', type: 'button', text: okText || 'Oʻchirish', onclick: () => { done = true; resolve(true); m.close(); } })));
      const m = modal('Tasdiqlang', body, { onClose: () => { if (!done) resolve(false); } });
    });
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const date = (ms) => new Date(ms).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const img = (src) => (!src ? '' : /^(data:|https?:|\/)/.test(src) ? src : src);
  return { h, toast, modal, confirmBox, esc, date, img };
})();
