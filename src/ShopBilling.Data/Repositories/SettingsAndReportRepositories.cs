using System;
using System.Collections.Generic;
using System.Data.SQLite;
using System.IO;
using System.Text;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;
using ShopBilling.Data.Database;

namespace ShopBilling.Data.Repositories
{
    public class SettingsRepository : ISettingsRepository
    {
        public AppSettings GetSettings()
        {
            var settings = new AppSettings();

            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT key, value FROM settings";
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        string key = reader.GetString(0);
                        string val = reader.IsDBNull(1) ? "" : reader.GetString(1);

                        switch (key)
                        {
                            case "StoreName": settings.StoreName = val; break;
                            case "StoreAddress": settings.StoreAddress = val; break;
                            case "StorePhone": settings.StorePhone = val; break;
                            case "StoreEmail": settings.StoreEmail = val; break;
                            case "GstNumber": settings.GstNumber = val; break;
                            case "CurrencySymbol": settings.CurrencySymbol = val; break;
                            case "ReceiptPaperSize": settings.ReceiptPaperSize = val; break;
                            case "BarcodeFormat": settings.BarcodeFormat = val; break;
                            case "DefaultReportDateRange": settings.DefaultReportDateRange = val; break;
                            case "TaxDisplayPreference": settings.TaxDisplayPreference = val; break;
                            case "StartupScreen": settings.StartupScreen = val; break;
                            case "DefaultTaxRate":
                                if (decimal.TryParse(val, out decimal tax)) settings.DefaultTaxRate = tax;
                                break;
                            case "DefaultLowStockThreshold":
                                if (decimal.TryParse(val, out decimal low)) settings.DefaultLowStockThreshold = low;
                                break;
                            case "DefaultDiscountPercent":
                                if (decimal.TryParse(val, out decimal disc)) settings.DefaultDiscountPercent = disc;
                                break;
                            case "EnableConfirmDialogs":
                                if (bool.TryParse(val, out bool conf)) settings.EnableConfirmDialogs = conf;
                                break;
                        }
                    }
                }
            }

            return settings;
        }

        public bool SaveSettings(AppSettings s, out string errorMessage)
        {
            errorMessage = string.Empty;
            if (s == null)
            {
                errorMessage = "Settings object cannot be null.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(s.StoreName))
            {
                errorMessage = "Store/Business Name is required.";
                return false;
            }

            var dict = new Dictionary<string, string>
            {
                { "StoreName", s.StoreName.Trim() },
                { "StoreAddress", s.StoreAddress?.Trim() ?? "" },
                { "StorePhone", s.StorePhone?.Trim() ?? "" },
                { "StoreEmail", s.StoreEmail?.Trim() ?? "" },
                { "GstNumber", s.GstNumber?.Trim().ToUpper() ?? "" },
                { "CurrencySymbol", s.CurrencySymbol?.Trim() ?? "₹" },
                { "ReceiptPaperSize", s.ReceiptPaperSize ?? "80mm Thermal" },
                { "DefaultTaxRate", s.DefaultTaxRate.ToString() },
                { "BarcodeFormat", s.BarcodeFormat ?? "Code128" },
                { "DefaultLowStockThreshold", s.DefaultLowStockThreshold.ToString() },
                { "DefaultReportDateRange", s.DefaultReportDateRange ?? "Last 7 Days" },
                { "DefaultDiscountPercent", s.DefaultDiscountPercent.ToString() },
                { "TaxDisplayPreference", s.TaxDisplayPreference ?? "Itemized" },
                { "EnableConfirmDialogs", s.EnableConfirmDialogs.ToString().ToLower() },
                { "StartupScreen", s.StartupScreen ?? "Dashboard" }
            };

            using (var conn = DatabaseConnection.CreateConnection())
            using (var tx = conn.BeginTransaction())
            {
                try
                {
                    foreach (var kvp in dict)
                    {
                        using (var cmd = conn.CreateCommand())
                        {
                            cmd.Transaction = tx;
                            cmd.CommandText = @"
                                INSERT INTO settings (key, value, updated_at) 
                                VALUES (@key, @value, CURRENT_TIMESTAMP)
                                ON CONFLICT(key) DO UPDATE SET 
                                    value = excluded.value, 
                                    updated_at = CURRENT_TIMESTAMP;
                            ";
                            cmd.Parameters.AddWithValue("@key", kvp.Key);
                            cmd.Parameters.AddWithValue("@value", kvp.Value);
                            cmd.ExecuteNonQuery();
                        }
                    }

                    // Audit Log
                    using (var auditCmd = conn.CreateCommand())
                    {
                        auditCmd.Transaction = tx;
                        auditCmd.CommandText = @"
                            INSERT INTO audit_logs (entity, entity_id, action, details, timestamp)
                            VALUES ('Settings', 'Global', 'UPDATE', 'Application settings updated by user', CURRENT_TIMESTAMP);
                        ";
                        auditCmd.ExecuteNonQuery();
                    }

                    tx.Commit();
                    return true;
                }
                catch (Exception ex)
                {
                    tx.Rollback();
                    errorMessage = "Failed to persist settings: " + ex.Message;
                    return false;
                }
            }
        }

        public string GetValue(string key, string defaultValue = null)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT value FROM settings WHERE key = @k LIMIT 1";
                cmd.Parameters.AddWithValue("@k", key);
                object obj = cmd.ExecuteScalar();
                return obj != null && obj != DBNull.Value ? obj.ToString() : defaultValue;
            }
        }

        public bool SetValue(string key, string value, string description = null)
        {
            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    INSERT INTO settings (key, value, description, updated_at)
                    VALUES (@k, @v, @d, CURRENT_TIMESTAMP)
                    ON CONFLICT(key) DO UPDATE SET
                        value = excluded.value,
                        description = COALESCE(excluded.description, settings.description),
                        updated_at = CURRENT_TIMESTAMP;
                ";
                cmd.Parameters.AddWithValue("@k", key);
                cmd.Parameters.AddWithValue("@v", value ?? "");
                cmd.Parameters.AddWithValue("@d", (object)description ?? DBNull.Value);
                return cmd.ExecuteNonQuery() > 0;
            }
        }
    }

    public class ReportRepository : IReportRepository
    {
        public List<SalesReportRow> GetSalesReport(ReportFilter filter)
        {
            var list = new List<SalesReportRow>();

            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                var sb = new StringBuilder(@"
                    SELECT 
                        i.invoice_number, i.invoice_date, i.customer_name,
                        COALESCE((SELECT ip.payment_method FROM invoice_payments ip WHERE ip.invoice_id = i.id ORDER BY ip.id ASC LIMIT 1), 'Cash') AS payment_mode,
                        i.status,
                        i.total_items, i.total_qty AS total_quantity, i.gross_amount, (i.item_discount + i.bill_discount) AS total_discount,
                        i.taxable_amount, i.cgst_amount, i.sgst_amount, i.igst_amount, i.total_tax_amount AS total_tax, i.grand_total
                    FROM invoices i
                    WHERE 1=1
                ");

                if (filter.Status != "All")
                {
                    sb.Append(" AND i.status = @status");
                    cmd.Parameters.AddWithValue("@status", filter.Status);
                }
                else
                {
                    // By default, exclude Cancelled unless explicitly selected
                    sb.Append(" AND i.status != 'Cancelled'");
                }

                if (filter.FromDate.HasValue)
                {
                    sb.Append(" AND date(i.invoice_date) >= date(@fromDate)");
                    cmd.Parameters.AddWithValue("@fromDate", filter.FromDate.Value.ToString("yyyy-MM-dd"));
                }

                if (filter.ToDate.HasValue)
                {
                    sb.Append(" AND date(i.invoice_date) <= date(@toDate)");
                    cmd.Parameters.AddWithValue("@toDate", filter.ToDate.Value.ToString("yyyy-MM-dd"));
                }

                if (!string.IsNullOrWhiteSpace(filter.PaymentMethod) && filter.PaymentMethod != "All")
                {
                    sb.Append(" AND EXISTS (SELECT 1 FROM invoice_payments ip WHERE ip.invoice_id = i.id AND ip.payment_method = @payMode)");
                    cmd.Parameters.AddWithValue("@payMode", filter.PaymentMethod);
                }

                if (filter.CustomerId.HasValue && filter.CustomerId.Value > 0)
                {
                    sb.Append(" AND i.customer_id = @custId");
                    cmd.Parameters.AddWithValue("@custId", filter.CustomerId.Value);
                }

                if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
                {
                    sb.Append(" AND (i.invoice_number LIKE @term OR i.customer_name LIKE @term)");
                    cmd.Parameters.AddWithValue("@term", "%" + filter.SearchTerm.Trim() + "%");
                }

                sb.Append(" ORDER BY i.invoice_date DESC, i.id DESC");
                cmd.CommandText = sb.ToString();

                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(new SalesReportRow
                        {
                            DocumentNumber = reader.GetString(0),
                            DocumentDate = reader.GetDateTime(1),
                            CustomerName = reader.IsDBNull(2) ? "Walk-in Customer" : reader.GetString(2),
                            PaymentMethod = reader.IsDBNull(3) ? "Cash" : reader.GetString(3),
                            Status = reader.IsDBNull(4) ? "Confirmed" : reader.GetString(4),
                            TotalItems = reader.GetInt32(5),
                            TotalQuantity = Convert.ToDecimal(reader.GetDouble(6)),
                            GrossAmount = Convert.ToDecimal(reader.GetDouble(7)),
                            DiscountAmount = Convert.ToDecimal(reader.GetDouble(8)),
                            TaxableAmount = Convert.ToDecimal(reader.GetDouble(9)),
                            CgstAmount = Convert.ToDecimal(reader.GetDouble(10)),
                            SgstAmount = Convert.ToDecimal(reader.GetDouble(11)),
                            IgstAmount = Convert.ToDecimal(reader.GetDouble(12)),
                            TotalTax = Convert.ToDecimal(reader.GetDouble(13)),
                            GrandTotal = Convert.ToDecimal(reader.GetDouble(14))
                        });
                    }
                }
            }

            return list;
        }

        public List<ProductWiseSalesReportRow> GetProductWiseSalesReport(ReportFilter filter)
        {
            var list = new List<ProductWiseSalesReportRow>();

            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                var sb = new StringBuilder(@"
                    SELECT 
                        ii.product_id, ii.product_code, ii.barcode, ii.product_name, ii.unit,
                        SUM(ii.quantity) AS qty_sold,
                        SUM(ii.line_total) AS revenue,
                        SUM(ii.discount_amount) AS discount,
                        SUM(ii.cgst_amount + ii.sgst_amount + ii.igst_amount) AS tax,
                        COUNT(DISTINCT i.id) AS bills_count
                    FROM invoice_items ii
                    JOIN invoices i ON ii.invoice_id = i.id
                    WHERE i.status = 'Confirmed'
                ");

                if (filter.FromDate.HasValue)
                {
                    sb.Append(" AND date(i.invoice_date) >= date(@fromDate)");
                    cmd.Parameters.AddWithValue("@fromDate", filter.FromDate.Value.ToString("yyyy-MM-dd"));
                }

                if (filter.ToDate.HasValue)
                {
                    sb.Append(" AND date(i.invoice_date) <= date(@toDate)");
                    cmd.Parameters.AddWithValue("@toDate", filter.ToDate.Value.ToString("yyyy-MM-dd"));
                }

                if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
                {
                    sb.Append(" AND (ii.product_name LIKE @term OR ii.product_code LIKE @term OR ii.barcode LIKE @term)");
                    cmd.Parameters.AddWithValue("@term", "%" + filter.SearchTerm.Trim() + "%");
                }

                sb.Append(@"
                    GROUP BY ii.product_id, ii.product_code, ii.barcode, ii.product_name, ii.unit
                    ORDER BY revenue DESC
                ");

                cmd.CommandText = sb.ToString();

                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(new ProductWiseSalesReportRow
                        {
                            ProductId = reader.GetInt64(0),
                            ProductCode = reader.GetString(1),
                            Barcode = reader.IsDBNull(2) ? "" : reader.GetString(2),
                            ProductName = reader.GetString(3),
                            Unit = reader.IsDBNull(4) ? "PCS" : reader.GetString(4),
                            QuantitySold = Convert.ToDecimal(reader.GetDouble(5)),
                            TotalRevenue = Convert.ToDecimal(reader.GetDouble(6)),
                            TotalDiscount = Convert.ToDecimal(reader.GetDouble(7)),
                            TotalTax = Convert.ToDecimal(reader.GetDouble(8)),
                            BillCount = reader.GetInt32(9)
                        });
                    }
                }
            }

            return list;
        }

        public List<PurchaseReportRow> GetPurchaseReport(ReportFilter filter)
        {
            var list = new List<PurchaseReportRow>();

            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                var sb = new StringBuilder(@"
                    SELECT 
                        p.purchase_number, p.goods_received_date AS purchase_date,
                        COALESCE(s.name, '') AS supplier_name,
                        COALESCE(p.supplier_invoice_number, '') AS supplier_invoice_number,
                        p.purchase_type, p.status, p.total_qty AS total_quantity, p.taxable_amount, p.tax_amount,
                        p.grand_total, p.amount_paid, p.balance_due
                    FROM purchases p
                    LEFT JOIN suppliers s ON p.supplier_id = s.id
                    WHERE 1=1
                ");

                if (filter.Status != "All")
                {
                    sb.Append(" AND p.status = @status");
                    cmd.Parameters.AddWithValue("@status", filter.Status);
                }
                else
                {
                    sb.Append(" AND p.status != 'Cancelled'");
                }

                if (filter.FromDate.HasValue)
                {
                    sb.Append(" AND date(p.goods_received_date) >= date(@fromDate)");
                    cmd.Parameters.AddWithValue("@fromDate", filter.FromDate.Value.ToString("yyyy-MM-dd"));
                }

                if (filter.ToDate.HasValue)
                {
                    sb.Append(" AND date(p.goods_received_date) <= date(@toDate)");
                    cmd.Parameters.AddWithValue("@toDate", filter.ToDate.Value.ToString("yyyy-MM-dd"));
                }

                if (filter.SupplierId.HasValue && filter.SupplierId.Value > 0)
                {
                    sb.Append(" AND p.supplier_id = @supId");
                    cmd.Parameters.AddWithValue("@supId", filter.SupplierId.Value);
                }

                if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
                {
                    sb.Append(" AND (p.purchase_number LIKE @term OR s.name LIKE @term OR p.supplier_invoice_number LIKE @term)");
                    cmd.Parameters.AddWithValue("@term", "%" + filter.SearchTerm.Trim() + "%");
                }

                sb.Append(" ORDER BY p.goods_received_date DESC, p.id DESC");
                cmd.CommandText = sb.ToString();

                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(new PurchaseReportRow
                        {
                            PurchaseNumber = reader.GetString(0),
                            PurchaseDate = reader.GetDateTime(1),
                            SupplierName = reader.IsDBNull(2) ? "" : reader.GetString(2),
                            SupplierInvoiceNumber = reader.IsDBNull(3) ? "" : reader.GetString(3),
                            PaymentType = reader.IsDBNull(4) ? "Cash" : reader.GetString(4),
                            Status = reader.IsDBNull(5) ? "Confirmed" : reader.GetString(5),
                            TotalQuantity = Convert.ToDecimal(reader.GetDouble(6)),
                            TaxableAmount = Convert.ToDecimal(reader.GetDouble(7)),
                            TaxAmount = Convert.ToDecimal(reader.GetDouble(8)),
                            GrandTotal = Convert.ToDecimal(reader.GetDouble(9)),
                            AmountPaid = Convert.ToDecimal(reader.GetDouble(10)),
                            BalanceDue = Convert.ToDecimal(reader.GetDouble(11))
                        });
                    }
                }
            }

            return list;
        }

        public List<StockReportRow> GetStockReport(ReportFilter filter)
        {
            var list = new List<StockReportRow>();

            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                var sb = new StringBuilder(@"
                    SELECT 
                        p.id, p.product_code, p.barcode, p.name_en, c.name AS category_name,
                        p.unit, p.current_stock, p.reorder_level, p.purchase_rate, p.sale_rate,
                        (p.current_stock * p.purchase_rate) AS val_cost,
                        (p.current_stock * p.sale_rate) AS val_sale
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id
                    WHERE p.is_active = 1
                ");

                if (filter.CategoryId.HasValue && filter.CategoryId.Value > 0)
                {
                    sb.Append(" AND p.category_id = @catId");
                    cmd.Parameters.AddWithValue("@catId", filter.CategoryId.Value);
                }

                if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
                {
                    sb.Append(" AND (p.name_en LIKE @term OR p.product_code LIKE @term OR p.barcode LIKE @term)");
                    cmd.Parameters.AddWithValue("@term", "%" + filter.SearchTerm.Trim() + "%");
                }

                sb.Append(" ORDER BY p.name_en ASC");
                cmd.CommandText = sb.ToString();

                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        decimal curStock = Convert.ToDecimal(reader.GetDouble(6));
                        decimal reorder = Convert.ToDecimal(reader.GetDouble(7));

                        string status = "Normal";
                        if (curStock <= 0) status = "Out of Stock";
                        else if (curStock <= reorder) status = "Low Stock";

                        list.Add(new StockReportRow
                        {
                            ProductId = reader.GetInt64(0),
                            ProductCode = reader.GetString(1),
                            Barcode = reader.IsDBNull(2) ? "" : reader.GetString(2),
                            ProductName = reader.GetString(3),
                            CategoryName = reader.IsDBNull(4) ? "Uncategorized" : reader.GetString(4),
                            Unit = reader.IsDBNull(5) ? "PCS" : reader.GetString(5),
                            CurrentStock = curStock,
                            ReorderLevel = reorder,
                            PurchaseRate = Convert.ToDecimal(reader.GetDouble(8)),
                            SaleRate = Convert.ToDecimal(reader.GetDouble(9)),
                            StockValueAtCost = Convert.ToDecimal(reader.GetDouble(10)),
                            StockValueAtSale = Convert.ToDecimal(reader.GetDouble(11)),
                            StockStatus = status
                        });
                    }
                }
            }

            return list;
        }

        public List<CustomerReportRow> GetCustomerReport(ReportFilter filter)
        {
            var list = new List<CustomerReportRow>();

            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                var sb = new StringBuilder(@"
                    SELECT 
                        c.id, c.code, c.name, c.mobile, c.gstin, c.current_balance,
                        COUNT(DISTINCT i.id) AS invoices_count,
                        COALESCE(SUM(CASE WHEN i.status = 'Confirmed' THEN i.grand_total ELSE 0 END), 0) AS total_billed,
                        COALESCE(SUM(CASE WHEN i.status = 'Confirmed' THEN i.amount_paid ELSE 0 END), 0) AS total_paid,
                        MAX(i.invoice_date) AS last_purchase_date
                    FROM customers c
                    LEFT JOIN invoices i ON c.id = i.customer_id
                    WHERE c.is_active = 1
                ");

                if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
                {
                    sb.Append(" AND (c.name LIKE @term OR c.mobile LIKE @term OR c.code LIKE @term)");
                    cmd.Parameters.AddWithValue("@term", "%" + filter.SearchTerm.Trim() + "%");
                }

                sb.Append(@"
                    GROUP BY c.id, c.code, c.name, c.mobile, c.gstin, c.current_balance
                    ORDER BY c.name ASC
                ");

                cmd.CommandText = sb.ToString();

                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        DateTime? lastDate = null;
                        if (!reader.IsDBNull(9))
                        {
                            if (DateTime.TryParse(reader.GetString(9), out DateTime dt)) lastDate = dt;
                        }

                        list.Add(new CustomerReportRow
                        {
                            CustomerId = reader.GetInt64(0),
                            CustomerCode = reader.IsDBNull(1) ? "" : reader.GetString(1),
                            CustomerName = reader.GetString(2),
                            Mobile = reader.IsDBNull(3) ? "" : reader.GetString(3),
                            Gstin = reader.IsDBNull(4) ? "" : reader.GetString(4),
                            OutstandingBalance = Convert.ToDecimal(reader.GetDouble(5)),
                            InvoicesCount = reader.GetInt32(6),
                            TotalBilledAmount = Convert.ToDecimal(reader.GetDouble(7)),
                            TotalPaidAmount = Convert.ToDecimal(reader.GetDouble(8)),
                            LastPurchaseDate = lastDate
                        });
                    }
                }
            }

            return list;
        }

        public List<PaymentCollectionReportRow> GetPaymentCollectionReport(ReportFilter filter)
        {
            var list = new List<PaymentCollectionReportRow>();

            using (var conn = DatabaseConnection.CreateConnection())
            using (var cmd = conn.CreateCommand())
            {
                var sb = new StringBuilder(@"
                    SELECT 
                        ip.id, ip.created_at AS payment_date, i.invoice_number, i.customer_name,
                        ip.payment_method AS payment_mode, ip.amount, ip.reference_number, '' AS notes
                    FROM invoice_payments ip
                    JOIN invoices i ON ip.invoice_id = i.id
                    WHERE 1=1
                ");

                if (filter.FromDate.HasValue)
                {
                    sb.Append(" AND date(ip.created_at) >= date(@fromDate)");
                    cmd.Parameters.AddWithValue("@fromDate", filter.FromDate.Value.ToString("yyyy-MM-dd"));
                }

                if (filter.ToDate.HasValue)
                {
                    sb.Append(" AND date(ip.created_at) <= date(@toDate)");
                    cmd.Parameters.AddWithValue("@toDate", filter.ToDate.Value.ToString("yyyy-MM-dd"));
                }

                if (!string.IsNullOrWhiteSpace(filter.PaymentMethod) && filter.PaymentMethod != "All")
                {
                    sb.Append(" AND ip.payment_method = @payMode");
                    cmd.Parameters.AddWithValue("@payMode", filter.PaymentMethod);
                }

                if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
                {
                    sb.Append(" AND (i.invoice_number LIKE @term OR i.customer_name LIKE @term OR ip.reference_number LIKE @term)");
                    cmd.Parameters.AddWithValue("@term", "%" + filter.SearchTerm.Trim() + "%");
                }

                sb.Append(" ORDER BY ip.created_at DESC, ip.id DESC");
                cmd.CommandText = sb.ToString();

                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(new PaymentCollectionReportRow
                        {
                            PaymentId = reader.GetInt64(0),
                            PaymentDate = reader.GetDateTime(1),
                            InvoiceNumber = reader.GetString(2),
                            CustomerName = reader.IsDBNull(3) ? "Walk-in Customer" : reader.GetString(3),
                            PaymentMode = reader.GetString(4),
                            Amount = Convert.ToDecimal(reader.GetDouble(5)),
                            ReferenceNumber = reader.IsDBNull(6) ? "" : reader.GetString(6),
                            Notes = reader.IsDBNull(7) ? "" : reader.GetString(7)
                        });
                    }
                }
            }

            return list;
        }

        public DashboardMetrics GetDashboardMetrics()
        {
            var metrics = new DashboardMetrics();
            string todayStr = DateTime.Now.ToString("yyyy-MM-dd");

            using (var conn = DatabaseConnection.CreateConnection())
            {
                // 1. Today's sales and bill count
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT 
                            COALESCE(SUM(grand_total), 0) AS sales_today,
                            COUNT(*) AS bills_today
                        FROM invoices
                        WHERE status = 'Confirmed' AND date(invoice_date) = date('now', 'localtime');
                    ";
                    using (var reader = cmd.ExecuteReader())
                    {
                        if (reader.Read())
                        {
                            metrics.TodaySales = Convert.ToDecimal(reader.GetDouble(0));
                            metrics.TodayBillsCount = reader.GetInt32(1);
                        }
                    }
                }

                // 2. Today's purchases
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT COALESCE(SUM(grand_total), 0) 
                        FROM purchases 
                        WHERE status = 'Confirmed' AND date(goods_received_date) = date('now', 'localtime');
                    ";
                    object res = cmd.ExecuteScalar();
                    metrics.TodayPurchaseTotal = res != null && res != DBNull.Value ? Convert.ToDecimal(res) : 0m;
                }

                // 3. Products metrics
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT 
                            COUNT(*) AS total_prods,
                            SUM(CASE WHEN current_stock > 0 AND current_stock <= reorder_level THEN 1 ELSE 0 END) AS low_stock,
                            SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) AS out_of_stock
                        FROM products
                        WHERE is_active = 1;
                    ";
                    using (var reader = cmd.ExecuteReader())
                    {
                        if (reader.Read())
                        {
                            metrics.TotalProducts = reader.GetInt32(0);
                            metrics.LowStockProductCount = reader.IsDBNull(1) ? 0 : reader.GetInt32(1);
                            metrics.OutOfStockProductCount = reader.IsDBNull(2) ? 0 : reader.GetInt32(2);
                        }
                    }
                }

                // 4. Customers & Outstanding
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT 
                            COUNT(*) AS total_custs,
                            COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) AS outstanding
                        FROM customers
                        WHERE is_active = 1;
                    ";
                    using (var reader = cmd.ExecuteReader())
                    {
                        if (reader.Read())
                        {
                            metrics.TotalCustomerCount = reader.GetInt32(0);
                            metrics.OutstandingCustomerBalance = Convert.ToDecimal(reader.GetDouble(1));
                        }
                    }
                }

                // 5. Payments received today
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT COALESCE(SUM(amount), 0)
                        FROM invoice_payments
                        WHERE date(created_at) = date('now', 'localtime');
                    ";
                    object res = cmd.ExecuteScalar();
                    metrics.PaymentsReceivedToday = res != null && res != DBNull.Value ? Convert.ToDecimal(res) : 0m;
                }

                // 6. Last 7 Days Sales Trend
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT 
                            date(invoice_date) AS s_date,
                            COALESCE(SUM(grand_total), 0) AS total_sales,
                            COUNT(*) AS bill_count,
                            COALESCE(SUM(total_tax_amount), 0) AS total_tax
                        FROM invoices
                        WHERE status = 'Confirmed' AND date(invoice_date) >= date('now', '-6 days', 'localtime')
                        GROUP BY date(invoice_date)
                        ORDER BY date(invoice_date) ASC;
                    ";
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            string dStr = reader.GetString(0);
                            DateTime.TryParse(dStr, out DateTime d);
                            metrics.Last7DaysSales.Add(new DailySalesTrendItem
                            {
                                DateString = dStr,
                                Date = d,
                                SalesAmount = Convert.ToDecimal(reader.GetDouble(1)),
                                BillCount = reader.GetInt32(2),
                                TaxCollected = Convert.ToDecimal(reader.GetDouble(3))
                            });
                        }
                    }
                }

                // 7. Last 30 Days Sales Trend
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT 
                            date(invoice_date) AS s_date,
                            COALESCE(SUM(grand_total), 0) AS total_sales,
                            COUNT(*) AS bill_count,
                            COALESCE(SUM(total_tax_amount), 0) AS total_tax
                        FROM invoices
                        WHERE status = 'Confirmed' AND date(invoice_date) >= date('now', '-29 days', 'localtime')
                        GROUP BY date(invoice_date)
                        ORDER BY date(invoice_date) ASC;
                    ";
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            string dStr = reader.GetString(0);
                            DateTime.TryParse(dStr, out DateTime d);
                            metrics.Last30DaysSales.Add(new DailySalesTrendItem
                            {
                                DateString = dStr,
                                Date = d,
                                SalesAmount = Convert.ToDecimal(reader.GetDouble(1)),
                                BillCount = reader.GetInt32(2),
                                TaxCollected = Convert.ToDecimal(reader.GetDouble(3))
                            });
                        }
                    }
                }
            }

            return metrics;
        }
    }

    public class DataManagementRepository : IDataManagementRepository
    {
        public DataManagementInfo GetDatabaseInfo()
        {
            var info = new DataManagementInfo
            {
                DatabasePath = DatabaseConnection.DatabasePath
            };

            try
            {
                if (File.Exists(DatabaseConnection.DatabasePath))
                {
                    var fi = new FileInfo(DatabaseConnection.DatabasePath);
                    info.FileSizeBytes = fi.Length;
                    if (fi.Length < 1024 * 1024)
                        info.DatabaseFileSize = $"{fi.Length / 1024.0:F1} KB";
                    else
                        info.DatabaseFileSize = $"{fi.Length / (1024.0 * 1024.0):F2} MB";
                }
                else
                {
                    info.DatabaseFileSize = "In-Memory / SQLite";
                }
            }
            catch
            {
                info.DatabaseFileSize = "Unknown";
            }

            using (var conn = DatabaseConnection.CreateConnection())
            {
                // PRAGMA journal_mode
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA journal_mode;";
                    object res = cmd.ExecuteScalar();
                    if (res != null) info.WalMode = res.ToString().ToUpper();
                }

                // PRAGMA foreign_keys
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA foreign_keys;";
                    object res = cmd.ExecuteScalar();
                    if (res != null) info.ForeignKeysEnabled = res.ToString() == "1";
                }

                // Table Record Counts
                string[] tables = new string[]
                {
                    "products", "categories", "brands", "suppliers", "purchases",
                    "purchase_items", "customers", "invoices", "invoice_items",
                    "invoice_payments", "estimates", "estimate_items",
                    "stock_movements", "stock_adjustments", "audit_logs", "settings"
                };

                foreach (var tbl in tables)
                {
                    try
                    {
                        using (var cmd = conn.CreateCommand())
                        {
                            cmd.CommandText = $"SELECT COUNT(*) FROM {tbl};";
                            int cnt = Convert.ToInt32(cmd.ExecuteScalar());
                            info.RecordCounts[tbl] = cnt;
                        }
                    }
                    catch
                    {
                        info.RecordCounts[tbl] = 0;
                    }
                }
            }

            return info;
        }

        public DataIntegrityResult RunIntegrityCheck()
        {
            var result = new DataIntegrityResult();

            using (var conn = DatabaseConnection.CreateConnection())
            {
                // 1. SQLite Engine PRAGMA integrity_check
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA integrity_check;";
                    object res = cmd.ExecuteScalar();
                    string checkMsg = res?.ToString() ?? "ok";
                    result.IntegrityCheckMessage = checkMsg;
                    result.IsDatabaseHealthy = checkMsg.Equals("ok", StringComparison.OrdinalIgnoreCase);

                    if (!result.IsDatabaseHealthy)
                    {
                        result.IssuesFound.Add(new IntegrityIssue
                        {
                            Category = "SQLite Engine",
                            Severity = "Error",
                            Description = $"SQLite integrity_check returned: {checkMsg}",
                            EntityId = "DB"
                        });
                    }
                }

                // 2. Check for Orphaned Invoice Items (items whose parent invoice does not exist)
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT COUNT(*) FROM invoice_items ii
                        LEFT JOIN invoices i ON ii.invoice_id = i.id
                        WHERE i.id IS NULL;
                    ";
                    int orphans = Convert.ToInt32(cmd.ExecuteScalar());
                    if (orphans > 0)
                    {
                        result.IsDatabaseHealthy = false;
                        result.IssuesFound.Add(new IntegrityIssue
                        {
                            Category = "Orphans",
                            Severity = "Error",
                            Description = $"Found {orphans} orphaned invoice line items without a parent invoice.",
                            EntityId = "invoice_items"
                        });
                    }
                }

                // 3. Check for Orphaned Purchase Items
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT COUNT(*) FROM purchase_items pi
                        LEFT JOIN purchases p ON pi.purchase_id = p.id
                        WHERE p.id IS NULL;
                    ";
                    int orphans = Convert.ToInt32(cmd.ExecuteScalar());
                    if (orphans > 0)
                    {
                        result.IsDatabaseHealthy = false;
                        result.IssuesFound.Add(new IntegrityIssue
                        {
                            Category = "Orphans",
                            Severity = "Error",
                            Description = $"Found {orphans} orphaned purchase items without a parent purchase header.",
                            EntityId = "purchase_items"
                        });
                    }
                }

                // 4. Check for Duplicate Document Numbers
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT invoice_number, COUNT(*) FROM invoices 
                        GROUP BY invoice_number HAVING COUNT(*) > 1;
                    ";
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            result.IsDatabaseHealthy = false;
                            result.IssuesFound.Add(new IntegrityIssue
                            {
                                Category = "Duplicates",
                                Severity = "Error",
                                Description = $"Duplicate invoice number detected: {reader.GetString(0)}",
                                EntityId = reader.GetString(0)
                            });
                        }
                    }
                }

                // 5. Check for Duplicate Barcodes across distinct active products
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT barcode, COUNT(*) FROM products
                        WHERE is_active = 1 AND barcode IS NOT NULL AND barcode != ''
                        GROUP BY barcode HAVING COUNT(*) > 1;
                    ";
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            result.IssuesFound.Add(new IntegrityIssue
                            {
                                Category = "Duplicates",
                                Severity = "Warning",
                                Description = $"Duplicate active barcode detected: {reader.GetString(0)}",
                                EntityId = reader.GetString(0)
                            });
                        }
                    }
                }

                // 6. Check for Negative Stock Warnings
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT COUNT(*) FROM products WHERE is_active = 1 AND current_stock < 0;";
                    int negStock = Convert.ToInt32(cmd.ExecuteScalar());
                    if (negStock > 0)
                    {
                        result.IssuesFound.Add(new IntegrityIssue
                        {
                            Category = "Stock",
                            Severity = "Warning",
                            Description = $"Found {negStock} active products with negative stock balances.",
                            EntityId = "products"
                        });
                    }
                }
            }

            return result;
        }

        public bool OptimizeDatabase(out string message)
        {
            try
            {
                using (var conn = DatabaseConnection.CreateConnection())
                {
                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.CommandText = "VACUUM;";
                        cmd.ExecuteNonQuery();
                    }

                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.CommandText = "PRAGMA optimize;";
                        cmd.ExecuteNonQuery();
                    }
                }

                message = "Database VACUUM and index optimization executed successfully.";
                return true;
            }
            catch (Exception ex)
            {
                message = "Optimization error: " + ex.Message;
                return false;
            }
        }
    }
}
