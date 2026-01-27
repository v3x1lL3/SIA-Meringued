import { listSuppliers } from '../models/supplierModel.js';
import { renderSuppliers } from '../views/supplierView.js';
import { showToast } from '../core/utils.js';

export async function loadSuppliers(containerId) {
  try {
    const suppliers = await listSuppliers();
    renderSuppliers(containerId, suppliers);
  } catch (err) {
    console.error('[SupplierController] loadSuppliers error', err);
    showToast('Failed to load suppliers.', 'error');
  }
}

