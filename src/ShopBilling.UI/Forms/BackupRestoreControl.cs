using System;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;
using ShopBilling.Data.Database;

namespace ShopBilling.UI.Forms
{
    public class BackupRestoreControl : UserControl
    {
        private TextBox txtBackupFolder;
        private Button btnBrowseFolder;
        private Button btnCreateBackup;
        private Label lblBackupResult;

        private TextBox txtRestoreFile;
        private Button btnBrowseFile;
        private Button btnRestoreBackup;
        private Label lblRestoreResult;

        private DataGridView gridBackups;
        private Button btnRefreshBackups;
        private Button btnOpenFolder;

        public BackupRestoreControl()
        {
            InitializeComponent();
            LoadRecentBackups();
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
                Text = "Database Backup & Disaster Recovery",
                Font = new Font("Segoe UI", 15f, FontStyle.Bold),
                ForeColor = Color.FromArgb(24, 43, 73),
                Dock = DockStyle.Top,
                Height = 35
            };

            var lblSubtitle = new Label
            {
                Text = "Safe atomic snapshotting via SQLite Online Backup API, transaction lock protection, and verifiable integrity checks.",
                Font = new Font("Segoe UI", 9.5f),
                ForeColor = Color.FromArgb(100, 116, 139),
                Dock = DockStyle.Top,
                Height = 30
            };

            // Content Flow / Panels
            var pnlCards = new TableLayoutPanel
            {
                Dock = DockStyle.Top,
                ColumnCount = 2,
                RowCount = 1,
                Height = 240,
                Padding = new Padding(0, 10, 0, 10)
            };
            pnlCards.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
            pnlCards.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));

            // Card 1: Create Backup
            var grpBackup = new GroupBox
            {
                Text = "  Create Immediate SQLite Snapshot  ",
                Dock = DockStyle.Fill,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(31, 78, 121),
                Padding = new Padding(16)
            };

            var lblFolderDesc = new Label
            {
                Text = "Backup Folder:",
                Location = new Point(16, 32),
                AutoSize = true,
                Font = new Font("Segoe UI", 9f)
            };

            var defaultFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ShopBilling", "Backups");
            txtBackupFolder = new TextBox
            {
                Text = defaultFolder,
                Location = new Point(16, 54),
                Width = 360,
                Font = new Font("Segoe UI", 9f)
            };

            btnBrowseFolder = new Button
            {
                Text = "Browse...",
                Location = new Point(385, 52),
                Size = new Size(80, 28),
                Font = new Font("Segoe UI", 8.5f),
                FlatStyle = FlatStyle.Flat
            };
            btnBrowseFolder.Click += (s, e) =>
            {
                using (var fbd = new FolderBrowserDialog())
                {
                    fbd.SelectedPath = txtBackupFolder.Text;
                    if (fbd.ShowDialog() == DialogResult.OK)
                    {
                        txtBackupFolder.Text = fbd.SelectedPath;
                    }
                }
            };

            btnCreateBackup = new Button
            {
                Text = "💾 Create Instant Backup (.db)",
                Location = new Point(16, 95),
                Size = new Size(240, 36),
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                BackColor = Color.FromArgb(16, 110, 190),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnCreateBackup.Click += (s, e) => ExecuteBackup();

            lblBackupResult = new Label
            {
                Text = "",
                Location = new Point(16, 142),
                Size = new Size(450, 45),
                Font = new Font("Segoe UI", 8.5f),
                ForeColor = Color.FromArgb(22, 101, 52)
            };

            grpBackup.Controls.AddRange(new Control[] { lblFolderDesc, txtBackupFolder, btnBrowseFolder, btnCreateBackup, lblBackupResult });

            // Card 2: Restore Backup
            var grpRestore = new GroupBox
            {
                Text = "  Restore Database from Backup  ",
                Dock = DockStyle.Fill,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(180, 40, 40),
                Padding = new Padding(16)
            };

            var lblFileDesc = new Label
            {
                Text = "Select Backup File (.db):",
                Location = new Point(16, 32),
                AutoSize = true,
                Font = new Font("Segoe UI", 9f)
            };

            txtRestoreFile = new TextBox
            {
                Location = new Point(16, 54),
                Width = 360,
                Font = new Font("Segoe UI", 9f)
            };

            btnBrowseFile = new Button
            {
                Text = "Browse...",
                Location = new Point(385, 52),
                Size = new Size(80, 28),
                Font = new Font("Segoe UI", 8.5f),
                FlatStyle = FlatStyle.Flat
            };
            btnBrowseFile.Click += (s, e) =>
            {
                using (var ofd = new OpenFileDialog())
                {
                    ofd.Filter = "SQLite Backup (*.db)|*.db|All Files (*.*)|*.*";
                    ofd.InitialDirectory = txtBackupFolder.Text;
                    if (ofd.ShowDialog() == DialogResult.OK)
                    {
                        txtRestoreFile.Text = ofd.FileName;
                    }
                }
            };

            btnRestoreBackup = new Button
            {
                Text = "⚠️ Restore Database Snapshot",
                Location = new Point(16, 95),
                Size = new Size(240, 36),
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                BackColor = Color.FromArgb(192, 57, 43),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnRestoreBackup.Click += (s, e) => ExecuteRestore();

            lblRestoreResult = new Label
            {
                Text = "",
                Location = new Point(16, 142),
                Size = new Size(450, 45),
                Font = new Font("Segoe UI", 8.5f),
                ForeColor = Color.FromArgb(180, 40, 40)
            };

            grpRestore.Controls.AddRange(new Control[] { lblFileDesc, txtRestoreFile, btnBrowseFile, btnRestoreBackup, lblRestoreResult });

            pnlCards.Controls.Add(grpBackup, 0, 0);
            pnlCards.Controls.Add(grpRestore, 1, 0);

            // History Section
            var pnlGridHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 40,
                Padding = new Padding(0, 8, 0, 4)
            };

            var lblGridTitle = new Label
            {
                Text = "Existing Backup Snapshots in Target Folder",
                Font = new Font("Segoe UI", 11f, FontStyle.Bold),
                ForeColor = Color.FromArgb(30, 41, 59),
                Dock = DockStyle.Left,
                AutoSize = true
            };

            btnRefreshBackups = new Button
            {
                Text = "🔄 Refresh List",
                Dock = DockStyle.Right,
                Width = 110,
                Font = new Font("Segoe UI", 8.5f),
                FlatStyle = FlatStyle.Flat
            };
            btnRefreshBackups.Click += (s, e) => LoadRecentBackups();

            btnOpenFolder = new Button
            {
                Text = "📁 Open Folder",
                Dock = DockStyle.Right,
                Width = 110,
                Font = new Font("Segoe UI", 8.5f),
                FlatStyle = FlatStyle.Flat
            };
            btnOpenFolder.Click += (s, e) =>
            {
                try
                {
                    if (Directory.Exists(txtBackupFolder.Text))
                    {
                        System.Diagnostics.Process.Start("explorer.exe", txtBackupFolder.Text);
                    }
                }
                catch { }
            };

            pnlGridHeader.Controls.Add(lblGridTitle);
            pnlGridHeader.Controls.Add(btnRefreshBackups);
            pnlGridHeader.Controls.Add(btnOpenFolder);

            gridBackups = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.Fixed3D,
                RowHeadersVisible = false,
                AllowUserToAddRows = false,
                ReadOnly = true,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill
            };
            gridBackups.Columns.Add("FileName", "File Name");
            gridBackups.Columns.Add("Created", "Timestamp");
            gridBackups.Columns.Add("Size", "Size");
            gridBackups.Columns.Add("FullPath", "Full Path");
            gridBackups.Columns["FullPath"].Visible = false;

            gridBackups.CellDoubleClick += (s, e) =>
            {
                if (e.RowIndex >= 0)
                {
                    txtRestoreFile.Text = gridBackups.Rows[e.RowIndex].Cells["FullPath"].Value?.ToString();
                }
            };

            var pnlGridContainer = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(0, 10, 0, 0)
            };
            pnlGridContainer.Controls.Add(gridBackups);
            pnlGridContainer.Controls.Add(pnlGridHeader);

            pnlMain.Controls.Add(pnlGridContainer);
            pnlMain.Controls.Add(pnlCards);
            pnlMain.Controls.Add(lblSubtitle);
            pnlMain.Controls.Add(lblTitle);

            this.Controls.Add(pnlMain);
        }

        private void ExecuteBackup()
        {
            try
            {
                btnCreateBackup.Enabled = false;
                btnCreateBackup.Text = "Creating Snapshot...";

                string targetFolder = txtBackupFolder.Text.Trim();
                if (string.IsNullOrEmpty(targetFolder))
                {
                    targetFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ShopBilling", "Backups");
                }

                string backupPath = DatabaseBackupService.CreateBackup(targetFolder);
                lblBackupResult.ForeColor = Color.FromArgb(22, 101, 52);
                lblBackupResult.Text = $"✓ Success! Backup saved:\n{Path.GetFileName(backupPath)} ({new FileInfo(backupPath).Length / 1024} KB)";

                LoadRecentBackups();
            }
            catch (Exception ex)
            {
                lblBackupResult.ForeColor = Color.FromArgb(192, 57, 43);
                lblBackupResult.Text = $"✗ Backup error: {ex.Message}";
                MessageBox.Show("Backup creation failed:\n" + ex.Message, "Backup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                btnCreateBackup.Enabled = true;
                btnCreateBackup.Text = "💾 Create Instant Backup (.db)";
            }
        }

        private void ExecuteRestore()
        {
            string filePath = txtRestoreFile.Text.Trim();
            if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
            {
                MessageBox.Show("Please select a valid SQLite backup file (.db) to restore.", "File Required", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            // Step 1: Pre-validate backup file integrity and schema compatibility
            if (!DatabaseBackupService.ValidateBackupFile(filePath, out string validationError))
            {
                lblRestoreResult.ForeColor = Color.FromArgb(192, 57, 43);
                lblRestoreResult.Text = $"✗ Invalid backup file: {validationError}";
                MessageBox.Show($"Selected file failed integrity verification:\n\n{validationError}\n\nRestore aborted to protect production data.", "Validation Failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            var confirm = MessageBox.Show(
                $"RESTORE VERIFICATION PASSED.\n\nFile: {Path.GetFileName(filePath)}\n\nWARNING: Restoring will replace the active database with this backup snapshot.\nAn automatic safety backup of current data will be created first.\n\nDo you want to proceed with the restore?",
                "Confirm Database Restore",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning,
                MessageBoxDefaultButton.Button2
            );

            if (confirm != DialogResult.Yes) return;

            try
            {
                btnRestoreBackup.Enabled = false;
                btnRestoreBackup.Text = "Restoring...";

                bool restored = DatabaseBackupService.RestoreBackup(filePath, out string safetyBackupPath, out string summaryMessage, out string errorMessage);
                if (restored)
                {
                    lblRestoreResult.ForeColor = Color.FromArgb(22, 101, 52);
                    lblRestoreResult.Text = $"✓ Database snapshot restored & verified!\n{summaryMessage}\nSafety backup: {Path.GetFileName(safetyBackupPath)}\nPlease restart application to reload all tables.";
                    MessageBox.Show(
                        $"Database restored successfully from:\n{Path.GetFileName(filePath)}\n\n{summaryMessage}\n\nAn automatic safety backup was saved at:\n{safetyBackupPath}\n\nPlease restart the application to reload cached state.",
                        "Restore Complete",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information
                    );
                    LoadRecentBackups();
                }
                else
                {
                    lblRestoreResult.ForeColor = Color.FromArgb(192, 57, 43);
                    lblRestoreResult.Text = $"✗ Restore failed: {errorMessage}";
                    MessageBox.Show("Database restore failed:\n\n" + errorMessage, "Restore Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            catch (Exception ex)
            {
                lblRestoreResult.ForeColor = Color.FromArgb(192, 57, 43);
                lblRestoreResult.Text = $"✗ Unexpected restore error: {ex.Message}";
                MessageBox.Show("Unexpected error during restore:\n" + ex.Message, "Restore Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                btnRestoreBackup.Enabled = true;
                btnRestoreBackup.Text = "⚠️ Restore Database Snapshot";
            }
        }

        private void LoadRecentBackups()
        {
            gridBackups.Rows.Clear();
            string folder = txtBackupFolder.Text.Trim();
            if (!Directory.Exists(folder)) return;

            try
            {
                var dir = new DirectoryInfo(folder);
                var files = dir.GetFiles("*.db").OrderByDescending(f => f.LastWriteTimeUtc).ToList();
                foreach (var file in files)
                {
                    gridBackups.Rows.Add(
                        file.Name,
                        file.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss"),
                        $"{Math.Round(file.Length / 1024.0, 1)} KB",
                        file.FullName
                    );
                }
            }
            catch { }
        }
    }
}
