import type { ComplaintStatus, Priority } from "@/lib/types";
import { STATUS_LABEL, STATUS_CLASS, PRIORITY_CLASS } from "@/lib/types";

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  return <span className={`badge ${STATUS_CLASS[status] ?? "badge-gray"}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return null;
  return <span className={`badge ${PRIORITY_CLASS[priority] ?? "badge-gray"}`}>{priority}</span>;
}
