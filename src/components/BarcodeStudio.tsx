import React, { useState, useMemo, useRef } from 'react';
import {
  Barcode,
  Search,
  Printer,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  CheckSquare,
  Square,
  Eye,
  Layers,
  FileText,
  Sparkles,
} from 'lucide-react';
import { db } from '../services/dbEngine';
import { BarcodeStudioItem, BarcodePrintConfig } from '../types';
import { SVTLogo } from './SVTLogo';

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

  // Label Layout Configuration — Initialized with EXACT User Spec:
  // Top Margin: 1.2cm (12mm), Label: 3.7cm x 2cm (37mm x 20mm), Horizontal Gap: 0.3cm (3mm),
  // Side Margins: 0.6cm (6mm) Left & Right, Grid: 5 columns x 13 rows (65 labels per sheet)
  const [config, setConfig] = useState<BarcodePrintConfig>({
    barcodeFormat: 'Code128',
    labelWidthMm: 37,
    labelHeightMm: 20,
    labelsPerRow: 5,
    labelsPerColumn: 13,
    horizontalGapMm: 3,
    verticalGapMm: 0,
    pageMarginLeftMm: 6,
    pageMarginRightMm: 6,
    pageMarginTopMm: 12,
    pageMarginBottomMm: 25,
    includeProductName: true,
    includePrice: true,
    includeBarcodeText: true,
    includeStoreName: true,
    includeLogo: true,
    includeAddress: false,
    storeName: 'SRI VENKATESWARA',
    storeSubtitle: 'SVT • Kanchipuram',
    storeAddress: 'மடம் தெரு, காஞ்சிபுரம் - 631 502',
    storePhone: '8143 84 8143',
    currencySymbol: '₹',
    preset: '5x13',
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Preset Handler
  const applyPreset = (presetKey: string) => {
    if (presetKey === '5x13') {
      setConfig((prev) => ({
        ...prev,
        preset: '5x13',
        labelWidthMm: 37,
        labelHeightMm: 20,
        labelsPerRow: 5,
        labelsPerColumn: 13,
        horizontalGapMm: 3,
        verticalGapMm: 0,
        pageMarginLeftMm: 6,
        pageMarginRightMm: 6,
        pageMarginTopMm: 12,
        pageMarginBottomMm: 25,
        includeLogo: true,
      }));
      showNotification('info', 'Applied standard 5 × 13 (65 labels / sheet, 3.7cm × 2.0cm) template.');
    } else if (presetKey === '3x8') {
      setConfig((prev) => ({
        ...prev,
        preset: '3x8',
        labelWidthMm: 65,
        labelHeightMm: 33,
        labelsPerRow: 3,
        labelsPerColumn: 8,
        horizontalGapMm: 4,
        verticalGapMm: 2,
        pageMarginLeftMm: 7,
        pageMarginRightMm: 7,
        pageMarginTopMm: 12,
        pageMarginBottomMm: 15,
      }));
      showNotification('info', 'Applied 3 × 8 (24 labels / sheet, 65mm × 33mm) template.');
    } else if (presetKey === 'thermal') {
      setConfig((prev) => ({
        ...prev,
        preset: 'thermal',
        labelWidthMm: 50,
        labelHeightMm: 25,
        labelsPerRow: 1,
        labelsPerColumn: 1,
        horizontalGapMm: 0,
        verticalGapMm: 3,
        pageMarginLeftMm: 2,
        pageMarginRightMm: 2,
        pageMarginTopMm: 2,
      }));
      showNotification('info', 'Applied 50mm × 25mm Single Thermal Roll template.');
    } else {
      setConfig((prev) => ({ ...prev, preset: 'custom' }));
    }
  };

  // Filtered products list
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.trim().toLowerCase();
    return items.filter(
      (i) =>
        i.nameEn.toLowerCase().includes(term) ||
        (i.nameTa && i.nameTa.toLowerCase().includes(term)) ||
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

  const labelsPerSheet = config.labelsPerRow * (config.labelsPerColumn || 13);
  const totalSheetsNeeded = Math.ceil(totalLabelsToPrint / Math.max(1, labelsPerSheet)) || 1;

  // Flattened array of all labels to print for exact multi-sheet pagination
  const flattenedLabels = useMemo(() => {
    const arr: BarcodeStudioItem[] = [];
    for (const item of selectedItems) {
      const count = Math.max(1, item.labelCount);
      for (let c = 0; c < count; c++) {
        arr.push(item);
      }
    }
    return arr;
  }, [selectedItems]);

  // Paginated chunks (each page has up to labelsPerSheet labels)
  const paginatedSheets = useMemo(() => {
    const pages: BarcodeStudioItem[][] = [];
    for (let i = 0; i < flattenedLabels.length; i += labelsPerSheet) {
      pages.push(flattenedLabels.slice(i, i + labelsPerSheet));
    }
    return pages.length > 0 ? pages : [[]];
  }, [flattenedLabels, labelsPerSheet]);

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

    const newBc = db.generateUniqueBarcode('A385');
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
      showNotification('success', `Generated and assigned ${newBc} to '${item.nameEn}'.`);
      onRefreshData?.();
    } else {
      showNotification('error', res.errors.join(' '));
    }
  };

  const handleRemoveBarcode = (productId: number) => {
    const item = items.find((i) => i.productId === productId);
    if (!item) return;

    const res = db.removeBarcodeFromProduct(productId);
    if (res.success) {
      setItems((prev) =>
        prev.map((i) => (i.productId === productId ? { ...i, barcode: '' } : i))
      );
      if (activePreviewItem?.productId === productId) {
        setActivePreviewItem({ ...activePreviewItem, barcode: '' });
      }
      showNotification('info', `Removed barcode from '${item.nameEn}'.`);
      onRefreshData?.();
    }
  };

  const handleAutoAssignMissingBarcodes = () => {
    const missing = items.filter((i) => !i.barcode || i.barcode.trim() === '');
    if (missing.length === 0) {
      showNotification('info', 'All products already have unique barcodes assigned! No missing barcodes.');
      return;
    }

    const assignedList: string[] = [];
    for (const item of missing) {
      const bc = db.generateUniqueBarcode('A385');
      db.assignBarcodeToProduct(item.productId, bc, true);
      assignedList.push(bc);
    }

    setItems(db.getBarcodeStudioItems());
    showNotification(
      'success',
      `Auto-assigned sequential barcodes (${assignedList[0]} to ${assignedList[assignedList.length - 1]}) to ${assignedList.length} products. Strictly no repeated values!`
    );
    onRefreshData?.();
  };

  // SVG Barcode Bars Generator (Code 128)
  const renderBarcodeSvg = (code: string, format: 'Code128' | 'EAN13', height: number = 24) => {
    const clean = code || '000000';
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
    for (let q = 0; q < 6; q++) modules.push(false);

    for (const sym of symbols) {
      const pat = CODE128_PATTERNS[sym] || '211214';
      let isBar = true;
      for (let c = 0; c < pat.length; c++) {
        const run = parseInt(pat[c], 10);
        for (let r = 0; r < run; r++) modules.push(isBar);
        isBar = !isBar;
      }
    }
    for (let q = 0; q < 6; q++) modules.push(false);

    const totalWidth = modules.length;
    return (
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        <rect width={totalWidth} height={height} fill="#ffffff" />
        {modules.map((isBar, idx) =>
          isBar ? <rect key={idx} x={idx} y={0} width={1.05} height={height} fill="#000000" /> : null
        )}
      </svg>
    );
  };

  // Individual Sticker Content (Shared between preview and printable sheets)
  const renderStickerContent = (item: BarcodeStudioItem, isPrintMode: boolean = false) => {
    return (
      <div className="w-full h-full flex flex-col justify-between items-center text-center overflow-hidden leading-tight p-0.5 select-none">
        {/* Header: SVT Logo + Store Name */}
        <div className="w-full flex items-center justify-center gap-1 shrink-0 pt-0.5">
          {config.includeLogo && (
            <SVTLogo size={isPrintMode ? 11 : 14} className="shrink-0" />
          )}
          {config.includeStoreName && (
            <div className="font-black text-[7.5px] uppercase tracking-tighter text-slate-900 truncate">
              {config.storeName || 'SRI VENKATESWARA'}
            </div>
          )}
        </div>

        {/* Product Name */}
        {config.includeProductName && (
          <div className="w-full text-[7.5px] font-bold text-slate-900 truncate px-0.5 leading-none mt-0.5">
            {item.nameEn}
          </div>
        )}

        {/* Barcode Graphic */}
        <div className="w-full flex-1 flex items-center justify-center px-1 my-0.5 min-h-[14px] max-h-[22px]">
          {renderBarcodeSvg(item.barcode, config.barcodeFormat, 20)}
        </div>

        {/* Footer: Barcode Number + Price */}
        <div className="w-full flex items-center justify-between px-1 shrink-0 text-[7px] border-t border-slate-200/80 pt-0.5 mt-0.5">
          {config.includeBarcodeText ? (
            <span className="font-mono text-slate-800 font-semibold tracking-wider truncate max-w-[55%]">
              {item.barcode || 'NO-BC'}
            </span>
          ) : (
            <span />
          )}

          {config.includePrice && (
            <div className="font-black text-slate-950 flex items-center gap-1 ml-auto">
              {item.mrp > item.saleRate && (
                <span className="text-[6px] text-slate-400 line-through">
                  ₹{item.mrp.toFixed(0)}
                </span>
              )}
              <span className="text-[7.5px]">₹{item.saleRate.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Address / Phone if enabled */}
        {config.includeAddress && (
          <div className="text-[5.5px] text-slate-600 truncate w-full tracking-tighter border-t border-slate-100 pt-0.2">
            காஞ்சிபுரம் • 8143 84 8143
          </div>
        )}
      </div>
    );
  };

  const handlePrint = () => {
    window.print();
    setIsPrintModalOpen(false);
    showNotification('success', `Sent ${totalLabelsToPrint} labels (${totalSheetsNeeded} sheet(s)) to Windows Print Spooler.`);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f0f2f5] overflow-hidden select-none text-xs">
      {/* Header Banner */}
      <div className="bg-[#182b49] text-white px-4 py-2 border-b border-[#0f1d33] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <SVTLogo size={32} />
          <div>
            <h1 className="text-sm font-bold tracking-wide flex items-center gap-2">
              <span>BARCODE STUDIO (F4) — Sri Venkateswara Label Designer & Batch Printer</span>
              <span className="text-[10px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-1.5 py-0.2 rounded">
                5×13 (65 Labels / Sheet) Active
              </span>
            </h1>
            <p className="text-[11px] text-slate-300">
              3.7cm × 2.0cm standard retail labels • 1.2cm top margin • 0.3cm gap • 0.6cm side margins
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPrintModalOpen(true)}
            disabled={selectedItems.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded shadow-xs cursor-pointer text-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print 5×13 Sheet ({totalLabelsToPrint} Labels)</span>
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
                <option value="Code128">Format: Code 128 (Standard)</option>
                <option value="EAN13">Format: EAN-13 (13 Digits)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handleAutoAssignMissingBarcodes}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                title="Automatically assign sequential unique barcodes (A385, A386, A387...)"
              >
                <span>⚡ Auto-Assign (A385, A386...)</span>
              </button>
              <button
                onClick={() => handleToggleSelectAll(true)}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-[11px] font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <CheckSquare className="w-3 h-3 text-emerald-600" />
                <span>Select All</span>
              </button>
              <button
                onClick={() => handleToggleSelectAll(false)}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-[11px] font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <Square className="w-3 h-3 text-slate-400" />
                <span>Clear</span>
              </button>
              <button
                onClick={() => {
                  setItems(db.getBarcodeStudioItems());
                  showNotification('info', 'Catalog refreshed.');
                }}
                className="p-1.5 text-slate-500 hover:text-slate-800 border border-slate-300 rounded bg-white hover:bg-slate-50 cursor-pointer"
                title="Refresh catalog"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Catalog Grid */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-20 select-none shadow-xs">
                <tr>
                  <th className="py-1.5 px-2.5 w-10 text-center sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">Print</th>
                  <th className="py-1.5 px-2.5 w-24 sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">Code</th>
                  <th className="py-1.5 px-2.5 w-36 sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">Barcode</th>
                  <th className="py-1.5 px-2.5 sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">Product Name</th>
                  <th className="py-1.5 px-2.5 w-20 text-right sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">Sale Rate</th>
                  <th className="py-1.5 px-2.5 w-16 text-center sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">Stock</th>
                  <th className="py-1.5 px-2.5 w-24 text-center sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-r border-[#cbd5e1] whitespace-nowrap">Stickers</th>
                  <th className="py-1.5 px-2.5 w-24 text-center sticky top-0 z-20 bg-[#e9eef4] text-slate-700 font-bold border-b border-[#cbd5e1] whitespace-nowrap">Action</th>
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
                        <div className="font-semibold text-slate-900">{item.nameEn}</div>
                        {item.nameTa && <div className="text-[10px] text-slate-500 font-normal">{item.nameTa}</div>}
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
                          className="w-16 px-1.5 py-0.5 border border-slate-300 rounded text-center text-xs focus:outline-blue-500 font-bold bg-white"
                        />
                      </td>
                      <td className="py-1.5 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleGenerateBarcode(item.productId)}
                            className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-bold cursor-pointer transition-colors"
                            title="Generate next sequential unique barcode (A385, A386...)"
                          >
                            ⚡ A385+
                          </button>
                          {item.barcode && (
                            <button
                              onClick={() => handleRemoveBarcode(item.productId)}
                              className="px-1.5 py-0.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-[11px] font-bold cursor-pointer transition-colors"
                              title="Remove Barcode"
                            >
                              ✕
                            </button>
                          )}
                        </div>
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
              <span className="text-blue-700 font-semibold">
                = {totalSheetsNeeded} Sheet{totalSheetsNeeded > 1 ? 's' : ''} (5×13 format, 65 per page)
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Sticker Designer & Live Preview */}
        <div className="w-[360px] flex flex-col bg-white border border-[#c0c6cf] rounded shadow-xs overflow-hidden">
          {/* Header */}
          <div className="p-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>LABEL FORMAT & SHEET SETTINGS</span>
            </h2>
            <span className="text-[10px] bg-blue-50 text-blue-700 font-mono px-1.5 py-0.5 rounded border border-blue-200">
              5 × 13 (65 Labels)
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
            {/* Live Sticker Preview Box */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Eye className="w-3 h-3 text-slate-500" />
                  <span>STICKER PREVIEW (3.7cm × 2.0cm)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono font-semibold">
                  {config.labelWidthMm}mm × {config.labelHeightMm}mm
                </span>
              </div>

              <div className="p-4 bg-[#e2e8f0] border border-slate-300 rounded flex items-center justify-center min-h-[140px]">
                {activePreviewItem ? (
                  <div
                    style={{
                      width: `${config.labelWidthMm * 4.8}px`,
                      height: `${config.labelHeightMm * 4.8}px`,
                    }}
                    className="bg-white border border-slate-400 shadow-md p-1.5 flex flex-col justify-between items-center text-center overflow-hidden transition-all rounded-xs"
                  >
                    {renderStickerContent(activePreviewItem, false)}
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs italic">Select a product to preview</div>
                )}
              </div>
            </div>

            {/* Template Presets Selector */}
            <div className="border border-slate-200 rounded p-2.5 bg-slate-50/70 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Sticker Sheet Preset</span>
                </span>
              </div>
              <select
                value={config.preset || '5x13'}
                onChange={(e) => applyPreset(e.target.value)}
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-blue-900 focus:outline-blue-600"
              >
                <option value="5x13">★ 5 × 13 (3.7cm × 2.0cm) — 65 Labels / Sheet (Requested Spec)</option>
                <option value="3x8">3 × 8 (6.5cm × 3.3cm) — 24 Labels / Sheet</option>
                <option value="thermal">Single Label Roll (5.0cm × 2.5cm) — POS Thermal</option>
                <option value="custom">Custom Dimensions</option>
              </select>
            </div>

            {/* Exact Paper & Label Dimensions Form */}
            <div className="border border-slate-200 rounded p-2.5 space-y-2 bg-slate-50/50">
              <span className="text-[11px] font-bold text-slate-800 block">
                Exact Dimensions & Margins (cm / mm)
              </span>

              {/* Label Size: 3.7cm x 2cm */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-600 font-medium block">
                    Label Width (cm / mm)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={0.1}
                      min={1}
                      max={15}
                      value={Number((config.labelWidthMm / 10).toFixed(1))}
                      onChange={(e) =>
                        setConfig({ ...config, labelWidthMm: parseFloat(e.target.value) * 10 || 37, preset: 'custom' })
                      }
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">cm</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-600 font-medium block">
                    Label Height (cm / mm)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={0.1}
                      min={1}
                      max={15}
                      value={Number((config.labelHeightMm / 10).toFixed(1))}
                      onChange={(e) =>
                        setConfig({ ...config, labelHeightMm: parseFloat(e.target.value) * 10 || 20, preset: 'custom' })
                      }
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">cm</span>
                  </div>
                </div>
              </div>

              {/* Margins: Top Margin 1.2cm, Side Margins 0.6cm, Gap 0.3cm */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200">
                <div>
                  <label className="text-[10px] text-slate-600 font-medium block" title="Starting Height (Top Margin)">
                    Top Margin
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={5}
                      value={Number((config.pageMarginTopMm / 10).toFixed(1))}
                      onChange={(e) =>
                        setConfig({ ...config, pageMarginTopMm: parseFloat(e.target.value) * 10 || 12, preset: 'custom' })
                      }
                      className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-xs font-bold"
                    />
                    <span className="text-[10px] text-slate-500">cm</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-600 font-medium block" title="Side Margins Left & Right">
                    Side Margins
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={5}
                      value={Number((config.pageMarginLeftMm / 10).toFixed(1))}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          pageMarginLeftMm: parseFloat(e.target.value) * 10 || 6,
                          pageMarginRightMm: parseFloat(e.target.value) * 10 || 6,
                          preset: 'custom',
                        })
                      }
                      className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-xs font-bold"
                    />
                    <span className="text-[10px] text-slate-500">cm</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-600 font-medium block" title="Gap between labels (Horizontal)">
                    Col Gap
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={2}
                      value={Number((config.horizontalGapMm / 10).toFixed(1))}
                      onChange={(e) =>
                        setConfig({ ...config, horizontalGapMm: parseFloat(e.target.value) * 10 || 3, preset: 'custom' })
                      }
                      className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-xs font-bold"
                    />
                    <span className="text-[10px] text-slate-500">cm</span>
                  </div>
                </div>
              </div>

              {/* Grid: 5 columns x 13 rows */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                <div>
                  <label className="text-[10px] text-slate-600 font-medium block">
                    Columns Across (5)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={config.labelsPerRow}
                    onChange={(e) =>
                      setConfig({ ...config, labelsPerRow: parseInt(e.target.value, 10) || 5, preset: 'custom' })
                    }
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-600 font-medium block">
                    Rows Down (13)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={config.labelsPerColumn}
                    onChange={(e) =>
                      setConfig({ ...config, labelsPerColumn: parseInt(e.target.value, 10) || 13, preset: 'custom' })
                    }
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Content Field Toggles & SVT Logo Option */}
            <div className="border border-slate-200 rounded p-2.5 space-y-2 bg-slate-50/50">
              <span className="text-[11px] font-bold text-slate-800 block">Sticker Content Options</span>

              {/* SVT Logo Toggle */}
              <label className="flex items-center gap-2 text-xs text-slate-800 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeLogo}
                  onChange={(e) => setConfig({ ...config, includeLogo: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                />
                <span className="flex items-center gap-1.5">
                  <SVTLogo size={16} />
                  <span>Include Official SVT Circular Logo</span>
                </span>
              </label>

              {/* Store Name Toggle */}
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeStoreName}
                  onChange={(e) => setConfig({ ...config, includeStoreName: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Include Store Name (Header)</span>
              </label>

              {config.includeStoreName && (
                <input
                  type="text"
                  value={config.storeName}
                  onChange={(e) => setConfig({ ...config, storeName: e.target.value })}
                  placeholder="Store Name Header"
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold"
                />
              )}

              {/* Product Name Toggle */}
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeProductName}
                  onChange={(e) => setConfig({ ...config, includeProductName: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Include Product Name</span>
              </label>

              {/* Price Toggle */}
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includePrice}
                  onChange={(e) => setConfig({ ...config, includePrice: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Include Selling Price & MRP</span>
              </label>

              {/* Human-readable Barcode Text Toggle */}
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeBarcodeText}
                  onChange={(e) => setConfig({ ...config, includeBarcodeText: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Include Barcode SKU / EAN Text</span>
              </label>

              {/* Address Toggle */}
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeAddress}
                  onChange={(e) => setConfig({ ...config, includeAddress: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Include City & Phone (Kanchipuram)</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-3 bg-[#f8fafc] border-t border-[#e2e8f0] space-y-2">
            <button
              onClick={() => setIsPrintModalOpen(true)}
              disabled={selectedItems.length === 0}
              className="w-full py-2 bg-[#106ebe] hover:bg-[#005a9e] disabled:opacity-50 text-white font-bold rounded shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Preview 5×13 Sheet ({totalLabelsToPrint} Labels)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Print Sheet Modal (5 × 13 Layout Exact Calibration) */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-300 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#182b49] text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <SVTLogo size={24} />
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <span>A4 PRINT PREVIEW — 5 × 13 BARCODE STICKER SHEET</span>
                    <span className="text-[10px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 px-2 py-0.5 rounded font-mono">
                      {totalLabelsToPrint} Labels across {totalSheetsNeeded} Page(s)
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Label: 3.7cm × 2.0cm | Top Margin: 1.2cm | Gap: 0.3cm | Side Margins: 0.6cm | 65 Labels/Sheet
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="text-slate-300 hover:text-white font-bold px-2 py-1 rounded cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Container */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-200/90 flex flex-col items-center gap-6">
              <div className="bg-amber-50 border border-amber-300 rounded px-4 py-2 text-xs text-amber-900 max-w-3xl w-full flex items-center justify-between">
                <span>
                  <strong>Printer Calibration Notice:</strong> Ensure browser print scaling is set to <strong>100% (Actual size)</strong> and margins are set to <strong>None</strong> for 100% exact alignment with Avery/standard 65-label die-cut paper.
                </span>
                <span className="font-mono font-bold text-amber-800 text-[11px]">A4 (210 × 297 mm)</span>
              </div>

              {/* Render Every Page Sheet */}
              <div id="printable-barcode-sheet" ref={printAreaRef} className="space-y-6">
                {paginatedSheets.map((pageItems, pageIdx) => (
                  <div
                    key={`page-${pageIdx}`}
                    className="barcode-sheet-page bg-white shadow-xl border border-slate-400 relative"
                    style={{
                      width: '210mm',
                      minHeight: '297mm',
                      paddingTop: `${config.pageMarginTopMm}mm`,
                      paddingLeft: `${config.pageMarginLeftMm}mm`,
                      paddingRight: `${config.pageMarginRightMm}mm`,
                      boxSizing: 'border-box',
                      pageBreakAfter: 'always',
                      breakAfter: 'page',
                    }}
                  >
                    {/* Visual Sheet Header for On-Screen Preview */}
                    <div className="no-print absolute top-1 right-2 text-[9px] font-mono text-slate-400">
                      Page {pageIdx + 1} of {paginatedSheets.length} (5×13 Grid — {pageItems.length} Stickers)
                    </div>

                    {/* Exact 5x13 Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${config.labelsPerRow}, ${config.labelWidthMm}mm)`,
                        gridAutoRows: `${config.labelHeightMm}mm`,
                        columnGap: `${config.horizontalGapMm}mm`,
                        rowGap: `${config.verticalGapMm}mm`,
                        justifyContent: 'start',
                      }}
                    >
                      {pageItems.map((item, idx) => (
                        <div
                          key={`label-${pageIdx}-${idx}`}
                          className="barcode-sticker-cell border border-dashed border-slate-300/80 bg-white overflow-hidden"
                          style={{
                            width: `${config.labelWidthMm}mm`,
                            height: `${config.labelHeightMm}mm`,
                            boxSizing: 'border-box',
                          }}
                        >
                          {renderStickerContent(item, true)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-600">
                Ready to spool <strong>{totalLabelsToPrint} labels</strong> on <strong>{totalSheetsNeeded} A4 sticker sheet(s)</strong>.
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePrint}
                  className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Send to Printer (Print A4 5×13)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clean Global Print Styles for Perfect 5x13 Output */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm !important;
          }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden;
          }
          #printable-barcode-sheet, #printable-barcode-sheet * {
            visibility: visible;
          }
          #printable-barcode-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            margin: 0;
            padding: 0;
          }
          .barcode-sheet-page {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .barcode-sticker-cell {
            border: 0.5px dashed #e2e8f0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
