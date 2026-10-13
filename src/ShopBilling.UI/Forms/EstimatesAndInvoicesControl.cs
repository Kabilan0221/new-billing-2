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
    public class EstimatesAndInvoicesControl : UserControl
    {
        private readonly EstimateService _estimateService;
        private readonly ProductService _productService;
        private readonly CustomerService _customerService;

        private DataGridView gridEstimates;
        private DataGridView gridItems;
        private TextBox txtSearch;
        private ComboBox cmbStatus;
        private Label lblTotalEstimates;
        private Label lblTotalValue;
        private Label lblConvertedCount;

        public event Action<string> OnNavigateToInvoice;

        public EstimatesAndInvoicesControl(
            EstimateService estimateService,
            ProductService productService,
            CustomerService customerService)
        {
            _estimateService = estimateService ?? throw new ArgumentNullException(nameof(estimateService));
            _productService = productService ?? throw new ArgumentNullException(nameof(productService));
            _customerService = customerService;

            InitializeComponent();
            LoadEstimates();
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
                Text = "ESTIMATES & PRO-FORMA INVOICES (F9)",
                Font = new Font("Segoe UI", 12f, FontStyle.Bold),
                ForeColor = Color.White,
                AutoSize = true,
                Location = new Point(16, 10)
            };

            var lblSubtitle = new Label
            {
                Text = "Create commercial quotations and pro-forma estimates with GST. Convert approved estimates into finalized tax invoices with atomic stock validation.",
                Font = new Font("Segoe UI", 8.5f),
                ForeColor = Color.FromArgb(203, 213, 225),
                AutoSize = true,
                Location = new Point(16, 36)
            };

            pnlHeader.Controls.Add(lblTitle);
            pnlHeader.Controls.Add(lblSubtitle);

            // Toolbar
            var pnlToolbar = new Panel
            {
                Dock = DockStyle.Top,
                Height = 52,
                BackColor = Color.White,
                Padding = new Padding(12, 10, 12, 10)
            };

            var btnNewEstimate = new Button
            {
                Text = "+ New Estimate",
                Location = new Point(12, 10),
                Size = new Size(130, 32),
                BackColor = Color.FromArgb(16, 110, 190),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnNewEstimate.Click += (s, e) => OpenNewEstimateDialog();

            var lblSearch = new Label { Text = "Search:", Location = new Point(155, 17), AutoSize = true, Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
            txtSearch = new TextBox { Location = new Point(210, 14), Width = 190, Font = new Font("Segoe UI", 9.5f) };
            txtSearch.TextChanged += (s, e) => LoadEstimates();

            var lblStatus = new Label { Text = "Status:", Location = new Point(415, 17), AutoSize = true, Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
            cmbStatus = new ComboBox { Location = new Point(465, 14), Width = 110, DropDownStyle = ComboBoxStyle.DropDownList };
            cmbStatus.Items.AddRange(new object[] { "All", "Draft", "Confirmed", "Converted", "Cancelled" });
            cmbStatus.SelectedIndex = 0;
            cmbStatus.SelectedIndexChanged += (s, e) => LoadEstimates();

            var btnPrintEstimate = new Button
            {
                Text = "Print / Preview",
                Location = new Point(590, 10),
                Size = new Size(115, 32),
                BackColor = Color.FromArgb(240, 240, 240),
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnPrintEstimate.Click += (s, e) => PrintSelectedEstimate();

            var btnConvert = new Button
            {
                Text = "Convert to Invoice",
                Location = new Point(715, 10),
                Size = new Size(145, 32),
                BackColor = Color.FromArgb(5, 150, 105),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnConvert.Click += (s, e) => ConvertSelectedToInvoice();

            var btnCancel = new Button
            {
                Text = "Cancel Estimate",
                Location = new Point(870, 10),
                Size = new Size(115, 32),
                BackColor = Color.FromArgb(254, 242, 242),
                ForeColor = Color.FromArgb(185, 28, 28),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnCancel.Click += (s, e) => CancelSelectedEstimate();

            pnlToolbar.Controls.AddRange(new Control[] { btnNewEstimate, lblSearch, txtSearch, lblStatus, cmbStatus, btnPrintEstimate, btnConvert, btnCancel });

            // Split Container (Top: Estimates Grid, Bottom: Selected Estimate Line Items)
            var split = new SplitContainer
            {
                Dock = DockStyle.Fill,
                Orientation = Orientation.Horizontal,
                SplitterDistance = 380,
                Panel1MinSize = 200,
                Panel2MinSize = 160
            };

            // Grid Estimates
            gridEstimates = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.Fixed3D,
                RowHeadersVisible = false,
                AllowUserToAddRows = false,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                MultiSelect = false,
                AutoGenerateColumns = false
            };

            gridEstimates.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Estimate #", DataPropertyName = "EstimateNumber", Width = 130 });
            gridEstimates.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Date", DataPropertyName = "EstimateDate", Width = 130, DefaultCellStyle = { Format = "dd-MMM-yyyy hh:mm tt" } });
            gridEstimates.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Customer", DataPropertyName = "CustomerName", Width = 180 });
            gridEstimates.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Phone", DataPropertyName = "CustomerMobile", Width = 110 });
            gridEstimates.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Items", DataPropertyName = "TotalItems", Width = 65, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleCenter } });
            gridEstimates.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Qty", DataPropertyName = "TotalQty", Width = 65, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleCenter } });
            gridEstimates.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Taxable", DataPropertyName = "TaxableAmount", Width = 95, DefaultCellStyle = { Format = "N2", Alignment = DataGridViewContentAlignment.MiddleRight } });
            gridEstimates.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "GST Total", DataPropertyName = "TotalTaxAmount", Width = 90, DefaultCellStyle = { Format = "N2", Alignment = DataGridViewContentAlignment.MiddleRight } });
            gridEstimates.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Grand Total", DataPropertyName = "GrandTotal", Width = 110, DefaultCellStyle = { Format = "N2", Alignment = DataGridViewContentAlignment.MiddleRight, Font = new Font("Segoe UI", 9f, FontStyle.Bold) } });
            gridEstimates.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Status", DataPropertyName = "Status", Width = 100 });
            gridEstimates.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Converted Invoice", DataPropertyName = "ConvertedInvoiceNumber", Width = 140 });

            gridEstimates.SelectionChanged += (s, e) => DisplaySelectedItems();

            split.Panel1.Controls.Add(gridEstimates);

            // Detail Grid on Bottom
            var pnlDetailHeader = new Panel { Dock = DockStyle.Top, Height = 28, BackColor = Color.FromArgb(241, 245, 249), Padding = new Padding(8, 5, 8, 0) };
            var lblDetailTitle = new Label { Text = "ESTIMATE LINE ITEMS & TAX BREAKDOWN (No stock deducted until converted)", Font = new Font("Segoe UI", 8.5f, FontStyle.Bold), ForeColor = Color.FromArgb(51, 65, 85), Dock = DockStyle.Fill };
            pnlDetailHeader.Controls.Add(lblDetailTitle);

            gridItems = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.Fixed3D,
                RowHeadersVisible = false,
                AllowUserToAddRows = false,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                AutoGenerateColumns = false
            };

            gridItems.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Product Code", DataPropertyName = "ProductCode", Width = 110 });
            gridItems.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Barcode", DataPropertyName = "Barcode", Width = 130 });
            gridItems.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Product Description", DataPropertyName = "ProductName", Width = 240 });
            gridItems.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Unit", DataPropertyName = "Unit", Width = 60 });
            gridItems.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Qty", DataPropertyName = "Quantity", Width = 70, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleRight } });
            gridItems.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Rate (₹)", DataPropertyName = "Rate", Width = 85, DefaultCellStyle = { Format = "N2", Alignment = DataGridViewContentAlignment.MiddleRight } });
            gridItems.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Disc (₹)", DataPropertyName = "DiscountAmount", Width = 75, DefaultCellStyle = { Format = "N2", Alignment = DataGridViewContentAlignment.MiddleRight } });
            gridItems.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Taxable", DataPropertyName = "TaxableAmount", Width = 85, DefaultCellStyle = { Format = "N2", Alignment = DataGridViewContentAlignment.MiddleRight } });
            gridItems.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "GST %", DataPropertyName = "TaxRate", Width = 65, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleCenter } });
            gridItems.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "GST (₹)", DataPropertyName = "TaxAmount", Width = 75, DefaultCellStyle = { Format = "N2", Alignment = DataGridViewContentAlignment.MiddleRight } });
            gridItems.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Line Total (₹)", DataPropertyName = "LineTotal", Width = 110, DefaultCellStyle = { Format = "N2", Alignment = DataGridViewContentAlignment.MiddleRight, Font = new Font("Segoe UI", 9f, FontStyle.Bold) } });

            split.Panel2.Controls.Add(gridItems);
            split.Panel2.Controls.Add(pnlDetailHeader);

            // Footer Status
            var pnlFooter = new Panel { Dock = DockStyle.Bottom, Height = 34, BackColor = Color.White, Padding = new Padding(12, 6, 12, 6) };
            lblTotalEstimates = new Label { Text = "Estimates: 0", AutoSize = true, Location = new Point(12, 8), Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
            lblTotalValue = new Label { Text = "Quoted Value: ₹0.00", AutoSize = true, Location = new Point(200, 8), Font = new Font("Segoe UI", 9f, FontStyle.Bold), ForeColor = Color.FromArgb(16, 110, 190) };
            lblConvertedCount = new Label { Text = "Converted: 0", AutoSize = true, Location = new Point(480, 8), Font = new Font("Segoe UI", 9f, FontStyle.Bold), ForeColor = Color.FromArgb(5, 150, 105) };

            pnlFooter.Controls.AddRange(new Control[] { lblTotalEstimates, lblTotalValue, lblConvertedCount });

            this.Controls.Add(split);
            this.Controls.Add(pnlFooter);
            this.Controls.Add(pnlToolbar);
            this.Controls.Add(pnlHeader);
        }

        private void LoadEstimates()
        {
            var filter = new EstimateFilter
            {
                SearchTerm = txtSearch.Text,
                Status = cmbStatus.SelectedItem?.ToString() ?? "All",
                PageNumber = 1,
                PageSize = 100
            };

            var res = _estimateService.SearchEstimates(filter);
            gridEstimates.DataSource = res.Items;

            lblTotalEstimates.Text = $"Total Estimates: {res.TotalCount}";
            decimal totalVal = res.Items.Sum(e => e.GrandTotal);
            int converted = res.Items.Count(e => e.Status == "Converted");
            lblTotalValue.Text = $"Quoted Pipeline Value: ₹{totalVal:N2}";
            lblConvertedCount.Text = $"Successfully Converted: {converted}";

            DisplaySelectedItems();
        }

        private void DisplaySelectedItems()
        {
            if (gridEstimates.CurrentRow?.DataBoundItem is EstimateHeader est)
            {
                gridItems.DataSource = est.Items;
            }
            else
            {
                gridItems.DataSource = null;
            }
        }

        private void OpenNewEstimateDialog()
        {
            var allProducts = _productService.Search("", 1, 500).Items;
            var walkIn = _customerService?.GetById(1) ?? new Customer { Id = 1, Name = "Walk-in Customer", Mobile = "9999999999", StateCode = "33", State = "Tamil Nadu" };

            // Prompt simple entry dialog or create standard estimate
            var est = new EstimateHeader
            {
                CustomerId = walkIn.Id,
                CustomerName = walkIn.Name,
                CustomerMobile = walkIn.Mobile,
                StateCode = walkIn.StateCode ?? "33",
                StateName = walkIn.State ?? "Tamil Nadu",
                EstimateDate = DateTime.Now,
                ValidUntil = DateTime.Now.AddDays(15),
                Status = "Draft",
                Items = new List<EstimateItem>()
            };

            // Add first sample product for convenience if available
            if (allProducts.Count > 0)
            {
                var p = allProducts[0];
                est.Items.Add(new EstimateItem
                {
                    ProductId = p.Id,
                    ProductCode = p.ProductCode,
                    Barcode = p.Barcode,
                    ProductName = p.NameEn,
                    Unit = p.Unit,
                    Quantity = 2,
                    Rate = p.SaleRate,
                    TaxRate = p.TaxRate,
                    DiscountPercent = 0
                });
            }

            var val = _estimateService.SaveDraft(est);
            if (val.IsValid)
            {
                LoadEstimates();
                MessageBox.Show($"New Estimate #{est.EstimateNumber} created as Draft for ₹{est.GrandTotal:N2}.\nNotice: Inventory stock has NOT been deducted.", "Estimate Created", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            else
            {
                MessageBox.Show(string.Join("\n", val.Errors), "Validation Error", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void PrintSelectedEstimate()
        {
            if (gridEstimates.CurrentRow?.DataBoundItem is EstimateHeader est)
            {
                // Full reload to guarantee line items
                var full = _estimateService.GetById(est.Id);
                EstimatePrintHelper.PrintEstimate(full ?? est);
            }
            else
            {
                MessageBox.Show("Please select an estimate to print.", "Notice", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void ConvertSelectedToInvoice()
        {
            if (gridEstimates.CurrentRow?.DataBoundItem is EstimateHeader est)
            {
                if (est.Status == "Converted")
                {
                    MessageBox.Show($"Estimate #{est.EstimateNumber} has already been converted to Invoice #{est.ConvertedInvoiceNumber}.", "Already Converted", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }

                if (est.Status == "Cancelled")
                {
                    MessageBox.Show("Cannot convert a cancelled estimate.", "Invalid Action", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }

                var dlg = MessageBox.Show(
                    $"Are you sure you want to convert Estimate #{est.EstimateNumber} into a finalized Tax Invoice?\n\nTotal: ₹{est.GrandTotal:N2}\nItems: {est.TotalItems}\n\nThis will re-validate and deduct stock from inventory and generate a confirmed invoice.",
                    "Confirm Estimate Conversion",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question
                );

                if (dlg != DialogResult.Yes) return;

                if (_estimateService.ConvertToInvoice(est.Id, null, out InvoiceHeader createdInvoice, out string errorMessage))
                {
                    LoadEstimates();
                    MessageBox.Show(
                        $"Estimate #{est.EstimateNumber} converted successfully!\n\nNew Confirmed Invoice: {createdInvoice.InvoiceNumber}\nAmount: ₹{createdInvoice.GrandTotal:N2}\nStock has been deducted from inventory.",
                        "Conversion Succeeded",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information
                    );
                    OnNavigateToInvoice?.Invoke(createdInvoice.InvoiceNumber);
                }
                else
                {
                    MessageBox.Show($"Conversion Failed: {errorMessage}", "Conversion Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            else
            {
                MessageBox.Show("Please select an estimate to convert.", "Notice", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void CancelSelectedEstimate()
        {
            if (gridEstimates.CurrentRow?.DataBoundItem is EstimateHeader est)
            {
                if (est.Status == "Converted")
                {
                    MessageBox.Show("Cannot cancel an estimate that has already been converted to an invoice.", "Invalid Action", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }

                if (est.Status == "Cancelled")
                {
                    MessageBox.Show("This estimate is already cancelled.", "Notice", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }

                var dlg = MessageBox.Show(
                    $"Are you sure you want to cancel Estimate #{est.EstimateNumber}?",
                    "Confirm Cancellation",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning
                );

                if (dlg != DialogResult.Yes) return;

                if (_estimateService.CancelEstimate(est.Id, "Cancelled by user in UI", out string err))
                {
                    LoadEstimates();
                    MessageBox.Show($"Estimate #{est.EstimateNumber} has been marked as Cancelled.", "Cancelled", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                else
                {
                    MessageBox.Show($"Failed to cancel: {err}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
        }
    }
}
