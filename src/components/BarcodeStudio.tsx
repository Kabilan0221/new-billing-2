import React, { useState, useMemo, useRef } from 'react';
import {
  Barcode,
  Search,
  Printer,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Tag,
  Layers,
  Settings2,
  Sliders,
  CheckSquare,
  Square,
  PlusCircle,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';
import { db } from '../services/dbEngine';
import { Product, BarcodeStudioItem, BarcodePrintConfig } from '../types';

interface BarcodeStudioProps {
  onRefreshData?: () => void;
  onNavigateToProducts?: () => void;
}

// Standard Code 128 (Subset B) module patterns
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

export const BarcodeStudio: React.FC<BarcodeStudioProps> = ({ onRefreshData, onNavigateToProducts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<'Code128' | 'EAN13'>('Code128');
  const [items, setItems] = useState<BarcodeStudioItem[]>(() => db.getBarcodeStudioItems());
  const [activePreviewItem, setActivePreviewItem] = useState<BarcodeStudioItem | null>(() => items[0] || null);

  // Label Layout Configuration
  const [config, setConfig] = useState<BarcodePrintConfig>({
    barcodeFormat: 'Code128',
    labelWidthMm: 50,
    labelHeightMm: 25,
    labelsPerRow: 3,
    horizontalGapMm: 3,
    verticalGapMm: 3,
    pageMarginLeftMm: 6,
    pageMarginTopMm: 10,
    includeProductName: true,
    includePrice: true,
    includeBarcodeText: true,
    includeStoreName: true,
    storeName: 'SRI MEENAKSHI SUPER STORE',
    currencySymbol: '₹',
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Filtered products list
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.trim().toLowerCase();
    return items.filter(
      (i) =>
        i.nameEn.toLowerCase().includes(term) ||
        i.productCode.toLowerCase().includes(term) ||
        i.barcode.toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  // Selected items calculation
  const selectedItems = useMemo(() => items.filter((i) => i.isSelected), [items]);
  const totalLabelsToPrint = useMemo(
    () => selectedItems.reduce((acc, i) => acc + Math.max(1, i.labelCount), 0),
    [selectedItems]
  );
  const estimatedSheets = useMemo(() => {
    const labelsPerSheet = config.labelsPerRow * 8; // approx 8 rows on A4
    return Math.ceil(totalLabelsToPrint / Math.max(1, labelsPerSheet)) || 1;
  }, [totalLabelsToPrint, config.labelsPerRow]);

  const showNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleToggleSelectAll = (select: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, isSelected: select })));
  };

  const handleToggleItem = (productId: number) => {
    setItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, isSelected: !item.isSelected } : item))
    );
  };

  const handleUpdateLabelCount = (productId: number, count: number) => {
    const val = Math.max(1, count);
    setItems((prev) => prev.map((item) => (item.productId === productId ? { ...item, labelCount: val } : item)));
  };

  const handleGenerateBarcode = (productId: number) => {
    const item = items.find((i) => i.productId === productId);
    if (!item) return;

    const newBc = db.generateUniqueBarcode(selectedFormat);
    if (item.barcode) {
      const confirm = window.confirm(
        `Product '${item.nameEn}' already has barcode '${item.barcode}'.\nOverwrite with newly generated barcode '${newBc}'?`
      );
      if (!confirm) return;
    }

    const res = db.assignBarcodeToProduct(productId, newBc, true);
    if (res.success) {
      setItems((prev) =>
        prev.map((i) => (i.productId === productId ? { ...i, barcode: newBc } : i))
      );
      if (activePreviewItem?.productId === productId) {
        setActivePreviewItem({ ...activePreviewItem, barcode: newBc });
      }
      showNotification('success', `Generated and assigned ${selectedFormat} barcode '${newBc}' to '${item.nameEn}'.`);
      onRefreshData?.();
    } else {
      showNotification('error', res.errors.join(' '));
    }
  };

  // SVG Barcode Bars Generator
  const renderBarcodeSvg = (code: string, format: 'Code128' | 'EAN13', height: number = 38) => {
    const clean = code || '000000';
    // Generate simple standard Code 128 bit pattern
    const symbols = [104]; // Start B
    let checksum = 104;
    for (let i = 0; i < clean.length; i++) {
      const val = clean.charCodeAt(i) - 32;
      const safeVal = val >= 0 && val < 96 ? val : 0;
      symbols.push(safeVal);
      checksum += (i + 1) * safeVal;
    }
    symbols.push(checksum % 103);
    symbols.push(106); // Stop

    const modules: boolean[] = [];
    // Left quiet zone
    for (let q = 0; q < 8; q++) modules.push(false);

    for (const sym of symbols) {
      const pat = CODE128_PATTERNS[sym] || '211214';
      let isBar = true;
      for (let c = 0; c < pat.length; c++) {
        const run = parseInt(pat[c], 10);
        for (let r = 0; r < run; r++) modules.push(isBar);
        isBar = !isBar;
      }
    }
    // Right quiet zone
    for (let q = 0; q < 8; q++) modules.push(false);

    const totalWidth = modules.length;
    return (
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full h-full max-h-12"
        preserveAspectRatio="none"
      >
        <rect width={totalWidth} height={height} fill="#ffffff" />
        {modules.map((isBar, idx) =>
          isBar ? <rect key={idx} x={idx} y={0} width={1.05} height={height} fill="#000000" /> : null
        )}
      </svg>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f0f2f5] overflow-hidden select-none text-xs">
      {/* Header Banner */}
      <div className="bg-[#182b49] text-white px-4 py-2.5 border-b border-[#0f1d33] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-blue-600/30 border border-blue-400/40 flex items-center justify-center">
            <Barcode className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide flex items-center gap-2">
              <span>BARCODE STUDIO (F4) — Label Designer & Batch Printer</span>
              <span className="text-[10px] bg-blue-500/30 text-blue-200 border border-blue-400/30 px-1.5 py-0.2 rounded">
                Code 128 & EAN-13
              </span>
            </h1>
            <p className="text-[11px] text-slate-300">
              Generate scannable retail barcode stickers, customize layout sheets, and print batch rolls or A4 sheets.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPrintModalOpen(true)}
            disabled={selectedItems.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded shadow-xs cursor-pointer text-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Sheet Preview ({totalLabelsToPrint} labels)</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`px-4 py-1.5 text-xs font-medium flex items-center gap-2 ${
            notification.type === 'success'
              ? 'bg-emerald-100 text-emerald-800 border-b border-emerald-300'
              : notification.type === 'error'
              ? 'bg-rose-100 text-rose-800 border-b border-rose-300'
              : 'bg-blue-100 text-blue-800 border-b border-blue-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Main Workspace (Split View) */}
      <div className="flex-1 flex overflow-hidden p-2 gap-2">
        {/* Left Column: Product Selection & Catalog Grid */}
        <div className="flex-1 flex flex-col bg-white border border-[#c0c6cf] rounded shadow-xs overflow-hidden">
          {/* Catalog Toolbar */}
          <div className="p-2 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Search catalog by product name, SKU, or barcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:outline-blue-500"
                />
              </div>

              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as any)}
                className="px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700"
              >
                <option value="Code128">Format: Code 128</option>
                <option value="EAN13">Format: EAN-13 (13 Digits)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleToggleSelectAll(true)}
                className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-[11px] font-semibold text-slate-700 flex items-center gap-1"
              >
                <CheckSquare className="w-3 h-3 text-emerald-600" />
                <span>Select All</span>
              </button>
              <button
                onClick={() => handleToggleSelectAll(false)}
                className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-[11px] font-semibold text-slate-700 flex items-center gap-1"
              >
                <Square className="w-3 h-3 text-slate-400" />
                <span>Clear</span>
              </button>
              <button
                onClick={() => {
                  setItems(db.getBarcodeStudioItems());
                  showNotification('info', 'Catalog refreshed.');
                }}
                className="p-1 text-slate-500 hover:text-slate-800 border border-slate-300 rounded bg-white hover:bg-slate-50"
                title="Refresh catalog"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Catalog Grid */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#e9eef4] border-b border-[#cbd5e1] text-slate-700 font-bold sticky top-0 z-10 select-none">
                <tr>
                  <th className="py-1.5 px-2.5 w-10 text-center">Print</th>
                  <th className="py-1.5 px-2.5 w-24">Product Code</th>
                  <th className="py-1.5 px-2.5 w-36">Barcode</th>
                  <th className="py-1.5 px-2.5">Product Description</th>
                  <th className="py-1.5 px-2.5 w-20 text-right">Sale Rate</th>
                  <th className="py-1.5 px-2.5 w-16 text-center">Stock</th>
                  <th className="py-1.5 px-2.5 w-20 text-center">Copies</th>
                  <th className="py-1.5 px-2.5 w-24 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                      No matching products found in catalog.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr
                      key={item.productId}
                      onClick={() => setActivePreviewItem(item)}
                      className={`hover:bg-blue-50 cursor-pointer transition-colors ${
                        activePreviewItem?.productId === item.productId
                          ? 'bg-blue-50/80 font-medium text-blue-950'
                          : item.isSelected
                          ? 'bg-emerald-50/40'
                          : ''
                      }`}
                    >
                      <td className="py-1.5 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={item.isSelected}
                          onChange={() => handleToggleItem(item.productId)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="py-1.5 px-2.5 font-mono text-slate-600">{item.productCode}</td>
                      <td className="py-1.5 px-2.5 font-mono font-bold text-slate-800">
                        {item.barcode || <span className="text-amber-600 font-normal italic">None</span>}
                      </td>
                      <td className="py-1.5 px-2.5 truncate max-w-[200px]" title={item.nameEn}>
                        {item.nameEn}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-semibold text-slate-900">
                        ₹{item.saleRate.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2.5 text-center text-slate-600">{item.currentStock}</td>
                      <td className="py-1.5 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={item.labelCount}
                          onChange={(e) => handleUpdateLabelCount(item.productId, parseInt(e.target.value, 10) || 1)}
                          className="w-14 px-1 py-0.5 border border-slate-300 rounded text-center text-xs focus:outline-blue-500 font-bold"
                        />
                      </td>
                      <td className="py-1.5 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleGenerateBarcode(item.productId)}
                          className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-medium"
                          title="Generate new unique barcode and save to database"
                        >
                          Generate
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Grid Footer Summary */}
          <div className="p-2 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>
              Showing {filteredItems.length} of {items.length} products
            </span>
            <div className="flex items-center gap-3">
              <span className="text-emerald-700 font-bold">
                Selected: {selectedItems.length} products ({totalLabelsToPrint} stickers)
              </span>
              <span className="text-blue-700">~{estimatedSheets} sheet(s) on A4</span>
            </div>
          </div>
        </div>

        {/* Right Column: Sticker Designer & Live Preview */}
        <div className="w-[340px] flex flex-col bg-white border border-[#c0c6cf] rounded shadow-xs overflow-hidden">
          {/* Header */}
          <div className="p-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>LABEL FORMAT & SHEET SETTINGS</span>
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
            {/* Live Sticker Preview Box */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Eye className="w-3 h-3 text-slate-500" />
                  <span>STICKER PREVIEW (1:1 RATIO)</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {config.labelWidthMm} × {config.labelHeightMm} mm
                </span>
              </div>

              <div className="p-3 bg-[#e2e8f0] border border-slate-300 rounded flex items-center justify-center min-h-[140px]">
                {activePreviewItem ? (
                  <div
                    style={{
                      width: `${config.labelWidthMm * 4.2}px`,
                      height: `${config.labelHeightMm * 4.2}px`,
                    }}
                    className="bg-white border border-slate-400 shadow-sm p-2 flex flex-col justify-between items-center text-center overflow-hidden transition-all"
                  >
                    {config.includeStoreName && (
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-800 truncate w-full">
                        {config.storeName || 'STORE NAME'}
                      </div>
                    )}

                    {config.includeProductName && (
                      <div className="text-[10px] font-bold text-slate-900 truncate w-full leading-tight">
                        {activePreviewItem.nameEn}
                      </div>
                    )}

                    <div className="w-full flex-1 flex items-center justify-center my-0.5">
                      {renderBarcodeSvg(activePreviewItem.barcode, config.barcodeFormat)}
                    </div>

                    {config.includeBarcodeText && (
                      <div className="font-mono text-[9px] font-bold text-slate-800 tracking-wider">
                        {activePreviewItem.barcode || 'NO-BARCODE'}
                      </div>
                    )}

                    {config.includePrice && (
                      <div className="text-[10px] font-black text-slate-950 flex items-center justify-center gap-1.5">
                        {activePreviewItem.mrp > activePreviewItem.saleRate && (
                          <span className="text-[8px] text-slate-400 line-through">
                            MRP: ₹{activePreviewItem.mrp.toFixed(2)}
                          </span>
                        )}
                        <span>SALE: ₹{activePreviewItem.saleRate.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs italic">Select a product to preview</div>
                )}
              </div>
            </div>

            {/* Layout Dimensions */}
            <div className="border border-slate-200 rounded p-2.5 space-y-2 bg-slate-50/50">
              <span className="text-[11px] font-bold text-slate-800 block">Sticker Dimensions (Millimeters)</span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-600 font-medium block">Width (mm)</label>
                  <input
                    type="number"
                    min={20}
                    max={120}
                    value={config.labelWidthMm}
                    onChange={(e) => setConfig({ ...config, labelWidthMm: parseFloat(e.target.value) || 50 })}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-600 font-medium block">Height (mm)</label>
                  <input
                    type="number"
                    min={15}
                    max={80}
                    value={config.labelHeightMm}
                    onChange={(e) => setConfig({ ...config, labelHeightMm: parseFloat(e.target.value) || 25 })}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] text-slate-600 font-medium block">Labels Per Row</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={config.labelsPerRow}
                    onChange={(e) => setConfig({ ...config, labelsPerRow: parseInt(e.target.value, 10) || 3 })}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-600 font-medium block">Horizontal Gap (mm)</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={config.horizontalGapMm}
                    onChange={(e) => setConfig({ ...config, horizontalGapMm: parseFloat(e.target.value) || 3 })}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Content Field Toggles */}
            <div className="border border-slate-200 rounded p-2.5 space-y-2 bg-slate-50/50">
              <span className="text-[11px] font-bold text-slate-800 block">Sticker Content Options</span>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeProductName}
                  onChange={(e) => setConfig({ ...config, includeProductName: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Include Product Name</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includePrice}
                  onChange={(e) => setConfig({ ...config, includePrice: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Include Selling Price & MRP</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeBarcodeText}
                  onChange={(e) => setConfig({ ...config, includeBarcodeText: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Include Human-Readable Barcode Text</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeStoreName}
                  onChange={(e) => setConfig({ ...config, includeStoreName: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Include Store Name</span>
              </label>

              {config.includeStoreName && (
                <input
                  type="text"
                  value={config.storeName}
                  onChange={(e) => setConfig({ ...config, storeName: e.target.value })}
                  placeholder="Store Name Header"
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                />
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-3 bg-[#f8fafc] border-t border-[#e2e8f0] space-y-2">
            <button
              onClick={() => setIsPrintModalOpen(true)}
              disabled={selectedItems.length === 0}
              className="w-full py-2 bg-[#106ebe] hover:bg-[#005a9e] disabled:opacity-50 text-white font-bold rounded shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Batch Labels ({totalLabelsToPrint})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Print Sheet Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-300">
            {/* Modal Header */}
            <div className="bg-[#182b49] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-300" />
                <h3 className="font-bold text-sm">PRINT PREVIEW — A4 LABEL SHEET ({totalLabelsToPrint} Labels)</h3>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="text-slate-300 hover:text-white font-bold px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            {/* Modal Content Preview */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
              <div
                className="bg-white shadow-lg border border-slate-300 p-6 min-h-[842px] w-[595px] flex flex-col justify-start"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${config.labelsPerRow}, 1fr)`,
                  gap: `${config.horizontalGapMm * 1.5}px`,
                  alignContent: 'start',
                }}
              >
                {selectedItems.flatMap((item) =>
                  Array.from({ length: item.labelCount }).map((_, idx) => (
                    <div
                      key={`${item.productId}-${idx}`}
                      className="border border-dashed border-slate-300 p-1.5 flex flex-col justify-between items-center text-center bg-white h-[90px] overflow-hidden"
                    >
                      {config.includeStoreName && (
                        <div className="text-[7.5px] font-black uppercase text-slate-800 truncate w-full">
                          {config.storeName}
                        </div>
                      )}
                      {config.includeProductName && (
                        <div className="text-[8px] font-bold text-slate-900 truncate w-full">{item.nameEn}</div>
                      )}
                      <div className="w-full flex-1 flex items-center justify-center my-0.5">
                        {renderBarcodeSvg(item.barcode, config.barcodeFormat, 24)}
                      </div>
                      {config.includeBarcodeText && (
                        <div className="font-mono text-[7px] text-slate-700">{item.barcode}</div>
                      )}
                      {config.includePrice && (
                        <div className="text-[8px] font-black text-slate-950">₹{item.saleRate.toFixed(2)}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-600">
                Ready to send <strong>{totalLabelsToPrint} labels</strong> to system default Windows printer.
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    window.print();
                    setIsPrintModalOpen(false);
                    showNotification('success', `Sent ${totalLabelsToPrint} labels to printer spooler.`);
                  }}
                  className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Send to Printer (Print)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
