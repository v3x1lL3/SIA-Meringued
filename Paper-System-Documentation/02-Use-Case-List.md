# Use Case List (Aligned with Revised Events Table)

This revision mirrors the updated events table flow (`Event → Trigger → Source → Use Case → Response → Destination`) and uses the same module grouping for consistency in your paper.

## A. Customer Use Cases

### A.1 Access and Session
- Access public landing page content.
- Enter customer authentication flow from `Login/Signup`.
- Register customer account.
- Authenticate as customer and open customer dashboard.
- Access customer-protected routes with session validation.
- Logout and terminate customer session.

### A.2 Dashboard and Order Visibility
- Load customer dashboard summary.
- View active order listing.
- Track pipeline status changes (`Pending`, `Acknowledge`, `Baking`, `Ready`, `Completed`, `Cancelled`).
- Open order details modal.
- Apply customer order list pagination (`5`, `10`, `20`, `all`).

### A.3 POS Configuration and Customization
- Open POS order modal and initialize order form.
- Select cake flavor and refresh flavor-dependent pricing options.
- Select frosting and size (S/M/L) pricing tier.
- Update quantity and recalculate totals.
- Configure payment plan (full payment or 50% down payment).
- Configure fulfillment mode (pickup or delivery).
- Set required date (`To be consumed on`).
- Add design instructions and dedication message.
- Upload multiple design references (with total upload limit validation).
- Remove individual uploaded image or clear all images.

### A.4 Cart, Checkout, and Proof of Payment
- Add configured order to cart.
- Review cart line items and computed totals.
- Place order directly or from cart.
- Upload payment receipt during checkout.
- Confirm order submission and persist order record.

### A.5 Logs, Receipts, and Exports
- Preview uploaded receipt.
- Download single-order printable PDF.
- Download all-orders printable PDF with letterhead.

## B. Admin Use Cases

### B.1 Admin Access and Session
- Open separate admin authentication page.
- Register admin account.
- Authenticate as admin user.
- Access admin-protected modules based on role.
- Logout and terminate admin session.

### B.2 Dashboard Monitoring
- Load operational dashboard metrics.
- View pending-order and low-stock alerts.
- Navigate to Orders, Inventory, and Records modules.

### B.3 Orders Management and Workflow Control
- Load merged order list from available sources.
- Filter orders by status tabs.
- Apply admin orders pagination (`5`, `10`, `20`, `all`).
- View order details, design references, and receipt.
- Advance order through pipeline stages.
- Apply alternative status updates or cancellation.
- Execute miscellaneous stock-out during baking stage.

### B.4 Inventory Management (Ingredients and Misc)
- Switch between Ingredients and Miscellaneous tabs.
- Add new inventory item.
- Search inventory by item name.
- Apply inventory pagination (`5`, `10`, `20`, `all`).
- Edit item metadata (unit, unit cost, reorder level, expiry, image).
- Save updated unit price for costing.
- Record stock-in and stock-out movements.
- View low-stock and expiry notifications.
- Delete inventory item.

### B.5 Records Management and Reporting
- Load records module by type.
- Switch record types (`purchase`, `sales`, `inventory audit`, `EOD`).
- Apply date preset or custom range filters.
- Search records by title/reference/notes.
- Apply records pagination (`5`, `10`, `20`, `all`).
- Add/edit allowed record types.
- View locked auto-generated inventory audit/EOD entries.
- View daily totals for applicable record types.
- Export active record type to print-ready PDF with letterhead.

## C. Shared/System Use Cases

- Enforce role-based route guards.
- Synchronize customer orders from cloud and local sources.
- Merge and deduplicate order records.
- Handle large payload fallback for heavy attachments.
- Persist filter/tab/pagination state in UI sessions.
- Validate form inputs, file type constraints, and file size limits.

