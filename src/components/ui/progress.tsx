import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '../../lib/utils';

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorColor?: string;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, indicatorColor = 'bg-white', ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn('relative h-3 w-full overflow-hidden rounded-full bg-white/20', className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn('h-full transition-all duration-150', indicatorColor)}
      style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = 'Progress';
export { Progress };
