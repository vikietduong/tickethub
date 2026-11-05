"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useRouter } from "next/navigation";
import {
  organizerOperations,
  operationKeys,
  operationTime,
} from "@/lib/organizer-operations";
import { OperationError, field } from "./ui";
import { StaffPanel } from "./staff-panel";
import { ReportPanel } from "./report-panel";
import { MonitorPanel } from "./monitor-panel";
export type OperationView = "staff" | "stats" | "monitor";
export function OperationsWorkspace({
  eventId = "",
  view = "stats",
}: {
  eventId?: string;
  view?: OperationView;
}) {
  const router = useRouter();
  const query = useQuery({
    queryKey: operationKeys.events,
    queryFn: organizerOperations.events,
    retry: false,
  });
  const event = query.data?.items.find((item) => item.id === eventId);
  const validId = z.string().uuid().safeParse(eventId).success;
  const titles = {
    staff: "Nhân viên soát vé",
    stats: "Báo cáo doanh thu",
    monitor: "Giám sát vào cổng",
  };
  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-sm font-semibold text-primary">Vận hành sự kiện</p>
        <h1 className="mt-1 text-2xl font-extrabold">{titles[view]}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Quản lý nhân sự và theo dõi số liệu theo từng sự kiện của bạn.
        </p>
      </div>
      {query.isPending && <p role="status">Đang tải sự kiện của bạn...</p>}
      {query.error && (
        <OperationError
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      )}
      {query.data && (
        <label className="block max-w-xl text-sm font-semibold">
          Sự kiện
          <select
            aria-label="Sự kiện"
            className={field}
            value={event?.id ?? ""}
            onChange={(e) =>
              router.push(
                e.target.value
                  ? `/organizer/events/${e.target.value}/${view}`
                  : "/organizer/dashboard",
              )
            }
          >
            <option value="">Chọn sự kiện để tiếp tục</option>
            {query.data.items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {query.data?.items.length === 0 && (
        <p className="rounded-xl bg-accent p-5 text-accent-foreground">
          Bạn chưa có sự kiện.{" "}
          <Link href="/organizer/events/new" className="underline">
            Tạo sự kiện
          </Link>{" "}
          để bắt đầu.
        </p>
      )}
      {eventId && query.data && (!validId || !event) && (
        <p
          role="alert"
          className="rounded-xl border border-destructive p-4 text-destructive"
        >
          Không tìm thấy sự kiện trong danh sách bạn quản lý. Vui lòng chọn lại
          sự kiện.
        </p>
      )}
      {event && (
        <>
          <div className="rounded-xl border border-border bg-background p-4">
            <h2 className="font-bold">{event.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Thời gian sự kiện: {operationTime(event.startTime)}
            </p>
          </div>
          <nav
            aria-label="Chức năng vận hành sự kiện"
            className="flex flex-wrap gap-2 border-b border-border pb-4"
          >
            {(["stats", "staff", "monitor"] as const).map((value) => (
              <Link
                key={value}
                href={`/organizer/events/${event.id}/${value}`}
                aria-current={view === value ? "page" : undefined}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${view === value ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-secondary"}`}
              >
                {titles[value]}
              </Link>
            ))}
          </nav>
          {view === "staff" ? (
            <StaffPanel key={event.id} eventId={event.id} />
          ) : view === "monitor" ? (
            <MonitorPanel key={event.id} eventId={event.id} />
          ) : (
            <ReportPanel key={event.id} eventId={event.id} />
          )}
        </>
      )}
    </div>
  );
}
