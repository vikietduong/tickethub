import { z } from "zod";
// Hợp đồng API BE2: baam2603/tickethub, commit 3aa1d4b.
const Id = z.string().uuid();
const Count = z
  .union([z.number(), z.string().regex(/^\d+$/)])
  .transform(Number)
  .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER));
const Decimal = z
  .union([z.number(), z.string().regex(/^-?\d+(\.\d{1,2})?$/)])
  .transform(Number)
  .pipe(
    z
      .number()
      .finite()
      .min(-Number.MAX_SAFE_INTEGER / 100)
      .max(Number.MAX_SAFE_INTEGER / 100),
  );
const Money = Decimal.pipe(z.number().nonnegative());
const ReportTimestamp = z.string().transform((value, context) => {
  const match =
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)$/.exec(
      value,
    );
  if (!match) {
    context.addIssue({ code: "custom", message: "Mốc cập nhật không hợp lệ." });
    return z.NEVER;
  }
  let zone = match[4]!;
  if (/^[+-]\d{2}$/.test(zone)) zone += ":00";
  else if (/^[+-]\d{4}$/.test(zone))
    zone = zone.slice(0, 3) + ":" + zone.slice(3);
  const iso = `${match[1]}T${match[2]}.${(match[3] ?? "").padEnd(3, "0").slice(0, 3)}${zone}`;
  if (!z.iso.datetime({ offset: true }).safeParse(iso).success) {
    context.addIssue({ code: "custom", message: "Mốc cập nhật không hợp lệ." });
    return z.NEVER;
  }
  return new Date(iso).toISOString();
});
export const OrganizerOperationEventsSchema = z.object({
  items: z.array(
    z.object({
      id: Id,
      title: z.string(),
      startTime: z.iso.datetime(),
      status: z.string(),
    }),
  ),
  total: Count,
});
export const OrganizerGatesSchema = z.array(
  z.object({ id: Id, name: z.string(), eventId: Id }),
);
export const OrganizerStaffAccountSchema = z.object({
  id: Id,
  fullName: z.string(),
  email: z.email(),
  phone: z.string().nullable(),
  status: z.enum(["ACTIVE", "LOCKED"]),
  createdAt: z.iso.datetime(),
});
export const OrganizerStaffAccountsSchema = z.array(
  OrganizerStaffAccountSchema,
);
export const OrganizerStaffSchema = z.object({
  id: Id,
  userId: Id,
  fullName: z.string(),
  email: z.email(),
  status: z.enum(["ACTIVE", "LOCKED"]),
  gateId: Id.nullable(),
});
export const OrganizerStaffListSchema = z.array(OrganizerStaffSchema);
export const CreateOrganizerStaffSchema = z
  .object({
    fullName: z.string().trim().min(1).max(150),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().min(12).max(128),
    phone: z.string().trim().max(20).optional(),
  })
  .strict();
export const UpdateOrganizerStaffSchema = z
  .object({
    fullName: z.string().trim().min(1).max(150).optional(),
    phone: z.string().trim().max(20).optional(),
    status: z.enum(["ACTIVE", "LOCKED"]).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Chưa có thay đổi cần lưu.",
  );
export const OrganizerAssignmentSchema = z.object({
  id: Id,
  eventId: Id,
  userId: Id,
  gateId: Id.nullable(),
  staffRole: z.string(),
});
export const OrganizerAssignRequestSchema = z
  .object({ userId: Id, gateId: Id })
  .strict();
export const OrganizerGateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    locationDesc: z.string().trim().max(255).optional(),
  })
  .strict();
export const OrganizerReportResponseSchema = z.object({
  summary: z
    .object({
      event_id: Id,
      organizer_id: Id,
      title: z.string(),
      total_sold_tickets: Count,
      total_checked_in_tickets: Count,
      total_cancelled_tickets: Count,
      gross_revenue: Money,
      paid_revenue: Money,
      total_refunded_amount: Money,
      net_revenue: Decimal,
      checkin_percentage: Decimal.pipe(z.number().min(0).max(100)),
      refreshed_at: ReportTimestamp,
    })
    .nullable(),
  sales: z.array(
    z.object({
      event_id: Id,
      organizer_id: Id,
      ticket_type_id: Id,
      ticket_type_name: z.string(),
      sale_date: z.iso.date(),
      total_sold_tickets: Count,
      total_checked_in_tickets: Count,
      paid_revenue: Money,
      refreshed_at: ReportTimestamp,
    }),
  ),
});
export const OrganizerExportFormatSchema = z.enum(["csv", "xlsx"]);
export const OrganizerExportCreatedSchema = z.object({
  id: Id,
  format: OrganizerExportFormatSchema,
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "EXPIRED"]),
  createdAt: z.iso.datetime(),
});
export const OrganizerExportJobSchema = OrganizerExportCreatedSchema.extend({
  expiresAt: z.iso.datetime().nullable(),
  errorMessage: z.string().nullable(),
  downloadUrl: z.string().nullable(),
});
export const OrganizerCheckinsSchema = z.array(
  z.object({
    id: Id,
    eventId: Id.nullable(),
    ticketId: Id.nullable(),
    gateId: Id.nullable(),
    staffId: Id,
    method: z.enum(["QR", "MANUAL"]),
    outcome: z.enum(["SUCCESS", "REJECTED"]),
    reason: z.string().nullable(),
    errorCode: z.string().nullable(),
    checkedInAt: z.iso.datetime(),
  }),
);
export type OrganizerStaff = z.infer<typeof OrganizerStaffSchema>;
export type OrganizerStaffAccount = z.infer<typeof OrganizerStaffAccountSchema>;
export type OrganizerReportResponse = z.infer<
  typeof OrganizerReportResponseSchema
>;
export type OrganizerExportJob = z.infer<typeof OrganizerExportJobSchema> & {
  eventId: string;
};
export type OrganizerExportFormat = z.infer<typeof OrganizerExportFormatSchema>;
export interface OrganizerReport {
  eventId: string;
  fromDate: string;
  toDate: string;
  generatedAt: string | null;
  summary: {
    grossRevenue: number;
    refundAmount: number;
    netRevenue: number;
    ticketsSold: number;
    ticketsCheckedIn: number;
    listedRevenue: number;
  } | null;
  revenueSeries: { date: string; revenueVnd: number; soldTickets: number }[];
  ticketTypes: {
    id: string;
    name: string;
    sold: number;
    checkedIn: number;
    revenueVnd: number;
  }[];
}
