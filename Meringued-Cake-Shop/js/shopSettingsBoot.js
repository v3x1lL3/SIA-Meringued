/**
 * First-load: pull business settings from Supabase into localStorage so POS pickup phone etc. match admin.
 * Pages should `await window.__meringuedShopSettingsReady` in DOMContentLoaded before relying on adminSettings.
 */
import { hydrateShopSettingsToLocalStorage } from './models/shopSettingsModel.js';

window.__meringuedShopSettingsReady = hydrateShopSettingsToLocalStorage();
