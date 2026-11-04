/* Student feedback box. Sends to a teacher-owned Google Form (see js/feedback-config.js).
 * No form configured → students copy the text instead. Unsent notes are kept in
 * localStorage and retried the next time the box opens. */
(function () {
  const SEHS = (window.SEHS = window.SEHS || {});
  const QKEY = 'kinetic-escape-feedback-queue-v1';
  const NKEY = 'kinetic-escape-feedback-name-v1';

  function ls(get, k, v) {
    try { if (get) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* storage blocked */ }
    return null;
  }

  // Parse a Google Form pre-filled link → { action, name, game, feedback } entry ids.
  function parseLink(link) {
    if (!link) return null;
    const m = /\/forms\/d\/e\/([A-Za-z0-9_-]+)\//.exec(link);
    if (!m) return null;
    const ids = [], byVal = {};
    const re = /[?&](entry\.\d+)=([^&#]*)/g;
    let r;
    while ((r = re.exec(link))) {
      ids.push(r[1]);
      let v = '';
      try { v = decodeURIComponent(r[2].replace(/\+/g, ' ')).trim().toLowerCase(); } catch (e) { v = ''; }
      if (v) byVal[v] = r[1];
    }
    if (!ids.length) return null;
    const pick = (word, i) => byVal[word] || ids[i] || null;
    return {
      action: `https://docs.google.com/forms/d/e/${m[1]}/formResponse`,
      name: pick('name', 0), game: pick('game', 1), feedback: pick('feedback', ids.length >= 3 ? 2 : ids.length - 1),
    };
  }

  function form() { return parseLink(SEHS.FEEDBACK_FORM_LINK); }

  function post(f, item) {
    const body = new URLSearchParams();
    if (f.name) body.append(f.name, item.name || '(no name)');
    if (f.game && f.game !== f.feedback) body.append(f.game, item.game);
    body.append(f.feedback, f.game && f.game !== f.feedback ? item.text : `[${item.game}] ${item.text}`);
    // no-cors: Google Forms accepts the POST; the reply is opaque, so a resolved fetch = sent.
    return fetch(f.action, { method: 'POST', mode: 'no-cors', body });
  }

  function queue() { try { return JSON.parse(ls(true, QKEY) || '[]') || []; } catch (e) { return []; } }
  function setQueue(q) { ls(false, QKEY, JSON.stringify(q.slice(-20))); }

  async function flush() {
    const f = form();
    if (!f || !window.fetch) return 0;
    const q = queue();
    if (!q.length) return 0;
    const left = [];
    for (const item of q) { try { await post(f, item); } catch (e) { left.push(item); } }
    setQueue(left);
    return q.length - left.length;
  }

  // ctx(): returns a short string like "Drone Defense · wave 3" (optional)
  function open(opts) {
    opts = opts || {};
    const old = document.getElementById('feedback-box');
    if (old) old.remove();
    const f = form();
    const wrap = document.createElement('div');
    wrap.id = 'feedback-box';
    wrap.className = 'screen';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Send feedback');
    const game = opts.game || 'Kinetic Escape';
    wrap.innerHTML = `<div class="panel fb-panel">
      <div class="kicker">💬 FEEDBACK FOR YOUR TEACHER</div>
      <h2>What should we fix or add?</h2>
      <p class="dim">Bugs, confusing questions, what was fun, what was boring. Be specific (which hazard, which wave).</p>
      <label class="fb-l">Your name <input type="text" id="fb-name" maxlength="60" autocomplete="name"></label>
      <div class="fb-l">About <b id="fb-game"></b></div>
      <textarea id="fb-text" rows="6" maxlength="2000" placeholder="Type your feedback here…"></textarea>
      <div id="fb-msg" class="dim" aria-live="polite"></div>
      <div class="row">
        <button class="ghost" data-act="close">Close</button>
        <button class="primary" data-act="send">${f ? 'Send ▶' : 'Copy text 📋'}</button>
      </div></div>`;
    (document.getElementById('stage') || document.body).appendChild(wrap);
    const $ = (s) => wrap.querySelector(s);
    $('#fb-game').textContent = game;
    $('#fb-name').value = ls(true, NKEY) || '';
    const msg = $('#fb-msg');
    wrap.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') close(); });
    function close() { wrap.remove(); if (opts.onClose) opts.onClose(); }
    $('[data-act="close"]').addEventListener('click', close);
    $('[data-act="send"]').addEventListener('click', async () => {
      const text = $('#fb-text').value.trim();
      const name = $('#fb-name').value.trim();
      if (!text) { msg.textContent = 'Type some feedback first.'; $('#fb-text').focus(); return; }
      ls(false, NKEY, name);
      const item = { name, game, text, at: new Date().toISOString() };
      if (!f) {
        const blob = `Kinetic Escape feedback\nName: ${name || '-'}\nGame: ${game}\n\n${text}`;
        let ok = false;
        try { await navigator.clipboard.writeText(blob); ok = true; } catch (e) { ok = false; }
        msg.textContent = ok ? 'Copied! Paste it where your teacher asked (e.g. Google Classroom).' : 'Select the text above and copy it (Ctrl+C) to send to your teacher.';
        return;
      }
      msg.textContent = 'Sending…';
      setQueue(queue().concat([item]));
      const sent = await flush();
      if (queue().length === 0 && sent) {
        msg.textContent = '✅ Sent. Thank you!';
        $('#fb-text').value = '';
        setTimeout(close, 1200);
      } else {
        msg.textContent = 'No connection right now. Saved on this device; it will send next time you open this box.';
      }
    });
    setTimeout(() => ($('#fb-name').value ? $('#fb-text') : $('#fb-name')).focus(), 30);
    flush(); // retry anything left from earlier
    return wrap;
  }

  SEHS.Feedback = { open, parseLink, flush, configured: () => !!form() };
})();
