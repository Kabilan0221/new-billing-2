using System;
using System.Collections.Generic;
using System.Data.SQLite;
using System.IO;
using System.Text;
using ShopBilling.Core.Services;

namespace ShopBilling.Data.Database
{
    public class DatabaseBackupService
    {
        private static readonly byte[] SqliteHeader = Encoding.ASCII.GetBytes("SQLite format 3\0");

        public static string CreateBackup(string destinationFolder = null, string filePrefix = "ShopBilling_Backup")
        {
            if (string.IsNullOrEmpty(destinationFolder))
            {
                var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                destinationFolder = Path.Combine(appData, "ShopBilling", "Backups");
            }

            if (!Directory.Exists(destinationFolder))
            {
                Directory.CreateDirectory(destinationFolder);
            }

            string backupFileName = $"{filePrefix}_{DateTime.Now:yyyyMMdd_HHmmss}.db";
            string backupFilePath = Path.Combine(destinationFolder, backupFileName);

            using (var sourceConn = DatabaseConnection.CreateConnection())
            using (var destConn = new SQLiteConnection($"Data Source={backupFilePath};Version=3;"))
            {
                destConn.Open();
                // SQLite Online Backup API creates a safe, consistent snapshot even with active readers/writers
                sourceConn.BackupDatabase(destConn, "main", "main", -1, null, 0);

                // Verify the created backup file immediately
                using (var checkCmd = destConn.CreateCommand())
                {
                    checkCmd.CommandText = "PRAGMA quick_check;";
                    var res = checkCmd.ExecuteScalar()?.ToString();
                    if (res != "ok")
                    {
                        throw new InvalidOperationException($"Created backup failed integrity verification: {res}");
                    }
                }
            }

            AppLogger.Info($"Database backup successfully created and verified: {backupFilePath}");
            return backupFilePath;
        }

        public static bool ValidateBackupFile(string backupFilePath, out string validationError)
        {
            validationError = null;

            if (string.IsNullOrWhiteSpace(backupFilePath) || !File.Exists(backupFilePath))
            {
                validationError = "The specified backup file does not exist.";
                return false;
            }

            var fileInfo = new FileInfo(backupFilePath);
            if (fileInfo.Length < 512)
            {
                validationError = "The file is too small to be a valid SQLite database (less than 512 bytes).";
                return false;
            }

            // 1. Check SQLite 3 binary header signature
            try
            {
                using (var fs = new FileStream(backupFilePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                {
                    byte[] header = new byte[16];
                    int bytesRead = fs.Read(header, 0, 16);
                    if (bytesRead < 16)
                    {
                        validationError = "Unable to read binary header of the backup file.";
                        return false;
                    }

                    for (int i = 0; i < 16; i++)
                    {
                        if (header[i] != SqliteHeader[i])
                        {
                            validationError = "The selected file is not a valid SQLite 3 database file (header signature mismatch).";
                            return false;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                validationError = $"Failed to read file: {ex.Message}";
                return false;
            }

            // 2. Open read-only connection and execute PRAGMA quick_check and schema compatibility verification
            string connString = $"Data Source={backupFilePath};Version=3;Read Only=True;FailIfMissing=True;";
            try
            {
                using (var testConn = new SQLiteConnection(connString))
                {
                    testConn.Open();

                    using (var cmd = testConn.CreateCommand())
                    {
                        cmd.CommandText = "PRAGMA quick_check;";
                        var checkResult = cmd.ExecuteScalar()?.ToString();
                        if (checkResult != "ok")
                        {
                            validationError = $"SQLite database integrity check failed: {checkResult}";
                            return false;
                        }
                    }

                    // 3. Verify schema compatibility: Core ShopBilling tables must exist
                    var requiredTables = new string[] { "products", "categories", "invoices", "customers", "schema_migrations" };
                    using (var tableCmd = testConn.CreateCommand())
                    {
                        tableCmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table';";
                        var existingTables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        using (var reader = tableCmd.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                existingTables.Add(reader["name"].ToString());
                            }
                        }

                        var missingTables = new List<string>();
                        foreach (var req in requiredTables)
                        {
                            if (!existingTables.Contains(req))
                            {
                                missingTables.Add(req);
                            }
                        }

                        if (missingTables.Count > 0)
                        {
                            validationError = $"The backup file does not contain a compatible ShopBilling database schema (missing essential business table(s): {string.Join(", ", missingTables)}).";
                            return false;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                validationError = $"Database verification error: {ex.Message}";
                return false;
            }

            return true;
        }

        public static bool RestoreBackup(string backupFilePath, out string safetyBackupPath, out string summaryMessage, out string errorMessage)
        {
            safetyBackupPath = null;
            summaryMessage = null;
            errorMessage = null;

            // 1. Validate candidate backup file integrity and schema
            if (!ValidateBackupFile(backupFilePath, out string valError))
            {
                errorMessage = valError;
                return false;
            }

            // 2. Clear all connection pools before taking backup or touching database
            SQLiteConnection.ClearAllPools();

            // 3. Create an automatic safety backup of current production database before any modifications
            try
            {
                var dbDir = Path.GetDirectoryName(DatabaseConnection.DatabaseFilePath);
                var safetyDir = Path.Combine(dbDir ?? "", "SafetyBackups");
                safetyBackupPath = CreateBackup(safetyDir, "ShopBilling_Safety_PreRestore");
                AppLogger.Info($"Automatic pre-restore safety backup created: {safetyBackupPath}");
            }
            catch (Exception ex)
            {
                errorMessage = $"Failed to create automatic pre-restore safety backup: {ex.Message}. Restore aborted to prevent potential data loss.";
                return false;
            }

            // Clear pools again after safety backup
            SQLiteConnection.ClearAllPools();

            // 4. Perform live restore into current active database via SQLite Online Backup API
            string sourceConnString = $"Data Source={backupFilePath};Version=3;Read Only=True;FailIfMissing=True;";
            try
            {
                using (var destConn = DatabaseConnection.CreateConnection())
                using (var sourceConn = new SQLiteConnection(sourceConnString))
                {
                    sourceConn.Open();
                    sourceConn.BackupDatabase(destConn, "main", "main", -1, null, 0);

                    // Verify post-restore integrity
                    using (var verifyCmd = destConn.CreateCommand())
                    {
                        verifyCmd.CommandText = "PRAGMA quick_check;";
                        var postCheck = verifyCmd.ExecuteScalar()?.ToString();
                        if (postCheck != "ok")
                        {
                            throw new InvalidOperationException($"Post-restore integrity check failed: {postCheck}");
                        }
                    }

                    // Flush and truncate WAL to guarantee main database file consistency
                    using (var checkpointCmd = destConn.CreateCommand())
                    {
                        checkpointCmd.CommandText = "PRAGMA wal_checkpoint(TRUNCATE);";
                        checkpointCmd.ExecuteNonQuery();
                    }

                    // 5. Verify restored business records: products, invoices, customers, stock, and payments
                    using (var countCmd = destConn.CreateCommand())
                    {
                        countCmd.CommandText = @"
                            SELECT 
                                (SELECT COUNT(*) FROM products) AS prod_count,
                                (SELECT COUNT(*) FROM invoices) AS inv_count,
                                (SELECT COUNT(*) FROM customers) AS cust_count,
                                (SELECT COUNT(*) FROM invoice_payments) AS pay_count,
                                (SELECT COUNT(*) FROM stock_movements) AS stock_count;
                        ";
                        using (var reader = countCmd.ExecuteReader())
                        {
                            if (reader.Read())
                            {
                                long prodCount = Convert.ToInt64(reader["prod_count"]);
                                long invCount = Convert.ToInt64(reader["inv_count"]);
                                long custCount = Convert.ToInt64(reader["cust_count"]);
                                long payCount = Convert.ToInt64(reader["pay_count"]);
                                long stockCount = Convert.ToInt64(reader["stock_count"]);

                                summaryMessage = $"Verified Restored Records: {prodCount:N0} products, {invCount:N0} invoices, {custCount:N0} customers, {payCount:N0} payments, {stockCount:N0} stock movements.";
                                AppLogger.Info(summaryMessage);
                            }
                        }
                    }
                }

                SQLiteConnection.ClearAllPools();
                AppLogger.Info($"Database restored successfully from: {backupFilePath}");
                return true;
            }
            catch (Exception ex)
            {
                AppLogger.Error($"Database restore operation failed: {ex.Message}");
                SQLiteConnection.ClearAllPools();

                // Attempt automatic recovery rollback from safety backup
                if (!string.IsNullOrEmpty(safetyBackupPath) && File.Exists(safetyBackupPath))
                {
                    try
                    {
                        using (var destConn = DatabaseConnection.CreateConnection())
                        using (var safetyConn = new SQLiteConnection($"Data Source={safetyBackupPath};Version=3;Read Only=True;"))
                        {
                            safetyConn.Open();
                            safetyConn.BackupDatabase(destConn, "main", "main", -1, null, 0);

                            using (var checkpointCmd = destConn.CreateCommand())
                            {
                                checkpointCmd.CommandText = "PRAGMA wal_checkpoint(TRUNCATE);";
                                checkpointCmd.ExecuteNonQuery();
                            }
                        }
                        SQLiteConnection.ClearAllPools();
                        errorMessage = $"Restore failed: {ex.Message}. Automatic rollback was executed and the original database was restored from safety backup ({Path.GetFileName(safetyBackupPath)}).";
                    }
                    catch (Exception rollEx)
                    {
                        errorMessage = $"Restore failed: {ex.Message}. Rollback attempt also encountered an error: {rollEx.Message}. Safety backup is preserved at: {safetyBackupPath}";
                    }
                }
                else
                {
                    errorMessage = $"Restore failed: {ex.Message}.";
                }

                return false;
            }
        }

        public static bool RestoreBackup(string backupFilePath, out string safetyBackupPath, out string errorMessage)
        {
            return RestoreBackup(backupFilePath, out safetyBackupPath, out _, out errorMessage);
        }

        public static bool RestoreBackup(string backupFilePath)
        {
            if (!RestoreBackup(backupFilePath, out string safetyBackup, out string errorMessage))
            {
                throw new InvalidOperationException(errorMessage ?? "Database restore failed.");
            }
            return true;
        }
    }
}
