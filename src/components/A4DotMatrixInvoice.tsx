import React from 'react';
import { InvoiceHeader, AppSettings } from '../types';
import { numberToWords } from '../services/numberToWords';
import { db } from '../services/dbEngine';

interface A4DotMatrixInvoiceProps {
  invoice: InvoiceHeader;
  settings?: AppSettings;
  copyTitle?: string; // e.g. "Original for Receipient"
}

export const A4DotMatrixInvoice: React.FC<A4DotMatrixInvoiceProps> = ({
  invoice,
  settings,
  copyTitle = 'Original for Receipient',
}) => {
  const storeName = (settings?.storeName || 'SRI VENKATESWARA FURNITURE AND STORE').toUpperCase();
  const storeAddress = settings?.storeAddress || 'Madam Street, Near Anna Sports Park, Kanchipuram - 631 502';
  const storePhone = settings?.storePhone || 'Ph: 8143 84 8143 / 9941333457';
  const storeGstin = settings?.gstNumber || '33AGOPV5229Q1ZH';

  const invoiceDateFormatted = (() => {
    try {
      const d = new Date(invoice.invoiceDate);
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    } catch {
      return invoice.invoiceDate;
    }
  })();

  const customerName = invoice.customerName || 'Cash Customer';
  let customerMobile = invoice.customerMobile || '';
  if (!customerMobile && invoice.customerId) {
    try {
      const c = db.getCustomers().find((cust) => cust.id === invoice.customerId);
      if (c?.mobile) customerMobile = c.mobile;
    } catch {
      // fallback
    }
  }
  if (!customerMobile) customerMobile = '—';

  const totalQty = invoice.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const wordsAmount = numberToWords(invoice.grandTotal);

  return (
    <div
      id="printable-a4-matrix"
      className="a4-dot-matrix-root bg-white text-black font-mono text-[11.5px] leading-relaxed p-4 sm:p-6 mx-auto select-text flex flex-col justify-between"
      style={{
        width: '100%',
        maxWidth: '210mm',
        minHeight: '282mm',
        boxSizing: 'border-box',
        fontFamily: "'Courier New', Courier, monospace",
      }}
    >
      {/* 1. Header (Store Title & Details) */}
      <div className="text-center pb-3">
        <div className="font-black text-lg sm:text-xl tracking-wider uppercase text-black font-mono">
          {storeName}
        </div>
        <div className="text-xs text-black font-mono leading-relaxed">{storeAddress}</div>
        <div className="text-xs text-black font-mono">{storePhone}</div>
        <div className="text-xs font-bold text-black font-mono tracking-wide">
          GSTIN/UIN: {storeGstin}
        </div>
      </div>

      {/* Main Outer Dotted Box - Stretches to cover full A4 sheet */}
      <div className="border border-dashed border-black flex-1 flex flex-col justify-between">
        <div>
          {/* Title Bar */}
          <div className="border-b border-dashed border-black py-1.5 px-4 flex items-center justify-between bg-slate-50">
            <div className="flex-1 text-center font-bold tracking-[0.35em] text-xs sm:text-sm uppercase">
              T A X &nbsp; I N V O I C E
            </div>
            <div className="text-[10.5px] text-slate-800 font-mono font-semibold shrink-0">
              {copyTitle}
            </div>
          </div>

          {/* Billed To: Only Customer Name & Mobile + Invoice Metadata */}
          <div className="grid grid-cols-12 border-b border-dashed border-black">
            {/* Billed To (Customer Name & Mobile Number) */}
            <div className="col-span-7 p-3 border-r border-dashed border-black flex flex-col justify-center space-y-1">
              <div className="font-bold text-xs uppercase tracking-wider text-black">
                Billed To:
              </div>
              <div className="font-bold text-sm text-black tracking-wide">
                {customerName}
              </div>
              <div className="text-xs text-black flex items-center gap-1">
                <span className="font-medium text-slate-700">Mobile / Phone:</span>
                <strong className="font-bold font-mono">{customerMobile}</strong>
              </div>
            </div>

            {/* Invoice Details */}
            <div className="col-span-5 p-3 flex flex-col justify-center space-y-1 text-xs text-black">
              <div className="flex justify-between items-center">
                <span className="text-slate-700">Serial No of Invoice:</span>
                <strong className="font-bold font-mono text-sm">{invoice.invoiceNumber}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-700">Date Of Invoice:</span>
                <span className="font-medium font-mono">{invoiceDateFormatted}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-700">Payment Mode:</span>
                <span className="font-bold uppercase font-mono">
                  {invoice.payments?.[0]?.paymentMethod || invoice.paymentMode || 'Cash'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Items Table Header */}
          <div className="grid grid-cols-12 border-b border-dashed border-black font-bold text-center text-[11px] bg-slate-50 py-1.5">
            <div className="col-span-1 border-r border-dashed border-black">|SNo|</div>
            <div className="col-span-4 border-r border-dashed border-black text-left px-2">Description</div>
            <div className="col-span-1 border-r border-dashed border-black">|HSN/SAC|</div>
            <div className="col-span-1 border-r border-dashed border-black">Qty</div>
            <div className="col-span-1 border-r border-dashed border-black text-right px-1.5">Rate</div>
            <div className="col-span-1 border-r border-dashed border-black">|Free|</div>
            <div className="col-span-1 border-r border-dashed border-black">|SGS%|</div>
            <div className="col-span-1 border-r border-dashed border-black">|CGS%|</div>
            <div className="col-span-1 text-right px-2">Amount</div>
          </div>

          {/* Items Table Body - Actual items only, no blank filler rows */}
          <div className="divide-y divide-dashed divide-black/30">
            {invoice.items.map((item, idx) => {
              const sgstRate = !invoice.isInterstate ? item.taxRate / 2 : 0;
              const cgstRate = !invoice.isInterstate ? item.taxRate / 2 : 0;
              return (
                <div
                  key={idx}
                  className="grid grid-cols-12 text-xs items-center py-2 px-0 hover:bg-slate-50/50"
                >
                  <div className="col-span-1 border-r border-dashed border-black text-center py-1">
                    {idx + 1}
                  </div>
                  <div className="col-span-4 border-r border-dashed border-black py-1 px-2">
                    <span className="font-bold text-black">{item.productName}</span>
                  </div>
                  <div className="col-span-1 border-r border-dashed border-black text-center py-1 text-[10.5px]">
                    {item.productCode || '—'}
                  </div>
                  <div className="col-span-1 border-r border-dashed border-black text-center py-1 font-bold">
                    {item.quantity}
                  </div>
                  <div className="col-span-1 border-r border-dashed border-black text-right py-1 px-1.5">
                    {item.rate.toFixed(2)}
                  </div>
                  <div className="col-span-1 border-r border-dashed border-black text-center py-1 text-slate-400">
                    —
                  </div>
                  <div className="col-span-1 border-r border-dashed border-black text-center py-1">
                    {sgstRate.toFixed(2)}
                  </div>
                  <div className="col-span-1 border-r border-dashed border-black text-center py-1">
                    {cgstRate.toFixed(2)}
                  </div>
                  <div className="col-span-1 text-right py-1 px-2 font-bold">
                    {item.lineTotal.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          {/* 4. Totals Summary Strip */}
          <div className="grid grid-cols-12 border-t border-dashed border-black">
            {/* Left: Tax Breakup */}
            <div className="col-span-7 p-3 border-r border-dashed border-black space-y-1 text-xs">
              <div className="flex justify-between pr-4">
                <span>Total Taxable Value:</span>
                <span className="font-mono font-semibold">{invoice.taxableAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pr-4">
                <span>Add: CGST</span>
                <span className="font-mono">{invoice.cgstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pr-4">
                <span>Add: SGST</span>
                <span className="font-mono">{invoice.sgstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pr-4">
                <span>Add: IGST</span>
                <span className="font-mono">{invoice.igstAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Right: Quantity & Grand Total */}
            <div className="col-span-5 p-3 flex flex-col justify-between text-xs">
              <div className="flex justify-between">
                <span className="font-bold">Total Qty:</span>
                <strong className="font-bold text-sm">{totalQty}</strong>
              </div>
              <div className="flex justify-between pt-1">
                <span>Sub Total:</span>
                <span className="font-mono">
                  {(invoice.taxableAmount + invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount).toFixed(2)}
                </span>
              </div>

              <div className="border-t border-dashed border-black pt-1.5 mt-1.5 flex justify-between items-center font-bold text-sm">
                <span>Grand Total:</span>
                <span className="font-mono text-base font-black">₹{invoice.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

        {/* 5. Amount In Words Row */}
        <div className="border-t border-dashed border-black px-2 py-1.5 text-[10.5px]">
          <span className="font-bold">| Rupees: </span>
          <span>{wordsAmount}</span>
        </div>

        {/* 6. Terms & Conditions and Signature Section */}
        {/* NOTE: BANK DETAILS HAVE BEEN EXPLICITLY REMOVED PER USER INSTRUCTION: "ithhu ban details matum venna remove that" */}
        <div className="grid grid-cols-12 border-t border-dashed border-black min-h-[90px]">
          {/* Terms & Conditions (Left) */}
          <div className="col-span-7 p-2 border-r border-dashed border-black text-[9.5px] leading-relaxed space-y-0.5">
            <div className="font-bold text-[10px] text-black">Terms & Conditions:</div>
            <div>1. All disputes are subject to KANCHEEPURAM Jurisdiction.</div>
            <div>2. Goods once sold can not be taken back or exchanged.</div>
            <div>3. Service & Repair contact respective service centers.</div>
          </div>

          {/* Store Authorization (Right) — Bank details removed! */}
          <div className="col-span-5 p-2 flex flex-col justify-between text-right text-[10px]">
            <div className="font-bold uppercase text-[9.5px]">
              for {storeName}
            </div>
            <div className="h-8"></div>
            <div className="font-semibold text-[10px]">
              Authorised Signatory
            </div>
          </div>
        </div>

        {/* 7. Bottom Signatures Footer */}
        <div className="grid grid-cols-12 border-t border-dashed border-black p-2 text-[10px]">
          <div className="col-span-7">
            <span>Receivers Signature</span>
          </div>
          <div className="col-span-5 text-right">
            <span>—</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};
