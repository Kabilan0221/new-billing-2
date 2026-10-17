import { InvoiceHeader, AppSettings } from '../types';
import { numberToWords } from './numberToWords';

export function generateA4DotMatrixHtml(invoice: InvoiceHeader, settings?: AppSettings): string {
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

  const minRows = 12;
  const emptyRowsCount = Math.max(0, minRows - invoice.items.length);

  const itemRowsHtml = invoice.items
    .map((item, idx) => {
      const sgstRate = !invoice.isInterstate ? item.taxRate / 2 : 0;
      const cgstRate = !invoice.isInterstate ? item.taxRate / 2 : 0;
      return `
        <tr>
          <td style="text-align: center; border-right: 1px dashed #000; padding: 3px 2px;">${idx + 1}</td>
          <td style="border-right: 1px dashed #000; padding: 3px 6px;">
            <strong>${item.productName}</strong>
          </td>
          <td style="text-align: center; border-right: 1px dashed #000; padding: 3px 2px; font-size: 9px;">${item.productCode || ''}</td>
          <td style="text-align: center; border-right: 1px dashed #000; padding: 3px 2px; font-weight: bold;">${item.quantity}</td>
          <td style="text-align: right; border-right: 1px dashed #000; padding: 3px 6px;">${item.rate.toFixed(2)}</td>
          <td style="text-align: center; border-right: 1px dashed #000; padding: 3px 2px;"></td>
          <td style="text-align: center; border-right: 1px dashed #000; padding: 3px 2px;">${sgstRate.toFixed(2)}</td>
          <td style="text-align: center; border-right: 1px dashed #000; padding: 3px 2px;">${cgstRate.toFixed(2)}</td>
          <td style="text-align: right; padding: 3px 6px; font-weight: bold;">${item.lineTotal.toFixed(2)}</td>
        </tr>

      `;
    })
    .join('');

  const emptyRowsHtml = Array.from({ length: emptyRowsCount })
    .map(
      () => `
        <tr style="height: 18px;">
          <td style="border-right: 1px dashed #000;"></td>
          <td style="border-right: 1px dashed #000;"></td>
          <td style="border-right: 1px dashed #000;"></td>
          <td style="border-right: 1px dashed #000;"></td>
          <td style="border-right: 1px dashed #000;"></td>
          <td style="border-right: 1px dashed #000;"></td>
          <td style="border-right: 1px dashed #000;"></td>
          <td style="border-right: 1px dashed #000;"></td>
          <td></td>
        </tr>
      `
    )
    .join('');

  return `
    <div style="width: 100%; max-width: 198mm; margin: 0 auto; font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.25; color: #000; background: #fff;">
      <!-- Store Header -->
      <div style="text-align: center; margin-bottom: 8px;">
        <div style="font-size: 16px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
          ${storeName}
        </div>
        <div style="font-size: 11px;">${storeAddress}</div>
        <div style="font-size: 11px;">${storePhone}</div>
        <div style="font-size: 11px; font-weight: bold;">GSTIN/UIN: ${storeGstin}</div>
      </div>

      <!-- Outer Dotted Border -->
      <div style="border: 1px dashed #000;">
        <!-- Title Bar -->
        <table style="width: 100%; border-collapse: collapse; border-bottom: 1px dashed #000;">
          <tr>
            <td style="text-align: center; font-weight: bold; letter-spacing: 5px; font-size: 13px; padding: 4px;">
              T A X &nbsp; I N V O I C E
            </td>
            <td style="text-align: right; width: 160px; font-size: 10px; padding: 4px;">
              Original for Receipient
            </td>
          </tr>
        </table>

        <!-- Metadata & PO Details -->
        <table style="width: 100%; border-collapse: collapse; border-bottom: 1px dashed #000;">
          <tr>
            <td style="width: 58%; border-right: 1px dashed #000; padding: 6px; vertical-align: top;">
              <div>Serial No of Invoice: <strong>${invoice.invoiceNumber}</strong></div>
              <div>Date Of Invoice &nbsp; &nbsp; : ${invoiceDateFormatted}</div>
              <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                <span>State: ${customerState}</span>
                <span>State code: ${customerStateCode}</span>
              </div>
            </td>
            <td style="width: 42%; padding: 6px; vertical-align: top;">
              <div>P.O No &nbsp; : —</div>
              <div>P.O Date: —</div>
            </td>
          </tr>
        </table>

        <!-- Billed To & Shipped To -->
        <table style="width: 100%; border-collapse: collapse; border-bottom: 1px dashed #000;">
          <tr>
            <td style="width: 58%; border-right: 1px dashed #000; padding: 6px; vertical-align: top;">
              <div style="font-weight: bold;">Billed To,</div>
              <div style="font-weight: bold;">${customerName}</div>
              <div style="white-space: pre-line; font-size: 10px;">${customerAddress}</div>
              <div style="margin-top: 4px; font-size: 10px;">
                <div>GSTIN: ${customerGstin || '—'}</div>
                <div style="display: flex; justify-content: space-between;">
                  <span>State: ${customerState}</span>
                  <span>State code: ${customerStateCode}</span>
                </div>
              </div>
            </td>
            <td style="width: 42%; padding: 6px; vertical-align: top;">
              <div style="font-weight: bold;">Shipped To:</div>
              <div style="font-weight: bold;">${customerName}</div>
              <div style="white-space: pre-line; font-size: 10px;">${customerAddress}</div>
              <div style="margin-top: 4px; font-size: 10px;">
                <div>GSTIN: ${customerGstin || '—'}</div>
                <div style="display: flex; justify-content: space-between;">
                  <span>State: ${customerState}</span>
                  <span>State code: ${customerStateCode}</span>
                </div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; border-bottom: 1px dashed #000;">
          <thead>
            <tr style="border-bottom: 1px dashed #000; font-size: 10px; font-weight: bold;">
              <th style="width: 5%; border-right: 1px dashed #000; padding: 4px 2px; text-align: center;">|SNo|</th>
              <th style="width: 38%; border-right: 1px dashed #000; padding: 4px 6px; text-align: left;">Description</th>
              <th style="width: 9%; border-right: 1px dashed #000; padding: 4px 2px; text-align: center;">|HSN/SAC|</th>
              <th style="width: 6%; border-right: 1px dashed #000; padding: 4px 2px; text-align: center;">Qty</th>
              <th style="width: 9%; border-right: 1px dashed #000; padding: 4px 6px; text-align: right;">Rate</th>
              <th style="width: 6%; border-right: 1px dashed #000; padding: 4px 2px; text-align: center;">|Free|</th>
              <th style="width: 7%; border-right: 1px dashed #000; padding: 4px 2px; text-align: center;">|SGS%|</th>
              <th style="width: 7%; border-right: 1px dashed #000; padding: 4px 2px; text-align: center;">|CGS%|</th>
              <th style="width: 13%; padding: 4px 6px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
            ${emptyRowsHtml}
          </tbody>
        </table>

        <!-- Totals Strip -->
        <table style="width: 100%; border-collapse: collapse; border-bottom: 1px dashed #000;">
          <tr>
            <td style="width: 58%; border-right: 1px dashed #000; padding: 6px; vertical-align: top;">
              <table style="width: 100%; font-size: 10.5px;">
                <tr><td>Total Taxable Value:</td><td style="text-align: right;">${invoice.taxableAmount.toFixed(2)}</td></tr>
                <tr><td>Add: CGST</td><td style="text-align: right;">${invoice.cgstAmount.toFixed(2)}</td></tr>
                <tr><td>Add: SGST</td><td style="text-align: right;">${invoice.sgstAmount.toFixed(2)}</td></tr>
                <tr><td>Add: IGST</td><td style="text-align: right;">${invoice.igstAmount.toFixed(2)}</td></tr>
              </table>
            </td>
            <td style="width: 42%; padding: 6px; vertical-align: top;">
              <table style="width: 100%; font-size: 10.5px;">
                <tr><td style="font-weight: bold;">Total Qty:</td><td style="text-align: right; font-weight: bold;">${totalQty}</td></tr>
                <tr><td>Sub Total:</td><td style="text-align: right;">${(invoice.taxableAmount + invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount).toFixed(2)}</td></tr>
                <tr style="border-top: 1px dashed #000; font-weight: bold; font-size: 12px;">

                  <td style="padding-top: 4px;">Grand Total:</td>
                  <td style="text-align: right; padding-top: 4px;">${invoice.grandTotal.toFixed(2)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Amount In Words -->
        <div style="border-bottom: 1px dashed #000; padding: 5px 6px; font-size: 10.5px;">
          <strong>| Rupees: </strong>${wordsAmount}
        </div>

        <!-- Terms and Signatures (BANK DETAILS REMOVED PER USER INSTRUCTION) -->
        <table style="width: 100%; border-collapse: collapse; border-bottom: 1px dashed #000;">
          <tr>
            <td style="width: 58%; border-right: 1px dashed #000; padding: 6px; vertical-align: top; font-size: 9.5px; line-height: 1.35;">
              <div style="font-weight: bold; font-size: 10px;">Terms & Conditions:</div>
              <div>1. All disputes are subject to KANCHEEPURAM Jurisdiction.</div>
              <div>2. Goods once sold can not be taken back or exchanged.</div>
              <div>3. Service & Repair contact respective service centers.</div>
            </td>
            <td style="width: 42%; padding: 6px; vertical-align: top; text-align: right; font-size: 10px;">
              <div style="font-weight: bold; text-transform: uppercase;">for ${storeName}</div>
              <div style="height: 35px;"></div>
              <div style="font-weight: bold;">Authorised Signatory</div>
            </td>
          </tr>
        </table>

        <!-- Signatures Bottom -->
        <table style="width: 100%; border-collapse: collapse; padding: 4px;">
          <tr>
            <td style="padding: 6px; font-size: 10px;">Receivers Signature</td>
            <td style="padding: 6px; font-size: 10px; text-align: right;">—</td>
          </tr>
        </table>
      </div>
    </div>
  `;
}

export function generateThermalReceiptHtml(invoice: InvoiceHeader, settings?: AppSettings, paperWidthMm = 80): string {
  const storeName = settings?.storeName || 'Sri Venkateswara (SVT)';
  const storeTamil = settings?.storeTamilName || '';
  const storeSubtitle = settings?.storeSubtitle || '';
  const storeAddress = settings?.storeAddress || 'மடம் தெரு, அண்ணா விளையாட்டு பூங்கா அருகில், காஞ்சிபுரம் - 631 502.';
  const storePhone = settings?.storePhone || '8143 84 8143 / 9941333457';
  const storeGstin = settings?.gstNumber || '33AAAAA0000A1Z5';

  const dateStr = new Date(invoice.invoiceDate).toLocaleDateString('en-IN');
  const timeStr = new Date(invoice.invoiceDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const totalQty = invoice.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const is4Inch = paperWidthMm >= 100;
  const hasGst = invoice.totalTaxAmount > 0 || !!invoice.customerGstin;

  const itemsHtml = invoice.items
    .map(
      (it, idx) => {
        if (is4Inch) {
          // 4-Inch Thermal (104mm width): Spacious 7-column layout
          return `
            <tr>
              <td style="text-align: center; vertical-align: top; padding: 4px 1px; border-bottom: 1px dotted #ccc;">${idx + 1}</td>
              <td style="vertical-align: top; padding: 4px 4px; border-bottom: 1px dotted #ccc;">
                <div style="font-weight: bold; font-size: 11px;">${it.productName}</div>
                ${it.discountAmount > 0 ? `<div style="font-size: 9px; color: #555;">Disc: -₹${it.discountAmount.toFixed(2)}</div>` : ''}
              </td>
              <td style="text-align: center; vertical-align: top; padding: 4px 2px; font-size: 10px; border-bottom: 1px dotted #ccc;">${it.productCode || '—'}</td>
              <td style="text-align: center; vertical-align: top; padding: 4px 2px; font-weight: bold; border-bottom: 1px dotted #ccc;">${it.quantity} ${it.unit || ''}</td>
              <td style="text-align: right; vertical-align: top; padding: 4px 3px; border-bottom: 1px dotted #ccc;">₹${it.rate.toFixed(2)}</td>
              <td style="text-align: center; vertical-align: top; padding: 4px 2px; font-size: 10px; border-bottom: 1px dotted #ccc;">${it.taxRate}%</td>
              <td style="text-align: right; vertical-align: top; padding: 4px 2px; font-weight: bold; border-bottom: 1px dotted #ccc;">₹${it.lineTotal.toFixed(2)}</td>
            </tr>
          `;
        } else {
          // 3-Inch / 2-Inch Thermal layout
          return `
            <tr>
              <td style="text-align: center; vertical-align: top; padding: 3px 0; border-bottom: 1px dotted #ccc;">${idx + 1}</td>
              <td style="vertical-align: top; padding: 3px 3px; border-bottom: 1px dotted #ccc;">
                <div style="font-weight: bold;">${it.productName}</div>
                ${it.discountAmount > 0 ? `<div style="font-size: 9px; color: #555;">Disc: -₹${it.discountAmount.toFixed(2)}</div>` : ''}
              </td>
              <td style="text-align: center; vertical-align: top; padding: 3px 2px; font-weight: bold; border-bottom: 1px dotted #ccc;">${it.quantity} ${it.unit || ''}</td>
              <td style="text-align: right; vertical-align: top; padding: 3px 2px; border-bottom: 1px dotted #ccc;">₹${it.rate.toFixed(2)}</td>
              <td style="text-align: right; vertical-align: top; padding: 3px 0; font-weight: bold; border-bottom: 1px dotted #ccc;">₹${it.lineTotal.toFixed(2)}</td>
            </tr>
          `;
        }
      }
    )
    .join('');

  return `
    <div style="width: 100%; max-width: ${paperWidthMm}mm; margin: 0 auto; font-family: 'Courier New', Courier, monospace, monospace; font-size: 11px; line-height: 1.25; color: #000; background: #fff; padding: 4px ${is4Inch ? '8px' : '4px'};">
      <!-- Store Header -->
      <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="font-size: ${is4Inch ? '16px' : '14px'}; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">${storeName}</div>
        ${storeTamil ? `<div style="font-size: 11px; font-weight: bold;">${storeTamil}</div>` : ''}
        ${storeSubtitle ? `<div style="font-size: 10px;">${storeSubtitle}</div>` : ''}
        <div style="font-size: 10px; margin-top: 2px;">${storeAddress}</div>
        <div style="font-size: 10px; font-weight: bold;">Ph: ${storePhone}</div>
        <div style="font-size: 11px; font-weight: 900; margin-top: 2px; letter-spacing: 0.5px;">GSTIN: ${storeGstin}</div>
        <div style="font-size: 11px; font-weight: bold; margin-top: 4px; border: 1.5px solid #000; display: inline-block; padding: 2px 10px; background: #f9f9f9; text-transform: uppercase;">
          ${hasGst ? 'TAX INVOICE' : 'RETAIL CASH BILL'}
        </div>
      </div>

      <!-- Bill Metadata & Customer Info -->
      <div style="border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 6px; font-size: 11px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>BILL NO: <strong>${invoice.invoiceNumber}</strong></span>
          <span>DATE: ${dateStr} ${timeStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 3px;">
          <span>CUSTOMER: <strong>${invoice.customerName}</strong></span>
          ${invoice.customerMobile ? `<span>MOB: ${invoice.customerMobile}</span>` : ''}
        </div>
        ${invoice.customerGstin ? `
          <div style="margin-top: 2px; font-weight: bold; color: #000;">
            <span>CUSTOMER GSTIN: <strong>${invoice.customerGstin}</strong></span>
          </div>
        ` : ''}
        ${invoice.customerAddress ? `
          <div style="margin-top: 2px; font-size: 10px; color: #444;">
            <span>ADDRESS: ${invoice.customerAddress}</span>
          </div>
        ` : ''}
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; border-bottom: 2px dashed #000; margin-bottom: 6px;">
        <thead>
          <tr style="border-bottom: 2px solid #000; font-weight: bold; text-transform: uppercase; font-size: 10px;">
            ${is4Inch ? `
              <th style="width: 6%; text-align: center; padding: 3px 1px;">#</th>
              <th style="width: 38%; text-align: left; padding: 3px 4px;">ITEM DESCRIPTION</th>
              <th style="width: 12%; text-align: center; padding: 3px 2px;">CODE</th>
              <th style="width: 12%; text-align: center; padding: 3px 2px;">QTY</th>
              <th style="width: 12%; text-align: right; padding: 3px 3px;">RATE</th>
              <th style="width: 8%; text-align: center; padding: 3px 2px;">GST%</th>
              <th style="width: 12%; text-align: right; padding: 3px 2px;">TOTAL</th>
            ` : `
              <th style="width: 8%; text-align: center; padding: 2px 0;">#</th>
              <th style="width: 44%; text-align: left; padding: 2px 4px;">ITEM</th>
              <th style="width: 16%; text-align: center; padding: 2px 2px;">QTY</th>
              <th style="width: 16%; text-align: right; padding: 2px 2px;">RATE</th>
              <th style="width: 16%; text-align: right; padding: 2px 0;">TOTAL</th>
            `}
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Totals & Summary -->
      <div style="font-size: 11px; space-y: 2px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; background: #f4f4f4; padding: 4px 6px; border: 1px dotted #000; margin-bottom: 4px;">
          <span>TOTAL ITEMS: ${invoice.items.length}</span>
          <span>TOTAL QTY: ${totalQty}</span>
        </div>

        ${invoice.billDiscount > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 1px 2px;">
            <span>Bill Discount:</span>
            <span style="font-weight: bold;">-₹${invoice.billDiscount.toFixed(2)}</span>
          </div>
        ` : ''}

        ${hasGst ? `
          <div style="border-top: 1px dotted #888; border-bottom: 1px dotted #888; padding: 3px 2px; margin: 3px 0; font-size: 10px;">
            <div style="display: flex; justify-content: space-between;">
              <span>Taxable Value:</span>
              <span>₹${invoice.taxableAmount.toFixed(2)}</span>
            </div>
            ${!invoice.isInterstate ? `
              <div style="display: flex; justify-content: space-between;">
                <span>CGST:</span>
                <span>₹${invoice.cgstAmount.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>SGST:</span>
                <span>₹${invoice.sgstAmount.toFixed(2)}</span>
              </div>
            ` : `
              <div style="display: flex; justify-content: space-between;">
                <span>IGST:</span>
                <span>₹${invoice.igstAmount.toFixed(2)}</span>
              </div>
            `}
            <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px dotted #ccc; padding-top: 2px; margin-top: 2px;">
              <span>Total GST:</span>
              <span>₹${invoice.totalTaxAmount.toFixed(2)}</span>
            </div>
          </div>
        ` : ''}

        ${Math.abs(invoice.roundOff) > 0.001 ? `
          <div style="display: flex; justify-content: space-between; font-size: 10.5px; padding: 1px 2px;">
            <span>Round Off:</span>
            <span>₹${invoice.roundOff.toFixed(2)}</span>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; font-size: ${is4Inch ? '18px' : '15px'}; font-weight: 900; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 2px; margin: 5px 0;">
          <span>GRAND TOTAL:</span>
          <span>₹${invoice.grandTotal.toFixed(2)}</span>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px;">
          <span>Payment Mode (${invoice.payments[0]?.paymentMethod || invoice.paymentMode || 'Cash'}):</span>
          <strong>₹${invoice.amountPaid.toFixed(2)}</strong>
        </div>
        ${invoice.cashChange ? `
          <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px; font-weight: bold;">
            <span>Change Returned:</span>
            <strong>₹${invoice.cashChange.toFixed(2)}</strong>
          </div>
        ` : ''}
      </div>

      <!-- Footer barcode and message -->
      <div style="text-align: center; margin-top: 8px; border-top: 2px dashed #000; padding-top: 6px;">
        <div style="font-weight: bold; font-size: 11px;">*** THANK YOU, VISIT AGAIN! ***</div>
        <div style="font-family: monospace; letter-spacing: 3px; font-size: 10px; margin-top: 4px;">
          ||| | ||||| || |||| ||| |||||||
        </div>
      </div>
    </div>
  `;
}

