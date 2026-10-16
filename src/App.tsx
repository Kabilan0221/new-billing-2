import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { X } from 'lucide-react';
import { Win7Sidebar, SIDEBAR_ITEMS } from './components/Win7Sidebar';
import { ProductMaster } from './components/ProductMaster';
import { CategoryBrandDialog } from './components/CategoryBrandDialog';
import { ExcelDialog } from './components/ExcelDialog';
import { BarcodeDialog } from './components/BarcodeDialog';
import { SVTLogo } from './components/SVTLogo';
import { SolutionExplorer } from './components/SolutionExplorer';
import { PosBilling } from './components/PosBilling';
import { ModulePlaceholderView } from './components/ModulePlaceholderView';
import { SupplierManagement } from './components/SupplierManagement';
import { InboundGoods } from './components/InboundGoods';
import { StockManagement } from './components/StockManagement';
import { BarcodeStudio } from './components/BarcodeStudio';
import { EstimatesAndInvoices } from './components/EstimatesAndInvoices';
import { DashboardView } from './components/DashboardView';
import { ReportsView } from './components/ReportsView';
import { DataManagementView } from './components/DataManagementView';
import { SettingsView } from './components/SettingsView';
import { CustomerManagement } from './components/CustomerManagement';
import { BackupRestoreView } from './components/BackupRestoreView';
import { db } from './services/dbEngine';
import { Product } from './types';

export default function App() {
  const [activeView, setActiveView] = useState<'desktop' | 'solution'>('desktop');
  const [activeNav, setActiveNav] = useState<string>('products'); // Default to Products
  const [selectedSupplierForInbound, setSelectedSupplierForInbound] = useState<number | undefined>(undefined);
  const [dataVersion, setDataVersion] = useState(0);

  // Dialogs state
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categoryDialogTab, setCategoryDialogTab] = useState<'categories' | 'brands'>('categories');

  const [isExcelDialogOpen, setIsExcelDialogOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);

  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Real-time clock tick
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const refreshData = useCallback(() => {
    setDataVersion((v) => v + 1);
  }, []);

  const metrics = db.getMetrics();

  // Keyboard shortcut handler (F1-F10) matching WinForms shell
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveNav('pos');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveNav('products');
        window.dispatchEvent(new CustomEvent('shopbilling:add-product'));
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveNav('inbound');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setActiveNav('barcode');
      } else if (e.key === 'F5') {
        e.preventDefault();
        setActiveNav('payments');
      } else if (e.key === 'F6') {
        e.preventDefault();
        setActiveNav('history');
      } else if (e.key === 'F7') {
        e.preventDefault();
        setActiveNav('customers');
      } else if (e.key === 'F8') {
        e.preventDefault();
        setActiveNav('stock');
      } else if (e.key === 'F9') {
        if (activeNav === 'pos') {
          // Allow PosBilling component to handle F9 direct 4-inch thermal checkout & print
          return;
        }
        e.preventDefault();
        setActiveNav('invoices');
      } else if (e.key === 'F10') {
        e.preventDefault();
        setActiveNav('reports');
      } else if (e.key === 'Escape') {
        setIsProductDialogOpen(false);
        setIsCategoryDialogOpen(false);
        setIsExcelDialogOpen(false);
        setBarcodeProduct(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeNav, isProductDialogOpen]);

  // Export current catalog to real formatted .xlsx
  const handleExportExcel = () => {
    const all = db.getAllProducts();
    const exportRows = all.map((p) => ({
      'Product Code': p.productCode,
      Barcode: p.barcode,
      'Product Name (English)': p.nameEn,
      'Product Name (Tamil)': p.nameTa || '',
      Category: p.categoryName || '',
      Subcategory: p.subcategoryName || '',
      Brand: p.brandName || '',
      Unit: p.unit,
      'HSN Code': p.hsnCode || '',
      'Purchase Rate': p.purchaseRate,
      'Sale Rate': p.saleRate,
      'Wholesale Rate': p.wholesaleRate,
      MRP: p.mrp,
      'Tax %': p.taxRate,
      'Opening Stock': p.openingStock,
      'Current Stock': p.currentStock,
      'Reorder Level': p.reorderLevel,
      Status: p.isActive ? 'Active' : 'Inactive',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const filename = `ShopBilling_Catalog_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const handleOpenAddProduct = () => {
    setActiveNav('products');
    window.dispatchEvent(new CustomEvent('shopbilling:add-product'));
  };

  const handleOpenEditProduct = (p: Product) => {
    setActiveNav('products');
    window.dispatchEvent(new CustomEvent('shopbilling:edit-product', { detail: p }));
  };

  const handleOpenCategoryManager = () => {
    setCategoryDialogTab('categories');
    setIsCategoryDialogOpen(true);
  };

  const handleOpenBrandManager = () => {
    setCategoryDialogTab('brands');
    setIsCategoryDialogOpen(true);
  };

  return (
    <div className="w-screen h-screen bg-white flex flex-col overflow-hidden font-sans">
      {/* Header Store Banner */}
      <div className="bg-[#182b49] text-white px-4 py-2 flex flex-wrap items-center justify-between border-b border-[#122035] text-xs shrink-0">
        <div className="flex items-center gap-2.5">
          <SVTLogo size={28} className="drop-shadow-xs" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-amber-300 text-xs">ஸ்ரீ வெங்கடேஸ்வரா | SRI VENKATESWARA (SVT)</span>
              <span className="hidden lg:inline text-[10px] text-emerald-300 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-600/40">
                சாமிமில் • டிம்பர்ஸ் • பர்னிச்சர்ஸ் • ஸ்டீல்டோர்ஸ்
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-300">
              <span>மடம் தெரு, அண்ணா விளையாட்டு பூங்கா அருகில், காஞ்சிபுரம் - 631 502</span>
              <span className="hidden md:inline text-slate-400">|</span>
              <span className="hidden md:inline font-mono text-[10px] text-slate-300">📱 8143 84 8143 / 9941333457 / 044 2723 1947</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-300">
          <span className="font-mono text-slate-300 text-[11px] hidden md:inline mr-1">{currentTime}</span>
          <div className="h-4 w-[1px] bg-slate-600/80 mx-1" />
          <div className="flex items-center -mr-2">
            {/* Minimize (-) */}
            <button
              type="button"
              title="Minimize"
              className="w-10 h-7 flex items-center justify-center hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <span className="w-2.5 h-[1.5px] bg-white inline-block"></span>
            </button>

            {/* Maximize / Restore (❐) */}
            <button
              type="button"
              title="Maximize / Restore"
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen?.().catch(() => {});
                } else {
                  document.exitFullscreen?.().catch(() => {});
                }
              }}
              className="w-10 h-7 flex items-center justify-center hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="4.5" y="1.5" width="9.5" height="9.5" rx="1" />
                <path d="M11.5 4.5H2.5C1.94772 4.5 1.5 4.94772 1.5 5.5V14.5C1.5 15.0523 1.94772 15.5 2.5 15.5H11.5C12.0523 15.5 12.5 15.0523 12.5 14.5V11.5" />
              </svg>
            </button>

            {/* Close (✕) */}
            <button
              type="button"
              title="Close"
              onClick={() => {
                setActiveNav('pos');
              }}
              className="w-10 h-7 flex items-center justify-center hover:bg-[#e81123] text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

        {/* Main Application Area */}
        {activeView === 'desktop' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar with all 14 Menu Sections */}
            <Win7Sidebar
              activeNav={activeNav}
              onSelectNav={setActiveNav}
              productCount={metrics.total}
              lowStockCount={metrics.lowStock}
            />

            {/* Active Content Module */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
              {activeNav === 'products' && (
                <ProductMaster
                  onOpenAddProduct={handleOpenAddProduct}
                  onOpenEditProduct={handleOpenEditProduct}
                  onOpenCategoryManager={handleOpenCategoryManager}
                  onOpenBrandManager={handleOpenBrandManager}
                  onOpenExcelImport={() => setIsExcelDialogOpen(true)}
                  onOpenBarcodePrint={(p) => setBarcodeProduct(p)}
                  onExportExcel={handleExportExcel}
                  onRefreshData={refreshData}
                />
              )}

              {activeNav === 'pos' && (
                <PosBilling
                  onRefreshData={refreshData}
                  onNavigateToProducts={() => setActiveNav('products')}
                  onNavigateToStock={() => setActiveNav('stock')}
                  initialActiveSubTab="pos"
                />
              )}

              {activeNav === 'payments' && (
                <PosBilling
                  onRefreshData={refreshData}
                  onNavigateToProducts={() => setActiveNav('products')}
                  onNavigateToStock={() => setActiveNav('stock')}
                  initialActiveSubTab="history"
                />
              )}

              {activeNav === 'history' && (
                <PosBilling
                  onRefreshData={refreshData}
                  onNavigateToProducts={() => setActiveNav('products')}
                  onNavigateToStock={() => setActiveNav('stock')}
                  initialActiveSubTab="history"
                />
              )}

              {activeNav === 'barcode' && (
                <BarcodeStudio
                  onRefreshData={refreshData}
                  onNavigateToProducts={() => setActiveNav('products')}
                />
              )}

              {activeNav === 'invoices' && (
                <EstimatesAndInvoices
                  onRefreshData={refreshData}
                  onNavigateToPOS={() => setActiveNav('pos')}
                  onNavigateToHistory={() => setActiveNav('history')}
                />
              )}

              {activeNav === 'inbound' && (
                <InboundGoods
                  initialSupplierId={selectedSupplierForInbound}
                  onRefreshData={refreshData}
                  onNavigateToSuppliers={() => setActiveNav('suppliers')}
                />
              )}

              {activeNav === 'customers' && (
                <CustomerManagement
                  onRefreshData={refreshData}
                  onNavigateToPOS={(_customerId) => {
                    setActiveNav('pos');
                  }}
                />
              )}

              {activeNav === 'suppliers' && (
                <SupplierManagement
                  onRefreshData={refreshData}
                  onNavigateToInbound={(supId) => {
                    setSelectedSupplierForInbound(supId);
                    setActiveNav('inbound');
                  }}
                />
              )}

              {activeNav === 'stock' && (
                <StockManagement
                  onRefreshData={refreshData}
                  onNavigateToInbound={() => setActiveNav('inbound')}
                />
              )}

              {activeNav === 'dashboard' && (
                <DashboardView
                  onNavigate={(sec) => setActiveNav(sec)}
                  onRefreshData={refreshData}
                />
              )}

              {activeNav === 'reports' && (
                <ReportsView onRefreshData={refreshData} />
              )}

              {activeNav === 'data' && <DataManagementView onRefreshData={refreshData} />}

              {activeNav === 'settings' && <SettingsView />}

              {activeNav === 'backup' && <BackupRestoreView />}

              {activeNav !== 'products' &&
                activeNav !== 'inbound' &&
                activeNav !== 'customers' &&
                activeNav !== 'suppliers' &&
                activeNav !== 'stock' &&
                activeNav !== 'pos' &&
                activeNav !== 'payments' &&
                activeNav !== 'history' &&
                activeNav !== 'barcode' &&
                activeNav !== 'invoices' &&
                activeNav !== 'dashboard' &&
                activeNav !== 'reports' &&
                activeNav !== 'data' &&
                activeNav !== 'settings' &&
                activeNav !== 'backup' && (
                  <ModulePlaceholderView
                    title={SIDEBAR_ITEMS.find((s) => s.key === activeNav)?.label || 'Module'}
                    moduleKey={activeNav}
                    onGoToProducts={() => setActiveNav('products')}
                  />
                )}
            </main>
          </div>
        ) : (
          /* Visual Studio Solution & C# Source Explorer View */
          <SolutionExplorer onBackToApp={() => setActiveView('desktop')} />
        )}

      {/* Modals & Dialogs */}
      <CategoryBrandDialog
        initialTab={categoryDialogTab}
        isOpen={isCategoryDialogOpen}
        onClose={() => setIsCategoryDialogOpen(false)}
        onUpdated={refreshData}
      />

      <ExcelDialog
        isOpen={isExcelDialogOpen}
        onClose={() => setIsExcelDialogOpen(false)}
        onImportComplete={refreshData}
      />

      <BarcodeDialog
        product={barcodeProduct}
        isOpen={!!barcodeProduct}
        onClose={() => setBarcodeProduct(null)}
      />
    </div>
  );
}
