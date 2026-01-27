import { listInventoryItems, listLowStock } from '../models/inventoryModel.js';
import { renderInventoryList } from '../views/inventoryView.js';
import { showToast } from '../core/utils.js';

export async function loadInventory(containerId) {
  try {
    const items = await listInventoryItems();
    renderInventoryList(containerId, items);
  } catch (err) {
    console.error('[InventoryController] loadInventory error', err);
    showToast('Failed to load inventory from Supabase.', 'error');
  }
}

export async function loadLowStock(containerId, threshold = 5) {
  try {
    const items = await listLowStock(threshold);
    renderInventoryList(containerId, items);
  } catch (err) {
    console.error('[InventoryController] loadLowStock error', err);
    showToast('Failed to load low-stock items.', 'error');
  }
}

