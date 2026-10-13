using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SQLite;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;
using ShopBilling.Data.Database;

namespace ShopBilling.Data.Repositories
{
    public class CustomerLedgerRepository : ICustomerLedgerRepository
    {
        public void InsertEntry(CustomerLedgerEntry entry)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            using (var tx = conn.BeginTransaction())
            {
                InsertEntry(entry, conn, tx);
                tx.Commit();
            }
        }

        public void InsertEntry(CustomerLedgerEntry entry, SQLiteConnection conn, SQLiteTransaction tx)
        {
            if (entry == null) throw new ArgumentNullException(nameof(entry));

            using (var cmd = conn.CreateCommand())
            {
                if (tx != null) cmd.Transaction = tx;

                cmd.CommandText = @"
                    INSERT INTO customer_ledger (customer_id, transaction_type, reference_id, debit, credit, balance_after, notes, transaction_date)
                    VALUES (@cid, @type, @ref, @deb, @cred, @bal, @notes, @tdate);
                    SELECT last_insert_rowid();";
                cmd.Parameters.AddWithValue("@cid", entry.CustomerId);
                cmd.Parameters.AddWithValue("@type", entry.TransactionType ?? "ADJUSTMENT");
                cmd.Parameters.AddWithValue("@ref", entry.ReferenceId ?? "");
                cmd.Parameters.AddWithValue("@deb", entry.Debit);
                cmd.Parameters.AddWithValue("@cred", entry.Credit);
                cmd.Parameters.AddWithValue("@bal", entry.BalanceAfter);
                cmd.Parameters.AddWithValue("@notes", (object)entry.Notes ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@tdate", entry.TransactionDate == default ? DateTime.UtcNow : entry.TransactionDate);

                entry.Id = Convert.ToInt64(cmd.ExecuteScalar());
            }
        }

        public IEnumerable<CustomerLedgerEntry> GetLedger(long customerId, DateTime? fromDate = null, DateTime? toDate = null)
        {
            var list = new List<CustomerLedgerEntry>();

            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                string sql = @"
                    SELECT cl.*, c.name as customer_name
                    FROM customer_ledger cl
                    INNER JOIN customers c ON c.id = cl.customer_id
                    WHERE cl.customer_id = @cid
                    AND (@from IS NULL OR cl.transaction_date >= @from)
                    AND (@to IS NULL OR cl.transaction_date <= @to)
                    ORDER BY cl.transaction_date ASC, cl.id ASC";

                cmd.CommandText = sql;
                cmd.Parameters.AddWithValue("@cid", customerId);
                cmd.Parameters.AddWithValue("@from", (object)fromDate ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@to", (object)toDate ?? DBNull.Value);

                using (var r = cmd.ExecuteReader())
                {
                    while (r.Read())
                    {
                        list.Add(new CustomerLedgerEntry
                        {
                            Id = Convert.ToInt64(r["id"]),
                            CustomerId = Convert.ToInt64(r["customer_id"]),
                            CustomerName = r["customer_name"]?.ToString() ?? "",
                            TransactionType = r["transaction_type"]?.ToString() ?? "",
                            ReferenceId = r["reference_id"]?.ToString() ?? "",
                            Debit = Convert.ToDecimal(r["debit"]),
                            Credit = Convert.ToDecimal(r["credit"]),
                            BalanceAfter = Convert.ToDecimal(r["balance_after"]),
                            Notes = r["notes"]?.ToString(),
                            TransactionDate = Convert.ToDateTime(r["transaction_date"])
                        });
                    }
                }
            }

            return list;
        }

        public decimal GetCustomerBalance(long customerId)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT current_balance FROM customers WHERE id = @cid";
                cmd.Parameters.AddWithValue("@cid", customerId);
                object result = cmd.ExecuteScalar();
                return result != null && result != DBNull.Value ? Convert.ToDecimal(result) : 0m;
            }
        }

        public decimal GetBalanceBeforeDate(long customerId, DateTime date)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT (COALESCE(SUM(debit), 0.0) - COALESCE(SUM(credit), 0.0))
                    FROM customer_ledger
                    WHERE customer_id = @cid AND transaction_date < @dt";
                cmd.Parameters.AddWithValue("@cid", customerId);
                cmd.Parameters.AddWithValue("@dt", date);
                object result = cmd.ExecuteScalar();
                return result != null && result != DBNull.Value ? Convert.ToDecimal(result) : 0m;
            }
        }
    }
}
