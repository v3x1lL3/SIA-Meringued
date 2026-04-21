# Use Case Descriptions (Paragraph Form)

The following paragraphs mirror the structure used in typical SRS chapters: each subsection names the module, states the **primary actor(s)**, explains what they do, notes important **constraints or included behaviors**, and closes with the **purpose** of the module. They are aligned with the ten UML-style figures in **`02-Use-Case-Diagram.docx`**, the connection detail in **`04-Use-Case-Diagrams-Context.md`**, and the behaviors in **`02-Use-Case-List.md`** / **`01-Events-Table.md`**.

Section numbers below are placeholders (`3.x`); renumber to match your paper’s chapter outline.

---

### 3.2 Customer Access and Session

The **Customer Access and Session** area of the Meringued customer site is the entry layer for public browsing and authenticated use. The **Customer** actor opens the landing experience, starts login or signup, may register a new account, signs in to reach the dashboard, and later uses session-protected pages or logs out. Successful authentication **includes** establishing customer session state, while use of protected routes **includes** server-side enforcement of role and session checks so unauthorized users are redirected. The goal is reliable identification of the shopper, safe navigation of gated pages, and a clean session lifecycle before any ordering work begins.

---

### 3.3 Customer Dashboard and Order Visibility

The **Customer Dashboard and Order Visibility** module is where an authenticated **Customer** sees a concise dashboard, an active order list, live pipeline statuses (for example Pending through Completed or Cancelled), detailed order modals, and list pagination. Viewing the order listing **includes** merging or refreshing customer order data so cloud and local views stay consistent, and tracking pipeline changes **extends** with optional polling while the page stays visible so statuses do not go stale. The module exists so customers always see an accurate, readable picture of work in progress without managing technical sync details themselves.

---

### 3.4 Customer POS Configuration — Pricing and Fulfillment

The **POS configuration (pricing and fulfillment)** slice of the point-of-sale flow lets the **Customer** open the order modal with sensible defaults, choose cake flavor and dependent frosting and size tiers, change quantity with automatic total recalculation, pick a payment plan (full or fifty percent down), and choose pickup versus delivery. Selecting flavor **includes** rebuilding flavor-dependent frosting and pricing options, and choosing frosting and size **includes** applying the correct size tier to unit pricing. This keeps the configurable product and money side of an order consistent with catalog rules before design details or checkout.

---

### 3.5 Customer POS Configuration — Design, Date, and References

The **design, date, and reference** slice of the POS lets the **Customer** set the required consumption date, enter dedication and design instructions, upload multiple reference images, and remove individual files or clear all uploads. Uploading images **includes** validation of file types and cumulative size so storage and downstream review stay within system limits. Together these steps capture when the cake is needed and what it should look like, while protecting the application from invalid or oversized attachments.

---

### 3.6 Customer Cart, Checkout, and Confirmation

The **Cart, Checkout, and Confirmation** module is where the **Customer** adds a fully configured line to the cart, reviews lines and totals, places an order from the cart or directly, uploads a payment receipt, and confirms so the order is persisted. Placing the order **includes** validating checkout and attachment rules, uploading a receipt **includes** binding that file to the chosen order, and final confirmation **includes** the same validation path before the record is written. The purpose is a controlled handoff from configuration to a committed order with auditable proof of payment.

---

### 3.7 Customer Receipts and PDF Export

The **Receipts and PDF Export** portion supports post-order transparency for the **Customer**: previewing an uploaded receipt and generating printable PDFs for a single order or for the full order history with letterhead. Each PDF action **includes** rendering a print-ready layout so output matches shop branding and is suitable for archiving or printing. This gives customers confidence in what was paid and a paper trail without exposing internal admin tools.

---

### 3.8 Admin and Staff Access, Session, and Dashboard

The **Admin and Staff Access, Session, and Dashboard** area covers the separate admin authentication surface, optional admin registration, sign-in with role checks, navigation among Orders, Inventory, and Records, dashboard metrics, and logout. The **Admin/Staff** actor authenticates in a context that **includes** creating an admin session with role verification, and loading the dashboard **includes** surfacing pending-order and low-stock alerts so operators see risk before drilling into modules. The intent is a guarded back-office entry point and an operational snapshot aligned with how staff actually run the kitchen and front desk.

---

### 3.9 Admin and Staff Orders Management

The **Orders Management** module is the **Admin/Staff** control room for the pipeline: merged listings from available sources, status tab filters, pagination, rich order and design inspection, receipt verification, advancing stages, manual or cancellation updates, and miscellaneous stock-out during baking when supplies are consumed on an order. Loading the merged list **includes** merging and deduplicating cloud and local sources; advancing the pipeline or recording baking stock-out **includes** persisting status and any linked inventory side effects. The module keeps fulfillment auditable, reconciles duplicate feeds, and ties production deductions to real stock.

---

### 3.10 Admin and Staff Inventory Management

The **Inventory Management** module lets **Admin/Staff** switch between ingredients and miscellaneous stock, add items, search and paginate the catalog, edit metadata and images, save unit prices for costing, record stock-in and stock-out movements, watch low-stock and expiry signals, and delete lines when appropriate. Adding or editing items **includes** validating fields before save, while stock movements **includes** updating on-hand quantity and writing movement history so counts stay explainable. The goal is the same as in a classic inventory diagram: trustworthy stock levels, costing inputs, and early warning on shortages or expiry without ad hoc spreadsheets.

---

### 3.11 Admin and Staff Records Management

The **Records Management** module supports **Admin/Staff** in maintaining administrative logs across types such as purchases, sales, inventory audits, and end-of-day summaries: loading context, switching record-type tabs, applying date presets or custom ranges, text search, pagination, adding or editing permitted record types, viewing locked auto-generated audit or EOD rows, inspecting daily totals where applicable, and exporting the active type to a letterheaded PDF. Switching record type **includes** refetching data for the chosen filters, and export **includes** applying the letterhead print layout so external documents stay on-brand. This closes the loop between day-to-day operations and formal records suitable for review or compliance.
