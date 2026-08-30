import { useMemo, useRef, useState, type ReactNode } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import type { Invoice, InvoiceLineItem, SavedClient } from '../lib/types';
import { currentMonthKey, formatCurrency, invoiceTotal, monthLabel } from '../lib/calculations';
import { uid } from '../lib/storage';
import { ComputedCurrency, CurrencyInput, TextInput } from './inputs';

interface Props {
  invoiceNumber: number;
  savedClients: SavedClient[];
  onClose: () => void;
  onSave: (invoice: Invoice) => void;
  onSaveDetails: (client: SavedClient) => void;
  onDeleteSavedClient: (id: string) => void;
}

function todayIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function RemovableField({
  visible,
  onRemove,
  onAdd,
  addLabel,
  children,
}: {
  visible: boolean;
  onRemove: () => void;
  onAdd: () => void;
  addLabel: string;
  children: ReactNode;
}) {
  if (!visible) {
    return (
      <button onClick={onAdd} data-html2canvas-ignore="true" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
        {addLabel}
      </button>
    );
  }
  return (
    <div className="group flex items-start gap-1">
      <div className="flex-1 min-w-0">{children}</div>
      <button
        onClick={onRemove}
        data-html2canvas-ignore="true"
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity text-xs shrink-0 mt-1"
        aria-label="Remove field"
      >
        ✕
      </button>
    </div>
  );
}

export default function CreateInvoiceModal({ invoiceNumber, savedClients, onClose, onSave, onSaveDetails, onDeleteSavedClient }: Props) {
  const [number] = useState(String(invoiceNumber).padStart(3, '0'));
  const [date, setDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(todayIso(14));
  const [fromName, setFromName] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [toName, setToName] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [showFromAddress, setShowFromAddress] = useState(true);
  const [showFromEmail, setShowFromEmail] = useState(true);
  const [showToAddress, setShowToAddress] = useState(true);
  const [showToEmail, setShowToEmail] = useState(true);
  const [items, setItems] = useState<InvoiceLineItem[]>([{ id: uid(), description: '', qty: 1, rate: 0 }]);
  const [qrMissing, setQrMissing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [grossCalculatorEnabled, setGrossCalculatorEnabled] = useState(true);
  const [calcMonth, setCalcMonth] = useState(monthLabel(currentMonthKey()));
  const [calcTotalRevenue, setCalcTotalRevenue] = useState(0);
  const [calcProcessingFees, setCalcProcessingFees] = useState(0);
  const [calcRefunds, setCalcRefunds] = useState(0);
  const [calcPercent, setCalcPercent] = useState(0);

  const printRef = useRef<HTMLDivElement>(null);

  const grossCollectedRevenue = calcTotalRevenue - calcProcessingFees - calcRefunds;
  const grossRevenueShareAmount = grossCalculatorEnabled
    ? grossCollectedRevenue * (calcPercent / 100)
    : calcTotalRevenue;
  const grossRevenueShareLabel = grossCalculatorEnabled
    ? `${calcMonth} — ${calcPercent}% of gross collected revenue`
    : `${calcMonth} — Total Revenue`;

  const itemsTotal = useMemo(() => items.reduce((sum, i) => sum + i.qty * i.rate, 0), [items]);
  const total = invoiceTotal({ items, grossRevenueShareAmount });

  const updateItem = (id: string, patch: Partial<InvoiceLineItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addItem = () => setItems((prev) => [...prev, { id: uid(), description: '', qty: 1, rate: 0 }]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  const loadSavedClient = (c: SavedClient) => {
    setFromName(c.fromName);
    setFromAddress(c.fromAddress);
    setFromEmail(c.fromEmail);
    setToName(c.toName);
    setToAddress(c.toAddress);
    setToEmail(c.toEmail);
    setShowFromAddress(true);
    setShowFromEmail(true);
    setShowToAddress(true);
    setShowToEmail(true);
    setItems(c.items.map((it) => ({ ...it, id: uid() })));
  };

  const handleSaveDetails = () => {
    onSaveDetails({
      id: uid(),
      name: toName.trim() || 'Unnamed client',
      fromName,
      fromAddress: showFromAddress ? fromAddress : '',
      fromEmail: showFromEmail ? fromEmail : '',
      toName,
      toAddress: showToAddress ? toAddress : '',
      toEmail: showToEmail ? toEmail : '',
      items: items.map(({ description, qty, rate }) => ({ id: uid(), description, qty, rate })),
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const node = printRef.current;
      if (node) {
        // html2canvas's default text layout engine mis-measures line-height and
        // fails to wrap long text (clips names/dates, overflows addresses), and
        // it can't reliably capture content nested inside our fixed + scrollable
        // modal backdrop. foreignObjectRendering fixes the text layout (it uses
        // the browser's real rendering instead of html2canvas's approximation),
        // but only works on content that's positioned on-screen, so we render
        // from a clone placed behind the modal (same position, lower z-index)
        // rather than off-screen.
        const width = node.scrollWidth;
        const height = node.scrollHeight;
        // A few px of slack on the capture canvas (not the wrapper's layout
        // width, which must stay equal to `width` so text wraps identically
        // to the live modal) — foreignObjectRendering measures text via the
        // browser's real layout, but occasionally renders a hair wider than
        // the live DOM, and without this the far edge (e.g. the invoice
        // total) gets clipped instead of just leaving blank margin.
        const captureWidth = width + 16;
        const captureHeight = height + 16;
        const clone = node.cloneNode(true) as HTMLElement;
        const origFields = node.querySelectorAll('input, textarea');
        const cloneFields = clone.querySelectorAll('input, textarea');
        origFields.forEach((orig, i) => {
          const target = cloneFields[i] as HTMLInputElement | HTMLTextAreaElement;
          target.value = (orig as HTMLInputElement | HTMLTextAreaElement).value;
        });

        // foreignObjectRendering can't rasterize a nested <img> at all (even as
        // a data URI) — it's a documented limitation of SVG foreignObject
        // compositing. So we hide images in the clone (they'd draw as broken-
        // image icons otherwise) and composite the real ones back onto the
        // finished canvas ourselves afterward with a plain drawImage call.
        const nodeRect = node.getBoundingClientRect();
        const origImages = Array.from(node.querySelectorAll('img'));
        const cloneImages = clone.querySelectorAll('img');
        const imagePlacements = origImages.map((orig, i) => {
          const imgEl = orig as HTMLImageElement;
          const rect = imgEl.getBoundingClientRect();
          (cloneImages[i] as HTMLElement).style.visibility = 'hidden';
          return {
            img: imgEl,
            x: rect.left - nodeRect.left,
            y: rect.top - nodeRect.top,
            w: rect.width,
            h: rect.height,
            ready: imgEl.complete && imgEl.naturalWidth > 0,
          };
        });

        const wrapper = document.createElement('div');
        wrapper.style.position = 'fixed';
        wrapper.style.top = '0';
        wrapper.style.left = '0';
        wrapper.style.width = `${width}px`;
        wrapper.style.zIndex = '1';
        wrapper.style.background = '#ffffff';
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        const canvas = await html2canvas(clone, {
          scale: 2,
          backgroundColor: '#ffffff',
          width: captureWidth,
          height: captureHeight,
          windowWidth: width,
          windowHeight: height,
          foreignObjectRendering: true,
        });

        document.body.removeChild(wrapper);

        const ctx = canvas.getContext('2d');
        // html2canvas-pro leaves its own scale transform (e.g. [2,0,0,2,0,0]
        // for scale:2) applied to the context after rendering, which would
        // silently double our own scale multiplication below and place the
        // image off-canvas.
        ctx?.setTransform(1, 0, 0, 1, 0, 0);
        // Divide by captureWidth (not width) since that's what canvas.width
        // was actually derived from — dividing by the un-padded width would
        // overstate the scale by the buffer fraction and misplace the QR image.
        const scale = canvas.width / captureWidth;
        for (const placement of imagePlacements) {
          if (!placement.ready) continue;
          ctx?.drawImage(placement.img, placement.x * scale, placement.y * scale, placement.w * scale, placement.h * scale);
        }

        const imgData = canvas.toDataURL('image/png');
        // Leave a plain white margin around the invoice so it isn't cropped
        // edge-to-edge (which reads as "zoomed in" when opened/printed).
        const margin = 24 * scale;
        const pdfWidth = canvas.width + margin * 2;
        const pdfHeight = canvas.height + margin * 2;
        // jsPDF defaults to portrait and silently swaps a landscape [w, h]
        // format array to enforce it, which desyncs the page from the image
        // placed with the original (unswapped) dimensions. Setting the
        // orientation explicitly to match the page prevents that swap.
        const orientation = pdfWidth > pdfHeight ? 'l' : 'p';
        const pdf = new jsPDF({ orientation, unit: 'px', format: [pdfWidth, pdfHeight] });
        pdf.setFillColor('#ffffff');
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        pdf.addImage(imgData, 'PNG', margin, margin, canvas.width, canvas.height);
        pdf.save(`invoice-${number}.pdf`);
      }
      onSave({
        id: uid(),
        number,
        date,
        dueDate,
        fromName,
        fromAddress: showFromAddress ? fromAddress : '',
        fromEmail: showFromEmail ? fromEmail : '',
        toName,
        toAddress: showToAddress ? toAddress : '',
        toEmail: showToEmail ? toEmail : '',
        items,
        grossRevenueShareLabel,
        grossRevenueShareAmount,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center overflow-y-auto p-6 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8 p-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {savedClients.length > 0 && <span className="text-xs text-gray-400">Saved clients:</span>}
            {savedClients.map((c) => (
              <span
                key={c.id}
                className="group flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <button onClick={() => loadSavedClient(c)} className="text-xs font-medium text-gray-700">
                  {c.name}
                </button>
                <button
                  onClick={() => onDeleteSavedClient(c.id)}
                  className="text-gray-400 hover:text-red-500 text-xs leading-none w-4 h-4 flex items-center justify-center rounded-full transition-colors"
                  aria-label={`Delete saved client ${c.name}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4 flex-wrap shrink-0">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-500 cursor-pointer select-none">
              Gross Collected Revenue Calculator
              <button
                type="button"
                role="switch"
                aria-checked={grossCalculatorEnabled}
                onClick={() => setGrossCalculatorEnabled((v) => !v)}
                className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                  grossCalculatorEnabled ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                    grossCalculatorEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </label>
            <button
              onClick={handleSaveDetails}
              className="text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
            >
              Save details
            </button>
          </div>
        </div>

        <div ref={printRef} className="bg-white">
          <div className="flex items-start justify-between mb-8">
            <div className="grid grid-cols-3 gap-8 flex-1">
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Invoice Number</div>
                <div className="text-sm text-gray-800">#{number}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Invoice Date</div>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm text-gray-800 outline-none focus:bg-indigo-50 rounded px-1 -mx-1" />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Due Date</div>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="text-sm text-gray-800 outline-none focus:bg-indigo-50 rounded px-1 -mx-1" />
              </div>
            </div>
            <button onClick={onClose} data-html2canvas-ignore="true" className="text-gray-400 hover:text-gray-700 text-lg ml-4" aria-label="Close">
              ✕
            </button>
          </div>

          <hr className="border-gray-200 mb-8" />

          <div className="grid grid-cols-2 gap-8 mb-10">
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2">From</div>
              <TextInput value={fromName} onChange={setFromName} className="block w-full text-base font-semibold text-gray-900 mb-1" />
              <div className="space-y-1">
                <RemovableField visible={showFromAddress} onRemove={() => setShowFromAddress(false)} onAdd={() => setShowFromAddress(true)} addLabel="+ Add address">
                  <textarea
                    value={fromAddress}
                    onChange={(e) => setFromAddress(e.target.value)}
                    placeholder="Address"
                    rows={2}
                    className="block w-full text-sm text-gray-600 outline-none focus:bg-indigo-50 rounded px-1 -mx-1 resize-none"
                  />
                </RemovableField>
                <RemovableField visible={showFromEmail} onRemove={() => setShowFromEmail(false)} onAdd={() => setShowFromEmail(true)} addLabel="+ Add email">
                  <TextInput value={fromEmail} onChange={setFromEmail} className="block w-full text-sm text-indigo-600" />
                </RemovableField>
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2">To</div>
              <TextInput value={toName} onChange={setToName} className="block w-full text-base font-semibold text-gray-900 mb-1" />
              <div className="space-y-1">
                <RemovableField visible={showToAddress} onRemove={() => setShowToAddress(false)} onAdd={() => setShowToAddress(true)} addLabel="+ Add address">
                  <textarea
                    value={toAddress}
                    onChange={(e) => setToAddress(e.target.value)}
                    placeholder="Address"
                    rows={2}
                    className="block w-full text-sm text-gray-600 outline-none focus:bg-indigo-50 rounded px-1 -mx-1 resize-none"
                  />
                </RemovableField>
                <RemovableField visible={showToEmail} onRemove={() => setShowToEmail(false)} onAdd={() => setShowToEmail(true)} addLabel="+ Add email">
                  <TextInput value={toEmail} onChange={setToEmail} className="block w-full text-sm text-indigo-600" />
                </RemovableField>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="text-xs font-medium text-gray-500 mb-2">
              {grossCalculatorEnabled ? 'Gross Collected Revenue Calculator' : 'Total Revenue'}
            </div>
            <div className="border border-gray-200 rounded-lg bg-gray-50/60 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm pb-2 border-b border-gray-200">
                <span className="text-gray-700">Month</span>
                <TextInput value={calcMonth} onChange={setCalcMonth} className="w-32 text-sm text-gray-900 text-right" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">Total Revenue</span>
                <div className="w-32">
                  <CurrencyInput value={calcTotalRevenue} onChange={setCalcTotalRevenue} />
                </div>
              </div>
              {grossCalculatorEnabled && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Less: Processing Fees</span>
                    <div className="w-32">
                      <CurrencyInput value={calcProcessingFees} onChange={setCalcProcessingFees} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Less: Refunds</span>
                    <div className="w-32">
                      <CurrencyInput value={calcRefunds} onChange={setCalcRefunds} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="font-semibold text-gray-900">Gross Collected Revenue</span>
                    <div className="w-32">
                      <ComputedCurrency value={formatCurrency(grossCollectedRevenue)} bold />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-700 flex items-center gap-1">
                      Percentage of Gross
                      <input
                        type="number"
                        step="0.1"
                        value={calcPercent}
                        onChange={(e) => setCalcPercent(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-14 bg-transparent border-b border-gray-300 outline-none focus:bg-indigo-50 rounded px-1 text-gray-600 text-center"
                      />
                      %
                    </span>
                    <div className="w-32">
                      <ComputedCurrency value={formatCurrency(grossRevenueShareAmount)} bold />
                    </div>
                  </div>
                </>
              )}
              <p className="text-xs text-gray-400 pt-1" data-html2canvas-ignore="true">
                Automatically added to the invoice total below as “{grossRevenueShareLabel}”.
              </p>
            </div>
          </div>

          <div className="mb-8">
            <div className="text-xs font-medium text-gray-500 mb-2">Software Costs</div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_80px_110px_110px_28px] bg-gray-50 text-xs font-medium text-gray-500 px-3 py-2">
                <div>Description</div>
                <div className="text-right">Qty</div>
                <div className="text-right">Rate</div>
                <div className="text-right">Total</div>
                <div />
              </div>
              {items.map((it) => (
                <div key={it.id} className="group grid grid-cols-[1fr_80px_110px_110px_28px] items-center px-3 py-2 border-t border-gray-100">
                  <TextInput value={it.description} onChange={(v) => updateItem(it.id, { description: v })} className="text-sm text-gray-800" />
                  <input
                    type="number"
                    value={it.qty}
                    onChange={(e) => updateItem(it.id, { qty: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    onFocus={(e) => e.target.select()}
                    className="text-sm text-right bg-transparent outline-none focus:bg-indigo-50 rounded px-1"
                  />
                  <CurrencyInput value={it.rate} onChange={(v) => updateItem(it.id, { rate: v })} />
                  <div className="text-sm text-right text-gray-800 px-1">{formatCurrency(it.qty * it.rate)}</div>
                  <button
                    onClick={() => removeItem(it.id)}
                    data-html2canvas-ignore="true"
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity text-xs justify-self-end"
                    aria-label="Remove line item"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addItem} data-html2canvas-ignore="true" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-2">
              + New line item
            </button>
          </div>

          <div className="grid grid-cols-2 gap-8 items-end">
            <div>
              {qrMissing ? (
                <div className="w-28 h-28 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-center px-2">
                  <span className="text-[10px] text-gray-400">Add payment-qr.png to /public</span>
                </div>
              ) : (
                // needs to be a real <img> so html2canvas-pro's export codepath can read/replace it
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/payment-qr.png"
                  alt="Payment QR code"
                  className="w-28 h-28 rounded-2xl border border-gray-200 object-cover"
                  onError={() => setQrMissing(true)}
                />
              )}
            </div>
            <div>
              {grossRevenueShareAmount !== 0 && (
                <div className="mb-3 text-sm">
                  <div className="grid grid-cols-[1fr_90px] gap-2 py-0.5">
                    <span className="text-gray-500 text-left">Software costs</span>
                    <span className="text-gray-700 text-right">{formatCurrency(itemsTotal)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_90px] gap-2 py-0.5">
                    <span className="text-gray-500 text-left">{grossRevenueShareLabel}</span>
                    <span className="text-gray-700 text-right">{formatCurrency(grossRevenueShareAmount)}</span>
                  </div>
                </div>
              )}
              <div className="text-xs font-medium text-gray-500 mb-1 text-right">Total</div>
              <div className="text-3xl font-bold text-gray-900 text-right">{formatCurrency(total)}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-10">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg shadow-sm transition-colors"
          >
            {isSaving ? 'Saving…' : 'Save Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
