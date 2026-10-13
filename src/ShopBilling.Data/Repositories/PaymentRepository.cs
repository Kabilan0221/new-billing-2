using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SQLite;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;
using ShopBilling.Data.Database;

namespace ShopBilling.Data.Repositories
{
    public class PaymentRepository : IPaymentRepository
    {
        public long RecordPayment(long invoiceId, string paymentMethod, decimal amount, string referenceNumber, string notes, out string error)
        {
            error = string.Empty;

            if (amount <= 0)
            {
                error = "Payment amount must be greater than zero.";
                return 0;
            }

            using (var conn = DatabaseConnection.CreateConnection())
            using (var tx = conn.BeginTransaction())
            {
                try
                {
                    // 1. Fetch current invoice state
                    decimal grandTotal = 0;
                    decimal amountPaid = 0;
                    decimal balanceDue = 0;
                    long customerId = 0;
                    string invoiceNum = "";
                    string customerName = "";

                    using (var invCmd = conn.CreateCommand())
                    {
                        invCmd.Transaction = tx;
                        invCmd.CommandText = "SELECT invoice_number, customer_id, customer_name, grand_total, amount_paid, balance_due FROM invoices WHERE id = @id";
                        invCmd.Parameters.AddWithValue("@id", invoiceId);
                        using (var r = invCmd.ExecuteReader())
                        {
                            if (!r.Read())
                            {
                                error = $"Invoice ID {invoiceId} was not found.";
                                tx.Rollback();
                                return 0;
                            }
                            invoiceNum = r["invoice_number"].ToString();
                            customerId = Convert.ToInt64(r["customer_id"]);
                            customerName = r["customer_name"].ToString();
                            grandTotal = Convert.ToDecimal(r["grand_total"]);
                            amountPaid = Convert.ToDecimal(r["amount_paid"]);
                            balanceDue = Convert.ToDecimal(r["balance_due"]);
                        }
                    }

                    if (amount > balanceDue)
                    {
                        error = $"Payment amount ₹{amount:F2} cannot exceed the outstanding balance of ₹{balanceDue:F2}.";
                        tx.Rollback();
                        return 0;
                    }

                    string payNum = GenerateNextPaymentNumber(conn, tx);
                    decimal newAmountPaid = amountPaid + amount;
                    decimal newBalanceDue = balanceDue - amount;
                    string newPayStatus = (newBalanceDue <= 0.001m) ? "Paid" : "Partial";

                    // 2. Insert into customer_payments
                    long paymentId = 0;
                    using (var payCmd = conn.CreateCommand())
                    {
                        payCmd.Transaction = tx;
                        payCmd.CommandText = @"
                            INSERT INTO customer_payments (payment_number, invoice_id, customer_id, payment_method, amount, reference_number, notes, is_reversed, created_at)
                            VALUES (@pnum, @invid, @cid, @method, @amt, @ref, @notes, 0, CURRENT_TIMESTAMP);
                            SELECT last_insert_rowid();";
                        payCmd.Parameters.AddWithValue("@pnum", payNum);
                        payCmd.Parameters.AddWithValue("@invid", invoiceId);
                        payCmd.Parameters.AddWithValue("@cid", customerId);
                        payCmd.Parameters.AddWithValue("@method", paymentMethod ?? "Cash");
                        payCmd.Parameters.AddWithValue("@amt", amount);
                        payCmd.Parameters.AddWithValue("@ref", (object)referenceNumber ?? DBNull.Value);
                        payCmd.Parameters.AddWithValue("@notes", (object)notes ?? DBNull.Value);
                        paymentId = Convert.ToInt64(payCmd.ExecuteScalar());
                    }

                    // 3. Update invoice
                    using (var updInvCmd = conn.CreateCommand())
                    {
                        updInvCmd.Transaction = tx;
                        updInvCmd.CommandText = @"
                            UPDATE invoices 
                            SET amount_paid = @paid, balance_due = @due, payment_status = @status, updated_at = CURRENT_TIMESTAMP
                            WHERE id = @id";
                        updInvCmd.Parameters.AddWithValue("@paid", newAmountPaid);
                        updInvCmd.Parameters.AddWithValue("@due", newBalanceDue);
                        updInvCmd.Parameters.AddWithValue("@status", newPayStatus);
                        updInvCmd.Parameters.AddWithValue("@id", invoiceId);
                        updInvCmd.ExecuteNonQuery();
                    }

                    // 4. Update customer balance
                    decimal newCustBalance = 0;
                    using (var updCustCmd = conn.CreateCommand())
                    {
                        updCustCmd.Transaction = tx;
                        updCustCmd.CommandText = @"
                            UPDATE customers 
                            SET current_balance = MAX(0.0, current_balance - @amt), updated_at = CURRENT_TIMESTAMP
                            WHERE id = @cid;
                            SELECT current_balance FROM customers WHERE id = @cid;";
                        updCustCmd.Parameters.AddWithValue("@amt", amount);
                        updCustCmd.Parameters.AddWithValue("@cid", customerId);
                        newCustBalance = Convert.ToDecimal(updCustCmd.ExecuteScalar());
                    }

                    // 5. Insert Customer Ledger Credit entry
                    using (var ledCmd = conn.CreateCommand())
                    {
                        ledCmd.Transaction = tx;
                        ledCmd.CommandText = @"
                            INSERT INTO customer_ledger (customer_id, transaction_type, reference_id, debit, credit, balance_after, notes, transaction_date)
                            VALUES (@cid, 'PAYMENT', @ref, 0.0, @amt, @bal, @notes, CURRENT_TIMESTAMP)";
                        ledCmd.Parameters.AddWithValue("@cid", customerId);
                        ledCmd.Parameters.AddWithValue("@ref", payNum);
                        ledCmd.Parameters.AddWithValue("@amt", amount);
                        ledCmd.Parameters.AddWithValue("@bal", newCustBalance);
                        ledCmd.Parameters.AddWithValue("@notes", $"Payment against bill #{invoiceNum} via {paymentMethod}");
                        ledCmd.ExecuteNonQuery();
                    }

                    tx.Commit();
                    return paymentId;
                }
                catch (Exception ex)
                {
                    tx.Rollback();
                    error = $"Database transaction failed: {ex.Message}";
                    return 0;
                }
            }
        }

        public bool ReversePayment(long paymentId, string reason, out string error)
        {
            error = string.Empty;
            if (string.IsNullOrWhiteSpace(reason))
            {
                error = "A valid reason is required to reverse a payment.";
                return false;
            }

            using (var conn = DatabaseConnection.CreateConnection())
            using (var tx = conn.BeginTransaction())
            {
                try
                {
                    // 1. Fetch payment
                    long invoiceId = 0;
                    long customerId = 0;
                    string paymentNum = "";
                    decimal amount = 0;
                    bool isReversed = false;

                    using (var payCmd = conn.CreateCommand())
                    {
                        payCmd.Transaction = tx;
                        payCmd.CommandText = "SELECT payment_number, invoice_id, customer_id, amount, is_reversed FROM customer_payments WHERE id = @id";
                        payCmd.Parameters.AddWithValue("@id", paymentId);
                        using (var r = payCmd.ExecuteReader())
                        {
                            if (!r.Read())
                            {
                                error = $"Payment #{paymentId} not found.";
                                tx.Rollback();
                                return false;
                            }
                            paymentNum = r["payment_number"].ToString();
                            invoiceId = r["invoice_id"] != DBNull.Value ? Convert.ToInt64(r["invoice_id"]) : 0;
                            customerId = Convert.ToInt64(r["customer_id"]);
                            amount = Convert.ToDecimal(r["amount"]);
                            isReversed = Convert.ToInt32(r["is_reversed"]) == 1;
                        }
                    }

                    if (isReversed)
                    {
                        error = $"Payment #{paymentNum} has already been reversed. Double reversal is prevented.";
                        tx.Rollback();
                        return false;
                    }

                    // 2. Mark payment as reversed
                    using (var revCmd = conn.CreateCommand())
                    {
                        revCmd.Transaction = tx;
                        revCmd.CommandText = @"
                            UPDATE customer_payments 
                            SET is_reversed = 1, reversed_at = CURRENT_TIMESTAMP, reversal_reason = @reason
                            WHERE id = @id";
                        revCmd.Parameters.AddWithValue("@reason", reason);
                        revCmd.Parameters.AddWithValue("@id", paymentId);
                        revCmd.ExecuteNonQuery();
                    }

                    // 3. Re-calculate invoice if linked
                    if (invoiceId > 0)
                    {
                        using (var invCmd = conn.CreateCommand())
                        {
                            invCmd.Transaction = tx;
                            invCmd.CommandText = @"
                                UPDATE invoices 
                                SET amount_paid = MAX(0.0, amount_paid - @amt),
                                    balance_due = balance_due + @amt,
                                    payment_status = CASE 
                                        WHEN (amount_paid - @amt) <= 0.001 THEN 'Unpaid'
                                        ELSE 'Partial'
                                    END,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = @invid";
                            invCmd.Parameters.AddWithValue("@amt", amount);
                            invCmd.Parameters.AddWithValue("@invid", invoiceId);
                            invCmd.ExecuteNonQuery();
                        }
                    }

                    // 4. Restore customer balance
                    decimal newCustBal = 0;
                    using (var custCmd = conn.CreateCommand())
                    {
                        custCmd.Transaction = tx;
                        custCmd.CommandText = @"
                            UPDATE customers 
                            SET current_balance = current_balance + @amt, updated_at = CURRENT_TIMESTAMP
                            WHERE id = @cid;
                            SELECT current_balance FROM customers WHERE id = @cid;";
                        custCmd.Parameters.AddWithValue("@amt", amount);
                        custCmd.Parameters.AddWithValue("@cid", customerId);
                        newCustBal = Convert.ToDecimal(custCmd.ExecuteScalar());
                    }

                    // 5. Insert Customer Ledger Debit entry (Reversal increases debt)
                    using (var ledCmd = conn.CreateCommand())
                    {
                        ledCmd.Transaction = tx;
                        ledCmd.CommandText = @"
                            INSERT INTO customer_ledger (customer_id, transaction_type, reference_id, debit, credit, balance_after, notes, transaction_date)
                            VALUES (@cid, 'PAYMENT_REVERSAL', @ref, @deb, 0.0, @bal, @notes, CURRENT_TIMESTAMP)";
                        ledCmd.Parameters.AddWithValue("@cid", customerId);
                        ledCmd.Parameters.AddWithValue("@ref", $"REV-{paymentNum}");
                        ledCmd.Parameters.AddWithValue("@deb", amount);
                        ledCmd.Parameters.AddWithValue("@bal", newCustBal);
                        ledCmd.Parameters.AddWithValue("@notes", $"Reversed payment #{paymentNum}: {reason}");
                        ledCmd.ExecuteNonQuery();
                    }

                    tx.Commit();
                    return true;
                }
                catch (Exception ex)
                {
                    tx.Rollback();
                    error = $"Failed to reverse payment: {ex.Message}";
                    return false;
                }
            }
        }

        public PagedResult<InvoicePayment> Search(PaymentFilter filter)
        {
            var list = new List<InvoicePayment>();
            int total = 0;
            string term = (filter.SearchTerm ?? "").Trim();

            using (var conn = DatabaseConnection.CreateConnection())
            {
                string whereClause = @"
                    WHERE (@term = '' OR cp.payment_number LIKE @termPattern OR c.name LIKE @termPattern OR i.invoice_number LIKE @termPattern OR cp.reference_number LIKE @termPattern)
                    AND (@cid IS NULL OR cp.customer_id = @cid)
                    AND (@invid IS NULL OR cp.invoice_id = @invid)
                    AND (@method = 'All' OR cp.payment_method = @method)
                    AND (@status = 'All' OR (@status = 'Active' AND cp.is_reversed = 0) OR (@status = 'Reversed' AND cp.is_reversed = 1))
                    AND (@from IS NULL OR cp.created_at >= @from)
                    AND (@to IS NULL OR cp.created_at <= @to)";

                using (var countCmd = conn.CreateCommand())
                {
                    countCmd.CommandText = $@"
                        SELECT COUNT(*) 
                        FROM customer_payments cp
                        LEFT JOIN customers c ON c.id = cp.customer_id
                        LEFT JOIN invoices i ON i.id = cp.invoice_id
                        {whereClause}";
                    AddFilterParams(countCmd, filter, term);
                    total = Convert.ToInt32(countCmd.ExecuteScalar());
                }

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = $@"
                        SELECT cp.*, c.name as customer_name, i.invoice_number
                        FROM customer_payments cp
                        LEFT JOIN customers c ON c.id = cp.customer_id
                        LEFT JOIN invoices i ON i.id = cp.invoice_id
                        {whereClause}
                        ORDER BY cp.created_at DESC, cp.id DESC
                        LIMIT @limit OFFSET @offset";
                    AddFilterParams(cmd, filter, term);
                    cmd.Parameters.AddWithValue("@limit", filter.PageSize);
                    cmd.Parameters.AddWithValue("@offset", (filter.PageNumber - 1) * filter.PageSize);

                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            list.Add(MapPayment(reader));
                        }
                    }
                }
            }

            return new PagedResult<InvoicePayment>
            {
                Items = list,
                TotalCount = total,
                PageNumber = filter.PageNumber,
                PageSize = filter.PageSize
            };
        }

        public IEnumerable<InvoicePayment> GetByInvoice(long invoiceId)
        {
            var list = new List<InvoicePayment>();
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT cp.*, c.name as customer_name, i.invoice_number
                    FROM customer_payments cp
                    LEFT JOIN customers c ON c.id = cp.customer_id
                    LEFT JOIN invoices i ON i.id = cp.invoice_id
                    WHERE cp.invoice_id = @id
                    ORDER BY cp.created_at ASC";
                cmd.Parameters.AddWithValue("@id", invoiceId);
                using (var r = cmd.ExecuteReader())
                {
                    while (r.Read()) list.Add(MapPayment(r));
                }
            }
            return list;
        }

        public IEnumerable<InvoicePayment> GetByCustomer(long customerId)
        {
            var list = new List<InvoicePayment>();
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT cp.*, c.name as customer_name, i.invoice_number
                    FROM customer_payments cp
                    LEFT JOIN customers c ON c.id = cp.customer_id
                    LEFT JOIN invoices i ON i.id = cp.invoice_id
                    WHERE cp.customer_id = @cid
                    ORDER BY cp.created_at DESC";
                cmd.Parameters.AddWithValue("@cid", customerId);
                using (var r = cmd.ExecuteReader())
                {
                    while (r.Read()) list.Add(MapPayment(r));
                }
            }
            return list;
        }

        public InvoicePayment GetById(long id)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT cp.*, c.name as customer_name, i.invoice_number
                    FROM customer_payments cp
                    LEFT JOIN customers c ON c.id = cp.customer_id
                    LEFT JOIN invoices i ON i.id = cp.invoice_id
                    WHERE cp.id = @id";
                cmd.Parameters.AddWithValue("@id", id);
                using (var r = cmd.ExecuteReader())
                {
                    if (r.Read()) return MapPayment(r);
                }
            }
            return null;
        }

        public string GenerateNextPaymentNumber()
        {
            using (var conn = DatabaseConnection.CreateConnection())
            {
                return GenerateNextPaymentNumber(conn, null);
            }
        }

        private string GenerateNextPaymentNumber(SQLiteConnection conn, SQLiteTransaction tx)
        {
            string year = DateTime.UtcNow.Year.ToString();
            string prefix = $"PAY-{year}-";

            using (var cmd = conn.CreateCommand())
            {
                if (tx != null) cmd.Transaction = tx;
                cmd.CommandText = @"
                    SELECT payment_number FROM customer_payments 
                    WHERE payment_number LIKE @prefix 
                    ORDER BY id DESC LIMIT 1";
                cmd.Parameters.AddWithValue("@prefix", $"{prefix}%");
                object result = cmd.ExecuteScalar();

                int nextSeq = 1;
                if (result != null && result != DBNull.Value)
                {
                    string lastNum = result.ToString();
                    string seqPart = lastNum.Substring(prefix.Length);
                    if (int.TryParse(seqPart, out int seq))
                    {
                        nextSeq = seq + 1;
                    }
                }

                return $"{prefix}{nextSeq:D4}";
            }
        }

        private static void AddFilterParams(SQLiteCommand cmd, PaymentFilter filter, string term)
        {
            cmd.Parameters.AddWithValue("@term", term);
            cmd.Parameters.AddWithValue("@termPattern", $"%{term}%");
            cmd.Parameters.AddWithValue("@cid", (object)filter.CustomerId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@invid", (object)filter.InvoiceId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@method", string.IsNullOrWhiteSpace(filter.PaymentMethod) ? "All" : filter.PaymentMethod);
            cmd.Parameters.AddWithValue("@status", string.IsNullOrWhiteSpace(filter.Status) ? "Active" : filter.Status);
            cmd.Parameters.AddWithValue("@from", (object)filter.FromDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@to", (object)filter.ToDate ?? DBNull.Value);
        }

        private static InvoicePayment MapPayment(IDataReader r)
        {
            return new InvoicePayment
            {
                Id = Convert.ToInt64(r["id"]),
                PaymentNumber = r["payment_number"]?.ToString() ?? "",
                InvoiceId = r["invoice_id"] != DBNull.Value ? Convert.ToInt64(r["invoice_id"]) : 0,
                InvoiceNumber = r["invoice_number"]?.ToString(),
                CustomerId = Convert.ToInt64(r["customer_id"]),
                CustomerName = r["customer_name"]?.ToString() ?? "",
                PaymentMethod = r["payment_method"]?.ToString() ?? "Cash",
                Amount = Convert.ToDecimal(r["amount"]),
                ReferenceNumber = r["reference_number"]?.ToString(),
                Notes = r["notes"]?.ToString(),
                IsReversed = Convert.ToInt32(r["is_reversed"]) == 1,
                ReversedAt = r["reversed_at"] != DBNull.Value ? Convert.ToDateTime(r["reversed_at"]) : (DateTime?)null,
                ReversalReason = r["reversal_reason"]?.ToString(),
                CreatedAt = Convert.ToDateTime(r["created_at"])
            };
        }
    }
}
