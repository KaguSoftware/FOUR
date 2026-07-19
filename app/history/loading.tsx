import { Bar, PageSkeleton } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="history">
      <div className="border-line mb-8 grid grid-cols-3 gap-4 border-b pb-6">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Bar w="w-12" h="h-6" />
            <div className="mt-2">
              <Bar w="w-16" h="h-2" />
            </div>
          </div>
        ))}
      </div>
      <div className="mb-8 grid grid-cols-15 gap-[3px]">
        {Array.from({ length: 90 }, (_, i) => (
          <div key={i} className="bg-surface aspect-square rounded-[1px]" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Bar key={i} h="h-5" />
        ))}
      </div>
    </PageSkeleton>
  );
}
