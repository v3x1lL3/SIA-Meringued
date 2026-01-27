// Customization model: read customization options (sizes, flavors, toppings).
import { supabase } from '../core/supabaseClient.js';

const CUSTOM_OPTIONS = 'product_options';
const CUSTOM_VALUES = 'product_option_values';

export async function listCustomizationOptions() {
  const { data, error } = await supabase
    .from(CUSTOM_OPTIONS)
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listCustomizationValues(optionId) {
  const query = supabase.from(CUSTOM_VALUES).select('*');
  if (optionId) query.eq('option_id', optionId);
  const { data, error } = await query.order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

