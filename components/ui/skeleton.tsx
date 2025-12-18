import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200", className)}
      {...props}
    />
  );
}

function TestCardSkeleton() {
  return (
    <div className="bg-white border rounded-lg p-5 shadow-sm">
      <div className="mb-3">
        <Skeleton className="h-6 w-3/4 mb-1" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="mb-3">
        <Skeleton className="h-3 w-1/4 mb-1" />
        <Skeleton className="h-3 w-full mb-1" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      <div className="pt-3 border-t border-gray-200">
        <Skeleton className="h-3 w-1/3 mb-2" />
        <Skeleton className="h-16 w-full rounded" />
      </div>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <Skeleton className="h-6 w-1/4 mb-2" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-5/6 mb-1" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  );
}

function LoadingState({
  message = "Loading...",
  showSkeleton = true,
  className
}: {
  message?: string;
  showSkeleton?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center h-full py-12", className)}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-gray-600 text-sm">{message}</p>
      {showSkeleton && (
        <div className="mt-8 space-y-4 w-full max-w-2xl">
          <SummarySkeleton />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <TestCardSkeleton key={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { Skeleton, TestCardSkeleton, SummarySkeleton, LoadingState };
