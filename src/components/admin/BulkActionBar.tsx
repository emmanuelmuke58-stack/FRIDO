import React from 'react';
import { Trash2, CheckSquare, RotateCcw, CheckCircle2, AlertCircle, X, ArrowRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';

export interface FeedbackState {
  type: 'success'| 'error'| 'warning';
  message: string;
  details?: string[];
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
}

export function ActionFeedbackBanner({
  feedback,
  onDismiss,
}: {
  feedback: FeedbackState | null;
  onDismiss: () => void;
}) {
  if (!feedback) return null;

  return (
    <div
      className={cn(
        "p-4 rounded-2xl border flex items-start justify-between gap-4 animate-in fade-in duration-300",
        feedback.type === 'success'&& "bg-emerald-50 border-emerald-200 text-emerald-800",
        feedback.type === 'warning'&& "bg-amber-50 border-amber-200 text-amber-800",
        feedback.type === 'error'&& "bg-red-50 border-red-200 text-red-800")}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {feedback.type === 'success'? (
          <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5"/>
        ) : (
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5"/>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-bold">{feedback.message}</p>
            {feedback.actionLabel && feedback.onAction && (
              <button
                type="button" onClick={feedback.onAction}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white border border-current/20 text-xs font-bold transition-all">
                {feedback.actionLabel} <ArrowRight size={12} />
              </button>
            )}
            {feedback.actionLabel && feedback.actionTo && !feedback.onAction && (
              <NavLink
                to={feedback.actionTo}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white border border-current/20 text-xs font-bold transition-all">
                {feedback.actionLabel} <ArrowRight size={12} />
              </NavLink>
            )}
          </div>
          {feedback.details && feedback.details.length > 0 && (
            <ul className="mt-1.5 text-xs space-y-0.5 list-disc list-inside opacity-90">
              {feedback.details.slice(0, 5).map((d, idx) => (
                <li key={idx}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <button onClick={onDismiss} className="p-1 opacity-60 hover:opacity-100">
        <X size={16} />
      </button>
    </div>
  );
}

interface BulkActionBarProps {
  selectedCount: number;
  pageCount: number;
  totalFilteredCount: number;
  allFilteredSelected: boolean;
  onSelectPage: (checked: boolean) => void;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  bulkDeleteLabel?: string;
  onBulkRestore?: () => void;
  canDelete?: boolean;
}

export function BulkActionBar({
  selectedCount,
  pageCount,
  totalFilteredCount,
  allFilteredSelected,
  onSelectPage,
  onSelectAllFiltered,
  onClearSelection,
  onBulkDelete,
  bulkDeleteLabel = 'Delete Selected',
  onBulkRestore,
  canDelete = true,
}: BulkActionBarProps) {
  if (totalFilteredCount === 0) return null;

  return (
    <div className="bg-white px-4 sm:px-5 py-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-3 sm:gap-4">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <label className="inline-flex items-center gap-2.5 text-xs font-bold text-slate-600 cursor-pointer select-none min-h-[36px]">
          <input
            type="checkbox" checked={pageCount > 0 && selectedCount >= pageCount}
            onChange={(e) => onSelectPage(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-[#083D91] focus:ring-[#083D91]"/>
          Select Page ({pageCount})
        </label>

        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs">
            <span className="px-2.5 py-1 bg-[#083D91]/10 text-[#083D91] font-bold rounded-lg flex items-center gap-1.5">
              <CheckSquare size={14} /> {selectedCount} selected
            </span>
            {!allFilteredSelected && totalFilteredCount > selectedCount && (
              <button
                type="button" onClick={onSelectAllFiltered}
                className="font-bold text-teal-600 hover:underline py-1">
                Select all {totalFilteredCount} matching records
              </button>
            )}
            <button
              type="button" onClick={onClearSelection}
              className="text-slate-400 hover:text-slate-600 font-medium py-1">
              Clear
            </button>
          </div>
        )}
      </div>

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
          {onBulkRestore && (
            <button
              type="button" onClick={onBulkRestore}
              className="min-h-[40px] px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all">
              <RotateCcw size={15} /> Restore ({selectedCount})
            </button>
          )}
          {canDelete && (
            <button
              type="button" onClick={onBulkDelete}
              className="min-h-[40px] px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all">
              <Trash2 size={15} /> {bulkDeleteLabel} ({selectedCount})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
