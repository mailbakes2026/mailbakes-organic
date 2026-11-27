import { DataSkeleton } from "@/components/data-skeleton";

export default function Loading() {
  return (
    <div className="skel" aria-busy="true" aria-label="Loading">
      <span className="skel-bar skel-title" />
      <span className="skel-bar skel-lede" />
      <DataSkeleton />
    </div>
  );
}
