import { listProducts } from '../models/productModel.js';
import { renderProductList } from '../views/productView.js';
import { showToast } from '../core/utils.js';

export async function loadProductsInto(containerId) {
  try {
    const products = await listProducts();
    renderProductList(containerId, products);
  } catch (err) {
    console.error('[ProductController] loadProducts error', err);
    showToast('Failed to load products from Supabase.', 'error');
  }
}

