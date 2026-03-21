/**
 * Shared admin inventory logic.
 * - Ingredients: localStorage adminInventoryItems (+ Supabase sync when configured).
 * - Miscellaneous (packaging, boxes, etc.): localStorage adminMiscInventoryItems + Supabase misc_inventory_items when configured.
 * Works on both admindashboard.html and admininventory.html.
 */
(function () {
    let inventoryItems = [];
    const INVENTORY_STORAGE_KEY = 'adminInventoryItems';
    const MISC_STORAGE_KEY = 'adminMiscInventoryItems';
    var currentCategory = 'ingredient';
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

    function storageKey() {
        return currentCategory === 'misc' ? MISC_STORAGE_KEY : INVENTORY_STORAGE_KEY;
    }

    function loadInventory() {
        const raw = localStorage.getItem(storageKey());
        inventoryItems = raw ? JSON.parse(raw) : [];
    }

    function saveInventory() {
        localStorage.setItem(storageKey(), JSON.stringify(inventoryItems));
    }

    function ensureMiscKeyExists() {
        if (localStorage.getItem(MISC_STORAGE_KEY) == null) {
            localStorage.setItem(MISC_STORAGE_KEY, '[]');
        }
    }

    /** Seed default baking-ingredient names into adminInventoryItems only (not misc). */
    function seedIngredientTemplateIfEmpty(force) {
        var raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
        var arr = raw ? JSON.parse(raw) : [];
        if (!force && Array.isArray(arr) && arr.length > 0) return;
        var seeded = DEFAULT_INGREDIENTS.map(function (name) {
            return {
                id: 'inv_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
                name: name,
                quantity: 0,
                unit: 'units',
                unitCost: 0,
                reorderLevel: 0,
                imageSrc: '',
                expiryDate: null
            };
        });
        localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(seeded));
    }

    function updateInventoryCategoryUI() {
        var isIng = currentCategory === 'ingredient';
        var subt = document.getElementById('invPageSubtitle');
        if (subt) {
            subt.textContent = isIng
                ? 'Add ingredients, set units, and track stock in/out. Same data as on the Dashboard.'
                : 'Packaging, boxes, bags, and design supplies — same stock tools as ingredients. Syncs to Supabase table misc_inventory_items when set up.';
        }
        var bt = document.getElementById('invBlockTitle');
        if (bt) {
            bt.innerHTML = isIng
                ? '<i class="fas fa-boxes-stacked mr-2"></i>Ingredients'
                : '<i class="fas fa-screwdriver-wrench mr-2"></i>Miscellaneous';
        }
        var bs = document.getElementById('invBlockSubtitle');
        if (bs) {
            bs.textContent = isIng
                ? 'Add ingredients, upload images, and track stock in/out.'
                : 'Track boxes, plastic bags, boards, ribbons, toppers, and other non-food supplies.';
        }
        var addTitle = document.getElementById('invAddCardTitle');
        if (addTitle) {
            addTitle.innerHTML = isIng
                ? '<i class="fas fa-plus-circle mr-2 text-[#D4AF37]"></i>Add Ingredient'
                : '<i class="fas fa-plus-circle mr-2 text-[#D4AF37]"></i>Add item';
        }
        var nameLab = document.getElementById('invNameLabel');
        if (nameLab) nameLab.textContent = isIng ? 'Ingredient name' : 'Item name';
        var nameInp = document.getElementById('invName');
        if (nameInp) nameInp.placeholder = isIng ? 'e.g., Fondant' : 'e.g., Cake boxes, plastic bags';
        var listTitle = document.getElementById('invListTitle');
        if (listTitle) {
            listTitle.innerHTML = isIng
                ? '<i class="fas fa-clipboard-list mr-2 text-[#D4AF37]"></i>Ingredients list'
                : '<i class="fas fa-clipboard-list mr-2 text-[#D4AF37]"></i>Miscellaneous list';
        }
        var thName = document.getElementById('invTableNameHeader');
        if (thName) thName.textContent = isIng ? 'Ingredient' : 'Item';
        var et = document.getElementById('inventoryEmptyTitle');
        var eh = document.getElementById('inventoryEmptyHint');
        if (et) et.textContent = isIng ? 'No ingredients yet' : 'No miscellaneous items yet';
        if (eh) {
            eh.textContent = isIng
                ? 'Add your first ingredient above, or use Reset template to load the default list.'
                : 'Add packaging or supply items above. This list is kept separately from baking ingredients.';
        }
        var resetBtn = document.getElementById('resetInventoryBtn');
        if (resetBtn) resetBtn.style.display = isIng ? '' : 'none';

        var tabIng = document.getElementById('invTabIngredient');
        var tabMisc = document.getElementById('invTabMisc');
        if (tabIng) {
            tabIng.classList.remove('inv-category-tab--active', 'inv-category-tab--inactive');
            tabIng.classList.add(isIng ? 'inv-category-tab--active' : 'inv-category-tab--inactive');
        }
        if (tabMisc) {
            tabMisc.classList.remove('inv-category-tab--active', 'inv-category-tab--inactive');
            tabMisc.classList.add(!isIng ? 'inv-category-tab--active' : 'inv-category-tab--inactive');
        }
        var expWrap = document.getElementById('invExpiryFieldWrap');
        if (expWrap) expWrap.classList.toggle('hidden', !isIng);
        var expTh = document.getElementById('invTableExpiryHeader');
        if (expTh) expTh.classList.toggle('hidden', !isIng);
    }

    function setInventoryCategory(cat) {
        if (cat !== 'ingredient' && cat !== 'misc') return;
        saveInventory();
        currentCategory = cat;
        try { sessionStorage.setItem('adminInventoryCategory', cat); } catch (e) { /* noop */ }
        loadInventory();
        updateInventoryCategoryUI();
        renderInventory();
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

    /**
     * Latest manual/order stock change per item (localStorage). Overwritten on each movement.
     * Shape: { at: ISO string, delta: number (signed), reason: string }
     */
    function isGenericManualStockReason(reason) {
        if (!reason || typeof reason !== 'string') return true;
        var s = reason.trim().toLowerCase();
        return s === 'manual stock in' || s === 'manual stock out';
    }

    function formatLastStockMoveBlock(item) {
        var m = item && item.lastStockMove;
        if (!m || m.at == null || m.delta == null || !Number.isFinite(Number(m.delta))) {
            return '<div class="inv-view-only"><span class="text-gray-400 text-sm">—</span></div>';
        }
        var delta = Number(m.delta);
        var isIn = delta >= 0;
        var absAmt = Math.abs(delta);
        var unit = escapeHtml((item.unit || 'units').trim() || 'units');
        var label = isIn ? 'In' : 'Out';
        var sign = isIn ? '+' : '\u2212';
        var color = isIn ? 'text-green-700' : 'text-red-700';
        var dateLine = '';
        try {
            var d = new Date(m.at);
            dateLine = new Intl.DateTimeFormat('en-PH', {
                timeZone: 'Asia/Manila',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            }).format(d);
        } catch (e) { dateLine = ''; }
        var reason = (m.reason && String(m.reason).trim()) ? String(m.reason).trim() : '';
        if (isGenericManualStockReason(reason)) reason = '';
        if (reason.length > 48) reason = reason.slice(0, 46) + '\u2026';
        var reasonHtml = reason
            ? '<div class="text-[10px] text-gray-500 mt-0.5 leading-tight max-w-[160px]" title="' + escapeHtml(reason) + '">' + escapeHtml(reason) + '</div>'
            : '';
        return '<div class="inv-view-only">' +
            '<div class="text-sm font-semibold ' + color + '">' + label + ' ' + sign + absAmt.toFixed(2) + ' ' + unit + '</div>' +
            (dateLine ? '<div class="text-[11px] text-gray-500 mt-0.5">' + escapeHtml(dateLine) + '</div>' : '') +
            reasonHtml +
            '</div>';
    }

    function formatLastStockMoveCardLine(item, unitDisplay) {
        var m = item && item.lastStockMove;
        if (!m || m.at == null || m.delta == null || !Number.isFinite(Number(m.delta))) return '';
        var delta = Number(m.delta);
        var isIn = delta >= 0;
        var absAmt = Math.abs(delta);
        var label = isIn ? 'In' : 'Out';
        var sign = isIn ? '+' : '\u2212';
        var u = unitDisplay || '';
        var color = isIn ? 'text-green-700' : 'text-red-700';
        return '<span class="' + color + ' font-semibold">Last: ' + label + ' ' + sign + absAmt.toFixed(2) + u + '</span>';
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
        var isMisc = currentCategory === 'misc';
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

        function setRowEditable(rowEl, editable) {
            if (!rowEl) return;

            // View mode: show only spans/text (no boxes).
            // Edit mode: show inputs/selects/buttons for editing.
            var editEls = rowEl.querySelectorAll('.inv-edit-only');
            for (var i = 0; i < editEls.length; i++) {
                editEls[i].classList.toggle('hidden', !editable);
            }
            var viewEls = rowEl.querySelectorAll('.inv-view-only');
            for (var j = 0; j < viewEls.length; j++) {
                viewEls[j].classList.toggle('hidden', editable);
            }

            // Update Edit button label.
            var editBtn = rowEl.querySelector('button[data-action="edit"]');
            if (editBtn) {
                editBtn.textContent = editable ? 'Done' : 'Edit';
            }
        }

        tbody.innerHTML = inventoryItems.map(function (item) {
            var qty = Number(item.quantity) || 0;
            var reorder = Number(item.reorderLevel) || 0;
            var low = reorder > 0 && qty <= reorder;
            var qtyClass = low ? 'text-red-600' : 'text-gray-800';
            var imgHtml = item.imageSrc
                ? '<img src="' + item.imageSrc.replace(/"/g, '&quot;') + '" alt="' + escapeHtml(item.name) + '" class="w-12 h-12 rounded-lg object-cover border border-gray-200" />'
                : '<div class="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400"><i class="fas fa-image"></i></div>';

            var expiryTd = '';
            if (!isMisc) {
                expiryTd =
                '<td class="py-3 px-3">' +
                '<span class="inv-view-only text-gray-700 font-semibold text-sm">' + (item.expiryDate ? escapeHtml(String(item.expiryDate).slice(0, 10)) : '—') + '</span>' +
                (item.expiryDate && getExtendedExpiryString(item.expiryDate)
                    ? '<div class="inv-view-only text-xs mt-1 text-amber-700">Extended: ' + escapeHtml(getExtendedExpiryString(item.expiryDate)) + '</div>'
                    : '<div class="inv-view-only text-xs text-gray-400 mt-1">—</div>') +
                '<input data-action="expiryDate" data-id="' + escapeHtml(item.id) + '" type="date" class="inv-edit-only w-full min-w-[120px] px-2 py-1 rounded-lg border border-gray-200 focus:border-[#D4AF37] focus:outline-none text-xs" value="' + escapeHtml((item.expiryDate && item.expiryDate.slice(0, 10)) || '') + '" title="Expiry date">' +
                (item.expiryDate && getExtendedExpiryString(item.expiryDate) ? '<div class="inv-edit-only text-[11px] mt-1 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800"><span class="font-medium">Ext:</span> ' + escapeHtml(getExtendedExpiryString(item.expiryDate)) + '</div>' : '<div class="inv-edit-only text-xs text-gray-400 mt-1">—</div>') +
                '</td>';
            }

            return '<tr class="inventory-row border-b border-gray-100 hover:bg-[#FFF8F0]/40 transition ' + (item._editing ? 'inventory-row--active' : '') + '" data-id="' + escapeHtml(item.id) + '">' +
                '<td class="py-3 px-3">' + imgHtml + '</td>' +
                '<td class="py-3 px-3">' +
                '<div class="font-semibold text-gray-800">' + escapeHtml(item.name) + '</div>' +
                '<div class="text-xs text-gray-500 mt-1 inv-view-only"><span class="font-medium">Image:</span> <span class="break-all">' + (item.imageSrc ? escapeHtml(item.imageSrc) : '—') + '</span></div>' +
                '<div class="mt-1 flex flex-col md:flex-row gap-1 inv-edit-only">' +
                '<input data-action="imgUrl" data-id="' + escapeHtml(item.id) + '" type="text" class="flex-1 px-2 py-1 rounded-lg border border-gray-200 focus:border-[#D4AF37] focus:outline-none text-xs" placeholder="Image path" value="' + escapeHtml(item.imageSrc || '') + '">' +
                '<input data-action="imgFile" data-id="' + escapeHtml(item.id) + '" type="file" accept="image/*" class="flex-1 text-[11px]">' +
                '</div>' +
                '<div class="mt-1 flex justify-end inv-edit-only">' +
                '<button data-action="saveImage" data-id="' + escapeHtml(item.id) + '" class="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition text-gray-700 text-xs font-semibold"><i class="fas fa-floppy-disk mr-1"></i>Save</button>' +
                '</div>' +
                '</td>' +
                '<td class="py-3 px-3"><span class="font-bold ' + qtyClass + '">' + qty.toFixed(2) + '</span></td>' +
                '<td class="py-3 px-3"><span class="inv-view-only text-gray-800 font-semibold text-sm">' + escapeHtml(item.unit || 'units') + '</span>' +
                '<select data-action="unit" data-id="' + escapeHtml(item.id) + '" class="inv-edit-only px-2 py-1 rounded-lg border border-gray-200 focus:border-[#D4AF37] focus:outline-none text-xs">' + renderUnitOptions(item.unit || 'units') + '</select></td>' +
                '<td class="py-3 px-3"><span class="inv-view-only text-gray-800 font-semibold text-sm">₱' + Number(item.unitCost != null ? item.unitCost : 0).toFixed(2) + '</span>' +
                '<div class="inv-edit-only flex flex-col gap-1 items-start max-w-[200px]">' +
                '<div class="flex flex-wrap items-center gap-1">' +
                '<input data-action="unitCost" data-id="' + escapeHtml(item.id) + '" type="number" min="0" step="0.01" class="w-24 px-2 py-1 rounded-lg border border-gray-200 focus:border-[#D4AF37] focus:outline-none text-xs" placeholder="₱/unit" value="' + escapeHtml(String(item.unitCost != null ? item.unitCost : 0)) + '">' +
                '<button type="button" data-action="savePrice" data-id="' + escapeHtml(item.id) + '" class="px-2 py-1 rounded-lg bg-[#FFF8F0] text-[#B8941E] hover:bg-[#FFEFD6] border border-[#D4AF37]/40 text-xs font-semibold whitespace-nowrap" title="Save unit price — Stock In will use this for Purchase expenses">' +
                '<i class="fas fa-floppy-disk mr-1"></i>Save price</button>' +
                '</div>' +
                '<p class="text-[10px] text-gray-500 leading-snug">click to save the price</p>' +
                '</div></td>' +
                '<td class="py-3 px-3">' +
                '<span class="inv-view-only text-gray-800 font-semibold text-sm">' + escapeHtml(String(item.reorderLevel != null ? item.reorderLevel : 0)) + '</span>' +
                '<input data-action="reorder" data-id="' + escapeHtml(item.id) + '" type="number" min="0" step="0.01" class="inv-edit-only w-20 px-2 py-1 rounded-lg border border-gray-200 focus:border-[#D4AF37] focus:outline-none text-xs" value="' + escapeHtml(String(item.reorderLevel != null ? item.reorderLevel : 0)) + '">' +
                (low ? '<div class="text-xs text-red-600 mt-1"><i class="fas fa-triangle-exclamation mr-1"></i>Low stock</div>' : '<div class="text-xs text-gray-400 mt-1">—</div>') +
                '</td>' +
                expiryTd +
                '<td class="py-3 px-3">' +
                formatLastStockMoveBlock(item) +
                '<div class="inv-edit-only flex items-center gap-2">' +
                '<input data-action="delta" data-id="' + escapeHtml(item.id) + '" type="number" min="0" step="0.01" class="w-20 px-2 py-1 rounded-lg border border-gray-200 focus:border-[#D4AF37] focus:outline-none text-xs" placeholder="Qty">' +
                '<button data-action="stockIn" data-id="' + escapeHtml(item.id) + '" class="px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-600 hover:text-white transition text-xs font-semibold"><i class="fas fa-plus mr-1"></i>In</button>' +
                '<button data-action="stockOut" data-id="' + escapeHtml(item.id) + '" class="px-2 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-600 hover:text-white transition text-xs font-semibold"><i class="fas fa-minus mr-1"></i>Out</button>' +
                '</div></td>' +
                '<td class="py-3 px-3"><div class="flex flex-col gap-2 items-end">' +
                '<button data-action="edit" data-id="' + escapeHtml(item.id) + '" class="px-3 py-2 rounded-lg bg-[#FFF8F0] text-[#B8941E] hover:bg-[#FFEFD6] transition text-sm font-semibold">Edit</button>' +
                '<button data-action="delete" data-id="' + escapeHtml(item.id) + '" class="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition text-gray-700 text-sm font-semibold"><i class="fas fa-trash mr-2 text-red-600"></i>Delete</button>' +
                '</div></td></tr>';
        }).join('');

        // Apply edit-mode state per row.
        // (We re-render the row on Edit/Done, so this stays consistent.)
        var rowEls = tbody.querySelectorAll('tr[data-id]');
        for (var r = 0; r < rowEls.length; r++) {
            var rowEl = rowEls[r];
            var rowId = rowEl.getAttribute('data-id');
            var item = inventoryItems.find(function (x) { return x.id === rowId; });
            var editing = !!(item && item._editing);
            rowEl.dataset.editing = editing ? '1' : '0';
            setRowEditable(rowEl, editing);
        }

        if (cardsGrid) {
            cardsGrid.innerHTML = inventoryItems.map(function (item) {
                var qty = Number(item.quantity) || 0;
                var reorder = Number(item.reorderLevel) || 0;
                var low = reorder > 0 && qty <= reorder;
                var unitLabel = (item.unit || 'units') || '';
                var unitDisplay = unitLabel && String(unitLabel).trim() ? ' ' + unitLabel : '';
                var extended = !isMisc && item.expiryDate && getExtendedExpiryString(item.expiryDate);
                var hasExpiry = !isMisc && !!item.expiryDate;
                var lastMoveCard = formatLastStockMoveCardLine(item, unitDisplay);
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
                    (lastMoveCard ? '<span class="w-full">' + lastMoveCard + '</span>' : '') +
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
        if (currentCategory === 'misc') {
            banner.classList.add('hidden');
            return;
        }
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

    function applyStockDelta(id, delta, moveMeta) {
        loadInventory();
        var item = inventoryItems.find(function (x) { return x.id === id; });
        if (!item) return null;
        var current = Number(item.quantity) || 0;
        item.quantity = Math.max(0, current + delta);
        var reason = (moveMeta && moveMeta.reason != null) ? String(moveMeta.reason).trim() : '';
        item.lastStockMove = {
            at: new Date().toISOString(),
            delta: delta,
            reason: reason
        };
        saveInventory();
        renderInventory();
        inventorySupabaseUpdate(item.id, { quantity: item.quantity });
        return { item: item, before: current, delta: delta };
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
        if (!name) {
            alert(currentCategory === 'misc' ? 'Please enter an item name.' : 'Please enter an ingredient name.');
            return;
        }

        var qty = Number(document.getElementById('invQty') && document.getElementById('invQty').value) || 0;
        var unit = (document.getElementById('invUnit') && document.getElementById('invUnit').value) || 'units';
        var reorderLevel = Number(document.getElementById('invReorder') && document.getElementById('invReorder').value) || 0;
        var expiryDateEl = document.getElementById('invExpiryDate');
        var expiryDate = currentCategory === 'misc'
            ? null
            : ((expiryDateEl && expiryDateEl.value && String(expiryDateEl.value).trim()) ? String(expiryDateEl.value).slice(0, 10) : null);
        var imageUrl = (document.getElementById('invImageUrl') && document.getElementById('invImageUrl').value.trim()) || '';
        var fileInput = document.getElementById('invImageFile');
        var file = fileInput && fileInput.files && fileInput.files[0];

        var exists = inventoryItems.some(function (x) { return (x.name || '').toLowerCase() === name.toLowerCase(); });
        if (exists && !confirm(currentCategory === 'misc'
            ? 'This item name already exists in Miscellaneous. Add another entry anyway?'
            : 'This ingredient name already exists. Add another entry anyway?')) return;

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
                unitCost: 0,
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
            var createBridge = currentCategory === 'misc' ? window.MiscInventorySupabase : window.InventorySupabase;
            if (createBridge && createBridge.create) {
                createBridge.create(newItem).then(function (created) {
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
                inventorySupabaseUpdate(item.id, { imageSrc: item.imageSrc });
            });
        } else {
            item.imageSrc = imageSrc || '';
            saveInventory();
            renderInventory();
            inventorySupabaseUpdate(item.id, { imageSrc: item.imageSrc });
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
                if (currentCategory === 'misc') return;
                if (!confirm('Reset inventory template back to the default ingredient list? This will overwrite your current inventory in this browser.')) return;
                seedIngredientTemplateIfEmpty(true);
                loadInventory();
                renderInventory();
            });
        }

        var tabIng = document.getElementById('invTabIngredient');
        var tabMisc = document.getElementById('invTabMisc');
        if (tabIng && tabMisc && !tabIng.dataset.invTabBound) {
            tabIng.addEventListener('click', function () { setInventoryCategory('ingredient'); });
            tabMisc.addEventListener('click', function () { setInventoryCategory('misc'); });
            tabIng.dataset.invTabBound = '1';
        }

        var tbody = document.getElementById('inventoryTableBody');
        if (!tbody) return;

        tbody.addEventListener('click', function (e) {
            var t = e.target;
            var btn = (t && typeof t.closest === 'function') ? t.closest('button[data-action]') : null;
            if (!btn) return;
            var action = btn.getAttribute('data-action');
            var id = btn.getAttribute('data-id');
            if (!id) return;

            if (action === 'edit') {
                var rowEl = btn.closest('tr[data-id]');
                if (!rowEl) return;
                var isEditing = rowEl.dataset.editing === '1';
                var rowId = rowEl.getAttribute('data-id');
                var item = inventoryItems.find(function (x) { return x.id === rowId; });
                if (!item) return;

                if (!isEditing) {
                    // Enter edit mode: toggle state + re-render.
                    // Only one row can be in edit mode at a time.
                    inventoryItems.forEach(function (x) { x._editing = false; });
                    item._editing = true;
                    saveInventory(); // persist edit state in-memory->localStorage list shape not critical
                    renderInventory();
                    return;
                }

                // Done: persist changes, exit edit mode, re-render.
                var unitSel = rowEl.querySelector('select[data-action="unit"][data-id="' + rowId + '"]');
                var unitCostEl = rowEl.querySelector('input[data-action="unitCost"][data-id="' + rowId + '"]');
                var reorderEl = rowEl.querySelector('input[data-action="reorder"][data-id="' + rowId + '"]');
                var expiryEl = rowEl.querySelector('input[data-action="expiryDate"][data-id="' + rowId + '"]');
                var imgUrlInput = rowEl.querySelector('input[data-action="imgUrl"][data-id="' + rowId + '"]');
                var imgFileInput = rowEl.querySelector('input[data-action="imgFile"][data-id="' + rowId + '"]');

                if (unitSel) item.unit = unitSel.value || 'units';
                if (unitCostEl) item.unitCost = Number(unitCostEl.value) || 0;
                if (reorderEl) item.reorderLevel = Number(reorderEl.value) || 0;
                if (currentCategory === 'misc') {
                    item.expiryDate = null;
                } else if (expiryEl) {
                    item.expiryDate = expiryEl.value ? String(expiryEl.value).slice(0, 10) : null;
                }
                if (imgUrlInput && imgUrlInput.value != null && (!imgFileInput || !imgFileInput.files || !imgFileInput.files[0])) {
                    item.imageSrc = imgUrlInput.value || '';
                }

                // Immediately exit edit mode and show pure text view.
                item._editing = false;
                saveInventory();
                renderInventory();

                // If a new file was selected, update image after async read.
                if (imgFileInput && imgFileInput.files && imgFileInput.files[0]) {
                    var fileObj = imgFileInput.files[0];
                    var fileToDataUrl = function (file) {
                        return new Promise(function (resolve, reject) {
                            try {
                                var reader = new FileReader();
                                reader.onload = function () { resolve(reader.result); };
                                reader.onerror = function () { reject(new Error('Failed to read file')); };
                                reader.readAsDataURL(file);
                            } catch (err) {
                                reject(err);
                            }
                        });
                    };

                    fileToDataUrl(fileObj).then(function (dataUrl) {
                        item.imageSrc = dataUrl || '';
                        saveInventory();
                        var patchImg = {
                            unit: item.unit,
                            unitCost: item.unitCost,
                            reorderLevel: item.reorderLevel,
                            imageSrc: item.imageSrc
                        };
                        if (currentCategory !== 'misc') patchImg.expiryDate = item.expiryDate;
                        inventorySupabaseUpdate(item.id, patchImg);
                        renderInventory();
                    }).catch(function () {
                        // If reading fails, still exit edit mode.
                        saveInventory();
                        renderInventory();
                    });
                    return;
                }

                // No new file: update immediately (numeric fields already saved above).
                var patchDone = {
                    unit: item.unit,
                    unitCost: item.unitCost,
                    reorderLevel: item.reorderLevel,
                    imageSrc: item.imageSrc
                };
                if (currentCategory !== 'misc') patchDone.expiryDate = item.expiryDate;
                inventorySupabaseUpdate(item.id, patchDone);
                return;
            }

            if (action === 'delete') {
                var item = inventoryItems.find(function (x) { return x.id === id; });
                if (!confirm('Delete "' + (item && item.name ? item.name : (currentCategory === 'misc' ? 'this item' : 'this ingredient')) + '"?')) return;
                if (item) inventorySupabaseDelete(item.id);
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
                var applied = applyStockDelta(id, delta);
                if (applied && applied.item && window.AdminRecords && typeof window.AdminRecords.logInventoryMovement === 'function') {
                    try {
                        window.AdminRecords.logInventoryMovement({
                            itemId: applied.item.id,
                            itemName: applied.item.name,
                            delta: applied.delta,
                            newQty: applied.item.quantity,
                            unit: applied.item.unit,
                            reason: 'Manual stock ' + (applied.delta >= 0 ? 'in' : 'out')
                        });
                    } catch (err) { /* noop */ }
                }

                // When stocking IN, log Purchase expenses using the **saved** unit price only
                // (use "Save price" or Done so market/brand changes are deliberate; avoids unsaved typos in the field).
                if (action === 'stockIn' && applied && applied.item && window.AdminRecords && typeof window.AdminRecords.logPurchaseExpense === 'function') {
                    var costPerUnit = Number(applied.item.unitCost != null ? applied.item.unitCost : 0) || 0;
                    if (costPerUnit > 0) {
                        var totalCost = raw * costPerUnit;
                        try {
                            window.AdminRecords.logPurchaseExpense({
                                itemName: applied.item.name,
                                quantity: raw,
                                unit: applied.item.unit,
                                unitCost: costPerUnit,
                                totalCost: totalCost,
                                ref: 'Inventory stock-in',
                                notes: 'Stock In: ' + raw + ' ' + (applied.item.unit || 'units') + ' • saved unit ₱' + costPerUnit.toFixed(2)
                            });
                        } catch (err) { /* noop */ }
                    }
                }

                if (deltaInput) deltaInput.value = '';
                return;
            }
            if (action === 'savePrice') {
                var priceItem = inventoryItems.find(function (x) { return x.id === id; });
                if (!priceItem) return;
                var priceInput = tbody.querySelector('input[data-action="unitCost"][data-id="' + id + '"]');
                var pv = priceInput ? Number(priceInput.value) : NaN;
                priceItem.unitCost = (Number.isFinite(pv) && pv >= 0) ? pv : 0;
                saveInventory();
                inventorySupabaseUpdate(priceItem.id, { unitCost: priceItem.unitCost });
                renderInventory();
                try {
                    if (typeof window.showToast === 'function') {
                        window.showToast('Unit price ₱' + Number(priceItem.unitCost).toFixed(2) + ' saved. Stock In will use this for purchase expenses.', 'success');
                    }
                } catch (err) { /* noop */ }
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
                    inventorySupabaseUpdate(u.id, { unit: u.unit });
                }
                return;
            }
            // unitCost: use "Save price" or Done — not auto-save on every change (market prices updated deliberately).
            if (action === 'reorder') {
                var r = inventoryItems.find(function (x) { return x.id === id; });
                if (r) {
                    var v = Number(el.value);
                    r.reorderLevel = (Number.isFinite(v) && v >= 0) ? v : 0;
                    saveInventory();
                    renderInventory();
                    inventorySupabaseUpdate(r.id, { reorderLevel: r.reorderLevel });
                }
                return;
            }
            if (action === 'expiryDate') {
                if (currentCategory === 'misc') return;
                var expItem = inventoryItems.find(function (x) { return x.id === id; });
                if (expItem) {
                    var val = (el.value && String(el.value).trim()) || null;
                    expItem.expiryDate = val ? val.slice(0, 10) : null;
                    saveInventory();
                    renderInventory();
                    inventorySupabaseUpdate(expItem.id, { expiryDate: expItem.expiryDate });
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

    /** Sync patch to the correct Supabase table for the active inventory tab. */
    function inventorySupabaseUpdate(id, patch) {
        if (!isSupabaseId(id)) return;
        var bridge = currentCategory === 'misc' ? window.MiscInventorySupabase : window.InventorySupabase;
        if (bridge && bridge.update) bridge.update(id, patch);
    }

    function inventorySupabaseDelete(id) {
        if (!isSupabaseId(id)) return;
        var bridge = currentCategory === 'misc' ? window.MiscInventorySupabase : window.InventorySupabase;
        if (bridge && bridge.delete) bridge.delete(id);
    }

    /**
     * Push items that exist only in localStorage (id starts with 'inv_') to Supabase,
     * then update their local id so future edits sync. Call after seeding when Supabase was empty.
     */
    function pushLocalInventoryToSupabase() {
        if (!window.InventorySupabase || !window.InventorySupabase.create) return Promise.resolve();
        var raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
        var list = raw ? JSON.parse(raw) : [];
        var localOnly = list.filter(function (x) { return x.id && String(x.id).indexOf('inv_') === 0; });
        if (localOnly.length === 0) return Promise.resolve();
        var done = 0;
        function next() {
            if (done >= localOnly.length) return Promise.resolve();
            var item = localOnly[done];
            return window.InventorySupabase.create(item).then(function (created) {
                if (created && created.id) {
                    item.id = created.id;
                    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(list));
                }
                done += 1;
                return next();
            }).catch(function () { done += 1; return next(); });
        }
        return next();
    }

    function pushLocalMiscToSupabase() {
        if (!window.MiscInventorySupabase || !window.MiscInventorySupabase.create) return Promise.resolve();
        var raw = localStorage.getItem(MISC_STORAGE_KEY);
        var list = raw ? JSON.parse(raw) : [];
        var localOnly = list.filter(function (x) { return x.id && String(x.id).indexOf('inv_') === 0; });
        if (localOnly.length === 0) return Promise.resolve();
        var done = 0;
        function next() {
            if (done >= localOnly.length) return Promise.resolve();
            var item = localOnly[done];
            return window.MiscInventorySupabase.create(item).then(function (created) {
                if (created && created.id) {
                    item.id = created.id;
                    localStorage.setItem(MISC_STORAGE_KEY, JSON.stringify(list));
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
        try {
            var s = sessionStorage.getItem('adminInventoryCategory');
            if (s === 'misc' || s === 'ingredient') currentCategory = s;
        } catch (e) { /* noop */ }

        var ingLoad = window.InventorySupabase && typeof window.InventorySupabase.load === 'function'
            ? window.InventorySupabase.load().catch(function () { return null; })
            : Promise.resolve(null);
        var miscLoad = window.MiscInventorySupabase && typeof window.MiscInventorySupabase.load === 'function'
            ? window.MiscInventorySupabase.load().catch(function () { return null; })
            : Promise.resolve(null);

        if (window.InventorySupabase || window.MiscInventorySupabase) {
            Promise.all([ingLoad, miscLoad]).then(function (pair) {
                var items = pair[0];
                var miscItems = pair[1];

                if (Array.isArray(items)) {
                    if (items.length > 0) {
                        localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(items));
                    } else {
                        seedIngredientTemplateIfEmpty(false);
                        pushLocalInventoryToSupabase();
                    }
                } else {
                    seedIngredientTemplateIfEmpty(false);
                    pushLocalInventoryToSupabase();
                }

                if (Array.isArray(miscItems)) {
                    if (miscItems.length > 0) {
                        localStorage.setItem(MISC_STORAGE_KEY, JSON.stringify(miscItems));
                    } else {
                        ensureMiscKeyExists();
                        pushLocalMiscToSupabase();
                    }
                } else {
                    ensureMiscKeyExists();
                }

                loadInventory();
                updateInventoryCategoryUI();
                runAfterLoad();
            });
        } else {
            seedIngredientTemplateIfEmpty(false);
            ensureMiscKeyExists();
            loadInventory();
            updateInventoryCategoryUI();
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
    window.setInventoryCategory = setInventoryCategory;
    window.openLogoutModal = openLogoutModal;
    window.closeLogoutModal = closeLogoutModal;
    window.confirmLogout = confirmLogout;
})();
