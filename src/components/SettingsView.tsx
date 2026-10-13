import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Building,
  Printer,
  Boxes,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { db } from '../services/dbEngine';
import { AppSettings } from '../types';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setSettings(db.getAppSettings());
  }, []);

  if (!settings) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    const res = db.saveAppSettings(settings);
    if (res.success && res.settings) {
      setSettings(res.settings);
      setNotification({
        type: 'success',
        text: 'Application settings persisted successfully to SQLite database.',
      });
      setTimeout(() => setNotification(null), 4000);
    } else {
      setNotification({
        type: 'error',
        text: res.errors.join(' '),
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f0f2f5] overflow-y-auto select-none">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-700" />
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Application Preferences & Store Configuration</h1>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage retail business profile, GST registration, default hardware print preferences, and inventory thresholds.
        </p>
      </div>

      <div className="p-6 max-w-5xl space-y-6">
        {/* Toast */}
        {notification && (
          <div
            className={`p-3 rounded text-xs font-semibold flex items-center gap-2 border ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{notification.text}</span>
          </div>
        )}

        {/* Legal Disclaimer Card */}
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded flex items-start gap-2.5 text-xs text-indigo-900">
          <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Strict Historical Integrity Rule: </span>
            Modifying business details, tax rates, or currency formats affects only future transactions and will NEVER
            silently alter finalized historical invoices or vouchers.
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Card 1: Business Profile */}
          <div className="bg-white p-5 rounded border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 font-bold text-sm text-slate-800">
              <Building className="w-4 h-4 text-blue-600" />
              <span>Business Profile & GST Registration</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Store / Business Name *</label>
                <input
                  type="text"
                  required
                  value={settings.storeName}
                  onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Store Physical Address</label>
                <input
                  type="text"
                  value={settings.storeAddress}
                  onChange={(e) => setSettings({ ...settings, storeAddress: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Phone Number</label>
                <input
                  type="text"
                  value={settings.storePhone}
                  onChange={(e) => setSettings({ ...settings, storePhone: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Email Address</label>
                <input
                  type="email"
                  value={settings.storeEmail}
                  onChange={(e) => setSettings({ ...settings, storeEmail: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">GSTIN Identification (15 Digits)</label>
                <input
                  type="text"
                  maxLength={15}
                  value={settings.gstNumber}
                  onChange={(e) => setSettings({ ...settings, gstNumber: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono uppercase focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400">e.g. 33AAAAA0000A1Z5</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Default GST Rate %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.defaultTaxRate}
                  onChange={(e) => setSettings({ ...settings, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Billing & Print Settings */}
          <div className="bg-white p-5 rounded border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 font-bold text-sm text-slate-800">
              <Printer className="w-4 h-4 text-purple-600" />
              <span>Billing & Hardware Print Preferences</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={settings.currencySymbol}
                  onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-bold focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receipt Paper Format</label>
                <select
                  value={settings.receiptPaperSize}
                  onChange={(e) => setSettings({ ...settings, receiptPaperSize: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-slate-50 focus:bg-white"
                >
                  <option value="80mm Thermal">80mm Thermal Receipt (POS Roll)</option>
                  <option value="A4 Full Page">A4 Full Page (Standard Laser/Inkjet)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Default Line Discount %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={settings.defaultDiscountPercent}
                  onChange={(e) => setSettings({ ...settings, defaultDiscountPercent: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tax Presentation Mode</label>
                <select
                  value={settings.taxDisplayPreference}
                  onChange={(e) => setSettings({ ...settings, taxDisplayPreference: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-slate-50 focus:bg-white"
                >
                  <option value="Itemized">Itemized GST Line Breakdown</option>
                  <option value="SlabSummary">Summary Slab Total at Bottom</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 3: Stock & System Preferences */}
          <div className="bg-white p-5 rounded border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 font-bold text-sm text-slate-800">
              <Boxes className="w-4 h-4 text-teal-600" />
              <span>Stock Thresholds & System Preferences</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Default Reorder Level (Units)</label>
                <input
                  type="number"
                  min={0}
                  value={settings.defaultLowStockThreshold}
                  onChange={(e) => setSettings({ ...settings, defaultLowStockThreshold: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Default Generated Barcode Type</label>
                <select
                  value={settings.barcodeFormat}
                  onChange={(e) => setSettings({ ...settings, barcodeFormat: e.target.value as any })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-slate-50 focus:bg-white"
                >
                  <option value="Code128">Code 128 (Alphanumeric SKU)</option>
                  <option value="EAN13">EAN-13 (13 Digits with Modulo-10 Check)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Default Report Filter Range</label>
                <select
                  value={settings.defaultReportDateRange}
                  onChange={(e) => setSettings({ ...settings, defaultReportDateRange: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-slate-50 focus:bg-white"
                >
                  <option value="Today">Today</option>
                  <option value="Last 7 Days">Last 7 Days</option>
                  <option value="This Month">This Month</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Application Startup Screen</label>
                <select
                  value={settings.startupScreen}
                  onChange={(e) => setSettings({ ...settings, startupScreen: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-slate-50 focus:bg-white"
                >
                  <option value="Dashboard">Executive Dashboard</option>
                  <option value="POS">POS Billing (F1)</option>
                  <option value="Products">Product Master (F2)</option>
                </select>
              </div>

              <div className="sm:col-span-2 pt-2">
                <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableConfirmDialogs}
                    onChange={(e) => setSettings({ ...settings, enableConfirmDialogs: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>Prompt confirmation before finalizing invoices, cancelling vouchers, or editing stock</span>
                </label>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded shadow-xs cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save Application Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
