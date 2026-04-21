# Use Case Diagrams — Textual Context

> **Regeneration:** Running `scripts/build_use_case_diagram_docx.py` rewrites this file from the same `FIGURES` specification used for the SVG assets and Word export, so the narrative stays aligned with the diagrams.

This document supplements the graphical UML-style figures embedded in **`02-Use-Case-Diagram.docx`** (source SVGs under **`assets/`**). For tabular and narrative requirements, cross-check **`01-Events-Table.md`**, **`02-Use-Case-List.md`**, and the detailed flowchart in **`03-Use-Case-Diagram.md`**. For paragraph-style module narratives (actors, behaviors, includes/extends, purpose), see **`05-Use-Case-Descriptions.md`**.

## How to read connections (all figures)

| Drawing | Meaning |
|---------|---------|
| **Solid line** from the stick figure to an oval | **Association:** the actor participates in that primary use case. |
| **Dashed line** between ovals, labeled `<<include>>` | **Include:** the base use case (usually left) **always** brings in the supporting behavior (right). |
| **Dashed line** between ovals, labeled `<<extend>>` | **Extend:** the extension use case (right) **may** add behavior under conditions; the diagram still draws a dashed link from the **primary** oval toward the **supporting** oval to match the inventory reference layout. |

Below, each figure spells out **every** actor→use case link and **every** dashed dependency so you can trace the drawing line-by-line.

## Figure index

| # | Word / SVG focus | List / events alignment |
|---|------------------|-------------------------|
| 1 | Figure 1 — Customer: Access & Session | A.1 Access and Session — aligns with events table §A |
| 2 | Figure 2 — Customer: Dashboard & Order Visibility | A.2 Dashboard and Order Visibility — aligns with events table §B |
| 3 | Figure 3 — Customer: POS Configuration (Pricing & Fulfillment) | A.3 POS Configuration (pricing & fulfillment slice) — aligns with events table §C |
| 4 | Figure 4 — Customer: POS Design, Date & References | A.3 POS Configuration (design, date, media slice) — aligns with events table §C |
| 5 | Figure 5 — Customer: Cart, Checkout & Confirmation | A.4 Cart, Checkout, and Proof of Payment — aligns with events table §C |
| 6 | Figure 6 — Customer: Receipts & PDF Export | A.5 Logs, Receipts, and Exports — aligns with events table §D |
| 7 | Figure 7 — Admin/Staff: Access, Session & Dashboard | B.1–B.2 Admin Access and Dashboard — aligns with events table §A & §E (admin slice) |
| 8 | Figure 8 — Admin/Staff: Orders Management | B.3 Orders Management — aligns with events table §E |
| 9 | Figure 9 — Admin/Staff: Inventory Management | B.4 Inventory Management — aligns with events table §F (inventory slice) |
| 10 | Figure 10 — Admin/Staff: Records Management | B.5 Records Management — aligns with events table §F (records slice) |

---

## Figure 1 — Customer: Access & Session

- **List / events context:** A.1 Access and Session — aligns with events table §A
- **System boundary label (diagram title bar):** `Customer — Access & Session`
- **Actor:** `Customer`
- **Asset file:** `assets/use-case-c01-customer-access-session.svg`

### Connection guide (what is wired to what)

#### A. Actor → primary use case (**solid lines**)

- **`Customer`** —(solid line)→ **`View Landing & Navigate Modules`**
- **`Customer`** —(solid line)→ **`Start Customer Login / Signup Flow`**
- **`Customer`** —(solid line)→ **`Register Customer Account`**
- **`Customer`** —(solid line)→ **`Authenticate & Open Dashboard`**
- **`Customer`** —(solid line)→ **`Use Protected Customer Routes`**
- **`Customer`** —(solid line)→ **`Logout & Terminate Session`**

#### B. Primary → supporting (**dashed** `<<include>>` / `<<extend>>`)

- **`Authenticate & Open Dashboard`** —(dashed, <<include>>)→ **`Create Customer Session State`**
- **`Use Protected Customer Routes`** —(dashed, <<include>>)→ **`Enforce Role-Based Route Access`**

#### C. Primary use cases with **only** the actor link (no dashed stereotype in this figure)

These ovals still appear in the diagram and are reached by the stick figure, but they are **not** the source of an `<<include>>` or `<<extend>>` arrow in this particular figure:

- `View Landing & Navigate Modules`
- `Start Customer Login / Signup Flow`
- `Register Customer Account`
- `Logout & Terminate Session`

### Primary use cases (reference list)

1. View Landing & Navigate Modules
2. Start Customer Login / Signup Flow
3. Register Customer Account
4. Authenticate & Open Dashboard
5. Use Protected Customer Routes
6. Logout & Terminate Session

### Supporting use cases (reference list)

1. Enforce Role-Based Route Access
2. Create Customer Session State

## Figure 2 — Customer: Dashboard & Order Visibility

- **List / events context:** A.2 Dashboard and Order Visibility — aligns with events table §B
- **System boundary label (diagram title bar):** `Customer — Dashboard & Orders`
- **Actor:** `Customer`
- **Asset file:** `assets/use-case-c02-customer-dashboard-orders.svg`

### Connection guide (what is wired to what)

#### A. Actor → primary use case (**solid lines**)

- **`Customer`** —(solid line)→ **`Load Dashboard Summary`**
- **`Customer`** —(solid line)→ **`View Active Order Listing`**
- **`Customer`** —(solid line)→ **`Track Pipeline Status Changes`**
- **`Customer`** —(solid line)→ **`Open Order Details Modal`**
- **`Customer`** —(solid line)→ **`Apply Customer Order Pagination`**

#### B. Primary → supporting (**dashed** `<<include>>` / `<<extend>>`)

- **`View Active Order Listing`** —(dashed, <<include>>)→ **`Merge / Refresh Customer Order Data`**
- **`Track Pipeline Status Changes`** —(dashed, <<extend>>)→ **`Poll Status While Page Visible`**

#### C. Primary use cases with **only** the actor link (no dashed stereotype in this figure)

These ovals still appear in the diagram and are reached by the stick figure, but they are **not** the source of an `<<include>>` or `<<extend>>` arrow in this particular figure:

- `Load Dashboard Summary`
- `Open Order Details Modal`
- `Apply Customer Order Pagination`

### Primary use cases (reference list)

1. Load Dashboard Summary
2. View Active Order Listing
3. Track Pipeline Status Changes
4. Open Order Details Modal
5. Apply Customer Order Pagination

### Supporting use cases (reference list)

1. Merge / Refresh Customer Order Data
2. Poll Status While Page Visible

## Figure 3 — Customer: POS Configuration (Pricing & Fulfillment)

- **List / events context:** A.3 POS Configuration (pricing & fulfillment slice) — aligns with events table §C
- **System boundary label (diagram title bar):** `Customer — POS: Pricing & Fulfillment`
- **Actor:** `Customer`
- **Asset file:** `assets/use-case-c03-customer-pos-pricing.svg`

### Connection guide (what is wired to what)

#### A. Actor → primary use case (**solid lines**)

- **`Customer`** —(solid line)→ **`Open POS Modal & Initialize Defaults`**
- **`Customer`** —(solid line)→ **`Select Cake Flavor & Dependent Options`**
- **`Customer`** —(solid line)→ **`Select Frosting & Small/Med/Large Tier`**
- **`Customer`** —(solid line)→ **`Update Quantity & Recalculate Totals`**
- **`Customer`** —(solid line)→ **`Configure Payment Plan (Full or 50%)`**
- **`Customer`** —(solid line)→ **`Configure Pickup or Delivery Mode`**

#### B. Primary → supporting (**dashed** `<<include>>` / `<<extend>>`)

- **`Select Cake Flavor & Dependent Options`** —(dashed, <<include>>)→ **`Rebuild Frosting Options by Flavor`**
- **`Select Frosting & Small/Med/Large Tier`** —(dashed, <<include>>)→ **`Apply Size Tier to Unit Pricing`**

#### C. Primary use cases with **only** the actor link (no dashed stereotype in this figure)

These ovals still appear in the diagram and are reached by the stick figure, but they are **not** the source of an `<<include>>` or `<<extend>>` arrow in this particular figure:

- `Open POS Modal & Initialize Defaults`
- `Update Quantity & Recalculate Totals`
- `Configure Payment Plan (Full or 50%)`
- `Configure Pickup or Delivery Mode`

### Primary use cases (reference list)

1. Open POS Modal & Initialize Defaults
2. Select Cake Flavor & Dependent Options
3. Select Frosting & Small/Med/Large Tier
4. Update Quantity & Recalculate Totals
5. Configure Payment Plan (Full or 50%)
6. Configure Pickup or Delivery Mode

### Supporting use cases (reference list)

1. Rebuild Frosting Options by Flavor
2. Apply Size Tier to Unit Pricing

## Figure 4 — Customer: POS Design, Date & References

- **List / events context:** A.3 POS Configuration (design, date, media slice) — aligns with events table §C
- **System boundary label (diagram title bar):** `Customer — POS: Design & Media`
- **Actor:** `Customer`
- **Asset file:** `assets/use-case-c04-customer-pos-design.svg`

### Connection guide (what is wired to what)

#### A. Actor → primary use case (**solid lines**)

- **`Customer`** —(solid line)→ **`Set Required Consumption Date`**
- **`Customer`** —(solid line)→ **`Capture Dedication & Design Instructions`**
- **`Customer`** —(solid line)→ **`Upload Multiple Design Reference Images`**
- **`Customer`** —(solid line)→ **`Remove One Image or Clear All Uploads`**

#### B. Primary → supporting (**dashed** `<<include>>` / `<<extend>>`)

- **`Upload Multiple Design Reference Images`** —(dashed, <<include>>)→ **`Validate File Types & Cumulative Size`**

#### C. Primary use cases with **only** the actor link (no dashed stereotype in this figure)

These ovals still appear in the diagram and are reached by the stick figure, but they are **not** the source of an `<<include>>` or `<<extend>>` arrow in this particular figure:

- `Set Required Consumption Date`
- `Capture Dedication & Design Instructions`
- `Remove One Image or Clear All Uploads`

### Primary use cases (reference list)

1. Set Required Consumption Date
2. Capture Dedication & Design Instructions
3. Upload Multiple Design Reference Images
4. Remove One Image or Clear All Uploads

### Supporting use cases (reference list)

1. Validate File Types & Cumulative Size

## Figure 5 — Customer: Cart, Checkout & Confirmation

- **List / events context:** A.4 Cart, Checkout, and Proof of Payment — aligns with events table §C
- **System boundary label (diagram title bar):** `Customer — Cart & Checkout`
- **Actor:** `Customer`
- **Asset file:** `assets/use-case-c05-customer-cart-checkout.svg`

### Connection guide (what is wired to what)

#### A. Actor → primary use case (**solid lines**)

- **`Customer`** —(solid line)→ **`Add Configured Order to Cart`**
- **`Customer`** —(solid line)→ **`Review Cart Lines & Computed Totals`**
- **`Customer`** —(solid line)→ **`Place Order from Cart or Directly`**
- **`Customer`** —(solid line)→ **`Upload Payment Receipt File`**
- **`Customer`** —(solid line)→ **`Confirm Order & Persist Order Record`**

#### B. Primary → supporting (**dashed** `<<include>>` / `<<extend>>`)

- **`Place Order from Cart or Directly`** —(dashed, <<include>>)→ **`Validate Checkout & Attachment Rules`**
- **`Upload Payment Receipt File`** —(dashed, <<include>>)→ **`Bind Receipt to Target Order`**
- **`Confirm Order & Persist Order Record`** —(dashed, <<include>>)→ **`Validate Checkout & Attachment Rules`**

#### C. Primary use cases with **only** the actor link (no dashed stereotype in this figure)

These ovals still appear in the diagram and are reached by the stick figure, but they are **not** the source of an `<<include>>` or `<<extend>>` arrow in this particular figure:

- `Add Configured Order to Cart`
- `Review Cart Lines & Computed Totals`

### Primary use cases (reference list)

1. Add Configured Order to Cart
2. Review Cart Lines & Computed Totals
3. Place Order from Cart or Directly
4. Upload Payment Receipt File
5. Confirm Order & Persist Order Record

### Supporting use cases (reference list)

1. Validate Checkout & Attachment Rules
2. Bind Receipt to Target Order

## Figure 6 — Customer: Receipts & PDF Export

- **List / events context:** A.5 Logs, Receipts, and Exports — aligns with events table §D
- **System boundary label (diagram title bar):** `Customer — Receipts & PDFs`
- **Actor:** `Customer`
- **Asset file:** `assets/use-case-c06-customer-exports.svg`

### Connection guide (what is wired to what)

#### A. Actor → primary use case (**solid lines**)

- **`Customer`** —(solid line)→ **`Preview Uploaded Receipt`**
- **`Customer`** —(solid line)→ **`Download Single-Order Printable PDF`**
- **`Customer`** —(solid line)→ **`Download All-Orders PDF with Letterhead`**

#### B. Primary → supporting (**dashed** `<<include>>` / `<<extend>>`)

- **`Download Single-Order Printable PDF`** —(dashed, <<include>>)→ **`Render Print-Ready PDF Layout`**
- **`Download All-Orders PDF with Letterhead`** —(dashed, <<include>>)→ **`Render Print-Ready PDF Layout`**

#### C. Primary use cases with **only** the actor link (no dashed stereotype in this figure)

These ovals still appear in the diagram and are reached by the stick figure, but they are **not** the source of an `<<include>>` or `<<extend>>` arrow in this particular figure:

- `Preview Uploaded Receipt`

### Primary use cases (reference list)

1. Preview Uploaded Receipt
2. Download Single-Order Printable PDF
3. Download All-Orders PDF with Letterhead

### Supporting use cases (reference list)

1. Render Print-Ready PDF Layout

## Figure 7 — Admin/Staff: Access, Session & Dashboard

- **List / events context:** B.1–B.2 Admin Access and Dashboard — aligns with events table §A & §E (admin slice)
- **System boundary label (diagram title bar):** `Admin — Access & Dashboard`
- **Actor:** `Admin/Staff`
- **Asset file:** `assets/use-case-a01-admin-access-dashboard.svg`

### Connection guide (what is wired to what)

#### A. Actor → primary use case (**solid lines**)

- **`Admin/Staff`** —(solid line)→ **`Open Admin Authentication Page`**
- **`Admin/Staff`** —(solid line)→ **`Register Admin Account`**
- **`Admin/Staff`** —(solid line)→ **`Authenticate Admin Session`**
- **`Admin/Staff`** —(solid line)→ **`Access Admin Modules by Role`**
- **`Admin/Staff`** —(solid line)→ **`Logout Admin Session`**
- **`Admin/Staff`** —(solid line)→ **`Load Dashboard Metrics & Alerts`**
- **`Admin/Staff`** —(solid line)→ **`Navigate Orders / Inventory / Records`**

#### B. Primary → supporting (**dashed** `<<include>>` / `<<extend>>`)

- **`Authenticate Admin Session`** —(dashed, <<include>>)→ **`Create Admin Session with Role Check`**
- **`Load Dashboard Metrics & Alerts`** —(dashed, <<include>>)→ **`Show Pending Orders & Low-Stock Alerts`**

#### C. Primary use cases with **only** the actor link (no dashed stereotype in this figure)

These ovals still appear in the diagram and are reached by the stick figure, but they are **not** the source of an `<<include>>` or `<<extend>>` arrow in this particular figure:

- `Open Admin Authentication Page`
- `Register Admin Account`
- `Access Admin Modules by Role`
- `Logout Admin Session`
- `Navigate Orders / Inventory / Records`

### Primary use cases (reference list)

1. Open Admin Authentication Page
2. Register Admin Account
3. Authenticate Admin Session
4. Access Admin Modules by Role
5. Logout Admin Session
6. Load Dashboard Metrics & Alerts
7. Navigate Orders / Inventory / Records

### Supporting use cases (reference list)

1. Create Admin Session with Role Check
2. Show Pending Orders & Low-Stock Alerts

## Figure 8 — Admin/Staff: Orders Management

- **List / events context:** B.3 Orders Management — aligns with events table §E
- **System boundary label (diagram title bar):** `Admin — Orders Management`
- **Actor:** `Admin/Staff`
- **Asset file:** `assets/use-case-a02-admin-orders.svg`

### Connection guide (what is wired to what)

#### A. Actor → primary use case (**solid lines**)

- **`Admin/Staff`** —(solid line)→ **`Load Merged Admin Order List`**
- **`Admin/Staff`** —(solid line)→ **`Filter Orders by Status Tabs`**
- **`Admin/Staff`** —(solid line)→ **`Paginate Admin Orders List`**
- **`Admin/Staff`** —(solid line)→ **`View Order Details & Design Media`**
- **`Admin/Staff`** —(solid line)→ **`Verify Customer Payment Receipt`**
- **`Admin/Staff`** —(solid line)→ **`Advance Order Through Pipeline Stages`**
- **`Admin/Staff`** —(solid line)→ **`Manual Status Update or Cancellation`**
- **`Admin/Staff`** —(solid line)→ **`Execute Baking Misc Stock-Out`**

#### B. Primary → supporting (**dashed** `<<include>>` / `<<extend>>`)

- **`Load Merged Admin Order List`** —(dashed, <<include>>)→ **`Merge & Deduplicate Cloud / Local Sources`**
- **`Advance Order Through Pipeline Stages`** —(dashed, <<include>>)→ **`Persist Status & Inventory Side Effects`**
- **`Execute Baking Misc Stock-Out`** —(dashed, <<include>>)→ **`Persist Status & Inventory Side Effects`**

#### C. Primary use cases with **only** the actor link (no dashed stereotype in this figure)

These ovals still appear in the diagram and are reached by the stick figure, but they are **not** the source of an `<<include>>` or `<<extend>>` arrow in this particular figure:

- `Filter Orders by Status Tabs`
- `Paginate Admin Orders List`
- `View Order Details & Design Media`
- `Verify Customer Payment Receipt`
- `Manual Status Update or Cancellation`

### Primary use cases (reference list)

1. Load Merged Admin Order List
2. Filter Orders by Status Tabs
3. Paginate Admin Orders List
4. View Order Details & Design Media
5. Verify Customer Payment Receipt
6. Advance Order Through Pipeline Stages
7. Manual Status Update or Cancellation
8. Execute Baking Misc Stock-Out

### Supporting use cases (reference list)

1. Merge & Deduplicate Cloud / Local Sources
2. Persist Status & Inventory Side Effects

## Figure 9 — Admin/Staff: Inventory Management

- **List / events context:** B.4 Inventory Management — aligns with events table §F (inventory slice)
- **System boundary label (diagram title bar):** `Admin — Inventory Management`
- **Actor:** `Admin/Staff`
- **Asset file:** `assets/use-case-a03-admin-inventory.svg`

### Connection guide (what is wired to what)

#### A. Actor → primary use case (**solid lines**)

- **`Admin/Staff`** —(solid line)→ **`Switch Ingredients / Miscellaneous Tab`**
- **`Admin/Staff`** —(solid line)→ **`Add New Inventory Item`**
- **`Admin/Staff`** —(solid line)→ **`Search Inventory by Item Name`**
- **`Admin/Staff`** —(solid line)→ **`Paginate Inventory List`**
- **`Admin/Staff`** —(solid line)→ **`Edit Item Metadata & Image`**
- **`Admin/Staff`** —(solid line)→ **`Save Unit Price for Costing`**
- **`Admin/Staff`** —(solid line)→ **`Record Stock-In Movement`**
- **`Admin/Staff`** —(solid line)→ **`Record Stock-Out Movement`**
- **`Admin/Staff`** —(solid line)→ **`View Low-Stock & Expiry Notices`**
- **`Admin/Staff`** —(solid line)→ **`Delete Inventory Item`**

#### B. Primary → supporting (**dashed** `<<include>>` / `<<extend>>`)

- **`Add New Inventory Item`** —(dashed, <<include>>)→ **`Validate Item Fields on Save`**
- **`Edit Item Metadata & Image`** —(dashed, <<include>>)→ **`Validate Item Fields on Save`**
- **`Record Stock-In Movement`** —(dashed, <<include>>)→ **`Update Quantity & Movement Log`**
- **`Record Stock-Out Movement`** —(dashed, <<include>>)→ **`Update Quantity & Movement Log`**

#### C. Primary use cases with **only** the actor link (no dashed stereotype in this figure)

These ovals still appear in the diagram and are reached by the stick figure, but they are **not** the source of an `<<include>>` or `<<extend>>` arrow in this particular figure:

- `Switch Ingredients / Miscellaneous Tab`
- `Search Inventory by Item Name`
- `Paginate Inventory List`
- `Save Unit Price for Costing`
- `View Low-Stock & Expiry Notices`
- `Delete Inventory Item`

### Primary use cases (reference list)

1. Switch Ingredients / Miscellaneous Tab
2. Add New Inventory Item
3. Search Inventory by Item Name
4. Paginate Inventory List
5. Edit Item Metadata & Image
6. Save Unit Price for Costing
7. Record Stock-In Movement
8. Record Stock-Out Movement
9. View Low-Stock & Expiry Notices
10. Delete Inventory Item

### Supporting use cases (reference list)

1. Validate Item Fields on Save
2. Update Quantity & Movement Log

## Figure 10 — Admin/Staff: Records Management

- **List / events context:** B.5 Records Management — aligns with events table §F (records slice)
- **System boundary label (diagram title bar):** `Admin — Records Management`
- **Actor:** `Admin/Staff`
- **Asset file:** `assets/use-case-a04-admin-records.svg`

### Connection guide (what is wired to what)

#### A. Actor → primary use case (**solid lines**)

- **`Admin/Staff`** —(solid line)→ **`Load Records Module by Context`**
- **`Admin/Staff`** —(solid line)→ **`Switch Record Type Tabs`**
- **`Admin/Staff`** —(solid line)→ **`Apply Date Preset or Custom Range`**
- **`Admin/Staff`** —(solid line)→ **`Search Title / Reference / Notes`**
- **`Admin/Staff`** —(solid line)→ **`Paginate Records List`**
- **`Admin/Staff`** —(solid line)→ **`Add or Edit Allowed Record Types`**
- **`Admin/Staff`** —(solid line)→ **`View Locked Audit / EOD Entries`**
- **`Admin/Staff`** —(solid line)→ **`View Daily Totals Where Applicable`**
- **`Admin/Staff`** —(solid line)→ **`Export Active Record Type to PDF`**

#### B. Primary → supporting (**dashed** `<<include>>` / `<<extend>>`)

- **`Switch Record Type Tabs`** —(dashed, <<include>>)→ **`Refetch Dataset for Type & Filters`**
- **`Export Active Record Type to PDF`** —(dashed, <<include>>)→ **`Apply Letterhead to Print Export`**

#### C. Primary use cases with **only** the actor link (no dashed stereotype in this figure)

These ovals still appear in the diagram and are reached by the stick figure, but they are **not** the source of an `<<include>>` or `<<extend>>` arrow in this particular figure:

- `Load Records Module by Context`
- `Apply Date Preset or Custom Range`
- `Search Title / Reference / Notes`
- `Paginate Records List`
- `Add or Edit Allowed Record Types`
- `View Locked Audit / EOD Entries`
- `View Daily Totals Where Applicable`

### Primary use cases (reference list)

1. Load Records Module by Context
2. Switch Record Type Tabs
3. Apply Date Preset or Custom Range
4. Search Title / Reference / Notes
5. Paginate Records List
6. Add or Edit Allowed Record Types
7. View Locked Audit / EOD Entries
8. View Daily Totals Where Applicable
9. Export Active Record Type to PDF

### Supporting use cases (reference list)

1. Refetch Dataset for Type & Filters
2. Apply Letterhead to Print Export

## Shared / system behavior

Cross-cutting behaviors from **`02-Use-Case-List.md` § C** (route guards, merge/dedupe, payload limits, pagination state, validation) appear partly as supporting use cases on the diagrams and partly as implementation detail behind the events in **`01-Events-Table.md` § G**.

