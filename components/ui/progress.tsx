import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  showPercentage?: boolean;
  color?: 'blue' | 'green' | 'orange' | 'red';
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, showPercentage = false, color = 'blue', ...props }, ref) => {
    const colorClasses = {
      blue: 'bg-blue-600',
      green: 'bg-green-600',
      orange: 'bg-orange-600',
      red: 'bg-red-600'
    };

    return (
      <div className="space-y-2">
        <div
          ref={ref}
          className={cn(
            "relative h-2 w-full overflow-hidden rounded-full bg-gray-200",
            className
          )}
          {...props}
        >
          <div
            className={cn(
              "h-full transition-all duration-300 ease-in-out",
              colorClasses[color]
            )}
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
        {showPercentage && (
          <div className="flex justify-between items-center text-xs text-gray-600">
            <span>Progress</span>
            <span>{Math.round(value)}%</span>
          </div>
        )}
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
