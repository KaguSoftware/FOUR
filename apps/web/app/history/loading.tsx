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
      {/* Two months of calendar. Mirrors `MonthStack` — header, weekday row,
          then 35 cells — so the page does not jump when the real grid lands. */}
      <div className="mb-10 flex flex-col gap-8">
        {[0, 1].map((m) => (
          <div key={m}>
            <div className="mb-3 flex items-baseline justify-between">
              <Bar w="w-24" h="h-2" />
              <Bar w="w-10" h="h-2" />
            </div>
            <div className="mb-2 grid grid-cols-7 gap-[3px]">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="flex justify-center">
                  <Bar w="w-2" h="h-2" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-[3px]">
              {Array.from({ length: 35 }, (_, i) => (
                <div
                  key={i}
                  className="bg-surface aspect-square rounded-[1px]"
                />
              ))}
            </div>
          </div>
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
