import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit,
  UserCheck,
  FileSpreadsheet,
  Receipt,
  FileText,
  Phone,
  CheckCircle2,
  XCircle,
  X,
  Save,
} from 'lucide-react';
import { db } from '../services/dbEngine';
import { Customer } from '../types';
import * as XLSX from 'xlsx';

interface CustomerManagementProps {
  onRefreshData?: () => void;
  onNavigateToPOS?: (customerId: number) => void;
}

export const CustomerManagement: React.FC<CustomerManagementProps> = ({
  onRefreshData,
  onNavigateToPOS,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('Active');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'invoices' | 'ledger'>('profile');

  // Customer Edit/Add Modal state (Only Name and Phone Number)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    mobile: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const customers = db.getCustomers();
  const allInvoices = db.getAllInvoices();

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (statusFilter === 'Active' && !c.isActive) return false;
      if (statusFilter === 'Inactive' && c.isActive) return false;
      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        (c.mobile && c.mobile.includes(term)) ||
        (c.code && c.code.toLowerCase().includes(term))
      );
    });
  }, [customers, searchTerm, statusFilter]);

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) {
      return filteredCustomers[0] || null;
    }
    return customers.find((c) => c.id === selectedCustomerId) || filteredCustomers[0] || null;
  }, [selectedCustomerId, customers, filteredCustomers]);

  const customerInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    return allInvoices.filter(
      (inv) => inv.customerId === selectedCustomer.id || inv.customerName === selectedCustomer.name
    );
  }, [selectedCustomer, allInvoices]);

  const customerLedger = useMemo(() => {
    if (!selectedCustomer) return [];
    return db.getCustomerLedger(selectedCustomer.id);
  }, [selectedCustomer]);

  const totalOutstanding = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.currentBalance > 0 ? c.currentBalance : 0), 0);
  }, [customers]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleOpenAdd = () => {
    setModalMode('add');
    setFormData({
      name: '',
      mobile: '',
      isActive: true,
    });
    setFormErrors([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setModalMode('edit');
    setFormData({
      id: c.id,
      name: c.name,
      mobile: c.mobile || '',
      isActive: c.isActive,
    });
    setFormErrors([]);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors([]);

    const res = db.saveCustomer(formData);
    if (!res.success) {
      setFormErrors(res.errors);
      return;
    }

    setIsModalOpen(false);
    if (res.customer) {
      setSelectedCustomerId(res.customer.id);
    }
    showToast(modalMode === 'add' ? 'Customer created successfully.' : 'Customer updated successfully.');
    onRefreshData?.();
  };

  const handleToggleActive = (c: Customer) => {
    const res = db.saveCustomer({ id: c.id, isActive: !c.isActive });
    if (res.success) {
      showToast(c.isActive ? `Customer ${c.name} deactivated.` : `Customer ${c.name} activated.`);
      onRefreshData?.();
    }
  };

  const handleExportExcel = () => {
    const rows = filteredCustomers.map((c) => ({
      Code: c.code,
      Name: c.name,
      'Phone Number': c.mobile || '',
      'Current Balance (₹)': c.currentBalance,
      Status: c.isActive ? 'Active' : 'Inactive',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, `ShopBilling_Customers_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] text-xs text-slate-800 overflow-hidden">
      {/* Top Header */}
      <div className="bg-[#1f4e79] text-white px-5 py-3 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center font-bold">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide uppercase">
              Customer Management & Accounts (F7)
            </h1>
            <p className="text-[11px] text-sky-100">
              Customer records (name and phone number), credit balance, transaction history, and statement ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-white font-medium shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#106ebe] hover:bg-[#115ea3] rounded text-white font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Customer</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {successToast && (
        <div className="bg-emerald-600 text-white text-xs px-4 py-2 flex items-center justify-between shrink-0 shadow-sm transition-all animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-200 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Customer Directory */}
        <div className="w-96 border-r border-slate-200 bg-white flex flex-col shrink-0">
          {/* Search & Filters */}
          <div className="p-3 border-b border-slate-100 bg-slate-50 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by customer name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#106ebe] focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1">
                {(['Active', 'All', 'Inactive'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2 py-0.5 rounded font-medium ${
                      statusFilter === filter
                        ? 'bg-[#106ebe] text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <span className="text-slate-500 font-mono">
                {filteredCustomers.length} of {customers.length}
              </span>
            </div>
          </div>

          {/* Customer List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredCustomers.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No customers match filter</p>
              </div>
            ) : (
              filteredCustomers.map((cust) => {
                const isSelected = selectedCustomer?.id === cust.id;
                return (
                  <div
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className={`p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-sky-50 border-l-4 border-l-[#106ebe]'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="truncate">
                        <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                          <span>{cust.name}</span>
                          {!cust.isActive && (
                            <span className="text-[10px] px-1 py-0.2 bg-rose-100 text-rose-700 rounded font-normal">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{cust.code}</span>
                          {cust.mobile && (
                            <span className="flex items-center gap-1 text-slate-600 font-mono">
                              <Phone className="w-2.5 h-2.5 text-[#106ebe]" />
                              {cust.mobile}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-2">
                        <div
                          className={`font-semibold font-mono text-[11px] ${
                            cust.currentBalance > 0
                              ? 'text-rose-600'
                              : cust.currentBalance < 0
                              ? 'text-emerald-600'
                              : 'text-slate-500'
                          }`}
                        >
                          ₹{cust.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {cust.currentBalance > 0 ? 'Debit Due' : cust.currentBalance < 0 ? 'Credit Adv' : 'Clear'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Outstanding Summary Footer */}
          <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-[11px]">
            <span className="text-slate-600 font-medium">Total Outstanding Balance:</span>
            <span className="font-bold font-mono text-rose-700">
              ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Right Panel: Selected Customer Details */}
        {selectedCustomer ? (
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {/* Customer Banner Header */}
            <div className="p-4 border-b border-slate-200 bg-linear-to-r from-slate-50 to-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#106ebe]/10 text-[#106ebe] flex items-center justify-center font-bold text-base">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">{selectedCustomer.name}</h2>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-mono text-[10px]">
                      {selectedCustomer.code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        selectedCustomer.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {selectedCustomer.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex items-center gap-3 mt-1">
                    {selectedCustomer.mobile ? (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-[#106ebe]" />
                        {selectedCustomer.mobile}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">No phone number recorded</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(selectedCustomer)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium border border-slate-300"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
                <button
                  onClick={() => handleToggleActive(selectedCustomer)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium ${
                    selectedCustomer.isActive
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  {selectedCustomer.isActive ? (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Deactivate</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Activate</span>
                    </>
                  )}
                </button>
                {onNavigateToPOS && (
                  <button
                    onClick={() => onNavigateToPOS(selectedCustomer.id)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#106ebe] hover:bg-[#115ea3] rounded text-white font-semibold shadow-xs"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Create Bill (POS)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 text-[11px] divide-x divide-slate-200">
              <div className="p-2.5 px-4">
                <div className="text-slate-500">Current Balance</div>
                <div
                  className={`text-sm font-bold font-mono mt-0.5 ${
                    selectedCustomer.currentBalance > 0
                      ? 'text-rose-600'
                      : selectedCustomer.currentBalance < 0
                      ? 'text-emerald-600'
                      : 'text-slate-800'
                  }`}
                >
                  ₹{selectedCustomer.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="p-2.5 px-4">
                <div className="text-slate-500">Total Bills Count</div>
                <div className="text-sm font-bold font-mono text-slate-800 mt-0.5">
                  {customerInvoices.length} Invoices
                </div>
              </div>

              <div className="p-2.5 px-4">
                <div className="text-slate-500">Total Billed Volume</div>
                <div className="text-sm font-bold font-mono text-emerald-700 mt-0.5">
                  ₹
                  {customerInvoices
                    .reduce((sum, inv) => sum + inv.grandTotal, 0)
                    .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className="border-b border-slate-200 px-4 bg-white flex gap-6">
              {[
                { key: 'profile', label: 'Customer Details', icon: Users },
                { key: 'invoices', label: `Invoices History (${customerInvoices.length})`, icon: Receipt },
                { key: 'ledger', label: `Financial Statement Ledger (${customerLedger.length})`, icon: FileText },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`py-2.5 flex items-center gap-2 border-b-2 font-medium text-xs transition-colors ${
                      isActive
                        ? 'border-[#106ebe] text-[#106ebe]'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {activeTab === 'profile' && (
                <div className="bg-white rounded border border-slate-200 p-5 max-w-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="font-bold text-slate-900 text-sm">
                      Customer Information
                    </h3>
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                      Name & Phone Only
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">Customer Name:</span>
                      <div className="font-semibold text-slate-900 mt-1 text-sm">{selectedCustomer.name}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Customer Code:</span>
                      <div className="font-mono text-slate-900 mt-1">{selectedCustomer.code}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Phone Number:</span>
                      <div className="font-mono font-semibold text-slate-900 mt-1 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#106ebe]" />
                        {selectedCustomer.mobile || '—'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Account Status:</span>
                      <div className="mt-1">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            selectedCustomer.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {selectedCustomer.isActive ? 'Active Customer' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'invoices' && (
                <div className="bg-white rounded border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold">
                        <th className="p-2.5">Invoice #</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Items</th>
                        <th className="p-2.5 text-right">Grand Total (₹)</th>
                        <th className="p-2.5 text-right">Paid (₹)</th>
                        <th className="p-2.5 text-right">Balance (₹)</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400">
                            No billing invoices recorded for this customer.
                          </td>
                        </tr>
                      ) : (
                        customerInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-semibold text-[#106ebe]">{inv.invoiceNumber}</td>
                            <td className="p-2.5 text-slate-500">{inv.invoiceDate.slice(0, 10)}</td>
                            <td className="p-2.5 font-mono">{inv.items ? inv.items.length : 0} items</td>
                            <td className="p-2.5 text-right font-mono font-semibold">
                              ₹{inv.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5 text-right font-mono text-emerald-600">
                              ₹{inv.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5 text-right font-mono text-rose-600 font-semibold">
                              ₹{inv.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  inv.paymentStatus === 'Paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : inv.paymentStatus === 'Partial'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {inv.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'ledger' && (
                <div className="bg-white rounded border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold">
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Reference / Doc #</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5 text-right">Debit (₹)</th>
                        <th className="p-2.5 text-right">Credit (₹)</th>
                        <th className="p-2.5 text-right">Running Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerLedger.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-400">
                            No ledger transactions found. Current balance: ₹{selectedCustomer.currentBalance || 0}
                          </td>
                        </tr>
                      ) : (
                        customerLedger.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="p-2.5 text-slate-500">{row.transactionDate.slice(0, 10)}</td>
                            <td className="p-2.5 font-mono text-[#106ebe]">{row.referenceNumber}</td>
                            <td className="p-2.5">{row.description}</td>
                            <td className="p-2.5 text-right font-mono text-rose-600 font-medium">
                              {row.debitAmount > 0 ? `₹${row.debitAmount.toFixed(2)}` : '—'}
                            </td>
                            <td className="p-2.5 text-right font-mono text-emerald-600 font-medium">
                              {row.creditAmount > 0 ? `₹${row.creditAmount.toFixed(2)}` : '—'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-800">
                              ₹{row.runningBalance.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">Select a customer from the left directory</p>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Customer Modal (Name and Phone Number only) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#1f4e79] text-white px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {modalMode === 'add' ? 'Add New Customer' : `Edit Customer — ${formData.name}`}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-sky-200 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3.5 text-xs">
              {formErrors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded text-xs">
                  {formErrors.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#106ebe] focus:outline-hidden"
                    placeholder="Enter customer name"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.mobile || ''}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#106ebe] focus:outline-hidden font-mono"
                    placeholder="10-digit mobile number"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#106ebe] hover:bg-[#115ea3] text-white font-semibold rounded flex items-center gap-1.5 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{modalMode === 'add' ? 'Create Customer' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
