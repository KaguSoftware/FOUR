import { Bar, PageSkeleton } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="playbook">
      <Bar w="w-16" h="h-3" />
      <div className="mt-3 flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Bar key={i} h="h-6" />
        ))}
      </div>
    </PageSkeleton>
  );
}
