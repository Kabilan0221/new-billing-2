import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  FileSpreadsheet,
  Download,
  FolderTree,
  Tag,
  Barcode as BarcodeIcon,
  Zap,
  RotateCw,
  Search,
  FilterX,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  Eye,
  X,
} from 'lucide-react';
import { Product, ProductFilter, PagedResult } from '../types';
import { db } from '../services/dbEngine';

interface ProductMasterProps {
  onOpenAddProduct: () => void;
  onOpenEditProduct: (p: Product) => void;
  onOpenCategoryManager: () => void;
  onOpenBrandManager: () => void;
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
  const [selectedBrand, setSelectedBrand] = useState<number>(0);
  const [isLowStockOnly, setIsLowStockOnly] = useState(false);

  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkMessage, setBenchmarkMessage] = useState<string | null>(null);

  const categories = useMemo(() => db.getCategories(), [onRefreshData]);
  const subcategories = useMemo(
    () => db.getSubcategories(selectedCategory > 0 ? selectedCategory : undefined),
    [selectedCategory, onRefreshData]
  );
  const brands = useMemo(() => db.getBrands(), [onRefreshData]);

  // Execute query - Show all products matching search/category filters without status constraint
  const queryResult: PagedResult<Product> = useMemo(() => {
    const filter: ProductFilter = {
      searchTerm,
      categoryId: selectedCategory > 0 ? selectedCategory : undefined,
      subcategoryId: selectedSubcategory > 0 ? selectedSubcategory : undefined,
      brandId: selectedBrand > 0 ? selectedBrand : undefined,
      isLowStockOnly,
      pageNumber,
      pageSize,
    };
    return db.searchProducts(filter);
  }, [
    searchTerm,
    selectedCategory,
    selectedSubcategory,
    selectedBrand,
    isLowStockOnly,
    pageNumber,
    pageSize,
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

  const handleBenchmark50k = () => {
    setBenchmarkLoading(true);
    setTimeout(() => {
      const res = db.load50kBenchmarkDataset();
      setBenchmarkLoading(false);
      setBenchmarkMessage(`Loaded & indexed 50,000 products in ${res.durationMs}ms`);
      onRefreshData();
      setTimeout(() => setBenchmarkMessage(null), 5000);
    }, 100);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory(0);
    setSelectedSubcategory(0);
    setSelectedBrand(0);
    setIsLowStockOnly(false);
    setPageNumber(1);
  };

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
          onClick={onOpenAddProduct}
          className="flex items-center gap-1 px-2.5 py-1 bg-[#106ebe] hover:bg-[#005a9e] text-white text-xs font-semibold rounded shadow-xs active:shadow-inner shrink-0 whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Product (F2)</span>
        </button>

        <button
          onClick={() => selectedProduct && onOpenEditProduct(selectedProduct)}
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
          onClick={onOpenBrandManager}
          className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded border border-slate-300 shrink-0 whitespace-nowrap cursor-pointer"
        >
          <Tag className="w-3.5 h-3.5 text-slate-500" />
          <span>Brands</span>
        </button>

        <button
          onClick={() => selectedProduct && onOpenBarcodePrint(selectedProduct)}
          disabled={!selectedProduct}
          className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 text-xs font-medium rounded border border-slate-300 shrink-0 whitespace-nowrap cursor-pointer"
        >
          <BarcodeIcon className="w-3.5 h-3.5 text-slate-500" />
          <span>Barcode Label</span>
        </button>

        <div className="h-4 w-px bg-slate-300 mx-0.5 shrink-0" />

        <button
          onClick={handleBenchmark50k}
          disabled={benchmarkLoading}
          className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded shadow-xs active:shadow-inner shrink-0 whitespace-nowrap cursor-pointer"
          title="Populate 50,000 items in SQLite and run live search benchmarks"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{benchmarkLoading ? 'Generating 50k...' : '⚡ Benchmark 50,000 Items'}</span>
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
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPageNumber(1);
            }}
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
              setPageNumber(1);
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
            onChange={(e) => {
              setSelectedSubcategory(Number(e.target.value));
              setPageNumber(1);
            }}
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

        {/* Brand Dropdown */}
        <div className="flex items-center gap-1 shrink-0">
          <label className="text-slate-500 font-medium">Brand:</label>
          <select
            value={selectedBrand}
            onChange={(e) => {
              setSelectedBrand(Number(e.target.value));
              setPageNumber(1);
            }}
            className="px-2 py-1 bg-white border border-slate-300 rounded focus:border-[#106ebe] focus:outline-none text-xs"
          >
            <option value={0}>All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Low Stock Checkbox */}
        <label className="flex items-center gap-1.5 cursor-pointer text-rose-700 font-medium shrink-0">
          <input
            type="checkbox"
            checked={isLowStockOnly}
            onChange={(e) => {
              setIsLowStockOnly(e.target.checked);
              setPageNumber(1);
            }}
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
          <span className="text-slate-600">
            Page {queryResult.pageNumber} of {Math.max(1, queryResult.totalPages)}
          </span>
        </div>

        {benchmarkMessage && (
          <div className="text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-[11px] font-medium">
            {benchmarkMessage}
          </div>
        )}
      </div>

      {/* 4. Product Data Grid - S.No, SGST, CGST, IGST, View/Edit/Delete Actions, No Overlap */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white border-b border-slate-200">
        <table className="w-full table-fixed text-left border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-20 select-none shadow-xs">
            <tr>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-1 font-semibold border-b border-r border-[#153a5e] text-center w-[3.5%] min-w-[35px] truncate">S.No</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] w-[10%] min-w-[85px] truncate">Barcode</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2.5 font-semibold border-b border-r border-[#153a5e] w-[22%] min-w-[160px] truncate">Product Name (English)</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] w-[13.5%] min-w-[100px] truncate">Tamil Name (தமிழ்)</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] w-[8.5%] min-w-[70px] truncate">Category</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] w-[7.5%] min-w-[65px] truncate">Brand</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] text-right w-[6%] min-w-[55px] truncate">Pur. ₹</th>
              <th className="sticky top-0 z-20 bg-[#163c61] text-white py-2 px-2 font-bold border-b border-r border-[#153a5e] text-right w-[6%] min-w-[55px] truncate">Sale ₹</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] text-right w-[5%] min-w-[50px] truncate">MRP ₹</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-1 font-semibold border-b border-r border-[#153a5e] text-center w-[4%] min-w-[40px] truncate" title="State GST">SGST %</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-1 font-semibold border-b border-r border-[#153a5e] text-center w-[4%] min-w-[40px] truncate" title="Central GST">CGST %</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-1 font-semibold border-b border-r border-[#153a5e] text-center w-[4%] min-w-[40px] truncate" title="Integrated GST">IGST %</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] text-right w-[6.5%] min-w-[65px] truncate">Stock</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-1 font-semibold border-b border-[#153a5e] text-center w-[7%] min-w-[80px] truncate">Actions</th>
            </tr>
          </thead>
          <tbody className="font-normal bg-white">
            {queryResult.items.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-12 text-center text-slate-400">
                  No products matched the current search criteria.
                </td>
              </tr>
            ) : (
              queryResult.items.map((p, index) => {
                const isSelected = selectedRowId === p.id;
                const isLowStock = p.currentStock <= p.reorderLevel;
                const serialNo = (queryResult.pageNumber - 1) * pageSize + index + 1;
                const sgstRate = p.sgstRate ?? p.taxRate / 2;
                const cgstRate = p.cgstRate ?? p.taxRate / 2;
                const igstRate = p.igstRate ?? p.taxRate;

                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedRowId(p.id)}
                    onDoubleClick={() => onOpenEditProduct(p)}
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
                    <td className="py-1.5 px-2 text-slate-600 border-b border-r border-slate-200 truncate" title={p.brandName || ''}>
                      {p.brandName || '—'}
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
                    >
                      {p.currentStock} {p.unit}
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
                          onClick={() => onOpenEditProduct(p)}
                          className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-900 border border-amber-200 hover:border-amber-300 rounded transition-colors cursor-pointer shrink-0 shadow-2xs"
                          title="Edit Product"
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

      {/* 5. Pagination Bar */}
      <div className="bg-white border-t border-slate-200 px-3 py-2 flex items-center justify-between text-xs select-none">
        <div className="text-slate-600">
          Page <strong>{queryResult.pageNumber}</strong> of <strong>{Math.max(1, queryResult.totalPages)}</strong>{' '}
          (Showing {queryResult.items.length} of {queryResult.totalCount.toLocaleString()} items)
        </div>

        <div className="flex items-center gap-2">
          {/* Page size */}
          <div className="flex items-center gap-1 text-slate-500">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPageNumber(1);
              }}
              className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-800 focus:outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </div>

          {/* Navigation Buttons */}
          <button
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="flex items-center gap-0.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded border border-slate-300 font-medium text-slate-700"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>

          <button
            onClick={() => setPageNumber((p) => Math.min(queryResult.totalPages, p + 1))}
            disabled={pageNumber >= queryResult.totalPages}
            className="flex items-center gap-0.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded border border-slate-300 font-medium text-slate-700"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
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
                  <div>
                    <span className="text-slate-500 font-medium block">Brand:</span>
                    <span className="text-slate-800 font-medium">{viewingProduct.brandName || '—'}</span>
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
                  onOpenEditProduct(p);
                }}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Product</span>
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
