// Vietnamese names for the shared income and expense categories seeded in 0001_init.sql.
export const CATEGORY_LABEL: Record<string, string> = {
  court_rent: "Tiền sân",
  shuttlecocks: "Cầu",
  drinks: "Nước",
  social_match: "Giao lưu",
  tournament: "Giải đấu",
  other_expense: "Chi khác",
  sponsorship: "Tài trợ",
  penalty: "Tiền phạt",
  extra_contribution: "Đóng thêm",
  other_income: "Thu khác",
  guest_fee: "Thu phí vãng lai",
  membership_fee: "Phí tháng",
  opening_balance: "Số dư ban đầu",
  fee_refund: "Hoàn phí tháng",
};

export function categoryLabel(c: { code: string | null; name: string | null }): string {
  return c.name ?? (c.code ? (CATEGORY_LABEL[c.code] ?? c.code) : "Khác");
}

/** Categories the app writes by itself when a payment is marked; never picked by hand. */
export const AUTO_CATEGORY_CODES = ["guest_fee", "membership_fee", "fee_refund"];

/** Pseudo category in the income list: collects a member's unpaid monthly fees and marks them Đã nộp. */
export const MEMBER_FEE_OPTION = "member_fee";
