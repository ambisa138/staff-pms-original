import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- KPI Progress Bar ---
export const KPIProgressBar = ({ value, target, label }: { value: number, target: number, label: string }) => {
  const percentage = target > 0 ? (value / target) * 100 : 0;
  const capped = Math.min(percentage, 100);
  
  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="text-xs font-bold text-primary">{Math.round(percentage)}%</span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full transition-all duration-500",
            percentage >= 100 ? "bg-green-500" : percentage >= 50 ? "bg-accent" : "bg-red-400"
          )}
          style={{ width: `${capped}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-400">Actual: {value}</span>
        <span className="text-[10px] text-slate-400">Target: {target}</span>
      </div>
    </div>
  );
};

// --- Status Chip ---
export const StatusChip = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    active: "bg-green-50 text-green-700 border-green-200",
    disabled: "bg-slate-50 text-slate-500 border-slate-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    submitted: "bg-blue-50 text-blue-700 border-blue-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    draft: "bg-slate-50 text-slate-500 border-slate-200",
  };

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider",
      styles[status.toLowerCase()] || styles.draft
    )}>
      {status}
    </span>
  );
};

// --- Dashboard Tile ---
export const ProgressTile = ({ label, percentage, trend }: { label: string, percentage: number, trend?: 'up' | 'down' }) => {
  return (
    <div className="card-premium flex flex-col justify-between h-32">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-primary">{Math.round(percentage)}%</span>
        {trend && (
          <span className={cn("text-xs font-bold", trend === 'up' ? "text-green-500" : "text-red-500")}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </div>
  );
};
