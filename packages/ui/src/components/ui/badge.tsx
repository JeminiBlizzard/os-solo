import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 rounded-none',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-gray-20 text-gray-100 shadow',
        brand:
          'border-transparent bg-brand text-white shadow',
        ai:
          'border-transparent bg-ai text-white shadow',
        outline: 'text-gray-100 border-gray-40',
        secondary:
          'border-transparent bg-gray-40 text-gray-100 shadow',
        destructive:
          'border-transparent bg-red-600 text-white shadow',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
