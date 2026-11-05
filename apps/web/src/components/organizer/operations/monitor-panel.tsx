"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  organizerOperations,
  operationKeys,
  operationTime,
  operationUnavailable,
} from "@/lib/organizer-operations";
import { Button } from "@/components/ui/button";
import { OperationError, Metric, panel } from "./ui";
export function MonitorPanel({ eventId }: { eventId: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: operationKeys.monitor(eventId, page),
    queryFn: () => organizerOperations.monitor(eventId, page),
    retry: false,
    refetchInterval: (state) =>
      page === 1 && !operationUnavailable(state.state.error) ? 5000 : false,
    refetchIntervalInBackground: false,
  });
  const gates = useQuery({
    queryKey: operationKeys.gates(eventId),
    queryFn: () => organizerOperations.gates(eventId),
    retry: false,
  });
  const staff = useQuery({
    queryKey: operationKeys.staff(eventId),
    queryFn: () => organizerOperations.staff(eventId),
    retry: false,
  });
  const data = query.data;
  const successful =
    data?.filter((row) => row.outcome === "SUCCESS").length ?? 0;
  const gateLabel = (id: string | null) =>
    gates.data?.find((gate) => gate.id === id)?.name ??
    (id ? `Cổng ${id.slice(-8)}` : "Chưa xác định cổng");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Trang đầu tự cập nhật mỗi 5 giây khi đang mở.{" "}
          {query.dataUpdatedAt > 0 && (
            <>
              Lần nhận dữ liệu:{" "}
              {operationTime(new Date(query.dataUpdatedAt).toISOString())}
            </>
          )}
        </p>
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch();
          }}
        >
          Cập nhật ngay
        </Button>
      </div>
      {query.isPending && <p role="status">Đang tải tình hình vào cổng...</p>}
      {query.error && (
        <OperationError
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      )}{" "}
      {data && (
        <>
          {query.error && (
            <p role="status" className="text-sm text-destructive">
              Kết nối cập nhật đang gián đoạn. Số liệu bên dưới có thể đã cũ.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Các số đếm dưới đây chỉ tính tối đa 50 lượt trong trang lịch sử hiện
            tại, không phải tổng lượt của cả sự kiện.
          </p>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Metric label="Lượt trong trang này">{data.length}</Metric>
            <Metric label="Soát vé thành công">{successful}</Metric>
            <Metric label="Lượt bị từ chối">{data.length - successful}</Metric>
          </dl>
          <section className={panel}>
            <h2 className="text-lg font-bold">
              Cổng có lượt soát vé trong trang
            </h2>
            {data.length === 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Chưa có lượt soát vé.
              </p>
            )}
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...new Set(data.map((row) => row.gateId))].map((id) => (
                <li
                  key={id ?? "unknown"}
                  className="rounded-xl border border-border p-4"
                >
                  <h3 className="font-bold">{gateLabel(id)}</h3>
                  <p className="mt-3 text-2xl font-bold text-primary">
                    {
                      data.filter(
                        (row) => row.gateId === id && row.outcome === "SUCCESS",
                      ).length
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">
                    lượt thành công trong trang này
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <section className={panel}>
            <h2 className="text-lg font-bold">Lịch sử soát vé</h2>
            {data.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Chưa có lượt soát vé.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-3">Thời gian</th>
                      <th className="p-3">Cổng</th>
                      <th className="p-3">Nhân viên</th>
                      <th className="p-3">Vé (8 ký tự cuối)</th>
                      <th className="p-3">Cách soát</th>
                      <th className="p-3">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((scan) => (
                      <tr key={scan.id} className="border-b border-border">
                        <td className="whitespace-nowrap p-3">
                          {operationTime(scan.checkedInAt)}
                        </td>
                        <td className="p-3">{gateLabel(scan.gateId)}</td>
                        <td className="p-3">
                          {staff.data?.find(
                            (item) => item.userId === scan.staffId,
                          )?.fullName ?? `Nhân viên ${scan.staffId.slice(-8)}`}
                        </td>
                        <td className="p-3 font-mono">
                          {scan.ticketId?.slice(-8) ?? "Chưa xác định"}
                        </td>
                        <td className="p-3">
                          {scan.method === "QR" ? "QR" : "Tra cứu thủ công"}
                        </td>
                        <td className="p-3">
                          {scan.outcome === "SUCCESS"
                            ? "Đã check-in"
                            : "Bị từ chối"}
                          {scan.errorCode && (
                            <span className="block text-xs text-muted-foreground">
                              {scan.errorCode}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <nav
              aria-label="Phân trang lượt soát vé"
              className="mt-5 flex items-center gap-3"
            >
              <Button
                variant="outline"
                disabled={page === 1 || query.isFetching}
                onClick={() => setPage((p) => p - 1)}
              >
                Trang trước
              </Button>
              <span>Trang {page}</span>
              <Button
                variant="outline"
                disabled={data.length < 50 || query.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau
              </Button>
            </nav>
          </section>
        </>
      )}
    </div>
  );
}
