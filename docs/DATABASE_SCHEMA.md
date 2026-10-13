# ShopBilling Database Schema & Relational Specifications

## 1. Engine & Storage Configuration
- **Database Engine:** SQLite 3.39+ via `System.Data.SQLite`
- **Location:** `%LocalAppData%\ShopBilling\Data\shopbilling.db`
- **Concurrency Mode:** WAL (`Write-Ahead Logging`), `PRAGMA synchronous = NORMAL`
- **Referential Integrity:** Enabled via `PRAGMA foreign_keys = ON`

---

## 2. Relational Schema & Tables

### `products`
The core inventory catalog table supporting 50,000+ items:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Surrogate unique integer |
| `product_code` | TEXT | UNIQUE NOT NULL COLLATE NOCASE | Alphanumeric product SKU |
| `barcode` | TEXT | UNIQUE NOT NULL COLLATE NOCASE | EAN-13, Code 128, or UPC barcode |
| `name_en` | TEXT | NOT NULL COLLATE NOCASE | Product name in English |
| `name_ta` | TEXT | COLLATE NOCASE | Product name in Tamil (Unicode UTF-8) |
| `category_id` | INTEGER | FOREIGN KEY -> categories(id) | Nullable link to category |
| `subcategory_id` | INTEGER | FOREIGN KEY -> subcategories(id) | Nullable link to subcategory |
| `brand_id` | INTEGER | FOREIGN KEY -> brands(id) | Nullable link to brand |
| `unit` | TEXT | NOT NULL DEFAULT 'PCS' | Unit of measurement |
| `hsn_code` | TEXT | NULL | GST HSN / SAC Code |
| `purchase_rate` | REAL | NOT NULL DEFAULT 0.0 | Wholesale cost price |
| `sale_rate` | REAL | NOT NULL DEFAULT 0.0 | Retail customer selling price |
| `wholesale_rate` | REAL | NOT NULL DEFAULT 0.0 | Bulk sale price |
| `mrp` | REAL | NOT NULL DEFAULT 0.0 | Maximum retail price stamped on pack |
| `tax_rate` | REAL | NOT NULL DEFAULT 0.0 | GST slab (0, 5, 12, 18, 28) |
| `opening_stock` | REAL | NOT NULL DEFAULT 0.0 | Initial starting stock |
| `current_stock` | REAL | NOT NULL DEFAULT 0.0 | Real-time on-hand stock |
| `reorder_level` | REAL | NOT NULL DEFAULT 5.0 | Minimum threshold triggering reorder alert |
| `max_stock_level` | REAL | NOT NULL DEFAULT 1000.0 | Maximum inventory capacity |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | 1 = Active, 0 = Deactivated |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp of creation |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp of last modification |

### `categories`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Primary Key |
| `code` | TEXT | UNIQUE NOT NULL | Category identifier code |
| `name` | TEXT | NOT NULL COLLATE NOCASE | Display name |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | Active flag |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record timestamp |

### `subcategories`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Primary Key |
| `category_id` | INTEGER | NOT NULL, FOREIGN KEY | Parent category reference |
| `code` | TEXT | NOT NULL | Subcategory code |
| `name` | TEXT | NOT NULL COLLATE NOCASE | Subcategory display name |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | Active flag |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record timestamp |

### `brands`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Primary Key |
| `code` | TEXT | UNIQUE NOT NULL | Brand code |
| `name` | TEXT | NOT NULL COLLATE NOCASE | Brand trade name |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | Active flag |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record timestamp |

### `schema_migrations`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `version` | INTEGER | PRIMARY KEY | Version index number |
| `description` | TEXT | NOT NULL | Summary of migration patch |
| `applied_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp when executed |

### `audit_logs`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Primary Key |
| `entity` | TEXT | NOT NULL | Entity name (Product, Category, Supplier, Purchase, etc.) |
| `entity_id` | TEXT | NULL | Target ID affected |
| `action` | TEXT | NOT NULL | INSERT, UPDATE, DEACTIVATE, IMPORT |
| `details` | TEXT | NULL | Operational summary |
| `timestamp` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp |

---

## 3. Phase 2 Relational Tables (Suppliers & Inbound Goods)

### `suppliers`
Wholesale vendors and distributors table:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique integer identifier |
| `code` | TEXT | UNIQUE NOT NULL COLLATE NOCASE | Supplier code (e.g. `SUP001`) |
| `name` | TEXT | NOT NULL COLLATE NOCASE | Business / trading name |
| `contact_person`| TEXT | NULL | Representative contact name |
| `mobile` | TEXT | NULL | 10-digit primary mobile number |
| `alt_mobile` | TEXT | NULL | Alternate phone / landline |
| `whatsapp` | TEXT | NULL | WhatsApp contact number |
| `email` | TEXT | NULL | Email address |
| `gstin` | TEXT | NULL | 15-character GSTIN |
| `pan` | TEXT | NULL | Permanent Account Number |
| `address` | TEXT | NULL | Door and street address |
| `city` | TEXT | NULL | City name |
| `state` | TEXT | NULL | State (Default: 'Tamil Nadu') |
| `state_code` | TEXT | NULL | GST state code (Default: '33') |
| `pin_code` | TEXT | NULL | Postal PIN code |
| `opening_balance` | REAL | NOT NULL DEFAULT 0.0 | Initial starting payable balance |
| `current_balance` | REAL | NOT NULL DEFAULT 0.0 | Real-time calculated payable |
| `payment_terms` | TEXT | NULL | Credit terms (e.g. '30 Days Net') |
| `notes` | TEXT | NULL | Internal remarks |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | 1 = Active, 0 = Inactive |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Update timestamp |

### `purchases`
Purchase header recording goods received vouchers and bills:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique identifier |
| `purchase_number` | TEXT | UNIQUE NOT NULL COLLATE NOCASE | Voucher number (e.g. `PUR-2026-0001`) |
| `supplier_id` | INTEGER | NOT NULL, FOREIGN KEY -> suppliers(id) | Associated vendor |
| `supplier_invoice_number` | TEXT | NULL | Vendor's physical bill number |
| `supplier_invoice_date` | DATETIME | NULL | Invoice billing date |
| `goodsReceivedDate` | DATETIME | NOT NULL | Date stock physical entered store |
| `purchase_type` | TEXT | NOT NULL DEFAULT 'Credit' | 'Credit' or 'Cash' |
| `payment_due_date` | DATETIME | NULL | Payment due deadline if credit |
| `reference_number` | TEXT | NULL | E-Way Bill / DC / Challan number |
| `notes` | TEXT | NULL | Delivery and inspection notes |
| `status` | TEXT | NOT NULL DEFAULT 'Draft' | 'Draft', 'Confirmed', 'Cancelled' |
| `total_qty` | REAL | NOT NULL DEFAULT 0.0 | Sum of standard line item quantities |
| `total_free_qty` | REAL | NOT NULL DEFAULT 0.0 | Sum of free bonus/scheme quantities |
| `gross_amount` | REAL | NOT NULL DEFAULT 0.0 | Gross sum before discounts |
| `item_discount` | REAL | NOT NULL DEFAULT 0.0 | Total item-level discounts |
| `additional_discount` | REAL | NOT NULL DEFAULT 0.0 | Invoice-level flat discount |
| `taxable_amount` | REAL | NOT NULL DEFAULT 0.0 | Net taxable value |
| `tax_amount` | REAL | NOT NULL DEFAULT 0.0 | Total GST tax amount |
| `additional_charges` | REAL | NOT NULL DEFAULT 0.0 | Freight, packing, delivery charges |
| `round_off` | REAL | NOT NULL DEFAULT 0.0 | Round off adjustment |
| `grand_total` | REAL | NOT NULL DEFAULT 0.0 | Net payable invoice amount |
| `amount_paid` | REAL | NOT NULL DEFAULT 0.0 | Amount paid upon goods receipt |
| `balance_due` | REAL | NOT NULL DEFAULT 0.0 | Remaining payable balance |
| `created_by` | TEXT | DEFAULT 'Admin' | User who recorded entry |
| `confirmed_at` | DATETIME | NULL | Timestamp when stock confirmed |
| `cancelled_at` | DATETIME | NULL | Timestamp if voucher was cancelled |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Created timestamp |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Updated timestamp |

### `purchase_items`
Individual line items inside each purchase bill:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Primary Key |
| `purchase_id` | INTEGER | NOT NULL, FOREIGN KEY -> purchases(id) ON DELETE CASCADE | Parent purchase header |
| `product_id` | INTEGER | NOT NULL, FOREIGN KEY -> products(id) ON DELETE RESTRICT | Product catalog reference |
| `quantity` | REAL | NOT NULL | Inward quantity billed |
| `free_quantity` | REAL | NOT NULL DEFAULT 0.0 | Bonus / free quantity received |
| `purchase_rate` | REAL | NOT NULL | Unit purchase cost price |
| `discount_percent` | REAL | NOT NULL DEFAULT 0.0 | Item discount percentage |
| `discount_amount` | REAL | NOT NULL DEFAULT 0.0 | Calculated discount value |
| `tax_rate` | REAL | NOT NULL DEFAULT 0.0 | GST rate percentage |
| `taxable_amount` | REAL | NOT NULL DEFAULT 0.0 | Taxable subtotal |
| `tax_amount` | REAL | NOT NULL DEFAULT 0.0 | Calculated tax |
| `line_total` | REAL | NOT NULL DEFAULT 0.0 | Final line total |
| `batch_number` | TEXT | NULL | Manufacturer batch lot number |
| `expiry_date` | DATETIME | NULL | Batch expiration date |

### `stock_movements`
Permanent audit ledger tracking every single stock delta:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique movement sequence |
| `product_id` | INTEGER | NOT NULL, FOREIGN KEY -> products(id) | Affected product |
| `reference_type` | TEXT | NOT NULL | `PURCHASE_CONFIRM`, `PURCHASE_CANCEL`, `ADJUSTMENT` |
| `reference_id` | TEXT | NOT NULL | Invoice or transaction ID |
| `quantity` | REAL | NOT NULL | Delta (+ positive inward, - negative reversion) |
| `quantity_before` | REAL | NOT NULL | Opening stock before transaction |
| `quantity_after` | REAL | NOT NULL | Final closing stock after transaction |
| `notes` | TEXT | NULL | Explanation note |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp |

### `supplier_payments`
Payments made to wholesale suppliers:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique payment ID |
| `payment_number` | TEXT | UNIQUE NOT NULL COLLATE NOCASE | Payment receipt # (e.g. `PAY-2026-0001`) |
| `supplier_id` | INTEGER | NOT NULL, FOREIGN KEY -> suppliers(id) | Target supplier |
| `purchase_id` | INTEGER | NULL, FOREIGN KEY -> purchases(id) | Associated purchase bill (optional) |
| `payment_date` | DATETIME | NOT NULL | Transaction date |
| `payment_method` | TEXT | NOT NULL DEFAULT 'Cash' | Cash, Bank Transfer, UPI, Cheque |
| `amount` | REAL | NOT NULL | Amount paid |
| `reference_number` | TEXT | NULL | Bank UTR / NEFT / Cheque # |
| `notes` | TEXT | NULL | Payment remarks |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record timestamp |

### `supplier_ledger`
Financial double-entry audit statement for each vendor:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique ledger entry |
| `supplier_id` | INTEGER | NOT NULL, FOREIGN KEY -> suppliers(id) | Associated supplier |
| `transaction_type` | TEXT | NOT NULL | `OPENING_BALANCE`, `PURCHASE`, `PAYMENT`, `PURCHASE_CANCEL` |
| `reference_id` | TEXT | NOT NULL | Voucher / bill number |
| `debit` | REAL | NOT NULL DEFAULT 0.0 | Payments (decrease payable) |
| `credit` | REAL | NOT NULL DEFAULT 0.0 | Purchases (increase payable) |
| `balance_after` | REAL | NOT NULL DEFAULT 0.0 | Running closing balance payable |
| `notes` | TEXT | NULL | Particulars / description |
| `transaction_date` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Date |

---

## 4. Phase 3 Relational Tables (Stock Management & Audit Reconciliation)

### `stock_adjustments`
Header record for manual inventory corrections, damaged goods, and wastage:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique adjustment record ID |
| `adjustment_number` | TEXT | UNIQUE NOT NULL COLLATE NOCASE | Voucher identifier (e.g. `ADJ-2026-0001`) |
| `adjustment_date` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | Date of voucher |
| `reason` | TEXT | NOT NULL | Mandatory justification for stock alteration |
| `notes` | TEXT | NULL | Approvals / remarks |
| `status` | TEXT | NOT NULL DEFAULT 'Draft' | `Draft`, `Confirmed`, `Cancelled` |
| `total_items` | INTEGER | NOT NULL DEFAULT 0 | Count of distinct line items |
| `total_difference_quantity` | REAL | NOT NULL DEFAULT 0.0 | Net sum of unit discrepancies |
| `total_cost_impact` | REAL | NOT NULL DEFAULT 0.0 | Net cost value change in inventory |
| `created_by` | TEXT | DEFAULT 'Admin' | System operator |
| `confirmed_at` | DATETIME | NULL | Timestamp when stock changes were committed |
| `cancelled_at` | DATETIME | NULL | Timestamp if voucher was reverted |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last modified |

### `stock_adjustment_items`
Individual product line adjustments:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique item ID |
| `adjustment_id` | INTEGER | NOT NULL, FOREIGN KEY -> stock_adjustments(id) | Parent adjustment voucher |
| `product_id` | INTEGER | NOT NULL, FOREIGN KEY -> products(id) | Item being adjusted |
| `current_stock` | REAL | NOT NULL | Baseline system stock prior to adjustment |
| `physical_count` | REAL | NOT NULL | Counted / targeted stock quantity |
| `difference_quantity` | REAL | NOT NULL | Physical Count minus Baseline |
| `adjustment_type` | TEXT | NOT NULL | Increase, Decrease, Damaged, Expired, Physical Count |
| `unit_cost` | REAL | NOT NULL DEFAULT 0.0 | Purchase rate applied for cost calculation |
| `reason` | TEXT | NULL | Item-level notes |

### `physical_verifications`
Full warehouse audit and count session vouchers:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique audit session ID |
| `verification_number` | TEXT | UNIQUE NOT NULL COLLATE NOCASE | Audit identifier (e.g. `VER-2026-0001`) |
| `verification_date` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | Audit date |
| `category_id` | INTEGER | NULL, FOREIGN KEY -> categories(id) | Category scope (NULL = All) |
| `status` | TEXT | NOT NULL DEFAULT 'Draft' | `Draft`, `Confirmed`, `Cancelled` |
| `total_counted_products` | INTEGER | NOT NULL DEFAULT 0 | Items audited |
| `total_discrepancies` | INTEGER | NOT NULL DEFAULT 0 | Items where Physical != System |
| `net_difference_quantity` | REAL | NOT NULL DEFAULT 0.0 | Net discrepancy quantity |
| `notes` | TEXT | NULL | Audit team notes |
| `created_by` | TEXT | DEFAULT 'Admin' | Auditor |
| `confirmed_at` | DATETIME | NULL | Reconciled timestamp |

### `physical_verification_items`
Audit line records:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Primary Key |
| `verification_id` | INTEGER | NOT NULL, FOREIGN KEY -> physical_verifications(id) | Parent audit session |
| `product_id` | INTEGER | NOT NULL, FOREIGN KEY -> products(id) | Target product |
| `system_stock_at_start` | REAL | NOT NULL | Baseline system stock recorded |
| `system_stock_at_confirm` | REAL | NOT NULL DEFAULT 0.0 | Stock verified prior to reconciliation commit |
| `physical_count` | REAL | NOT NULL | Shelf audited count |
| `difference_quantity` | REAL | NOT NULL | Physical Count minus System Stock |
| `discrepancy_resolved` | INTEGER | NOT NULL DEFAULT 0 | 1 = Applied to live stock, 0 = Pending |

---

## 5. Performance Indexes
```sql
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_code ON products(product_code);
CREATE INDEX idx_products_name_en ON products(name_en);
CREATE INDEX idx_products_name_ta ON products(name_ta);
CREATE INDEX idx_products_category ON products(category_id, is_active);
CREATE INDEX idx_products_brand ON products(brand_id, is_active);
CREATE INDEX idx_products_stock_alert ON products(current_stock, reorder_level, is_active);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);

-- Phase 2 Indexes
CREATE INDEX idx_suppliers_code ON suppliers(code);
CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_suppliers_mobile ON suppliers(mobile);
CREATE INDEX idx_suppliers_gstin ON suppliers(gstin);
CREATE INDEX idx_purchases_number ON purchases(purchase_number);
CREATE INDEX idx_purchases_supplier ON purchases(supplier_id, status);
CREATE INDEX idx_purchases_invoice ON purchases(supplier_invoice_number);
CREATE INDEX idx_purchases_date ON purchases(goods_received_date);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_product ON purchase_items(product_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id, created_at);
CREATE INDEX idx_supplier_payments_supplier ON supplier_payments(supplier_id, payment_date);
CREATE INDEX idx_supplier_ledger_supplier ON supplier_ledger(supplier_id, transaction_date);

-- Phase 3 Indexes
CREATE INDEX idx_stock_adjustments_num ON stock_adjustments(adjustment_number);
CREATE INDEX idx_stock_adjustments_date ON stock_adjustments(adjustment_date DESC);
CREATE INDEX idx_stock_adjustment_items_adj ON stock_adjustment_items(adjustment_id);
CREATE INDEX idx_stock_adjustment_items_prod ON stock_adjustment_items(product_id);
CREATE INDEX idx_physical_verifications_num ON physical_verifications(verification_number);
CREATE INDEX idx_physical_verification_items_ver ON physical_verification_items(verification_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(created_at DESC);
CREATE INDEX idx_stock_movements_ref ON stock_movements(reference_type, reference_id);

-- Phase 4 Indexes
CREATE INDEX idx_customers_mobile ON customers(mobile);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_date ON invoices(invoice_date DESC);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_product ON invoice_items(product_id);
CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id);
```

---

## 6. Phase 4 Relational Tables (POS Billing & GST Invoicing)

### `customers`
Customer directory supporting regular accounts and walk-in buyers:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique customer ID |
| `name` | TEXT | NOT NULL COLLATE NOCASE | Customer name |
| `mobile` | TEXT | NULL | Primary contact phone |
| `email` | TEXT | NULL | Email address |
| `gstin` | TEXT | NULL | 15-character GST identification number |
| `state_code` | TEXT | DEFAULT '33' | GST State Code (e.g. `33` for Tamil Nadu) |
| `state_name` | TEXT | DEFAULT 'Tamil Nadu' | State name |
| `address` | TEXT | NULL | Street billing address |
| `credit_limit` | REAL | NOT NULL DEFAULT 0.0 | Maximum allowed credit balance |
| `current_balance`| REAL | NOT NULL DEFAULT 0.0 | Outstanding debit balance |
| `is_walk_in` | INTEGER | NOT NULL DEFAULT 0 | 1 = Walk-in, 0 = Regular customer |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | 1 = Active, 0 = Inactive |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Registered timestamp |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last modified |

### `invoices`
Sales invoice header record storing GST breakdowns and monetary totals:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique invoice ID |
| `invoice_number` | TEXT | UNIQUE NOT NULL COLLATE NOCASE | Sequential identifier (e.g. `INV-2026-00001`) |
| `invoice_date` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | Billing timestamp |
| `customer_id` | INTEGER | NOT NULL, FOREIGN KEY -> customers(id) | Linked customer record |
| `customer_name` | TEXT | NOT NULL | Customer name snapshot at bill time |
| `customer_mobile`| TEXT | NULL | Phone snapshot |
| `customer_gstin`| TEXT | NULL | GSTIN snapshot |
| `salesperson` | TEXT | DEFAULT 'Cashier 1' | Billing operator |
| `pos_terminal` | TEXT | DEFAULT 'POS-01' | Terminal / checkout counter ID |
| `is_inter_state`| INTEGER | NOT NULL DEFAULT 0 | 0 = Intra-state (CGST+SGST), 1 = Inter-state (IGST) |
| `total_items` | INTEGER | NOT NULL DEFAULT 0 | Distinct line item count |
| `total_quantity`| REAL | NOT NULL DEFAULT 0.0 | Sum of physical item quantities sold |
| `gross_amount` | REAL | NOT NULL DEFAULT 0.0 | Total rate * quantity before discount |
| `item_discount`| REAL | NOT NULL DEFAULT 0.0 | Line item discount sum |
| `bill_discount`| REAL | NOT NULL DEFAULT 0.0 | Header bill discount amount |
| `taxable_amount`| REAL | NOT NULL DEFAULT 0.0 | Net base for GST calculation |
| `cgst_amount` | REAL | NOT NULL DEFAULT 0.0 | Central GST (intra-state) |
| `sgst_amount` | REAL | NOT NULL DEFAULT 0.0 | State GST (intra-state) |
| `igst_amount` | REAL | NOT NULL DEFAULT 0.0 | Integrated GST (inter-state) |
| `total_tax` | REAL | NOT NULL DEFAULT 0.0 | Total GST levied |
| `other_charges`| REAL | NOT NULL DEFAULT 0.0 | Delivery, packing, or handling fees |
| `round_off` | REAL | NOT NULL DEFAULT 0.0 | Monetary round-off adjustment |
| `grand_total` | REAL | NOT NULL DEFAULT 0.0 | Final payable invoice total |
| `amount_received`| REAL | NOT NULL DEFAULT 0.0 | Total payment received at checkout |
| `change_to_return`| REAL | NOT NULL DEFAULT 0.0 | Change returned to buyer |
| `balance_due` | REAL | NOT NULL DEFAULT 0.0 | Unpaid amount booked to customer credit |
| `payment_mode` | TEXT | NOT NULL DEFAULT 'Cash' | Primary payment tender |
| `payment_status`| TEXT | NOT NULL DEFAULT 'Paid' | `Paid`, `Partial`, `Credit`, `Unpaid` |
| `status` | TEXT | NOT NULL DEFAULT 'Confirmed' | `Draft`, `Confirmed`, `Cancelled` |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record created |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record updated |

### `invoice_items`
Sales line items with individual GST rates, discounts, and HSN codes:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Line item unique ID |
| `invoice_id` | INTEGER | NOT NULL, FOREIGN KEY -> invoices(id) | Parent invoice reference |
| `product_id` | INTEGER | NOT NULL, FOREIGN KEY -> products(id) | Sold catalog product |
| `product_code`| TEXT | NOT NULL | SKU code snapshot |
| `barcode` | TEXT | NOT NULL | Scanned barcode |
| `product_name`| TEXT | NOT NULL | Product name snapshot |
| `unit` | TEXT | NOT NULL DEFAULT 'PCS' | Unit of measurement |
| `hsn_code` | TEXT | NULL | GST HSN / SAC code |
| `quantity` | REAL | NOT NULL | Billed quantity |
| `rate` | REAL | NOT NULL | Selling price per unit |
| `discount_percent`| REAL | NOT NULL DEFAULT 0.0 | Discount percentage |
| `discount_amount`| REAL | NOT NULL DEFAULT 0.0 | Discount value in INR |
| `taxable_amount`| REAL | NOT NULL | Rate * Qty - Discount |
| `tax_rate` | REAL | NOT NULL | Applicable GST % (0, 5, 12, 18, 28) |
| `cgst_rate` | REAL | NOT NULL DEFAULT 0.0 | Intra-state CGST % |
| `cgst_amount` | REAL | NOT NULL DEFAULT 0.0 | CGST in INR |
| `sgst_rate` | REAL | NOT NULL DEFAULT 0.0 | Intra-state SGST % |
| `sgst_amount` | REAL | NOT NULL DEFAULT 0.0 | SGST in INR |
| `igst_rate` | REAL | NOT NULL DEFAULT 0.0 | Inter-state IGST % |
| `igst_amount` | REAL | NOT NULL DEFAULT 0.0 | IGST in INR |
| `total_amount` | REAL | NOT NULL | Final line item total inclusive of GST |

### `invoice_payments`
Multi-tender payment ledger linked to invoice settlements:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Primary Key |
| `invoice_id` | INTEGER | NOT NULL, FOREIGN KEY -> invoices(id) | Target invoice |
| `payment_date`| DATETIME | DEFAULT CURRENT_TIMESTAMP | Payment recorded |
| `payment_mode`| TEXT | NOT NULL | Cash, Card, UPI, NetBanking, Cheque, Credit |
| `amount` | REAL | NOT NULL | Tender amount collected |
| `reference_number`| TEXT | NULL | UTR / Txn ID / Cheque # |
| `notes` | TEXT | NULL | Remarks |

---

## 7. Phase 6 Relational Tables (Estimates & Pro-Forma Quotations)

### `estimates`
Commercial quotation and estimate headers (does NOT deduct inventory stock):
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique estimate ID |
| `estimate_number` | TEXT | UNIQUE NOT NULL COLLATE NOCASE | Sequential identifier (e.g. `EST-2026-00001`) |
| `estimate_date` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | Date of quotation |
| `valid_until` | DATETIME | NULL | Expiration date of quotation |
| `customer_id` | INTEGER | NOT NULL, FOREIGN KEY -> customers(id) | Associated customer |
| `customer_code` | TEXT | DEFAULT 'CUST-WALKIN' | Customer code snapshot |
| `customer_name` | TEXT | NOT NULL | Customer name snapshot |
| `customer_mobile`| TEXT | NULL | Customer phone |
| `customer_gstin` | TEXT | NULL | Customer GSTIN |
| `state_code` | TEXT | DEFAULT '33' | Place of supply state code |
| `state_name` | TEXT | DEFAULT 'Tamil Nadu' | Place of supply name |
| `is_inter_state` | INTEGER | NOT NULL DEFAULT 0 | 0 = Intra-state, 1 = Inter-state |
| `status` | TEXT | NOT NULL DEFAULT 'Draft' | `Draft`, `Confirmed`, `Converted`, `Cancelled` |
| `converted_invoice_id` | INTEGER | NULL, FOREIGN KEY -> invoices(id) | Resulting invoice if converted |
| `converted_invoice_number` | TEXT | NULL | Snapshot of converted invoice # |
| `converted_at` | DATETIME | NULL | Timestamp of conversion |
| `total_items` | INTEGER | NOT NULL DEFAULT 0 | Distinct line item count |
| `total_quantity` | REAL | NOT NULL DEFAULT 0.0 | Sum of physical item quantities |
| `gross_amount` | REAL | NOT NULL DEFAULT 0.0 | Sum of rate * quantity before discount |
| `item_discount` | REAL | NOT NULL DEFAULT 0.0 | Sum of item-level discounts |
| `bill_discount` | REAL | NOT NULL DEFAULT 0.0 | Header discount |
| `taxable_amount` | REAL | NOT NULL DEFAULT 0.0 | Net base for GST |
| `cgst_amount` | REAL | NOT NULL DEFAULT 0.0 | Central GST amount |
| `sgst_amount` | REAL | NOT NULL DEFAULT 0.0 | State GST amount |
| `igst_amount` | REAL | NOT NULL DEFAULT 0.0 | Integrated GST amount |
| `total_tax` | REAL | NOT NULL DEFAULT 0.0 | Sum of GST amounts |
| `other_charges` | REAL | NOT NULL DEFAULT 0.0 | Packaging or freight charges |
| `round_off` | REAL | NOT NULL DEFAULT 0.0 | Mathematical rounding adjustment |
| `grand_total` | REAL | NOT NULL DEFAULT 0.0 | Final estimated total |
| `notes` | TEXT | NULL | Operational remarks |
| `terms_conditions` | TEXT | NULL | Legal and pricing validity terms |
| `created_by` | TEXT | DEFAULT 'Admin' | User who generated quotation |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Modification timestamp |

### `estimate_items`
Detailed quotation line items:
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique line item ID |
| `estimate_id` | INTEGER | NOT NULL, FOREIGN KEY -> estimates(id) | Parent quotation voucher |
| `product_id` | INTEGER | NOT NULL, FOREIGN KEY -> products(id) | Catalog product |
| `product_code` | TEXT | NOT NULL | SKU code snapshot |
| `barcode` | TEXT | NOT NULL | Barcode snapshot |
| `product_name` | TEXT | NOT NULL | Description snapshot |
| `unit` | TEXT | NOT NULL DEFAULT 'PCS' | Unit of measurement |
| `hsn_code` | TEXT | NULL | GST HSN / SAC code |
| `quantity` | REAL | NOT NULL | Quoted quantity |
| `rate` | REAL | NOT NULL | Quoted unit price |
| `discount_percent`| REAL | NOT NULL DEFAULT 0.0 | Discount % |
| `discount_amount`| REAL | NOT NULL DEFAULT 0.0 | Discount value in INR |
| `tax_rate` | REAL | NOT NULL DEFAULT 0.0 | GST rate (0, 5, 12, 18, 28) |
| `taxable_amount`| REAL | NOT NULL | Rate * Qty - Discount |
| `cgst_rate` | REAL | NOT NULL DEFAULT 0.0 | Intra-state CGST % |
| `cgst_amount` | REAL | NOT NULL DEFAULT 0.0 | CGST in INR |
| `sgst_rate` | REAL | NOT NULL DEFAULT 0.0 | Intra-state SGST % |
| `sgst_amount` | REAL | NOT NULL DEFAULT 0.0 | SGST in INR |
| `igst_rate` | REAL | NOT NULL DEFAULT 0.0 | Inter-state IGST % |
| `igst_amount` | REAL | NOT NULL DEFAULT 0.0 | IGST in INR |
| `total_amount` | REAL | NOT NULL | Total inclusive of GST |

---

## 8. Phase 7: App Settings, Fast Reporting & Dashboard Indexes (Migration 9)

### `settings` Key-Value Specifications
| Key | Type | Default Value | Description |
|---|---|---|---|
| `StoreName` | TEXT | `Sri Murugan Super Market` | Registered Retail Business Name |
| `StoreAddress`| TEXT | `124 Bazaar Road, T. Nagar, Chennai - 600017`| Physical store address on vouchers |
| `StorePhone` | TEXT | `044-24345678` | Store contact telephone |
| `StoreEmail` | TEXT | `contact@murugansupermarket.com` | Official email |
| `GstNumber` | TEXT | `33AAAAA0000A1Z5` | 15-character GSTIN |
| `CurrencySymbol`| TEXT | `₹` | Indian Rupee currency glyph |
| `ReceiptPaperSize`| TEXT | `80mm Thermal` | `80mm Thermal` or `A4 Full Page` |
| `DefaultTaxRate`| REAL | `5.0` | Default GST rate % for quick billing |
| `BarcodeFormat` | TEXT | `Code128` | Default generated barcode type |
| `DefaultLowStockThreshold`| REAL| `5.0` | Default reorder level threshold |
| `DefaultReportDateRange`| TEXT| `Last 7 Days` | Preferred date range for statutory reports |
| `DefaultDiscountPercent`| REAL| `0.0` | Default item discount percent |
| `TaxDisplayPreference`| TEXT| `Itemized` | `Itemized` or `SlabSummary` |
| `EnableConfirmDialogs`| TEXT | `true` | Prompt confirmation on critical actions |
| `StartupScreen`| TEXT | `Dashboard` | Default screen on application launch |

### Phase 7 Query Optimization Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_invoices_date_status ON invoices(invoice_date DESC, status);
CREATE INDEX IF NOT EXISTS idx_purchases_date_status ON purchases(purchase_date DESC, status);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date ON invoice_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_customer_payments_paydate ON customer_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_prod ON invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_prod ON purchase_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod_date ON stock_movements(product_id, created_at DESC);
```



