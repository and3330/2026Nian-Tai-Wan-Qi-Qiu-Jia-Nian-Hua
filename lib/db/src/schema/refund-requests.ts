import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const refundRequestsTable = pgTable(
  "refund_requests",
  {
    id: serial("id").primaryKey(),
    paymentRef: text("payment_ref").notNull(),
    buyerName: text("buyer_name").notNull(),
    buyerContact: text("buyer_contact").notNull(),
    reason: text("reason").notNull(),
    // pending | approved | rejected | rescheduled
    status: text("status").notNull().default("pending"),
    refundAmount: integer("refund_amount"),
    // Unguessable token embedded in the "fill in your bank account" email link
    bankInfoToken: text("bank_info_token").unique(),
    bankInfoEmailSentAt: timestamp("bank_info_email_sent_at", { withTimezone: true }),
    // Buyer-submitted refund form (via the public token link)
    formPurchaseInfo: text("form_purchase_info"),
    formName: text("form_name"),
    formPhone: text("form_phone"),
    bankName: text("bank_name"),
    bankBranch: text("bank_branch"),
    bankAccountName: text("bank_account_name"),
    bankAccountNumber: text("bank_account_number"),
    bankInfoSubmittedAt: timestamp("bank_info_submitted_at", { withTimezone: true }),
    // 退票結果通知信（核准後寄出）
    notifyEmailSentAt: timestamp("notify_email_sent_at", { withTimezone: true }),
    // 已退款通知信（款項實際匯出後寄出）
    refundedNotifySentAt: timestamp("refunded_notify_sent_at", { withTimezone: true }),
    adminNote: text("admin_note"),
    processedBy: text("processed_by"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_refund_requests_status").on(table.status),
    index("idx_refund_requests_payment_ref").on(table.paymentRef),
  ],
);

export type RefundRequest = typeof refundRequestsTable.$inferSelect;
export type InsertRefundRequest = typeof refundRequestsTable.$inferInsert;
