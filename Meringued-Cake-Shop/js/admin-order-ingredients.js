/**
 * Connects cake orders to inventory: deduct ingredients when an order is confirmed,
 * restore when order is cancelled. Uses localStorage adminInventoryItems and customerOrders.
 * Cake types: Chocolate Moist, Mocha, Vanilla.
 */
(function () {
    const INVENTORY_KEY = 'adminInventoryItems';
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

    /**
     * Apply delta to ingredient quantity by name (case-insensitive match).
     * Does not re-render UI; call window.renderInventory() from page if needed.
     */
    function applyStockDeltaByName(ingredientName, delta) {
        const items = loadInventory();
        const nameLower = (ingredientName || '').toLowerCase();
        const item = items.find(function (x) {
            return (x.name || '').toLowerCase() === nameLower;
        });
        if (!item) return;
        const current = Number(item.quantity) || 0;
        item.quantity = Math.max(0, current + delta);
        saveInventory(items);
        if (typeof window.renderInventory === 'function') {
            window.renderInventory();
        }
    }

    /**
     * Deduct ingredients for one order. Call when order is confirmed (status moved from Pending).
     */
    function deductIngredientsForOrder(order) {
        const list = getIngredientsNeededForOrder(order);
        list.forEach(function (entry) {
            applyStockDeltaByName(entry.name, -entry.quantity);
        });
    }

    /**
     * Restore ingredients for one order. Call when order is cancelled.
     */
    function restoreIngredientsForOrder(order) {
        const list = getIngredientsNeededForOrder(order);
        list.forEach(function (entry) {
            applyStockDeltaByName(entry.name, entry.quantity);
        });
    }

    /**
     * On admin load: restore stock for any order that is Cancelled and had ingredients deducted
     * (e.g. client cancelled on same browser). Updates customerOrders in localStorage.
     */
    function restoreCancelledOrdersIngredientStock() {
        const raw = localStorage.getItem(ORDERS_KEY);
        const orders = raw ? JSON.parse(raw) : [];
        let changed = false;
        orders.forEach(function (order) {
            if ((order.status === 'Cancelled') && order.ingredientsDeducted) {
                restoreIngredientsForOrder(order);
                order.ingredientsDeducted = false;
                changed = true;
            }
        });
        if (changed) {
            localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
        }
        return orders;
    }

    window.OrderIngredients = {
        getIngredientsNeededForOrder: getIngredientsNeededForOrder,
        deductIngredientsForOrder: deductIngredientsForOrder,
        restoreIngredientsForOrder: restoreIngredientsForOrder,
        restoreCancelledOrdersIngredientStock: restoreCancelledOrdersIngredientStock,
        getRecipeForCake: getRecipeForCake,
        getSizeMultiplier: getSizeMultiplier
    };
})();
