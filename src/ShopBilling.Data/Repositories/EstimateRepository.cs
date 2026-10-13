using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SQLite;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;
using ShopBilling.Data.Database;

namespace ShopBilling.Data.Repositories
{
    public class EstimateRepository : IEstimateRepository
    {
        public EstimateHeader GetById(long id)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            {
                EstimateHeader header = null;
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT * FROM estimates WHERE id = @id";
                    cmd.Parameters.AddWithValue("@id", id);
                    using (var reader = cmd.ExecuteReader())
                    {
                        if (reader.Read())
                        {
                            header = MapEstimateHeader(reader);
                        }
                    }
                }

                if (header != null)
                {
                    header.Items = GetItemsForEstimate(conn, header.Id);
                }

                return header;
            }
        }

        public EstimateHeader GetByNumber(string estimateNumber)
        {
            if (string.IsNullOrWhiteSpace(estimateNumber)) return null;

            using (var conn = DatabaseConnection.CreateConnection())
            {
                EstimateHeader header = null;
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT * FROM estimates WHERE estimate_number = @num COLLATE NOCASE";
                    cmd.Parameters.AddWithValue("@num", estimateNumber.Trim());
                    using (var reader = cmd.ExecuteReader())
                    {
                        if (reader.Read())
                        {
                            header = MapEstimateHeader(reader);
                        }
                    }
                }

                if (header != null)
                {
                    header.Items = GetItemsForEstimate(conn, header.Id);
                }

                return header;
            }
        }

        public PagedResult<EstimateHeader> Search(EstimateFilter filter)
        {
            var list = new List<EstimateHeader>();
            int total = 0;
            string term = (filter.SearchTerm ?? "").Trim();

            using (var conn = DatabaseConnection.CreateConnection())
            {
                string whereClause = @"
                    WHERE (@term = '' OR estimate_number LIKE @termPattern OR customer_name LIKE @termPattern OR customer_mobile LIKE @termPattern)
                    AND (@cid IS NULL OR customer_id = @cid)
                    AND (@status = 'All' OR status = @status)
                    AND (@fromDate IS NULL OR estimate_date >= @fromDate)
                    AND (@toDate IS NULL OR estimate_date <= @toDate)";

                using (var countCmd = conn.CreateCommand())
                {
                    countCmd.CommandText = $"SELECT COUNT(*) FROM estimates {whereClause}";
                    AddFilterParams(countCmd, filter, term);
                    total = Convert.ToInt32(countCmd.ExecuteScalar());
                }

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = $@"
                        SELECT * FROM estimates {whereClause}
                        ORDER BY estimate_date DESC, id DESC
                        LIMIT @limit OFFSET @offset";
                    AddFilterParams(cmd, filter, term);

                    int offset = (Math.Max(1, filter.PageNumber) - 1) * filter.PageSize;
                    cmd.Parameters.AddWithValue("@limit", filter.PageSize);
                    cmd.Parameters.AddWithValue("@offset", offset);

                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            list.Add(MapEstimateHeader(reader));
                        }
                    }
                }

                // Batch populate line items
                foreach (var est in list)
                {
                    est.Items = GetItemsForEstimate(conn, est.Id);
                }

                return new PagedResult<EstimateHeader>
                {
                    Items = list,
                    TotalCount = total,
                    PageNumber = filter.PageNumber,
                    PageSize = filter.PageSize
                };
            }
        }

        public long CreateDraft(EstimateHeader est)
        {
            if (est == null) throw new ArgumentNullException(nameof(est));

            using (var conn = DatabaseConnection.CreateConnection())
            using (var tx = conn.BeginTransaction())
            {
                try
                {
                    if (string.IsNullOrWhiteSpace(est.EstimateNumber))
                    {
                        est.EstimateNumber = GenerateNextEstimateNumberInternal(conn, tx);
                    }

                    long estimateId;
                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.Transaction = tx;
                        cmd.CommandText = @"
                            INSERT INTO estimates (
                                estimate_number, estimate_date, valid_until, customer_id, customer_code,
                                customer_name, customer_mobile, customer_gstin, state_code, state_name,
                                is_inter_state, status, total_items, total_quantity, gross_amount,
                                item_discount, bill_discount, taxable_amount, cgst_amount, sgst_amount,
                                igst_amount, total_tax, other_charges, round_off, grand_total,
                                notes, terms_conditions, created_by, created_at, updated_at
                            ) VALUES (
                                @num, @date, @validUntil, @cid, @ccode,
                                @cname, @cmobile, @cgstin, @stateCode, @stateName,
                                @interstate, @status, @items, @qty, @gross,
                                @itemDisc, @billDisc, @taxable, @cgst, @sgst,
                                @igst, @totalTax, @other, @roundOff, @grand,
                                @notes, @terms, @createdBy, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                            );
                            SELECT last_insert_rowid();";

                        PopulateEstimateParams(cmd, est, "Draft");
                        estimateId = Convert.ToInt64(cmd.ExecuteScalar());
                        est.Id = estimateId;
                    }

                    InsertEstimateItems(conn, tx, estimateId, est.Items);
                    tx.Commit();
                    return estimateId;
                }
                catch
                {
                    tx.Rollback();
                    throw;
                }
            }
        }

        public bool UpdateDraft(EstimateHeader est)
        {
            if (est == null || est.Id <= 0) return false;

            using (var conn = DatabaseConnection.CreateConnection())
            using (var tx = conn.BeginTransaction())
            {
                try
                {
                    // Check status - do not allow editing converted or cancelled
                    using (var checkCmd = conn.CreateCommand())
                    {
                        checkCmd.Transaction = tx;
                        checkCmd.CommandText = "SELECT status FROM estimates WHERE id = @id";
                        checkCmd.Parameters.AddWithValue("@id", est.Id);
                        var statusObj = checkCmd.ExecuteScalar();
                        if (statusObj == null) return false;
                        string curStatus = statusObj.ToString();
                        if (curStatus == "Converted" || curStatus == "Cancelled")
                        {
                            throw new InvalidOperationException($"Cannot update an estimate with status '{curStatus}'.");
                        }
                    }

                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.Transaction = tx;
                        cmd.CommandText = @"
                            UPDATE estimates SET
                                estimate_date = @date,
                                valid_until = @validUntil,
                                customer_id = @cid,
                                customer_code = @ccode,
                                customer_name = @cname,
                                customer_mobile = @cmobile,
                                customer_gstin = @cgstin,
                                state_code = @stateCode,
                                state_name = @stateName,
                                is_inter_state = @interstate,
                                status = @status,
                                total_items = @items,
                                total_quantity = @qty,
                                gross_amount = @gross,
                                item_discount = @itemDisc,
                                bill_discount = @billDisc,
                                taxable_amount = @taxable,
                                cgst_amount = @cgst,
                                sgst_amount = @sgst,
                                igst_amount = @igst,
                                total_tax = @totalTax,
                                other_charges = @other,
                                round_off = @roundOff,
                                grand_total = @grand,
                                notes = @notes,
                                terms_conditions = @terms,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = @id";

                        cmd.Parameters.AddWithValue("@id", est.Id);
                        PopulateEstimateParams(cmd, est, est.Status ?? "Draft");
                        cmd.ExecuteNonQuery();
                    }

                    // Replace items
                    using (var delCmd = conn.CreateCommand())
                    {
                        delCmd.Transaction = tx;
                        delCmd.CommandText = "DELETE FROM estimate_items WHERE estimate_id = @id";
                        delCmd.Parameters.AddWithValue("@id", est.Id);
                        delCmd.ExecuteNonQuery();
                    }

                    InsertEstimateItems(conn, tx, est.Id, est.Items);
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

        public bool ConfirmEstimate(long estimateId, out string errorMessage)
        {
            errorMessage = string.Empty;
            using (var conn = DatabaseConnection.CreateConnection())
            using (var tx = conn.BeginTransaction())
            {
                try
                {
                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.Transaction = tx;
                        cmd.CommandText = "SELECT status FROM estimates WHERE id = @id";
                        cmd.Parameters.AddWithValue("@id", estimateId);
                        var statusObj = cmd.ExecuteScalar();
                        if (statusObj == null)
                        {
                            errorMessage = $"Estimate ID {estimateId} not found.";
                            tx.Rollback();
                            return false;
                        }
                        string status = statusObj.ToString();
                        if (status == "Converted")
                        {
                            errorMessage = "Estimate is already converted to an invoice.";
                            tx.Rollback();
                            return false;
                        }
                        if (status == "Cancelled")
                        {
                            errorMessage = "Cannot confirm a cancelled estimate.";
                            tx.Rollback();
                            return false;
                        }
                    }

                    using (var updCmd = conn.CreateCommand())
                    {
                        updCmd.Transaction = tx;
                        updCmd.CommandText = "UPDATE estimates SET status = 'Confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = @id";
                        updCmd.Parameters.AddWithValue("@id", estimateId);
                        updCmd.ExecuteNonQuery();
                    }

                    tx.Commit();
                    return true;
                }
                catch (Exception ex)
                {
                    tx.Rollback();
                    errorMessage = ex.Message;
                    return false;
                }
            }
        }

        public bool CancelEstimate(long estimateId, string cancellationReason, out string errorMessage)
        {
            errorMessage = string.Empty;
            using (var conn = DatabaseConnection.CreateConnection())
            using (var tx = conn.BeginTransaction())
            {
                try
                {
                    using (var checkCmd = conn.CreateCommand())
                    {
                        checkCmd.Transaction = tx;
                        checkCmd.CommandText = "SELECT status FROM estimates WHERE id = @id";
                        checkCmd.Parameters.AddWithValue("@id", estimateId);
                        var curStatusObj = checkCmd.ExecuteScalar();
                        if (curStatusObj == null)
                        {
                            errorMessage = $"Estimate ID {estimateId} not found.";
                            tx.Rollback();
                            return false;
                        }
                        string curStatus = curStatusObj.ToString();
                        if (curStatus == "Converted")
                        {
                            errorMessage = "Cannot cancel an estimate that has already been converted to an invoice.";
                            tx.Rollback();
                            return false;
                        }
                    }

                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.Transaction = tx;
                        cmd.CommandText = @"
                            UPDATE estimates SET
                                status = 'Cancelled',
                                notes = CASE WHEN notes IS NULL OR notes = '' THEN @reason ELSE notes || ' | Cancelled: ' || @reason END,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = @id";
                        cmd.Parameters.AddWithValue("@id", estimateId);
                        cmd.Parameters.AddWithValue("@reason", cancellationReason ?? "Cancelled by user");
                        cmd.ExecuteNonQuery();
                    }

                    tx.Commit();
                    return true;
                }
                catch (Exception ex)
                {
                    tx.Rollback();
                    errorMessage = ex.Message;
                    return false;
                }
            }
        }

        public bool ConvertToInvoice(long estimateId, InvoiceHeader invoiceToCreate, out InvoiceHeader createdInvoice, out string errorMessage)
        {
            createdInvoice = null;
            errorMessage = string.Empty;

            using (var conn = DatabaseConnection.CreateConnection())
            using (var tx = conn.BeginTransaction())
            {
                try
                {
                    // 1. Lock and inspect current estimate record
                    EstimateHeader est = null;
                    using (var checkCmd = conn.CreateCommand())
                    {
                        checkCmd.Transaction = tx;
                        checkCmd.CommandText = "SELECT * FROM estimates WHERE id = @id";
                        checkCmd.Parameters.AddWithValue("@id", estimateId);
                        using (var r = checkCmd.ExecuteReader())
                        {
                            if (!r.Read())
                            {
                                errorMessage = $"Estimate ID {estimateId} not found in database.";
                                tx.Rollback();
                                return false;
                            }
                            est = MapEstimateHeader(r);
                        }
                    }

                    if (est.Status == "Converted")
                    {
                        errorMessage = $"Estimate #{est.EstimateNumber} has already been converted to Invoice #{est.ConvertedInvoiceNumber}. Duplicate conversion prevented.";
                        tx.Rollback();
                        return false;
                    }

                    if (est.Status == "Cancelled")
                    {
                        errorMessage = $"Cannot convert cancelled estimate #{est.EstimateNumber} to an invoice.";
                        tx.Rollback();
                        return false;
                    }

                    // Load items for estimate
                    est.Items = GetItemsForEstimate(conn, est.Id, tx);
                    if (est.Items == null || est.Items.Count == 0)
                    {
                        errorMessage = $"Estimate #{est.EstimateNumber} has no items to bill.";
                        tx.Rollback();
                        return false;
                    }

                    // 2. Prepare target invoice header
                    var inv = invoiceToCreate ?? new InvoiceHeader();
                    inv.EstimateId = est.Id;
                    inv.EstimateNumber = est.EstimateNumber;
                    inv.CustomerId = est.CustomerId;
                    inv.CustomerName = est.CustomerName;
                    inv.CustomerMobile = est.CustomerMobile;
                    inv.CustomerGstin = est.CustomerGstin;
                    inv.IsInterstate = est.IsInterstate;
                    inv.InvoiceDate = DateTime.UtcNow;
                    inv.Status = "Confirmed"; // Converts directly into a finalized sales invoice

                    if (string.IsNullOrWhiteSpace(inv.InvoiceNumber))
                    {
                        inv.InvoiceNumber = GenerateNextInvoiceNumberInternal(conn, tx);
                    }

                    // Copy items if not explicitly customized
                    if (inv.Items == null || inv.Items.Count == 0)
                    {
                        inv.Items = new List<InvoiceItem>();
                        foreach (var ei in est.Items)
                        {
                            inv.Items.Add(new InvoiceItem
                            {
                                ProductId = ei.ProductId,
                                ProductCode = ei.ProductCode,
                                Barcode = ei.Barcode,
                                ProductName = ei.ProductName,
                                Unit = ei.Unit,
                                Quantity = ei.Quantity,
                                Rate = ei.Rate,
                                DiscountPercent = ei.DiscountPercent,
                                DiscountAmount = ei.DiscountAmount,
                                TaxRate = ei.TaxRate,
                                TaxableAmount = ei.TaxableAmount,
                                CgstRate = ei.CgstRate,
                                CgstAmount = ei.CgstAmount,
                                SgstRate = ei.SgstRate,
                                SgstAmount = ei.SgstAmount,
                                IgstRate = ei.IgstRate,
                                IgstAmount = ei.IgstAmount,
                                TaxAmount = ei.TaxAmount,
                                LineTotal = ei.LineTotal
                            });
                        }
                    }

                    // Copy financial totals from estimate or re-calculate
                    inv.TotalItems = est.TotalItems;
                    inv.TotalQty = est.TotalQty;
                    inv.GrossAmount = est.GrossAmount;
                    inv.ItemDiscount = est.ItemDiscount;
                    inv.BillDiscount = est.BillDiscount;
                    inv.TaxableAmount = est.TaxableAmount;
                    inv.CgstAmount = est.CgstAmount;
                    inv.SgstAmount = est.SgstAmount;
                    inv.IgstAmount = est.IgstAmount;
                    inv.TotalTaxAmount = est.TotalTaxAmount;
                    inv.OtherCharges = est.OtherCharges;
                    inv.RoundOff = est.RoundOff;
                    inv.GrandTotal = est.GrandTotal;

                    if (inv.Payments == null || inv.Payments.Count == 0)
                    {
                        inv.Payments = new List<InvoicePayment>
                        {
                            new InvoicePayment
                            {
                                PaymentMethod = "Cash",
                                Amount = inv.GrandTotal,
                                ReferenceNumber = $"CONV-{est.EstimateNumber}"
                            }
                        };
                        inv.AmountPaid = inv.GrandTotal;
                        inv.BalanceDue = 0;
                        inv.PaymentStatus = "Paid";
                    }

                    // 3. ATOMIC STOCK VALIDATION: Verify stock on every single item before modifying anything
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
                            errorMessage = $"Insufficient stock for '{prodName}' to convert estimate. Available: {currentStock}, Requested: {item.Quantity}.";
                            tx.Rollback();
                            return false;
                        }

                        decimal newStock = currentStock - item.Quantity;

                        // Deduct product stock
                        using (var updateStockCmd = conn.CreateCommand())
                        {
                            updateStockCmd.Transaction = tx;
                            updateStockCmd.CommandText = "UPDATE products SET current_stock = @newStock, updated_at = CURRENT_TIMESTAMP WHERE id = @pid";
                            updateStockCmd.Parameters.AddWithValue("@newStock", newStock);
                            updateStockCmd.Parameters.AddWithValue("@pid", item.ProductId);
                            updateStockCmd.ExecuteNonQuery();
                        }

                        // Record stock movement (SALES_INVOICE)
                        using (var moveCmd = conn.CreateCommand())
                        {
                            moveCmd.Transaction = tx;
                            moveCmd.CommandText = @"
                                INSERT INTO stock_movements (
                                    product_id, reference_type, reference_id, quantity,
                                    quantity_before, quantity_after, notes, created_at
                                ) VALUES (
                                    @pid, 'SALES_INVOICE', @refId, @qty,
                                    @prevStock, @newStock, @notes, CURRENT_TIMESTAMP
                                )";
                            moveCmd.Parameters.AddWithValue("@pid", item.ProductId);
                            moveCmd.Parameters.AddWithValue("@refId", inv.InvoiceNumber);
                            moveCmd.Parameters.AddWithValue("@qty", -item.Quantity);
                            moveCmd.Parameters.AddWithValue("@prevStock", currentStock);
                            moveCmd.Parameters.AddWithValue("@newStock", newStock);
                            moveCmd.Parameters.AddWithValue("@notes", $"Converted from Estimate #{est.EstimateNumber} to Invoice #{inv.InvoiceNumber}");
                            moveCmd.ExecuteNonQuery();
                        }
                    }

                    // 4. Save Invoice Header
                    long invoiceId;
                    using (var invCmd = conn.CreateCommand())
                    {
                        invCmd.Transaction = tx;
                        invCmd.CommandText = @"
                            INSERT INTO invoices (
                                invoice_number, invoice_date, customer_id, customer_name, customer_mobile,
                                customer_gstin, salesperson, status, payment_status, is_interstate,
                                total_items, total_qty, gross_amount, item_discount, bill_discount,
                                taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax_amount,
                                other_charges, round_off, grand_total, amount_paid, balance_due,
                                notes, created_at, updated_at
                            ) VALUES (
                                @num, CURRENT_TIMESTAMP, @cid, @cname, @cmobile,
                                @cgstin, @sp, 'Confirmed', @payStatus, @interstate,
                                @items, @qty, @gross, @itemDisc, @billDisc,
                                @taxable, @cgst, @sgst, @igst, @totalTax,
                                @other, @roundOff, @grand, @paid, @due,
                                @notes, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                            );
                            SELECT last_insert_rowid();";

                        invCmd.Parameters.AddWithValue("@num", inv.InvoiceNumber);
                        invCmd.Parameters.AddWithValue("@cid", inv.CustomerId);
                        invCmd.Parameters.AddWithValue("@cname", inv.CustomerName ?? "Walk-in Customer");
                        invCmd.Parameters.AddWithValue("@cmobile", (object)inv.CustomerMobile ?? DBNull.Value);
                        invCmd.Parameters.AddWithValue("@cgstin", (object)inv.CustomerGstin ?? DBNull.Value);
                        invCmd.Parameters.AddWithValue("@sp", inv.Salesperson ?? "Admin");
                        invCmd.Parameters.AddWithValue("@payStatus", inv.PaymentStatus ?? "Paid");
                        invCmd.Parameters.AddWithValue("@interstate", inv.IsInterstate ? 1 : 0);
                        invCmd.Parameters.AddWithValue("@items", inv.TotalItems);
                        invCmd.Parameters.AddWithValue("@qty", inv.TotalQty);
                        invCmd.Parameters.AddWithValue("@gross", inv.GrossAmount);
                        invCmd.Parameters.AddWithValue("@itemDisc", inv.ItemDiscount);
                        invCmd.Parameters.AddWithValue("@billDisc", inv.BillDiscount);
                        invCmd.Parameters.AddWithValue("@taxable", inv.TaxableAmount);
                        invCmd.Parameters.AddWithValue("@cgst", inv.CgstAmount);
                        invCmd.Parameters.AddWithValue("@sgst", inv.SgstAmount);
                        invCmd.Parameters.AddWithValue("@igst", inv.IgstAmount);
                        invCmd.Parameters.AddWithValue("@totalTax", inv.TotalTaxAmount);
                        invCmd.Parameters.AddWithValue("@other", inv.OtherCharges);
                        invCmd.Parameters.AddWithValue("@roundOff", inv.RoundOff);
                        invCmd.Parameters.AddWithValue("@grand", inv.GrandTotal);
                        invCmd.Parameters.AddWithValue("@paid", inv.AmountPaid);
                        invCmd.Parameters.AddWithValue("@due", inv.BalanceDue);
                        invCmd.Parameters.AddWithValue("@notes", $"Converted from Estimate #{est.EstimateNumber}");

                        invoiceId = Convert.ToInt64(invCmd.ExecuteScalar());
                        inv.Id = invoiceId;
                    }

                    // 5. Insert Invoice Items
                    foreach (var item in inv.Items)
                    {
                        using (var itemCmd = conn.CreateCommand())
                        {
                            itemCmd.Transaction = tx;
                            itemCmd.CommandText = @"
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

                            itemCmd.Parameters.AddWithValue("@invId", invoiceId);
                            itemCmd.Parameters.AddWithValue("@pid", item.ProductId);
                            itemCmd.Parameters.AddWithValue("@code", item.ProductCode ?? "");
                            itemCmd.Parameters.AddWithValue("@barcode", item.Barcode ?? "");
                            itemCmd.Parameters.AddWithValue("@name", item.ProductName ?? "");
                            itemCmd.Parameters.AddWithValue("@unit", item.Unit ?? "PCS");
                            itemCmd.Parameters.AddWithValue("@qty", item.Quantity);
                            itemCmd.Parameters.AddWithValue("@rate", item.Rate);
                            itemCmd.Parameters.AddWithValue("@discPct", item.DiscountPercent);
                            itemCmd.Parameters.AddWithValue("@discAmt", item.DiscountAmount);
                            itemCmd.Parameters.AddWithValue("@taxRate", item.TaxRate);
                            itemCmd.Parameters.AddWithValue("@taxable", item.TaxableAmount);
                            itemCmd.Parameters.AddWithValue("@cgstRate", item.CgstRate);
                            itemCmd.Parameters.AddWithValue("@cgstAmt", item.CgstAmount);
                            itemCmd.Parameters.AddWithValue("@sgstRate", item.SgstRate);
                            itemCmd.Parameters.AddWithValue("@sgstAmt", item.SgstAmount);
                            itemCmd.Parameters.AddWithValue("@igstRate", item.IgstRate);
                            itemCmd.Parameters.AddWithValue("@igstAmt", item.IgstAmount);
                            itemCmd.Parameters.AddWithValue("@taxAmt", item.TaxAmount);
                            itemCmd.Parameters.AddWithValue("@total", item.LineTotal);
                            itemCmd.ExecuteNonQuery();
                        }
                    }

                    // 6. Record Payments
                    if (inv.Payments != null)
                    {
                        foreach (var p in inv.Payments)
                        {
                            using (var payCmd = conn.CreateCommand())
                            {
                                payCmd.Transaction = tx;
                                payCmd.CommandText = @"
                                    INSERT INTO invoice_payments (
                                        invoice_id, payment_method, amount, reference_number, created_at
                                    ) VALUES (
                                        @invId, @method, @amt, @ref, CURRENT_TIMESTAMP
                                    )";
                                payCmd.Parameters.AddWithValue("@invId", invoiceId);
                                payCmd.Parameters.AddWithValue("@method", p.PaymentMethod);
                                payCmd.Parameters.AddWithValue("@amt", p.Amount);
                                payCmd.Parameters.AddWithValue("@ref", (object)p.ReferenceNumber ?? DBNull.Value);
                                payCmd.ExecuteNonQuery();
                            }
                        }
                    }

                    // 7. Update Source Estimate to 'Converted'
                    using (var estUpdCmd = conn.CreateCommand())
                    {
                        estUpdCmd.Transaction = tx;
                        estUpdCmd.CommandText = @"
                            UPDATE estimates SET
                                status = 'Converted',
                                converted_invoice_id = @invId,
                                converted_invoice_number = @invNum,
                                converted_at = CURRENT_TIMESTAMP,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = @estId";
                        estUpdCmd.Parameters.AddWithValue("@invId", invoiceId);
                        estUpdCmd.Parameters.AddWithValue("@invNum", inv.InvoiceNumber);
                        estUpdCmd.Parameters.AddWithValue("@estId", est.Id);
                        estUpdCmd.ExecuteNonQuery();
                    }

                    tx.Commit();
                    createdInvoice = inv;
                    return true;
                }
                catch (Exception ex)
                {
                    tx.Rollback();
                    errorMessage = ex.Message;
                    return false;
                }
            }
        }

        public string GenerateNextEstimateNumber()
        {
            using (var conn = DatabaseConnection.CreateConnection())
            {
                return GenerateNextEstimateNumberInternal(conn, null);
            }
        }

        private static string GenerateNextEstimateNumberInternal(SQLiteConnection conn, SQLiteTransaction tx)
        {
            string yearPrefix = $"EST-{DateTime.Now:yyyy}-";
            using (var cmd = conn.CreateCommand())
            {
                if (tx != null) cmd.Transaction = tx;
                cmd.CommandText = @"
                    SELECT estimate_number FROM estimates 
                    WHERE estimate_number LIKE @prefix 
                    ORDER BY id DESC LIMIT 1";
                cmd.Parameters.AddWithValue("@prefix", yearPrefix + "%");
                var result = cmd.ExecuteScalar();

                int nextSeq = 1;
                if (result != null && result != DBNull.Value)
                {
                    string lastNum = result.ToString();
                    string seqPart = lastNum.Substring(yearPrefix.Length);
                    if (int.TryParse(seqPart, out int parsed))
                    {
                        nextSeq = parsed + 1;
                    }
                }

                return $"{yearPrefix}{nextSeq:D5}";
            }
        }

        private static string GenerateNextInvoiceNumberInternal(SQLiteConnection conn, SQLiteTransaction tx)
        {
            string yearPrefix = $"INV-{DateTime.Now:yyyy}-";
            using (var cmd = conn.CreateCommand())
            {
                if (tx != null) cmd.Transaction = tx;
                cmd.CommandText = @"
                    SELECT invoice_number FROM invoices 
                    WHERE invoice_number LIKE @prefix 
                    ORDER BY id DESC LIMIT 1";
                cmd.Parameters.AddWithValue("@prefix", yearPrefix + "%");
                var result = cmd.ExecuteScalar();

                int nextSeq = 1;
                if (result != null && result != DBNull.Value)
                {
                    string lastNum = result.ToString();
                    string seqPart = lastNum.Substring(yearPrefix.Length);
                    if (int.TryParse(seqPart, out int parsed))
                    {
                        nextSeq = parsed + 1;
                    }
                }

                return $"{yearPrefix}{nextSeq:D5}";
            }
        }

        private static void PopulateEstimateParams(SQLiteCommand cmd, EstimateHeader est, string status)
        {
            cmd.Parameters.AddWithValue("@num", est.EstimateNumber);
            cmd.Parameters.AddWithValue("@date", est.EstimateDate);
            cmd.Parameters.AddWithValue("@validUntil", (object)est.ValidUntil ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@cid", est.CustomerId);
            cmd.Parameters.AddWithValue("@ccode", est.CustomerCode ?? "CUST-WALKIN");
            cmd.Parameters.AddWithValue("@cname", est.CustomerName ?? "Walk-in Customer");
            cmd.Parameters.AddWithValue("@cmobile", (object)est.CustomerMobile ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@cgstin", (object)est.CustomerGstin ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@stateCode", est.StateCode ?? "33");
            cmd.Parameters.AddWithValue("@stateName", est.StateName ?? "Tamil Nadu");
            cmd.Parameters.AddWithValue("@interstate", est.IsInterstate ? 1 : 0);
            cmd.Parameters.AddWithValue("@status", status);
            cmd.Parameters.AddWithValue("@items", est.TotalItems);
            cmd.Parameters.AddWithValue("@qty", est.TotalQty);
            cmd.Parameters.AddWithValue("@gross", est.GrossAmount);
            cmd.Parameters.AddWithValue("@itemDisc", est.ItemDiscount);
            cmd.Parameters.AddWithValue("@billDisc", est.BillDiscount);
            cmd.Parameters.AddWithValue("@taxable", est.TaxableAmount);
            cmd.Parameters.AddWithValue("@cgst", est.CgstAmount);
            cmd.Parameters.AddWithValue("@sgst", est.SgstAmount);
            cmd.Parameters.AddWithValue("@igst", est.IgstAmount);
            cmd.Parameters.AddWithValue("@totalTax", est.TotalTaxAmount);
            cmd.Parameters.AddWithValue("@other", est.OtherCharges);
            cmd.Parameters.AddWithValue("@roundOff", est.RoundOff);
            cmd.Parameters.AddWithValue("@grand", est.GrandTotal);
            cmd.Parameters.AddWithValue("@notes", (object)est.Notes ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@terms", (object)est.TermsConditions ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@createdBy", est.CreatedBy ?? "Admin");
        }

        private static void InsertEstimateItems(SQLiteConnection conn, SQLiteTransaction tx, long estimateId, List<EstimateItem> items)
        {
            if (items == null) return;

            foreach (var item in items)
            {
                using (var cmd = conn.CreateCommand())
                {
                    cmd.Transaction = tx;
                    cmd.CommandText = @"
                        INSERT INTO estimate_items (
                            estimate_id, product_id, product_code, barcode, product_name, unit,
                            hsn_code, quantity, rate, discount_percent, discount_amount, tax_rate,
                            taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
                            igst_rate, igst_amount, total_amount
                        ) VALUES (
                            @estId, @pid, @code, @barcode, @name, @unit,
                            @hsn, @qty, @rate, @discPct, @discAmt, @taxRate,
                            @taxable, @cgstRate, @cgstAmt, @sgstRate, @sgstAmt,
                            @igstRate, @igstAmt, @total
                        )";

                    cmd.Parameters.AddWithValue("@estId", estimateId);
                    cmd.Parameters.AddWithValue("@pid", item.ProductId);
                    cmd.Parameters.AddWithValue("@code", item.ProductCode ?? "");
                    cmd.Parameters.AddWithValue("@barcode", item.Barcode ?? "");
                    cmd.Parameters.AddWithValue("@name", item.ProductName ?? "");
                    cmd.Parameters.AddWithValue("@unit", item.Unit ?? "PCS");
                    cmd.Parameters.AddWithValue("@hsn", (object)item.HsnCode ?? DBNull.Value);
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
                    cmd.Parameters.AddWithValue("@total", item.LineTotal);
                    cmd.ExecuteNonQuery();
                }
            }
        }

        private static List<EstimateItem> GetItemsForEstimate(SQLiteConnection conn, long estimateId, SQLiteTransaction tx = null)
        {
            var items = new List<EstimateItem>();
            using (var cmd = conn.CreateCommand())
            {
                if (tx != null) cmd.Transaction = tx;
                cmd.CommandText = "SELECT * FROM estimate_items WHERE estimate_id = @id ORDER BY id ASC";
                cmd.Parameters.AddWithValue("@id", estimateId);
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        items.Add(new EstimateItem
                        {
                            Id = Convert.ToInt64(reader["id"]),
                            EstimateId = estimateId,
                            ProductId = Convert.ToInt64(reader["product_id"]),
                            ProductCode = reader["product_code"].ToString(),
                            Barcode = reader["barcode"].ToString(),
                            ProductName = reader["product_name"].ToString(),
                            Unit = reader["unit"]?.ToString() ?? "PCS",
                            HsnCode = reader["hsn_code"]?.ToString(),
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
                            TaxAmount = Convert.ToDecimal(reader["cgst_amount"]) + Convert.ToDecimal(reader["sgst_amount"]) + Convert.ToDecimal(reader["igst_amount"]),
                            LineTotal = Convert.ToDecimal(reader["total_amount"])
                        });
                    }
                }
            }
            return items;
        }

        private static EstimateHeader MapEstimateHeader(IDataReader r)
        {
            return new EstimateHeader
            {
                Id = Convert.ToInt64(r["id"]),
                EstimateNumber = r["estimate_number"].ToString(),
                EstimateDate = Convert.ToDateTime(r["estimate_date"]),
                ValidUntil = r["valid_until"] != DBNull.Value ? (DateTime?)Convert.ToDateTime(r["valid_until"]) : null,
                CustomerId = Convert.ToInt64(r["customer_id"]),
                CustomerCode = r["customer_code"]?.ToString() ?? "CUST-WALKIN",
                CustomerName = r["customer_name"].ToString(),
                CustomerMobile = r["customer_mobile"]?.ToString(),
                CustomerGstin = r["customer_gstin"]?.ToString(),
                StateCode = r["state_code"]?.ToString() ?? "33",
                StateName = r["state_name"]?.ToString() ?? "Tamil Nadu",
                IsInterstate = Convert.ToInt32(r["is_inter_state"]) == 1,
                Status = r["status"].ToString(),
                ConvertedInvoiceId = r["converted_invoice_id"] != DBNull.Value ? (long?)Convert.ToInt64(r["converted_invoice_id"]) : null,
                ConvertedInvoiceNumber = r["converted_invoice_number"]?.ToString(),
                ConvertedAt = r["converted_at"] != DBNull.Value ? (DateTime?)Convert.ToDateTime(r["converted_at"]) : null,
                TotalItems = Convert.ToInt32(r["total_items"]),
                TotalQty = Convert.ToDecimal(r["total_quantity"]),
                GrossAmount = Convert.ToDecimal(r["gross_amount"]),
                ItemDiscount = Convert.ToDecimal(r["item_discount"]),
                BillDiscount = Convert.ToDecimal(r["bill_discount"]),
                TaxableAmount = Convert.ToDecimal(r["taxable_amount"]),
                CgstAmount = Convert.ToDecimal(r["cgst_amount"]),
                SgstAmount = Convert.ToDecimal(r["sgst_amount"]),
                IgstAmount = Convert.ToDecimal(r["igst_amount"]),
                TotalTaxAmount = Convert.ToDecimal(r["total_tax"]),
                OtherCharges = Convert.ToDecimal(r["other_charges"]),
                RoundOff = Convert.ToDecimal(r["round_off"]),
                GrandTotal = Convert.ToDecimal(r["grand_total"]),
                Notes = r["notes"]?.ToString(),
                TermsConditions = r["terms_conditions"]?.ToString(),
                CreatedBy = r["created_by"]?.ToString() ?? "Admin",
                CreatedAt = Convert.ToDateTime(r["created_at"]),
                UpdatedAt = Convert.ToDateTime(r["updated_at"])
            };
        }

        private static void AddFilterParams(SQLiteCommand cmd, EstimateFilter filter, string term)
        {
            cmd.Parameters.AddWithValue("@term", term);
            cmd.Parameters.AddWithValue("@termPattern", "%" + term + "%");
            cmd.Parameters.AddWithValue("@cid", (object)filter.CustomerId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@status", string.IsNullOrWhiteSpace(filter.Status) ? "All" : filter.Status);
            cmd.Parameters.AddWithValue("@fromDate", (object)filter.FromDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@toDate", (object)filter.ToDate ?? DBNull.Value);
        }
    }
}
