using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;
using ShopBilling.Core.Models;
using ShopBilling.Core.Services;
using ShopBilling.UI.Utilities;

namespace ShopBilling.UI.Forms
{
    public class BarcodeStudioControl : UserControl
    {
        private readonly BarcodeService _barcodeService;
        private readonly ProductService _productService;

        private DataGridView gridProducts;
        private TextBox txtSearch;
        private ComboBox cmbBarcodeFormat;
        private NumericUpDown numLabelWidth;
        private NumericUpDown numLabelHeight;
        private NumericUpDown numLabelsPerRow;
        private NumericUpDown numHGap;
        private NumericUpDown numVGap;
        private CheckBox chkIncludeName;
        private CheckBox chkIncludePrice;
        private CheckBox chkIncludeStore;
        private TextBox txtStoreName;
        private PictureBox picPreview;
        private Label lblSelectedStats;

        private List<BarcodeStudioItem> _allLoadedItems = new List<BarcodeStudioItem>();
        private BarcodePrintConfig _config = new BarcodePrintConfig();

        public BarcodeStudioControl(BarcodeService barcodeService, ProductService productService)
        {
            _barcodeService = barcodeService ?? throw new ArgumentNullException(nameof(barcodeService));
            _productService = productService ?? throw new ArgumentNullException(nameof(productService));

            InitializeComponent();
            LoadCatalog();
        }

        private void InitializeComponent()
        {
            this.Dock = DockStyle.Fill;
            this.Font = new Font("Segoe UI", 9f);
            this.BackColor = Color.FromArgb(243, 244, 246);

            // Header Banner
            var pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 64,
                BackColor = Color.FromArgb(24, 43, 73),
                Padding = new Padding(16, 8, 16, 8)
            };

            var lblTitle = new Label
            {
                Text = "BARCODE STUDIO (F4) — Label Designer & Batch Printer",
                Font = new Font("Segoe UI", 12f, FontStyle.Bold),
                ForeColor = Color.White,
                AutoSize = true,
                Location = new Point(16, 10)
            };

            var lblSubtitle = new Label
            {
                Text = "Generate standard scannable Code 128 / EAN-13 barcodes, customize sticker layouts, and print continuous rolls or A4 sheets.",
                Font = new Font("Segoe UI", 8.5f),
                ForeColor = Color.FromArgb(203, 213, 225),
                AutoSize = true,
                Location = new Point(16, 36)
            };

            pnlHeader.Controls.Add(lblTitle);
            pnlHeader.Controls.Add(lblSubtitle);

            // Main Splitter (Left: Product Selector & Grid; Right: Layout Settings & Live Preview)
            var splitContainer = new SplitContainer
            {
                Dock = DockStyle.Fill,
                Orientation = Orientation.Vertical,
                SplitterDistance = 820,
                Panel1MinSize = 500,
                Panel2MinSize = 340
            };

            // LEFT PANEL: Search, Controls, Product Grid
            var pnlLeft = splitContainer.Panel1;
            pnlLeft.Padding = new Padding(12);

            var pnlSearch = new Panel { Dock = DockStyle.Top, Height = 48, BackColor = Color.White, Padding = new Padding(8) };
            var lblSearch = new Label { Text = "Search Catalog:", AutoSize = true, Location = new Point(8, 14), Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
            txtSearch = new TextBox { Location = new Point(110, 10), Width = 300, Font = new Font("Segoe UI", 9.5f) };
            txtSearch.TextChanged += (s, e) => FilterGrid(txtSearch.Text);

            var btnSelectAll = new Button { Text = "Select All", Location = new Point(420, 9), Size = new Size(80, 28), BackColor = Color.FromArgb(240, 240, 240) };
            btnSelectAll.Click += (s, e) => ToggleSelectAll(true);

            var btnClearSelect = new Button { Text = "Clear", Location = new Point(505, 9), Size = new Size(70, 28), BackColor = Color.FromArgb(240, 240, 240) };
            btnClearSelect.Click += (s, e) => ToggleSelectAll(false);

            var btnGenerateBarcode = new Button
            {
                Text = "Generate Barcode",
                Location = new Point(585, 9),
                Size = new Size(130, 28),
                BackColor = Color.FromArgb(16, 110, 190),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold)
            };
            btnGenerateBarcode.Click += (s, e) => GenerateBarcodeForSelected();

            pnlSearch.Controls.AddRange(new Control[] { lblSearch, txtSearch, btnSelectAll, btnClearSelect, btnGenerateBarcode });

            // Grid
            gridProducts = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.Fixed3D,
                RowHeadersVisible = false,
                AllowUserToAddRows = false,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                MultiSelect = true,
                AutoGenerateColumns = false
            };

            var colSel = new DataGridViewCheckBoxColumn { HeaderText = "Print", DataPropertyName = "IsSelected", Width = 50 };
            var colCode = new DataGridViewTextBoxColumn { HeaderText = "Product Code", DataPropertyName = "ProductCode", Width = 110, ReadOnly = true };
            var colBarcode = new DataGridViewTextBoxColumn { HeaderText = "Barcode", DataPropertyName = "Barcode", Width = 140, ReadOnly = true };
            var colName = new DataGridViewTextBoxColumn { HeaderText = "Product Name", DataPropertyName = "NameEn", Width = 220, ReadOnly = true };
            var colPrice = new DataGridViewTextBoxColumn { HeaderText = "Sale Rate", DataPropertyName = "SaleRate", Width = 85, ReadOnly = true, DefaultCellStyle = { Format = "N2", Alignment = DataGridViewContentAlignment.MiddleRight } };
            var colStock = new DataGridViewTextBoxColumn { HeaderText = "Stock", DataPropertyName = "CurrentStock", Width = 70, ReadOnly = true, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleCenter } };
            var colQty = new DataGridViewTextBoxColumn { HeaderText = "Copies", DataPropertyName = "LabelCount", Width = 65, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleCenter } };

            gridProducts.Columns.AddRange(colSel, colCode, colBarcode, colName, colPrice, colStock, colQty);
            gridProducts.CellValueChanged += (s, e) => UpdateSelectedStatsAndPreview();
            gridProducts.CurrentCellDirtyStateChanged += (s, e) => { if (gridProducts.IsCurrentCellDirty) gridProducts.CommitEdit(DataGridViewDataErrorContexts.Commit); };
            gridProducts.SelectionChanged += (s, e) => UpdateSinglePreview();

            // Bottom stats bar on left
            var pnlLeftBottom = new Panel { Dock = DockStyle.Bottom, Height = 36, BackColor = Color.White, Padding = new Padding(8, 6, 8, 6) };
            lblSelectedStats = new Label
            {
                Text = "Selected: 0 products | 0 total labels to print",
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = Color.FromArgb(16, 110, 190),
                Dock = DockStyle.Fill
            };
            pnlLeftBottom.Controls.Add(lblSelectedStats);

            pnlLeft.Controls.Add(gridProducts);
            pnlLeft.Controls.Add(pnlLeftBottom);
            pnlLeft.Controls.Add(pnlSearch);

            // RIGHT PANEL: Label Sheet Layout & Live Preview
            var pnlRight = splitContainer.Panel2;
            pnlRight.Padding = new Padding(12);
            pnlRight.BackColor = Color.White;

            var lblRightTitle = new Label { Text = "LABEL SHEET SETTINGS", Font = new Font("Segoe UI", 10f, FontStyle.Bold), ForeColor = Color.FromArgb(24, 43, 73), Dock = DockStyle.Top, Height = 26 };

            var pnlSettings = new Panel { Dock = DockStyle.Top, Height = 310 };

            int y = 6;
            // Format
            pnlSettings.Controls.Add(new Label { Text = "Barcode Format:", Location = new Point(4, y + 4), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) });
            cmbBarcodeFormat = new ComboBox { Location = new Point(130, y), Width = 180, DropDownStyle = ComboBoxStyle.DropDownList };
            cmbBarcodeFormat.Items.AddRange(new object[] { "Code 128 (Alphanumeric)", "EAN-13 (13 Digits)" });
            cmbBarcodeFormat.SelectedIndex = 0;
            cmbBarcodeFormat.SelectedIndexChanged += (s, e) => { _config.BarcodeFormat = cmbBarcodeFormat.SelectedIndex == 1 ? "EAN13" : "Code128"; UpdateSinglePreview(); };
            pnlSettings.Controls.Add(cmbBarcodeFormat);
            y += 34;

            // Width & Height
            pnlSettings.Controls.Add(new Label { Text = "Label Width (mm):", Location = new Point(4, y + 4), AutoSize = true });
            numLabelWidth = new NumericUpDown { Location = new Point(130, y), Width = 70, Minimum = 20, Maximum = 150, Value = (decimal)_config.LabelWidthMm };
            numLabelWidth.ValueChanged += (s, e) => { _config.LabelWidthMm = (float)numLabelWidth.Value; UpdateSinglePreview(); };
            pnlSettings.Controls.Add(numLabelWidth);

            pnlSettings.Controls.Add(new Label { Text = "Height (mm):", Location = new Point(210, y + 4), AutoSize = true });
            numLabelHeight = new NumericUpDown { Location = new Point(280, y), Width = 60, Minimum = 15, Maximum = 100, Value = (decimal)_config.LabelHeightMm };
            numLabelHeight.ValueChanged += (s, e) => { _config.LabelHeightMm = (float)numLabelHeight.Value; UpdateSinglePreview(); };
            pnlSettings.Controls.Add(numLabelHeight);
            y += 34;

            // Labels Per Row
            pnlSettings.Controls.Add(new Label { Text = "Labels Per Row:", Location = new Point(4, y + 4), AutoSize = true });
            numLabelsPerRow = new NumericUpDown { Location = new Point(130, y), Width = 70, Minimum = 1, Maximum = 6, Value = _config.LabelsPerRow };
            numLabelsPerRow.ValueChanged += (s, e) => { _config.LabelsPerRow = (int)numLabelsPerRow.Value; UpdateSelectedStatsAndPreview(); };
            pnlSettings.Controls.Add(numLabelsPerRow);
            y += 34;

            // Horizontal & Vertical Gap
            pnlSettings.Controls.Add(new Label { Text = "H-Gap (mm):", Location = new Point(4, y + 4), AutoSize = true });
            numHGap = new NumericUpDown { Location = new Point(130, y), Width = 70, Minimum = 0, Maximum = 20, Value = (decimal)_config.HorizontalGapMm };
            numHGap.ValueChanged += (s, e) => { _config.HorizontalGapMm = (float)numHGap.Value; };
            pnlSettings.Controls.Add(numHGap);

            pnlSettings.Controls.Add(new Label { Text = "V-Gap (mm):", Location = new Point(210, y + 4), AutoSize = true });
            numVGap = new NumericUpDown { Location = new Point(280, y), Width = 60, Minimum = 0, Maximum = 20, Value = (decimal)_config.VerticalGapMm };
            numVGap.ValueChanged += (s, e) => { _config.VerticalGapMm = (float)numVGap.Value; };
            pnlSettings.Controls.Add(numVGap);
            y += 34;

            // Toggles
            chkIncludeName = new CheckBox { Text = "Include Product Name", Location = new Point(4, y), AutoSize = true, Checked = _config.IncludeProductName };
            chkIncludeName.CheckedChanged += (s, e) => { _config.IncludeProductName = chkIncludeName.Checked; UpdateSinglePreview(); };
            pnlSettings.Controls.Add(chkIncludeName);
            y += 26;

            chkIncludePrice = new CheckBox { Text = "Include Price (₹)", Location = new Point(4, y), AutoSize = true, Checked = _config.IncludePrice };
            chkIncludePrice.CheckedChanged += (s, e) => { _config.IncludePrice = chkIncludePrice.Checked; UpdateSinglePreview(); };
            pnlSettings.Controls.Add(chkIncludePrice);
            y += 26;

            chkIncludeStore = new CheckBox { Text = "Include Store Name", Location = new Point(4, y), AutoSize = true, Checked = _config.IncludeStoreName };
            chkIncludeStore.CheckedChanged += (s, e) => { _config.IncludeStoreName = chkIncludeStore.Checked; UpdateSinglePreview(); };
            pnlSettings.Controls.Add(chkIncludeStore);
            y += 26;

            txtStoreName = new TextBox { Location = new Point(4, y), Width = 320, Text = _config.StoreName };
            txtStoreName.TextChanged += (s, e) => { _config.StoreName = txtStoreName.Text; UpdateSinglePreview(); };
            pnlSettings.Controls.Add(txtStoreName);
            y += 34;

            // Preview Box
            var lblPrevHeader = new Label { Text = "LIVE STICKER PREVIEW:", Font = new Font("Segoe UI", 9f, FontStyle.Bold), ForeColor = Color.FromArgb(71, 85, 105), Dock = DockStyle.Top, Height = 22 };

            picPreview = new PictureBox
            {
                Dock = DockStyle.Top,
                Height = 150,
                BackColor = Color.FromArgb(248, 250, 252),
                BorderStyle = BorderStyle.FixedSingle,
                SizeMode = PictureBoxSizeMode.CenterImage
            };

            // Print Buttons at Bottom Right
            var pnlActionButtons = new Panel { Dock = DockStyle.Bottom, Height = 90 };

            var btnPreviewSheet = new Button
            {
                Text = "Print Preview Sheet...",
                Dock = DockStyle.Top,
                Height = 38,
                BackColor = Color.FromArgb(240, 240, 240),
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnPreviewSheet.Click += (s, e) => PrintLabels(true);

            var btnPrintNow = new Button
            {
                Text = "Print Labels Now",
                Dock = DockStyle.Bottom,
                Height = 44,
                BackColor = Color.FromArgb(16, 110, 190),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnPrintNow.Click += (s, e) => PrintLabels(false);

            pnlActionButtons.Controls.Add(btnPreviewSheet);
            pnlActionButtons.Controls.Add(btnPrintNow);

            pnlRight.Controls.Add(pnlActionButtons);
            pnlRight.Controls.Add(picPreview);
            pnlRight.Controls.Add(lblPrevHeader);
            pnlRight.Controls.Add(pnlSettings);
            pnlRight.Controls.Add(lblRightTitle);

            this.Controls.Add(splitContainer);
            this.Controls.Add(pnlHeader);
        }

        private void LoadCatalog()
        {
            _allLoadedItems = _barcodeService.LoadCatalogItems();
            gridProducts.DataSource = _allLoadedItems;
            UpdateSelectedStatsAndPreview();
        }

        private void FilterGrid(string term)
        {
            if (string.IsNullOrWhiteSpace(term))
            {
                gridProducts.DataSource = _allLoadedItems;
            }
            else
            {
                string lower = term.Trim().ToLowerInvariant();
                var filtered = _allLoadedItems.Where(i =>
                    (i.NameEn != null && i.NameEn.ToLowerInvariant().Contains(lower)) ||
                    (i.ProductCode != null && i.ProductCode.ToLowerInvariant().Contains(lower)) ||
                    (i.Barcode != null && i.Barcode.ToLowerInvariant().Contains(lower))
                ).ToList();
                gridProducts.DataSource = filtered;
            }
            UpdateSelectedStatsAndPreview();
        }

        private void ToggleSelectAll(bool select)
        {
            foreach (var item in _allLoadedItems)
            {
                item.IsSelected = select;
            }
            gridProducts.Refresh();
            UpdateSelectedStatsAndPreview();
        }

        private void GenerateBarcodeForSelected()
        {
            if (gridProducts.CurrentRow?.DataBoundItem is BarcodeStudioItem item)
            {
                string format = cmbBarcodeFormat.SelectedIndex == 1 ? "EAN13" : "Code128";
                string newBc = _barcodeService.GenerateNewBarcode(format);

                if (!string.IsNullOrWhiteSpace(item.Barcode))
                {
                    var dlg = MessageBox.Show(
                        $"Product '{item.NameEn}' already has barcode '{item.Barcode}'.\nDo you want to overwrite it with newly generated barcode '{newBc}'?",
                        "Confirm Barcode Replacement",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Warning
                    );
                    if (dlg != DialogResult.Yes) return;
                }

                if (_barcodeService.AssignBarcodeToProduct(item.ProductId, newBc, true, out string err))
                {
                    item.Barcode = newBc;
                    gridProducts.Refresh();
                    UpdateSinglePreview();
                    MessageBox.Show($"Successfully generated and assigned barcode '{newBc}' to '{item.NameEn}'.", "Barcode Generated", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                else
                {
                    MessageBox.Show($"Failed: {err}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            else
            {
                MessageBox.Show("Please select a product row in the grid first.", "Notice", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void UpdateSelectedStatsAndPreview()
        {
            var (totalLabels, totalSheets) = _barcodeService.CalculateLayoutMetrics(_allLoadedItems, _config);
            int selectedProducts = _allLoadedItems.Count(i => i.IsSelected);
            lblSelectedStats.Text = $"Selected: {selectedProducts} products | {totalLabels} total labels to print (~{totalSheets} sheets on A4)";
            UpdateSinglePreview();
        }

        private void UpdateSinglePreview()
        {
            BarcodeStudioItem itemToPreview = null;
            if (gridProducts.CurrentRow?.DataBoundItem is BarcodeStudioItem sel)
            {
                itemToPreview = sel;
            }
            else
            {
                itemToPreview = _allLoadedItems.FirstOrDefault(i => i.IsSelected) ?? _allLoadedItems.FirstOrDefault();
            }

            if (itemToPreview == null)
            {
                picPreview.Image = null;
                return;
            }

            // Draw a single sticker on a bitmap
            int widthPx = (int)(_config.LabelWidthMm * 4.5f);
            int heightPx = (int)(_config.LabelHeightMm * 4.5f);

            var bmp = new Bitmap(Math.Max(120, widthPx), Math.Max(70, heightPx));
            using (var g = Graphics.FromImage(bmp))
            {
                g.Clear(Color.White);
                var rect = new RectangleF(1, 1, bmp.Width - 2, bmp.Height - 2);
                BarcodeRenderer.RenderLabel(g, rect, itemToPreview, _config);
            }

            picPreview.Image?.Dispose();
            picPreview.Image = bmp;
        }

        private void PrintLabels(bool isPreview)
        {
            var selected = _allLoadedItems.Where(i => i.IsSelected).ToList();
            if (selected.Count == 0)
            {
                MessageBox.Show("Please select at least one product using the 'Print' checkbox.", "Barcode Studio", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            BarcodeRenderer.PrintLabels(selected, _config);
        }
    }
}
