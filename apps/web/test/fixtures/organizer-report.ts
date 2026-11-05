// Fixture chỉ dùng cho unit test schema và hiển thị, không nằm trong code sản phẩm.
export const operationEventId = "11111111-1111-4111-8111-111111111111";
export const operationTypeId = "22222222-2222-4222-8222-222222222222";
export const operationJobId = "33333333-3333-4333-8333-333333333333";
export const reportResponseFixture = {
  summary: {
    event_id: operationEventId,
    organizer_id: operationTypeId,
    title: "Sự kiện unit test",
    total_sold_tickets: "2",
    total_checked_in_tickets: "1",
    total_cancelled_tickets: "0",
    gross_revenue: "1500000.00",
    paid_revenue: "1200000.00",
    total_refunded_amount: "200000.00",
    net_revenue: "1000000.00",
    checkin_percentage: "50.00",
    refreshed_at: "2026-11-03T00:00:00Z",
  },
  sales: [
    {
      event_id: operationEventId,
      organizer_id: operationTypeId,
      ticket_type_id: operationTypeId,
      ticket_type_name: "Khu GA",
      sale_date: "2026-11-01",
      total_sold_tickets: "1",
      total_checked_in_tickets: "1",
      paid_revenue: "600000.00",
      refreshed_at: "2026-11-03T00:00:00Z",
    },
    {
      event_id: operationEventId,
      organizer_id: operationTypeId,
      ticket_type_id: operationTypeId,
      ticket_type_name: "Khu GA",
      sale_date: "2026-11-02",
      total_sold_tickets: "1",
      total_checked_in_tickets: "0",
      paid_revenue: "600000.00",
      refreshed_at: "2026-11-03T00:00:00Z",
    },
  ],
};
