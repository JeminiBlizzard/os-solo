import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface MRRCardProps {
  title: string;
  value: number;
  delta?: number;
  deltaLabel?: string;
  format?: 'currency' | 'percent' | 'number';
  loading?: boolean;
}

function formatValue(value: number, format: 'currency' | 'percent' | 'number'): string {
  if (format === 'currency') {
    return `$${(value / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  if (format === 'percent') {
    return `${value.toFixed(1)}%`;
  }
  return value.toLocaleString();
}

export function MRRCard({
  title,
  value,
  delta,
  deltaLabel = 'vs last month',
  format = 'currency',
  loading = false,
}: MRRCardProps) {
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;
  const isNeutral = delta === undefined || delta === 0;

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-80 bg-gray-90 p-4">
        <div className="h-4 w-24 bg-gray-80 rounded animate-pulse mb-2" />
        <div className="h-8 w-32 bg-gray-80 rounded animate-pulse mb-2" />
        <div className="h-3 w-20 bg-gray-80 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-80 bg-gray-90 p-4">
      <div className="text-sm text-gray-50 mb-1">{title}</div>
      <div className="text-2xl font-semibold text-gray-10 mb-2">
        {formatValue(value, format)}
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1 text-sm">
          {isPositive && (
            <>
              <ArrowUp className="w-4 h-4 text-green-50" />
              <span className="text-green-50">
                {format === 'currency' ? formatValue(Math.abs(delta), 'currency') : `${Math.abs(delta).toFixed(1)}%`}
              </span>
            </>
          )}
          {isNegative && (
            <>
              <ArrowDown className="w-4 h-4 text-red-50" />
              <span className="text-red-50">
                {format === 'currency' ? formatValue(Math.abs(delta), 'currency') : `${Math.abs(delta).toFixed(1)}%`}
              </span>
            </>
          )}
          {isNeutral && (
            <>
              <Minus className="w-4 h-4 text-gray-50" />
              <span className="text-gray-50">No change</span>
            </>
          )}
          <span className="text-gray-50 ml-1">{deltaLabel}</span>
        </div>
      )}
    </div>
  );
}
