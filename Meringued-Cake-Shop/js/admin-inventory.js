/**
 * Shared admin inventory logic. Uses localStorage key adminInventoryItems.
 * Works on both admindashboard.html and admininventory.html.
 */
(function () {
    let inventoryItems = [];
    const INVENTORY_STORAGE_KEY = 'adminInventoryItems';
    const DEFAULT_INGREDIENTS = [
        'Fondant', 'Flour', 'Sugar', 'Cocoa', 'Compound Chocolate',
        'Baking Soda', 'Baking Powder', 'Evaporated Milk', 'Condensed Milk',
        'Glucose Syrup', 'Corn Syrup', 'Vegetable Oil', 'Egg', 'Flavorades',
        'Edible Gel Colors', 'Edible Luster', 'Butter', 'Sprinkles / Candies'
    ];

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text != null ? text : '';
        return div.innerHTML;
    }

    function loadInventory() {
        const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
        inventoryItems = raw ? JSON.parse(raw) : [];
    }

    function saveInventory() {
        localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventoryItems));
    }

    function seedInventoryTemplateIfEmpty(force) {
        loadInventory();
        if (!force && Array.isArray(inventoryItems) && inventoryItems.length > 0) return;
        inventoryItems = DEFAULT_INGREDIENTS.map(function (name) {
            return {
                id: 'inv_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
                name: name,
                quantity: 0,
                unit: 'units',
                reorderLevel: 0,
                imageSrc: '',
                expiryDate: null
            };
        });
        saveInventory();
    }

    var ALLOWABLE_EXTENDED_DAYS = 7;
    var EXPIRY_WARNING_DAYS = 7;

    /** Return days until expiry (YYYY-MM-DD). Positive = future, 0 = today, negative = past. */
    function getDaysUntilExpiry(expiryDate) {
        if (!expiryDate || typeof expiryDate !== 'string') return null;
        var parts = expiryDate.split('-');
        if (parts.length !== 3) return null;
        var y = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10) - 1;
        var d = parseInt(parts[2], 10);
        if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
        var exp = new Date(y, m, d);
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        exp.setHours(0, 0, 0, 0);
        var diffMs = exp.getTime() - today.getTime();
        return Math.round(diffMs / (24 * 60 * 60 * 1000));
    }

    function getExtendedExpiryString(expiryDate) {
        if (!expiryDate || typeof expiryDate !== 'string') return '';
        var parts = expiryDate.split('-');
        if (parts.length !== 3) return '';
        var y = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10) - 1;
        var d = parseInt(parts[2], 10);
        if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
        var date = new Date(y, m, d);
        date.setDate(date.getDate() + ALLOWABLE_EXTENDED_DAYS);
        return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
    }

    function renderUnitOptions(selected) {
        var units = [
            { value: 'units', label: 'units' },
            { value: 'kg', label: 'kg' },
            { value: 'g', label: 'g' },
            { value: 'L', label: 'L' },
            { value: 'ml', label: 'ml' },
            { value: 'pcs', label: 'pcs' }
        ];
        return units.map(function (u) {
            return '<option value="' + u.value + '"' + (u.value === selected ? ' selected' : '') + '>' + u.label + '</option>';
        }).join('');
    }

    function renderInventory() {
        loadInventory();
        var tbody = document.getElementById('inventoryTableBody');
        var emptyEl = document.getElementById('inventoryEmpty');
        var cardsGrid = document.getElementById('inventoryCardsGrid');
        if (!tbody) return;

        if (!inventoryItems || inventoryItems.length === 0) {
            tbody.innerHTML = '';
            if (cardsGrid) cardsGrid.innerHTML = '';
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');

        tbody.innerHTML = inventoryItems.map(function (item) {
            var qty = Number(item.quantity) || 0;
            var reorder = Number(item.reorderLevel) || 0;
            var low = reorder > 0 && qty <= reorder;
            var qtyClass = low ? 'text-red-600' : 'text-gray-800';
            var imgHtml = item.imageSrc
                ? '<img src="' + item.imageSrc.replace(/"/g, '&quot;') + '" alt="' + escapeHtml(item.name) + '" class="w-12 h-12 rounded-lg object-cover border border-gray-200" />'
                : '<div class="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400"><i class="fas fa-image"></i></div>';

            return '<tr class="inventory-row border-b border-gray-100 hover:bg-[#FFF8F0]/40 transition" data-id="' + escapeHtml(item.id) + '">' +
                '<td class="py-3 px-3">' + imgHtml + '</td>' +
                '<td class="py-3 px-3">' +
                '<div class="font-semibold text-gray-800">' + escapeHtml(item.name) + '</div>' +
                '<div class="text-xs text-gray-500 mt-1"><span class="font-medium">Image:</span> <span class="break-all">' + (item.imageSrc ? escapeHtml(item.imageSrc) : '—') + '</span></div>' +
                '<div class="mt-2 flex flex-col md:flex-row gap-2">' +
                '<input data-action="imgUrl" data-id="' + escapeHtml(item.id) + '" type="text" class="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-[#D4AF37] focus:outline-none text-sm" placeholder="Paste image path" value="' + escapeHtml(item.imageSrc || '') + '">' +
                '<input data-action="imgFile" data-id="' + escapeHtml(item.id) + '" type="file" accept="image/*" class="flex-1 text-xs">' +
                '</div>' +
                '<div class="mt-2 flex justify-end">' +
                '<button data-action="saveImage" data-id="' + escapeHtml(item.id) + '" class="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition text-gray-700 text-sm font-semibold"><i class="fas fa-floppy-disk mr-2"></i>Save image</button>' +
                '</div>' +
                '</td>' +
                '<td class="py-3 px-3"><span class="font-bold ' + qtyClass + '">' + qty.toFixed(2) + '</span></td>' +
                '<td class="py-3 px-3"><select data-action="unit" data-id="' + escapeHtml(item.id) + '" class="px-3 py-2 rounded-lg border border-gray-200 focus:border-[#D4AF37] focus:outline-none text-sm">' + renderUnitOptions(item.unit || 'units') + '</select></td>' +
                '<td class="py-3 px-3">' +
                '<input data-action="reorder" data-id="' + escapeHtml(item.id) + '" type="number" min="0" step="0.01" class="w-28 px-3 py-2 rounded-lg border border-gray-200 focus:border-[#D4AF37] focus:outline-none text-sm" value="' + escapeHtml(String(item.reorderLevel != null ? item.reorderLevel : 0)) + '">' +
                (low ? '<div class="text-xs text-red-600 mt-1"><i class="fas fa-triangle-exclamation mr-1"></i>Low stock</div>' : '<div class="text-xs text-gray-400 mt-1">—</div>') +
                '</td>' +
                '<td class="py-3 px-3">' +
                '<input data-action="expiryDate" data-id="' + escapeHtml(item.id) + '" type="date" class="w-full min-w-[130px] px-2 py-2 rounded-lg border border-gray-200 focus:border-[#D4AF37] focus:outline-none text-sm" value="' + escapeHtml((item.expiryDate && item.expiryDate.slice(0, 10)) || '') + '" title="Expiry date (from product label)">' +
                (item.expiryDate && getExtendedExpiryString(item.expiryDate) ? '<div class="text-xs mt-1 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800"><span class="font-medium">Extended:</span> ' + escapeHtml(getExtendedExpiryString(item.expiryDate)) + ' <span class="text-amber-600">(1 wk)</span></div>' : '<div class="text-xs text-gray-400 mt-1">—</div>') +
                '</td>' +
                '<td class="py-3 px-3">' +
                '<div class="flex items-center gap-2">' +
                '<input data-action="delta" data-id="' + escapeHtml(item.id) + '" type="number" min="0" step="0.01" class="w-28 px-3 py-2 rounded-lg border border-gray-200 focus:border-[#D4AF37] focus:outline-none text-sm" placeholder="0">' +
                '<button data-action="stockIn" data-id="' + escapeHtml(item.id) + '" class="px-3 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-600 hover:text-white transition text-sm font-semibold"><i class="fas fa-plus mr-1"></i>In</button>' +
                '<button data-action="stockOut" data-id="' + escapeHtml(item.id) + '" class="px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-600 hover:text-white transition text-sm font-semibold"><i class="fas fa-minus mr-1"></i>Out</button>' +
                '</div></td>' +
                '<td class="py-3 px-3"><div class="flex gap-2 justify-end">' +
                '<button data-action="delete" data-id="' + escapeHtml(item.id) + '" class="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition text-gray-700 text-sm font-semibold"><i class="fas fa-trash mr-2 text-red-600"></i>Delete</button>' +
                '</div></td></tr>';
        }).join('');

        if (cardsGrid) {
            cardsGrid.innerHTML = inventoryItems.map(function (item) {
                var qty = Number(item.quantity) || 0;
                var reorder = Number(item.reorderLevel) || 0;
                var low = reorder > 0 && qty <= reorder;
                var unitLabel = (item.unit || 'units') || '';
                var unitDisplay = unitLabel && String(unitLabel).trim() ? ' ' + unitLabel : '';
                var extended = item.expiryDate && getExtendedExpiryString(item.expiryDate);
                var hasExpiry = !!item.expiryDate;
                var imgHtml = item.imageSrc
                    ? '<img src="' + item.imageSrc.replace(/"/g, '&quot;') + '" alt="' + escapeHtml(item.name) + '" class="w-10 h-10 rounded-lg object-cover border border-gray-200" />'
                    : '<div class="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs"><i class="fas fa-image"></i></div>';

                return '' +
                    '<button type="button" class="inventory-card w-full text-left" data-id="' + escapeHtml(item.id) + '">' +
                    '<div class="flex items-center gap-3">' +
                    imgHtml +
                    '<div class="flex-1 min-w-0">' +
                    '<div class="flex items-start justify-between gap-2 mb-1">' +
                    '<div class="font-semibold text-gray-800 truncate" title="' + escapeHtml(item.name || '') + '">' + escapeHtml(item.name || 'Ingredient') + '</div>' +
                    (low ? '<span class="inventory-pill inventory-pill--low"><i class="fas fa-triangle-exclamation mr-1"></i>Low stock</span>' : '') +
                    '</div>' +
                    '<div class="text-[11px] text-gray-600 flex flex-wrap gap-x-4 gap-y-1">' +
                    '<span>Qty: <span class="font-semibold">' + qty.toFixed(2) + unitDisplay + '</span></span>' +
                    '<span>Reorder: <span class="font-semibold">' + reorder.toFixed(2) + unitDisplay + '</span></span>' +
                    (hasExpiry ? '<span>Expiry: <span class="font-semibold">' + escapeHtml(String(item.expiryDate).slice(0, 10)) + '</span></span>' : '') +
                    (extended ? '<span class="text-amber-700">Extended: <span class="font-semibold">' + escapeHtml(extended) + '</span> <span class="text-amber-600">(1 wk)</span></span>' : '') +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '</button>';
            }).join('');

            if (!cardsGrid.dataset.bound) {
                cardsGrid.addEventListener('click', function (e) {
                    var card = e.target.closest('button[data-id]');
                    if (!card) return;
                    var id = card.getAttribute('data-id');
                    if (!id) return;
                    var allCards = cardsGrid.querySelectorAll('.inventory-card--active');
                    for (var i = 0; i < allCards.length; i++) {
                        allCards[i].classList.remove('inventory-card--active');
                    }
                    var allRows = tbody.querySelectorAll('.inventory-row--active');
                    for (var j = 0; j < allRows.length; j++) {
                        allRows[j].classList.remove('inventory-row--active');
                    }
                    card.classList.add('inventory-card--active');
                    var row = tbody.querySelector('tr[data-id="' + id.replace(/"/g, '\\"') + '"]');
                    if (row) {
                        row.classList.add('inventory-row--active');
                        try {
                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        } catch (err) {
                            row.scrollIntoView(true);
                        }
                    }
                });
                cardsGrid.dataset.bound = '1';
            }
        }

        updateLowStockBanner();
        updateExpiryBanner();
    }

    function updateExpiryBanner() {
        var banner = document.getElementById('inventoryExpiryBanner');
        var listEl = document.getElementById('inventoryExpiryList');
        if (!banner || !listEl) return;
        var expiringSoon = [];
        var expired = [];
        (inventoryItems || []).forEach(function (item) {
            if (!item.expiryDate || !String(item.expiryDate).trim()) return;
            var days = getDaysUntilExpiry(String(item.expiryDate).slice(0, 10));
            if (days === null) return;
            var displayDate = String(item.expiryDate).slice(0, 10);
            if (days < 0) {
                expired.push({ name: item.name, date: displayDate, days: days });
            } else if (days <= EXPIRY_WARNING_DAYS) {
                expiringSoon.push({ name: item.name, date: displayDate, days: days });
            }
        });
        if (expiringSoon.length === 0 && expired.length === 0) {
            banner.classList.add('hidden');
            return;
        }
        var parts = [];
        if (expiringSoon.length > 0) {
            parts.push(expiringSoon.map(function (x) {
                var label = x.days === 0 ? 'today' : (x.days === 1 ? 'tomorrow' : 'in ' + x.days + ' days');
                return x.name + ' (expires ' + x.date + ' — ' + label + ')';
            }).join('; '));
        }
        if (expired.length > 0) {
            parts.push('Already expired (check extended expiry date): ' + expired.map(function (x) {
                return x.name + ' (' + x.date + ')';
            }).join('; '));
        }
        listEl.textContent = parts.join(' · ');
        banner.classList.remove('hidden');
    }

    function updateLowStockBanner() {
        var banner = document.getElementById('inventoryLowStockBanner');
        var listEl = document.getElementById('inventoryLowStockList');
        if (!banner || !listEl) return;
        var settingsRaw = localStorage.getItem('adminSettings');
        var notifyLowStock = true;
        if (settingsRaw) {
            try {
                var s = JSON.parse(settingsRaw);
                if (s && s.notifyLowStock === false) notifyLowStock = false;
            } catch (e) {}
        }
        var lowItems = (inventoryItems || []).filter(function (item) {
            var reorder = Number(item.reorderLevel) || 0;
            var qty = Number(item.quantity) || 0;
            return reorder > 0 && qty <= reorder;
        });
        if (!notifyLowStock || lowItems.length === 0) {
            banner.classList.add('hidden');
            return;
        }
        var u = function (item) { return (item.unit || 'units').trim() ? ' ' + (item.unit || 'units') : ''; };
        listEl.textContent = lowItems.map(function (item) {
            var qty = Number(item.quantity) || 0;
            var reorder = Number(item.reorderLevel) || 0;
            return item.name + ' (' + qty + u(item) + ' — reorder at ' + reorder + u(item) + ')';
        }).join('; ');
        banner.classList.remove('hidden');
    }

    function applyStockDelta(id, delta) {
        loadInventory();
        var item = inventoryItems.find(function (x) { return x.id === id; });
        if (!item) return;
        var current = Number(item.quantity) || 0;
        item.quantity = Math.max(0, current + delta);
        saveInventory();
        renderInventory();
        if (isSupabaseId(item.id) && window.InventorySupabase && window.InventorySupabase.update) {
            window.InventorySupabase.update(item.id, { quantity: item.quantity });
        }
    }

    function readFileAsDataUrl(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(new Error('Failed to read file.')); };
            reader.readAsDataURL(file);
        });
    }

    function addInventoryItemFromForm() {
        loadInventory();
        var nameEl = document.getElementById('invName');
        var name = (nameEl && nameEl.value.trim()) || '';
        if (!name) { alert('Please enter an ingredient name.'); return; }

        var qty = Number(document.getElementById('invQty') && document.getElementById('invQty').value) || 0;
        var unit = (document.getElementById('invUnit') && document.getElementById('invUnit').value) || 'units';
        var reorderLevel = Number(document.getElementById('invReorder') && document.getElementById('invReorder').value) || 0;
        var expiryDateEl = document.getElementById('invExpiryDate');
        var expiryDate = (expiryDateEl && expiryDateEl.value && String(expiryDateEl.value).trim()) ? String(expiryDateEl.value).slice(0, 10) : null;
        var imageUrl = (document.getElementById('invImageUrl') && document.getElementById('invImageUrl').value.trim()) || '';
        var fileInput = document.getElementById('invImageFile');
        var file = fileInput && fileInput.files && fileInput.files[0];

        var exists = inventoryItems.some(function (x) { return (x.name || '').toLowerCase() === name.toLowerCase(); });
        if (exists && !confirm('This ingredient name already exists. Add another entry anyway?')) return;

        var imageSrc = imageUrl;
        if (file) {
            readFileAsDataUrl(file).then(function (dataUrl) {
                imageSrc = dataUrl;
                finishAdd();
            }).catch(function () { finishAdd(); });
        } else { finishAdd(); }

        function finishAdd() {
            var newItem = {
                id: 'inv_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
                name: name,
                quantity: Math.max(0, qty),
                unit: unit,
                reorderLevel: Math.max(0, reorderLevel),
                imageSrc: imageSrc || '',
                expiryDate: expiryDate || null
            };
            inventoryItems.unshift(newItem);
            saveInventory();
            renderInventory();
            var form = document.getElementById('inventoryAddForm');
            if (form) form.reset();
            var qtyEl = document.getElementById('invQty');
            var reorderEl = document.getElementById('invReorder');
            var unitEl = document.getElementById('invUnit');
            var invExpiryDateEl = document.getElementById('invExpiryDate');
            if (qtyEl) qtyEl.value = 0;
            if (reorderEl) reorderEl.value = 0;
            if (unitEl) unitEl.value = 'units';
            if (invExpiryDateEl) invExpiryDateEl.value = '';
            if (window.InventorySupabase && window.InventorySupabase.create) {
                window.InventorySupabase.create(newItem).then(function (created) {
                    if (created && created.id) { newItem.id = created.id; saveInventory(); }
                });
            }
        }
    }

    function saveInventoryImageForRow(id) {
        loadInventory();
        var item = inventoryItems.find(function (x) { return x.id === id; });
        if (!item) return;
        var tbody = document.getElementById('inventoryTableBody');
        var urlInput = tbody && tbody.querySelector('input[data-action="imgUrl"][data-id="' + id + '"]');
        var fileInput = tbody && tbody.querySelector('input[data-action="imgFile"][data-id="' + id + '"]');
        var url = (urlInput && urlInput.value.trim()) || '';
        var file = fileInput && fileInput.files && fileInput.files[0];
        var imageSrc = url;
        if (file) {
            readFileAsDataUrl(file).then(function (dataUrl) {
                item.imageSrc = dataUrl || '';
                saveInventory();
                renderInventory();
                if (isSupabaseId(item.id) && window.InventorySupabase && window.InventorySupabase.update) {
                    window.InventorySupabase.update(item.id, { imageSrc: item.imageSrc });
                }
            });
        } else {
            item.imageSrc = imageSrc || '';
            saveInventory();
            renderInventory();
            if (isSupabaseId(item.id) && window.InventorySupabase && window.InventorySupabase.update) {
                window.InventorySupabase.update(item.id, { imageSrc: item.imageSrc });
            }
        }
    }

    function setupInventoryHandlers() {
        var form = document.getElementById('inventoryAddForm');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                addInventoryItemFromForm();
            });
        }

        var resetBtn = document.getElementById('resetInventoryBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function () {
                if (!confirm('Reset inventory template back to the default ingredient list? This will overwrite your current inventory in this browser.')) return;
                seedInventoryTemplateIfEmpty(true);
                renderInventory();
            });
        }

        var tbody = document.getElementById('inventoryTableBody');
        if (!tbody) return;

        tbody.addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-action]');
            if (!btn) return;
            var action = btn.getAttribute('data-action');
            var id = btn.getAttribute('data-id');
            if (!id) return;

            if (action === 'delete') {
                var item = inventoryItems.find(function (x) { return x.id === id; });
                if (!confirm('Delete "' + (item && item.name ? item.name : 'this ingredient') + '"?')) return;
                if (item && isSupabaseId(item.id) && window.InventorySupabase && window.InventorySupabase.delete) {
                    window.InventorySupabase.delete(item.id);
                }
                inventoryItems = inventoryItems.filter(function (x) { return x.id !== id; });
                saveInventory();
                renderInventory();
                return;
            }
            if (action === 'stockIn' || action === 'stockOut') {
                var deltaInput = tbody.querySelector('input[data-action="delta"][data-id="' + id + '"]');
                var raw = deltaInput ? Number(deltaInput.value) : 0;
                if (!raw || raw <= 0) { alert('Please enter a valid amount.'); return; }
                var delta = action === 'stockIn' ? raw : -raw;
                applyStockDelta(id, delta);
                if (deltaInput) deltaInput.value = '';
                return;
            }
            if (action === 'saveImage') {
                saveInventoryImageForRow(id);
            }
        });

        tbody.addEventListener('change', function (e) {
            var el = e.target;
            if (!el || !el.getAttribute) return;
            var action = el.getAttribute('data-action');
            var id = el.getAttribute('data-id');
            if (!action || !id) return;
            if (action === 'unit') {
                var u = inventoryItems.find(function (x) { return x.id === id; });
                if (u) {
                    u.unit = el.value || 'units';
                    saveInventory();
                    renderInventory();
                    if (isSupabaseId(u.id) && window.InventorySupabase && window.InventorySupabase.update) {
                        window.InventorySupabase.update(u.id, { unit: u.unit });
                    }
                }
                return;
            }
            if (action === 'reorder') {
                var r = inventoryItems.find(function (x) { return x.id === id; });
                if (r) {
                    var v = Number(el.value);
                    r.reorderLevel = (Number.isFinite(v) && v >= 0) ? v : 0;
                    saveInventory();
                    renderInventory();
                    if (isSupabaseId(r.id) && window.InventorySupabase && window.InventorySupabase.update) {
                        window.InventorySupabase.update(r.id, { reorderLevel: r.reorderLevel });
                    }
                }
                return;
            }
            if (action === 'expiryDate') {
                var expItem = inventoryItems.find(function (x) { return x.id === id; });
                if (expItem) {
                    var val = (el.value && String(el.value).trim()) || null;
                    expItem.expiryDate = val ? val.slice(0, 10) : null;
                    saveInventory();
                    renderInventory();
                    if (isSupabaseId(expItem.id) && window.InventorySupabase && window.InventorySupabase.update) {
                        window.InventorySupabase.update(expItem.id, { expiryDate: expItem.expiryDate });
                    }
                }
            }
        });
    }

    function openLogoutModal() {
        var m = document.getElementById('logoutModal');
        if (m) { m.classList.remove('hidden'); m.classList.add('flex'); document.body.style.overflow = 'hidden'; }
    }
    function closeLogoutModal() {
        var m = document.getElementById('logoutModal');
        if (m) { m.classList.add('hidden'); m.classList.remove('flex'); document.body.style.overflow = 'auto'; }
    }
    function confirmLogout() {
        window.location.href = 'index.html';
    }

    function isSupabaseId(id) {
        return typeof id === 'string' && id.length > 0 && id.indexOf('inv_') !== 0;
    }

    /**
     * Push items that exist only in localStorage (id starts with 'inv_') to Supabase,
     * then update their local id so future edits sync. Call after seeding when Supabase was empty.
     */
    function pushLocalInventoryToSupabase() {
        if (!window.InventorySupabase || !window.InventorySupabase.create) return Promise.resolve();
        loadInventory();
        var localOnly = inventoryItems.filter(function (x) { return x.id && String(x.id).indexOf('inv_') === 0; });
        if (localOnly.length === 0) return Promise.resolve();
        var done = 0;
        function next() {
            if (done >= localOnly.length) return Promise.resolve();
            var item = localOnly[done];
            return window.InventorySupabase.create(item).then(function (created) {
                if (created && created.id) {
                    item.id = created.id;
                    saveInventory();
                }
                done += 1;
                return next();
            }).catch(function () { done += 1; return next(); });
        }
        return next();
    }

    function runAfterLoad() {
        if (window.OrderIngredients && window.OrderIngredients.restoreCancelledOrdersIngredientStock) {
            window.OrderIngredients.restoreCancelledOrdersIngredientStock();
        }
        renderInventory();
        setupInventoryHandlers();
        var logoutModal = document.getElementById('logoutModal');
        if (logoutModal) {
            logoutModal.addEventListener('click', function (e) {
                if (e.target === logoutModal) closeLogoutModal();
            });
        }
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                var m = document.getElementById('logoutModal');
                if (m && !m.classList.contains('hidden')) closeLogoutModal();
            }
        });
    }

    function init() {
        if (!document.getElementById('inventoryTableBody')) return;
        if (window.InventorySupabase && typeof window.InventorySupabase.load === 'function') {
            window.InventorySupabase.load().then(function (items) {
                if (items && items.length > 0) {
                    inventoryItems = items;
                    saveInventory();
                } else {
                    seedInventoryTemplateIfEmpty();
                    pushLocalInventoryToSupabase();
                }
                runAfterLoad();
            }).catch(function () {
                seedInventoryTemplateIfEmpty();
                pushLocalInventoryToSupabase();
                runAfterLoad();
            });
        } else {
            seedInventoryTemplateIfEmpty();
            runAfterLoad();
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && document.getElementById('inventoryTableBody')) renderInventory();
    });
    window.addEventListener('focus', function () {
        if (document.getElementById('inventoryTableBody')) renderInventory();
    });

    window.renderInventory = renderInventory;
    window.openLogoutModal = openLogoutModal;
    window.closeLogoutModal = closeLogoutModal;
    window.confirmLogout = confirmLogout;
})();
