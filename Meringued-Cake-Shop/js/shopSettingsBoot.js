/**
 * First-load: pull business settings from Supabase into localStorage so POS pickup phone etc. match admin.
 * Pages should `await window.__meringuedShopSettingsReady` in DOMContentLoaded before relying on adminSettings.
 *
 * After load, subscribes to Supabase Realtime on `business_public_settings` and polls periodically so admin
 * changes apply on the customer site without refresh (when cloud sync works).
 */
import { hydrateShopSettingsToLocalStorage, subscribePublicBusinessSettingsChanges } from './models/shopSettingsModel.js';
import { hydrateClientFooterMap } from './hydrateClientFooterMap.js';

window.__meringuedShopSettingsReady = (async () => {
  await hydrateShopSettingsToLocalStorage();
  let lastSnap = localStorage.getItem('adminSettings') || '';

  function publishIfChanged() {
    const snap = localStorage.getItem('adminSettings') || '';
    if (snap === lastSnap) return;
    lastSnap = snap;
    window.dispatchEvent(new CustomEvent('meringued:shopSettingsUpdated'));
    hydrateClientFooterMap();
  }

  subscribePublicBusinessSettingsChanges(publishIfChanged);

  setInterval(async () => {
    if (document.hidden) return;
    try {
      await hydrateShopSettingsToLocalStorage();
      publishIfChanged();
    } catch (e) {
      /* noop */
    }
  }, 45000);
})();
