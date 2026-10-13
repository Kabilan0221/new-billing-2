import React, { useState, useEffect } from 'react';
import {
  Database,
  ShieldCheck,
  Zap,
  HardDrive,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Table,
  RefreshCw,
  Info,
} from 'lucide-react';
import { db } from '../services/dbEngine';
import { DataManagementInfo, DataIntegrityResult } from '../types';

export const DataManagementView: React.FC = () => {
  const [dbInfo, setDbInfo] = useState<DataManagementInfo | null>(null);
  const [integrityResult, setIntegrityResult] = useState<DataIntegrityResult | null>(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(
    null
  );

  const loadInfo = () => {
    const data = db.getDataManagementInfo();
    setDbInfo(data);
  };

  useEffect(() => {
    loadInfo();
  }, []);

  const handleRunIntegrityCheck = () => {
    setIsRunningAudit(true);
    setStatusMessage(null);
    try {
      const res = db.runIntegrityCheck();
      setIntegrityResult(res);
      if (res.isDatabaseHealthy && res.issuesFound.length === 0) {
        setStatusMessage({
          type: 'success',
          text: 'SQLite database is 100% healthy. All foreign key constraints, indexes, and B-Tree tables verified.',
        });
      } else {
        setStatusMessage({
          type: 'info',
          text: `Integrity check completed with ${res.issuesFound.length} diagnostic items to inspect.`,
        });
      }
    } finally {
      setIsRunningAudit(false);
    }
  };

  const handleOptimizeDatabase = () => {
    if (
      !window.confirm(
        'Execute SQLite VACUUM and rebuild internal query indexes?\n\nThis is a non-destructive operation that defragments database pages and recalculates catalog indexes.'
      )
    ) {
      return;
    }

    setIsOptimizing(true);
    try {
      const res = db.optimizeDatabase();
      loadInfo();
      setStatusMessage({ type: 'success', text: res.message });
    } finally {
      setIsOptimizing(false);
    }
  };

  if (!dbInfo) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        <span>Loading SQLite database information...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f0f2f5] overflow-y-auto select-none">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-700" />
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Data Management & Database Diagnostics</h1>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Read-only SQLite integrity verification, table record counts, index maintenance, and vacuum optimization.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`p-3 rounded text-xs font-semibold flex items-center gap-2 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-300'
                : 'bg-blue-50 text-blue-800 border-blue-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <Info className="w-4 h-4 text-blue-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Database Overview Card */}
        <div className="bg-white p-5 rounded border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-slate-500" />
              <span>SQLite Storage & Concurrency Engine Status</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              PRAGMA foreign_keys = ON
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-50 p-3 rounded border border-slate-200">
              <div className="text-slate-500 font-medium">Database File Location</div>
              <div className="font-mono font-bold text-slate-900 mt-1 truncate">{dbInfo.databasePath}</div>
            </div>

            <div className="bg-slate-50 p-3 rounded border border-slate-200">
              <div className="text-slate-500 font-medium">Database File Size</div>
              <div className="font-bold text-slate-900 mt-1">
                {dbInfo.databaseFileSize} ({dbInfo.fileSizeBytes.toLocaleString()} bytes)
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded border border-slate-200">
              <div className="text-slate-500 font-medium">Journal Concurrency Mode</div>
              <div className="font-bold text-emerald-700 mt-1">{dbInfo.walMode}</div>
            </div>

            <div className="bg-slate-50 p-3 rounded border border-slate-200">
              <div className="text-slate-500 font-medium">Transaction Safety</div>
              <div className="font-bold text-blue-800 mt-1">ACID Compliant (Single File DB)</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRunIntegrityCheck}
            disabled={isRunningAudit}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded shadow-xs cursor-pointer transition-colors"
          >
            <ShieldCheck className={`w-4 h-4 ${isRunningAudit ? 'animate-spin' : ''}`} />
            <span>{isRunningAudit ? 'Running Integrity Audit...' : 'Run SQLite Integrity Audit'}</span>
          </button>

          <button
            onClick={handleOptimizeDatabase}
            disabled={isOptimizing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded shadow-xs cursor-pointer transition-colors"
          >
            <Zap className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
            <span>{isOptimizing ? 'Optimizing...' : 'Execute VACUUM & Rebuild Indexes'}</span>
          </button>
        </div>

        {/* Dual Grid: Table Counts & Integrity Results */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Table Record Counts */}
          <div className="bg-white rounded border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 font-bold text-xs text-slate-700">
              <Table className="w-4 h-4 text-slate-500" />
              <span>Database Table Record Counts</span>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2 px-4">Relational Table</th>
                    <th className="py-2 px-4 text-right">Active Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(dbInfo.recordCounts).map(([tbl, count]) => (
                    <tr key={tbl} className="hover:bg-slate-50/80">
                      <td className="py-2 px-4 font-mono font-medium text-slate-800">{tbl}</td>
                      <td className="py-2 px-4 text-right font-bold text-blue-900">{count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Integrity Results */}
          <div className="bg-white rounded border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-700">
                <FileCheck className="w-4 h-4 text-slate-500" />
                <span>Integrity & Health Audit Results</span>
              </div>
              {integrityResult && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    integrityResult.isDatabaseHealthy
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {integrityResult.isDatabaseHealthy ? '100% HEALTHY' : 'DIAGNOSTICS FOUND'}
                </span>
              )}
            </div>

            <div className="p-4 flex-1 overflow-auto max-h-80">
              {!integrityResult ? (
                <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <ShieldCheck className="w-8 h-8 mb-2 text-slate-300" />
                  <span>Click "Run SQLite Integrity Audit" to check B-Tree tables and relational foreign keys.</span>
                </div>
              ) : integrityResult.issuesFound.length === 0 ? (
                <div className="p-4 bg-emerald-50 rounded border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">PRAGMA integrity_check: ok</div>
                    <div className="text-emerald-700 mt-1">
                      Zero orphaned line items, zero duplicate document numbers, all foreign key constraints strictly
                      enforced.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {integrityResult.issuesFound.map((issue, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-amber-50 rounded border border-amber-200 text-xs flex items-start gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-slate-900">
                          [{issue.category}] {issue.entityId}
                        </div>
                        <div className="text-slate-600 text-[11px] mt-0.5">{issue.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
