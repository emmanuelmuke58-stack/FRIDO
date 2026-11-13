import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, X, ShieldAlert, AlertCircle } from 'lucide-react';
import { cn, extractErrorMessage } from '../../lib/utils';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string, isPermanentDelete?: boolean) => Promise<void> | void;
  title: string;
  description: string;
  itemName?: string;
  confirmLabel?: string;
  isPermanent?: boolean;
  allowPermanentOption?: boolean;
  requireTypeDelete?: boolean;
  showReasonInput?: boolean;
  reasonRequired?: boolean;
  extraContent?: React.ReactNode;
  disableConfirm?: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  confirmLabel = 'Delete',
  isPermanent = false,
  allowPermanentOption = false,
  requireTypeDelete = false,
  showReasonInput = true,
  reasonRequired = false,
  extraContent,
  disableConfirm = false,
}: DeleteConfirmModalProps) {
  const [typedText, setTypedText] = useState('');
  const [reason, setReason] = useState('');
  const [permanentChosen, setPermanentChosen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTypedText('');
      setReason('');
      setPermanentChosen(false);
      setSubmitting(false);
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const effectivePermanent = isPermanent || permanentChosen;
  const effectiveRequireTypeDelete = requireTypeDelete || (allowPermanentOption && permanentChosen);
  const isTypeValid = !effectiveRequireTypeDelete || typedText.trim() === 'DELETE';
  const isReasonValid = !reasonRequired || reason.trim().length > 0;
  const canConfirm = isTypeValid && isReasonValid && !disableConfirm && !submitting;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirm(reason.trim() || undefined, effectivePermanent);
      onClose();
    } catch (err) {
      setErrorMsg(extractErrorMessage(err, 'Unable to delete record. Please verify permissions and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-3 sm:gap-4 bg-red-50/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
              {effectivePermanent ? <ShieldAlert size={20} /> : <Trash2 size={20} />}
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-[#102B4E]">{title}</h3>
              {itemName && (
                <p className="text-xs font-bold text-red-600 mt-0.5 line-clamp-2 sm:line-clamp-1 break-words">"{itemName}"</p>
              )}
            </div>
          </div>
          <button
            type="button" onClick={onClose}
            disabled={submitting}
            className="min-w-[36px] min-h-[36px] p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors flex items-center justify-center flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 overflow-y-auto">
          <p className="text-sm text-slate-600 leading-relaxed">{description}</p>

          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 font-semibold">
              <AlertCircle size={17} className="flex-shrink-0 text-red-600 mt-0.5"/>
              <span>{errorMsg}</span>
            </div>
          )}

          {allowPermanentOption && !isPermanent && (
            <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 cursor-pointer select-none">
              <input
                type="checkbox" checked={permanentChosen}
                onChange={(e) => {
                  setPermanentChosen(e.target.checked);
                  setTypedText('');
                  setErrorMsg(null);
                }}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500"/>
              <div className="text-xs">
                <p className="font-bold text-[#102B4E]">Permanently delete immediately (bypass Trash)</p>
                <p className="text-slate-500 mt-0.5">
                  Leave unchecked to safely move to Trash / Recycle Bin where it can be inspected or restored.
                </p>
              </div>
            </label>
          )}

          {effectivePermanent && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-700 font-medium">
              <AlertTriangle size={18} className="flex-shrink-0 text-red-600 mt-0.5"/>
              <span>
                <strong>Permanent Deletion:</strong> This record will be permanently removed from the database. Recovery is unavailable.
              </span>
            </div>
          )}

          {extraContent}

          {showReasonInput && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Deletion Reason {reasonRequired ? '(Required)': '(Optional for Audit Log)'}
              </label>
              <input
                type="text" value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Duplicate listing, expired, policy update..." className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-red-400"/>
            </div>
          )}

          {effectiveRequireTypeDelete && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Type <span className="font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded">DELETE</span> to confirm
              </label>
              <input
                type="text" value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder="DELETE" className="w-full px-3.5 py-2.5 bg-slate-50 border border-red-200 rounded-xl text-sm font-mono focus:outline-none focus:border-red-500"/>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3">
          <button
            type="button" onClick={onClose}
            disabled={submitting}
            className="min-h-[44px] px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all">
            Cancel
          </button>
          <button
            type="button" onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              "min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg",
              canConfirm
                ? "bg-red-600 hover:bg-red-700 shadow-red-600/20": "bg-red-300 cursor-not-allowed shadow-none")}
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
            ) : (
              <Trash2 size={16} />
            )}
            {permanentChosen ? 'Permanently Delete': confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
