using System;
using System.Drawing;
using System.Windows.Forms;
using ShopBilling.Core.Models;
using ShopBilling.Core.Services;

namespace ShopBilling.UI.Forms
{
    public class DataManagementControl : UserControl
    {
        private readonly DataManagementService _dataManagementService;

        private Label lblDbPath;
        private Label lblDbSize;
        private Label lblWalMode;
        private Label lblFkStatus;
        private DataGridView gridTableCounts;
        private DataGridView gridIntegrityIssues;
        private Label lblIntegrityStatus;
        private Button btnRunIntegrity;
        private Button btnOptimize;

        public DataManagementControl(DataManagementService dataManagementService)
        {
            _dataManagementService = dataManagementService ?? throw new ArgumentNullException(nameof(dataManagementService));
            InitializeComponent();
            LoadDatabaseInfo();
        }

        private void InitializeComponent()
        {
            this.Dock = DockStyle.Fill;
            this.BackColor = Color.FromArgb(243, 244, 246);
            this.Font = new Font("Segoe UI", 9f);

            var pnlMain = new Panel
            {
                Dock = DockStyle.Fill,
                AutoScroll = true,
                Padding = new Padding(24)
            };

            // Header
            var lblTitle = new Label
            {
                Text = "SQLite Database & System Data Management",
                Font = new Font("Segoe UI", 15f, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 73),
                Dock = DockStyle.Top,
                Height = 35
            };

            var lblSubtitle = new Label
            {
                Text = "Read-only database diagnostics, ACID integrity audits, record counts, and zero-data-loss vacuum optimization.",
                Font = new Font("Segoe UI", 9.5f),
                ForeColor = Color.FromArgb(100, 116, 139),
                Dock = DockStyle.Top,
                Height = 30
            };

            // DB Overview Card
            var pnlDbCard = new Panel
            {
                Dock = DockStyle.Top,
                Height = 110,
                BackColor = Color.White,
                Padding = new Padding(16),
                Margin = new Padding(0, 10, 0, 15)
            };

            var lblCardTitle = new Label
            {
                Text = "DATABASE STATUS & STORAGE",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(71, 85, 105),
                Location = new Point(16, 12),
                AutoSize = true
            };

            lblDbPath = new Label { Text = "Database Path: Loading...", Location = new Point(16, 36), AutoSize = true, ForeColor = Color.FromArgb(30, 41, 59) };
            lblDbSize = new Label { Text = "Database File Size: Loading...", Location = new Point(16, 58), AutoSize = true, ForeColor = Color.FromArgb(30, 41, 59) };
            lblWalMode = new Label { Text = "Journal Mode: WAL (Write-Ahead Logging)", Location = new Point(500, 36), AutoSize = true, ForeColor = Color.DarkGreen, Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
            lblFkStatus = new Label { Text = "Foreign Key Enforcement: Active (PRAGMA foreign_keys = ON)", Location = new Point(500, 58), AutoSize = true, ForeColor = Color.DarkBlue, Font = new Font("Segoe UI", 9f, FontStyle.Bold) };

            pnlDbCard.Controls.AddRange(new Control[] { lblCardTitle, lblDbPath, lblDbSize, lblWalMode, lblFkStatus });

            // Actions Strip
            var pnlActionButtons = new Panel
            {
                Dock = DockStyle.Top,
                Height = 55,
                Margin = new Padding(0, 10, 0, 10)
            };

            btnRunIntegrity = new Button
            {
                Text = "🛡 Run Integrity Audit",
                Size = new Size(180, 38),
                Location = new Point(0, 8),
                BackColor = Color.FromArgb(16, 110, 190),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnRunIntegrity.FlatAppearance.BorderSize = 0;
            btnRunIntegrity.Click += (s, e) => RunIntegrityAudit();

            btnOptimize = new Button
            {
                Text = "⚡ Optimize & VACUUM",
                Size = new Size(180, 38),
                Location = new Point(190, 8),
                BackColor = Color.FromArgb(46, 125, 50),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnOptimize.FlatAppearance.BorderSize = 0;
            btnOptimize.Click += (s, e) => OptimizeDatabase();

            pnlActionButtons.Controls.Add(btnRunIntegrity);
            pnlActionButtons.Controls.Add(btnOptimize);

            // Split Grids Container: Table Counts on left, Integrity Audit on right
            var pnlGrids = new TableLayoutPanel
            {
                Dock = DockStyle.Top,
                Height = 350,
                ColumnCount = 2,
                RowCount = 1,
                Margin = new Padding(0, 10, 0, 0)
            };
            pnlGrids.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 40f));
            pnlGrids.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 60f));

            // Left Grid: Table Record Counts
            var pnlLeftGrid = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12) };
            var lblTableCountTitle = new Label { Text = "Database Table Record Counts", Font = new Font("Segoe UI", 10f, FontStyle.Bold), Dock = DockStyle.Top, Height = 25 };
            gridTableCounts = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.None,
                RowHeadersVisible = false,
                AllowUserToAddRows = false,
                ReadOnly = true,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill
            };
            gridTableCounts.Columns.Add("Table", "Relational Table");
            gridTableCounts.Columns.Add("Count", "Active Records");
            pnlLeftGrid.Controls.Add(gridTableCounts);
            pnlLeftGrid.Controls.Add(lblTableCountTitle);

            // Right Grid: Integrity Issues
            var pnlRightGrid = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12) };
            lblIntegrityStatus = new Label { Text = "Integrity Audit Results (Click 'Run Integrity Audit')", Font = new Font("Segoe UI", 10f, FontStyle.Bold), Dock = DockStyle.Top, Height = 25 };
            gridIntegrityIssues = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.None,
                RowHeadersVisible = false,
                AllowUserToAddRows = false,
                ReadOnly = true,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill
            };
            gridIntegrityIssues.Columns.Add("Category", "Check Category");
            gridIntegrityIssues.Columns.Add("Severity", "Severity");
            gridIntegrityIssues.Columns.Add("Entity", "Entity Key");
            gridIntegrityIssues.Columns.Add("Description", "Audit Verification Message");
            pnlRightGrid.Controls.Add(gridIntegrityIssues);
            pnlRightGrid.Controls.Add(lblIntegrityStatus);

            pnlGrids.Controls.Add(pnlLeftGrid, 0, 0);
            pnlGrids.Controls.Add(pnlRightGrid, 1, 0);

            pnlMain.Controls.Add(pnlGrids);
            pnlMain.Controls.Add(pnlActionButtons);
            pnlMain.Controls.Add(pnlDbCard);
            pnlMain.Controls.Add(lblSubtitle);
            pnlMain.Controls.Add(lblTitle);

            this.Controls.Add(pnlMain);
        }

        public void LoadDatabaseInfo()
        {
            try
            {
                var info = _dataManagementService.GetDatabaseInfo();

                lblDbPath.Text = $"Database Path: {info.DatabasePath}";
                lblDbSize.Text = $"Database File Size: {info.DatabaseFileSize} ({info.FileSizeBytes:N0} bytes)";
                lblWalMode.Text = $"Journal Mode: {info.WalMode} (High-Concurrency Read/Write)";
                lblFkStatus.Text = $"Foreign Key Constraints: {(info.ForeignKeysEnabled ? "Active & Enforced" : "Disabled")}";

                gridTableCounts.Rows.Clear();
                foreach (var kvp in info.RecordCounts)
                {
                    gridTableCounts.Rows.Add(kvp.Key, kvp.Value.ToString("N0"));
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error loading database metadata: " + ex.Message, "Database Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void RunIntegrityAudit()
        {
            try
            {
                btnRunIntegrity.Enabled = false;
                btnRunIntegrity.Text = "Auditing...";

                var result = _dataManagementService.RunIntegrityCheck();

                gridIntegrityIssues.Rows.Clear();

                if (result.IsDatabaseHealthy && result.IssuesFound.Count == 0)
                {
                    lblIntegrityStatus.Text = "✓ Database is completely healthy (Zero anomalies detected)";
                    lblIntegrityStatus.ForeColor = Color.DarkGreen;
                    gridIntegrityIssues.Rows.Add("Engine", "Healthy", "DB", "PRAGMA integrity_check: ok. All foreign keys and unique constraints verified.");
                }
                else
                {
                    lblIntegrityStatus.Text = $"⚠ Found {result.IssuesFound.Count} items to inspect";
                    lblIntegrityStatus.ForeColor = Color.DarkRed;

                    foreach (var issue in result.IssuesFound)
                    {
                        gridIntegrityIssues.Rows.Add(
                            issue.Category,
                            issue.Severity,
                            issue.EntityId,
                            issue.Description
                        );
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error running integrity check: " + ex.Message, "Audit Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                btnRunIntegrity.Enabled = true;
                btnRunIntegrity.Text = "🛡 Run Integrity Audit";
            }
        }

        private void OptimizeDatabase()
        {
            var confirm = MessageBox.Show(
                "This will execute a safe SQLite VACUUM and rebuild internal query indexes.\n\nNo records will be altered or deleted.\n\nDo you wish to proceed?",
                "Confirm SQLite Optimization",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question
            );

            if (confirm != DialogResult.Yes) return;

            try
            {
                btnOptimize.Enabled = false;
                btnOptimize.Text = "Optimizing...";

                bool success = _dataManagementService.OptimizeDatabase(out string msg);
                if (success)
                {
                    MessageBox.Show(msg, "Optimization Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    LoadDatabaseInfo();
                }
                else
                {
                    MessageBox.Show(msg, "Optimization Warning", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error optimizing database: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                btnOptimize.Enabled = true;
                btnOptimize.Text = "⚡ Optimize & VACUUM";
            }
        }
    }
}
