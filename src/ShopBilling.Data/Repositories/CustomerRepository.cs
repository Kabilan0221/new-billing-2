using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SQLite;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;
using ShopBilling.Data.Database;

namespace ShopBilling.Data.Repositories
{
    public class CustomerRepository : ICustomerRepository
    {
        public Customer GetById(long id)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT * FROM customers WHERE id = @id";
                cmd.Parameters.AddWithValue("@id", id);
                using (var reader = cmd.ExecuteReader())
                {
                    if (reader.Read()) return MapCustomer(reader);
                }
            }
            return null;
        }

        public Customer GetByCode(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) return null;
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT * FROM customers WHERE code = @code COLLATE NOCASE";
                cmd.Parameters.AddWithValue("@code", code.Trim());
                using (var reader = cmd.ExecuteReader())
                {
                    if (reader.Read()) return MapCustomer(reader);
                }
            }
            return null;
        }

        public Customer GetByMobile(string mobile)
        {
            if (string.IsNullOrWhiteSpace(mobile)) return null;
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT * FROM customers WHERE mobile = @m";
                cmd.Parameters.AddWithValue("@m", mobile.Trim());
                using (var reader = cmd.ExecuteReader())
                {
                    if (reader.Read()) return MapCustomer(reader);
                }
            }
            return null;
        }

        public PagedResult<Customer> Search(string searchTerm, int page = 1, int pageSize = 50)
        {
            var list = new List<Customer>();
            int total = 0;
            searchTerm = (searchTerm ?? "").Trim();

            using (var conn = DatabaseConnection.CreateConnection())
            {
                using (var countCmd = conn.CreateCommand())
                {
                    countCmd.CommandText = @"
                        SELECT COUNT(*) FROM customers 
                        WHERE is_active = 1 
                        AND (@q = '' OR name LIKE @pattern OR code LIKE @pattern OR mobile LIKE @pattern)";
                    countCmd.Parameters.AddWithValue("@q", searchTerm);
                    countCmd.Parameters.AddWithValue("@pattern", $"%{searchTerm}%");
                    total = Convert.ToInt32(countCmd.ExecuteScalar());
                }

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT * FROM customers 
                        WHERE is_active = 1 
                        AND (@q = '' OR name LIKE @pattern OR code LIKE @pattern OR mobile LIKE @pattern)
                        ORDER BY id ASC
                        LIMIT @limit OFFSET @offset";
                    cmd.Parameters.AddWithValue("@q", searchTerm);
                    cmd.Parameters.AddWithValue("@pattern", $"%{searchTerm}%");
                    cmd.Parameters.AddWithValue("@limit", pageSize);
                    cmd.Parameters.AddWithValue("@offset", (page - 1) * pageSize);

                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            list.Add(MapCustomer(reader));
                        }
                    }
                }
            }

            return new PagedResult<Customer>
            {
                Items = list,
                TotalCount = total,
                PageNumber = page,
                PageSize = pageSize
            };
        }

        public IEnumerable<Customer> GetAllActive()
        {
            var list = new List<Customer>();
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT * FROM customers WHERE is_active = 1 ORDER BY name ASC";
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(MapCustomer(reader));
                    }
                }
            }
            return list;
        }

        public long Insert(Customer c)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    INSERT INTO customers (code, name, mobile, email, gstin, address, city, state, state_code, current_balance, is_active)
                    VALUES (@code, @name, @mobile, @email, @gstin, @address, @city, @state, @state_code, @current_balance, 1);
                    SELECT last_insert_rowid();";
                cmd.Parameters.AddWithValue("@code", c.Code ?? Guid.NewGuid().ToString("N").Substring(0, 8));
                cmd.Parameters.AddWithValue("@name", c.Name);
                cmd.Parameters.AddWithValue("@mobile", (object)c.Mobile ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@email", (object)c.Email ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@gstin", (object)c.Gstin ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@address", (object)c.Address ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@city", c.City ?? "Chennai");
                cmd.Parameters.AddWithValue("@state", c.State ?? "Tamil Nadu");
                cmd.Parameters.AddWithValue("@state_code", c.StateCode ?? "33");
                cmd.Parameters.AddWithValue("@current_balance", c.CurrentBalance);

                long id = (long)cmd.ExecuteScalar();
                c.Id = id;
                return id;
            }
        }

        public bool Update(Customer c)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    UPDATE customers SET 
                        code = @code, name = @name, mobile = @mobile, email = @email,
                        gstin = @gstin, address = @address, city = @city, state = @state,
                        state_code = @state_code, current_balance = @current_balance,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = @id";
                cmd.Parameters.AddWithValue("@code", c.Code);
                cmd.Parameters.AddWithValue("@name", c.Name);
                cmd.Parameters.AddWithValue("@mobile", (object)c.Mobile ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@email", (object)c.Email ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@gstin", (object)c.Gstin ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@address", (object)c.Address ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@city", c.City);
                cmd.Parameters.AddWithValue("@state", c.State);
                cmd.Parameters.AddWithValue("@state_code", c.StateCode);
                cmd.Parameters.AddWithValue("@current_balance", c.CurrentBalance);
                cmd.Parameters.AddWithValue("@id", c.Id);

                return cmd.ExecuteNonQuery() > 0;
            }
        }

        public bool Deactivate(long id)
        {
            if (id <= 1) return false; // Walk-in customer cannot be deactivated
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "UPDATE customers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = @id";
                cmd.Parameters.AddWithValue("@id", id);
                return cmd.ExecuteNonQuery() > 0;
            }
        }

        public bool Activate(long id)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "UPDATE customers SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = @id";
                cmd.Parameters.AddWithValue("@id", id);
                return cmd.ExecuteNonQuery() > 0;
            }
        }

        public bool HasTransactions(long id)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT COUNT(*) FROM invoices WHERE customer_id = @id";
                cmd.Parameters.AddWithValue("@id", id);
                int invoiceCount = Convert.ToInt32(cmd.ExecuteScalar());
                return invoiceCount > 0;
            }
        }

        public bool ExistsMobile(string mobile, long? excludeId = null)
        {
            if (string.IsNullOrWhiteSpace(mobile)) return false;
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT COUNT(*) FROM customers 
                    WHERE mobile = @m 
                    AND (@excludeId IS NULL OR id != @excludeId)
                    AND is_active = 1";
                cmd.Parameters.AddWithValue("@m", mobile.Trim());
                cmd.Parameters.AddWithValue("@excludeId", (object)excludeId ?? DBNull.Value);
                return Convert.ToInt32(cmd.ExecuteScalar()) > 0;
            }
        }

        public bool ExistsCode(string code, long? excludeId = null)
        {
            if (string.IsNullOrWhiteSpace(code)) return false;
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT COUNT(*) FROM customers 
                    WHERE code = @c COLLATE NOCASE 
                    AND (@excludeId IS NULL OR id != @excludeId)";
                cmd.Parameters.AddWithValue("@c", code.Trim());
                cmd.Parameters.AddWithValue("@excludeId", (object)excludeId ?? DBNull.Value);
                return Convert.ToInt32(cmd.ExecuteScalar()) > 0;
            }
        }

        private static Customer MapCustomer(IDataReader r)
        {
            return new Customer
            {
                Id = Convert.ToInt64(r["id"]),
                Code = r["code"]?.ToString() ?? "",
                Name = r["name"]?.ToString() ?? "",
                Mobile = r["mobile"]?.ToString(),
                Email = r["email"]?.ToString(),
                Gstin = r["gstin"]?.ToString(),
                Address = r["address"]?.ToString(),
                City = r["city"]?.ToString() ?? "",
                State = r["state"]?.ToString() ?? "",
                StateCode = r["state_code"]?.ToString() ?? "",
                CurrentBalance = Convert.ToDecimal(r["current_balance"]),
                IsActive = Convert.ToInt32(r["is_active"]) == 1,
                CreatedAt = Convert.ToDateTime(r["created_at"]),
                UpdatedAt = Convert.ToDateTime(r["updated_at"])
            };
        }
    }
}
