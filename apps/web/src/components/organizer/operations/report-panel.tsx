"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type OrganizerReport,
  type OrganizerExportFormat,
  type OrganizerExportJob,
} from "@tickethub/shared";
import { ApiError } from "@/lib/api/client";
import {
  organizerOperations,
  operationKeys,
  operationUnavailable,
  operationMoney,
  operationTime,
  todayVietnam,
  reportPeriod,
  selectOrganizerReport,
  downloadOperationExport,
} from "@/lib/organizer-operations";
import { Button } from "@/components/ui/button";
import { OperationError, Metric, panel, field } from "./ui";

export function RevenueChart({ report }: { report: OrganizerReport }) {
  const points = report.revenueSeries;
  if (points.length === 0)
    return (
      <p className="py-6 text-sm text-muted-foreground">
        Chưa có dữ liệu doanh thu trong khoảng thời gian này.
      </p>
    );
  const max = Math.max(1, ...points.map((point) => point.revenueVnd));
  const coords = points
    .map(
      (point, index) =>
        `${40 + index * (720 / Math.max(1, points.length - 1))},${180 - (point.revenueVnd / max) * 150}`,
    )
    .join(" ");
  return (
    <>
      <svg
        role="img"
        aria-label="Biểu đồ doanh thu vé trước hoàn tiền theo ngày"
        viewBox="0 0 800 220"
        className="mt-4 w-full text-primary"
      >
        <title>Doanh thu vé theo ngày</title>
        <desc>
          {points
            .map(
              (point) => `${point.date}: ${operationMoney(point.revenueVnd)}`,
            )
            .join("; ")}
        </desc>
        <line
          x1="40"
          y1="180"
          x2="760"
          y2="180"
          stroke="currentColor"
          opacity="0.2"
        />
        <polyline
          points={coords}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        {points.length === 1 && (
          <circle
            cx="40"
            cy={180 - (points[0]!.revenueVnd / max) * 150}
            r="4"
            fill="currentColor"
          />
        )}
        <text x="40" y="210" fill="currentColor" fontSize="13">
          {points[0]?.date}
        </text>
        <text
          x="760"
          y="210"
          textAnchor="end"
          fill="currentColor"
          fontSize="13"
        >
          {points[points.length - 1]?.date}
        </text>
      </svg>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-primary">
          Xem bảng số liệu theo ngày
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2">Ngày</th>
                <th className="p-2">Vé bán</th>
                <th className="p-2">Doanh thu vé</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date} className="border-b border-border">
                  <td className="p-2">{point.date}</td>
                  <td className="p-2">{point.soldTickets}</td>
                  <td className="p-2">{operationMoney(point.revenueVnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
export function ReportView({ report }: { report: OrganizerReport }) {
  if (!report.summary)
    return (
      <section className={panel}>
        <h2 className="font-bold">Báo cáo chưa có bản cập nhật</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Số liệu sự kiện chưa được tổng hợp. Vui lòng làm mới sau; đây không
          phải doanh thu bằng 0.
        </p>
      </section>
    );
  const rate =
    report.summary.ticketsSold > 0
      ? (report.summary.ticketsCheckedIn / report.summary.ticketsSold) * 100
      : 0;
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Kỳ báo cáo: {operationTime(report.fromDate)} đến{" "}
        {operationTime(new Date(Date.parse(report.toDate) - 1).toISOString())}
      </p>
      <p className="text-sm text-muted-foreground">
        Số liệu cập nhật:{" "}
        {report.generatedAt
          ? operationTime(report.generatedAt)
          : "Chưa có mốc cập nhật"}
      </p>
      <h2 className="font-bold">Tổng quan toàn bộ sự kiện</h2>
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Tiền vé đã thu">
          {operationMoney(report.summary.grossRevenue)}
        </Metric>
        <Metric label="Tiền đã hoàn tất hoàn trả">
          {operationMoney(report.summary.refundAmount)}
        </Metric>
        <Metric label="Doanh thu sau hoàn">
          {operationMoney(report.summary.netRevenue)}
        </Metric>
        <Metric label="Vé đang có hiệu lực">
          {report.summary.ticketsSold.toLocaleString("vi-VN")}
        </Metric>
      </dl>
      <section className={panel}>
        <h2 className="text-lg font-bold">Diễn biến doanh thu</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tiền vé đã thu trước hoàn tiền, phân bổ theo ngày bán tại Việt Nam.
        </p>
        <RevenueChart report={report} />
      </section>
      <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
        <section className={panel}>
          <h2 className="text-lg font-bold">Vé bán theo hạng</h2>
          {report.ticketTypes.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Chưa có số liệu hạng vé.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 pr-4">Hạng vé</th>
                    <th className="p-3">Đã bán</th>
                    <th className="p-3">Đã check-in</th>
                    <th className="p-3">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {report.ticketTypes.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-border">
                      <th scope="row" className="py-3 pr-4 font-medium">
                        {ticket.name}
                      </th>
                      <td className="p-3 tabular-nums">{ticket.sold}</td>
                      <td className="p-3 tabular-nums">{ticket.checkedIn}</td>
                      <td className="whitespace-nowrap p-3 tabular-nums">
                        {operationMoney(ticket.revenueVnd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className={panel}>
          <h2 className="font-bold">Tỷ lệ check-in</h2>
          <p className="mt-4 text-4xl font-bold text-primary">
            {rate.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%
          </p>
          <progress
            className="mt-4 h-3 w-full accent-primary"
            value={report.summary.ticketsCheckedIn}
            max={Math.max(1, report.summary.ticketsSold)}
            aria-label="Tỷ lệ vé đã check-in"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            {report.summary.ticketsCheckedIn} / {report.summary.ticketsSold} vé
            trong báo cáo đã check-in.
          </p>
        </section>
      </div>
    </div>
  );
}
function ExportPanel({ eventId }: { eventId: string }) {
  const [format, setFormat] = useState<OrganizerExportFormat>("csv");
  const [seed, setSeed] = useState<OrganizerExportJob | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const create = useMutation({
    mutationFn: () => organizerOperations.createExport(eventId, format),
    retry: false,
    onSuccess: (data) => {
      setSeed(data);
      setUncertain(false);
    },
    onError: (error) => {
      setUncertain(
        !(error instanceof ApiError) ||
          error.status === 0 ||
          error.status >= 500,
      );
    },
  });
  const job = useQuery({
    queryKey: operationKeys.export(eventId, seed?.id ?? ""),
    queryFn: () => organizerOperations.exportJob(eventId, seed!.id),
    enabled: seed !== null,
    initialData: seed ?? undefined,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) =>
      ["PENDING", "PROCESSING"].includes(query.state.data?.status ?? "")
        ? 2000
        : false,
  });
  const current = job.data ?? seed;
  const download = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Chưa có tệp để tải.");
      const blob = await downloadOperationExport(current);
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `baocao-${eventId}-${current.id}.${current.format}`;
        anchor.click();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    },
  });
  const processing =
    current && ["PENDING", "PROCESSING"].includes(current.status);
  const labels = {
    PENDING: "Đã xếp hàng xuất báo cáo",
    PROCESSING: "Đang tạo tệp báo cáo",
    COMPLETED: "Tệp báo cáo đã sẵn sàng",
    FAILED: "Xuất báo cáo thất bại",
    EXPIRED: "Tệp báo cáo đã hết hạn",
  };
  return (
    <section className={panel}>
      <h2 className="font-bold">Xuất báo cáo toàn bộ sự kiện</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tệp được tạo trong nền với toàn bộ số liệu sự kiện. Bộ lọc ngày trên
        biểu đồ không áp dụng cho tệp xuất.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Định dạng
          <select
            aria-label="Định dạng báo cáo"
            className={field}
            value={format}
            disabled={create.isPending || Boolean(processing)}
            onChange={(e) => setFormat(e.target.value as OrganizerExportFormat)}
          >
            <option value="csv">CSV</option>
            <option value="xlsx">Excel (.xlsx)</option>
          </select>
        </label>
        <Button
          disabled={create.isPending || Boolean(processing)}
          onClick={() => {
            download.reset();
            create.mutate();
          }}
        >
          {create.isPending
            ? "Đang gửi yêu cầu..."
            : uncertain
              ? "Tạo yêu cầu mới"
              : "Tạo tệp báo cáo"}
        </Button>
        {current?.status === "COMPLETED" && (
          <Button
            variant="outline"
            disabled={download.isPending}
            onClick={() => download.mutate()}
          >
            {download.isPending ? "Đang tải..." : "Tải báo cáo"}
          </Button>
        )}
      </div>
      {current && (
        <p role="status" className="mt-4 text-sm">
          {labels[current.status]} · {current.format.toUpperCase()}
        </p>
      )}
      {current?.status === "FAILED" && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {current.errorMessage || "Không tạo được tệp. Vui lòng thử lại."}
        </p>
      )}
      {uncertain && (
        <p role="alert" className="mt-3 text-sm text-muted-foreground">
          Chưa nhận được xác nhận. Yêu cầu trước có thể đã được tạo; yêu cầu mới
          sẽ tạo một tác vụ khác. Không bấm liên tục.
        </p>
      )}
      {create.error && <OperationError error={create.error} />}{" "}
      {job.error && (
        <OperationError
          error={job.error}
          retry={() => {
            void job.refetch();
          }}
        />
      )}{" "}
      {download.error && <OperationError error={download.error} />}{" "}
      {download.isSuccess && (
        <p role="status" className="mt-3 text-sm text-primary">
          Đã gửi tệp báo cáo tới trình duyệt.
        </p>
      )}
    </section>
  );
}
export function ReportPanel({ eventId }: { eventId: string }) {
  const [from, setFrom] = useState(() =>
    todayVietnam(new Date(Date.now() - 6 * 86_400_000)),
  );
  const [to, setTo] = useState(() => todayVietnam());
  const [applied, setApplied] = useState(() => reportPeriod(from, to));
  const [filterError, setFilterError] = useState<unknown>(null);
  const query = useQuery({
    queryKey: operationKeys.report(eventId),
    queryFn: () => organizerOperations.report(eventId),
    retry: false,
    refetchInterval: (state) =>
      operationUnavailable(state.state.error) ? false : 30000,
  });
  const projection = useMemo(() => {
    if (!query.data) return { report: null, error: null };
    try {
      return {
        report: selectOrganizerReport(query.data, eventId, applied),
        error: null,
      };
    } catch (error) {
      return { report: null, error };
    }
  }, [query.data, eventId, applied]);
  const report = projection.report;
  return (
    <div className="space-y-6">
      <section className={panel}>
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              setApplied(reportPeriod(from, to));
              setFilterError(null);
            } catch (error) {
              setFilterError(error);
            }
          }}
        >
          <label className="text-sm">
            Từ ngày
            <input
              aria-label="Từ ngày"
              required
              type="date"
              className={field}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Đến ngày
            <input
              aria-label="Đến ngày"
              required
              type="date"
              className={field}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <Button type="submit">Áp dụng bộ lọc</Button>
          <Button
            variant="outline"
            type="button"
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch();
            }}
          >
            Làm mới số liệu
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Lọc biểu đồ và bảng hạng vé theo ngày bán tại Việt Nam. Tổng quan và
          tệp xuất luôn là toàn bộ sự kiện. Số liệu tổng hợp có thể chậm khoảng
          6 phút; xem mốc cập nhật.
        </p>
        {filterError !== null && <OperationError error={filterError} />}
      </section>
      {query.isPending && <p role="status">Đang tải báo cáo...</p>}
      {query.error && (
        <>
          <OperationError
            error={query.error}
            retry={() => {
              void query.refetch();
            }}
          />
          {query.data && (
            <p role="status" className="text-sm text-destructive">
              Không cập nhật được số liệu. Bên dưới là báo cáo nhận được trước
              đó.
            </p>
          )}
        </>
      )}
      {projection.error !== null && <OperationError error={projection.error} />}
      {report && (
        <>
          <ReportView report={report} />
          <ExportPanel key={eventId} eventId={eventId} />
        </>
      )}
    </div>
  );
}
