// Dashboard view: updates existing cards in admindashboard/clientdashboard.

export function renderAdminSummary({ totalOrders, pending, processing, completed, today, revenue }) {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  if (typeof totalOrders === 'number') setText('totalOrders', totalOrders);
  if (typeof pending === 'number') setText('pendingOrders', pending);
  if (typeof processing === 'number') setText('processingOrders', processing);
  if (typeof completed === 'number') setText('completedOrders', completed);
  if (typeof today === 'number') setText('todayOrders', today);
  if (typeof revenue === 'number') {
    const el = document.getElementById('totalRevenue');
    if (el) el.textContent = `₱${revenue.toFixed(2)}`;
  }
}

export function renderClientSummary({ totalOrders, pending, completed }) {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  if (typeof totalOrders === 'number') setText('totalOrders', totalOrders);
  if (typeof pending === 'number') setText('pendingOrders', pending);
  if (typeof completed === 'number') setText('completedOrders', completed);
}

