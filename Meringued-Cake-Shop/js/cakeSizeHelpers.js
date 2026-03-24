/**
 * Cake tier labels (Small / Medium / Large) → diameter × height in inches for display.
 * Stored order.size stays the tier name; use formatCakeSizeForDisplay() in UI/PDF text.
 */
(function (global) {
  var DIMS = {
    Small: '6"×4"',
    Medium: '8"×4"',
    Large: '8"×6"',
  };

  function cakeSizeDimensionsInches(sizeLabel) {
    if (sizeLabel == null || sizeLabel === '') return '';
    var key = String(sizeLabel).trim();
    return DIMS[key] || '';
  }

  function formatCakeSizeForDisplay(sizeLabel) {
    if (sizeLabel == null || sizeLabel === '') return '—';
    var key = String(sizeLabel).trim();
    var dim = cakeSizeDimensionsInches(key);
    return dim ? key + ' — ' + dim : key;
  }

  global.cakeSizeDimensionsInches = cakeSizeDimensionsInches;
  global.formatCakeSizeForDisplay = formatCakeSizeForDisplay;
})(typeof window !== 'undefined' ? window : globalThis);
