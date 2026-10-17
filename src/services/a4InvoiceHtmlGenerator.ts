import { InvoiceHeader, EstimateHeader, AppSettings } from '../types';
import { numberToWords } from './numberToWords';
import { db } from './dbEngine';

export function generateA4DotMatrixHtml(invoice: InvoiceHeader, settings?: AppSettings): string {
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

  const itemRowsHtml = invoice.items
    .map((item, idx) => {
      const sgstRate = !invoice.isInterstate ? item.taxRate / 2 : 0;
      const cgstRate = !invoice.isInterstate ? item.taxRate / 2 : 0;
      return `
        <tr>
          <td style="text-align: center; border-right: 1px dashed #000; padding: 6px 3px;">${idx + 1}</td>
          <td style="border-right: 1px dashed #000; padding: 6px 8px;">
            <strong>${item.productName}</strong>
          </td>
          <td style="text-align: center; border-right: 1px dashed #000; padding: 6px 3px; font-size: 10px;">${item.productCode || '—'}</td>
          <td style="text-align: center; border-right: 1px dashed #000; padding: 6px 3px; font-weight: bold;">${item.quantity}</td>
          <td style="text-align: right; border-right: 1px dashed #000; padding: 6px 8px;">${item.rate.toFixed(2)}</td>
          <td style="text-align: center; border-right: 1px dashed #000; padding: 6px 3px; color: #888;">—</td>
          <td style="text-align: center; border-right: 1px dashed #000; padding: 6px 3px;">${sgstRate.toFixed(2)}</td>
          <td style="text-align: center; border-right: 1px dashed #000; padding: 6px 3px;">${cgstRate.toFixed(2)}</td>
          <td style="text-align: right; padding: 6px 8px; font-weight: bold;">${item.lineTotal.toFixed(2)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="width: 100%; max-width: 210mm; min-height: 282mm; margin: 0 auto; font-family: 'Courier New', Courier, monospace; font-size: 11.5px; line-height: 1.35; color: #000; background: #fff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
      <!-- Store Header -->
      <div style="text-align: center; margin-bottom: 10px;">
        <div style="font-size: 18px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">
          ${storeName}
        </div>
        <div style="font-size: 11.5px; margin-top: 2px;">${storeAddress}</div>
        <div style="font-size: 11.5px;">${storePhone}</div>
        <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">GSTIN/UIN: ${storeGstin}</div>
      </div>

      <!-- Outer Dotted Border Box covering full A4 height -->
      <div style="border: 1px dashed #000; flex: 1 1 auto; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <!-- Title Bar -->
          <table style="width: 100%; border-collapse: collapse; border-bottom: 1px dashed #000; background: #fafafa;">
            <tr>
              <td style="text-align: center; font-weight: bold; letter-spacing: 5px; font-size: 13px; padding: 6px;">
                T A X &nbsp; I N V O I C E
              </td>
              <td style="text-align: right; width: 170px; font-size: 10.5px; font-weight: bold; padding: 6px 10px;">
                Original for Receipient
              </td>
            </tr>
          </table>

          <!-- Billed To (Customer Name & Mobile Only) & Invoice Details -->
          <table style="width: 100%; border-collapse: collapse; border-bottom: 1px dashed #000;">
            <tr>
              <td style="width: 58%; border-right: 1px dashed #000; padding: 8px 12px; vertical-align: top;">
                <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #222; margin-bottom: 4px;">BILLED TO:</div>
                <div style="font-size: 14px; font-weight: 900; color: #000; margin-bottom: 3px;">${customerName}</div>
                <div style="font-size: 12px; color: #000;">
                  <span style="color: #444;">Mobile / Phone: </span><strong>${customerMobile}</strong>
                </div>
              </td>
              <td style="width: 42%; padding: 8px 12px; vertical-align: top; font-size: 11.5px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                  <span style="color: #444;">Serial No of Invoice:</span>
                  <strong style="font-size: 12.5px;">${invoice.invoiceNumber}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                  <span style="color: #444;">Date Of Invoice:</span>
                  <span>${invoiceDateFormatted}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #444;">Payment Mode:</span>
                  <strong style="text-transform: uppercase;">${invoice.payments?.[0]?.paymentMethod || invoice.paymentMode || 'Cash'}</strong>
                </div>
              </td>
            </tr>
          </table>

          <!-- Items Table (Actual Bill Items Only, No Fake Blank Rows) -->
          <table style="width: 100%; border-collapse: collapse; border-bottom: 1px dashed #000;">
            <thead>
              <tr style="border-bottom: 1px dashed #000; font-size: 11px; font-weight: bold; background: #fafafa;">
                <th style="width: 5%; border-right: 1px dashed #000; padding: 5px 2px; text-align: center;">|SNo|</th>
                <th style="width: 40%; border-right: 1px dashed #000; padding: 5px 8px; text-align: left;">Description</th>
                <th style="width: 9%; border-right: 1px dashed #000; padding: 5px 2px; text-align: center;">|HSN/SAC|</th>
                <th style="width: 6%; border-right: 1px dashed #000; padding: 5px 2px; text-align: center;">Qty</th>
                <th style="width: 9%; border-right: 1px dashed #000; padding: 5px 8px; text-align: right;">Rate</th>
                <th style="width: 6%; border-right: 1px dashed #000; padding: 5px 2px; text-align: center;">|Free|</th>
                <th style="width: 7%; border-right: 1px dashed #000; padding: 5px 2px; text-align: center;">|SGS%|</th>
                <th style="width: 7%; border-right: 1px dashed #000; padding: 5px 2px; text-align: center;">|CGS%|</th>
                <th style="width: 11%; padding: 5px 8px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHtml}
            </tbody>
          </table>
        </div>

        <div>
          <!-- Totals Strip -->
          <table style="width: 100%; border-collapse: collapse; border-top: 1px dashed #000;">
            <tr>
              <td style="width: 58%; border-right: 1px dashed #000; padding: 8px 12px; vertical-align: top;">
                <table style="width: 100%; font-size: 11.5px; line-height: 1.4;">
                  <tr><td>Total Taxable Value:</td><td style="text-align: right; font-weight: bold;">${invoice.taxableAmount.toFixed(2)}</td></tr>
                  <tr><td>Add: CGST</td><td style="text-align: right;">${invoice.cgstAmount.toFixed(2)}</td></tr>
                  <tr><td>Add: SGST</td><td style="text-align: right;">${invoice.sgstAmount.toFixed(2)}</td></tr>
                  <tr><td>Add: IGST</td><td style="text-align: right;">${invoice.igstAmount.toFixed(2)}</td></tr>
                </table>
              </td>
              <td style="width: 42%; padding: 8px 12px; vertical-align: top;">
                <table style="width: 100%; font-size: 11.5px; line-height: 1.4;">
                  <tr><td style="font-weight: bold;">Total Qty:</td><td style="text-align: right; font-weight: bold; font-size: 12.5px;">${totalQty}</td></tr>
                  <tr><td>Sub Total:</td><td style="text-align: right;">${(invoice.taxableAmount + invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount).toFixed(2)}</td></tr>
                  <tr style="border-top: 1px dashed #000; font-weight: bold; font-size: 13.5px;">
                    <td style="padding-top: 5px;">Grand Total:</td>
                    <td style="text-align: right; padding-top: 5px; font-weight: 900;">₹${invoice.grandTotal.toFixed(2)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Amount In Words -->
          <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 12px; font-size: 11px;">
            <strong>| Rupees: </strong>${wordsAmount}
          </div>

          <!-- Terms and Signatures (BANK DETAILS REMOVED PER USER INSTRUCTION) -->
          <table style="width: 100%; border-collapse: collapse; border-bottom: 1px dashed #000;">
            <tr>
              <td style="width: 58%; border-right: 1px dashed #000; padding: 8px 12px; vertical-align: top; font-size: 10px; line-height: 1.4;">
                <div style="font-weight: bold; font-size: 10.5px;">Terms & Conditions:</div>
                <div>1. All disputes are subject to KANCHEEPURAM Jurisdiction.</div>
                <div>2. Goods once sold can not be taken back or exchanged.</div>
                <div>3. Service & Repair contact respective service centers.</div>
              </td>
              <td style="width: 42%; padding: 8px 12px; vertical-align: top; text-align: right; font-size: 10.5px;">
                <div style="font-weight: bold; text-transform: uppercase;">for ${storeName}</div>
                <div style="height: 38px;"></div>
                <div style="font-weight: bold;">Authorised Signatory</div>
              </td>
            </tr>
          </table>

          <!-- Signatures Bottom -->
          <table style="width: 100%; border-collapse: collapse; padding: 4px;">
            <tr>
              <td style="padding: 6px 12px; font-size: 10.5px;">Receivers Signature</td>
              <td style="padding: 6px 12px; font-size: 10.5px; text-align: right;">—</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function generateThermalReceiptHtml(invoice: InvoiceHeader, settings?: AppSettings, paperWidthMm = 80): string {
  const storeName = settings?.storeName || 'Sri Venkateswara Furniture and Store';
  const storeTamil = settings?.storeTamilName || 'ஸ்ரீ வெங்கடேஸ்வரா பர்னிச்சர் & ஸ்டோர்';
  const storeSubtitle = settings?.storeSubtitle || '';
  const storeAddress = settings?.storeAddress || 'மடம் தெரு, அண்ணா விளையாட்டு பூங்கா அருகில், காஞ்சிபுரம் - 631 502.';
  const storePhone = settings?.storePhone || '8143 84 8143 / 9941333457';
  const storeGstin = settings?.gstNumber || '33AGOPV5229Q1ZH';

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
        <div style="font-size: 11px; font-weight: 900; margin-top: 2px; letter-spacing: 0.5px;">GSTIN/UIN: ${storeGstin}</div>
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

export function generateThermalEstimateHtml(estimate: EstimateHeader, settings?: AppSettings, paperWidthMm = 80): string {
  const storeName = settings?.storeName || 'Sri Venkateswara Furniture and Store';
  const storeTamil = settings?.storeTamilName || 'ஸ்ரீ வெங்கடேஸ்வரா பர்னிச்சர் & ஸ்டோர்';
  const storeSubtitle = settings?.storeSubtitle || '';
  const storeAddress = settings?.storeAddress || 'மடம் தெரு, அண்ணா விளையாட்டு பூங்கா அருகில், காஞ்சிபுரம் - 631 502.';
  const storePhone = settings?.storePhone || '8143 84 8143 / 9941333457';
  const storeGstin = settings?.gstNumber || '33AGOPV5229Q1ZH';

  const dateStr = new Date(estimate.estimateDate).toLocaleDateString('en-IN');
  const timeStr = new Date(estimate.estimateDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const totalQty = estimate.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const is4Inch = paperWidthMm >= 100;

  const itemsHtml = estimate.items
    .map((it, idx) => {
      if (is4Inch) {
        return `
          <tr>
            <td style="text-align: center; vertical-align: top; padding: 3px 1px; border-bottom: 1px dotted #ccc;">${idx + 1}</td>
            <td style="vertical-align: top; padding: 3px 4px; border-bottom: 1px dotted #ccc;">
              <div style="font-weight: bold; font-size: 11px;">${it.productName}</div>
              ${it.discountAmount > 0 ? `<div style="font-size: 9px; color: #555;">Disc: -₹${it.discountAmount.toFixed(2)}</div>` : ''}
            </td>
            <td style="text-align: center; vertical-align: top; padding: 3px 2px; font-size: 10px; border-bottom: 1px dotted #ccc;">${it.productCode || '—'}</td>
            <td style="text-align: center; vertical-align: top; padding: 3px 2px; font-weight: bold; border-bottom: 1px dotted #ccc;">${it.quantity} ${it.unit || ''}</td>
            <td style="text-align: right; vertical-align: top; padding: 3px 3px; border-bottom: 1px dotted #ccc;">₹${it.rate.toFixed(2)}</td>
            <td style="text-align: right; vertical-align: top; padding: 3px 2px; font-weight: bold; border-bottom: 1px dotted #ccc;">₹${it.lineTotal.toFixed(2)}</td>
          </tr>
        `;
      } else {
        return `
          <tr>
            <td style="text-align: center; vertical-align: top; padding: 2px 0; border-bottom: 1px dotted #ccc;">${idx + 1}</td>
            <td style="vertical-align: top; padding: 2px 3px; border-bottom: 1px dotted #ccc;">
              <div style="font-weight: bold;">${it.productName}</div>
              ${it.discountAmount > 0 ? `<div style="font-size: 9px; color: #555;">Disc: -₹${it.discountAmount.toFixed(2)}</div>` : ''}
            </td>
            <td style="text-align: center; vertical-align: top; padding: 2px 2px; font-weight: bold; border-bottom: 1px dotted #ccc;">${it.quantity} ${it.unit || ''}</td>
            <td style="text-align: right; vertical-align: top; padding: 2px 2px; border-bottom: 1px dotted #ccc;">₹${it.rate.toFixed(2)}</td>
            <td style="text-align: right; vertical-align: top; padding: 2px 0; font-weight: bold; border-bottom: 1px dotted #ccc;">₹${it.lineTotal.toFixed(2)}</td>
          </tr>
        `;
      }
    })
    .join('');

  return `
    <div style="width: 100%; max-width: ${paperWidthMm}mm; margin: 0 auto; font-family: 'Courier New', Courier, monospace, monospace; font-size: 11px; line-height: 1.25; color: #000; background: #fff; padding: 4px ${is4Inch ? '6px' : '3px'};">
      <!-- Store Header -->
      <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 4px; margin-bottom: 5px;">
        <div style="font-size: ${is4Inch ? '15px' : '13px'}; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">${storeName}</div>
        ${storeTamil ? `<div style="font-size: 11px; font-weight: bold;">${storeTamil}</div>` : ''}
        ${storeSubtitle ? `<div style="font-size: 10px;">${storeSubtitle}</div>` : ''}
        <div style="font-size: 10px; margin-top: 1px;">${storeAddress}</div>
        <div style="font-size: 10px; font-weight: bold;">Ph: ${storePhone}</div>
        <div style="font-size: 10.5px; font-weight: 900; margin-top: 1px; letter-spacing: 0.5px;">GSTIN/UIN: ${storeGstin}</div>
        <div style="font-size: 11px; font-weight: 900; margin-top: 3px; border: 1.5px solid #000; display: inline-block; padding: 2px 10px; background: #f9f9f9; text-transform: uppercase; letter-spacing: 0.5px;">
          ESTIMATE / QUOTATION (மதிப்பீடு)
        </div>
      </div>

      <!-- Estimate Metadata & Customer Info -->
      <div style="border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 5px; font-size: 11px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>EST NO: <strong>${estimate.estimateNumber}</strong></span>
          <span>DATE: ${dateStr} ${timeStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 2px;">
          <span>CUSTOMER: <strong>${estimate.customerName}</strong></span>
          ${estimate.customerMobile ? `<span>MOB: ${estimate.customerMobile}</span>` : ''}
        </div>
        ${estimate.validUntil ? `
          <div style="margin-top: 1px; font-size: 10px; color: #444;">
            <span>VALID UNTIL: ${new Date(estimate.validUntil).toLocaleDateString('en-IN')}</span>
          </div>
        ` : ''}
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; border-bottom: 2px dashed #000; margin-bottom: 5px;">
        <thead>
          <tr style="border-bottom: 2px solid #000; font-weight: bold; text-transform: uppercase; font-size: 10px;">
            ${is4Inch ? `
              <th style="width: 6%; text-align: center; padding: 2px 1px;">#</th>
              <th style="width: 44%; text-align: left; padding: 2px 4px;">ITEM DESCRIPTION</th>
              <th style="width: 12%; text-align: center; padding: 2px 2px;">CODE</th>
              <th style="width: 12%; text-align: center; padding: 2px 2px;">QTY</th>
              <th style="width: 12%; text-align: right; padding: 2px 3px;">RATE</th>
              <th style="width: 14%; text-align: right; padding: 2px 2px;">TOTAL</th>
            ` : `
              <th style="width: 8%; text-align: center; padding: 2px 0;">#</th>
              <th style="width: 44%; text-align: left; padding: 2px 3px;">ITEM</th>
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
      <div style="font-size: 11px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; background: #f4f4f4; padding: 3px 5px; border: 1px dotted #000; margin-bottom: 3px;">
          <span>TOTAL ITEMS: ${estimate.items.length}</span>
          <span>TOTAL QTY: ${totalQty}</span>
        </div>

        ${estimate.billDiscount > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 1px 2px;">
            <span>Discount:</span>
            <span style="font-weight: bold;">-₹${estimate.billDiscount.toFixed(2)}</span>
          </div>
        ` : ''}

        ${estimate.totalTaxAmount > 0 ? `
          <div style="border-top: 1px dotted #888; border-bottom: 1px dotted #888; padding: 2px; margin: 2px 0; font-size: 10px;">
            <div style="display: flex; justify-content: space-between;">
              <span>Taxable Value:</span>
              <span>₹${estimate.taxableAmount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; padding-top: 1px;">
              <span>Total GST:</span>
              <span>₹${estimate.totalTaxAmount.toFixed(2)}</span>
            </div>
          </div>
        ` : ''}

        ${Math.abs(estimate.roundOff) > 0.001 ? `
          <div style="display: flex; justify-content: space-between; font-size: 10.5px; padding: 1px 2px;">
            <span>Round Off:</span>
            <span>₹${estimate.roundOff.toFixed(2)}</span>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; font-size: ${is4Inch ? '17px' : '15px'}; font-weight: 900; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 2px; margin: 4px 0;">
          <span>ESTIMATE TOTAL:</span>
          <span>₹${estimate.grandTotal.toFixed(2)}</span>
        </div>
      </div>

      <!-- Footer message -->
      <div style="text-align: center; margin-top: 6px; border-top: 2px dashed #000; padding-top: 5px;">
        <div style="font-weight: bold; font-size: 10.5px; text-transform: uppercase;">*** ESTIMATE / QUOTATION ONLY ***</div>
        <div style="font-size: 9.5px; color: #333; margin-top: 2px;">Prices valid for 15 days · Not a Tax Invoice</div>
        <div style="font-weight: bold; font-size: 10.5px; margin-top: 3px;">*** THANK YOU, VISIT AGAIN! ***</div>
        <div style="font-family: monospace; letter-spacing: 3px; font-size: 10px; margin-top: 3px;">
          ||| | ||||| || |||| ||| |||||||
        </div>
      </div>
    </div>
  `;
}

