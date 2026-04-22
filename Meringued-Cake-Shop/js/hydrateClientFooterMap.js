/**
 * Fills #clientFooterMapLink (and optional #clientFooterAddressText) from adminSettings
 * after shop settings are synced (same lat/lng as Admin Settings → map coordinates).
 */
export async function hydrateClientFooterMap() {
    if (window.__meringuedShopSettingsReady) {
        try {
            await window.__meringuedShopSettingsReady;
        } catch (e) {
            /* noop */
        }
    }
    try {
        var raw = localStorage.getItem('adminSettings');
        var s = raw ? JSON.parse(raw) : {};
        var lat = s.shopLat != null ? Number(s.shopLat) : 7.079683;
        var lng = s.shopLng != null ? Number(s.shopLng) : 125.539021;
        var mapLink = document.getElementById('clientFooterMapLink');
        var addressEl = document.getElementById('clientFooterAddressText');
        if (mapLink) {
            mapLink.href = 'https://www.google.com/maps?q=' + lat + ',' + lng;
            var addr = (s.shopAddress || '').trim();
            if (addr) mapLink.setAttribute('title', addr);
        }
        if (addressEl) {
            var addr = (s.shopAddress || '').trim();
            addressEl.textContent = addr || 'Our pickup location';
        }
    } catch (e) {
        /* noop */
    }
}
