/**
 * Admin orders table: filters, pipeline stepper, next-step actions, baking misc stock-out, Supabase merge.
 */
(function () {
    'use strict';

    function fmtAdminCakeSize(sz) {
        if (typeof window !== 'undefined' && typeof window.formatCakeSizeForDisplay === 'function') {
            return window.formatCakeSizeForDisplay(sz);
        }
        return sz != null && sz !== '' ? String(sz) : 'N/A';
    }

    var orders = [];
    var currentOrderId = null;
    var ordersLoadGen = 0;
    var ordersStatusFilter = 'open';
    var bakingMiscOrderId = null;

    var ORDER_PIPELINE = ['Pending', 'Acknowledge', 'Baking', 'Ready', 'Completed'];

    function normalizeOrderStatus(order) {
        var s = (order && order.status != null) ? String(order.status).trim() : '';
        if (!s) return 'Pending';
        var lower = s.toLowerCase();
        var map = {
            pending: 'Pending',
            acknowledge: 'Acknowledge',
            baking: 'Baking',
            ready: 'Ready',
            completed: 'Completed',
            cancelled: 'Cancelled'
        };
        return map[lower] || s;
    }

    function orderMatchesStatusFilter(order, filter) {
        if (filter === 'all') return true;
        var st = normalizeOrderStatus(order);
        if (filter === 'open') {
            return st === 'Pending' || st === 'Acknowledge' || st === 'Baking' || st === 'Ready';
        }
        return st === filter;
    }

    function setOrderStatusFilter(filter) {
        ordersStatusFilter = filter || 'open';
        var tabs = document.querySelectorAll('#ordersFilterTabs [data-orders-filter]');
        tabs.forEach(function (btn) {
            var on = btn.getAttribute('data-orders-filter') === ordersStatusFilter;
            btn.classList.toggle('orders-filter-tab-active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        renderOrdersTable();
    }

    function updateOrderFilterChrome() {
        var list = Array.isArray(orders) ? orders : [];
        var pendingN = list.filter(function (o) { return normalizeOrderStatus(o) === 'Pending'; }).length;
        ['open', 'all', 'Pending', 'Acknowledge', 'Baking', 'Ready', 'Completed', 'Cancelled'].forEach(function (key) {
            var n = key === 'all' ? list.length : list.filter(function (o) { return orderMatchesStatusFilter(o, key); }).length;
            var el = document.querySelector('[data-filter-count="' + key + '"]');
            if (el) el.textContent = String(n);
        });
        var newTabBtn = document.querySelector('#ordersFilterTabs [data-orders-filter="Pending"]');
        if (newTabBtn) {
            newTabBtn.classList.toggle('ring-2', pendingN > 0);
            newTabBtn.classList.toggle('ring-amber-400', pendingN > 0);
            newTabBtn.classList.toggle('ring-offset-2', pendingN > 0);
        }
        var banner = document.getElementById('ordersPendingBanner');
        var bannerCount = document.getElementById('ordersPendingBannerCount');
        if (banner && bannerCount) {
            bannerCount.textContent = String(pendingN);
            banner.classList.toggle('hidden', pendingN < 1);
        }
    }

    function emptyHintForFilter(filter) {
        var map = {
            open: 'No in-progress orders.',
            all: 'No orders loaded. Check Supabase sync or Row Level Security (RLS) if the table has data.',
            Pending: 'No new (Pending) orders.',
            Acknowledge: 'No orders in Acknowledge.',
            Baking: 'No orders in Baking.',
            Ready: 'No orders ready for pickup or delivery.',
            Completed: 'No completed orders in this list.',
            Cancelled: 'No cancelled orders.'
        };
        return map[filter] || 'No orders in this view.';
    }

    function statusDisplayLabel(s) {
        if (s === 'Ready') return 'Ready for pickup / delivery';
        if (s === 'Pending') return 'New order';
        return s || '';
    }

    function stepRowLabel(step) {
        if (step === 'Pending') return 'New';
        if (step === 'Ready') return 'Ready';
        return step || '';
    }

    function nextStepButtonLabel(nextSt) {
        if (nextSt === 'Acknowledge') return 'Acknowledge order';
        if (nextSt === 'Baking') return 'Start baking';
        if (nextSt === 'Ready') return 'Mark ready';
        if (nextSt === 'Completed') return 'Mark completed';
        return nextSt || 'Next';
    }

    function getNextPipelineStatus(order) {
        var st = normalizeOrderStatus(order);
        if (st === 'Cancelled' || st === 'Completed') return null;
        var i = ORDER_PIPELINE.indexOf(st);
        if (i === -1) i = 0;
        if (i >= ORDER_PIPELINE.length - 1) return null;
        return ORDER_PIPELINE[i + 1];
    }

    function statusHierarchyMap() {
        return {
            Pending: 0,
            Acknowledge: 1,
            Baking: 2,
            Ready: 3,
            Completed: 4,
            Cancelled: 99
        };
    }

    function validateStatusTransition(currentStatus, newStatus) {
        var h = statusHierarchyMap();
        var cur = normalizeOrderStatus({ status: currentStatus });
        var next = newStatus;
        var curLv = h[cur] != null ? h[cur] : 0;
        var nextLv = h[next] != null ? h[next] : 0;
        if (nextLv < curLv && next !== 'Cancelled') {
            return 'You cannot revert to a previous status.';
        }
        if ((cur === 'Completed' || cur === 'Cancelled') && next !== cur) {
            return 'This order is already finalized.';
        }
        return null;
    }

    function isOrder50PercentDown(order) {
        if (!order) return false;
        var pp = String(order.paymentPlan || '');
        var pm = String(order.paymentMethod || '');
        if (/50\s*%/i.test(pm)) return true;
        if (/50\s*%/i.test(pp) && /down/i.test(pp)) return true;
        return false;
    }

    function orderHasUsableReceipt(order) {
        if (!order || order.receipt == null) return false;
        var s = String(order.receipt).trim();
        return s.length > 0;
    }

    function adminPaymentDisplayLabel(order) {
        if (isOrder50PercentDown(order)) return '50% down payment';
        return 'Pay in full';
    }

    /** Delivery → customer mobile; Pick up → shop / owner phone. */
    function orderDisplayContact(order) {
        var deliver = String(order && order.deliveryType ? order.deliveryType : '')
            .trim()
            .toLowerCase()
            .startsWith('deliver');
        var phone = deliver
            ? order && order.customerPhone
            : order && (order.ownerPhone || order.customerPhone);
        var sub = deliver ? 'Customer' : 'Shop pickup';
        phone = phone != null ? String(phone).trim() : '';
        return { phone: phone, sub: sub };
    }

    function buildReadyPaymentSettlementHtml(order) {
        var partial = isOrder50PercentDown(order);
        if (partial) {
            var extra = '';
            var price = Number(order.price);
            var down = order.downPaymentAmount != null ? Number(order.downPaymentAmount) : null;
            if (Number.isFinite(price) && down != null && Number.isFinite(down)) {
                var rem = Math.max(0, price - down);
                extra = ' Remaining: <strong>₱' + rem.toFixed(2) + '</strong>.';
            }
            return (
                '<div class="orders-ready-pay orders-ready-pay--partial">' +
                '<span class="font-semibold">50% down payment</span>' +
                '<span>Collect the rest at pickup or delivery.' + extra + '</span></div>'
            );
        }
        return (
            '<div class="orders-ready-pay orders-ready-pay--full">' +
            '<span class="font-semibold">Pay in full</span>' +
            '<span>Not on 50% down — full order amount applies. Confirm payment using the customer\'s <strong>receipt</strong> (link in the Payment column).</span></div>'
        );
    }

    function buildReadyPaymentColumnBadgeHtml(order) {
        if (isOrder50PercentDown(order)) {
            return (
                '<div class="mt-1.5 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-950 border border-amber-200/80">' +
                '50% down · balance due</div>'
            );
        }
        var text = orderHasUsableReceipt(order) ? 'Pay in full · receipt on file' : 'Pay in full';
        return (
            '<div class="mt-1.5 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-950 border border-emerald-200/80">' +
            escapeHtml(text) + '</div>'
        );
    }

    function buildStepperRowHtml(order) {
        var st = normalizeOrderStatus(order);
        if (st === 'Cancelled') {
            return '<div class="text-xs text-red-700 font-medium rounded-md border border-red-200 bg-red-50 px-2 py-1.5"><i class="fas fa-ban mr-1"></i>Cancelled</div>';
        }
        var idx = ORDER_PIPELINE.indexOf(st);
        if (idx === -1) idx = 0;
        var isDoneOrder = st === 'Completed';
        var currentStep = ORDER_PIPELINE[idx];
        var caption = stepRowLabel(currentStep);
        if (currentStep === 'Ready') caption = 'Ready for pickup / delivery';
        var trackParts = [];
        ORDER_PIPELINE.forEach(function (step, i) {
            var done = isDoneOrder || i < idx;
            var cur = !isDoneOrder && i === idx;
            var dotClass = 'orders-dot ';
            if (done) dotClass += 'orders-dot--done';
            else if (cur) dotClass += 'orders-dot--current';
            else dotClass += 'orders-dot--todo';
            trackParts.push(
                '<span class="' + dotClass + '" role="img" aria-label="' + escapeHtml(statusDisplayLabel(step)) + '"></span>'
            );
            if (i < ORDER_PIPELINE.length - 1) {
                var lineDone = isDoneOrder || i < idx;
                trackParts.push(
                    '<span class="orders-progress-connector' + (lineDone ? ' orders-progress-connector--done' : '') + '" aria-hidden="true"></span>'
                );
            }
        });
        var stepNum = isDoneOrder ? 5 : idx + 1;
        return (
            '<div class="orders-progress-wrap">' +
            '<div class="orders-progress-meta">Fulfillment · step ' + stepNum + ' of 5</div>' +
            '<div class="orders-progress-track">' + trackParts.join('') + '</div>' +
            '<div class="orders-progress-caption">' + escapeHtml(caption) + '</div>' +
            (currentStep === 'Ready' ? buildReadyPaymentSettlementHtml(order) : '') +
            '</div>'
        );
    }

    function findOrderIndexById(orderId) {
        return orders.findIndex(function (o) { return String(o.id) === String(orderId); });
    }

    function performOrderStatusUpdate(orderIndex, newStatus) {
        var order = orders[orderIndex];
        if (!order) return;
        var currentStatus = normalizeOrderStatus(order);
        order.status = newStatus;

        if (newStatus === 'Completed' && currentStatus !== 'Completed') {
            if (window.AdminRecords && typeof window.AdminRecords.logSaleFromOrder === 'function') {
                try { window.AdminRecords.logSaleFromOrder(order); } catch (err) {}
            }
            if (window.AdminPayments && typeof window.AdminPayments.logPaymentFromOrder === 'function') {
                try { window.AdminPayments.logPaymentFromOrder(order); } catch (err) {}
            }
        }

        if (window.OrderIngredients) {
            if (newStatus === 'Cancelled') {
                if (order.ingredientsDeducted) {
                    window.OrderIngredients.restoreIngredientsForOrder(order);
                    order.ingredientsDeducted = false;
                }
            } else if (currentStatus === 'Pending' && !order.ingredientsDeducted) {
                window.OrderIngredients.deductIngredientsForOrder(order);
                order.ingredientsDeducted = true;
            }
        }

        var uid = order.userId;
        if (uid && typeof getOrdersForUser === 'function' && typeof saveOrdersForUser === 'function') {
            var list = getOrdersForUser(uid);
            var idx = list.findIndex(function (o) { return String(o.id) === String(order.id); });
            if (idx !== -1) list[idx] = order;
            saveOrdersForUser(uid, list);
        } else if (typeof updateOrderInStorage === 'function') {
            updateOrderInStorage(order.id, { status: order.status, ingredientsDeducted: order.ingredientsDeducted });
        } else {
            try { localStorage.setItem('customerOrders', JSON.stringify(orders)); } catch (e) {}
        }

        if (order.supabase_id && typeof window.updateOrderInSupabase === 'function') {
            window.updateOrderInSupabase(order.supabase_id, { status: newStatus });
        }

        reloadOrdersMerged();
        showToast('Order moved to: ' + statusDisplayLabel(newStatus));
    }

    function advanceOrderNextStep(orderId) {
        var orderIndex = findOrderIndexById(orderId);
        if (orderIndex === -1) {
            alert('Order not found. Try refreshing the page.');
            return;
        }
        var next = getNextPipelineStatus(orders[orderIndex]);
        if (!next) return;
        var cur = normalizeOrderStatus(orders[orderIndex]);
        var err = validateStatusTransition(cur, next);
        if (err) {
            alert(err);
            return;
        }
        if (next === 'Completed') {
            if (!confirm('Mark this order as Completed? Sales / payment logging will run if configured.')) return;
        }
        performOrderStatusUpdate(orderIndex, next);
    }

    function loadOrders() {
        orders = typeof getAllOrdersForAdmin === 'function' ? getAllOrdersForAdmin() : (function () {
            try { return JSON.parse(localStorage.getItem('customerOrders') || '[]'); } catch (e) { return []; }
        })();
    }

    function setOrdersCloudSyncHint(visible) {
        var el = document.getElementById('ordersCloudSyncHint');
        if (el) el.classList.toggle('hidden', !visible);
    }

    function setOrdersSourceBanner(source) {
        var el = document.getElementById('ordersSourceBanner');
        if (!el) return;
        if (source === 'local') {
            el.className =
                'mb-4 text-sm text-amber-950 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2';
            el.innerHTML =
                '<i class="fas fa-database mr-2 text-amber-700" aria-hidden="true"></i><strong>Source: localStorage only</strong> — could not load orders from Supabase (same idea as Records falling back). Fix connection, URL/key, and RLS; then refresh.';
            el.classList.remove('hidden');
        } else {
            el.className =
                'mb-4 text-sm text-emerald-900 bg-emerald-50/90 border border-emerald-200 rounded-xl px-4 py-2';
            el.innerHTML =
                '<i class="fas fa-cloud mr-2 text-emerald-700" aria-hidden="true"></i><strong>Orders linked to Supabase</strong> — list is merged with cloud rows (like Records using the database).';
            el.classList.remove('hidden');
        }
    }

    async function reloadOrdersMerged() {
        var myGen = ++ordersLoadGen;
        loadOrders();
        var hadLocalActive = orders.some(function (o) { return o && normalizeOrderStatus(o) !== 'Cancelled'; });
        renderOrdersTable();
        setOrdersCloudSyncHint(!hadLocalActive);

        try {
            // Script file is in js/ — must be ./admin-orders-merge.js (NOT ./js/... → broken js/js/ path).
            var m = await import('./admin-orders-merge.js');
            var mergedResult = await Promise.race([
                m.fetchMergedOrdersForAdmin(),
                new Promise(function (_, rej) {
                    setTimeout(function () { rej(new Error('Supabase orders fetch timed out')); }, 20000);
                })
            ]);
            if (myGen !== ordersLoadGen) return;
            var list = mergedResult && mergedResult.orders ? mergedResult.orders : mergedResult;
            var src = mergedResult && mergedResult.source ? mergedResult.source : 'supabase';
            orders = Array.isArray(list) ? list : [];
            setOrdersSourceBanner(src);
        } catch (e) {
            if (myGen !== ordersLoadGen) return;
            console.warn('[admin-ordering-page] Cloud merge failed, showing local orders only:', e && e.message ? e.message : e);
            loadOrders();
            setOrdersSourceBanner('local');
        }
        if (myGen !== ordersLoadGen) return;
        setOrdersCloudSyncHint(false);
        renderOrdersTable();
    }

    function getStatusColor(status) {
        var statusColors = {
            Pending: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
            Acknowledge: 'bg-blue-100 text-blue-700 border border-blue-300',
            Baking: 'bg-purple-100 text-purple-700 border border-purple-300',
            Ready: 'bg-green-100 text-green-700 border border-green-300',
            Completed: 'bg-gray-100 text-gray-700 border border-gray-300',
            Cancelled: 'bg-red-100 text-red-700 border border-red-300'
        };
        return statusColors[status] || 'bg-gray-100 text-gray-700 border border-gray-300';
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    function renderOrdersTable() {
        var tbody = document.getElementById('ordersTableBody');
        var emptyDiv = document.getElementById('emptyOrders');
        var emptyHint = document.getElementById('emptyOrdersHint');
        var table = document.getElementById('ordersTable');
        if (!tbody || !table) return;

        updateOrderFilterChrome();
        document.body.classList.toggle('orders-view-cancelled', ordersStatusFilter === 'Cancelled');

        var filtered = (Array.isArray(orders) ? orders : []).filter(function (order) {
            return orderMatchesStatusFilter(order, ordersStatusFilter);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            table.classList.add('hidden');
            emptyDiv.classList.remove('hidden');
            if (emptyHint) emptyHint.textContent = emptyHintForFilter(ordersStatusFilter);
            return;
        }

        table.classList.remove('hidden');
        emptyDiv.classList.add('hidden');

        var rowsHTML = filtered
            .slice()
            .sort(function (a, b) {
                var gidA = a.orderGroupId || '';
                var gidB = b.orderGroupId || '';
                if (gidA !== gidB) return gidB.localeCompare(gidA);
                var da = Date.parse(a.created_at) || Date.parse(a.date) || 0;
                var db = Date.parse(b.created_at) || Date.parse(b.date) || 0;
                return db - da;
            })
            .map(function (order) {
                var normStatus = normalizeOrderStatus(order);
                var statusColor = getStatusColor(normStatus);
                var idAttr = encodeURIComponent(String(order.id));
                var isNew = normStatus === 'Pending';
                var rowHighlight = isNew ? 'border-l-4 border-amber-500 bg-amber-50/50' : '';
                var nextSt = getNextPipelineStatus(order);
                var progressColClass =
                    'orders-col-progress py-3 px-2 align-top w-[270px] min-w-[270px] max-w-[300px]';
                var readyPaymentTagHtml = '';
                if (normStatus === 'Ready') {
                    readyPaymentTagHtml = buildReadyPaymentColumnBadgeHtml(order);
                }
                var payLabel = adminPaymentDisplayLabel(order);
                var labelClass = isOrder50PercentDown(order) ? 'font-semibold text-amber-800' : 'font-semibold text-gray-800';
                var receiptBtn;
                if (orderHasUsableReceipt(order)) {
                    receiptBtn =
                        '<div class="' + labelClass + '">' + escapeHtml(payLabel) + '</div>' +
                        '<button type="button" data-order-action="receipt" data-order-id="' +
                        idAttr +
                        '" class="mt-1 inline-block text-sm font-medium text-[#D4AF37] hover:text-[#B8941E] underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0">' +
                        'receipt</button>';
                } else {
                    receiptBtn = '<div class="' + labelClass + '">' + escapeHtml(payLabel) + '</div>';
                }

                var progressInnerHtml;
                if (normStatus === 'Completed') {
                    progressInnerHtml =
                        '<div class="orders-progress-donebox">' +
                        '<i class="fas fa-check-circle text-emerald-600" aria-hidden="true"></i><span>Completed</span></div>';
                } else if (normStatus === 'Cancelled') {
                    progressInnerHtml = '';
                } else {
                    var stepperHtml = buildStepperRowHtml(order);
                    var bakingMiscBtnHtml = '';
                    if (normStatus === 'Baking') {
                        bakingMiscBtnHtml =
                            '<button type="button" data-order-action="baking-misc" data-order-id="' + idAttr + '" class="orders-btn-misc" title="Deduct miscellaneous supplies (boxes, bags, etc.)">' +
                            '<i class="fas fa-minus-circle mr-1" aria-hidden="true"></i>Miscellaneous stock out</button>';
                    }
                    var nextBtnHtml = '';
                    if (nextSt) {
                        nextBtnHtml =
                            '<button type="button" data-order-action="next-step" data-order-id="' + idAttr + '" class="orders-btn-next">Continue to ' +
                            escapeHtml(nextStepButtonLabel(nextSt)) + '</button>';
                    }
                    var moreOptionsHtml =
                        '<button type="button" data-order-action="status" data-order-id="' + idAttr + '" class="orders-btn-more">Other options or cancel</button>';
                    progressInnerHtml =
                        '<div class="flex flex-col gap-0">' + stepperHtml + bakingMiscBtnHtml + nextBtnHtml + moreOptionsHtml + '</div>';
                }

                if (ordersStatusFilter === 'Cancelled') {
                    progressColClass = 'orders-col-progress orders-col-progress--cancelled py-3 px-2 align-top hidden md:table-cell w-0 p-0 border-0 overflow-hidden';
                }

                return (
                    '<tr class="border-b border-gray-200 hover:bg-gray-50 transition ' + rowHighlight + '">' +
                    '<td class="py-4 px-4 text-gray-700 text-xs font-mono max-w-[140px]">' +
                    '<span class="block truncate" title="' +
                    escapeHtml(String(order.orderGroupId || '-')) + '">' +
                    escapeHtml(order.orderGroupId || '-') +
                    '</span>' +
                    (!order.supabase_id
                        ? '<div class="mt-1 text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 inline-block max-w-full" title="This order exists only in the browser or local storage — it was not inserted into Supabase. Check customer login, RLS INSERT policy, and browser console when placing the order.">Local only · not in cloud</div>'
                        : '') +
                    '</td>' +
                    '<td class="py-4 px-4 text-gray-600 text-sm">' +
                    escapeHtml(order.date || (order.created_at ? String(order.created_at).slice(0, 10) : '') || '—') + '</td>' +
                    '<td class="py-4 px-4">' +
                    '<button type="button" data-order-action="details" data-order-id="' + idAttr + '" class="text-left w-full">' +
                    '<div class="font-semibold text-gray-800 hover:text-[#D4AF37] transition cursor-pointer">' +
                    escapeHtml(order.name || order.cake || 'Custom Order') + '</div>' +
                    '<div class="text-xs text-gray-500 mt-1">Click to view details</div></button></td>' +
                    '<td class="py-4 px-4 text-gray-700"><div class="font-medium">' + escapeHtml(order.deliveryType || 'Pick up') + '</div>' +
                    (order.deliveryType === 'Deliver' && order.deliveryAddress
                        ? '<div class="text-xs text-gray-600 mt-1 max-w-[200px]" title="' +
                          escapeHtml(order.deliveryAddress).replace(/"/g, '&quot;') +
                          '"><i class="fas fa-map-marker-alt mr-1 text-[#D4AF37]"></i>' +
                          escapeHtml(order.deliveryAddress) + '</div>'
                        : '') +
                    '</td>' +
                    '<td class="py-4 px-4 text-gray-700 text-sm">' +
                    (function () {
                        var dc = orderDisplayContact(order);
                        if (!dc.phone) return '—';
                        return (
                            '<div><a href="tel:' +
                            escapeHtml(dc.phone).replace(/\s/g, '') +
                            '" class="text-gray-800 hover:text-[#B8941E] hover:underline">' +
                            escapeHtml(dc.phone) +
                            '</a><div class="text-[10px] text-gray-500 mt-0.5">' +
                            escapeHtml(dc.sub) +
                            '</div></div>'
                        );
                    })() +
                    '</td>' +
                    '<td class="py-4 px-4 text-gray-700"><div>' + receiptBtn + '</div>' + readyPaymentTagHtml + '</td>' +
                    '<td class="py-4 px-4 text-gray-700">' +
                    (order.dateNeeded ? new Date(order.dateNeeded).toLocaleDateString() : '—') +
                    '</td>' +
                    '<td class="py-4 px-4 font-semibold text-gray-900 tabular-nums">₱' + (order.price || 0).toFixed(2) + '</td>' +
                    '<td class="py-4 px-4"><span class="px-3 py-1 rounded-full text-xs font-semibold ' + statusColor + '">' +
                    escapeHtml(normStatus) + '</span></td>' +
                    '<td class="' + progressColClass + '">' + progressInnerHtml + '</td></tr>'
                );
            })
            .join('');

        tbody.innerHTML = rowsHTML;
    }

    function showToast(message) {
        var toast = document.createElement('div');
        toast.className = 'fixed top-6 right-6 bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl z-50 transform transition-all';
        toast.innerHTML =
            '<div class="flex items-center space-x-3"><i class="fas fa-check-circle text-2xl"></i><span class="font-medium">' +
            escapeHtml(message) +
            '</span></div>';
        document.body.appendChild(toast);
        setTimeout(function () {
            toast.style.opacity = '0';
            setTimeout(function () { toast.remove(); }, 300);
        }, 3000);
    }

    function viewOrderDetails(orderId) {
        var order = orders.find(function (o) { return String(o.id) === String(orderId); });
        if (!order) {
            alert('Order not found');
            return;
        }
        var detailsContent = document.getElementById('orderDetailsContent');
        var designBlock = '';
        if (order.cakeDesign || order.designImage || (Array.isArray(order.designImages) && order.designImages.length)) {
            var imgs = [];
            if (Array.isArray(order.designImages) && order.designImages.length) {
                order.designImages.forEach(function (x) {
                    if (x && x.dataUrl) imgs.push({ dataUrl: x.dataUrl, name: x.name || 'image.jpg' });
                });
            } else if (order.designImage) {
                imgs.push({ dataUrl: order.designImage, name: order.designImageName || 'design.jpg' });
            }
            var imgsHtml = imgs
                .map(function (im, i) {
                    var dImg = im.dataUrl;
                    var imgSrc =
                        typeof dImg === 'string' &&
                        (dImg.indexOf('data:image/') === 0 || dImg.indexOf('http://') === 0 || dImg.indexOf('https://') === 0)
                            ? dImg.replace(/"/g, '&quot;')
                            : '';
                    if (!imgSrc) return '';
                    var nm = escapeHtml(im.name);
                    var label =
                        imgs.length > 1
                            ? '<p class="text-xs text-gray-500 mb-1"><i class="fas fa-image mr-1"></i>Reference ' + (i + 1) + ': ' + nm + '</p>'
                            : '<p class="text-xs text-gray-500 mb-2"><i class="fas fa-image mr-1"></i>Reference: ' + nm + '</p>';
                    return '<div class="mt-2">' + label + '<img src="' + imgSrc + '" alt="Design Reference" class="max-w-full h-auto rounded-lg shadow-md border-2 border-gray-200"></div>';
                })
                .join('');
            designBlock =
                '<div class="bg-[#FFF8F0] rounded-lg p-4">' +
                '<p class="text-xs text-gray-500 mb-2"><i class="fas fa-palette mr-1 text-[#D4AF37]"></i>Cake Design</p>' +
                (order.cakeDesign ? '<p class="text-gray-800 mb-2">' + escapeHtml(order.cakeDesign) + '</p>' : '') +
                imgsHtml +
                '</div>';
        }
        var dedicationBlock = '';
        if (order.dedication) {
            dedicationBlock =
                '<div class="bg-[#FFF8F0] rounded-lg p-4">' +
                '<p class="text-xs text-gray-500 mb-1"><i class="fas fa-pen-fancy mr-1 text-[#D4AF37]"></i>Dedication Message</p>' +
                '<p class="text-gray-800 italic">"' +
                escapeHtml(order.dedication) +
                '"</p></div>';
        }
        var addrBlock = '';
        if (order.deliveryType === 'Deliver' && order.deliveryAddress) {
            addrBlock =
                '<div class="bg-[#FFF8F0] rounded-lg p-4 col-span-2">' +
                '<p class="text-xs text-gray-500 mb-1"><i class="fas fa-map-marker-alt mr-1 text-[#D4AF37]"></i>Delivery address</p>' +
                '<p class="font-semibold text-gray-800">' +
                escapeHtml(order.deliveryAddress) +
                '</p></div>';
        }
        var phoneBlock = '';
        var dcDet = orderDisplayContact(order);
        if (dcDet.phone) {
            phoneBlock =
                '<div class="bg-[#FFF8F0] rounded-lg p-4">' +
                '<p class="text-xs text-gray-500 mb-1"><i class="fas fa-phone mr-1 text-[#D4AF37]"></i>' +
                (String(order.deliveryType || '').toLowerCase().startsWith('deliver')
                    ? 'Customer mobile (delivery)'
                    : 'Shop / owner (pickup)') +
                '</p>' +
                '<p class="font-semibold text-gray-800"><a href="tel:' +
                escapeHtml(dcDet.phone).replace(/\s/g, '') +
                '" class="text-[#D4AF37] hover:underline">' +
                escapeHtml(dcDet.phone) +
                '</a></p></div>';
        }
        detailsContent.innerHTML =
            '<div class="space-y-6">' +
            '<div class="grid grid-cols-2 gap-4">' +
            '<div class="bg-[#FFF8F0] rounded-lg p-4"><p class="text-xs text-gray-500 mb-1">Cake</p><p class="font-semibold text-gray-800">' +
            escapeHtml(order.name || order.cake || 'Custom Order') +
            '</p></div>' +
            '<div class="bg-[#FFF8F0] rounded-lg p-4"><p class="text-xs text-gray-500 mb-1">Size</p><p class="font-semibold text-gray-800">' +
            escapeHtml(fmtAdminCakeSize(order.size)) +
            '</p></div>' +
            '<div class="bg-[#FFF8F0] rounded-lg p-4"><p class="text-xs text-gray-500 mb-1">Quantity</p><p class="font-semibold text-gray-800">' +
            (order.quantity || 1) +
            '</p></div>' +
            '<div class="bg-[#FFF8F0] rounded-lg p-4"><p class="text-xs text-gray-500 mb-1">Date Needed</p><p class="font-semibold text-gray-800">' +
            (order.dateNeeded ? new Date(order.dateNeeded).toLocaleDateString() : 'N/A') +
            '</p></div>' +
            '<div class="bg-[#FFF8F0] rounded-lg p-4"><p class="text-xs text-gray-500 mb-1">Flavor</p><p class="font-semibold text-gray-800">' +
            escapeHtml(order.flavor || order.cake || 'N/A') +
            '</p></div>' +
            '<div class="bg-[#FFF8F0] rounded-lg p-4"><p class="text-xs text-gray-500 mb-1">Frosting</p><p class="font-semibold text-gray-800">' +
            escapeHtml(order.frosting || 'N/A') +
            '</p></div>' +
            '<div class="bg-[#FFF8F0] rounded-lg p-4"><p class="text-xs text-gray-500 mb-1">Payment</p><p class="font-semibold text-gray-800">' +
            escapeHtml(adminPaymentDisplayLabel(order)) +
            '</p></div>' +
            '<div class="bg-[#FFF8F0] rounded-lg p-4"><p class="text-xs text-gray-500 mb-1">Price</p><p class="font-semibold text-[#D4AF37]">₱' +
            (order.price || 0).toFixed(2) +
            '</p></div></div>' +
            designBlock +
            dedicationBlock +
            '<div class="grid grid-cols-2 gap-4">' +
            '<div class="bg-[#FFF8F0] rounded-lg p-4"><p class="text-xs text-gray-500 mb-1">Delivery Type</p><p class="font-semibold text-gray-800">' +
            escapeHtml(order.deliveryType || 'Pick up') +
            '</p></div>' +
            addrBlock +
            phoneBlock +
            '<div class="bg-[#FFF8F0] rounded-lg p-4"><p class="text-xs text-gray-500 mb-1">Status</p><p class="font-semibold text-gray-800">' +
            escapeHtml(order.status || 'Pending') +
            '</p></div>' +
            '<div class="bg-[#FFF8F0] rounded-lg p-4"><p class="text-xs text-gray-500 mb-1">Order Date</p><p class="font-semibold text-gray-800">' +
            escapeHtml(order.date || (order.created_at ? String(order.created_at).slice(0, 10) : '') || new Date().toLocaleDateString()) +
            '</p></div></div></div>';

        document.getElementById('orderDetailsModal').classList.remove('hidden');
        document.getElementById('orderDetailsModal').classList.add('flex');
        document.body.style.overflow = 'hidden';
    }

    function closeOrderDetailsModal() {
        document.getElementById('orderDetailsModal').classList.add('hidden');
        document.getElementById('orderDetailsModal').classList.remove('flex');
        document.body.style.overflow = 'auto';
        document.getElementById('orderDetailsContent').innerHTML = '';
    }

    function viewReceipt(orderId) {
        var order = orders.find(function (o) { return String(o.id) === String(orderId); });
        if (!order || !orderHasUsableReceipt(order)) {
            alert('Receipt not found for this order');
            return;
        }
        var receiptContent = document.getElementById('receiptViewContent');
        var receiptFileName = order.receiptFileName || 'receipt';
        var rec = String(order.receipt);
        if (rec.startsWith('data:image/')) {
            receiptContent.innerHTML =
                '<div class="mb-4"><p class="text-sm text-gray-600 mb-2"><i class="fas fa-file-image mr-1"></i> ' +
                escapeHtml(receiptFileName) +
                '</p><img src="' +
                rec +
                '" alt="Receipt" class="max-w-full h-auto rounded-lg shadow-lg mx-auto border-2 border-gray-200"></div>';
        } else if (rec.startsWith('data:application/pdf')) {
            receiptContent.innerHTML =
                '<div class="mb-4"><p class="text-sm text-gray-600 mb-2"><i class="fas fa-file-pdf mr-1"></i> ' +
                escapeHtml(receiptFileName) +
                '</p><iframe src="' +
                rec +
                '" class="w-full h-[600px] rounded-lg shadow-lg border-2 border-gray-200" frameborder="0"></iframe></div>';
        } else {
            receiptContent.innerHTML =
                '<div class="mb-4"><img src="' + rec.replace(/"/g, '&quot;') + '" alt="Receipt" class="max-w-full h-auto rounded-lg"></div>';
        }
        document.getElementById('receiptViewModal').classList.remove('hidden');
        document.getElementById('receiptViewModal').classList.add('flex');
        document.body.style.overflow = 'hidden';
    }

    function closeReceiptViewModal() {
        document.getElementById('receiptViewModal').classList.add('hidden');
        document.getElementById('receiptViewModal').classList.remove('flex');
        document.body.style.overflow = 'auto';
        document.getElementById('receiptViewContent').innerHTML = '';
    }

    function openStatusModal(orderId) {
        currentOrderId = orderId;
        var order = orders.find(function (o) { return String(o.id) === String(orderId); });
        var select = document.getElementById('newStatus');
        if (order && select) {
            var currentStatus = normalizeOrderStatus(order);
            var h = statusHierarchyMap();
            var currentLevel = h[currentStatus] != null ? h[currentStatus] : 0;
            var allStatuses = ['Pending', 'Acknowledge', 'Baking', 'Ready', 'Completed', 'Cancelled'];
            var labelFor = function (s) { return s === 'Ready' ? 'Ready for Pickup/Delivery' : s; };

            if (currentStatus === 'Completed' || currentStatus === 'Cancelled') {
                select.innerHTML = '<option value="' + escapeHtml(currentStatus) + '" selected>' + labelFor(currentStatus) + '</option>';
                select.disabled = true;
            } else {
                select.disabled = false;
                var optionsHtml = allStatuses
                    .map(function (s) {
                        var lvl = h[s] != null ? h[s] : 0;
                        var reached = s !== 'Cancelled' && lvl <= currentLevel;
                        return (
                            '<option value="' +
                            s +
                            '" ' +
                            (reached ? 'disabled' : '') +
                            '>' +
                            (reached ? '✓ ' : '') +
                            labelFor(s) +
                            '</option>'
                        );
                    })
                    .join('');
                select.innerHTML = '<option value="" disabled selected>Choose new status…</option>' + optionsHtml;
            }
        }
        document.getElementById('statusModal').classList.remove('hidden');
        document.getElementById('statusModal').classList.add('flex');
        document.body.style.overflow = 'hidden';
    }

    function closeStatusModal() {
        document.getElementById('statusModal').classList.add('hidden');
        document.getElementById('statusModal').classList.remove('flex');
        document.body.style.overflow = 'auto';
        currentOrderId = null;
    }

    function confirmStatusChange() {
        if (!currentOrderId) return;
        var newStatus = document.getElementById('newStatus').value;
        if (!newStatus) {
            alert('Please select a status.');
            return;
        }
        var orderIndex = findOrderIndexById(currentOrderId);
        if (orderIndex === -1) return;
        var currentStatus = normalizeOrderStatus(orders[orderIndex]);
        var err = validateStatusTransition(currentStatus, newStatus);
        if (err) {
            alert(err);
            return;
        }
        if (newStatus === 'Completed' && currentStatus !== 'Completed') {
            if (!confirm('Mark this order as Completed? Sales / payment logging will run if configured.')) return;
        }
        performOrderStatusUpdate(orderIndex, newStatus);
        closeStatusModal();
    }

    function confirmDeleteOrderPermanently() {
        if (!currentOrderId) {
            alert('Open this order’s options first (Other options or cancel).');
            return;
        }
        var order = orders.find(function (o) { return String(o.id) === String(currentOrderId); });
        if (!order) {
            alert('Order not found.');
            return;
        }
        if (!confirm('Remove this order from all saved customer order lists on this browser? This cannot be undone.')) return;
        if (order.supabase_id) {
            if (
                !confirm(
                    'This order is linked to Supabase. It will disappear here but can come back after refresh until you delete the row in Supabase → Table Editor → orders. Remove from this browser only?'
                )
            ) {
                return;
            }
        }
        var delFn = window.deleteOrderFromAdminStorage;
        if (typeof delFn !== 'function') {
            alert('Storage helper not loaded. Refresh the page.');
            return;
        }
        var ok = delFn(order.id, order.supabase_id);
        if (!ok) {
            alert('No matching order was found in local storage (it may be cloud-only). Delete the row in Supabase if needed.');
        } else {
            showToast('Order removed from saved lists on this device.');
        }
        closeStatusModal();
        reloadOrdersMerged();
    }

    function fillBakingMiscIngredientSelect(sel) {
        if (!sel) return;
        var raw = localStorage.getItem('adminMiscInventoryItems');
        var items = [];
        try {
            items = raw ? JSON.parse(raw) : [];
        } catch (e) {
            items = [];
        }
        var names = items.map(function (x) { return x.name; }).filter(Boolean);
        names.sort(function (a, b) { return a.localeCompare(b); });
        var prev = sel.value;
        sel.innerHTML = '';
        var opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = '— Select miscellaneous item —';
        sel.appendChild(opt0);
        names.forEach(function (n) {
            var o = document.createElement('option');
            o.value = n;
            o.textContent = n;
            sel.appendChild(o);
        });
        if (prev && names.indexOf(prev) !== -1) sel.value = prev;
    }

    function addBakingMiscRow() {
        var host = document.getElementById('bakingMiscRows');
        if (!host) return;
        var line = document.createElement('div');
        line.className = 'baking-misc-line flex gap-2 items-center flex-wrap';
        var sel = document.createElement('select');
        sel.className =
            'baking-misc-misc-item flex-1 min-w-[140px] px-3 py-2 rounded-lg border-2 border-gray-200 text-sm focus:border-[#D4AF37] focus:outline-none';
        var inp = document.createElement('input');
        inp.type = 'number';
        inp.step = '0.01';
        inp.min = '0.01';
        inp.placeholder = 'Qty';
        inp.className =
            'baking-misc-qty w-28 px-3 py-2 rounded-lg border-2 border-gray-200 text-sm focus:border-[#D4AF37] focus:outline-none';
        var rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'px-2 py-2 text-red-600 hover:bg-red-50 rounded-lg shrink-0';
        rm.setAttribute('aria-label', 'Remove line');
        rm.innerHTML = '<i class="fas fa-times"></i>';
        rm.addEventListener('click', function () {
            line.remove();
        });
        line.appendChild(sel);
        line.appendChild(inp);
        line.appendChild(rm);
        host.appendChild(line);
        fillBakingMiscIngredientSelect(sel);
    }

    function resetBakingMiscModal() {
        var host = document.getElementById('bakingMiscRows');
        if (!host) return;
        host.innerHTML = '';
        addBakingMiscRow();
    }

    function openBakingMiscModal(orderId) {
        var order = orders.find(function (o) { return String(o.id) === String(orderId); });
        if (!order) {
            alert('Order not found.');
            return;
        }
        if (normalizeOrderStatus(order) !== 'Baking') {
            alert('You can only record miscellaneous stock out while the order is in Baking.');
            return;
        }
        bakingMiscOrderId = String(orderId);
        var label = document.getElementById('bakingMiscOrderLabel');
        if (label) label.textContent = order.orderGroupId || String(order.id);
        resetBakingMiscModal();
        var modal = document.getElementById('bakingMiscModal');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }

    function closeBakingMiscModal() {
        bakingMiscOrderId = null;
        var modal = document.getElementById('bakingMiscModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        document.body.style.overflow = 'auto';
    }

    function confirmBakingMiscStockOut() {
        if (bakingMiscOrderId == null) return;
        var order = orders.find(function (o) { return String(o.id) === String(bakingMiscOrderId); });
        if (!order) {
            alert('Order not found.');
            closeBakingMiscModal();
            return;
        }
        if (normalizeOrderStatus(order) !== 'Baking') {
            alert('This order is no longer in Baking.');
            closeBakingMiscModal();
            reloadOrdersMerged();
            return;
        }
        var rowEls = document.querySelectorAll('#bakingMiscRows .baking-misc-line');
        var lines = [];
        rowEls.forEach(function (row) {
            var sel = row.querySelector('.baking-misc-misc-item');
            var q = row.querySelector('.baking-misc-qty');
            var name = sel && sel.value ? sel.value.trim() : '';
            var qty = q ? Number(q.value) : 0;
            if (name && qty > 0) lines.push({ name: name, quantity: qty });
        });
        if (!lines.length) {
            alert('Add at least one miscellaneous item and quantity.');
            return;
        }
        if (!window.OrderIngredients || typeof window.OrderIngredients.applyBakingMiscStockOut !== 'function') {
            alert('Inventory link not loaded.');
            return;
        }
        var res = window.OrderIngredients.applyBakingMiscStockOut(order, lines);
        closeBakingMiscModal();
        if (res.applied.length) {
            showToast('Stocked out ' + res.applied.length + ' miscellaneous item(s)');
        }
        if (res.failed.length) {
            alert(
                'Could not stock out:\n' +
                    res.failed
                        .map(function (x) {
                            return '• ' + x.name + ': ' + (x.message || '');
                        })
                        .join('\n')
            );
        }
    }

    function openLogoutModal() {
        document.getElementById('logoutModal').classList.remove('hidden');
        document.getElementById('logoutModal').classList.add('flex');
        document.body.style.overflow = 'hidden';
    }
    function closeLogoutModal() {
        document.getElementById('logoutModal').classList.add('hidden');
        document.getElementById('logoutModal').classList.remove('flex');
        document.body.style.overflow = 'auto';
    }
    function confirmLogout() {
        window.location.href = 'index.html';
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (window.OrderIngredients && window.OrderIngredients.restoreCancelledOrdersIngredientStock) {
            window.OrderIngredients.restoreCancelledOrdersIngredientStock();
        }

        var tbody = document.getElementById('ordersTableBody');
        if (tbody) {
            tbody.addEventListener('click', function (e) {
                var btn = e.target.closest('button[data-order-action]');
                if (!btn) return;
                var action = btn.getAttribute('data-order-action');
                var enc = btn.getAttribute('data-order-id');
                if (enc == null || enc === '') return;
                var id;
                try {
                    id = decodeURIComponent(enc);
                } catch (err) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                if (action === 'details') viewOrderDetails(id);
                else if (action === 'status') openStatusModal(id);
                else if (action === 'receipt') viewReceipt(id);
                else if (action === 'next-step') advanceOrderNextStep(id);
                else if (action === 'baking-misc') openBakingMiscModal(id);
            });
        }

        var filterHost = document.getElementById('ordersFilterTabs');
        if (filterHost) {
            filterHost.addEventListener('click', function (e) {
                var tab = e.target.closest('[data-orders-filter]');
                if (!tab) return;
                setOrderStatusFilter(tab.getAttribute('data-orders-filter'));
            });
        }

        document.getElementById('bakingMiscAddRow') && document.getElementById('bakingMiscAddRow').addEventListener('click', addBakingMiscRow);
        document.getElementById('bakingMiscApplyBtn') && document.getElementById('bakingMiscApplyBtn').addEventListener('click', confirmBakingMiscStockOut);

        reloadOrdersMerged();
    });

    document.getElementById('orderDetailsModal') &&
        document.getElementById('orderDetailsModal').addEventListener('click', function (e) {
            if (e.target === this) closeOrderDetailsModal();
        });
    document.getElementById('receiptViewModal') &&
        document.getElementById('receiptViewModal').addEventListener('click', function (e) {
            if (e.target === this) closeReceiptViewModal();
        });
    document.getElementById('statusModal') &&
        document.getElementById('statusModal').addEventListener('click', function (e) {
            if (e.target === this) closeStatusModal();
        });
    document.getElementById('bakingMiscModal') &&
        document.getElementById('bakingMiscModal').addEventListener('click', function (e) {
            if (e.target === this) closeBakingMiscModal();
        });
    document.getElementById('logoutModal') &&
        document.getElementById('logoutModal').addEventListener('click', function (e) {
            if (e.target === this) closeLogoutModal();
        });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var bakingMiscModal = document.getElementById('bakingMiscModal');
        if (bakingMiscModal && !bakingMiscModal.classList.contains('hidden')) {
            closeBakingMiscModal();
            return;
        }
        var orderDetailsModal = document.getElementById('orderDetailsModal');
        if (orderDetailsModal && !orderDetailsModal.classList.contains('hidden')) {
            closeOrderDetailsModal();
            return;
        }
        var receiptViewModal = document.getElementById('receiptViewModal');
        if (receiptViewModal && !receiptViewModal.classList.contains('hidden')) {
            closeReceiptViewModal();
            return;
        }
        var statusModal = document.getElementById('statusModal');
        if (statusModal && !statusModal.classList.contains('hidden')) {
            closeStatusModal();
            return;
        }
        var logoutModal = document.getElementById('logoutModal');
        if (logoutModal && !logoutModal.classList.contains('hidden')) {
            closeLogoutModal();
        }
    });

    var ordersVisibilityTimer = null;
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) return;
        clearTimeout(ordersVisibilityTimer);
        ordersVisibilityTimer = setTimeout(function () {
            reloadOrdersMerged();
        }, 500);
    });

    window.openLogoutModal = openLogoutModal;
    window.closeLogoutModal = closeLogoutModal;
    window.confirmLogout = confirmLogout;
    window.closeOrderDetailsModal = closeOrderDetailsModal;
    window.closeReceiptViewModal = closeReceiptViewModal;
    window.closeStatusModal = closeStatusModal;
    window.confirmStatusChange = confirmStatusChange;
    window.confirmDeleteOrderPermanently = confirmDeleteOrderPermanently;
    window.closeBakingMiscModal = closeBakingMiscModal;
    window.viewOrderDetails = viewOrderDetails;
    window.viewReceipt = viewReceipt;
    window.openStatusModal = openStatusModal;
    window.__reloadAdminOrdersMerged = reloadOrdersMerged;
})();
