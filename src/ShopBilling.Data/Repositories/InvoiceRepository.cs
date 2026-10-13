using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SQLite;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;
using ShopBilling.Data.Database;

namespace ShopBilling.Data.Repositories
{
    public class InvoiceRepository : IInvoiceRepository
    {
        public InvoiceHeader GetById(long id)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            {
                InvoiceHeader header = null;
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT * FROM invoices WHERE id = @id";
                    cmd.Parameters.AddWithValue("@id", id);
                    using (var reader = cmd.ExecuteReader())
                    {
                        if (reader.Read())
                        {
                            header = MapInvoiceHeader(reader);
                        }
                    }
                }

                if (header != null)
                {
                    header.Items = GetItemsForInvoice(conn, header.Id);
                    header.Payments = GetPaymentsForInvoice(conn, header.Id);
                }

                return header;
            }
        }

        public InvoiceHeader GetByNumber(string invoiceNumber)
        {
            if (string.IsNullOrWhiteSpace(invoiceNumber)) return null;

            using (var conn = DatabaseConnection.CreateConnection())
            {
                InvoiceHeader header = null;
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT * FROM invoices WHERE invoice_number = @num COLLATE NOCASE";
                    cmd.Parameters.AddWithValue("@num", invoiceNumber.Trim());
                    using (var reader = cmd.ExecuteReader())
                    {
                        if (reader.Read())
                        {
                            header = MapInvoiceHeader(reader);
                        }
                    }
                }

                if (header != null)
                {
                    header.Items = GetItemsForInvoice(conn, header.Id);
                    header.Payments = GetPaymentsForInvoice(conn, header.Id);
                }

                return header;
            }
        }

        public PagedResult<InvoiceHeader> Search(InvoiceFilter filter)
        {
            var list = new List<InvoiceHeader>();
            int total = 0;
            string term = (filter.SearchTerm ?? "").Trim();

            using (var conn = DatabaseConnection.CreateConnection())
            {
                string whereClause = @"
                    WHERE (@term = '' OR invoice_number LIKE @termPattern OR customer_name LIKE @termPattern OR customer_mobile LIKE @termPattern)
                    AND (@cid IS NULL OR customer_id = @cid)
                    AND (@status = 'All' OR status = @status)
                    AND (@payStatus = 'All' OR payment_status = @payStatus)
                    AND (@fromDate IS NULL OR invoice_date >= @fromDate)
                    AND (@toDate IS NULL OR invoice_date <= @toDate)";

                using (var countCmd = conn.CreateCommand())
                {
                    countCmd.CommandText = $"SELECT COUNT(*) FROM invoices {whereClause}";
                    AddFilterParams(countCmd, filter, term);
                    total = Convert.ToInt32(countCmd.ExecuteScalar());
                }

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = $@"
                        SELECT * FROM invoices {whereClause}
                        ORDER BY invoice_date DESC, id DESC
                        LIMIT @limit OFFSET @offset";
                    AddFilterParams(cmd, filter, term);
                    cmd.Parameters.AddWithValue("@limit", filter.PageSize);
                    cmd.Parameters.AddWithValue("@offset", (filter.PageNumber - 1) * filter.PageSize);

                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            list.Add(MapInvoiceHeader(reader));
                        }
                    }
                }
            }

            return new PagedResult<InvoiceHeader>
            {
                Items = list,
                TotalCount = total,
                PageNumber = filter.PageNumber,
                PageSize = filter.PageSize
            };
        }

        public long CreateDraft(InvoiceHeader inv)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            using (var tx = conn.BeginTransaction())
            {
                try
                {
                    long invoiceId = InsertInvoiceHeader(conn, tx, inv, "Draft");
                    inv.Id = invoiceId;

                    InsertInvoiceItems(conn, tx, invoiceId, inv.Items);
                    InsertInvoicePayments(conn, tx, invoiceId, inv.Payments);

                    tx.Commit();
                    return invoiceId;
                }
                catch
                {
                    tx.Rollback();
                    throw;
                }
            }
        }

        public bool UpdateDraft(InvoiceHeader inv)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            using (var tx = conn.BeginTransaction())
            {
                try
                {
                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.Transaction = tx;
                        cmd.CommandText = "SELECT status FROM invoices WHERE id = @id";
                        cmd.Parameters.AddWithValue("@id", inv.Id);
                        string status = cmd.ExecuteScalar()?.ToString();
                        if (status != "Draft")
                        {
                            throw new InvalidOperationException("Only draft invoices can be edited.");
                        }
                    }

                    UpdateInvoiceHeaderRecord(conn, tx, inv);

                    // Re-create items and payments
                    using (var delCmd = conn.CreateCommand())
                    {
                        delCmd.Transaction = tx;
                        delCmd.CommandText = "DELETE FROM invoice_items WHERE invoice_id = @id; DELETE FROM invoice_payments WHERE invoice_id = @id;";
                        delCmd.Parameters.AddWithValue("@id", inv.Id);
                        delCmd.ExecuteNonQuery();
                    }

                    InsertInvoiceItems(conn, tx, inv.Id, inv.Items);
                    InsertInvoicePayments(conn, tx, inv.Id, inv.Payments);

                    tx.Commit();
                    return true;
                }
                catch
                {
                    tx.Rollback();
                    throw;
                }
            }
        }

        public bool FinalizeInvoice(InvoiceHeader inv, out string errorMessage)
        {
            errorMessage = string.Empty;

            using (var conn = DatabaseConnection.CreateConnection())
            using (var tx = conn.BeginTransaction())
            {
                try
                {
                    // 1. Check duplicate invoice number
                    using (var checkCmd = conn.CreateCommand())
                    {
                        checkCmd.Transaction = tx;
                        checkCmd.CommandText = "SELECT id, status FROM invoices WHERE invoice_number = @num COLLATE NOCASE";
                        checkCmd.Parameters.AddWithValue("@num", inv.InvoiceNumber);
                        using (var r = checkCmd.ExecuteReader())
                        {
                            if (r.Read())
                            {
                                string existingStatus = r["status"].ToString();
                                long existingId = Convert.ToInt64(r["id"]);
                                if (existingStatus == "Confirmed")
                                {
                                    errorMessage = $"Invoice #{inv.InvoiceNumber} is already confirmed and finalized. Duplicate submission prevented.";
                                    tx.Rollback();
                                    return false;
                                }
                                if (existingId != inv.Id)
                                {
                                    errorMessage = $"Invoice #{inv.InvoiceNumber} already exists in database with a different ID.";
                                    tx.Rollback();
                                    return false;
                                }
                            }
                        }
                    }

                    // 2. Atomically verify current stock and reduce for each item
                    foreach (var item in inv.Items)
                    {
                        decimal currentStock = 0;
                        string prodName = "";
                        using (var stockCmd = conn.CreateCommand())
                        {
                            stockCmd.Transaction = tx;
                            stockCmd.CommandText = "SELECT name_en, current_stock FROM products WHERE id = @pid";
                            stockCmd.Parameters.AddWithValue("@pid", item.ProductId);
                            using (var sr = stockCmd.ExecuteReader())
                            {
                                if (!sr.Read())
                                {
                                    errorMessage = $"Product ID {item.ProductId} not found in database.";
                                    tx.Rollback();
                                    return false;
                                }
                                prodName = sr["name_en"].ToString();
                                currentStock = Convert.ToDecimal(sr["current_stock"]);
                            }
                        }

                        if (currentStock < item.Quantity)
                        {
                            errorMessage = $"Insufficient stock for '{prodName}'. Available: {currentStock}, Requested: {item.Quantity}.";
                            tx.Rollback();
                            return false;
                        }

                        decimal newStock = currentStock - item.Quantity;

                        // Deduct product stock
                        using (var deductCmd = conn.CreateCommand())
                        {
                            deductCmd.Transaction = tx;
                            deductCmd.CommandText = "UPDATE products SET current_stock = @ns, updated_at = CURRENT_TIMESTAMP WHERE id = @pid";
                            deductCmd.Parameters.AddWithValue("@ns", newStock);
                            deductCmd.Parameters.AddWithValue("@pid", item.ProductId);
                            deductCmd.ExecuteNonQuery();
                        }

                        // Record stock movement audit
                        using (var moveCmd = conn.CreateCommand())
                        {
                            moveCmd.Transaction = tx;
                            moveCmd.CommandText = @"
                                INSERT INTO stock_movements (product_id, reference_type, reference_id, quantity, quantity_before, quantity_after, notes, created_at)
                                VALUES (@pid, 'SALES_INVOICE', @refId, @qty, @before, @after, @notes, CURRENT_TIMESTAMP)";
                            moveCmd.Parameters.AddWithValue("@pid", item.ProductId);
                            moveCmd.Parameters.AddWithValue("@refId", inv.InvoiceNumber);
                            moveCmd.Parameters.AddWithValue("@qty", -item.Quantity);
                            moveCmd.Parameters.AddWithValue("@before", currentStock);
                            moveCmd.Parameters.AddWithValue("@after", newStock);
                            moveCmd.Parameters.AddWithValue("@notes", $"POS Sale to {inv.CustomerName} (#{inv.InvoiceNumber})");
                            moveCmd.ExecuteNonQuery();
                        }
                    }

                    // 3. Save or Update invoice header
                    long invoiceId = inv.Id;
                    if (invoiceId == 0)
                    {
                        invoiceId = InsertInvoiceHeader(conn, tx, inv, "Confirmed");
                        inv.Id = invoiceId;
                    }
                    else
                    {
                        inv.Status = "Confirmed";
                        UpdateInvoiceHeaderRecord(conn, tx, inv);
                        // Clean previous draft items
                        using (var delCmd = conn.CreateCommand())
                        {
                            delCmd.Transaction = tx;
                            delCmd.CommandText = "DELETE FROM invoice_items WHERE invoice_id = @id; DELETE FROM invoice_payments WHERE invoice_id = @id;";
                            delCmd.Parameters.AddWithValue("@id", invoiceId);
                            delCmd.ExecuteNonQuery();
                        }
                    }

                    // 4. Save items & payments
                    InsertInvoiceItems(conn, tx, invoiceId, inv.Items);
                    InsertInvoicePayments(conn, tx, invoiceId, inv.Payments);

                    // 5. Update customer balance if credit/balance due
                    if (inv.BalanceDue > 0 && inv.CustomerId > 1)
                    {
                        using (var custCmd = conn.CreateCommand())
                        {
                            custCmd.Transaction = tx;
                            custCmd.CommandText = "UPDATE customers SET current_balance = current_balance + @due, updated_at = CURRENT_TIMESTAMP WHERE id = @cid";
                            custCmd.Parameters.AddWithValue("@due", inv.BalanceDue);
                            custCmd.Parameters.AddWithValue("@cid", inv.CustomerId);
                            custCmd.ExecuteNonQuery();
                        }

                        using (var ledgerCmd = conn.CreateCommand())
                        {
                            ledgerCmd.Transaction = tx;
                            ledgerCmd.CommandText = @"
                                INSERT INTO customer_ledger (customer_id, transaction_type, reference_id, debit, credit, balance_after, notes, transaction_date)
                                VALUES (@cid, 'INVOICE', @ref, @deb, 0, (SELECT current_balance FROM customers WHERE id = @cid), @notes, CURRENT_TIMESTAMP);";
                            ledgerCmd.Parameters.AddWithValue("@cid", inv.CustomerId);
                            ledgerCmd.Parameters.AddWithValue("@ref", inv.InvoiceNumber);
                            ledgerCmd.Parameters.AddWithValue("@deb", inv.BalanceDue);
                            ledgerCmd.Parameters.AddWithValue("@notes", $"Credit balance due on Invoice #{inv.InvoiceNumber}");
                            ledgerCmd.ExecuteNonQuery();
                        }
                    }

                    tx.Commit();
                    return true;
                }
                catch (Exception ex)
                {
                    tx.Rollback();
                    errorMessage = $"Database Transaction Exception: {ex.Message}";
                    return false;
                }
            }
        }

        public bool CancelInvoice(long invoiceId, string cancellationReason, out string errorMessage)
        {
            errorMessage = string.Empty;

            using (var conn = DatabaseConnection.CreateConnection())
            using (var tx = conn.BeginTransaction())
            {
                try
                {
                    InvoiceHeader header = null;
                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.Transaction = tx;
                        cmd.CommandText = "SELECT * FROM invoices WHERE id = @id";
                        cmd.Parameters.AddWithValue("@id", invoiceId);
                        using (var reader = cmd.ExecuteReader())
                        {
                            if (reader.Read()) header = MapInvoiceHeader(reader);
                        }
                    }

                    if (header == null)
                    {
                        errorMessage = "Invoice not found.";
                        tx.Rollback();
                        return false;
                    }

                    if (header.Status == "Cancelled")
                    {
                        errorMessage = "Invoice is already cancelled. Duplicate cancellation prevented.";
                        tx.Rollback();
                        return false;
                    }

                    // Get items to restore stock
                    var items = GetItemsForInvoice(conn, invoiceId, tx);

                    // Revert stock for all line items
                    foreach (var item in items)
                    {
                        decimal currentStock = 0;
                        using (var stockCmd = conn.CreateCommand())
                        {
                            stockCmd.Transaction = tx;
                            stockCmd.CommandText = "SELECT current_stock FROM products WHERE id = @pid";
                            stockCmd.Parameters.AddWithValue("@pid", item.ProductId);
                            object val = stockCmd.ExecuteScalar();
                            if (val != null && val != DBNull.Value) currentStock = Convert.ToDecimal(val);
                        }

                        decimal newStock = currentStock + item.Quantity;

                        using (var restoreCmd = conn.CreateCommand())
                        {
                            restoreCmd.Transaction = tx;
                            restoreCmd.CommandText = "UPDATE products SET current_stock = @ns, updated_at = CURRENT_TIMESTAMP WHERE id = @pid";
                            restoreCmd.Parameters.AddWithValue("@ns", newStock);
                            restoreCmd.Parameters.AddWithValue("@pid", item.ProductId);
                            restoreCmd.ExecuteNonQuery();
                        }

                        using (var moveCmd = conn.CreateCommand())
                        {
                            moveCmd.Transaction = tx;
                            moveCmd.CommandText = @"
                                INSERT INTO stock_movements (product_id, reference_type, reference_id, quantity, quantity_before, quantity_after, notes, created_at)
                                VALUES (@pid, 'SALES_CANCEL', @refId, @qty, @before, @after, @notes, CURRENT_TIMESTAMP)";
                            moveCmd.Parameters.AddWithValue("@pid", item.ProductId);
                            moveCmd.Parameters.AddWithValue("@refId", header.InvoiceNumber);
                            moveCmd.Parameters.AddWithValue("@qty", item.Quantity);
                            moveCmd.Parameters.AddWithValue("@before", currentStock);
                            moveCmd.Parameters.AddWithValue("@after", newStock);
                            moveCmd.Parameters.AddWithValue("@notes", $"Cancelled invoice #{header.InvoiceNumber}: {cancellationReason}");
                            moveCmd.ExecuteNonQuery();
                        }
                    }

                    // If customer had balance due on this invoice, reduce balance
                    if (header.BalanceDue > 0 && header.CustomerId > 1)
                    {
                        using (var custCmd = conn.CreateCommand())
                        {
                            custCmd.Transaction = tx;
                            custCmd.CommandText = "UPDATE customers SET current_balance = MAX(0, current_balance - @due), updated_at = CURRENT_TIMESTAMP WHERE id = @cid";
                            custCmd.Parameters.AddWithValue("@due", header.BalanceDue);
                            custCmd.Parameters.AddWithValue("@cid", header.CustomerId);
                            custCmd.ExecuteNonQuery();
                        }

                        using (var ledgerCmd = conn.CreateCommand())
                        {
                            ledgerCmd.Transaction = tx;
                            ledgerCmd.CommandText = @"
                                INSERT INTO customer_ledger (customer_id, transaction_type, reference_id, debit, credit, balance_after, notes, transaction_date)
                                VALUES (@cid, 'PAYMENT_REVERSAL', @ref, 0, @cred, (SELECT current_balance FROM customers WHERE id = @cid), @notes, CURRENT_TIMESTAMP);";
                            ledgerCmd.Parameters.AddWithValue("@cid", header.CustomerId);
                            ledgerCmd.Parameters.AddWithValue("@ref", header.InvoiceNumber);
                            ledgerCmd.Parameters.AddWithValue("@cred", header.BalanceDue);
                            ledgerCmd.Parameters.AddWithValue("@notes", $"Reversed credit balance on Cancelled Invoice #{header.InvoiceNumber}: {cancellationReason}");
                            ledgerCmd.ExecuteNonQuery();
                        }
                    }

                    // Update invoice status
                    using (var updateCmd = conn.CreateCommand())
                    {
                        updateCmd.Transaction = tx;
                        updateCmd.CommandText = @"
                            UPDATE invoices SET 
                                status = 'Cancelled', 
                                cancellation_reason = @reason,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = @id";
                        updateCmd.Parameters.AddWithValue("@reason", cancellationReason);
                        updateCmd.Parameters.AddWithValue("@id", invoiceId);
                        updateCmd.ExecuteNonQuery();
                    }

                    tx.Commit();
                    return true;
                }
                catch (Exception ex)
                {
                    tx.Rollback();
                    errorMessage = $"Cancellation Exception: {ex.Message}";
                    return false;
                }
            }
        }

        public string GenerateNextInvoiceNumber()
        {
            string year = DateTime.UtcNow.Year.ToString();
            string prefix = $"INV-{year}-";

            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT invoice_number FROM invoices WHERE invoice_number LIKE @pfx ORDER BY id DESC LIMIT 1";
                cmd.Parameters.AddWithValue("@pfx", $"{prefix}%");
                string lastNum = cmd.ExecuteScalar()?.ToString();

                int nextSeq = 1;
                if (!string.IsNullOrWhiteSpace(lastNum))
                {
                    string suffix = lastNum.Substring(prefix.Length);
                    if (int.TryParse(suffix, out int parsed))
                    {
                        nextSeq = parsed + 1;
                    }
                }

                return $"{prefix}{nextSeq:D4}";
            }
        }

        public IEnumerable<InvoicePayment> GetPayments(long invoiceId)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            {
                return GetPaymentsForInvoice(conn, invoiceId);
            }
        }

        // Internal Helpers
        private static long InsertInvoiceHeader(SQLiteConnection conn, SQLiteTransaction tx, InvoiceHeader inv, string status)
        {
            using (var cmd = conn.CreateCommand())
            {
                cmd.Transaction = tx;
                cmd.CommandText = @"
                    INSERT INTO invoices (
                        invoice_number, invoice_date, customer_id, customer_name, customer_mobile, customer_gstin,
                        salesperson, status, payment_status, is_interstate, total_items, total_qty, gross_amount,
                        item_discount, bill_discount, taxable_amount, cgst_amount, sgst_amount, igst_amount,
                        total_tax_amount, other_charges, round_off, grand_total, amount_paid, balance_due, notes
                    ) VALUES (
                        @num, @date, @cid, @cname, @cmobile, @cgstin,
                        @sp, @status, @payStatus, @interstate, @items, @qty, @gross,
                        @itemDisc, @billDisc, @taxable, @cgst, @sgst, @igst,
                        @totalTax, @other, @roundOff, @grand, @paid, @due, @notes
                    );
                    SELECT last_insert_rowid();";

                AddInvoiceHeaderParameters(cmd, inv, status);
                return (long)cmd.ExecuteScalar();
            }
        }

        private static void UpdateInvoiceHeaderRecord(SQLiteConnection conn, SQLiteTransaction tx, InvoiceHeader inv)
        {
            using (var cmd = conn.CreateCommand())
            {
                cmd.Transaction = tx;
                cmd.CommandText = @"
                    UPDATE invoices SET
                        invoice_number = @num, invoice_date = @date, customer_id = @cid,
                        customer_name = @cname, customer_mobile = @cmobile, customer_gstin = @cgstin,
                        salesperson = @sp, status = @status, payment_status = @payStatus, is_interstate = @interstate,
                        total_items = @items, total_qty = @qty, gross_amount = @gross, item_discount = @itemDisc,
                        bill_discount = @billDisc, taxable_amount = @taxable, cgst_amount = @cgst, sgst_amount = @sgst,
                        igst_amount = @igst, total_tax_amount = @totalTax, other_charges = @other, round_off = @roundOff,
                        grand_total = @grand, amount_paid = @paid, balance_due = @due, notes = @notes, updated_at = CURRENT_TIMESTAMP
                    WHERE id = @id";

                AddInvoiceHeaderParameters(cmd, inv, inv.Status);
                cmd.Parameters.AddWithValue("@id", inv.Id);
                cmd.ExecuteNonQuery();
            }
        }

        private static void AddInvoiceHeaderParameters(SQLiteCommand cmd, InvoiceHeader inv, string status)
        {
            cmd.Parameters.AddWithValue("@num", inv.InvoiceNumber);
            cmd.Parameters.AddWithValue("@date", inv.InvoiceDate.ToString("yyyy-MM-dd HH:mm:ss"));
            cmd.Parameters.AddWithValue("@cid", inv.CustomerId);
            cmd.Parameters.AddWithValue("@cname", inv.CustomerName ?? "Walk-in Customer");
            cmd.Parameters.AddWithValue("@cmobile", (object)inv.CustomerMobile ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@cgstin", (object)inv.CustomerGstin ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@sp", inv.Salesperson ?? "Admin");
            cmd.Parameters.AddWithValue("@status", status);
            cmd.Parameters.AddWithValue("@payStatus", inv.PaymentStatus ?? "Paid");
            cmd.Parameters.AddWithValue("@interstate", inv.IsInterstate ? 1 : 0);
            cmd.Parameters.AddWithValue("@items", inv.TotalItems);
            cmd.Parameters.AddWithValue("@qty", inv.TotalQty);
            cmd.Parameters.AddWithValue("@gross", inv.GrossAmount);
            cmd.Parameters.AddWithValue("@itemDisc", inv.ItemDiscount);
            cmd.Parameters.AddWithValue("@billDisc", inv.BillDiscount);
            cmd.Parameters.AddWithValue("@taxable", inv.TaxableAmount);
            cmd.Parameters.AddWithValue("@cgst", inv.CgstAmount);
            cmd.Parameters.AddWithValue("@sgst", inv.SgstAmount);
            cmd.Parameters.AddWithValue("@igst", inv.IgstAmount);
            cmd.Parameters.AddWithValue("@totalTax", inv.TotalTaxAmount);
            cmd.Parameters.AddWithValue("@other", inv.OtherCharges);
            cmd.Parameters.AddWithValue("@roundOff", inv.RoundOff);
            cmd.Parameters.AddWithValue("@grand", inv.GrandTotal);
            cmd.Parameters.AddWithValue("@paid", inv.AmountPaid);
            cmd.Parameters.AddWithValue("@due", inv.BalanceDue);
            cmd.Parameters.AddWithValue("@notes", (object)inv.Notes ?? DBNull.Value);
        }

        private static void InsertInvoiceItems(SQLiteConnection conn, SQLiteTransaction tx, long invoiceId, List<InvoiceItem> items)
        {
            if (items == null) return;

            foreach (var item in items)
            {
                using (var cmd = conn.CreateCommand())
                {
                    cmd.Transaction = tx;
                    cmd.CommandText = @"
                        INSERT INTO invoice_items (
                            invoice_id, product_id, product_code, barcode, product_name, unit,
                            quantity, rate, discount_percent, discount_amount, tax_rate, taxable_amount,
                            cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
                            tax_amount, line_total
                        ) VALUES (
                            @invId, @pid, @code, @barcode, @name, @unit,
                            @qty, @rate, @discPct, @discAmt, @taxRate, @taxable,
                            @cgstRate, @cgstAmt, @sgstRate, @sgstAmt, @igstRate, @igstAmt,
                            @taxAmt, @total
                        )";

                    cmd.Parameters.AddWithValue("@invId", invoiceId);
                    cmd.Parameters.AddWithValue("@pid", item.ProductId);
                    cmd.Parameters.AddWithValue("@code", item.ProductCode ?? "");
                    cmd.Parameters.AddWithValue("@barcode", item.Barcode ?? "");
                    cmd.Parameters.AddWithValue("@name", item.ProductName ?? "");
                    cmd.Parameters.AddWithValue("@unit", item.Unit ?? "PCS");
                    cmd.Parameters.AddWithValue("@qty", item.Quantity);
                    cmd.Parameters.AddWithValue("@rate", item.Rate);
                    cmd.Parameters.AddWithValue("@discPct", item.DiscountPercent);
                    cmd.Parameters.AddWithValue("@discAmt", item.DiscountAmount);
                    cmd.Parameters.AddWithValue("@taxRate", item.TaxRate);
                    cmd.Parameters.AddWithValue("@taxable", item.TaxableAmount);
                    cmd.Parameters.AddWithValue("@cgstRate", item.CgstRate);
                    cmd.Parameters.AddWithValue("@cgstAmt", item.CgstAmount);
                    cmd.Parameters.AddWithValue("@sgstRate", item.SgstRate);
                    cmd.Parameters.AddWithValue("@sgstAmt", item.SgstAmount);
                    cmd.Parameters.AddWithValue("@igstRate", item.IgstRate);
                    cmd.Parameters.AddWithValue("@igstAmt", item.IgstAmount);
                    cmd.Parameters.AddWithValue("@taxAmt", item.TaxAmount);
                    cmd.Parameters.AddWithValue("@total", item.LineTotal);

                    cmd.ExecuteNonQuery();
                }
            }
        }

        private static void InsertInvoicePayments(SQLiteConnection conn, SQLiteTransaction tx, long invoiceId, List<InvoicePayment> payments)
        {
            if (payments == null) return;

            foreach (var p in payments)
            {
                using (var cmd = conn.CreateCommand())
                {
                    cmd.Transaction = tx;
                    cmd.CommandText = @"
                        INSERT INTO invoice_payments (invoice_id, payment_method, amount, reference_number, created_at)
                        VALUES (@invId, @method, @amt, @refNum, CURRENT_TIMESTAMP)";
                    cmd.Parameters.AddWithValue("@invId", invoiceId);
                    cmd.Parameters.AddWithValue("@method", p.PaymentMethod ?? "Cash");
                    cmd.Parameters.AddWithValue("@amt", p.Amount);
                    cmd.Parameters.AddWithValue("@refNum", (object)p.ReferenceNumber ?? DBNull.Value);
                    cmd.ExecuteNonQuery();
                }
            }
        }

        private static List<InvoiceItem> GetItemsForInvoice(SQLiteConnection conn, long invoiceId, SQLiteTransaction tx = null)
        {
            var items = new List<InvoiceItem>();
            using (var cmd = conn.CreateCommand())
            {
                if (tx != null) cmd.Transaction = tx;
                cmd.CommandText = "SELECT * FROM invoice_items WHERE invoice_id = @id ORDER BY id ASC";
                cmd.Parameters.AddWithValue("@id", invoiceId);
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        items.Add(new InvoiceItem
                        {
                            Id = Convert.ToInt64(reader["id"]),
                            InvoiceId = invoiceId,
                            ProductId = Convert.ToInt64(reader["product_id"]),
                            ProductCode = reader["product_code"].ToString(),
                            Barcode = reader["barcode"].ToString(),
                            ProductName = reader["product_name"].ToString(),
                            Unit = reader["unit"]?.ToString() ?? "PCS",
                            Quantity = Convert.ToDecimal(reader["quantity"]),
                            Rate = Convert.ToDecimal(reader["rate"]),
                            DiscountPercent = Convert.ToDecimal(reader["discount_percent"]),
                            DiscountAmount = Convert.ToDecimal(reader["discount_amount"]),
                            TaxRate = Convert.ToDecimal(reader["tax_rate"]),
                            TaxableAmount = Convert.ToDecimal(reader["taxable_amount"]),
                            CgstRate = Convert.ToDecimal(reader["cgst_rate"]),
                            CgstAmount = Convert.ToDecimal(reader["cgst_amount"]),
                            SgstRate = Convert.ToDecimal(reader["sgst_rate"]),
                            SgstAmount = Convert.ToDecimal(reader["sgst_amount"]),
                            IgstRate = Convert.ToDecimal(reader["igst_rate"]),
                            IgstAmount = Convert.ToDecimal(reader["igst_amount"]),
                            TaxAmount = Convert.ToDecimal(reader["tax_amount"]),
                            LineTotal = Convert.ToDecimal(reader["line_total"])
                        });
                    }
                }
            }
            return items;
        }

        private static List<InvoicePayment> GetPaymentsForInvoice(SQLiteConnection conn, long invoiceId, SQLiteTransaction tx = null)
        {
            var payments = new List<InvoicePayment>();
            using (var cmd = conn.CreateCommand())
            {
                if (tx != null) cmd.Transaction = tx;
                cmd.CommandText = "SELECT * FROM invoice_payments WHERE invoice_id = @id ORDER BY id ASC";
                cmd.Parameters.AddWithValue("@id", invoiceId);
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        payments.Add(new InvoicePayment
                        {
                            Id = Convert.ToInt64(reader["id"]),
                            InvoiceId = invoiceId,
                            PaymentMethod = reader["payment_method"].ToString(),
                            Amount = Convert.ToDecimal(reader["amount"]),
                            ReferenceNumber = reader["reference_number"]?.ToString(),
                            CreatedAt = Convert.ToDateTime(reader["created_at"])
                        });
                    }
                }
            }
            return payments;
        }

        private static InvoiceHeader MapInvoiceHeader(IDataReader r)
        {
            return new InvoiceHeader
            {
                Id = Convert.ToInt64(r["id"]),
                InvoiceNumber = r["invoice_number"].ToString(),
                InvoiceDate = Convert.ToDateTime(r["invoice_date"]),
                CustomerId = Convert.ToInt64(r["customer_id"]),
                CustomerName = r["customer_name"].ToString(),
                CustomerMobile = r["customer_mobile"]?.ToString(),
                CustomerGstin = r["customer_gstin"]?.ToString(),
                Salesperson = r["salesperson"]?.ToString() ?? "Admin",
                Status = r["status"].ToString(),
                PaymentStatus = r["payment_status"].ToString(),
                IsInterstate = Convert.ToInt32(r["is_interstate"]) == 1,
                TotalItems = Convert.ToInt32(r["total_items"]),
                TotalQty = Convert.ToDecimal(r["total_qty"]),
                GrossAmount = Convert.ToDecimal(r["gross_amount"]),
                ItemDiscount = Convert.ToDecimal(r["item_discount"]),
                BillDiscount = Convert.ToDecimal(r["bill_discount"]),
                TaxableAmount = Convert.ToDecimal(r["taxable_amount"]),
                CgstAmount = Convert.ToDecimal(r["cgst_amount"]),
                SgstAmount = Convert.ToDecimal(r["sgst_amount"]),
                IgstAmount = Convert.ToDecimal(r["igst_amount"]),
                TotalTaxAmount = Convert.ToDecimal(r["total_tax_amount"]),
                OtherCharges = Convert.ToDecimal(r["other_charges"]),
                RoundOff = Convert.ToDecimal(r["round_off"]),
                GrandTotal = Convert.ToDecimal(r["grand_total"]),
                AmountPaid = Convert.ToDecimal(r["amount_paid"]),
                BalanceDue = Convert.ToDecimal(r["balance_due"]),
                Notes = r["notes"]?.ToString(),
                CancellationReason = r["cancellation_reason"]?.ToString(),
                CreatedAt = Convert.ToDateTime(r["created_at"]),
                UpdatedAt = Convert.ToDateTime(r["updated_at"])
            };
        }

        private static void AddFilterParams(SQLiteCommand cmd, InvoiceFilter filter, string term)
        {
            cmd.Parameters.AddWithValue("@term", term);
            cmd.Parameters.AddWithValue("@termPattern", $"%{term}%");
            cmd.Parameters.AddWithValue("@cid", (object)filter.CustomerId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@status", string.IsNullOrWhiteSpace(filter.Status) ? "All" : filter.Status);
            cmd.Parameters.AddWithValue("@payStatus", string.IsNullOrWhiteSpace(filter.PaymentStatus) ? "All" : filter.PaymentStatus);
            cmd.Parameters.AddWithValue("@fromDate", (object)filter.FromDate?.ToString("yyyy-MM-dd 00:00:00") ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@toDate", (object)filter.ToDate?.ToString("yyyy-MM-dd 23:59:59") ?? DBNull.Value);
        }
    }
}
