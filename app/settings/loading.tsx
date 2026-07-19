import { Bar, PageSkeleton } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="settings">
      <div className="border-line mb-6 border-b pb-6">
        <Bar w="w-32" h="h-5" />
        <div className="mt-2">
          <Bar h="h-8" />
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-line border-b py-4">
          <Bar h="h-4" />
        </div>
      ))}
    </PageSkeleton>
  );
}
