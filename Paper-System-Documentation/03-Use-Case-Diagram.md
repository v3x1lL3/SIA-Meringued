# Use Case Diagram (Aligned with Revised Events Table)

For the paper appendix, **`02-Use-Case-Diagram.docx`** embeds **ten** UML-style illustrations (six customer areas and four admin modules) generated under `assets/use-case-*.svg` by `scripts/build_use_case_diagram_docx.py`, aligned with sections A–G of the use case list and events table. **`04-Use-Case-Diagrams-Context.md`** provides the same figures in prose (primary and supporting use cases, dependencies, asset paths, and list/events cross-references). **`05-Use-Case-Descriptions.md`** adds SRS-style paragraph descriptions per module.

This revised diagram follows the same module flow used in the updated events table and use case list:
- Access/Auth
- Customer POS + Checkout
- Customer Tracking/Export
- Admin Orders
- Admin Inventory
- Admin Records
- Shared synchronization/validation

```mermaid
flowchart LR
    C[Customer]
    A[Admin/Staff]
    SYS((Meringued Web System))

    %% ---------------- CUSTOMER ----------------
    C --> C1[Access Customer Login/Signup]
    C --> C2[Authenticate Customer Session]
    C --> C3[Open POS Order Form]
    C --> C4[Configure Flavor/Frosting/Size/Qty]
    C --> C5[Set Payment Plan and Delivery Mode]
    C --> C6[Upload Design References]
    C --> C7[Add to Cart / Place Order]
    C --> C8[Upload Payment Receipt]
    C --> C9[Track Order Status]
    C --> C10[View Receipt and Order Details]
    C --> C11[Export Single/All Orders PDF]
    C --> C12[Apply Orders Pagination]

    %% ---------------- ADMIN ----------------
    A --> A1[Access Admin Auth Page]
    A --> A2[Authenticate Admin Session]
    A --> A3[View Dashboard Metrics and Alerts]
    A --> A4[Manage Orders Module]
    A --> A5[Advance/Update Order Status]
    A --> A6[View Order Details and Receipts]
    A --> A7[Apply Orders Pagination]
    A --> A8[Manage Inventory Module]
    A --> A9[Stock In / Stock Out]
    A --> A10[Save Unit Price and Edit Item Details]
    A --> A11[Apply Inventory Pagination]
    A --> A12[Manage Records Module]
    A --> A13[Filter/Search Records]
    A --> A14[Apply Records Pagination]
    A --> A15[Export Records PDF]

    %% ---------------- INCLUDE / EXTEND RELATIONSHIPS ----------------
    C3 --> I1{{includes}}
    I1 --> C4
    C3 --> I2{{includes}}
    I2 --> C5
    C3 --> E1{{extends}}
    E1 --> C6
    C7 --> I3{{includes}}
    I3 --> C8

    A4 --> I4{{includes}}
    I4 --> A5
    A4 --> I5{{includes}}
    I5 --> A6
    A4 --> E2{{extends}}
    E2 --> A7

    A8 --> I6{{includes}}
    I6 --> A9
    A8 --> I7{{includes}}
    I7 --> A10
    A8 --> E3{{extends}}
    E3 --> A11

    A12 --> I8{{includes}}
    I8 --> A13
    A12 --> E4{{extends}}
    E4 --> A14
    A12 --> E5{{extends}}
    E5 --> A15

    %% ---------------- SYSTEM USAGE LINKS ----------------
    C1 -.uses.-> SYS
    C2 -.uses.-> SYS
    C3 -.uses.-> SYS
    C4 -.uses.-> SYS
    C5 -.uses.-> SYS
    C6 -.uses.-> SYS
    C7 -.uses.-> SYS
    C8 -.uses.-> SYS
    C9 -.uses.-> SYS
    C10 -.uses.-> SYS
    C11 -.uses.-> SYS
    C12 -.uses.-> SYS

    A1 -.uses.-> SYS
    A2 -.uses.-> SYS
    A3 -.uses.-> SYS
    A4 -.uses.-> SYS
    A5 -.uses.-> SYS
    A6 -.uses.-> SYS
    A7 -.uses.-> SYS
    A8 -.uses.-> SYS
    A9 -.uses.-> SYS
    A10 -.uses.-> SYS
    A11 -.uses.-> SYS
    A12 -.uses.-> SYS
    A13 -.uses.-> SYS
    A14 -.uses.-> SYS
    A15 -.uses.-> SYS
```

## Diagram Notes for Paper

- **Customer actor** covers authentication, POS configuration, checkout, receipt submission, tracking, and PDF export.
- **Admin/Staff actor** covers dashboard monitoring, order lifecycle control, inventory operations, records filtering, and document export (Word figures label this actor **Admin/Staff**; the Mermaid chart below uses the same label).
- **Pagination** is modeled explicitly as separate use cases for customer orders, admin orders, inventory, and records to reflect your updated UI behavior.
- **System node** represents shared services: role validation, data persistence, sync/merge logic, file validation, and export rendering.

