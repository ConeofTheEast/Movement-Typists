/*
 * sprites.js: optional sprite skin loader (owned by the art-director agent)
 * Reads window.SEHS_SPRITES (assets/sprites/manifest.js). If every part of a
 * view loads, Android.draw uses the images for bones/head/shell; otherwise
 * the built-in vector android is used. Muscles are always drawn by code.
 */
(function () {
  'use strict';
  const SEHS = (window.SEHS = window.SEHS || {});
  const q = typeof location !== 'undefined' ? location.search : '';
  const Sprites = {
    debug: /sprites=debug/.test(q),
    off: /skin=off/.test(q),
    skins: {},
    load(view) {
      const m = window.SEHS_SPRITES && window.SEHS_SPRITES[view];
      if (!m || !m.enabled || this.off || this.skins[view]) return;
      const skin = { ready: false, parts: {}, failed: [] };
      this.skins[view] = skin;
      const names = Object.keys(m.parts);
      let left = names.length;
      names.forEach((name) => {
        const def = m.parts[name];
        const img = new Image();
        img.onload = () => {
          skin.parts[name] = { img, pivot: def.pivot, tip: def.tip };
          if (--left === 0) skin.ready = skin.failed.length === 0;
        };
        img.onerror = () => {
          skin.failed.push(def.src);
          console.warn('[sprites] missing ' + def.src + ': using the vector android');
          if (--left === 0) skin.ready = false;
        };
        img.src = 'assets/sprites/' + def.src;
      });
    },
    get(view) {
      const s = this.skins[view];
      return s && s.ready ? s.parts : null;
    },
  };
  SEHS.Sprites = Sprites;
})();
