import React from 'react';
import { InvoiceHeader, AppSettings } from '../types';
import { numberToWords } from '../services/numberToWords';

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
  const storeName = settings?.storeName || 'VENKATESHWARA FURNITURE AND STORES';
  const storeAddress = settings?.storeAddress || 'madam street, kanchipuram-6315001';
  const storePhone = settings?.storePhone || 'Ph: +91 98765 43210';
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
  const customerAddress = invoice.customerAddress || '23E, Madam street\nKANCHIPURAM - 631502';
  const customerGstin = invoice.customerGstin || '';
  const customerState = 'TAMILNADU';
  const customerStateCode = '33';

  const totalQty = invoice.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const wordsAmount = numberToWords(invoice.grandTotal);

  // Pad items to fill minimum table height matching classical dot matrix receipt
  const minRows = 14;
  const emptyRowsCount = Math.max(0, minRows - invoice.items.length);

  return (
    <div
      id="printable-a4-matrix"
      className="a4-dot-matrix-root bg-white text-black font-mono text-[11px] leading-tight p-4 sm:p-6 mx-auto select-text"
      style={{
        width: '210mm',
        minHeight: '280mm',
        boxSizing: 'border-box',
        fontFamily: "'Courier New', Courier, monospace",
      }}
    >
      {/* 1. Header (Store Title & Details) */}
      <div className="text-center pb-2">
        <div className="font-bold text-base sm:text-lg tracking-wider uppercase text-black font-mono">
          {storeName}
        </div>
        <div className="text-xs text-black font-mono leading-relaxed">{storeAddress}</div>
        <div className="text-xs text-black font-mono">{storePhone}</div>
        <div className="text-xs font-bold text-black font-mono tracking-wide">
          GSTIN/UIN: {storeGstin}
        </div>
      </div>

      {/* Main Outer Dotted Box */}
      <div className="border border-dashed border-black">
        {/* Title Bar */}
        <div className="border-b border-dashed border-black py-1 px-3 flex items-center justify-between">
          <div className="flex-1 text-center font-bold tracking-[0.35em] text-xs sm:text-sm uppercase">
            T A X &nbsp; I N V O I C E
          </div>
          <div className="text-[10px] text-slate-700 font-mono shrink-0">
            {copyTitle}
          </div>
        </div>

        {/* Row 1: Invoice metadata & PO details */}
        <div className="grid grid-cols-12 border-b border-dashed border-black min-h-[46px]">
          <div className="col-span-7 p-2 border-r border-dashed border-black space-y-0.5">
            <div className="flex">
              <span className="w-44">Serial No of Invoice:</span>
              <strong className="font-bold">{invoice.invoiceNumber}</strong>
            </div>
            <div className="flex">
              <span className="w-44">Date Of Invoice &nbsp; &nbsp; :</span>
              <span>{invoiceDateFormatted}</span>
            </div>
            <div className="flex justify-between pr-4">
              <div>
                <span>State: </span>
                <span>{customerState}</span>
              </div>
              <div>
                <span>State code: </span>
                <span>{customerStateCode}</span>
              </div>
            </div>
          </div>

          <div className="col-span-5 p-2 space-y-0.5">
            <div className="flex">
              <span className="w-24">P.O No &nbsp; :</span>
              <span>—</span>
            </div>
            <div className="flex">
              <span className="w-24">P.O Date:</span>
              <span>—</span>
            </div>
          </div>
        </div>

        {/* Row 2: Billed To & Shipped To */}
        <div className="grid grid-cols-12 border-b border-dashed border-black min-h-[96px]">
          {/* Billed To */}
          <div className="col-span-7 p-2 border-r border-dashed border-black flex flex-col justify-between space-y-1">
            <div>
              <div className="font-bold">Billed To,</div>
              <div className="font-semibold">{customerName}</div>
              <div className="whitespace-pre-line text-[10px] text-slate-800">{customerAddress}</div>
            </div>
            <div className="pt-1 text-[10px]">
              <div>GSTIN: {customerGstin || '—'}</div>
              <div className="flex justify-between pr-4">
                <span>State: {customerState}</span>
                <span>State code: {customerStateCode}</span>
              </div>
            </div>
          </div>

          {/* Shipped To */}
          <div className="col-span-5 p-2 flex flex-col justify-between space-y-1">
            <div>
              <div className="font-bold">Shipped To:</div>
              <div className="font-semibold">{customerName}</div>
              <div className="whitespace-pre-line text-[10px] text-slate-800">{customerAddress}</div>
            </div>
            <div className="pt-1 text-[10px]">
              <div>GSTIN: {customerGstin || '—'}</div>
              <div className="flex justify-between pr-2">
                <span>State: {customerState}</span>
                <span>State code: {customerStateCode}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Items Table Header */}
        <div className="grid grid-cols-12 border-b border-dashed border-black font-bold text-center text-[10px] bg-slate-50">
          <div className="col-span-1 border-r border-dashed border-black py-1">|SNo|</div>
          <div className="col-span-4 border-r border-dashed border-black py-1 text-left px-1">Description</div>
          <div className="col-span-1 border-r border-dashed border-black py-1">|HSN/SAC|</div>
          <div className="col-span-1 border-r border-dashed border-black py-1">Qty</div>
          <div className="col-span-1 border-r border-dashed border-black py-1 text-right px-1">Rate</div>
          <div className="col-span-1 border-r border-dashed border-black py-1">|Free|</div>
          <div className="col-span-1 border-r border-dashed border-black py-1">|SGS%|</div>
          <div className="col-span-1 border-r border-dashed border-black py-1">|CGS%|</div>
          <div className="col-span-1 py-1 text-right px-1">Amount</div>
        </div>

        {/* Items Table Body with continuous vertical dashed lines */}
        <div className="divide-y divide-dashed divide-black/20">
          {invoice.items.map((item, idx) => {
            const sgstRate = !invoice.isInterstate ? item.taxRate / 2 : 0;
            const cgstRate = !invoice.isInterstate ? item.taxRate / 2 : 0;
            return (
              <div
                key={idx}
                className="grid grid-cols-12 text-[10.5px] items-stretch min-h-[22px]"
              >
                <div className="col-span-1 border-r border-dashed border-black text-center py-1">
                  {idx + 1}
                </div>
                <div className="col-span-4 border-r border-dashed border-black py-1 px-1.5 truncate">
                  <span className="font-semibold">{item.productName}</span>
                </div>
                <div className="col-span-1 border-r border-dashed border-black text-center py-1 text-[9.5px]">
                  {item.productCode || '—'}
                </div>

                <div className="col-span-1 border-r border-dashed border-black text-center py-1 font-bold">
                  {item.quantity}
                </div>
                <div className="col-span-1 border-r border-dashed border-black text-right py-1 px-1">
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
                <div className="col-span-1 text-right py-1 px-1 font-bold">
                  {item.lineTotal.toFixed(2)}
                </div>
              </div>
            );
          })}

          {/* Empty filler rows with vertical dashed column guidelines */}
          {Array.from({ length: emptyRowsCount }).map((_, i) => (
            <div key={`empty-${i}`} className="grid grid-cols-12 text-[10px] items-stretch min-h-[19px]">
              <div className="col-span-1 border-r border-dashed border-black py-0.5"></div>
              <div className="col-span-4 border-r border-dashed border-black py-0.5"></div>
              <div className="col-span-1 border-r border-dashed border-black py-0.5"></div>
              <div className="col-span-1 border-r border-dashed border-black py-0.5"></div>
              <div className="col-span-1 border-r border-dashed border-black py-0.5"></div>
              <div className="col-span-1 border-r border-dashed border-black py-0.5"></div>
              <div className="col-span-1 border-r border-dashed border-black py-0.5"></div>
              <div className="col-span-1 border-r border-dashed border-black py-0.5"></div>
              <div className="col-span-1 py-0.5"></div>
            </div>
          ))}
        </div>

        {/* 4. Totals Summary Strip */}
        <div className="grid grid-cols-12 border-t border-dashed border-black">
          {/* Left: Tax Breakup */}
          <div className="col-span-7 p-2 border-r border-dashed border-black space-y-0.5 text-[10.5px]">
            <div className="flex justify-between pr-4">
              <span>Total Taxable Value:</span>
              <span className="font-mono">{invoice.taxableAmount.toFixed(2)}</span>
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
          <div className="col-span-5 p-2 flex flex-col justify-between text-[10.5px]">
            <div className="flex justify-between">
              <span className="font-bold">Total Qty:</span>
              <strong className="font-bold text-xs">{totalQty}</strong>
            </div>
            <div className="flex justify-between pt-1">
              <span>Sub Total:</span>
              <span className="font-mono">
                {(invoice.taxableAmount + invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount).toFixed(2)}
              </span>
            </div>

            <div className="border-t border-dashed border-black pt-1 mt-1 flex justify-between items-center font-bold text-xs">
              <span>Grand Total:</span>
              <span className="font-mono text-sm font-black">{invoice.grandTotal.toFixed(2)}</span>
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
  );
};
