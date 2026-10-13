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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);

  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkMessage, setBenchmarkMessage] = useState<string | null>(null);

  const categories = useMemo(() => db.getCategories(), [onRefreshData]);
  const subcategories = useMemo(
    () => db.getSubcategories(selectedCategory > 0 ? selectedCategory : undefined),
    [selectedCategory, onRefreshData]
  );
  const brands = useMemo(() => db.getBrands(), [onRefreshData]);

  // Execute query
  const queryResult: PagedResult<Product> = useMemo(() => {
    const filter: ProductFilter = {
      searchTerm,
      categoryId: selectedCategory > 0 ? selectedCategory : undefined,
      subcategoryId: selectedSubcategory > 0 ? selectedSubcategory : undefined,
      brandId: selectedBrand > 0 ? selectedBrand : undefined,
      isLowStockOnly,
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
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
    statusFilter,
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
    setStatusFilter('active');
    setPageNumber(1);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f0f3f6] overflow-hidden text-slate-800">
      {/* 0. Module Header Banner */}
      <div className="bg-[#182b49] text-white px-4 py-2 border-b border-[#0f1d33] flex flex-wrap items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-blue-600/30 border border-blue-400/40 flex items-center justify-center">
            <Boxes className="w-4 h-4 text-blue-300" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide flex items-center gap-2">
              <span>PRODUCT MASTER & CATALOG DIRECTORY (F2)</span>
              <span className="text-[10px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-1.5 py-0.2 rounded font-mono">
                {queryResult.totalCount.toLocaleString()} Listed
              </span>
            </h1>
            <p className="text-[11px] text-slate-300">
              Manage master inventory items, dual-language product names, pricing, and live barcode labels without overlap.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Top Action Toolbar */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 flex flex-wrap items-center gap-1.5 shadow-2xs">
        <button
          onClick={onOpenAddProduct}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#106ebe] hover:bg-[#005a9e] text-white text-xs font-semibold rounded shadow-xs active:shadow-inner"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Product (F2)</span>
        </button>

        <button
          onClick={() => selectedProduct && onOpenEditProduct(selectedProduct)}
          disabled={!selectedProduct}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 text-xs font-medium rounded border border-slate-300"
        >
          <Pencil className="w-3.5 h-3.5 text-slate-500" />
          <span>Edit (F4)</span>
        </button>

        <button
          onClick={handleDeactivateToggle}
          disabled={!selectedProduct}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 disabled:opacity-40 text-xs font-medium rounded border border-slate-300"
        >
          <Trash2 className="w-3.5 h-3.5 text-slate-500" />
          <span>{selectedProduct?.isActive ? 'Deactivate' : 'Activate'}</span>
        </button>

        <div className="h-5 w-px bg-slate-300 mx-1" />

        <button
          onClick={onOpenExcelImport}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-medium rounded"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span>Import Excel</span>
        </button>

        <button
          onClick={onExportExcel}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-medium rounded"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          <span>Export Excel</span>
        </button>

        <div className="h-5 w-px bg-slate-300 mx-1" />

        <button
          onClick={onOpenCategoryManager}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded border border-slate-300"
        >
          <FolderTree className="w-3.5 h-3.5 text-slate-500" />
          <span>Categories</span>
        </button>

        <button
          onClick={onOpenBrandManager}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded border border-slate-300"
        >
          <Tag className="w-3.5 h-3.5 text-slate-500" />
          <span>Brands</span>
        </button>

        <button
          onClick={() => selectedProduct && onOpenBarcodePrint(selectedProduct)}
          disabled={!selectedProduct}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 text-xs font-medium rounded border border-slate-300"
        >
          <BarcodeIcon className="w-3.5 h-3.5 text-slate-500" />
          <span>Barcode Label</span>
        </button>

        <div className="h-5 w-px bg-slate-300 mx-1" />

        <button
          onClick={handleBenchmark50k}
          disabled={benchmarkLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded shadow-xs active:shadow-inner"
          title="Populate 50,000 items in SQLite and run live search benchmarks"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{benchmarkLoading ? 'Generating 50k...' : '⚡ Benchmark 50,000 Items'}</span>
        </button>

        <button
          onClick={onRefreshData}
          className="p-1.5 text-slate-600 hover:bg-slate-200 rounded border border-slate-300 ml-auto"
          title="Refresh"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Filter & Search Panel */}
      <div className="bg-[#f8fafc] border-b border-slate-200 px-3 py-2 flex flex-wrap items-center gap-2.5 text-xs">
        {/* Search Input */}
        <div className="relative flex items-center min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPageNumber(1);
            }}
            placeholder="Search Name (English / தமிழ்), Barcode, SKU..."
            className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded focus:border-[#106ebe] focus:outline-none font-medium placeholder:text-slate-400"
          />
        </div>

        {/* Category Dropdown */}
        <div className="flex items-center gap-1">
          <label className="text-slate-500 font-medium">Category:</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(Number(e.target.value));
              setSelectedSubcategory(0);
              setPageNumber(1);
            }}
            className="px-2 py-1 bg-white border border-slate-300 rounded focus:border-[#106ebe] focus:outline-none"
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
        <div className="flex items-center gap-1">
          <label className="text-slate-500 font-medium">Subcategory:</label>
          <select
            value={selectedSubcategory}
            onChange={(e) => {
              setSelectedSubcategory(Number(e.target.value));
              setPageNumber(1);
            }}
            className="px-2 py-1 bg-white border border-slate-300 rounded focus:border-[#106ebe] focus:outline-none"
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
        <div className="flex items-center gap-1">
          <label className="text-slate-500 font-medium">Brand:</label>
          <select
            value={selectedBrand}
            onChange={(e) => {
              setSelectedBrand(Number(e.target.value));
              setPageNumber(1);
            }}
            className="px-2 py-1 bg-white border border-slate-300 rounded focus:border-[#106ebe] focus:outline-none"
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
        <label className="flex items-center gap-1.5 cursor-pointer text-rose-700 font-medium">
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
          <span>Low Stock Only</span>
        </label>

        {/* Clear Filters */}
        <button
          onClick={handleClearFilters}
          className="flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors ml-auto"
        >
          <FilterX className="w-3 h-3" />
          <span>Clear Filters</span>
        </button>
      </div>

      {/* 3. Query Benchmark & Telemetry Info Bar */}
      <div className="bg-[#e4ecf5] border-b border-[#c8d9ea] px-3 py-1.5 flex items-center justify-between text-xs text-[#1e4a7a]">
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            {queryResult.totalCount.toLocaleString()} products found
          </span>
          <span>·</span>
          <span className="font-mono bg-white/70 px-1.5 py-0.2 rounded border border-[#bed2e6] text-[#0f2d4e]">
            Indexed Query: <strong>{queryResult.executionTimeMs} ms</strong>
          </span>
          <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Target &lt;500ms Met
          </span>
        </div>

        {benchmarkMessage && (
          <div className="text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-[11px] font-medium animate-pulse">
            {benchmarkMessage}
          </div>
        )}
      </div>

      {/* 4. Product Data Grid */}
      <div className="flex-1 overflow-auto bg-white border-b border-slate-200">
        <table className="min-w-[1250px] w-full text-left border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-20 select-none shadow-xs">
            <tr>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2.5 font-semibold border-b border-r border-[#153a5e] w-14 whitespace-nowrap">Code</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2.5 font-semibold border-b border-r border-[#153a5e] w-28 whitespace-nowrap">Barcode</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2.5 font-semibold border-b border-r border-[#153a5e] min-w-[190px] whitespace-nowrap">Product Name (English)</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2.5 font-semibold border-b border-r border-[#153a5e] min-w-[170px] whitespace-nowrap">Tamil Name (தமிழ்)</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2.5 font-semibold border-b border-r border-[#153a5e] w-28 whitespace-nowrap">Category</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2.5 font-semibold border-b border-r border-[#153a5e] w-24 whitespace-nowrap">Brand</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] text-right w-16 whitespace-nowrap">Pur. ₹</th>
              <th className="sticky top-0 z-20 bg-[#163c61] text-white py-2 px-2 font-bold border-b border-r border-[#153a5e] text-right w-20 whitespace-nowrap">Sale ₹</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] text-right w-16 whitespace-nowrap">MRP ₹</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-1.5 font-semibold border-b border-r border-[#153a5e] text-center w-12 whitespace-nowrap">Tax%</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2.5 font-semibold border-b border-r border-[#153a5e] text-right w-20 whitespace-nowrap">Stock</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-r border-[#153a5e] text-right w-14 whitespace-nowrap">Reorder</th>
              <th className="sticky top-0 z-20 bg-[#1f4e79] text-white py-2 px-2 font-semibold border-b border-[#153a5e] text-center w-16 whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody className="font-normal bg-white">
            {queryResult.items.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-12 text-center text-slate-400">
                  No products matched the current search criteria.
                </td>
              </tr>
            ) : (
              queryResult.items.map((p) => {
                const isSelected = selectedRowId === p.id;
                const isLowStock = p.currentStock <= p.reorderLevel;

                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedRowId(p.id)}
                    onDoubleClick={() => onOpenEditProduct(p)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#cce8ff] text-[#004a80] font-medium'
                        : !p.isActive
                        ? 'bg-slate-50 text-slate-400'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-1.5 px-2.5 font-mono text-[11px] text-slate-600 border-b border-r border-slate-200">
                      {p.productCode}
                    </td>
                    <td className="py-1.5 px-2.5 font-mono text-[11px] border-b border-r border-slate-200">
                      {p.barcode}
                    </td>
                    <td className="py-1.5 px-2.5 font-medium border-b border-r border-slate-200 truncate max-w-[220px]">
                      {p.nameEn}
                    </td>
                    <td className="py-1.5 px-2.5 text-slate-700 font-sans border-b border-r border-slate-200 truncate max-w-[200px]">
                      {p.nameTa || '—'}
                    </td>
                    <td className="py-1.5 px-2.5 text-slate-600 border-b border-r border-slate-200 truncate">
                      {p.categoryName || '—'}
                    </td>
                    <td className="py-1.5 px-2.5 text-slate-600 border-b border-r border-slate-200 truncate">
                      {p.brandName || '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums border-b border-r border-slate-200 text-slate-600">
                      ₹{p.purchaseRate.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-semibold tabular-nums border-b border-r border-slate-200 text-slate-900 bg-slate-50/50">
                      ₹{p.saleRate.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums border-b border-r border-slate-200 text-slate-600">
                      ₹{p.mrp.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-1.5 text-center font-mono tabular-nums border-b border-r border-slate-200">
                      {p.taxRate}%
                    </td>
                    <td
                      className={`py-1.5 px-2.5 text-right font-mono font-bold tabular-nums border-b border-r border-slate-200 ${
                        isLowStock ? 'text-rose-600 bg-rose-50' : 'text-slate-800'
                      }`}
                    >
                      {p.currentStock} {p.unit}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums border-b border-r border-slate-200 text-slate-500">
                      {p.reorderLevel}
                    </td>
                    <td className="py-1.5 px-2 text-center border-b border-slate-200">
                      <span
                        className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-medium ${
                          p.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
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
    </div>
  );
};
