import { cn } from '@/lib/utils';

interface StatusDotProps {
  status: 'healthy' | 'degraded' | 'offline' | 'unknown';
  className?: string;
}

export function StatusDot({ status, className }: StatusDotProps) {
  const colorClass = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    offline: 'bg-red-500',
    unknown: 'bg-gray-400',
  }[status];

  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full',
        colorClass,
        className
      )}
      aria-label={`Status: ${status}`}
    />
  );
}
