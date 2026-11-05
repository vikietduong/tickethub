"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrganizerStaffAccount, OrganizerStaff } from "@tickethub/shared";
import { organizerOperations, operationKeys } from "@/lib/organizer-operations";
import { Button } from "@/components/ui/button";
import { OperationError, panel, field } from "./ui";

function AccountRow({
  account,
  assignment,
  gates,
  eventId,
  changed,
}: {
  account: OrganizerStaffAccount;
  assignment?: OrganizerStaff;
  gates: { id: string; name: string }[];
  eventId: string;
  changed: () => void;
}) {
  const [gateId, setGateId] = useState(assignment?.gateId ?? "");
  const [confirm, setConfirm] = useState(false);
  const update = useMutation({
    mutationFn: () =>
      organizerOperations.updateStaff(account.id, {
        status: account.status === "ACTIVE" ? "LOCKED" : "ACTIVE",
      }),
    onSuccess: () => {
      setConfirm(false);
      changed();
    },
  });
  const assign = useMutation({
    mutationFn: () =>
      organizerOperations.assign(eventId, { userId: account.id, gateId }),
    onSuccess: changed,
  });
  return (
    <li className="space-y-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="font-bold">{account.fullName}</h3>
          <p className="break-all text-sm text-muted-foreground">
            {account.email}
          </p>
        </div>
        <span
          className={`h-fit rounded-full px-3 py-1 text-xs font-semibold ${account.status === "ACTIVE" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}
        >
          {account.status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <label className="min-w-0 text-sm">
          Cổng trong sự kiện
          <select
            aria-label={`Cổng của ${account.fullName}`}
            className={field}
            value={gateId}
            disabled={
              assign.isPending ||
              update.isPending ||
              account.status !== "ACTIVE"
            }
            onChange={(e) => setGateId(e.target.value)}
          >
            <option value="">Chọn cổng</option>
            {gates.map((gate) => (
              <option key={gate.id} value={gate.id}>
                {gate.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          disabled={
            !gateId ||
            gateId === assignment?.gateId ||
            assign.isPending ||
            account.status !== "ACTIVE"
          }
          onClick={() => assign.mutate()}
        >
          {assign.isPending ? "Đang phân công..." : "Lưu phân công"}
        </Button>
        <Button
          variant="outline"
          disabled={update.isPending || assign.isPending}
          onClick={() => setConfirm(true)}
        >
          {account.status === "ACTIVE" ? "Khóa tài khoản" : "Mở khóa"}
        </Button>
      </div>
      {confirm && (
        <div className="space-y-3 rounded-lg bg-muted p-4">
          <p className="text-sm">
            {account.status === "ACTIVE"
              ? `Khóa tài khoản ${account.fullName} ở mọi sự kiện? Nhân viên sẽ không thể tiếp tục soát vé bằng tài khoản này.`
              : `Mở khóa tài khoản ${account.fullName}?`}
          </p>
          <div className="flex gap-2">
            <Button disabled={update.isPending} onClick={() => update.mutate()}>
              {update.isPending ? "Đang cập nhật..." : "Xác nhận"}
            </Button>
            <Button
              variant="outline"
              disabled={update.isPending}
              onClick={() => setConfirm(false)}
            >
              Bỏ qua
            </Button>
          </div>
        </div>
      )}
      {update.error && <OperationError error={update.error} />}
      {assign.error && <OperationError error={assign.error} />}{" "}
      {assign.isSuccess && (
        <p role="status" className="text-sm text-primary">
          Đã lưu phân công.
        </p>
      )}
    </li>
  );
}
function AssignmentRow({
  item,
  gateName,
  eventId,
  changed,
}: {
  item: OrganizerStaff;
  gateName: string;
  eventId: string;
  changed: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const remove = useMutation({
    mutationFn: () => organizerOperations.unassign(eventId, item.userId),
    onSuccess: changed,
  });
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{item.fullName}</p>
          <p className="text-sm text-muted-foreground">
            {gateName} · {item.status === "ACTIVE" ? "Hoạt động" : "Đã khóa"}
          </p>
        </div>
        <Button variant="outline" onClick={() => setConfirm(true)}>
          Gỡ phân công
        </Button>
      </div>
      {confirm && (
        <div className="mt-3 space-y-2">
          <p className="text-sm">
            Gỡ nhân viên khỏi sự kiện này? Tài khoản và lịch sử soát vé vẫn được
            giữ.
          </p>
          <Button disabled={remove.isPending} onClick={() => remove.mutate()}>
            Xác nhận gỡ
          </Button>
          <Button
            variant="outline"
            disabled={remove.isPending}
            onClick={() => setConfirm(false)}
          >
            Bỏ qua
          </Button>
        </div>
      )}
      {remove.error && <OperationError error={remove.error} />}
    </li>
  );
}
export function StaffPanel({ eventId }: { eventId: string }) {
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const accounts = useQuery({
    queryKey: operationKeys.accounts(page),
    queryFn: () => organizerOperations.accounts(page),
    retry: false,
  });
  const staff = useQuery({
    queryKey: operationKeys.staff(eventId),
    queryFn: () => organizerOperations.staff(eventId),
    retry: false,
  });
  const gates = useQuery({
    queryKey: operationKeys.gates(eventId),
    queryFn: () => organizerOperations.gates(eventId),
    retry: false,
  });
  const changed = () => {
    void cache.invalidateQueries({ queryKey: ["w05", "accounts"] });
    void cache.invalidateQueries({ queryKey: ["w05", "assignments"] });
  };
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [gateName, setGateName] = useState("");
  const create = useMutation({
    mutationFn: () =>
      organizerOperations.createStaff({
        fullName: name,
        email,
        password,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      }),
    onSuccess: () => {
      setName("");
      setEmail("");
      setPassword("");
      setPhone("");
      setPage(1);
      changed();
    },
  });
  const createGate = useMutation({
    mutationFn: () =>
      organizerOperations.createGate(eventId, { name: gateName }),
    onSuccess: () => {
      setGateName("");
      void gates.refetch();
    },
  });
  const ready = accounts.isSuccess;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.5fr]">
      <div className="space-y-6">
        <section className={panel}>
          <h2 className="text-lg font-bold">Tạo tài khoản nhân viên</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tài khoản thuộc Ban tổ chức. Sau khi tạo, chọn cổng trong danh sách
            để phân công cho sự kiện.
          </p>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <fieldset
              disabled={!ready || create.isPending}
              className="space-y-4"
            >
              <label className="block text-sm">
                Họ và tên
                <input
                  required
                  minLength={1}
                  maxLength={150}
                  className={field}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm">
                Email
                <input
                  required
                  type="email"
                  className={field}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm">
                Số điện thoại (tùy chọn)
                <input
                  type="tel"
                  maxLength={20}
                  className={field}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm">
                Mật khẩu ban đầu
                <input
                  required
                  type="password"
                  minLength={12}
                  maxLength={128}
                  className={field}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Mật khẩu tối thiểu 12 ký tự. Chia sẻ thông tin đăng nhập qua
                kênh riêng an toàn.
              </p>
              <Button
                type="submit"
                className="w-full"
                disabled={!name.trim() || !email.trim()}
              >
                {create.isPending
                  ? "Đang tạo tài khoản..."
                  : "Tạo tài khoản nhân viên"}
              </Button>
            </fieldset>
          </form>
          {create.error && <OperationError error={create.error} />}{" "}
          {create.isSuccess && (
            <p role="status" className="mt-4 text-sm text-primary">
              Đã tạo tài khoản. Chọn cổng và lưu phân công để nhân viên được
              soát vé.
            </p>
          )}
        </section>
        <section className={panel}>
          <h2 className="font-bold">Cổng của sự kiện</h2>
          {gates.error && (
            <OperationError
              error={gates.error}
              retry={() => {
                void gates.refetch();
              }}
            />
          )}
          <ul className="mt-3 space-y-2 text-sm">
            {gates.data?.map((gate) => (
              <li key={gate.id}>{gate.name}</li>
            ))}
          </ul>
          {gates.data?.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Chưa có cổng. Tạo cổng để phân công nhân viên.
            </p>
          )}
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createGate.mutate();
            }}
          >
            <label className="block text-sm">
              Tên cổng mới
              <input
                className={field}
                required
                maxLength={100}
                disabled={!gates.isSuccess || createGate.isPending}
                value={gateName}
                onChange={(e) => setGateName(e.target.value)}
              />
            </label>
            <Button
              variant="outline"
              type="submit"
              disabled={
                !gates.isSuccess || createGate.isPending || !gateName.trim()
              }
            >
              Thêm cổng
            </Button>
          </form>
          {createGate.error && <OperationError error={createGate.error} />}
        </section>
      </div>
      <div className="space-y-6">
        <section className={panel}>
          <h2 className="text-lg font-bold">Nhân viên được phân công</h2>
          {staff.isPending && (
            <p role="status" className="mt-4">
              Đang tải nhân viên...
            </p>
          )}
          {staff.error && (
            <OperationError
              error={staff.error}
              retry={() => {
                void staff.refetch();
              }}
            />
          )}{" "}
          {staff.data?.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Chưa có nhân viên được phân công cho sự kiện này.
            </p>
          )}
          <ul className="mt-4 space-y-3">
            {staff.data?.map((item) => (
              <AssignmentRow
                key={item.id}
                item={item}
                gateName={
                  gates.data?.find((gate) => gate.id === item.gateId)?.name ??
                  "Cổng chưa xác định"
                }
                eventId={eventId}
                changed={changed}
              />
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Tối đa 100 phân công theo giới hạn hiện tại của hệ thống.
          </p>
        </section>
        <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Tài khoản của Ban tổ chức</h2>
            <Button
              variant="outline"
              disabled={accounts.isFetching}
              onClick={changed}
            >
              Làm mới
            </Button>
          </div>
          {accounts.isPending && (
            <p role="status" className="mt-4">
              Đang tải tài khoản...
            </p>
          )}
          {accounts.error && (
            <OperationError
              error={accounts.error}
              retry={() => {
                void accounts.refetch();
              }}
            />
          )}{" "}
          {accounts.data?.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Không có tài khoản trong trang này.
            </p>
          )}
          <ul className="mt-5 space-y-4">
            {accounts.data?.map((account) => (
              <AccountRow
                key={`${account.id}:${account.status}:${staff.data?.find((item) => item.userId === account.id)?.gateId}`}
                account={account}
                assignment={staff.data?.find(
                  (item) => item.userId === account.id,
                )}
                gates={gates.data ?? []}
                eventId={eventId}
                changed={changed}
              />
            ))}
          </ul>
          <nav
            aria-label="Phân trang tài khoản"
            className="mt-5 flex flex-wrap items-center gap-3"
          >
            <Button
              variant="outline"
              disabled={page === 1 || accounts.isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              Trang trước
            </Button>
            <span className="text-sm">Trang {page}</span>
            <Button
              variant="outline"
              disabled={
                !accounts.data ||
                accounts.data.length < 20 ||
                accounts.isFetching
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Trang sau
            </Button>
          </nav>
        </section>
      </div>
    </div>
  );
}
