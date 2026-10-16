import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  FileSpreadsheet,
  Download,
  FolderTree,
  Barcode as BarcodeIcon,
  RotateCw,
  Search,
  FilterX,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  Eye,
  X,
  Check,
} from 'lucide-react';
import { Product, ProductFilter, PagedResult } from '../types';
import { db } from '../services/dbEngine';
import { TamilInput } from './TamilInput';

interface ProductMasterProps {
  onOpenAddProduct: () => void;
  onOpenEditProduct: (p: Product) => void;
  onOpenCategoryManager: () => void;
  onOpenBrandManager?: () => void;
  onOpenExcelImport: () => void;
  onOpenBarcodePrint: (p: Product) => void;
  onExportExcel: () => void;
  onRefreshData: () => void;
}

export const ProductMaster: React.FC<ProductMasterProps> = ({
  onOpenAddProduct,
  onOpenEditProduct,
  onOpenCategoryManager,
  onOpenBrandManager,
  onOpenExcelImport,
  onOpenBarcodePrint,
  onExportExcel,
  onRefreshData,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number>(0);
  const [selectedSubcategory, setSelectedSubcategory] = useState<number>(0);
  const [isLowStockOnly, setIsLowStockOnly] = useState(false);

  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  const categories = useMemo(() => db.getCategories(), [onRefreshData]);
  const subcategories = useMemo(
    () => db.getSubcategories(selectedCategory > 0 ? selectedCategory : undefined),
    [selectedCategory, onRefreshData]
  );

  // Execute query - Show all products matching search/category filters without pagination truncation
  const queryResult: PagedResult<Product> = useMemo(() => {
    const filter: ProductFilter = {
      searchTerm,
      categoryId: selectedCategory > 0 ? selectedCategory : undefined,
      subcategoryId: selectedSubcategory > 0 ? selectedSubcategory : undefined,
      isLowStockOnly,
      pageNumber: 1,
      pageSize: 100000,
    };
    return db.searchProducts(filter);
  }, [
    searchTerm,
    selectedCategory,
    selectedSubcategory,
    isLowStockOnly,
    onRefreshData,
  ]);

  const selectedProduct = useMemo(
    () => (selectedRowId ? db.getProductById(selectedRowId) : null),
    [selectedRowId, onRefreshData]
  );

  const handleDeactivateToggle = () => {
    if (!selectedProduct) return;
    if (selectedProduct.isActive) {
      if (confirm(`Deactivate product "${selectedProduct.nameEn}"?`)) {
        db.deactivateProduct(selectedProduct.id);
        onRefreshData();
      }
    } else {
      db.activateProduct(selectedProduct.id);
      onRefreshData();
    }
  };

  const handleDeleteProduct = (p: Product) => {
    if (confirm(`Are you sure you want to permanently delete product "${p.nameEn}" (${p.productCode})?`)) {
      db.deleteProduct(p.id);
      if (selectedRowId === p.id) {
        setSelectedRowId(null);
      }
      if (viewingProduct?.id === p.id) {
        setViewingProduct(null);
      }
      onRefreshData();
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory(0);
    setSelectedSubcategory(0);
    setIsLowStockOnly(false);
  };

  // Inline Row Editing State
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Product>>({});
  const [rowError, setRowError] = useState<string | null>(null);
  const [rowSuccess, setRowSuccess] = useState<string | null>(null);

  const startInlineEdit = (p: Product) => {
    setEditingRowId(p.id);
    setSelectedRowId(p.id);
    setRowError(null);
    setEditFormData({
      id: p.id,
      productCode: p.productCode,
      barcode: p.barcode,
      nameEn: p.nameEn,
      nameTa: p.nameTa || '',
      categoryId: p.categoryId,
      brandId: p.brandId,
      subcategoryId: p.subcategoryId,
      purchaseRate: p.purchaseRate,
      saleRate: p.saleRate,
      wholesaleRate: p.wholesaleRate,
      mrp: p.mrp,
      taxRate: p.taxRate,
      sgstRate: p.sgstRate ?? p.taxRate / 2,
      cgstRate: p.cgstRate ?? p.taxRate / 2,
      igstRate: p.igstRate ?? p.taxRate,
      currentStock: p.currentStock,
      openingStock: p.openingStock,
      reorderLevel: p.reorderLevel,
      maxStockLevel: p.maxStockLevel,
      unit: p.unit,
      hsnCode: p.hsnCode,
      isActive: p.isActive,
    });
  };

  const cancelInlineEdit = () => {
    setEditingRowId(null);
    setEditFormData({});
    setRowError(null);
  };

  const saveInlineEdit = () => {
    if (!editingRowId || !editFormData) return;
    setRowError(null);

    if (!editFormData.nameEn?.trim()) {
      setRowError('Product Name (English) cannot be empty.');
      return;
    }
    if (editFormData.barcode?.trim()) {
      const barcodeCheckEdit = db.isBarcodeUnique(editFormData.barcode.trim(), editingRowId);
      if (!barcodeCheckEdit.isUnique) {
        setRowError(`Barcode '${editFormData.barcode}' is already assigned to '${barcodeCheckEdit.conflictProduct?.nameEn}'. Duplicate barcodes are not allowed.`);
        return;
      }
    }
    if ((editFormData.saleRate ?? 0) < 0) {
      setRowError('Sale Rate cannot be negative.');
      return;
    }
    if ((editFormData.mrp ?? 0) > 0 && (editFormData.saleRate ?? 0) > (editFormData.mrp ?? 0)) {
      setRowError(`Sale Rate (₹${editFormData.saleRate}) cannot exceed MRP (₹${editFormData.mrp}).`);
      return;
    }

    const res = db.saveProduct(editFormData);
    if (!res.success) {
      setRowError(res.errors.join(' '));
      return;
    }

    setEditingRowId(null);
    setEditFormData({});
    setRowError(null);
    setRowSuccess(`Product "${res.product?.nameEn}" saved successfully!`);
    setTimeout(() => setRowSuccess(null), 3000);
    onRefreshData();
  };

  // Inline Add New Product Row State
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newFormData, setNewFormData] = useState<Partial<Product>>({});

  const startInlineAdd = () => {
    cancelInlineEdit();
    setIsAddingRow(true);
    setRowError(null);

    const all = db.getAllProducts();
    const nextNum = all.length + 1;
    const code = `PRD${String(nextNum).padStart(4, '0')}`;
    const autoBarcode = db.generateUniqueBarcode('A385');

    setNewFormData({
      productCode: code,
      barcode: autoBarcode,
      nameEn: '',
      nameTa: '',
      categoryId: categories[0]?.id || 1,
      brandId: null,
      subcategoryId: subcategories[0]?.id || null,
      purchaseRate: 0,
      saleRate: 0,
      wholesaleRate: 0,
      mrp: 0,
      taxRate: 0,
      sgstRate: 0,
      cgstRate: 0,
      igstRate: 0,
      currentStock: 0,
      openingStock: 0,
      reorderLevel: 5,
      maxStockLevel: 1000,
      unit: 'PCS',
      hsnCode: '',
      isActive: true,
    });
  };

  const cancelInlineAdd = () => {
    setIsAddingRow(false);
    setNewFormData({});
    setRowError(null);
  };

  const saveInlineAdd = () => {
    if (!newFormData.nameEn?.trim()) {
      setRowError('Product Name (English) is required.');
      return;
    }
    if (newFormData.barcode?.trim()) {
      const barcodeCheckAdd = db.isBarcodeUnique(newFormData.barcode.trim());
      if (!barcodeCheckAdd.isUnique) {
        setRowError(`Barcode '${newFormData.barcode}' is already assigned to '${barcodeCheckAdd.conflictProduct?.nameEn}'. Duplicate barcodes are not allowed.`);
        return;
      }
    }
    if ((newFormData.saleRate ?? 0) < 0) {
      setRowError('Sale Rate cannot be negative.');
      return;
    }
    if ((newFormData.mrp ?? 0) > 0 && (newFormData.saleRate ?? 0) > (newFormData.mrp ?? 0)) {
      setRowError(`Sale Rate (₹${newFormData.saleRate}) cannot exceed MRP (₹${newFormData.mrp}).`);
      return;
    }

    const res = db.saveProduct(newFormData);
    if (!res.success) {
      setRowError(res.errors.join(' '));
      return;
    }

    setIsAddingRow(false);
    setNewFormData({});
    setRowError(null);
    setRowSuccess(`New product "${res.product?.nameEn}" added successfully!`);
    setTimeout(() => setRowSuccess(null), 3000);
    onRefreshData();
  };

  useEffect(() => {
    const handleGlobalAdd = () => {
      startInlineAdd();
    };
    const handleGlobalEdit = (e: any) => {
      if (e?.detail) {
        startInlineEdit(e.detail);
      }
    };
    window.addEventListener('shopbilling:add-product', handleGlobalAdd);
    window.addEventListener('shopbilling:edit-product', handleGlobalEdit);
    return () => {
      window.removeEventListener('shopbilling:add-product', handleGlobalAdd);
      window.removeEventListener('shopbilling:edit-product', handleGlobalEdit);
    };
  }, [categories, subcategories]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f0f3f6] overflow-hidden text-slate-800">
      {/* 1. Top Action Toolbar - Single Line */}
      <div className="bg-white border-b border-slate-200 px-2.5 py-1.5 flex items-center gap-1 shadow-2xs overflow-x-auto whitespace-nowrap select-none shrink-0">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs mr-2 shrink-0">
          <Boxes className="w-4 h-4 text-[#106ebe]" />
          <span>Product Master</span>
          <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.2 rounded font-mono font-medium">
            {queryResult.totalCount.toLocaleString()}
          </span>
        </div>

        <button
          onClick={startInlineAdd}
          className="flex items-center gap-1 px-2.5 py-1 bg-[#106ebe] hover:bg-[#005a9e] text-white text-xs font-semibold rounded shadow-xs active:shadow-inner shrink-0 whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Product (F2)</span>
        </button>

        <button
          onClick={() => selectedProduct && startInlineEdit(selectedProduct)}
          disabled={!selectedProduct}
          className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 text-xs font-medium rounded border border-slate-300 shrink-0 whitespace-nowrap cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5 text-slate-500" />
          <span>Edit (F4)</span>
        </button>

        <button
          onClick={handleDeactivateToggle}
          disabled={!selectedProduct}
          className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 disabled:opacity-40 text-xs font-medium rounded border border-slate-300 shrink-0 whitespace-nowrap cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5 text-slate-500" />
          <span>{selectedProduct?.isActive ? 'Deactivate' : 'Activate'}</span>
        </button>

        <div className="h-4 w-px bg-slate-300 mx-0.5 shrink-0" />

        <button
          onClick={onOpenExcelImport}
          className="flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-medium rounded shrink-0 whitespace-nowrap cursor-pointer"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span>Import Excel</span>
        </button>

        <button
          onClick={onExportExcel}
          className="flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-medium rounded shrink-0 whitespace-nowrap cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          <span>Export Excel</span>
        </button>

        <div className="h-4 w-px bg-slate-300 mx-0.5 shrink-0" />

        <button
          onClick={onOpenCategoryManager}
          className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded border border-slate-300 shrink-0 whitespace-nowrap cursor-pointer"
        >
          <FolderTree className="w-3.5 h-3.5 text-slate-500" />
          <span>Categories</span>
        </button>

        <button
          onClick={() => selectedProduct && onOpenBarcodePrint(selectedProduct)}
          disabled={!selectedProduct}
          className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 text-xs font-medium rounded border border-slate-300 shrink-0 whitespace-nowrap cursor-pointer"
        >
          <BarcodeIcon className="w-3.5 h-3.5 text-slate-500" />
          <span>Barcode Label</span>
        </button>



        <button
          onClick={onRefreshData}
          className="p-1 text-slate-600 hover:bg-slate-200 rounded border border-slate-300 ml-auto shrink-0 cursor-pointer"
          title="Refresh"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Filter & Search Panel - Single Line */}
      <div className="bg-[#f8fafc] border-b border-slate-200 px-3 py-1.5 flex items-center gap-2 text-xs overflow-x-auto whitespace-nowrap shrink-0">
        {/* Search Input */}
        <div className="relative flex items-center min-w-[200px] flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Name (English / தமிழ்), Barcode, SKU..."
            className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded focus:border-[#106ebe] focus:outline-none font-medium placeholder:text-slate-400 text-xs"
          />
        </div>

        {/* Category Dropdown */}
        <div className="flex items-center gap-1 shrink-0">
          <label className="text-slate-500 font-medium">Category:</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(Number(e.target.value));
              setSelectedSubcategory(0);
            }}
            className="px-2 py-1 bg-white border border-slate-300 rounded focus:border-[#106ebe] focus:outline-none text-xs"
          >
            <option value={0}>All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Subcategory Dropdown */}
        <div className="flex items-center gap-1 shrink-0">
          <label className="text-slate-500 font-medium">Subcategory:</label>
          <select
            value={selectedSubcategory}
            onChange={(e) => setSelectedSubcategory(Number(e.target.value))}
            className="px-2 py-1 bg-white border border-slate-300 rounded focus:border-[#106ebe] focus:outline-none text-xs"
          >
            <option value={0}>All Subcategories</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Low Stock Checkbox */}
        <label className="flex items-center gap-1.5 cursor-pointer text-rose-700 font-medium shrink-0">
          <input
            type="checkbox"
            checked={isLowStockOnly}
            onChange={(e) => setIsLowStockOnly(e.target.checked)}
            className="accent-rose-600 rounded"
          />
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Low Stock</span>
        </label>

        {/* Clear Filters */}
        <button
          onClick={handleClearFilters}
          className="flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors shrink-0 ml-auto cursor-pointer"
        >
          <FilterX className="w-3 h-3" />
          <span>Clear</span>
        </button>
      </div>

      {/* 3. Product Count Bar */}
      <div className="bg-[#e4ecf5] border-b border-[#c8d9ea] px-3 py-1 flex items-center justify-between text-xs text-[#1e4a7a] shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            {queryResult.totalCount.toLocaleString()} products found
          </span>
          <span>·</span>
          <span className="text-slate-600">Showing all items</span>
          {editingRowId && (
            <span className="ml-2 px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-medium text-[11px] animate-pulse">
              ✏️ Inline Editing Active (Press Enter to Save, Esc to Cancel)
            </span>
          )}
          {isAddingRow && (
            <span className="ml-2 px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded font-medium text-[11px] animate-pulse">
              ✨ Adding New Product (Press Enter to Save, Esc to Discard)
            </span>
          )}
        </div>

        {rowError && (
          <div className="text-rose-800 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>{rowError}</span>
            <button
              onClick={() => setRowError(null)}
              className="text-rose-600 hover:text-rose-900 font-bold ml-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {rowSuccess && (
          <div className="text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{rowSuccess}</span>
            <button
              onClick={() => setRowSuccess(null)}
              className="text-emerald-600 hover:text-emerald-900 font-bold ml-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 4. Product Data Grid - S.No, SGST, CGST, IGST, View/Edit/Delete Actions, No Overlap */}
      <div className="flex-1 overflow-y-auto overflow-x-auto bg-white border-b border-slate-200">
        <table className="w-full min-w-[1100px] table-fixed text-left border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-20 select-none shadow-xs">
            <tr>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-1 font-semibold border-b border-r border-[#153a5e] text-center w-[3.5%] min-w-[35px] truncate">S.No</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] w-[11%] min-w-[90px] truncate">Barcode</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2.5 font-semibold border-b border-r border-[#153a5e] w-[23.5%] min-w-[160px] truncate">Product Name (English)</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] w-[16%] min-w-[120px] truncate">Tamil Name (தமிழ்)</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] w-[11%] min-w-[85px] truncate">Category</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] text-right w-[6%] min-w-[55px] truncate">Pur. ₹</th>
              <th className="sticky top-0 z-20 bg-[#163c61] text-white py-2 px-2 font-bold border-b border-r border-[#153a5e] text-right w-[6%] min-w-[55px] truncate">Sale ₹</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] text-right w-[5%] min-w-[50px] truncate">MRP ₹</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-1 font-semibold border-b border-r border-[#153a5e] text-center w-[4.5%] min-w-[46px] truncate" title="State GST %">SGST %</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-1 font-semibold border-b border-r border-[#153a5e] text-center w-[4.5%] min-w-[46px] truncate" title="Central GST %">CGST %</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-1 font-semibold border-b border-r border-[#153a5e] text-center w-[4.5%] min-w-[46px] truncate" title="Integrated GST %">IGST %</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] text-right w-[7.5%] min-w-[70px] truncate">Stock</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-1 font-semibold border-b border-[#153a5e] text-center w-[7%] min-w-[80px] truncate">Actions</th>
            </tr>
          </thead>
          <tbody className="font-normal bg-white">
            {/* Inline Add New Product Row */}
            {isAddingRow && (
              <tr
                className="bg-emerald-50/95 text-slate-900 border-y-2 border-emerald-500 font-normal shadow-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <td className="py-1 px-1 text-center font-mono text-[10px] text-emerald-900 border-b border-r border-emerald-300 bg-emerald-100 font-bold">
                  + NEW
                </td>
                <td className="py-1 px-1 border-b border-r border-emerald-200">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={newFormData.barcode || ''}
                      onChange={(e) => setNewFormData((prev) => ({ ...prev, barcode: e.target.value.toUpperCase() }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveInlineAdd();
                        if (e.key === 'Escape') cancelInlineAdd();
                      }}
                      placeholder="A385, A386..."
                      className={`w-full pl-1.5 pr-6 py-1 text-[11px] font-mono bg-white border ${
                        newFormData.barcode && !db.isBarcodeUnique(newFormData.barcode).isUnique
                          ? 'border-red-500 bg-red-50 text-red-900 ring-1 ring-red-500 font-bold'
                          : 'border-emerald-500'
                      } rounded focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs`}
                      title={
                        newFormData.barcode && !db.isBarcodeUnique(newFormData.barcode).isUnique
                          ? `Duplicate barcode! Already used by '${db.isBarcodeUnique(newFormData.barcode).conflictProduct?.nameEn}' (Must be unique)`
                          : 'Auto sequential barcode: A385, A386, A387...'
                      }
                    />
                    <div className="absolute right-1 flex items-center gap-0.5">
                      {newFormData.barcode && (
                        <button
                          type="button"
                          onClick={() => setNewFormData((prev) => ({ ...prev, barcode: '' }))}
                          title="Remove barcode"
                          className="text-slate-400 hover:text-red-600 p-0.5 cursor-pointer text-[10px]"
                        >
                          ✕
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setNewFormData((prev) => ({ ...prev, barcode: db.generateUniqueBarcode('A385') }))}
                        title="Generate next sequential unique barcode A385, A386..."
                        className="text-slate-400 hover:text-emerald-700 hover:scale-110 p-0.5 cursor-pointer text-xs"
                      >
                        ⚡
                      </button>
                    </div>
                  </div>
                  {newFormData.barcode && !db.isBarcodeUnique(newFormData.barcode).isUnique && (
                    <div className="text-[9px] text-red-600 font-bold leading-tight mt-0.5 truncate">
                      ⚠️ Duplicate barcode!
                    </div>
                  )}
                </td>
                <td className="py-1 px-1 border-b border-r border-emerald-200">
                  <input
                    type="text"
                    value={newFormData.nameEn || ''}
                    onChange={(e) => setNewFormData((prev) => ({ ...prev, nameEn: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveInlineAdd();
                      if (e.key === 'Escape') cancelInlineAdd();
                    }}
                    placeholder="Product Name (English) *"
                    autoFocus
                    className="w-full px-1.5 py-1 text-xs font-semibold bg-white border border-emerald-500 rounded focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                  />
                </td>
                <td className="py-1 px-1 border-b border-r border-emerald-200">
                  <TamilInput
                    value={newFormData.nameTa || ''}
                    onChange={(val) => setNewFormData((prev) => ({ ...prev, nameTa: val }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveInlineAdd();
                      if (e.key === 'Escape') cancelInlineAdd();
                    }}
                    englishName={newFormData.nameEn}
                    placeholder="தமிழ் பெயர்"
                    className="px-1.5 py-1 text-xs bg-white border border-emerald-500 rounded focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                  />
                </td>
                <td className="py-1 px-1 border-b border-r border-emerald-200">
                  <select
                    value={newFormData.categoryId || 0}
                    onChange={(e) => setNewFormData((prev) => ({ ...prev, categoryId: Number(e.target.value) || null }))}
                    className="w-full px-1 py-1 text-xs bg-white border border-emerald-500 rounded focus:border-emerald-700 focus:outline-none shadow-2xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 px-1 border-b border-r border-emerald-200">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newFormData.purchaseRate ?? ''}
                    onChange={(e) => setNewFormData((prev) => ({ ...prev, purchaseRate: parseFloat(e.target.value) || 0 }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveInlineAdd();
                      if (e.key === 'Escape') cancelInlineAdd();
                    }}
                    placeholder="0.00"
                    className="w-full px-1 py-1 text-xs text-right font-mono bg-white border border-emerald-500 rounded focus:border-emerald-700 focus:outline-none shadow-2xs"
                  />
                </td>
                <td className="py-1 px-1 border-b border-r border-emerald-200">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newFormData.saleRate ?? ''}
                    onChange={(e) => setNewFormData((prev) => ({ ...prev, saleRate: parseFloat(e.target.value) || 0 }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveInlineAdd();
                      if (e.key === 'Escape') cancelInlineAdd();
                    }}
                    placeholder="0.00 *"
                    className="w-full px-1 py-1 text-xs text-right font-mono font-bold text-emerald-800 bg-white border-2 border-emerald-600 rounded focus:border-emerald-700 focus:outline-none shadow-2xs"
                  />
                </td>
                <td className="py-1 px-1 border-b border-r border-emerald-200">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newFormData.mrp ?? ''}
                    onChange={(e) => setNewFormData((prev) => ({ ...prev, mrp: parseFloat(e.target.value) || 0 }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveInlineAdd();
                      if (e.key === 'Escape') cancelInlineAdd();
                    }}
                    placeholder="0.00"
                    className="w-full px-1 py-1 text-xs text-right font-mono bg-white border border-emerald-500 rounded focus:border-emerald-700 focus:outline-none shadow-2xs"
                  />
                </td>
                <td className="py-1 px-0.5 border-b border-r border-emerald-200">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    value={newFormData.sgstRate ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                      setNewFormData((prev) => {
                        const shouldSyncCgst = prev.cgstRate === undefined || prev.cgstRate === prev.sgstRate;
                        const cgst = shouldSyncCgst ? val : (prev.cgstRate || 0);
                        return {
                          ...prev,
                          sgstRate: val,
                          cgstRate: cgst,
                          igstRate: Math.round((val + cgst) * 100) / 100,
                          taxRate: Math.round((val + cgst) * 100) / 100,
                        };
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveInlineAdd();
                      if (e.key === 'Escape') cancelInlineAdd();
                    }}
                    placeholder="0"
                    className="w-full px-0.5 py-1 text-xs text-center font-mono bg-white border border-emerald-500 rounded focus:border-emerald-700 focus:outline-none shadow-2xs"
                    title="SGST %"
                  />
                </td>
                <td className="py-1 px-0.5 border-b border-r border-emerald-200">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    value={newFormData.cgstRate ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                      setNewFormData((prev) => {
                        const shouldSyncSgst = prev.sgstRate === undefined || prev.sgstRate === prev.cgstRate;
                        const sgst = shouldSyncSgst ? val : (prev.sgstRate || 0);
                        return {
                          ...prev,
                          cgstRate: val,
                          sgstRate: sgst,
                          igstRate: Math.round((sgst + val) * 100) / 100,
                          taxRate: Math.round((sgst + val) * 100) / 100,
                        };
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveInlineAdd();
                      if (e.key === 'Escape') cancelInlineAdd();
                    }}
                    placeholder="0"
                    className="w-full px-0.5 py-1 text-xs text-center font-mono bg-white border border-emerald-500 rounded focus:border-emerald-700 focus:outline-none shadow-2xs"
                    title="CGST %"
                  />
                </td>
                <td className="py-1 px-0.5 border-b border-r border-emerald-200">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    value={newFormData.igstRate ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                      setNewFormData((prev) => ({
                        ...prev,
                        igstRate: val,
                        taxRate: val,
                        sgstRate: Math.round((val / 2) * 100) / 100,
                        cgstRate: Math.round((val / 2) * 100) / 100,
                      }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveInlineAdd();
                      if (e.key === 'Escape') cancelInlineAdd();
                    }}
                    placeholder="0"
                    className="w-full px-0.5 py-1 text-xs text-center font-mono bg-white border border-emerald-500 rounded focus:border-emerald-700 focus:outline-none shadow-2xs"
                    title="IGST %"
                  />
                </td>
                <td className="py-1 px-1 border-b border-r border-emerald-200">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newFormData.currentStock ?? ''}
                    onChange={(e) => setNewFormData((prev) => ({ ...prev, currentStock: parseFloat(e.target.value) || 0 }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveInlineAdd();
                      if (e.key === 'Escape') cancelInlineAdd();
                    }}
                    placeholder="0"
                    className="w-full px-1 py-1 text-xs text-right font-mono font-bold bg-white border border-emerald-500 rounded focus:border-emerald-700 focus:outline-none shadow-2xs"
                  />
                </td>
                <td className="py-1 px-1 border-b border-emerald-200 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={saveInlineAdd}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs cursor-pointer transition-colors flex items-center gap-0.5"
                      title="Save New Product (Enter)"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={cancelInlineAdd}
                      className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded shadow-xs cursor-pointer transition-colors"
                      title="Cancel (Esc)"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {queryResult.items.length === 0 && !isAddingRow ? (
              <tr>
                <td colSpan={13} className="py-12 text-center text-slate-400">
                  No products matched the current search criteria.
                </td>
              </tr>
            ) : (
              queryResult.items.map((p, index) => {
                const isSelected = selectedRowId === p.id;
                const isEditing = editingRowId === p.id;
                const isLowStock = p.currentStock <= p.reorderLevel;
                const serialNo = index + 1;
                const sgstRate = p.sgstRate ?? p.taxRate / 2;
                const cgstRate = p.cgstRate ?? p.taxRate / 2;
                const igstRate = p.igstRate ?? p.taxRate;

                if (isEditing) {
                  return (
                    <tr
                      key={p.id}
                      className="bg-amber-50/90 text-slate-900 border-y-2 border-amber-500 font-normal shadow-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <td className="py-1 px-1 text-center font-mono text-[11px] text-amber-900 border-b border-r border-amber-200 bg-amber-100/60 font-bold">
                        {serialNo}
                      </td>
                      <td className="py-1 px-1 border-b border-r border-amber-200">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            value={editFormData.barcode || ''}
                            onChange={(e) => setEditFormData((prev) => ({ ...prev, barcode: e.target.value.toUpperCase() }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveInlineEdit();
                              if (e.key === 'Escape') cancelInlineEdit();
                            }}
                            placeholder="A385, A386..."
                            className={`w-full pl-1.5 pr-6 py-1 text-[11px] font-mono bg-white border ${
                              editFormData.barcode && !db.isBarcodeUnique(editFormData.barcode, editingRowId).isUnique
                                ? 'border-red-500 bg-red-50 text-red-900 ring-1 ring-red-500 font-bold'
                                : 'border-blue-400'
                            } rounded focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs`}
                            autoFocus
                            title={
                              editFormData.barcode && !db.isBarcodeUnique(editFormData.barcode, editingRowId).isUnique
                                ? `Duplicate barcode! Already used by '${db.isBarcodeUnique(editFormData.barcode, editingRowId).conflictProduct?.nameEn}' (Must be unique)`
                                : 'Auto sequential barcode: A385, A386, A387...'
                            }
                          />
                          <div className="absolute right-1 flex items-center gap-0.5">
                            {editFormData.barcode && (
                              <button
                                type="button"
                                onClick={() => setEditFormData((prev) => ({ ...prev, barcode: '' }))}
                                title="Remove barcode"
                                className="text-slate-400 hover:text-red-600 p-0.5 cursor-pointer text-[10px]"
                              >
                                ✕
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditFormData((prev) => ({ ...prev, barcode: db.generateUniqueBarcode('A385') }))}
                              title="Generate next sequential unique barcode A385, A386..."
                              className="text-slate-400 hover:text-blue-700 hover:scale-110 p-0.5 cursor-pointer text-xs"
                            >
                              ⚡
                            </button>
                          </div>
                        </div>
                        {editFormData.barcode && !db.isBarcodeUnique(editFormData.barcode, editingRowId).isUnique && (
                          <div className="text-[9px] text-red-600 font-bold leading-tight mt-0.5 truncate">
                            ⚠️ Duplicate barcode!
                          </div>
                        )}
                      </td>
                      <td className="py-1 px-1 border-b border-r border-amber-200">
                        <input
                          type="text"
                          value={editFormData.nameEn || ''}
                          onChange={(e) => setEditFormData((prev) => ({ ...prev, nameEn: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit();
                            if (e.key === 'Escape') cancelInlineEdit();
                          }}
                          placeholder="English Name"
                          className="w-full px-1.5 py-1 text-xs font-semibold bg-white border border-blue-400 rounded focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                        />
                      </td>
                      <td className="py-1 px-1 border-b border-r border-amber-200">
                        <TamilInput
                          value={editFormData.nameTa || ''}
                          onChange={(val) => setEditFormData((prev) => ({ ...prev, nameTa: val }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit();
                            if (e.key === 'Escape') cancelInlineEdit();
                          }}
                          englishName={editFormData.nameEn}
                          placeholder="தமிழ் பெயர்"
                          className="px-1.5 py-1 text-xs bg-white border border-blue-400 rounded focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                        />
                      </td>
                      <td className="py-1 px-1 border-b border-r border-amber-200">
                        <select
                          value={editFormData.categoryId || 0}
                          onChange={(e) => setEditFormData((prev) => ({ ...prev, categoryId: Number(e.target.value) || null }))}
                          className="w-full px-1 py-1 text-xs bg-white border border-blue-400 rounded focus:border-blue-600 focus:outline-none shadow-2xs"
                        >
                          <option value={0}>General</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 px-1 border-b border-r border-amber-200">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={editFormData.purchaseRate ?? ''}
                          onChange={(e) => setEditFormData((prev) => ({ ...prev, purchaseRate: parseFloat(e.target.value) || 0 }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit();
                            if (e.key === 'Escape') cancelInlineEdit();
                          }}
                          placeholder="0.00"
                          className="w-full px-1 py-1 text-xs text-right font-mono bg-white border border-blue-400 rounded focus:border-blue-600 focus:outline-none shadow-2xs"
                        />
                      </td>
                      <td className="py-1 px-1 border-b border-r border-amber-200">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={editFormData.saleRate ?? ''}
                          onChange={(e) => setEditFormData((prev) => ({ ...prev, saleRate: parseFloat(e.target.value) || 0 }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit();
                            if (e.key === 'Escape') cancelInlineEdit();
                          }}
                          placeholder="0.00"
                          className="w-full px-1 py-1 text-xs text-right font-mono font-bold text-emerald-800 bg-white border-2 border-emerald-500 rounded focus:border-emerald-600 focus:outline-none shadow-2xs"
                        />
                      </td>
                      <td className="py-1 px-1 border-b border-r border-amber-200">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={editFormData.mrp ?? ''}
                          onChange={(e) => setEditFormData((prev) => ({ ...prev, mrp: parseFloat(e.target.value) || 0 }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit();
                            if (e.key === 'Escape') cancelInlineEdit();
                          }}
                          placeholder="0.00"
                          className="w-full px-1 py-1 text-xs text-right font-mono bg-white border border-blue-400 rounded focus:border-blue-600 focus:outline-none shadow-2xs"
                        />
                      </td>
                      <td className="py-1 px-0.5 border-b border-r border-amber-200">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          value={editFormData.sgstRate ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                            setEditFormData((prev) => {
                              const shouldSyncCgst = prev.cgstRate === undefined || prev.cgstRate === prev.sgstRate;
                              const cgst = shouldSyncCgst ? val : (prev.cgstRate || 0);
                              return {
                                ...prev,
                                sgstRate: val,
                                cgstRate: cgst,
                                igstRate: Math.round((val + cgst) * 100) / 100,
                                taxRate: Math.round((val + cgst) * 100) / 100,
                              };
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit();
                            if (e.key === 'Escape') cancelInlineEdit();
                          }}
                          placeholder="0"
                          className="w-full px-0.5 py-1 text-xs text-center font-mono bg-white border border-blue-400 rounded focus:border-blue-600 focus:outline-none shadow-2xs"
                          title="SGST %"
                        />
                      </td>
                      <td className="py-1 px-0.5 border-b border-r border-amber-200">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          value={editFormData.cgstRate ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                            setEditFormData((prev) => {
                              const shouldSyncSgst = prev.sgstRate === undefined || prev.sgstRate === prev.cgstRate;
                              const sgst = shouldSyncSgst ? val : (prev.sgstRate || 0);
                              return {
                                ...prev,
                                cgstRate: val,
                                sgstRate: sgst,
                                igstRate: Math.round((sgst + val) * 100) / 100,
                                taxRate: Math.round((sgst + val) * 100) / 100,
                              };
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit();
                            if (e.key === 'Escape') cancelInlineEdit();
                          }}
                          placeholder="0"
                          className="w-full px-0.5 py-1 text-xs text-center font-mono bg-white border border-blue-400 rounded focus:border-blue-600 focus:outline-none shadow-2xs"
                          title="CGST %"
                        />
                      </td>
                      <td className="py-1 px-0.5 border-b border-r border-amber-200">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          value={editFormData.igstRate ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                            setEditFormData((prev) => ({
                              ...prev,
                              igstRate: val,
                              taxRate: val,
                              sgstRate: Math.round((val / 2) * 100) / 100,
                              cgstRate: Math.round((val / 2) * 100) / 100,
                            }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit();
                            if (e.key === 'Escape') cancelInlineEdit();
                          }}
                          placeholder="0"
                          className="w-full px-0.5 py-1 text-xs text-center font-mono bg-white border border-blue-400 rounded focus:border-blue-600 focus:outline-none shadow-2xs"
                          title="IGST %"
                        />
                      </td>
                      <td className="py-1 px-1 border-b border-r border-amber-200">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={editFormData.currentStock ?? ''}
                          onChange={(e) => setEditFormData((prev) => ({ ...prev, currentStock: parseFloat(e.target.value) || 0 }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit();
                            if (e.key === 'Escape') cancelInlineEdit();
                          }}
                          placeholder="0"
                          className="w-full px-1 py-1 text-xs text-right font-mono font-bold bg-white border border-blue-400 rounded focus:border-blue-600 focus:outline-none shadow-2xs"
                        />
                      </td>
                      <td className="py-1 px-1 border-b border-amber-200 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={saveInlineEdit}
                            className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-xs cursor-pointer transition-colors"
                            title="Save (Enter)"
                            aria-label="Save"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelInlineEdit}
                            className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded shadow-xs cursor-pointer transition-colors"
                            title="Cancel (Esc)"
                            aria-label="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedRowId(p.id)}
                    onDoubleClick={() => startInlineEdit(p)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#cce8ff] text-[#004a80] font-medium'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-1.5 px-1 text-center font-mono text-[11px] text-slate-500 border-b border-r border-slate-200 truncate">
                      {serialNo}
                    </td>
                    <td className="py-1.5 px-2 font-mono text-[11px] border-b border-r border-slate-200 truncate">
                      {p.barcode}
                    </td>
                    <td className="py-1.5 px-2.5 font-medium border-b border-r border-slate-200 truncate" title={p.nameEn}>
                      {p.nameEn}
                    </td>
                    <td className="py-1.5 px-2 text-slate-700 font-sans border-b border-r border-slate-200 truncate" title={p.nameTa || ''}>
                      {p.nameTa || '—'}
                    </td>
                    <td className="py-1.5 px-2 text-slate-600 border-b border-r border-slate-200 truncate" title={p.categoryName || ''}>
                      {p.categoryName || '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums border-b border-r border-slate-200 text-slate-600 truncate">
                      ₹{p.purchaseRate.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-semibold tabular-nums border-b border-r border-slate-200 text-slate-900 bg-slate-50/50 truncate">
                      ₹{p.saleRate.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums border-b border-r border-slate-200 text-slate-600 truncate">
                      ₹{p.mrp.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-1 text-center font-mono tabular-nums border-b border-r border-slate-200 text-slate-600 truncate" title={`SGST: ${sgstRate.toFixed(1)}%`}>
                      {sgstRate.toFixed(1)}%
                    </td>
                    <td className="py-1.5 px-1 text-center font-mono tabular-nums border-b border-r border-slate-200 text-slate-600 truncate" title={`CGST: ${cgstRate.toFixed(1)}%`}>
                      {cgstRate.toFixed(1)}%
                    </td>
                    <td className="py-1.5 px-1 text-center font-mono tabular-nums border-b border-r border-slate-200 text-slate-600 truncate" title={`IGST: ${igstRate.toFixed(1)}%`}>
                      {igstRate.toFixed(1)}%
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right font-mono font-bold tabular-nums border-b border-r border-slate-200 truncate overflow-hidden ${
                        isLowStock ? 'text-rose-600 bg-rose-50' : 'text-slate-800'
                      }`}
                      title={`${p.currentStock}`}
                    >
                      {p.currentStock}
                    </td>
                    <td className="py-1 px-1 border-b border-slate-200 text-center overflow-hidden min-w-[80px]" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setViewingProduct(p)}
                          className="p-1 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-300 rounded transition-colors cursor-pointer shrink-0 shadow-2xs"
                          title="View Product Details"
                          aria-label="View Details"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                        </button>
                        <button
                          type="button"
                          onClick={() => startInlineEdit(p)}
                          className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-900 border border-amber-200 hover:border-amber-300 rounded transition-colors cursor-pointer shrink-0 shadow-2xs"
                          title="Edit Product Row"
                          aria-label="Edit Product"
                        >
                          <Pencil className="w-3.5 h-3.5 shrink-0" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p)}
                          className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 border border-rose-200 hover:border-rose-300 rounded transition-colors cursor-pointer shrink-0 shadow-2xs"
                          title="Delete Product"
                          aria-label="Delete Product"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 6. View Product Details Modal */}
      {viewingProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#182b49] text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-blue-300" />
                <h3 className="font-semibold text-sm">
                  Product Details — {viewingProduct.productCode}
                </h3>
              </div>
              <button
                onClick={() => setViewingProduct(null)}
                className="text-slate-300 hover:text-white p-1 rounded hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Basic Information */}
              <div className="bg-slate-50 p-3 rounded border border-slate-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 font-medium block">Product Name (English):</span>
                    <span className="text-sm font-bold text-slate-800">{viewingProduct.nameEn}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Tamil Name (தமிழ்):</span>
                    <span className="text-sm font-semibold text-slate-800 font-sans">{viewingProduct.nameTa || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Barcode:</span>
                    <span className="font-mono text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5">
                      {viewingProduct.barcode}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">HSN Code / Unit:</span>
                    <span className="font-mono text-slate-800">{viewingProduct.hsnCode || '—'} / {viewingProduct.unit}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Category:</span>
                    <span className="text-slate-800 font-medium">{viewingProduct.categoryName || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Pricing & Commercials */}
              <div className="bg-blue-50/50 p-3 rounded border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-1.5">
                  <span>Rates & Pricing Structure</span>
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-white p-2 rounded border border-blue-100">
                    <span className="text-slate-500 block text-[11px]">Purchase Rate</span>
                    <span className="font-mono font-semibold text-slate-800 text-sm">₹{viewingProduct.purchaseRate.toFixed(2)}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-100">
                    <span className="text-slate-500 block text-[11px]">Retail Sale Rate</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">₹{viewingProduct.saleRate.toFixed(2)}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-100">
                    <span className="text-slate-500 block text-[11px]">Wholesale Rate</span>
                    <span className="font-mono font-semibold text-slate-800 text-sm">₹{viewingProduct.wholesaleRate.toFixed(2)}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-100">
                    <span className="text-slate-500 block text-[11px]">MRP</span>
                    <span className="font-mono font-semibold text-slate-800 text-sm">₹{viewingProduct.mrp.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* GST Tax Structure */}
              <div className="bg-amber-50/50 p-3 rounded border border-amber-200">
                <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-1.5">
                  <span>GST Breakdown</span>
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white p-2 rounded border border-amber-100 text-center">
                    <span className="text-slate-500 block text-[11px]">SGST Rate</span>
                    <span className="font-mono font-bold text-amber-800 text-sm">
                      {(viewingProduct.sgstRate ?? viewingProduct.taxRate / 2).toFixed(1)}%
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-amber-100 text-center">
                    <span className="text-slate-500 block text-[11px]">CGST Rate</span>
                    <span className="font-mono font-bold text-amber-800 text-sm">
                      {(viewingProduct.cgstRate ?? viewingProduct.taxRate / 2).toFixed(1)}%
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-amber-100 text-center">
                    <span className="text-slate-500 block text-[11px]">IGST Rate</span>
                    <span className="font-mono font-bold text-amber-800 text-sm">
                      {(viewingProduct.igstRate ?? viewingProduct.taxRate).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Inventory Stock Position */}
              <div className="bg-slate-50 p-3 rounded border border-slate-200">
                <h4 className="font-semibold text-slate-800 mb-2">Inventory Levels</h4>
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Current Stock</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">
                      {viewingProduct.currentStock} {viewingProduct.unit}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Opening Stock</span>
                    <span className="font-mono text-slate-700 text-sm">
                      {viewingProduct.openingStock} {viewingProduct.unit}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Reorder Threshold</span>
                    <span className="font-mono text-rose-600 font-semibold text-sm">
                      {viewingProduct.reorderLevel} {viewingProduct.unit}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Max Stock Level</span>
                    <span className="font-mono text-slate-700 text-sm">
                      {viewingProduct.maxStockLevel} {viewingProduct.unit}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const p = viewingProduct;
                  setViewingProduct(null);
                  onOpenBarcodePrint(p);
                }}
                className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded font-medium flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <BarcodeIcon className="w-3.5 h-3.5 text-slate-600" />
                <span>Print Barcode</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = viewingProduct;
                  setViewingProduct(null);
                  startInlineEdit(p);
                }}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Row</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingProduct(null)}
                className="px-4 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-medium cursor-pointer text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
