// Initialize cart from localStorage (per-user key)
        let cart = JSON.parse(localStorage.getItem(typeof getCartKey === 'function' ? getCartKey() : 'cart')) || [];
        // Track selections in the cart modal
        let selectedCartIndexes = new Set();
        let orders = [];

        function toggleClientSidebar() { document.body.classList.toggle('sidebar-hidden'); }
        
        // Initialize on page load
        document.addEventListener('DOMContentLoaded', function() {
            loadCustomerName();
            updateCartBadge();
            syncPaymentPlanHints();
            calculatePrice();
            loadOrders();
            renderOrdersTable();
            setMinDate();

            // Sidebar responsive toggle
            const sidebar = document.getElementById('clientSidebar');
            const sidebarOverlay = document.getElementById('sidebarOverlay');
            const openSidebarBtn = document.getElementById('openSidebarBtn');
            if (openSidebarBtn) {
                openSidebarBtn.addEventListener('click', () => {
                    sidebar.classList.remove('-translate-x-full');
                    sidebarOverlay.classList.remove('hidden');
                });
            }
            if (sidebarOverlay) {
                sidebarOverlay.addEventListener('click', () => {
                    sidebar.classList.add('-translate-x-full');
                    sidebarOverlay.classList.add('hidden');
                });
            }
            
            // Check if we should open the order modal automatically
            if (window.location.hash === '#new') {
                // Small delay to ensure page is fully loaded
                setTimeout(() => {
                    openOrderModal();
                    // Remove hash from URL after opening modal
                    window.history.replaceState(null, null, window.location.pathname);
                }, 100);
            }
        });

        // Generate a group Order ID shared by items in one placement
        function generateOrderGroupId() {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const h = String(now.getHours()).padStart(2, '0');
            const mi = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            const rand = Math.floor(Math.random() * 900) + 100;
            return `ORD-${y}${m}${d}${h}${mi}${s}-${rand}`;
        }
        
        // Update cart when page becomes visible (when switching tabs)
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                var cartKey = typeof getCartKey === 'function' ? getCartKey() : 'cart';
                cart = JSON.parse(localStorage.getItem(cartKey)) || [];
                updateCartBadge();
            }
        });
        
        // Update cart when window regains focus
        window.addEventListener('focus', function() {
            var cartKey = typeof getCartKey === 'function' ? getCartKey() : 'cart';
            cart = JSON.parse(localStorage.getItem(cartKey)) || [];
            updateCartBadge();
        });
        
        // ===== ORDER MODAL FUNCTIONS =====
        
        // Open order modal
        function openOrderModal() {
            document.getElementById('orderModal').classList.remove('hidden');
            document.getElementById('orderModal').classList.add('flex');
            document.body.style.overflow = 'hidden';
            syncPaymentPlanHints();
            calculatePrice();
            toggleDeliveryAddressSection();
        }

        // Close order modal
        function closeOrderModal() {
            document.getElementById('orderModal').classList.add('hidden');
            document.getElementById('orderModal').classList.remove('flex');
            document.body.style.overflow = 'auto';
            // Reset form
            document.getElementById('orderForm').reset();
            removeDesignImage();
            syncPaymentPlanHints();
            calculatePrice();
            toggleDeliveryAddressSection();
            setMinDate(); // Reset date to minimum
        }
        
        // Set minimum date to today
        function setMinDate() {
            const dateInput = document.getElementById('dateNeeded');
            if (dateInput) {
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const minDate = tomorrow.toISOString().split('T')[0];
                dateInput.min = minDate;
                dateInput.value = minDate;
            }
        }
        
        // Load customer name from localStorage
        function loadCustomerName() {
            const customerName = localStorage.getItem('userName') || 'Guest';
            const sidebarName = document.getElementById('sidebarCustomerName');
            if (sidebarName) {
                sidebarName.textContent = customerName;
            }
        }
        
        // Load orders from localStorage (per-user key)
        function loadOrders() {
            const key = typeof getOrdersKey === 'function' ? getOrdersKey() : 'customerOrders';
            const storedOrders = localStorage.getItem(key);
            if (storedOrders) {
                orders = JSON.parse(storedOrders);
            }
        }
        
        // Render orders table
        function renderOrdersTable() {
            const tbody = document.getElementById('ordersTableBody');
            const emptyDiv = document.getElementById('emptyOrders');
            const table = document.getElementById('ordersTable');
            
            // Filter out cancelled orders - they should only appear in logs
            const activeOrders = orders.filter(order => order.status !== 'Cancelled');
            
            if (activeOrders.length === 0) {
                tbody.innerHTML = '';
                table.classList.add('hidden');
                emptyDiv.classList.remove('hidden');
                var logSectionEmpty = document.getElementById('orderLogSection');
                if (logSectionEmpty) logSectionEmpty.classList.add('hidden');
                return;
            }
            
            table.classList.remove('hidden');
            emptyDiv.classList.add('hidden');
            
            const rowsHTML = activeOrders
                .slice()
                .reverse() // Show newest first
                .map(order => {
                    const statusColor = getStatusColor(order.status);
                    return `
                        <tr class="border-b border-gray-200 hover:bg-gray-50 transition">
                            <td class="py-4 px-4 text-gray-700 text-sm font-mono">${escapeHtml(order.orderGroupId || '-')}</td>
                            <td class="py-4 px-4 text-gray-600 text-sm">${escapeHtml(order.date || new Date().toLocaleDateString())}</td>
                            <td class="py-4 px-4">
                                <button onclick="viewOrderDetails(${order.id})" class="text-left">
                                    <div class="font-semibold text-gray-800 hover:text-[#D4AF37] transition cursor-pointer">${escapeHtml(order.name || order.cake || 'Custom Order')}</div>
                                    <div class="text-xs text-gray-500 mt-1">Click to view details</div>
                                </button>
                            </td>
                            <td class="py-4 px-4 text-gray-700">
                                ${escapeHtml(order.deliveryType || 'Pick up')}
                            </td>
                            <td class="py-4 px-4 text-gray-700">
                                ${(order.paymentMethod === 'Online Payment' || order.paymentMethod === '50% Down Payment') && order.receipt ? 
                                    `<button onclick="viewReceipt(${order.id})" class="px-3 py-1 rounded-lg text-[#D4AF37] bg-[#FFF8F0] hover:bg-[#D4AF37] hover:text-white transition-all font-medium text-sm">
                                        ${escapeHtml(clientOrderPaymentLabel(order))} · view receipt
                                    </button>` :
                                    `${escapeHtml(clientOrderPaymentLabel(order))}`
                                }
                            </td>
                            <td class="py-4 px-4 text-gray-700">${order.dateNeeded ? new Date(order.dateNeeded).toLocaleDateString() : '—'}</td>
                            <td class="py-4 px-4">
                                <span class="font-bold text-[#D4AF37]">₱${(order.price || 0).toFixed(2)}</span>
                                ${order.paymentMethod === '50% Down Payment' && order.downPaymentAmount != null ? `<div class="text-xs text-gray-500 mt-0.5">50% due now: ₱${order.downPaymentAmount}</div>` : ''}
                            </td>
                            <td class="py-4 px-4">
                                <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusColor}">
                                    ${escapeHtml(order.status || 'Pending')}
                                </span>
                            </td>
                            <td class="py-4 px-4 text-gray-700">
                                <button onclick="downloadSingleOrderPdf(${order.id})" class="px-3 py-1 rounded-lg text-gray-700 bg-white hover:bg-[#FFF8F0] hover:text-[#B8941E] transition-all font-medium text-sm mr-1" title="Download this order as a PDF">
                                    <i class="fas fa-file-pdf mr-1 text-red-600"></i>PDF
                                </button>
                                ${
                                    order.status === 'Pending'
                                        ? `<button onclick="openCancelOrderModal(${order.id})" class="px-3 py-1 rounded-lg text-red-600 bg-red-50 hover:bg-red-600 hover:text-white transition-all font-medium text-sm">Cancel</button>`
                                        : ''
                                }
                            </td>
                        </tr>
                    `;
                }).join('');
            
            tbody.innerHTML = rowsHTML;
            var logSection = document.getElementById('orderLogSection');
            if (logSection) logSection.classList.remove('hidden');
        }
        
        /** Customer-facing payment line (two business options: 50% down vs pay in full). */
        function clientOrderPaymentLabel(order) {
            if (!order) return '—';
            if (order.paymentPlan === '50% Down Payment' || order.paymentMethod === '50% Down Payment') return '50% down (online + balance later)';
            if (order.paymentMethod === 'Cash on Delivery') return 'Pay in full (legacy COD)';
            return 'Pay in full (online)';
        }

        // Get status badge color
        function getStatusColor(status) {
            const statusColors = {
                'Pending': 'bg-yellow-100 text-yellow-700 border border-yellow-300',
                'Acknowledge': 'bg-blue-100 text-blue-700 border border-blue-300',
                'Baking': 'bg-purple-100 text-purple-700 border border-purple-300',
                'Ready': 'bg-green-100 text-green-700 border border-green-300',
                'Completed': 'bg-gray-100 text-gray-700 border border-gray-300',
                'Cancelled': 'bg-red-100 text-red-700 border border-red-300'
            };
            return statusColors[status] || 'bg-gray-100 text-gray-700 border border-gray-300';
        }

        // Minimum delivery fee (from Admin Settings → Delivery & pickup; falls back to 150)
        function getDeliveryConfig() {
            try {
                var raw = localStorage.getItem('adminSettings');
                var s = raw ? JSON.parse(raw) : {};
                var fee = Number(s.deliveryFee);
                var deliveryFee = (Number.isFinite(fee) && fee >= 0) ? fee : 150;
                var minAdvance = Number(s.minAdvanceDays);
                var minRush = Number(s.minRushDays);
                return {
                    deliveryFee: deliveryFee,
                    minAdvanceDays: Number.isFinite(minAdvance) && minAdvance >= 0 ? minAdvance : null,
                    minRushDays: Number.isFinite(minRush) && minRush >= 0 ? minRush : null
                };
            } catch (e) {
                return { deliveryFee: 150, minAdvanceDays: null, minRushDays: null };
            }
        }
        const DELIVERY_CONFIG = getDeliveryConfig();
        const MIN_DELIVERY_FEE = DELIVERY_CONFIG.deliveryFee;

        /** Current order form total (base + delivery fee) for receipt messaging. */
        function getFormTotalForReceipt() {
            const sizeRadio = document.querySelector('input[name="size"]:checked');
            const sizePrice = parseFloat(sizeRadio?.dataset.price) || 450;
            const quantity = parseInt(document.getElementById('quantity')?.value) || 1;
            const deliveryRadio = document.querySelector('input[name="deliveryType"]:checked');
            const isDeliver = deliveryRadio && deliveryRadio.value === 'Deliver';
            const deliveryFee = isDeliver ? MIN_DELIVERY_FEE : 0;
            return sizePrice * quantity + deliveryFee;
        }

        // Calculate price (size × quantity + delivery fee when Deliver)
        function calculatePrice() {
            const sizeRadio = document.querySelector('input[name="size"]:checked');
            const sizePrice = parseFloat(sizeRadio?.dataset.price) || 450;
            const quantity = parseInt(document.getElementById('quantity').value) || 1;
            const deliveryRadio = document.querySelector('input[name="deliveryType"]:checked');
            const isDeliver = deliveryRadio && deliveryRadio.value === 'Deliver';
            const deliveryFee = isDeliver ? MIN_DELIVERY_FEE : 0;
            const baseTotal = sizePrice * quantity;
            const total = baseTotal + deliveryFee;

            document.getElementById('totalPrice').textContent = '₱' + total.toFixed(0);

            // Update summary
            const productSelect = document.getElementById('cakeProduct');
            const selectedOption = productSelect.options[productSelect.selectedIndex];
            document.getElementById('summaryProduct').textContent = selectedOption ? selectedOption.value || '-' : '-';
            document.getElementById('summarySize').textContent = sizeRadio ? sizeRadio.value : 'Small';
            document.getElementById('summaryQty').textContent = quantity;
            document.getElementById('summaryFrosting').textContent = document.getElementById('frosting').value;
            document.getElementById('summaryDelivery').textContent = deliveryRadio ? deliveryRadio.value : 'Pick up';

            // Delivery fee row (show only when Deliver)
            const deliveryFeeRow = document.getElementById('summaryDeliveryFeeRow');
            const deliveryFeeAmountEl = document.getElementById('summaryDeliveryFeeAmount');
            if (deliveryFeeRow && deliveryFeeAmountEl) {
                if (isDeliver) {
                    deliveryFeeAmountEl.textContent = '₱' + MIN_DELIVERY_FEE;
                    deliveryFeeRow.classList.remove('hidden');
                } else {
                    deliveryFeeRow.classList.add('hidden');
                }
            }

            const planRadio = document.querySelector('input[name="paymentPlan"]:checked');
            const paymentPlan = planRadio ? planRadio.value : 'Full Payment';
            const choiceEl = document.getElementById('summaryPaymentPlan');
            const howEl = document.getElementById('summaryPayment');
            const onlineRow = document.getElementById('summaryOnlinePaymentRow');
            if (choiceEl) {
                choiceEl.textContent = paymentPlan === '50% Down Payment' ? '50% down payment' : 'Pay in full';
            }
            if (howEl && onlineRow) {
                onlineRow.classList.remove('hidden');
                if (paymentPlan === '50% Down Payment') {
                    howEl.textContent = '50% now (receipt) · 50% at pickup/delivery';
                } else {
                    howEl.textContent = 'Full total now (upload receipt)';
                }
            }

            // 50% Down Payment: show amount due now (based on full total including delivery)
            const downPaymentRow = document.getElementById('summaryDownPaymentRow');
            const amountDueEl = document.getElementById('amountDueNow');
            if (paymentPlan === '50% Down Payment' && downPaymentRow && amountDueEl) {
                const amountDue = Math.round(total * 0.5);
                amountDueEl.textContent = '₱' + amountDue.toFixed(0);
                downPaymentRow.classList.remove('hidden');
            } else if (downPaymentRow) {
                downPaymentRow.classList.add('hidden');
            }

            // Order rules section (from admin settings)
            var rulesContainer = document.getElementById('summaryOrderRules');
            var rulesLines = document.getElementById('summaryOrderRulesLines');
            if (rulesContainer && rulesLines) {
                var parts = [];
                if (DELIVERY_CONFIG.minAdvanceDays != null && DELIVERY_CONFIG.minAdvanceDays > 0) {
                    parts.push('Minimum advance order: ' + DELIVERY_CONFIG.minAdvanceDays + ' day' + (DELIVERY_CONFIG.minAdvanceDays > 1 ? 's' : ''));
                }
                if (DELIVERY_CONFIG.minRushDays != null && DELIVERY_CONFIG.minRushDays > 0) {
                    parts.push('Minimum rush order: ' + DELIVERY_CONFIG.minRushDays + ' day' + (DELIVERY_CONFIG.minRushDays > 1 ? 's' : ''));
                }
                if (parts.length > 0) {
                    rulesLines.textContent = parts.join(' · ');
                    rulesContainer.classList.remove('hidden');
                } else {
                    rulesContainer.classList.add('hidden');
                }
            }

            // Update cake design in summary
            const cakeDesign = document.getElementById('cakeDesign').value.trim();
            const designContainer = document.getElementById('summaryDesignContainer');
            if (cakeDesign) {
                document.getElementById('summaryDesign').textContent = cakeDesign;
                designContainer.classList.remove('hidden');
            } else {
                designContainer.classList.add('hidden');
            }

            return total;
        }

        // Event listeners for price calculation
        document.getElementById('cakeProduct').addEventListener('change', calculatePrice);
        document.getElementById('quantity').addEventListener('input', calculatePrice);
        document.querySelectorAll('input[name="size"]').forEach(radio => {
            radio.addEventListener('change', calculatePrice);
        });
        document.getElementById('frosting').addEventListener('change', calculatePrice);
        function getDefaultDeliveryAddress() {
            try {
                var raw = localStorage.getItem(typeof getSettingsKey === 'function' ? getSettingsKey() : 'clientSettings');
                var s = raw ? JSON.parse(raw) : {};
                return (s.clientAddress || '').trim();
            } catch (e) { return ''; }
        }
        function getDefaultContactPhone() {
            try {
                var raw = localStorage.getItem(typeof getSettingsKey === 'function' ? getSettingsKey() : 'clientSettings');
                var s = raw ? JSON.parse(raw) : {};
                return (s.clientPhone || '').trim();
            } catch (e) { return ''; }
        }
        function getShopLocation() {
            try {
                var raw = localStorage.getItem('adminSettings');
                var s = raw ? JSON.parse(raw) : {};
                return {
                    lat: s.shopLat != null ? Number(s.shopLat) : 7.079683,
                    lng: s.shopLng != null ? Number(s.shopLng) : 125.539021,
                    address: (s.shopAddress || 'Davao City').trim(),
                    hours: (s.operatingHours || '').trim()
                };
            } catch (e) { return { lat: 7.079683, lng: 125.539021, address: 'Davao City', hours: '' }; }
        }

        /** Shop / owner phone shown in the contact field when customer chooses Pick up (Admin Settings → shopPhone, else default). */
        function getShopPickupContactPhone() {
            try {
                var raw = localStorage.getItem('adminSettings');
                var s = raw ? JSON.parse(raw) : {};
                var p = (s.shopPhone || '').trim().replace(/\s/g, '');
                if (p) return p;
            } catch (e) { /* noop */ }
            return '09951016971';
        }
        function toggleDeliveryAddressSection() {
            var isDeliver = document.querySelector('input[name="deliveryType"]:checked')?.value === 'Deliver';
            var section = document.getElementById('deliveryAddressSection');
            var field = document.getElementById('deliveryAddress');
            var phoneField = document.getElementById('customerPhone');
            var pickupSection = document.getElementById('pickupLocationSection');
            var pickupLink = document.getElementById('pickupMapLink');
            var pickupAddress = document.getElementById('pickupAddressText');
            var pickupHours = document.getElementById('pickupHoursText');
            if (section && field) {
                if (isDeliver) {
                    section.classList.remove('hidden');
                    if (!field.value.trim()) field.value = getDefaultDeliveryAddress();
                } else {
                    section.classList.add('hidden');
                }
            }
            var feeNote = document.getElementById('deliveryFeeNote');
            if (feeNote) {
                if (isDeliver) feeNote.classList.remove('hidden');
                else feeNote.classList.add('hidden');
            }
            if (pickupSection && pickupLink && pickupAddress) {
                if (!isDeliver) {
                    var loc = getShopLocation();
                    pickupLink.href = 'https://www.google.com/maps?q=' + loc.lat + ',' + loc.lng;
                    pickupAddress.textContent = loc.address || '—';
                    if (pickupHours) {
                        if (loc.hours) {
                            pickupHours.textContent = 'Pickup hours: ' + loc.hours;
                            pickupHours.classList.remove('hidden');
                        } else {
                            pickupHours.classList.add('hidden');
                        }
                    }
                    pickupSection.classList.remove('hidden');
                } else {
                    pickupSection.classList.add('hidden');
                    if (pickupHours) pickupHours.classList.add('hidden');
                }
            }
            var phoneHint = document.getElementById('customerPhoneHint');
            if (phoneHint) {
                if (isDeliver) {
                    phoneHint.innerHTML =
                        'Your number for delivery updates. If empty, we use your <a href="clientsettings.html" class="text-[#D4AF37] hover:underline">Settings</a> phone.';
                } else {
                    phoneHint.innerHTML =
                        'Shop / owner contact for <strong>pick up</strong> (read-only). For delivery, switch to <strong>Deliver</strong> to enter your mobile.';
                }
            }
            if (phoneField) {
                if (isDeliver) {
                    phoneField.readOnly = false;
                    phoneField.removeAttribute('readonly');
                    phoneField.classList.remove('bg-gray-50', 'cursor-not-allowed');
                    phoneField.classList.add('bg-white');
                    var ownerDigits = getShopPickupContactPhone().replace(/\D/g, '');
                    var curDigits = (phoneField.value || '').replace(/\D/g, '');
                    if (!phoneField.value.trim() || (ownerDigits && curDigits === ownerDigits)) {
                        phoneField.value = getDefaultContactPhone();
                    }
                } else {
                    phoneField.readOnly = true;
                    phoneField.setAttribute('readonly', 'readonly');
                    phoneField.classList.add('bg-gray-50', 'cursor-not-allowed');
                    phoneField.classList.remove('bg-white');
                    phoneField.value = getShopPickupContactPhone();
                }
            }
        }
        document.querySelectorAll('input[name="deliveryType"]').forEach(radio => {
            radio.addEventListener('change', function() { calculatePrice(); toggleDeliveryAddressSection(); });
        });
        toggleDeliveryAddressSection();
        /** Toggle hints: pay-in-full vs 50% down (both online + receipt for amount due now). */
        function syncPaymentPlanHints() {
            const plan = document.querySelector('input[name="paymentPlan"]:checked')?.value || 'Full Payment';
            const hint = document.getElementById('downPaymentHint');
            const fullHint = document.getElementById('payInFullOnlineHint');
            if (plan === '50% Down Payment') {
                if (hint) hint.classList.remove('hidden');
                if (fullHint) fullHint.classList.add('hidden');
            } else {
                if (hint) hint.classList.add('hidden');
                if (fullHint) fullHint.classList.remove('hidden');
            }
        }

        document.querySelectorAll('input[name="paymentPlan"]').forEach(radio => {
            radio.addEventListener('change', function () { syncPaymentPlanHints(); calculatePrice(); });
        });
        syncPaymentPlanHints();
        document.getElementById('cakeDesign').addEventListener('input', calculatePrice);
        
        // Design image handling
        let designImageData = null;
        let designImageFileName = null;
        
        document.getElementById('designImage').addEventListener('change', function(e) {
            const file = e.target.files[0];
            
            if (file) {
                // Validate file size (5MB max)
                if (file.size > 5 * 1024 * 1024) {
                    showAlertModal('File size must be less than 5MB', 'error');
                    e.target.value = '';
                    document.getElementById('designImageFileName').classList.add('hidden');
                    designImageData = null;
                    designImageFileName = null;
                    return;
                }
                
                // Convert to base64
                const reader = new FileReader();
                reader.onload = function(e) {
                    designImageData = e.target.result;
                    designImageFileName = file.name;
                };
                reader.readAsDataURL(file);
                
                document.getElementById('designImageName').textContent = file.name;
                document.getElementById('designImageFileName').classList.remove('hidden');
            } else {
                document.getElementById('designImageFileName').classList.add('hidden');
                designImageData = null;
                designImageFileName = null;
            }
        });
        
        // Remove design image
        function removeDesignImage() {
            document.getElementById('designImage').value = '';
            document.getElementById('designImageFileName').classList.add('hidden');
            designImageData = null;
            designImageFileName = null;
        }
        
        // Receipt upload modal handling
        let pendingOrderData = null; // Store order data when showing receipt modal
        
        // Receipt upload file handling
        document.getElementById('receiptUploadFile').addEventListener('change', function(e) {
            const file = e.target.files[0];
            const confirmBtn = document.getElementById('confirmReceiptBtn');
            
            if (file) {
                // Validate file size (5MB max)
                if (file.size > 5 * 1024 * 1024) {
                    showAlertModal('File size must be less than 5MB', 'error');
                    e.target.value = '';
                    confirmBtn.disabled = true;
                    return;
                }
                document.getElementById('receiptUploadName').textContent = file.name;
                document.getElementById('receiptUploadFileName').classList.remove('hidden');
                confirmBtn.disabled = false;
            } else {
                document.getElementById('receiptUploadFileName').classList.add('hidden');
                confirmBtn.disabled = true;
            }
        });
        
        // Remove receipt upload
        function removeReceiptUpload() {
            document.getElementById('receiptUploadFile').value = '';
            document.getElementById('receiptUploadFileName').classList.add('hidden');
            document.getElementById('confirmReceiptBtn').disabled = true;
        }
        
        // Open receipt upload modal
        function openReceiptUploadModal() {
            var msgEl = document.getElementById('receiptUploadModalMessage');
            var paymentPlan = document.querySelector('input[name="paymentPlan"]:checked')?.value || 'Full Payment';
            var total = getFormTotalForReceipt();
            if (msgEl) {
                if (paymentPlan === '50% Down Payment') {
                    var amountDue = Math.round(total * 0.5);
                    msgEl.innerHTML = 'You chose <strong>50% down payment</strong>. Pay <strong>50% online now</strong> and upload a receipt for <strong>₱' + amountDue + '</strong>. The remaining <strong>50%</strong> is paid when you <strong>pick up</strong> or when your order is <strong>delivered</strong>.';
                } else {
                    msgEl.innerHTML = 'You chose <strong>pay in full</strong>. Upload a screenshot of your payment receipt for the <strong>full order total: ₱' + Math.round(total) + '</strong>.';
                }
            }
            document.getElementById('receiptUploadModal').classList.remove('hidden');
            document.getElementById('receiptUploadModal').classList.add('flex');
            document.body.style.overflow = 'hidden';
            removeReceiptUpload(); // Reset upload
            pendingOrderData = 'single'; // Mark that we're processing single order
        }
        
        // Close receipt upload modal
        function closeReceiptUploadModal() {
            document.getElementById('receiptUploadModal').classList.add('hidden');
            document.getElementById('receiptUploadModal').classList.remove('flex');
            document.body.style.overflow = 'auto';
            removeReceiptUpload(); // Clear upload
            pendingOrderData = null;
        }
        
        // Confirm place order with receipt
        function confirmPlaceOrderWithReceipt() {
            const receiptFile = document.getElementById('receiptUploadFile').files[0];
            if (!receiptFile) {
                showAlertModal('Please upload payment receipt', 'warning');
                return;
            }
            
            // Convert receipt to base64
            const reader = new FileReader();
            reader.onload = async function (e) {
                const receiptData = e.target.result;
                
                // Check if we're processing cart orders or single order
                if (pendingOrderData === 'cart') {
                    const selectedItems = cart.filter((_, i) => selectedCartIndexes.has(i));
                    await processCartOrders(receiptData, receiptFile.name, selectedItems);
                } else if (pendingOrderData === 'single') {
                    await createOrderDirectly(receiptData, receiptFile.name);
                }
            };
            reader.readAsDataURL(receiptFile);
        }

        // Add to cart
        document.getElementById('orderForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const cake = document.getElementById('cakeProduct').value;
            if (!cake) {
                showAlertModal('Please select a cake', 'warning');
                return;
            }
            
            const dateNeeded = document.getElementById('dateNeeded').value;
            if (!dateNeeded) {
                showAlertModal('Please select when you need the cake', 'warning');
                document.getElementById('dateNeeded').focus();
                return;
            }
            
            const frosting = document.getElementById('frosting').value;
            const cakeDesign = document.getElementById('cakeDesign').value.trim();
            
            // Validate: Cake design (description or image) is required if Fondant is selected
            if (frosting.includes('Fondant') && !cakeDesign && !designImageData) {
                showAlertModal('Please provide a cake design description and/or upload a reference image for Fondant cakes. This helps us create your custom design!', 'warning');
                document.getElementById('cakeDesign').focus();
                return;
            }
            if (document.querySelector('input[name="deliveryType"]:checked')?.value === 'Deliver') {
                var addr = document.getElementById('deliveryAddress').value.trim() || getDefaultDeliveryAddress();
                if (!addr) {
                    showAlertModal('Please enter your delivery address above, or set a default in Settings.', 'warning');
                    document.getElementById('deliveryAddressSection').classList.remove('hidden');
                    document.getElementById('deliveryAddress').focus();
                    return;
                }
                var phone = document.getElementById('customerPhone').value.trim() || getDefaultContactPhone();
                if (!phone) {
                    showAlertModal('Please enter your contact number for delivery updates and logistics, or set a default in Settings.', 'warning');
                    document.getElementById('customerPhone').focus();
                    return;
                }
            }
            
            const cartItem = {
                id: Date.now(),
                name: cake,
                cake: cake,
                size: document.querySelector('input[name="size"]:checked').value,
                quantity: parseInt(document.getElementById('quantity').value),
                dateNeeded: dateNeeded,
                flavor: cake,
                frosting: frosting,
                cakeDesign: cakeDesign,
                designImage: designImageData,
                designImageName: designImageFileName,
                dedication: document.getElementById('dedication').value,
                deliveryType: document.querySelector('input[name="deliveryType"]:checked')?.value || 'Pick up',
                paymentMethod: (function () {
                    var plan = document.querySelector('input[name="paymentPlan"]:checked')?.value || 'Full Payment';
                    return plan === '50% Down Payment' ? '50% Down Payment' : 'Online Payment';
                })(),
                paymentPlan: document.querySelector('input[name="paymentPlan"]:checked')?.value || 'Full Payment',
                price: (function () { calculatePrice(); return getFormTotalForReceipt(); })(),
                deliveryFee: document.querySelector('input[name="deliveryType"]:checked')?.value === 'Deliver' ? MIN_DELIVERY_FEE : 0
            };
            var pm = cartItem.paymentMethod;
            if (cartItem.paymentPlan === '50% Down Payment') {
                cartItem.downPaymentAmount = Math.round(cartItem.price * 0.5);
            }
            var dt = document.querySelector('input[name="deliveryType"]:checked')?.value;
            if (dt === 'Deliver') {
                cartItem.deliveryAddress = document.getElementById('deliveryAddress').value.trim() || getDefaultDeliveryAddress();
                cartItem.customerPhone = document.getElementById('customerPhone').value.trim() || getDefaultContactPhone();
                cartItem.ownerPhone = null;
            } else {
                cartItem.ownerPhone = getShopPickupContactPhone();
                cartItem.customerPhone = null;
            }
            
            cart.push(cartItem);
            localStorage.setItem(typeof getCartKey === 'function' ? getCartKey() : 'cart', JSON.stringify(cart));
            updateCartBadge();
            
            // Reset form
            document.getElementById('orderForm').reset();
            removeDesignImage();
            calculatePrice();
            toggleDeliveryAddressSection();
            setMinDate(); // Reset date to minimum
            
            // Show success feedback
            showToast('Item added to cart!');
            
            // Close order modal after adding to cart
            setTimeout(() => {
                closeOrderModal();
            }, 500);
        });

        // Place order directly (without adding to cart)
        function placeOrderDirectly() {
            const cake = document.getElementById('cakeProduct').value;
            if (!cake) {
                showAlertModal('Please select a cake', 'warning');
                return;
            }
            
            const dateNeeded = document.getElementById('dateNeeded').value;
            if (!dateNeeded) {
                showAlertModal('Please select when you need the cake', 'warning');
                document.getElementById('dateNeeded').focus();
                return;
            }
            
            const frosting = document.getElementById('frosting').value;
            const cakeDesign = document.getElementById('cakeDesign').value.trim();
            
            // Validate: Cake design (description or image) is required if Fondant is selected
            if (frosting.includes('Fondant') && !cakeDesign && !designImageData) {
                showAlertModal('Please provide a cake design description and/or upload a reference image for Fondant cakes. This helps us create your custom design!', 'warning');
                document.getElementById('cakeDesign').focus();
                return;
            }
            if (document.querySelector('input[name="deliveryType"]:checked')?.value === 'Deliver') {
                var addr = document.getElementById('deliveryAddress').value.trim() || getDefaultDeliveryAddress();
                if (!addr) {
                    showAlertModal('Please enter your delivery address above, or set a default in Settings.', 'warning');
                    document.getElementById('deliveryAddressSection').classList.remove('hidden');
                    document.getElementById('deliveryAddress').focus();
                    return;
                }
                var phone = document.getElementById('customerPhone').value.trim() || getDefaultContactPhone();
                if (!phone) {
                    showAlertModal('Please enter your contact number for delivery updates and logistics, or set a default in Settings.', 'warning');
                    document.getElementById('customerPhone').focus();
                    return;
                }
            }
            
            openReceiptUploadModal();
        }
        
        // Create order directly with receipt — Supabase insert must succeed (same pattern as Records).
        async function createOrderDirectly(receiptData, receiptFileName) {
            const cake = document.getElementById('cakeProduct').value;
            const frosting = document.getElementById('frosting').value;
            const cakeDesign = document.getElementById('cakeDesign').value.trim();
            const paymentPlan = document.querySelector('input[name="paymentPlan"]:checked')?.value || 'Full Payment';
            const paymentMethod = paymentPlan === '50% Down Payment' ? '50% Down Payment' : 'Online Payment';
            calculatePrice();
            const fullPrice = getFormTotalForReceipt();
            
            const order = {
                id: Date.now(),
                orderGroupId: generateOrderGroupId(),
                customer: localStorage.getItem('userName') || 'Guest',
                name: cake,
                cake: cake,
                size: document.querySelector('input[name="size"]:checked').value,
                quantity: parseInt(document.getElementById('quantity').value),
                dateNeeded: document.getElementById('dateNeeded').value,
                flavor: cake,
                frosting: frosting,
                cakeDesign: cakeDesign,
                designImage: designImageData,
                designImageName: designImageFileName,
                dedication: document.getElementById('dedication').value,
                deliveryType: document.querySelector('input[name="deliveryType"]:checked')?.value || 'Pick up',
                paymentMethod: paymentMethod,
                paymentPlan: paymentPlan,
                receipt: receiptData,
                receiptFileName: receiptFileName || null,
                price: fullPrice,
                status: 'Pending',
                date: new Date().toLocaleDateString(),
                deliveryFee: document.querySelector('input[name="deliveryType"]:checked')?.value === 'Deliver' ? MIN_DELIVERY_FEE : 0
            };
            if (paymentPlan === '50% Down Payment') {
                order.downPaymentAmount = Math.round(fullPrice * 0.5);
            }
            var dt = document.querySelector('input[name="deliveryType"]:checked')?.value;
            if (dt === 'Deliver') {
                order.deliveryAddress = document.getElementById('deliveryAddress').value.trim() || getDefaultDeliveryAddress();
                order.customerPhone = document.getElementById('customerPhone').value.trim() || getDefaultContactPhone();
                order.ownerPhone = null;
            } else {
                order.ownerPhone = getShopPickupContactPhone();
                order.customerPhone = null;
            }
            order.userId = localStorage.getItem('userId') || null;
            
            var ordersKey = typeof getOrdersKey === 'function' ? getOrdersKey() : 'customerOrders';

            if (typeof window.syncOrderToSupabase !== 'function') {
                notifyCloudSyncFailed();
                return;
            }
            try {
                var row = await window.syncOrderToSupabase(order);
                if (!row || !row.id) {
                    notifyCloudSyncFailed();
                    return;
                }
                order.supabase_id = row.id;
            } catch (err) {
                console.warn('[clientordering] syncOrderToSupabase', err);
                notifyCloudSyncFailed();
                return;
            }

            orders = JSON.parse(localStorage.getItem(ordersKey)) || [];
            orders.push(order);
            localStorage.setItem(ordersKey, JSON.stringify(orders));

            renderOrdersTable();
            document.getElementById('orderForm').reset();
            removeDesignImage();
            calculatePrice();
            toggleDeliveryAddressSection();
            setMinDate();
            closeOrderModal();
            closeReceiptUploadModal();
            document.getElementById('successModal').classList.remove('hidden');
            document.getElementById('successModal').classList.add('flex');
        }

        // Update cart badge
        function updateCartBadge() {
            const badge = document.getElementById('cartBadge');
            const count = cart.length;
            
            if (count > 0) {
                badge.textContent = count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        // Open cart modal
        function openCartModal() {
            var cartKey = typeof getCartKey === 'function' ? getCartKey() : 'cart';
            cart = JSON.parse(localStorage.getItem(cartKey)) || [];
            // Reconcile previous selections
            const keptSelections = new Set();
            cart.forEach((_, idx) => { if (selectedCartIndexes.has(idx)) keptSelections.add(idx); });
            selectedCartIndexes = keptSelections;
            updateCartBadge();
            document.getElementById('cartModal').classList.remove('hidden');
            document.getElementById('cartModal').classList.add('flex');
            document.body.style.overflow = 'hidden';
            renderCart();
        }

        // Close cart modal
        function closeCartModal() {
            document.getElementById('cartModal').classList.add('hidden');
            document.getElementById('cartModal').classList.remove('flex');
            document.body.style.overflow = 'auto';
        }

        // Render cart items
        function renderCart() {
            const cartItemsContainer = document.getElementById('cartItems');
            const placeOrderBtn = document.getElementById('placeOrderBtn');
            
            if (cart.length === 0) {
                cartItemsContainer.innerHTML = `
                    <div class="text-center py-12 text-gray-400">
                        <i class="fas fa-shopping-cart text-6xl mb-4 opacity-30"></i>
                        <p class="text-lg">Your cart is empty</p>
                        <button onclick="closeCartModal(); openOrderModal();" class="inline-block mt-4 btn-primary text-white font-semibold px-6 py-3 rounded-xl shadow-lg">
                            Start Shopping
                        </button>
                    </div>
                `;
                placeOrderBtn.disabled = true;
                document.getElementById('cartTotal').textContent = '₱0';
                return;
            }
            
            // Header with Select All
            const allSelected = cart.length > 0 && cart.every((_, i) => selectedCartIndexes.has(i));
            const selectAllBar = `
                <label class="flex items-center mb-3 cursor-pointer select-none">
                    <input type="checkbox" ${allSelected ? 'checked' : ''} onchange="toggleSelectAllCart(this.checked)" class="mr-2">
                    <span class="text-sm text-gray-700">Select All</span>
                </label>
            `;
            
            const cartHTML = selectAllBar + cart.map((item, index) => `
                <div class="bg-white border-2 border-gray-200 rounded-xl p-4 mb-4 hover:border-[#D4AF37] transition">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <label class="flex items-start cursor-pointer">
                                <input type="checkbox" ${selectedCartIndexes.has(index) ? 'checked' : ''} onchange="toggleSelectCart(${index}, this.checked)" class="mt-1 mr-3">
                                <span class="font-bold text-lg text-gray-800 mb-2">${escapeHtml(item.name)}</span>
                            </label>
                            <div class="text-sm text-gray-600 space-y-1">
                                <p><i class="fas fa-ruler-combined w-4"></i> Size: ${escapeHtml(item.size)}</p>
                                <p><i class="fas fa-shopping-cart w-4"></i> Quantity: ${item.quantity}</p>
                                <p><i class="fas fa-calendar-alt w-4"></i> Date Needed: ${item.dateNeeded ? new Date(item.dateNeeded).toLocaleDateString() : 'N/A'}</p>
                                <p><i class="fas fa-cookie-bite w-4"></i> Cake: ${escapeHtml(item.flavor)}</p>
                                <p><i class="fas fa-ice-cream w-4"></i> Frosting: ${escapeHtml(item.frosting)}</p>
                                ${item.cakeDesign ? `<p class="mt-2 pt-2 border-t border-gray-200"><i class="fas fa-palette w-4"></i> <strong>Design:</strong> ${escapeHtml(item.cakeDesign)}</p>` : ''}
                                ${item.designImage ? `<p class="text-xs text-gray-500 mt-1"><i class="fas fa-image mr-1"></i>Has design image</p>` : ''}
                                <p>Delivery: ${escapeHtml(item.deliveryType || 'Pick up')}</p>
                                <p>Payment: ${item.paymentPlan === '50% Down Payment' || item.paymentMethod === '50% Down Payment' ? '50% online now + balance at pickup/delivery' + (item.downPaymentAmount != null ? ' (₱' + item.downPaymentAmount + ' due now)' : '') : item.paymentMethod === 'Cash on Delivery' ? 'Pay in full (legacy COD)' : 'Pay in full (online)'}</p>
                                ${item.dedication ? `<p><i class="fas fa-pen-fancy w-4"></i> "${escapeHtml(item.dedication)}"</p>` : ''}
                            </div>
                        </div>
                        <div class="text-right ml-4">
                            <p class="font-bold text-xl text-[#D4AF37] mb-2">₱${item.price.toFixed(0)}</p>
                            <button onclick="removeFromCart(${index})" class="text-red-500 hover:text-red-700 transition">
                                <i class="fas fa-trash-alt"></i> Remove
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
            
            cartItemsContainer.innerHTML = cartHTML;
            
            // Update total based on selected items
            const selectedItems = cart.filter((_, i) => selectedCartIndexes.has(i));
            const total = selectedItems.reduce((sum, item) => sum + item.price, 0);
            document.getElementById('cartTotal').textContent = '₱' + total.toFixed(0);
            placeOrderBtn.disabled = selectedItems.length === 0;
        }
        
        // Selection helpers
        window.toggleSelectCart = function(index, checked) {
            if (checked) selectedCartIndexes.add(index); else selectedCartIndexes.delete(index);
            renderCart();
        };
        window.toggleSelectAllCart = function(checked) {
            if (checked) cart.forEach((_, i) => selectedCartIndexes.add(i));
            else selectedCartIndexes.clear();
            renderCart();
        };

        // Remove item from cart
        function removeFromCart(index) {
            cart.splice(index, 1);
            localStorage.setItem(typeof getCartKey === 'function' ? getCartKey() : 'cart', JSON.stringify(cart));
            updateCartBadge();
            renderCart();
            showToast('Item removed from cart', 'info');
        }

        // Place order
        async function placeOrder() {
            if (cart.length === 0) {
                showAlertModal('Your cart is empty', 'warning');
                return;
            }
            
            // Work with selected items only
            const selectedItems = cart.filter((_, i) => selectedCartIndexes.has(i));
            // Receipt needed when user pays online (full) or chooses down payment
            const needsReceipt = selectedItems.some(item =>
                item.paymentMethod === 'Online Payment' || item.paymentPlan === '50% Down Payment' || item.paymentMethod === '50% Down Payment'
            );
            
            if (needsReceipt) {
                openReceiptUploadModalForCart();
            } else {
                await processCartOrders(null, null, selectedItems);
            }
        }
        
        // Open receipt upload modal for cart orders
        function openReceiptUploadModalForCart() {
            document.getElementById('receiptUploadModal').classList.remove('hidden');
            document.getElementById('receiptUploadModal').classList.add('flex');
            document.body.style.overflow = 'hidden';
            removeReceiptUpload(); // Reset upload
            pendingOrderData = 'cart'; // Mark that we're processing cart
        }
        
        // Process cart orders — each row must insert to Supabase before it counts as placed (like Records).
        async function processCartOrders(receiptData, receiptFileName, items = null) {
            var ordersKey = typeof getOrdersKey === 'function' ? getOrdersKey() : 'customerOrders';
            const orderGroupId = generateOrderGroupId();
            const defaultPhone = (function(){ try { var k = typeof getSettingsKey === 'function' ? getSettingsKey() : 'clientSettings'; var s = JSON.parse(localStorage.getItem(k) || '{}'); return (s.clientPhone || '').trim(); } catch(e){ return ''; } })();
            const currentPhone = document.getElementById('customerPhone')?.value?.trim() || defaultPhone;
            const itemsToProcess = (items || cart).slice();
            if (!itemsToProcess.length) {
                showAlertModal('No items to place.', 'warning');
                return;
            }
            const uid = localStorage.getItem('userId') || null;

            if (typeof window.syncOrderToSupabase !== 'function') {
                notifyCloudSyncFailed();
                return;
            }

            const synced = [];
            for (var i = 0; i < itemsToProcess.length; i++) {
                var item = itemsToProcess[i];
                const orderData = {
                    id: Date.now() + i * 100000 + Math.floor(Math.random() * 10000),
                    orderGroupId,
                    ...item,
                    customer: localStorage.getItem('userName') || 'Guest',
                    status: 'Pending',
                    date: new Date().toLocaleDateString(),
                    userId: uid
                };
                if (item.deliveryType === 'Deliver') {
                    orderData.customerPhone = item.customerPhone || currentPhone || defaultPhone;
                    orderData.ownerPhone = null;
                } else {
                    orderData.ownerPhone = item.ownerPhone || getShopPickupContactPhone();
                    orderData.customerPhone = null;
                }
                if (item.paymentMethod === 'Online Payment' || item.paymentPlan === '50% Down Payment' || item.paymentMethod === '50% Down Payment') {
                    orderData.receipt = receiptData;
                    orderData.receiptFileName = receiptFileName;
                }
                if ((item.paymentPlan === '50% Down Payment' || item.paymentMethod === '50% Down Payment') && item.downPaymentAmount != null) {
                    orderData.downPaymentAmount = item.downPaymentAmount;
                }
                try {
                    var row = await window.syncOrderToSupabase(orderData);
                    if (!row || !row.id) {
                        notifyCloudSyncFailed();
                        return;
                    }
                    orderData.supabase_id = row.id;
                    synced.push(orderData);
                } catch (err) {
                    console.warn('[clientordering] syncOrderToSupabase (cart)', err);
                    notifyCloudSyncFailed();
                    return;
                }
            }

            orders = JSON.parse(localStorage.getItem(ordersKey)) || [];
            synced.forEach(function (od) { orders.push(od); });
            localStorage.setItem(ordersKey, JSON.stringify(orders));

            if (items) {
                cart = cart.filter((_, idx) => !selectedCartIndexes.has(idx));
            } else {
                cart = [];
            }
            selectedCartIndexes.clear();
            localStorage.setItem(typeof getCartKey === 'function' ? getCartKey() : 'cart', JSON.stringify(cart));
            updateCartBadge();

            closeCartModal();
            closeReceiptUploadModal();
            renderOrdersTable();
            document.getElementById('successModal').classList.remove('hidden');
            document.getElementById('successModal').classList.add('flex');
        }

        // Close success modal
        function closeSuccessModal() {
            document.getElementById('successModal').classList.add('hidden');
            document.getElementById('successModal').classList.remove('flex');
        }

        // ===== ALERT MODAL FUNCTIONS =====
        
        // Show alert modal
        function showAlertModal(message, type = 'warning') {
            const alertModal = document.getElementById('alertModal');
            const alertIcon = document.getElementById('alertIcon');
            const alertIconClass = document.getElementById('alertIconClass');
            const alertTitle = document.getElementById('alertTitle');
            const alertMessage = document.getElementById('alertMessage');
            
            // Set message
            alertMessage.textContent = message;
            
            // Set icon and colors based on type
            if (type === 'error' || type === 'danger') {
                alertIcon.style.background = 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
                alertIconClass.className = 'fas fa-exclamation-circle text-white text-3xl';
                alertTitle.textContent = 'Error';
                alertTitle.style.color = '#EF4444';
            } else if (type === 'info') {
                alertIcon.style.background = 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)';
                alertIconClass.className = 'fas fa-info-circle text-white text-3xl';
                alertTitle.textContent = 'Information';
                alertTitle.style.color = '#3B82F6';
            } else {
                // Default warning
                alertIcon.style.background = 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)';
                alertIconClass.className = 'fas fa-exclamation-triangle text-white text-3xl';
                alertTitle.textContent = 'Warning';
                alertTitle.style.color = '#F59E0B';
            }
            
            // Show modal
            alertModal.classList.remove('hidden');
            alertModal.classList.add('flex');
            document.body.style.overflow = 'hidden';
        }
        
        // Close alert modal
        function closeAlertModal() {
            const alertModal = document.getElementById('alertModal');
            alertModal.classList.add('hidden');
            alertModal.classList.remove('flex');
            document.body.style.overflow = 'auto';
        }

        function notifyCloudSyncFailed() {
            showAlertModal(
                'Order was not placed. Orders must be saved to Supabase first (same idea as Records). Sign in, confirm this site uses your Supabase project, check RLS policies, and open the browser console (F12) for errors. Large receipt images are retried automatically without the file.',
                'error'
            );
        }

        // ===== ORDER DETAILS MODAL FUNCTIONS =====
        
        // View order details
        function viewOrderDetails(orderId) {
            // Find the order by ID
            const order = orders.find(o => o.id === orderId);
            
            if (!order) {
                showAlertModal('Order not found', 'error');
                return;
            }
            
            // Display order details in modal
            const detailsContent = document.getElementById('orderDetailsContent');
            detailsContent.innerHTML = `
                <div class="space-y-6">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-[#FFF8F0] rounded-lg p-4">
                            <p class="text-xs text-gray-500 mb-1">Cake</p>
                            <p class="font-semibold text-gray-800">${escapeHtml(order.name || order.cake || 'Custom Order')}</p>
                        </div>
                        <div class="bg-[#FFF8F0] rounded-lg p-4">
                            <p class="text-xs text-gray-500 mb-1">Size</p>
                            <p class="font-semibold text-gray-800">${escapeHtml(order.size || 'N/A')}</p>
                        </div>
                        <div class="bg-[#FFF8F0] rounded-lg p-4">
                            <p class="text-xs text-gray-500 mb-1">Quantity</p>
                            <p class="font-semibold text-gray-800">${order.quantity || 1}</p>
                        </div>
                        <div class="bg-[#FFF8F0] rounded-lg p-4">
                            <p class="text-xs text-gray-500 mb-1">Date Needed</p>
                            <p class="font-semibold text-gray-800">${order.dateNeeded ? new Date(order.dateNeeded).toLocaleDateString() : 'N/A'}</p>
                        </div>
                        <div class="bg-[#FFF8F0] rounded-lg p-4">
                            <p class="text-xs text-gray-500 mb-1">Cake</p>
                            <p class="font-semibold text-gray-800">${escapeHtml(order.flavor || 'N/A')}</p>
                        </div>
                        <div class="bg-[#FFF8F0] rounded-lg p-4">
                            <p class="text-xs text-gray-500 mb-1">Frosting</p>
                            <p class="font-semibold text-gray-800">${escapeHtml(order.frosting || 'N/A')}</p>
                        </div>
                        <div class="bg-[#FFF8F0] rounded-lg p-4">
                            <p class="text-xs text-gray-500 mb-1">Price</p>
                            <p class="font-semibold text-[#D4AF37]">₱${(order.price || 0).toFixed(2)}</p>
                            ${order.paymentMethod === '50% Down Payment' && order.downPaymentAmount != null ? `<p class="text-xs text-gray-600 mt-1">50% due now: ₱${order.downPaymentAmount}</p>` : ''}
                        </div>
                    </div>
                    
                    ${order.cakeDesign || order.designImage ? `
                    <div class="bg-[#FFF8F0] rounded-lg p-4">
                        <p class="text-xs text-gray-500 mb-2"><i class="fas fa-palette mr-1 text-[#D4AF37]"></i>Cake Design</p>
                        ${order.cakeDesign ? `<p class="text-gray-800 mb-2">${escapeHtml(order.cakeDesign)}</p>` : ''}
                        ${order.designImage ? `
                            <div class="mt-2">
                                <p class="text-xs text-gray-500 mb-2"><i class="fas fa-image mr-1"></i>Reference Image: ${escapeHtml(order.designImageName || 'design.jpg')}</p>
                                <img src="${order.designImage}" alt="Design Reference" class="max-w-full h-auto rounded-lg shadow-md border-2 border-gray-200">
                            </div>
                        ` : ''}
                    </div>
                    ` : ''}
                    
                    ${order.dedication ? `
                    <div class="bg-[#FFF8F0] rounded-lg p-4">
                        <p class="text-xs text-gray-500 mb-1"><i class="fas fa-pen-fancy mr-1 text-[#D4AF37]"></i>Dedication Message</p>
                        <p class="text-gray-800 italic">"${escapeHtml(order.dedication)}"</p>
                    </div>
                    ` : ''}
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-[#FFF8F0] rounded-lg p-4">
                            <p class="text-xs text-gray-500 mb-1">Delivery Type</p>
                            <p class="font-semibold text-gray-800">${escapeHtml(order.deliveryType || 'Pick up')}</p>
                        </div>
                        <div class="bg-[#FFF8F0] rounded-lg p-4">
                            <p class="text-xs text-gray-500 mb-1">Payment</p>
                            <p class="font-semibold text-gray-800">${escapeHtml(clientOrderPaymentLabel(order))}</p>
                        </div>
                        <div class="bg-[#FFF8F0] rounded-lg p-4">
                            <p class="text-xs text-gray-500 mb-1">Status</p>
                            <p class="font-semibold text-gray-800">${escapeHtml(order.status || 'Pending')}</p>
                        </div>
                        <div class="bg-[#FFF8F0] rounded-lg p-4">
                            <p class="text-xs text-gray-500 mb-1">Order Date</p>
                            <p class="font-semibold text-gray-800">${escapeHtml(order.date || new Date().toLocaleDateString())}</p>
                        </div>
                    </div>
                </div>
            `;
            
            // Show modal
            document.getElementById('orderDetailsModal').classList.remove('hidden');
            document.getElementById('orderDetailsModal').classList.add('flex');
            document.body.style.overflow = 'hidden';
        }
        
        // Close order details modal
        function closeOrderDetailsModal() {
            document.getElementById('orderDetailsModal').classList.add('hidden');
            document.getElementById('orderDetailsModal').classList.remove('flex');
            document.body.style.overflow = 'auto';
            // Clear content
            document.getElementById('orderDetailsContent').innerHTML = '';
        }

        // ===== DOWNLOAD ORDER AS TEXT FILE =====
        function buildOrderText(order, isSingle) {
            const lines = [];
            lines.push('Meringued - ' + (isSingle ? 'Order Receipt' : 'Order Log'));
            lines.push('================================');
            lines.push('Generated: ' + new Date().toLocaleString());
            lines.push('');
            lines.push('Order ID: ' + (order.orderGroupId || order.id || '—'));
            lines.push('Date ordered: ' + (order.date || '—'));
            lines.push('Cake: ' + (order.name || order.cake || 'Custom Order'));
            lines.push('Size: ' + (order.size || '—'));
            lines.push('Quantity: ' + (order.quantity != null ? order.quantity : '—'));
            lines.push('Flavor: ' + (order.flavor || '—'));
            lines.push('Frosting: ' + (order.frosting || '—'));
            lines.push('Date needed: ' + (order.dateNeeded ? new Date(order.dateNeeded).toLocaleDateString() : '—'));
            lines.push('Delivery: ' + (order.deliveryType || 'Pick up'));
            lines.push('Payment: ' + clientOrderPaymentLabel(order));
            lines.push('Status: ' + (order.status || 'Pending'));
            const price = order.price != null ? Number(order.price) : 0;
            lines.push('Price: ₱' + price.toFixed(2));
            if (order.paymentMethod === '50% Down Payment' && order.downPaymentAmount != null) {
                lines.push('50% due now: ₱' + order.downPaymentAmount);
            }
            if (order.cakeDesign) {
                lines.push('');
                lines.push('Design:');
                lines.push(order.cakeDesign);
            }
            if (order.dedication) {
                lines.push('');
                lines.push('Dedication:');
                lines.push('"' + order.dedication + '"');
            }
            if (isSingle) {
                lines.push('');
                lines.push('Keep this as proof of your order.');
            }
            return lines.join('\n');
        }

        function downloadTextFile(filename, text) {
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 0);
        }

        function downloadSingleOrderTxt(orderId) {
            const activeOrders = orders.filter(function (o) { return o.status !== 'Cancelled'; });
            const order = activeOrders.find(function (o) { return o.id === orderId; });
            if (!order) {
                showAlertModal('Order not found.', 'warning');
                return;
            }
            const text = buildOrderText(order, true);
            const idPart = order.orderGroupId || order.id || 'order';
            downloadTextFile('meringued-order-' + idPart + '.txt', text);
        }

        function downloadSingleOrderPdf(orderId) {
            const activeOrders = orders.filter(function (o) { return o.status !== 'Cancelled'; });
            const order = activeOrders.find(function (o) { return o.id === orderId; });
            if (!order) {
                showAlertModal('Order not found.', 'warning');
                return;
            }

            const idPart = (order.orderGroupId || order.id || 'order').toString();
            const title = 'Meringued — Order ' + idPart;
            const generatedAt = new Date().toLocaleString();

            const cake = (order.name || order.cake || '—');
            const qty = (order.quantity != null ? order.quantity : '—');
            const delivery = (order.deliveryType || '—');
            const payment = clientOrderPaymentLabel(order);
            const needed = (order.dateNeeded || '—');
            const total = formatMoneyPhp(order.price || 0);
            const down = (order.paymentMethod === '50% Down Payment' && order.downPaymentAmount != null)
                ? ('<div class="sub">50% due now: ' + formatMoneyPhp(order.downPaymentAmount) + '</div>')
                : '';
            const status = (order.status || '—');

            const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 14mm; }
    body { font-family: Arial, sans-serif; color: #111827; }
    h1 { margin: 0 0 6px 0; font-size: 18px; }
    .meta { color: #6b7280; font-size: 12px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; vertical-align: top; }
    th { background: #fff7ed; text-align: left; }
    .right { text-align: right; }
    .center { text-align: center; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 11px; }
    .sub { margin-top: 2px; color: #6b7280; font-size: 11px; }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:10px;">
    <button onclick="window.print()" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer;font-weight:600;">Print / Save as PDF</button>
  </div>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Generated: ${escapeHtml(generatedAt)}</div>
  <table>
    <tbody>
      <tr>
        <th style="width:18%;">Order ID</th>
        <td class="mono">${escapeHtml(idPart)}</td>
      </tr>
      <tr>
        <th>Cake</th>
        <td>${escapeHtml(cake)}</td>
      </tr>
      <tr>
        <th>Qty</th>
        <td>${escapeHtml(qty)}</td>
      </tr>
      <tr>
        <th>Delivery</th>
        <td>${escapeHtml(delivery)}</td>
      </tr>
      <tr>
        <th>Payment</th>
        <td>${escapeHtml(payment)}${down}</td>
      </tr>
      <tr>
        <th>Need by</th>
        <td>${escapeHtml(needed)}</td>
      </tr>
      <tr>
        <th>Total</th>
        <td class="right">${escapeHtml(total)}</td>
      </tr>
      <tr>
        <th>Status</th>
        <td>${escapeHtml(status)}</td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;

            const win = window.open('', '_blank');
            if (!win) {
                showAlertModal('Popup blocked. Please allow popups to download PDF.', 'warning');
                return;
            }
            win.document.open();
            win.document.write(html);
            win.document.close();
            setTimeout(function () { try { win.print(); } catch (e) {} }, 250);
        }

        function downloadAllOrdersTxt() {
            const activeOrders = orders.filter(function (o) { return o.status !== 'Cancelled'; });
            if (!activeOrders.length) {
                showAlertModal('No orders to download.', 'info');
                return;
            }
            const sorted = activeOrders.slice().reverse();
            const parts = [];
            sorted.forEach(function (o, idx) {
                if (idx > 0) {
                    parts.push('');
                    parts.push('--------------------------------');
                    parts.push('');
                }
                parts.push(buildOrderText(o, false));
            });
            downloadTextFile('meringued-orders-log.txt', parts.join('\n'));
        }

        function formatMoneyPhp(amount) {
            var n = Number(amount || 0);
            try {
                return '₱' + n.toFixed(2);
            } catch (e) {
                return '₱' + amount;
            }
        }

        function downloadAllOrdersPdf() {
            const activeOrders = orders.filter(function (o) { return o.status !== 'Cancelled'; });
            if (!activeOrders.length) {
                showAlertModal('No orders to download.', 'info');
                return;
            }

            const sorted = activeOrders.slice().reverse();
            const title = 'Meringued — Orders Log';
            const generatedAt = new Date().toLocaleString();

            const rowsHtml = sorted.map(function (o) {
                var idPart = (o.orderGroupId || o.id || '').toString();
                var cake = (o.name || o.cake || '—');
                var qty = (o.quantity != null ? o.quantity : '—');
                var delivery = (o.deliveryType || '—');
                var payment = clientOrderPaymentLabel(o);
                var needed = (o.dateNeeded || '—');
                var total = formatMoneyPhp(o.price || 0);
                var down = (o.paymentMethod === '50% Down Payment' && o.downPaymentAmount != null)
                    ? ('<div class="sub">50% due now: ' + formatMoneyPhp(o.downPaymentAmount) + '</div>')
                    : '';
                var status = (o.status || '—');

                return (
                    '<tr>' +
                    '<td class="mono">' + escapeHtml(idPart) + '</td>' +
                    '<td>' + escapeHtml(cake) + '</td>' +
                    '<td class="center">' + escapeHtml(qty) + '</td>' +
                    '<td>' + escapeHtml(delivery) + '</td>' +
                    '<td>' + escapeHtml(payment) + down + '</td>' +
                    '<td>' + escapeHtml(needed) + '</td>' +
                    '<td class="right">' + escapeHtml(total) + '</td>' +
                    '<td>' + escapeHtml(status) + '</td>' +
                    '</tr>'
                );
            }).join('');

            const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    @page { margin: 14mm; }
    body { font-family: Arial, sans-serif; color: #111827; }
    h1 { margin: 0 0 6px 0; font-size: 18px; }
    .meta { color: #6b7280; font-size: 12px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; vertical-align: top; }
    th { background: #fff7ed; text-align: left; }
    .right { text-align: right; }
    .center { text-align: center; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 11px; }
    .sub { margin-top: 2px; color: #6b7280; font-size: 11px; }
    .hint { margin-top: 10px; font-size: 11px; color: #6b7280; }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:10px;">
    <button onclick="window.print()" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer;font-weight:600;">Print / Save as PDF</button>
  </div>
  <h1>${title}</h1>
  <div class="meta">Generated: ${escapeHtml(generatedAt)}</div>
  <table>
    <thead>
      <tr>
        <th style="width:16%;">Order ID</th>
        <th style="width:18%;">Cake</th>
        <th style="width:7%;">Qty</th>
        <th style="width:12%;">Delivery</th>
        <th style="width:17%;">Payment</th>
        <th style="width:12%;">Need by</th>
        <th style="width:9%;">Total</th>
        <th style="width:9%;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <div class="hint">Tip: In the print dialog, choose “Save as PDF”.</div>
</body>
</html>`;

            const win = window.open('', '_blank');
            if (!win) {
                showAlertModal('Popup blocked. Please allow popups to download PDF.', 'warning');
                return;
            }
            win.document.open();
            win.document.write(html);
            win.document.close();
            // Auto-open print dialog in the new window after rendering
            setTimeout(function(){ try { win.print(); } catch (e) {} }, 250);
        }

        // ===== RECEIPT VIEW MODAL FUNCTIONS =====
        
        // View receipt
        function viewReceipt(orderId) {
            // Find the order by ID
            const order = orders.find(o => o.id === orderId);
            
            if (!order || !order.receipt) {
                showAlertModal('Receipt not found for this order', 'error');
                return;
            }
            
            // Display receipt in modal
            const receiptContent = document.getElementById('receiptViewContent');
            const receiptFileName = order.receiptFileName || 'receipt';
            
            // Check if receipt is base64 image or PDF
            if (order.receipt.startsWith('data:image/')) {
                receiptContent.innerHTML = `
                    <div class="mb-4">
                        <p class="text-sm text-gray-600 mb-2">
                            <i class="fas fa-file-image mr-1"></i> ${escapeHtml(receiptFileName)}
                        </p>
                        <img src="${order.receipt}" alt="Payment Receipt" class="max-w-full h-auto rounded-lg shadow-lg mx-auto border-2 border-gray-200">
                    </div>
                `;
            } else if (order.receipt.startsWith('data:application/pdf')) {
                receiptContent.innerHTML = `
                    <div class="mb-4">
                        <p class="text-sm text-gray-600 mb-2">
                            <i class="fas fa-file-pdf mr-1"></i> ${escapeHtml(receiptFileName)}
                        </p>
                        <iframe src="${order.receipt}" class="w-full h-[600px] rounded-lg shadow-lg border-2 border-gray-200" frameborder="0"></iframe>
                    </div>
                `;
            } else {
                // Assume it's an image if it starts with data:
                receiptContent.innerHTML = `
                    <div class="mb-4">
                        <p class="text-sm text-gray-600 mb-2">
                            <i class="fas fa-file-image mr-1"></i> ${escapeHtml(receiptFileName)}
                        </p>
                        <img src="${order.receipt}" alt="Payment Receipt" class="max-w-full h-auto rounded-lg shadow-lg mx-auto border-2 border-gray-200">
                    </div>
                `;
            }
            
            // Show modal
            document.getElementById('receiptViewModal').classList.remove('hidden');
            document.getElementById('receiptViewModal').classList.add('flex');
            document.body.style.overflow = 'hidden';
        }
        
        // Close receipt view modal
        function closeReceiptViewModal() {
            document.getElementById('receiptViewModal').classList.add('hidden');
            document.getElementById('receiptViewModal').classList.remove('flex');
            document.body.style.overflow = 'auto';
            // Clear content
            document.getElementById('receiptViewContent').innerHTML = '';
        }

        // ===== CANCEL ORDER FUNCTIONS =====
        let pendingCancelOrderId = null;

        function openCancelOrderModal(orderId) {
            pendingCancelOrderId = orderId;
            document.getElementById('cancelOrderModal').classList.remove('hidden');
            document.getElementById('cancelOrderModal').classList.add('flex');
            document.body.style.overflow = 'hidden';
        }

        function closeCancelOrderModal() {
            document.getElementById('cancelOrderModal').classList.add('hidden');
            document.getElementById('cancelOrderModal').classList.remove('flex');
            document.body.style.overflow = 'auto';
            pendingCancelOrderId = null;
        }

        function confirmCancelOrder() {
            if (!pendingCancelOrderId) return;
            var ordersKey = typeof getOrdersKey === 'function' ? getOrdersKey() : 'customerOrders';
            const storedOrders = localStorage.getItem(ordersKey);
            orders = storedOrders ? JSON.parse(storedOrders) : [];
            const idx = orders.findIndex(o => o.id === pendingCancelOrderId);
            if (idx !== -1 && (orders[idx].status === 'Pending' || !orders[idx].status)) {
                orders[idx].status = 'Cancelled';
                localStorage.setItem(ordersKey, JSON.stringify(orders));
                renderOrdersTable();
                showToast('Order cancelled', 'info');
            } else {
                showAlertModal('Only pending orders can be cancelled.', 'warning');
            }

            closeCancelOrderModal();
        }

        // ===== LOGOUT FUNCTIONS =====
        
        // Open logout confirmation modal
        function openLogoutModal() {
            document.getElementById('logoutModal').classList.remove('hidden');
            document.getElementById('logoutModal').classList.add('flex');
            document.body.style.overflow = 'hidden';
        }

        // Close logout confirmation modal
        function closeLogoutModal() {
            document.getElementById('logoutModal').classList.add('hidden');
            document.getElementById('logoutModal').classList.remove('flex');
            document.body.style.overflow = 'auto';
        }

        // Confirm logout
        function confirmLogout() {
            // Clear user session data if needed
            // localStorage.removeItem('userName'); // Optional: keep for next login
            
            // Redirect to home page
            window.location.href = 'index.html';
        }

        // Show toast notification
        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl text-white transform transition-all duration-300 ${
                type === 'success' ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-blue-500 to-blue-600'
            }`;
            toast.innerHTML = `
                <div class="flex items-center space-x-3">
                    <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'} text-2xl"></i>
                    <p class="font-semibold">${message}</p>
                </div>
            `;
            
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, 2000);
        }

        // Escape HTML to prevent XSS
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Close modals when clicking outside
        document.getElementById('cartModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeCartModal();
            }
        });
        
        document.getElementById('successModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeSuccessModal();
            }
        });
        
        document.getElementById('logoutModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeLogoutModal();
            }
        });
        
        document.getElementById('orderModal')?.addEventListener('click', function(e) {
            if (e.target === this) {
                closeOrderModal();
            }
        });
        
        document.getElementById('receiptUploadModal')?.addEventListener('click', function(e) {
            if (e.target === this) {
                closeReceiptUploadModal();
            }
        });
        
        document.getElementById('alertModal')?.addEventListener('click', function(e) {
            if (e.target === this) {
                closeAlertModal();
            }
        });
        
        document.getElementById('orderDetailsModal')?.addEventListener('click', function(e) {
            if (e.target === this) {
                closeOrderDetailsModal();
            }
        });
        
        document.getElementById('receiptViewModal')?.addEventListener('click', function(e) {
            if (e.target === this) {
                closeReceiptViewModal();
            }
        });
        
        // Close modals on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                // Close sidebar on mobile
                const sidebar = document.getElementById('clientSidebar');
                const sidebarOverlay = document.getElementById('sidebarOverlay');
                if (window.innerWidth < 768 && sidebar && !sidebar.classList.contains('-translate-x-full')) {
                    sidebar.classList.add('-translate-x-full');
                    sidebarOverlay?.classList.add('hidden');
                    return;
                }
                const orderDetailsModal = document.getElementById('orderDetailsModal');
                if (orderDetailsModal && !orderDetailsModal.classList.contains('hidden')) {
                    closeOrderDetailsModal();
                    return;
                }
                const receiptViewModal = document.getElementById('receiptViewModal');
                if (receiptViewModal && !receiptViewModal.classList.contains('hidden')) {
                    closeReceiptViewModal();
                    return;
                }
                const cancelOrderModal = document.getElementById('cancelOrderModal');
                if (cancelOrderModal && !cancelOrderModal.classList.contains('hidden')) {
                    closeCancelOrderModal();
                    return;
                }
                const receiptModal = document.getElementById('receiptUploadModal');
                if (receiptModal && !receiptModal.classList.contains('hidden')) {
                    closeReceiptUploadModal();
                    return;
                }
                const alertModal = document.getElementById('alertModal');
                if (alertModal && !alertModal.classList.contains('hidden')) {
                    closeAlertModal();
                    return;
                }
            }
        });
    