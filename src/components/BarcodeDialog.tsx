import React, { useState } from 'react';
import { X, Printer, Barcode as BarcodeIcon, Check } from 'lucide-react';
import { Product } from '../types';
import { SVTLogo } from './SVTLogo';

interface BarcodeDialogProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BarcodeDialog: React.FC<BarcodeDialogProps> = ({
  product,
  isOpen,
  onClose,
}) => {
  const [copies, setCopies] = useState<number>(1);
  const [printedAlert, setPrintedAlert] = useState(false);
  const [format, setFormat] = useState<'37x20' | '50x25'>('37x20');

  if (!isOpen || !product) return null;

  const handlePrint = () => {
    setPrintedAlert(true);
    setTimeout(() => {
      setPrintedAlert(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#173e65] to-[#255a90] text-white px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <SVTLogo size={20} />
            <h3 className="text-xs font-semibold">Barcode Studio — Sri Venkateswara Label Print</h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5 text-xs">
          {/* Format Selector */}
          <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200">
            <span className="font-semibold text-slate-700">Label Format:</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setFormat('37x20')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                  format === '37x20'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300'
                }`}
              >
                3.7cm × 2.0cm (5×13 Sheet)
              </button>
              <button
                type="button"
                onClick={() => setFormat('50x25')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                  format === '50x25'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300'
                }`}
              >
                50mm × 25mm (Roll)
              </button>
            </div>
          </div>

          {/* Label Preview */}
          <div>
            <span className="font-semibold text-slate-700 block mb-1.5">
              {format === '37x20' ? '3.7cm × 2.0cm (65-Up Sheet)' : '50mm × 25mm Thermal'} Sticker Preview
            </span>
            <div className="border-2 border-dashed border-slate-300 p-4 rounded bg-slate-100 flex justify-center">
              <div
                className={`bg-white border border-slate-400 rounded-xs p-2 flex flex-col justify-between shadow-xs select-none ${
                  format === '37x20' ? 'w-56 h-28' : 'w-64 h-32'
                }`}
              >
                {/* Store Name & SVT Logo */}
                <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <SVTLogo size={14} className="shrink-0" />
                    <span className="font-bold text-[9.5px] text-slate-900 uppercase tracking-tight truncate">
                      Sri Venkateswara (SVT)
                    </span>
                  </div>
                  <span className="font-mono font-bold text-xs text-slate-900 shrink-0">
                    ₹{product.saleRate.toFixed(2)}
                  </span>
                </div>

                {/* Product Name En & Ta */}
                <div className="my-0.5">
                  <div className="font-bold text-[10.5px] text-slate-900 leading-tight truncate">
                    {product.nameEn}
                  </div>
                  {product.nameTa && (
                    <div className="text-[9.5px] text-slate-600 font-sans leading-tight truncate">
                      {product.nameTa}
                    </div>
                  )}
                </div>

                {/* Barcode Graphic */}
                <div className="flex flex-col items-center">
                  <div className="h-7 w-full flex items-center justify-center gap-[1.5px] px-2 overflow-hidden bg-white">
                    {product.barcode.split('').map((char, i) => {
                      const code = char.charCodeAt(0);
                      const widths = [1, 2, 3, 1, 2];
                      const w = widths[code % 5];
                      return (
                        <div
                          key={i}
                          className="bg-black h-full"
                          style={{ width: `${w}px` }}
                        />
                      );
                    })}
                  </div>
                  <div className="font-mono text-[9px] text-slate-800 tracking-widest font-semibold mt-0.5">
                    {product.barcode}
                  </div>
                </div>

                {/* Address & MRP */}
                <div className="flex justify-between items-center text-[8px] text-slate-500 border-t border-slate-200 pt-0.5 font-mono">
                  <span className="truncate max-w-[120px]">காஞ்சிபுரம் • 8143848143</span>
                  <span>MRP: ₹{product.mrp.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Print Copies */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <label className="font-medium text-slate-700">Number of Sticker Copies:</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 px-2 py-1 bg-white border border-slate-300 rounded text-center font-mono font-bold focus:outline-none focus:border-[#106ebe]"
            />
          </div>

          {printedAlert && (
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-300 p-2 rounded text-xs flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Sent {copies} label(s) to Windows Default Printer!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-4 py-2.5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-medium text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            disabled={printedAlert}
            className="px-4 py-1.5 bg-[#106ebe] hover:bg-[#005a9e] text-white rounded font-semibold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print {copies} Label{copies > 1 ? 's' : ''}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
