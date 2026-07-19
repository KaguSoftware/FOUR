import { Bar, PageSkeleton } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="proof">
      <div className="border-line mb-8 flex flex-col gap-3 border-b pb-8">
        <Bar w="w-24" h="h-3" />
        <Bar h="h-10" />
        <Bar h="h-10" />
        <Bar h="h-10" />
      </div>
      <Bar w="w-28" h="h-3" />
      <div className="mt-3">
        <Bar h="h-20" />
      </div>
    </PageSkeleton>
  );
}
