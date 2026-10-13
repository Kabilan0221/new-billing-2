import React, { useState, useRef } from 'react';
import {
  HardDriveDownload,
  RotateCcw,
  ShieldCheck,
  Database,
  Check,
  AlertTriangle,
  FileText,
  Upload,
  Info,
  Undo2,
} from 'lucide-react';
import { db } from '../services/dbEngine';

export const BackupRestoreView: React.FC = () => {
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasSafetySnapshot, setHasSafetySnapshot] = useState(db.hasSafetySnapshot());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const auditLogs = db.getAuditLogs();
  const metrics = db.getMetrics();

  const showNotification = (text: string, isError = false) => {
    setStatusMessage({ text, isError });
    setTimeout(() => setStatusMessage(null), 6000);
  };

  // 1. Export Web Simulation Preview Dataset as JSON (Clear and Honest)
  const handleExportPreviewData = () => {
    try {
      const jsonContent = db.exportPreviewJson();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `ShopBilling_WebPreview_Backup_${timestamp}.json`;

      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      showNotification(`Web preview dataset exported successfully: ${filename} (JSON)`);
    } catch (err: any) {
      showNotification(`Export failed: ${err.message}`, true);
    }
  };

  // 2. Import & Validate Preview Backup JSON File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      showNotification('Invalid file type: Web preview restore accepts genuine .json backup exports only.', true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = db.restorePreviewFromJson(text);

        if (result.success) {
          setHasSafetySnapshot(true);
          showNotification(`✓ ${result.message}`);
        } else {
          showNotification(`✗ Restore rejected: ${result.message}`, true);
        }
      } catch (err: any) {
        showNotification(`Failed to read backup file: ${err.message}`, true);
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setIsProcessing(false);
      showNotification('Failed to read the selected file.', true);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  // 3. Rollback to Pre-Restore Safety Snapshot
  const handleRevertSafetySnapshot = () => {
    if (!confirm('Revert all changes to the automatic pre-restore safety snapshot taken before the last restore?')) {
      return;
    }
    const result = db.restoreFromSafetyPreviewSnapshot();
    if (result.success) {
      showNotification(`✓ ${result.message}`);
    } else {
      showNotification(`✗ ${result.message}`, true);
    }
  };

  // 4. Reset Web Simulation to Factory Seeds (Explicitly Labeled)
  const handleResetFactoryDefaults = () => {
    if (confirm('Reset web simulation to initial factory seed catalog? This only affects the browser preview state.')) {
      setIsProcessing(true);
      setTimeout(() => {
        db.resetToDefaults();
        setIsProcessing(false);
        showNotification('Web preview restored to default baseline seed state.');
      }, 300);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto p-6 space-y-6 text-xs text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Database Backup & Disaster Recovery</h2>
          <p className="text-slate-500">
            Disaster recovery architecture, genuine SQLite desktop backups, and web preview snapshot tools.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-blue-800 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 font-medium">
          <Database className="w-4 h-4 text-blue-600" />
          <span>Architecture: C# SQLite + Web Preview</span>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded border flex items-center gap-2 animate-in fade-in ${
            statusMessage.isError
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800'
          }`}
        >
          {statusMessage.isError ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span className="font-medium">{statusMessage.text}</span>
        </div>
      )}

      {/* Production vs Preview Notice Banner */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 text-slate-700 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-slate-900 text-xs">Environment & Engine Distinction:</div>
          <p className="text-[11px] leading-relaxed text-slate-600">
            <strong>Desktop Production App (C# WinForms):</strong> Operates on live <code>shopbilling.db</code> via{' '}
            <code>DatabaseBackupService.cs</code> and <code>BackupRestoreControl.cs</code>. Executes genuine SQLite Online
            Backup API snapshots, pre-validates binary headers and <code>PRAGMA quick_check</code>, and automatically creates safety
            backups before restoring.
            <br />
            <strong>Web Solution Explorer (Browser Preview):</strong> Uses simulated demo state with JSON format exports. JSON
            files are strictly saved as <code>.json</code> and validated against schemas before import.
          </p>
        </div>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Web Preview Backup Export */}
        <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
              <HardDriveDownload className="w-4 h-4 text-[#106ebe]" />
              <span>Export Web Preview Data (.json)</span>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed">
              Exports a verified JSON snapshot containing current preview products ({metrics.total.toLocaleString()} items),
              categories, suppliers, purchases, customers, invoices, and audit logs.
            </p>
            <div className="text-[11px] text-slate-500 font-mono bg-slate-50 p-2 rounded border border-slate-100">
              Format: ShopBilling_WebPreview_Backup (.json)
            </div>
          </div>
          <button
            onClick={handleExportPreviewData}
            className="w-full py-2 bg-[#106ebe] hover:bg-[#005a9e] text-white rounded font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <HardDriveDownload className="w-4 h-4" />
            <span>Download Preview Backup (.json)</span>
          </button>
        </div>

        {/* Card 2: Restore from Validated JSON Backup */}
        <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>Restore Web Preview from File (.json)</span>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed">
              Select a genuine <code>.json</code> preview backup file. The engine validates the header signature and schema
              compatibility, takes an automatic safety snapshot of current data, and restores the records.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{isProcessing ? 'Verifying File...' : 'Select & Restore .json File'}</span>
            </button>
            {hasSafetySnapshot && (
              <button
                onClick={handleRevertSafetySnapshot}
                title="Revert to Pre-Restore Safety Snapshot"
                className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Undo2 className="w-4 h-4" />
                <span>Revert Safety</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Production C# Desktop Instructions Card */}
      <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs space-y-3">
        <div className="flex items-center justify-between font-bold text-slate-800 text-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Desktop SQLite Disaster Recovery (C# WinForms Implementation)</span>
          </div>
          <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-medium border border-emerald-200">
            DatabaseBackupService.cs
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-600">
          <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
            <div className="font-bold text-slate-800">1. Instant Snapshot (.db)</div>
            <p>
              Calls SQLite Online Backup API (<code>sourceConn.BackupDatabase</code>) to snapshot the active database without
              blocking concurrent counter readers or writers.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
            <div className="font-bold text-slate-800">2. Header & Schema Check</div>
            <p>
              Pre-restore checks verify the 16-byte SQLite 3 header signature, execute <code>PRAGMA quick_check</code>, and ensure
              required core business tables exist before taking action.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
            <div className="font-bold text-slate-800">3. Automatic Pre-Restore Safety</div>
            <p>
              Automatically saves a safety copy in <code>SafetyBackups/</code> prior to replacement. If any restore step fails,
              an automatic rollback is executed from the safety backup.
            </p>
          </div>
        </div>
      </div>

      {/* Reset Web Preview Baseline */}
      <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs flex items-center justify-between">
        <div>
          <div className="font-bold text-slate-800 text-xs">Reset Web Simulation State</div>
          <p className="text-slate-500 text-[11px]">
            Restores the browser preview data to the factory default seed catalog. Does not affect production desktop databases.
          </p>
        </div>
        <button
          onClick={handleResetFactoryDefaults}
          disabled={isProcessing}
          className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-semibold flex items-center gap-1.5 transition-colors cursor-pointer text-xs disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
          <span>Reset Preview Baseline</span>
        </button>
      </div>

      {/* Audit Logs Trail */}
      <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs space-y-3">
        <div className="flex items-center justify-between font-bold text-slate-800 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <span>Database Operational Audit Logs (Recent Transactions)</span>
          </div>
          <span className="text-xs text-slate-400 font-normal">Table: audit_logs</span>
        </div>

        <div className="border border-slate-200 rounded overflow-hidden max-h-56 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 font-semibold">
              <tr>
                <th className="p-2 border-b">Timestamp</th>
                <th className="p-2 border-b">Action</th>
                <th className="p-2 border-b">Entity</th>
                <th className="p-2 border-b">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="p-2 text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-2">
                    <span
                      className={`px-1.5 py-0.2 rounded font-semibold text-[10px] ${
                        log.action === 'INSERT'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.action === 'UPDATE'
                          ? 'bg-blue-100 text-blue-800'
                          : log.action === 'RESTORE'
                          ? 'bg-amber-100 text-amber-800'
                          : log.action === 'DEACTIVATE'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="p-2 text-slate-700 font-semibold">{log.entity}</td>
                  <td className="p-2 text-slate-600 font-sans">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
