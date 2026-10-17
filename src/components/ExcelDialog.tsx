import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, Download, CheckCircle2, FileText, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../services/dbEngine';
import { Product } from '../types';

interface ExcelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const ExcelDialog: React.FC<ExcelDialogProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; errors: any[]; clearedCount?: number } | null>(null);
  
  // Import mode: 'update' (keep existing) vs 'replace' (delete/remove all existing items first)
  const [importMode, setImportMode] = useState<'update' | 'replace'>('update');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [updateDuplicates, setUpdateDuplicates] = useState(true);

  if (!isOpen) return null;

  const totalExistingProducts = db.getAllProducts().length;

  // Flexible column finder that checks multiple alias variations (case-insensitive & trimmed)
  const getCol = (row: any, aliases: string[]): string => {
    const rowKeys = Object.keys(row);
    for (const alias of aliases) {
      const target = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      const foundKey = rowKeys.find(
        (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === target
      );
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
        return row[foundKey].toString().trim();
      }
    }
    return '';
  };

  const getColNum = (row: any, aliases: string[], defaultVal: number = 0): number => {
    const str = getCol(row, aliases);
    if (!str) return defaultVal;
    const clean = str.replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? defaultVal : num;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        setParsedRows(data);
      } catch (err: any) {
        alert(`Failed to parse Excel file: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleStartImport = async () => {
    if (parsedRows.length === 0) return;
    if (importMode === 'replace' && totalExistingProducts > 0 && !confirmReplace) {
      alert('Please confirm that you want to delete all existing products before proceeding.');
      return;
    }

    setIsProcessing(true);
    setProgress(20);

    const productsToImport: Partial<Product>[] = [];

    for (const row of parsedRows) {
      const code = getCol(row, ['Product Code', 'product_code', 'Code', 'Item Code', 'ItemCode', 'SKU', 'குறியீடு']);
      const barcode = getCol(row, ['Barcode', 'barcode', 'Bar Code', 'EAN', 'UPC', 'QR Code', 'பட்டிக்குறியீடு']);
      const nameEn = getCol(row, [
        'Product Name (English)',
        'Product Name',
        'Item Name',
        'Name',
        'Description',
        'Particulars',
        'Item',
        'Product',
        'name_en',
        'பெயர்',
        'பொருள்'
      ]);
      const nameTa = getCol(row, ['Product Name (Tamil)', 'Tamil Name', 'Name (Tamil)', 'Tamil', 'name_ta', 'தமிழ் பெயர்']);
      const category = getCol(row, ['Category', 'category', 'Group', 'Category Name', 'பிரிவு']);
      const subcategory = getCol(row, ['Subcategory', 'subcategory', 'Sub Category', 'உட்பிரிவு']);
      const brand = getCol(row, ['Brand', 'brand', 'Make', 'Company', 'Manufacturer', 'பிராண்ட்']);
      const unit = getCol(row, ['Unit', 'unit', 'UOM', 'அலகு']) || 'PCS';
      const hsn = getCol(row, ['HSN Code', 'HSN', 'SAC', 'HSN/SAC']);

      const pur = getColNum(row, ['Purchase Rate', 'purchase_rate', 'Purchase Price', 'Cost', 'Cost Price', 'Buy Rate', 'கொள்முதல் விலை'], 0);
      const sale = getColNum(row, ['Sale Rate', 'sale_rate', 'Selling Price', 'Sale Price', 'Price', 'Rate', 'விற்பனை விலை'], 0);
      const ws = getColNum(row, ['Wholesale Rate', 'wholesale_rate', 'WS Rate', 'Dealer Price', 'மொத்த விலை'], Math.round(sale * 0.95));
      let mrp = getColNum(row, ['MRP', 'mrp', 'M.R.P.', 'Max Retail Price', 'அதிகபட்ச விலை'], 0);
      if (mrp < sale) {
        mrp = sale;
      }
      const tax = getColNum(row, ['Tax %', 'tax_rate', 'Tax', 'GST %', 'GST', 'Tax Rate', 'GST Rate', 'வரி %'], 0);
      const op = getColNum(row, ['Opening Stock', 'opening_stock', 'Stock', 'Current Stock', 'Qty', 'Quantity', 'தொடக்க இருப்பு'], 0);
      const reorder = getColNum(row, ['Reorder Level', 'reorder_level', 'Min Stock', 'Minimum Stock', 'குறைந்தபட்ச இருப்பு'], 5);

      // Skip empty blank rows
      if (!nameEn && !code && !barcode) continue;

      // Auto resolve or create category
      let catId: number | undefined;
      if (category) {
        const existingCat = db.getCategories().find((c) => c.name.toLowerCase() === category.toLowerCase());
        catId = existingCat ? existingCat.id : db.addCategory(category).id;
      }

      // Auto resolve or create brand
      let brandId: number | undefined;
      if (brand) {
        const existingBrand = db.getBrands().find((b) => b.name.toLowerCase() === brand.toLowerCase());
        brandId = existingBrand ? existingBrand.id : db.addBrand(brand).id;
      }

      productsToImport.push({
        productCode: code,
        barcode,
        nameEn: nameEn || code || barcode,
        nameTa,
        categoryId: catId,
        subcategoryName: subcategory,
        brandId,
        unit,
        hsnCode: hsn,
        purchaseRate: pur,
        saleRate: sale,
        wholesaleRate: ws,
        mrp,
        taxRate: tax,
        openingStock: op,
        currentStock: op,
        reorderLevel: reorder,
        isActive: true,
      });
    }

    setProgress(60);

    setTimeout(() => {
      const clearExisting = importMode === 'replace';
      const result = db.bulkImportProducts(productsToImport, updateDuplicates, clearExisting);
      setProgress(100);
      setIsProcessing(false);
      setImportResult(result);
      onImportComplete();
    }, 250);
  };

  // 1. Standard 16-Column Full Template
  const handleDownloadStandardTemplate = () => {
    const templateData = [
      {
        'Product Code': 'PRD0001',
        Barcode: '8901030012345',
        'Product Name (English)': 'Ponni Boiled Rice 5kg',
        'Product Name (Tamil)': 'பொன்னி புழுங்கல் அரிசி 5கிகி',
        Category: 'Groceries & Staples',
        Subcategory: 'Rice & Grains',
        Brand: 'Tata Consumer',
        Unit: 'BAG',
        'HSN Code': '1006',
        'Purchase Rate': 280,
        'Sale Rate': 320,
        'Wholesale Rate': 305,
        MRP: 340,
        'Tax %': 0,
        'Opening Stock': 100,
        'Reorder Level': 15,
      },
      {
        'Product Code': 'PRD0002',
        Barcode: '8901030012346',
        'Product Name (English)': 'Aachi Chilli Powder 100g',
        'Product Name (Tamil)': 'ஆச்சி மிளகாய் தூள் 100கி',
        Category: 'Groceries & Staples',
        Subcategory: 'Spices & Masalas',
        Brand: 'Aachi Masala',
        Unit: 'PACK',
        'HSN Code': '0904',
        'Purchase Rate': 32,
        'Sale Rate': 38,
        'Wholesale Rate': 35,
        MRP: 40,
        'Tax %': 5,
        'Opening Stock': 250,
        'Reorder Level': 25,
      },
      {
        'Product Code': 'PRD0003',
        Barcode: '8901030012347',
        'Product Name (English)': 'Tata Salt Iodized 1kg',
        'Product Name (Tamil)': 'டாடா அயோடின் உப்பு 1கிகி',
        Category: 'Groceries & Staples',
        Subcategory: 'Salt & Sugar',
        Brand: 'Tata Consumer',
        Unit: 'PACK',
        'HSN Code': '2501',
        'Purchase Rate': 22,
        'Sale Rate': 28,
        'Wholesale Rate': 25,
        MRP: 28,
        'Tax %': 0,
        'Opening Stock': 500,
        'Reorder Level': 50,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'ShopBilling_Standard_Template.xlsx');
  };

  // 2. Simple Quick 5-Column Template
  const handleDownloadSimpleTemplate = () => {
    const simpleData = [
      {
        'Item Name': 'Ponni Boiled Rice 5kg',
        Category: 'Groceries',
        'Sale Rate': 320,
        'Tax %': 0,
        'Opening Stock': 100,
        Unit: 'BAG',
      },
      {
        'Item Name': 'Aachi Chilli Powder 100g',
        Category: 'Groceries',
        'Sale Rate': 38,
        'Tax %': 5,
        'Opening Stock': 250,
        Unit: 'PACK',
      },
      {
        'Item Name': 'Tata Salt Iodized 1kg',
        Category: 'Groceries',
        'Sale Rate': 28,
        'Tax %': 0,
        'Opening Stock': 500,
        Unit: 'PACK',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(simpleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SimpleCatalog');
    XLSX.writeFile(wb, 'ShopBilling_Simple_Template.xlsx');
  };

  const handleReset = () => {
    setSelectedFileName('');
    setParsedRows([]);
    setImportResult(null);
    setProgress(0);
    setConfirmReplace(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3">
      {/* Modal Container: locked height and width to prevent outer dialog scrolling */}
      <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-4xl overflow-hidden flex flex-col h-[85vh] max-h-[640px]">
        {/* Header Bar */}
        <div className="bg-[#182b49] text-white px-3 py-2 flex items-center justify-between select-none shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold tracking-wide">EXCEL & CSV BULK PRODUCT IMPORT</h3>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
              DB: {totalExistingProducts} products
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadStandardTemplate}
              className="px-2 py-1 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              title="Download standard 16-column template"
            >
              <Download className="w-3 h-3" />
              <span>Full Template (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSimpleTemplate}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              title="Download 5-column quick template"
            >
              <FileText className="w-3 h-3" />
              <span>Simple Template (.xlsx)</span>
            </button>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white font-bold p-1 hover:bg-white/10 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top Control Section: File Picker & Import Mode Options */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
          {/* File Picker (5 columns) */}
          <div className="md:col-span-5 flex flex-col justify-between bg-white p-2.5 rounded border border-slate-200 shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>Choose Excel / CSV File</span>
                </label>
                {selectedFileName && (
                  <button
                    onClick={handleReset}
                    className="text-[10px] text-rose-600 hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-[#182b49] file:text-white hover:file:bg-[#25416d] file:cursor-pointer border border-slate-300 p-1 rounded bg-slate-50 cursor-pointer"
              />
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
              <span>Supports .xlsx, .xls, .csv</span>
              {parsedRows.length > 0 && (
                <span className="font-bold font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  {parsedRows.length} rows loaded
                </span>
              )}
            </div>
          </div>

          {/* Import Mode Options (7 columns) - Clearly provides the requested "Remove already existing" option */}
          <div className="md:col-span-7 flex flex-col justify-between bg-white p-2.5 rounded border border-slate-200 shadow-2xs">
            <span className="font-bold text-slate-800 text-[11px] block mb-1">
              Import Action & Database Mode:
            </span>

            <div className="grid grid-cols-2 gap-2">
              {/* Option 1: Update & Append */}
              <label
                className={`p-2 rounded border cursor-pointer flex flex-col justify-between transition-all select-none ${
                  importMode === 'update'
                    ? 'border-blue-500 bg-blue-50/70 text-blue-950 ring-1 ring-blue-400'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-[11px]">
                  <input
                    type="radio"
                    name="importMode"
                    value="update"
                    checked={importMode === 'update'}
                    onChange={() => setImportMode('update')}
                    className="accent-blue-600"
                  />
                  <span>Merge & Update</span>
                </div>
                <p className="text-[10px] text-slate-600 pl-4 mt-0.5 leading-tight">
                  Updates matching Barcode / Code and adds new items. Keeps existing database intact.
                </p>
              </label>

              {/* Option 2: The Requested Option - Clear Existing Products First */}
              <label
                className={`p-2 rounded border cursor-pointer flex flex-col justify-between transition-all select-none ${
                  importMode === 'replace'
                    ? 'border-rose-500 bg-rose-50/80 text-rose-950 ring-1 ring-rose-400'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-[11px] text-rose-800">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="accent-rose-600"
                  />
                  <span className="flex items-center gap-1">
                    <Trash2 className="w-3 h-3 text-rose-600" />
                    <span>Remove Existing First</span>
                  </span>
                </div>
                <p className="text-[10px] text-rose-700 pl-4 mt-0.5 leading-tight font-medium">
                  Deletes all {totalExistingProducts} existing products from database, then imports fresh file items.
                </p>
              </label>
            </div>

            {/* Mode sub-details */}
            {importMode === 'update' ? (
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={updateDuplicates}
                  onChange={(e) => setUpdateDuplicates(e.target.checked)}
                  className="accent-blue-600 rounded"
                />
                <span>Auto-match & overwrite existing items with identical Barcode / Product Code</span>
              </label>
            ) : (
              <label className="flex items-center gap-1.5 text-[11px] text-rose-800 font-bold bg-rose-100/70 px-2 py-1 rounded border border-rose-300 mt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmReplace}
                  onChange={(e) => setConfirmReplace(e.target.checked)}
                  className="accent-rose-600 rounded"
                />
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                  <span>I confirm: Wipe all {totalExistingProducts} current products and import this new list.</span>
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Middle Body Area: Preview Table (Fills remaining height without outer page scroll) */}
        <div className="flex-1 min-h-0 p-3 bg-white flex flex-col overflow-hidden text-xs">
          {/* If Result Finished */}
          {importResult ? (
            <div className="h-full flex flex-col justify-center items-center p-6 text-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 mb-1">Bulk Product Import Completed!</h4>
              <p className="text-xs text-slate-600 mb-4">
                {importResult.clearedCount !== undefined && importResult.clearedCount > 0
                  ? `Cleaned up ${importResult.clearedCount} old items, and imported ${importResult.imported} fresh products.`
                  : `Successfully processed ${importResult.imported} products.`}
              </p>

              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 font-mono font-bold text-xs">
                  Imported / Updated: {importResult.imported.toLocaleString()}
                </div>
                {importResult.failed > 0 && (
                  <div className="px-4 py-2 bg-rose-50 border border-rose-200 rounded text-rose-900 font-mono font-bold text-xs">
                    Failed Rows: {importResult.failed.toLocaleString()}
                  </div>
                )}
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs cursor-pointer"
                >
                  Import Another File
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs cursor-pointer"
                >
                  Done & View Inventory
                </button>
              </div>
            </div>
          ) : parsedRows.length > 0 ? (
            /* Data Preview Table: only the table rows scroll internally, keeping dialog fixed */
            <div className="flex-1 flex flex-col min-h-0 border border-slate-300 rounded overflow-hidden shadow-2xs">
              <div className="bg-[#e9eef4] px-3 py-1.5 flex items-center justify-between border-b border-slate-300 shrink-0 font-bold text-slate-700 text-[11px]">
                <div className="flex items-center gap-2">
                  <span>File Data Preview</span>
                  <span className="font-mono text-blue-900 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                    {parsedRows.length} Rows Detected
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-normal">
                  Auto-mapped: Item Name, Category, Sale Rate, Tax, Stock, Codes
                </span>
              </div>

              {/* Scrollable table container */}
              <div className="flex-1 overflow-auto bg-white">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-300 shadow-2xs z-10">
                    <tr>
                      <th className="p-1.5 border-r border-slate-200 w-10 text-center">#</th>
                      <th className="p-1.5 border-r border-slate-200">Product Name</th>
                      <th className="p-1.5 border-r border-slate-200">Category</th>
                      <th className="p-1.5 border-r border-slate-200 text-right">Sale Rate</th>
                      <th className="p-1.5 border-r border-slate-200 text-right">MRP</th>
                      <th className="p-1.5 border-r border-slate-200 text-center">Tax %</th>
                      <th className="p-1.5 border-r border-slate-200 text-right">Stock</th>
                      <th className="p-1.5 border-r border-slate-200">Code / Barcode</th>
                      <th className="p-1.5 text-center">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((r, i) => {
                      const name = getCol(r, ['Product Name (English)', 'Product Name', 'Item Name', 'Name', 'Description', 'Item', 'name_en', 'பெயர்', 'பொருள்']);
                      const cat = getCol(r, ['Category', 'category', 'Group']);
                      const sale = getColNum(r, ['Sale Rate', 'sale_rate', 'Selling Price', 'Rate', 'Price'], 0);
                      const mrp = getColNum(r, ['MRP', 'mrp', 'M.R.P.'], sale);
                      const tax = getColNum(r, ['Tax %', 'tax_rate', 'Tax', 'GST'], 0);
                      const stock = getColNum(r, ['Opening Stock', 'opening_stock', 'Stock', 'Qty'], 0);
                      const code = getCol(r, ['Product Code', 'Code', 'Item Code', 'SKU']);
                      const bar = getCol(r, ['Barcode', 'barcode', 'EAN']);
                      const unit = getCol(r, ['Unit', 'unit']) || 'PCS';

                      return (
                        <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                          <td className="p-1.5 text-center text-slate-400 font-mono text-[10px] border-r border-slate-100">{i + 1}</td>
                          <td className="p-1.5 font-medium text-slate-800 border-r border-slate-100 max-w-[200px] truncate" title={name}>
                            {name || <span className="text-amber-600 italic">Auto-generated</span>}
                          </td>
                          <td className="p-1.5 text-slate-600 border-r border-slate-100 max-w-[120px] truncate">{cat || 'General'}</td>
                          <td className="p-1.5 text-right font-mono font-bold text-blue-900 border-r border-slate-100">₹{sale.toFixed(2)}</td>
                          <td className="p-1.5 text-right font-mono text-slate-600 border-r border-slate-100">₹{mrp.toFixed(2)}</td>
                          <td className="p-1.5 text-center font-mono border-r border-slate-100">{tax}%</td>
                          <td className="p-1.5 text-right font-mono font-bold text-slate-700 border-r border-slate-100">{stock}</td>
                          <td className="p-1.5 font-mono text-[10px] text-slate-500 border-r border-slate-100">
                            {code || bar || <span className="text-slate-400">Auto-assign</span>}
                          </td>
                          <td className="p-1.5 text-center text-slate-500 font-mono text-[10px]">{unit}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Stats */}
              <div className="bg-slate-50 px-3 py-1 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
                <span>Showing all {parsedRows.length} rows</span>
                <span className="font-medium text-slate-700">
                  {importMode === 'replace'
                    ? `Mode: Fresh Import (Will erase all ${totalExistingProducts} old items)`
                    : `Mode: Merge with existing (${totalExistingProducts} items retained)`}
                </span>
              </div>
            </div>
          ) : (
            /* Empty State Placeholder: compact and explains format without huge scrolling banners */
            <div className="flex-1 flex flex-col justify-center items-center border border-dashed border-slate-300 rounded bg-slate-50/60 p-6 text-center">
              <FileSpreadsheet className="w-10 h-10 text-slate-400 mb-2 stroke-[1.5]" />
              <h4 className="text-xs font-bold text-slate-700 mb-1">No Excel File Selected Yet</h4>
              <p className="text-[11px] text-slate-500 max-w-md mb-3">
                Upload your inventory spreadsheet above. You can choose whether to keep existing products or clear them first.
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-2xs">
                <span className="font-semibold text-slate-800">Accepted Headers:</span>
                <span>Product Name, Sale Rate, MRP, Purchase Rate, Tax %, Stock, Unit, Barcode</span>
              </div>
            </div>
          )}

          {/* Progress Bar during import */}
          {isProcessing && (
            <div className="mt-2 space-y-1 p-2 bg-blue-50 border border-blue-200 rounded shrink-0">
              <div className="flex justify-between text-[11px] text-blue-950 font-bold">
                <span>Importing items into database & building indexes...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions: Always pinned at the bottom, no scrolling required */}
        <div className="bg-slate-100 border-t border-slate-200 px-3 py-2 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-600 font-medium">
            {importMode === 'replace' ? (
              <span className="text-rose-700 font-bold flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" />
                <span>Replace Mode: Existing {totalExistingProducts} products will be erased</span>
              </span>
            ) : (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Merge Mode: Existing {totalExistingProducts} products preserved</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded font-semibold text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleStartImport}
              disabled={
                parsedRows.length === 0 ||
                isProcessing ||
                (importMode === 'replace' && totalExistingProducts > 0 && !confirmReplace)
              }
              className={`px-4 py-1.5 text-white rounded font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                importMode === 'replace'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : importMode === 'replace' ? (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Wipe Existing & Import {parsedRows.length} Products</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import {parsedRows.length} Products</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
