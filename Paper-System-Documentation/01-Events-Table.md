# Events Table (Revised 6-Column Format)

This revised table follows your required format exactly:

- Event (type of event)
- Trigger
- Source
- Use Case
- Response
- Destination

---

## A. Access, Authentication, and Session Events

| Event | Trigger | Source | Use Case | Response | Destination |
|---|---|---|---|---|---|
| Landing Page Access | User opens homepage URL | Visitor | View public website and navigate modules | Loads home sections, CTA, gallery, nav links | Visitor browser session |
| Customer Auth Entry | User clicks `Login/Signup` | Visitor | Start customer authentication flow | Redirects to customer login/signup pages | Customer auth pages |
| Admin Auth Entry | User opens dedicated admin auth page | Admin user | Access admin-only login/signup options | Displays admin access choices (login/signup) | Admin auth page |
| Customer Login | Valid customer credentials submitted | Customer | Authenticate customer account | Creates customer session and routes to customer dashboard | `clientdashboard.html` |
| Customer Signup | Signup form submitted | Customer | Register new customer account | Creates account/profile and prepares customer login state | Customer account store |
| Admin Login | Valid admin credentials submitted | Admin | Authenticate admin account | Creates admin session with role check | `admindashboard.html` |
| Admin Signup | Admin signup form submitted | Admin | Register admin account | Creates admin account/profile with admin role | Admin account store |
| Protected Route Validation | User opens protected page without valid session/role | Customer/Admin | Enforce role-based page access | Allows page load or redirects unauthorized user | Requested page or login/home |
| Logout Execution | Logout button pressed | Customer/Admin | End active session securely | Clears auth session and local session state | Public index/login page |

---

## B. Customer Dashboard and Order Visibility Events

| Event | Trigger | Source | Use Case | Response | Destination |
|---|---|---|---|---|---|
| Customer Dashboard Load | Customer opens dashboard page | Customer | View personal order summary | Fetches and renders customer-relevant order data | Dashboard widgets and order panel |
| Order Status Refresh | Page visible/focused or interval polling | Customer client | Keep customer status view updated | Pulls latest cloud/local merged statuses | Customer orders table |
| Active Orders Listing | Orders table render event | Customer | Monitor in-progress orders | Displays pending/acknowledge/baking/ready orders | Customer order list section |
| Customer List Pagination | User changes list-by or page controls | Customer | Improve readability for long order lists | Applies page-size and page navigation updates | Customer orders table view |

---

## C. Customer POS and Checkout Events

| Event | Trigger | Source | Use Case | Response | Destination |
|---|---|---|---|---|---|
| POS Modal Open | User clicks `New Order` / `Order Yours Now` | Customer | Begin custom order entry | Opens POS modal and initializes defaults | POS form modal |
| Flavor Selection Event | Customer selects cake flavor | Customer | Configure cake base | Rebuilds frosting options with flavor-aware S/M/L prices | Frosting dropdown and summary |
| Frosting Selection Event | Customer selects frosting option | Customer | Configure cake finish | Updates unit-price basis for selected size | Pricing summary |
| Cake Size Selection Event | Customer picks Small/Medium/Large | Customer | Define cake tier size | Applies size tier and recalculates unit cost | Price and size summary |
| Quantity Update Event | Quantity field changed | Customer | Adjust order volume | Recomputes subtotal and total amount | POS total price display |
| Delivery Mode Change | Pickup/Deliver option changed | Customer | Select fulfillment mode | Toggles address/contact sections and fee behavior | Fulfillment fields and summary |
| Payment Plan Change | Full/50% option changed | Customer | Select payment strategy | Updates due-now amount and payment instructions | Payment summary row |
| Date Needed Input | Date field entered/changed | Customer | Set target consumption date | Validates date and reflects in order summary | Date field and summary |
| Design Description Input | Text entered in design box | Customer | Capture design requirements | Stores design notes in order payload | Order details payload |
| Multi-Image Upload | Customer uploads reference images | Customer | Attach visual design references | Validates type + cumulative size (max 100MB), renders preview list | Design image list UI |
| Image Removal Event | Customer removes one or all images | Customer | Refine uploaded references | Deletes selected image(s), recalculates total uploaded size | Updated image list UI |
| Add-to-Cart Event | Customer clicks `Add to Cart` | Customer | Save configuration before checkout | Creates cart item with full configuration payload | Cart storage + cart modal |
| Cart Review Event | Customer opens cart modal | Customer | Verify selected order lines | Displays line items, totals, and order reminders | Cart view |
| Place Order Event | Customer clicks `Place Order` | Customer | Submit order for processing | Creates order object and prepares receipt requirement flow | Receipt upload modal |
| Receipt Upload Event | Payment receipt file selected | Customer | Provide payment proof | Validates file and binds receipt to target order | Receipt attachment state |
| Order Confirmation Event | Customer confirms after receipt upload | Customer | Finalize order submission | Saves order record and refreshes customer order table | Customer orders list |

---

## D. Customer Logs and PDF Export Events

| Event | Trigger | Source | Use Case | Response | Destination |
|---|---|---|---|---|---|
| Order Details View | Customer clicks specific order | Customer | Inspect full order details | Opens details modal with design info and attachments | Order details modal |
| Receipt Preview View | Customer clicks receipt action | Customer | Verify uploaded proof copy | Opens receipt viewer modal | Receipt preview modal |
| Single-Order PDF Export | Customer clicks per-order PDF action | Customer | Print/download one order record | Generates printable single-order sheet | New print window |
| All-Orders PDF Export | Customer clicks all-orders PDF action | Customer | Print/download complete order log | Generates print-ready PDF page with letterhead | New print window |

---

## E. Admin Dashboard and Orders Management Events

| Event | Trigger | Source | Use Case | Response | Destination |
|---|---|---|---|---|---|
| Admin Dashboard Load | Admin opens dashboard | Admin | View operational summary | Loads metrics, counts, and alerts | Dashboard cards and notices |
| Orders Module Load | Admin opens Orders page | Admin | Manage incoming and active orders | Fetches and merges order data from available sources | Admin orders table |
| Orders Status Filter | Admin clicks tab (All/Open/Pending/etc.) | Admin | Focus on specific pipeline stage | Applies status filter and refreshes listing | Filtered orders table |
| Admin Orders Pagination | Admin changes list-by/page controls | Admin | Handle large order list efficiently | Applies pagination and updates visible rows | Orders list panel |
| Order Detail Inspection | Admin opens order details action | Admin | Review complete order context | Shows customer info, design details, and images | Admin order details modal |
| Receipt Verification | Admin opens receipt action | Admin | Validate customer payment proof | Displays customer receipt file | Receipt viewer modal |
| Pipeline Advance Event | Admin clicks next-step action | Admin | Move order through process stages | Updates status sequence (Pending→Acknowledge→Baking→Ready→Completed) | Updated order row/status |
| Manual Status Update | Admin uses alternative status control | Admin | Apply non-linear status action | Updates status to selected state (including cancellation) | Orders table + persisted status |
| Baking Misc Stock-Out | Admin confirms misc deduction during baking | Admin | Deduct production supplies used | Updates miscellaneous inventory and movement log | Inventory records + order context |

---

## F. Admin Inventory and Records Events

| Event | Trigger | Source | Use Case | Response | Destination |
|---|---|---|---|---|---|
| Inventory Module Load | Admin opens inventory page | Admin | Monitor and maintain stock | Loads ingredient/misc inventory dataset | Inventory table and cards |
| Inventory Category Switch | Admin selects Ingredients or Misc tab | Admin | Manage different stock classes | Switches active dataset and UI labels | Inventory section state |
| Inventory Add Item | Admin submits add-item form | Admin | Create new stock record | Saves item with qty/unit/reorder/cost/expiry/image fields | Inventory storage + table |
| Inventory Search | Admin types in search field | Admin | Find target stock item quickly | Filters visible inventory rows/cards | Inventory list |
| Inventory Pagination | Admin changes list-by/page controls | Admin | Improve list readability | Applies page-size and page navigation | Inventory list |
| Inventory Edit Save | Admin saves edited item data | Admin | Maintain accurate item metadata | Persists item updates and refreshes list | Inventory item record |
| Stock In Event | Admin performs stock-in action | Admin | Increase available stock | Adds quantity and logs movement | Inventory quantity + records |
| Stock Out Event | Admin performs stock-out action | Admin | Decrease available stock | Subtracts quantity and logs movement | Inventory quantity + records |
| Price Save Event | Admin saves unit price | Admin | Keep purchase costing accurate | Stores unit cost for future purchase-expense calculations | Inventory pricing field |
| Records Module Load | Admin opens records page | Admin | Manage audits/sales/purchases/EOD logs | Loads records with type/date/search context | Records table |
| Record Type Switch | Admin clicks record-type tab | Admin | Inspect specific record domain | Refreshes list by selected type | Filtered records table |
| Date Filter Apply | Admin applies date preset/range | Admin | Limit records by timeframe | Fetches and renders date-constrained results | Records table |
| Record Search Apply | Admin searches title/ref/notes | Admin | Locate specific record quickly | Filters matching rows | Records table |
| Records Pagination | Admin changes list-by/page controls | Admin | Manage long records list | Applies pagination to rows | Records table |
| Add/Edit Record Event | Admin saves record form | Admin | Maintain administrative logs | Creates/updates allowed record types | Records dataset |
| Records PDF Export | Admin clicks export-to-PDF button | Admin | Produce printable documentation by type | Generates print-ready records PDF with letterhead | New print window |

---

## G. Synchronization and Consistency Events

| Event | Trigger | Source | Use Case | Response | Destination |
|---|---|---|---|---|---|
| Customer Cloud Sync Cycle | Timed/visibility refresh in customer pages | System (client logic) | Keep order statuses current | Pulls latest orders and hydrates local view | Customer order UI |
| Admin Merge Load | Orders page initialization | System (admin logic) | Combine cloud/local sources safely | Merges and deduplicates order records | Admin orders dataset |
| Duplicate Resolution Event | Same logical order found from multiple sources | System merge routine | Prevent stale or double entries | Prefers canonical/latest record and removes duplicates | Unified order list |
| Heavy Payload Fallback | Oversized attachments detected during persistence | System persistence layer | Avoid failed order insert/update | Applies slim payload fallback path | Stable order save/sync path |

