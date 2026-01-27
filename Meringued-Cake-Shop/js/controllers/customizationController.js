import { listCustomizationOptions, listCustomizationValues } from '../models/customizationModel.js';
import { renderCustomizationOptions } from '../views/customizationView.js';
import { showToast } from '../core/utils.js';

export async function loadCustomizationUI(containerId) {
  try {
    const options = await listCustomizationOptions();
    const valuesByOptionId = {};
    for (const opt of options) {
      valuesByOptionId[opt.id] = await listCustomizationValues(opt.id);
    }
    renderCustomizationOptions(containerId, options, valuesByOptionId);
  } catch (err) {
    console.error('[CustomizationController] loadCustomizationUI error', err);
    showToast('Failed to load customization options.', 'error');
  }
}

