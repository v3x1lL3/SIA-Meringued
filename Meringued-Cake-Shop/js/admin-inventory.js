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
                imageSrc: ''
            };
        });
        saveInventory();
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
        if (!tbody) return;

        if (!inventoryItems || inventoryItems.length === 0) {
            tbody.innerHTML = '';
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

            return '<tr class="border-b border-gray-100 hover:bg-[#FFF8F0]/40 transition">' +
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
                '<div class="flex items-center gap-2">' +
                '<input data-action="delta" data-id="' + escapeHtml(item.id) + '" type="number" min="0" step="0.01" class="w-28 px-3 py-2 rounded-lg border border-gray-200 focus:border-[#D4AF37] focus:outline-none text-sm" placeholder="0">' +
                '<button data-action="stockIn" data-id="' + escapeHtml(item.id) + '" class="px-3 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-600 hover:text-white transition text-sm font-semibold"><i class="fas fa-plus mr-1"></i>In</button>' +
                '<button data-action="stockOut" data-id="' + escapeHtml(item.id) + '" class="px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-600 hover:text-white transition text-sm font-semibold"><i class="fas fa-minus mr-1"></i>Out</button>' +
                '</div></td>' +
                '<td class="py-3 px-3"><div class="flex gap-2 justify-end">' +
                '<button data-action="delete" data-id="' + escapeHtml(item.id) + '" class="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition text-gray-700 text-sm font-semibold"><i class="fas fa-trash mr-2 text-red-600"></i>Delete</button>' +
                '</div></td></tr>';
        }).join('');
    }

    function applyStockDelta(id, delta) {
        loadInventory();
        var item = inventoryItems.find(function (x) { return x.id === id; });
        if (!item) return;
        var current = Number(item.quantity) || 0;
        item.quantity = Math.max(0, current + delta);
        saveInventory();
        renderInventory();
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
            inventoryItems.unshift({
                id: 'inv_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
                name: name,
                quantity: Math.max(0, qty),
                unit: unit,
                reorderLevel: Math.max(0, reorderLevel),
                imageSrc: imageSrc || ''
            });
            saveInventory();
            renderInventory();
            var form = document.getElementById('inventoryAddForm');
            if (form) form.reset();
            var qtyEl = document.getElementById('invQty');
            var reorderEl = document.getElementById('invReorder');
            var unitEl = document.getElementById('invUnit');
            if (qtyEl) qtyEl.value = 0;
            if (reorderEl) reorderEl.value = 0;
            if (unitEl) unitEl.value = 'units';
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
            });
        } else {
            item.imageSrc = imageSrc || '';
            saveInventory();
            renderInventory();
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
                if (u) { u.unit = el.value || 'units'; saveInventory(); renderInventory(); }
                return;
            }
            if (action === 'reorder') {
                var r = inventoryItems.find(function (x) { return x.id === id; });
                if (r) {
                    var v = Number(el.value);
                    r.reorderLevel = (Number.isFinite(v) && v >= 0) ? v : 0;
                    saveInventory();
                    renderInventory();
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

    function init() {
        if (!document.getElementById('inventoryTableBody')) return;
        if (window.OrderIngredients && window.OrderIngredients.restoreCancelledOrdersIngredientStock) {
            window.OrderIngredients.restoreCancelledOrdersIngredientStock();
        }
        seedInventoryTemplateIfEmpty();
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
