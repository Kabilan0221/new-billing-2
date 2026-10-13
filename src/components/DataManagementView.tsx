import React, { useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  Calendar,
  CheckSquare,
  Square,
  Calculator,
  ShieldAlert,
  HardDriveDownload,
  CheckCircle2,
  AlertCircle,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { db } from '../services/dbEngine';

interface DataManagementViewProps {
  onRefreshData?: () => void;
}

export const DataManagementView: React.FC<DataManagementViewProps> = ({ onRefreshData }) => {
  // Today's date in YYYY-MM-DD format
  const getTodayStr = () => new Date().toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState<string>(getTodayStr());
  const [endDate, setEndDate] = useState<string>(getTodayStr());
  const [includeEstimates, setIncludeEstimates] = useState<boolean>(true);

  const [previewResult, setPreviewResult] = useState<{
    billsCount: number;
    billsTotalAmount: number;
    taxAmount: number;
    paymentsCount: number;
    estimatesCount: number;
    estimatesTotalAmount: number;
    matchingInvoiceNumbers: string[];
    matchingEstimateNumbers: string[];
  } | null>(null);

  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    isError?: boolean;
  } | null>(null);

  // Quick range helper
  const handleQuickRange = (range: 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'all') => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (range === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (range === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (range === '7days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (range === '30days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (range === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (range === 'all') {
      setStartDate('2020-01-01');
      setEndDate(todayStr);
    }

    setPreviewResult(null);
  };

  // Preview delete impact
  const handlePreviewImpact = () => {
    if (!startDate || !endDate) {
      setStatusMessage({ text: 'Please select both valid Start Date and End Date.', isError: true });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setStatusMessage({ text: 'Start Date cannot be greater than End Date.', isError: true });
      return;
    }

    setStatusMessage(null);
    const impact = db.previewDeleteImpact(startDate, endDate, includeEstimates);
    setPreviewResult(impact);
  };

  // Download safety backup before deleting
  const handleDownloadSafetyBackup = () => {
    try {
      const jsonContent = db.exportPreviewJson();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `ShopBilling_SafetyBackup_PrePurge_${timestamp}.json`;

      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMessage({ text: `Safety backup downloaded: ${filename}`, isError: false });
    } catch (err: any) {
      setStatusMessage({ text: `Backup failed: ${err.message}`, isError: true });
    }
  };

  // Execute deletion
  const handleExecuteDelete = () => {
    setShowConfirmModal(false);
    setIsDeleting(true);

    setTimeout(() => {
      try {
        const result = db.purgeDataByDateRange(startDate, endDate, { includeEstimates });
        setPreviewResult(null);
        setStatusMessage({
          text: `✓ ${result.message} (${result.deletedBills} bills, ${result.deletedEstimates} estimates, ₹${result.deletedGrossAmount.toFixed(2)} purged).`,
          isError: false,
        });

        if (onRefreshData) {
          onRefreshData();
        }
      } catch (err: any) {
        setStatusMessage({ text: `Deletion failed: ${err.message}`, isError: true });
      } finally {
        setIsDeleting(false);
      }
    }, 300);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto select-none p-6 md:p-8">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header matching Image 2 */}
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0 shadow-2xs">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Purge Old Data</span>
              <span className="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-medium border border-rose-200">
                Delete Management
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Delete bills, payments, estimates, and invoices by selecting a custom Start Date and End Date range.
            </p>
          </div>
        </div>

        {/* Warning Box matching Image 2 */}
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl p-4 flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-xs font-bold text-amber-900">Backup Requirement Reminder</div>
            <p className="text-xs text-amber-800 leading-relaxed">
              Permanent deletion cannot be undone once executed on SQLite. Always download a fresh backup via the "Backup
              & Restore" module before deleting data.
            </p>
          </div>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 text-xs shadow-2xs animate-in fade-in ${
              statusMessage.isError
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {statusMessage.isError ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Card matching Image 2 */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          {/* Section Header */}
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Select Date Range to Delete (தொடக்க & முடிவு தேதி)</span>
          </div>

          {/* Quick Range Selector */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium mr-1">Quick Range:</span>
            {[
              { label: 'Today', key: 'today' },
              { label: 'Yesterday', key: 'yesterday' },
              { label: 'Last 7 Days', key: '7days' },
              { label: 'Last 30 Days', key: '30days' },
              { label: 'This Month', key: 'month' },
              { label: 'All Time', key: 'all' },
            ].map((btn) => (
              <button
                key={btn.key}
                type="button"
                onClick={() => handleQuickRange(btn.key as any)}
                className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-blue-700 rounded-md font-medium text-xs shadow-2xs transition-all cursor-pointer"
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Date Range Inputs Box matching Image 2 */}
          <div className="bg-[#f8fafc] border border-slate-200/90 rounded-xl p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Start Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Start Date (தொடக்க தேதி)
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPreviewResult(null);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer"
                  />
                </div>
              </div>

              {/* End Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  End Date (முடிவு தேதி)
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPreviewResult(null);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Checkbox matching Image 2 */}
          <div className="flex items-start gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                setIncludeEstimates(!includeEstimates);
                setPreviewResult(null);
              }}
              className="mt-0.5 text-rose-600 cursor-pointer focus:outline-none"
            >
              {includeEstimates ? (
                <CheckSquare className="w-4 h-4 fill-rose-600 text-white" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
            </button>
            <div className="space-y-0.5">
              <label
                onClick={() => {
                  setIncludeEstimates(!includeEstimates);
                  setPreviewResult(null);
                }}
                className="text-xs font-bold text-slate-800 cursor-pointer"
              >
                Also delete Estimates and Invoices in this date range (மதிப்பீடு & விலைப்பட்டியல்களையும் நீக்கு)
              </label>
              <p className="text-[11px] text-slate-500">
                Products inventory catalog and category classifications will remain completely untouched.
              </p>
            </div>
          </div>

          {/* Preview Action Button matching Image 2 */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handlePreviewImpact}
              className="py-2.5 px-5 bg-[#106ebe] hover:bg-[#005a9e] text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              <span>Preview Delete Impact (விளைவைச் சரிபார்க்க)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSafetyBackup}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
            >
              <HardDriveDownload className="w-3.5 h-3.5 text-slate-600" />
              <span>Safety Backup First (.json)</span>
            </button>
          </div>
        </div>

        {/* Delete Impact Preview Card */}
        {previewResult && (
          <div className="bg-white border-2 border-rose-200 rounded-xl p-6 shadow-sm space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Delete Impact Analysis ({startDate} to {endDate})
                </h3>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                Action Required
              </span>
            </div>

            {/* Impact Metric Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">Retail Bills to Delete</div>
                <div className="text-lg font-black text-rose-600 mt-1">
                  {previewResult.billsCount} <span className="text-xs font-normal text-slate-500">bills</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  ₹{previewResult.billsTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">Payments Removed</div>
                <div className="text-lg font-black text-amber-600 mt-1">
                  {previewResult.paymentsCount} <span className="text-xs font-normal text-slate-500">records</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Tender receipts</div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">Estimates to Delete</div>
                <div className="text-lg font-black text-purple-600 mt-1">
                  {previewResult.estimatesCount} <span className="text-xs font-normal text-slate-500">quotes</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  ₹{previewResult.estimatesTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">Catalog Impact</div>
                <div className="text-lg font-black text-emerald-600 mt-1">0 items</div>
                <div className="text-[10px] text-emerald-700 mt-0.5">100% Protected</div>
              </div>
            </div>

            {/* Matching bill numbers preview */}
            {previewResult.matchingInvoiceNumbers.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Affected Retail Bill Numbers ({previewResult.matchingInvoiceNumbers.length}):</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 max-h-24 overflow-y-auto flex flex-wrap gap-1.5">
                  {previewResult.matchingInvoiceNumbers.map((num) => (
                    <span
                      key={num}
                      className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-white border border-slate-300 rounded text-slate-700"
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {previewResult.billsCount === 0 && previewResult.estimatesCount === 0 ? (
              <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-200 text-center">
                No invoices or estimates exist in the selected date range ({startDate} to {endDate}). No data will be
                affected.
              </div>
            ) : (
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
                <p className="text-xs text-rose-700 font-medium">
                  ⚠️ Deletion will permanently erase {previewResult.billsCount} bills from database storage.
                </p>

                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isDeleting}
                  className="py-2.5 px-6 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {isDeleting ? 'Purging Records...' : 'Confirm & Permanently Delete Records (நிரந்தரமாக நீக்கு)'}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl border border-rose-300 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Are you absolutely sure?</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    This will permanently delete{' '}
                    <strong className="text-slate-800">{previewResult?.billsCount} bills</strong> and{' '}
                    <strong className="text-slate-800">{previewResult?.estimatesCount} estimates</strong> created between{' '}
                    <span className="font-mono text-slate-800">{startDate}</span> and{' '}
                    <span className="font-mono text-slate-800">{endDate}</span>.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                <strong>Warning:</strong> This operation updates SQLite WAL storage and LocalStorage immediately. It
                cannot be undone.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDelete}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Yes, Purge Now</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
