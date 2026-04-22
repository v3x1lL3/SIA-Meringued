/**
 * Connects cake orders to inventory: deduct ingredients when an order is confirmed,
 * restore when order is cancelled. Uses adminInventoryItems, adminMiscInventoryItems (baking extras), and customerOrders.
 * Cake types: Chocolate Moist, Mocha, Vanilla.
 */
(function () {
    const INVENTORY_KEY = 'adminInventoryItems';
    const MISC_INVENTORY_KEY = 'adminMiscInventoryItems';
    const ORDERS_KEY = 'customerOrders';

    // Ingredients needed per 1 "Medium" equivalent cake. Keys must match inventory ingredient names.
    const CAKE_RECIPES = {
        'Chocolate Moist': {
            'Flour': 2,
            'Sugar': 1.5,
            'Cocoa': 1,
            'Compound Chocolate': 1,
            'Baking Soda': 0.5,
            'Baking Powder': 0.5,
            'Evaporated Milk': 0.5,
            'Condensed Milk': 0.5,
            'Vegetable Oil': 0.5,
            'Egg': 2,
            'Butter': 1,
            'Fondant': 0.5
        },
        'Mocha': {
            'Flour': 2,
            'Sugar': 1.5,
            'Cocoa': 0.75,
            'Compound Chocolate': 0.5,
            'Baking Soda': 0.5,
            'Baking Powder': 0.5,
            'Evaporated Milk': 1,
            'Condensed Milk': 0.5,
            'Vegetable Oil': 0.5,
            'Egg': 2,
            'Butter': 1,
            'Fondant': 0.5
        },
        'Vanilla': {
            'Flour': 2,
            'Sugar': 1.5,
            'Baking Soda': 0.5,
            'Baking Powder': 0.5,
            'Evaporated Milk': 0.5,
            'Condensed Milk': 0.5,
            'Vegetable Oil': 0.5,
            'Egg': 2,
            'Butter': 1,
            'Flavorades': 0.5,
            'Fondant': 0.5
        }
    };

    // Size multiplier: ingredients scale by size (Medium = 1 base).
    const SIZE_MULTIPLIER = {
        'Small': 0.5,
        'Medium': 1,
        'Large': 1.5
    };

    function getRecipeForCake(cakeName) {
        const name = (cakeName || '').trim();
        return CAKE_RECIPES[name] || CAKE_RECIPES['Chocolate Moist'];
    }

    function getSizeMultiplier(size) {
        return SIZE_MULTIPLIER[size] || 1;
    }

    /**
     * Returns list of { name, quantity } needed for this order (positive numbers).
     */
    function getIngredientsNeededForOrder(order) {
        const recipe = getRecipeForCake(order.flavor || order.cake || order.name);
        const mult = getSizeMultiplier(order.size) * (Number(order.quantity) || 1);
        const list = [];
        Object.keys(recipe).forEach(function (ingredientName) {
            list.push({ name: ingredientName, quantity: (recipe[ingredientName] || 0) * mult });
        });
        return list;
    }

    function loadInventory() {
        const raw = localStorage.getItem(INVENTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    }

    function saveInventory(items) {
        localStorage.setItem(INVENTORY_KEY, JSON.stringify(items));
    }

    function loadMiscInventory() {
        const raw = localStorage.getItem(MISC_INVENTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    }

    function saveMiscInventory(items) {
        localStorage.setItem(MISC_INVENTORY_KEY, JSON.stringify(items));
    }

    /**
     * Apply delta to miscellaneous item quantity by name (adminMiscInventoryItems only).
     * Baking "extra / misc" stock out must not deduct baking ingredients.
     */
    function applyStockDeltaByNameMisc(itemName, delta, meta) {
        const items = loadMiscInventory();
        const nameLower = (itemName || '').toLowerCase();
        const item = items.find(function (x) {
            return (x.name || '').toLowerCase() === nameLower;
        });
        if (!item) return { ok: false, message: 'Not found in miscellaneous inventory' };
        const current = Number(item.quantity) || 0;
        item.quantity = Math.max(0, current + delta);
        item.lastStockMove = {
            at: new Date().toISOString(),
            delta: delta,
            reason: (meta && meta.reason) ? String(meta.reason) : 'Misc stock change'
        };
        saveMiscInventory(items);
        if (window.MiscOrderStockSupabase && typeof window.MiscOrderStockSupabase.applyDeltaByName === 'function') {
            window.MiscOrderStockSupabase.applyDeltaByName(itemName, delta);
        }
        if (window.AdminRecords && typeof window.AdminRecords.logInventoryMovement === 'function') {
            try {
                window.AdminRecords.logInventoryMovement({
                    itemId: item.id,
                    itemName: item.name,
                    delta: delta,
                    newQty: item.quantity,
                    unit: item.unit,
                    reason: meta && meta.reason ? meta.reason : 'Miscellaneous stock movement'
                });
            } catch (err) { /* noop */ }
        }
        if (typeof window.renderInventory === 'function') {
            window.renderInventory();
        }
        return { ok: true, item: item };
    }

    /**
     * Apply delta to ingredient quantity by name (case-insensitive match).
     * Updates localStorage; also syncs to Supabase when OrderIngredientsSupabase is available (POS).
     * Does not re-render UI; call window.renderInventory() from page if needed.
     */
    function applyStockDeltaByName(ingredientName, delta, meta) {
        const items = loadInventory();
        const nameLower = (ingredientName || '').toLowerCase();
        const item = items.find(function (x) {
            return (x.name || '').toLowerCase() === nameLower;
        });
        if (!item) return { ok: false, message: 'Not found in inventory' };
        const current = Number(item.quantity) || 0;
        item.quantity = Math.max(0, current + delta);
        item.lastStockMove = {
            at: new Date().toISOString(),
            delta: delta,
            reason: (meta && meta.reason) ? String(meta.reason) : 'Order stock change'
        };
        saveInventory(items);
        if (window.OrderIngredientsSupabase && typeof window.OrderIngredientsSupabase.applyDeltaByName === 'function') {
            window.OrderIngredientsSupabase.applyDeltaByName(ingredientName, delta);
        }
        if (window.AdminRecords && typeof window.AdminRecords.logInventoryMovement === 'function') {
            try {
                window.AdminRecords.logInventoryMovement({
                    itemId: item.id,
                    itemName: item.name,
                    delta: delta,
                    newQty: item.quantity,
                    unit: item.unit,
                    reason: meta && meta.reason ? meta.reason : 'Order-linked stock movement'
                });
            } catch (err) { /* noop */ }
        }
        if (typeof window.renderInventory === 'function') {
            window.renderInventory();
        }
        return { ok: true, item: item };
    }

    function normalizeBakingMiscLines(lines) {
        var bucket = {};
        (Array.isArray(lines) ? lines : []).forEach(function (line) {
            var name = line && line.name != null ? String(line.name).trim() : '';
            var qty = Number(line && line.quantity);
            if (!name || !(qty > 0)) return;
            var key = name.toLowerCase();
            if (!bucket[key]) bucket[key] = { name: name, quantity: 0 };
            bucket[key].quantity += qty;
        });
        return Object.keys(bucket)
            .map(function (k) { return bucket[k]; })
            .filter(function (x) { return x.quantity > 0; });
    }

    function applyBakingMiscStockOut(order, lines, previousLines) {
        const ref = order && (order.orderGroupId || order.supabase_id || order.id)
            ? String(order.orderGroupId || order.supabase_id || order.id)
            : '';
        const reasonBase = 'Baking — additional misc stock out' + (ref ? (' (' + ref + ')') : '');
        const applied = [];
        const failed = [];
        const current = normalizeBakingMiscLines(lines);
        const prev = normalizeBakingMiscLines(previousLines);
        const byNamePrev = {};
        prev.forEach(function (line) { byNamePrev[line.name.toLowerCase()] = line.quantity; });
        const byNameCurrent = {};
        current.forEach(function (line) { byNameCurrent[line.name.toLowerCase()] = line.quantity; });
        const allKeys = {};
        Object.keys(byNamePrev).forEach(function (k) { allKeys[k] = true; });
        Object.keys(byNameCurrent).forEach(function (k) { allKeys[k] = true; });

        Object.keys(allKeys).forEach(function (key) {
            var newQty = Number(byNameCurrent[key]) || 0;
            var oldQty = Number(byNamePrev[key]) || 0;
            var delta = newQty - oldQty;
            if (delta === 0) return;
            var canonicalName = '';
            var lineCurrent = current.find(function (x) { return x.name.toLowerCase() === key; });
            var linePrev = prev.find(function (x) { return x.name.toLowerCase() === key; });
            canonicalName = (lineCurrent && lineCurrent.name) || (linePrev && linePrev.name) || '';
            if (!canonicalName) return;

            // Positive delta means additional stock out (deduct). Negative means reduce/remove previous line (restore).
            var stockDelta = delta > 0 ? -Math.abs(delta) : Math.abs(delta);
            var reason = delta > 0 ? reasonBase : ('Baking — misc stock out adjusted (restore)' + (ref ? (' (' + ref + ')') : ''));
            const r = applyStockDeltaByNameMisc(canonicalName, stockDelta, { reason: reason });
            if (r && r.ok) {
                applied.push({ name: canonicalName, delta: delta, quantity: Math.abs(delta) });
            } else {
                failed.push({ name: canonicalName, delta: delta, quantity: Math.abs(delta), message: (r && r.message) ? r.message : 'Skipped' });
            }
        });
        return { applied: applied, failed: failed, lines: current };
    }

    /**
     * Deduct ingredients for one order. Call when order is confirmed (status moved from Pending).
     */
    function deductIngredientsForOrder(order) {
        const list = getIngredientsNeededForOrder(order);
        const ref = order && (order.orderGroupId || order.supabase_id || order.id) ? String(order.orderGroupId || order.supabase_id || order.id) : '';
        const reason = 'Order confirmed — stock out' + (ref ? (' (' + ref + ')') : '');
        list.forEach(function (entry) {
            applyStockDeltaByName(entry.name, -entry.quantity, { reason: reason });
        });
    }

    /**
     * Restore ingredients for one order. Call when order is cancelled.
     */
    function restoreIngredientsForOrder(order) {
        const list = getIngredientsNeededForOrder(order);
        const ref = order && (order.orderGroupId || order.supabase_id || order.id) ? String(order.orderGroupId || order.supabase_id || order.id) : '';
        const reason = 'Order cancelled — stock restored' + (ref ? (' (' + ref + ')') : '');
        list.forEach(function (entry) {
            applyStockDeltaByName(entry.name, entry.quantity, { reason: reason });
        });
    }

    /**
     * On admin load: restore stock for any order that is Cancelled and had ingredients deducted.
     * Uses per-user order storage when available (getAllOrdersForAdmin / saveOrdersForUser).
     */
    function restoreCancelledOrdersIngredientStock() {
        var orders = (typeof window.getAllOrdersForAdmin === 'function')
            ? window.getAllOrdersForAdmin()
            : (function () { try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); } catch (e) { return []; } })();
        var changed = false;
        orders.forEach(function (order) {
            if ((order.status === 'Cancelled') && order.ingredientsDeducted) {
                restoreIngredientsForOrder(order);
                order.ingredientsDeducted = false;
                changed = true;
            }
        });
        if (changed && typeof window.saveOrdersForUser === 'function') {
            var byUser = {};
            orders.forEach(function (o) {
                var uid = o.userId || 'guest';
                if (!byUser[uid]) byUser[uid] = [];
                byUser[uid].push(o);
            });
            Object.keys(byUser).forEach(function (uid) {
                window.saveOrdersForUser(uid, byUser[uid]);
            });
        } else if (changed) {
            try { localStorage.setItem(ORDERS_KEY, JSON.stringify(orders)); } catch (e) {}
        }
        return orders;
    }

    window.OrderIngredients = {
        getIngredientsNeededForOrder: getIngredientsNeededForOrder,
        deductIngredientsForOrder: deductIngredientsForOrder,
        restoreIngredientsForOrder: restoreIngredientsForOrder,
        restoreCancelledOrdersIngredientStock: restoreCancelledOrdersIngredientStock,
        getRecipeForCake: getRecipeForCake,
        getSizeMultiplier: getSizeMultiplier,
        applyBakingMiscStockOut: applyBakingMiscStockOut
    };
})();
