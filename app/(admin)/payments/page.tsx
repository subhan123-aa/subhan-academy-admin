"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Search } from "lucide-react";
import { AdminSectionEmpty, AdminSectionError, AdminSectionHeader, AdminSectionLoading } from "@/components/admin-section";
import { adminRequest, getErrorMessage } from "@/lib/admin-api";
import { useAdminUser } from "../layout";

type Payment = {
  id: string;
  userId: string;
  studentEmail: string;
  studentName: string;
  courseId: string;
  amount: number;
  baseAmount?: number;
  discountAmount?: number;
  currency: string;
  paymentStatus: string;
  enrollmentStatus: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string | null;
  cashfreeOrderId?: string;
  cashfreePaymentId?: string | null;
  couponCode?: string | null;
  createdAt: string;
  verifiedAt: string | null;
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
function date(value: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}
function orderId(payment: Payment) {
  return payment.razorpayOrderId ?? payment.cashfreeOrderId ?? payment.id;
}
function paymentId(payment: Payment) {
  return payment.razorpayPaymentId ?? payment.cashfreePaymentId ?? null;
}

export default function PaymentsPage() {
  const user = useAdminUser();
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setPayments((await adminRequest<{ payments: Payment[] }>(user, "payments")).payments);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void adminRequest<{ payments: Payment[] }>(user, "payments").then((result) => {
      if (active) setPayments(result.payments);
    }).catch((loadError: unknown) => {
      if (active) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (payments ?? []).filter((payment) =>
      (status === "all" || payment.paymentStatus === status) &&
      (!term || orderId(payment).toLowerCase().includes(term) ||
        payment.studentEmail.toLowerCase().includes(term) ||
        payment.userId.toLowerCase().includes(term) ||
        (paymentId(payment) ?? "").toLowerCase().includes(term)),
    );
  }, [payments, query, status]);
  const succeeded = (payments ?? []).filter((payment) => payment.paymentStatus === "success");
  const revenue = succeeded.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div>
      <AdminSectionHeader eyebrow="PAYMENT RECORDS" title="Payments" description="Worker-verified Razorpay transactions and payment outcomes." />
      <AdminSectionError message={error} onRetry={() => void load()} />
      <section className="course-overview-strip">
        <div className="overview-course-count"><span className="overview-icon"><CircleDollarSign size={19} /></span><div><strong>{payments?.length ?? "—"}</strong><span>Payment attempts</span></div></div>
        <span className="overview-divider" />
        <div className="overview-status"><span className="status-dot published-dot" /><span>Verified sales</span><strong>{succeeded.length}</strong></div>
        <div className="overview-status"><span className="status-dot published-dot" /><span>Verified revenue</span><strong>{money.format(revenue)}</strong></div>
      </section>
      <section className="panel course-list-panel">
        <div className="course-list-toolbar">
          <div><h2>Transaction history</h2><p>{filtered.length} records</p></div>
          <div className="toolbar-controls">
            <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Order, payment, email or UID" aria-label="Search payments" /></label>
            <select className="filter-select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter payment status"><option value="all">All statuses</option><option value="success">Success</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option></select>
          </div>
        </div>
        {loading && !payments ? <AdminSectionLoading label="Loading verified payment records…" /> : payments === null ? (
          <AdminSectionEmpty label="Payment records could not be loaded." />
        ) : filtered.length ? (
          <div className="course-table-wrap"><table className="course-table wide-data-table">
            <thead><tr><th>ORDER / STUDENT</th><th>AMOUNT</th><th>STATUS</th><th>PAYMENT ID</th><th>CREATED / VERIFIED</th></tr></thead>
            <tbody>{filtered.map((payment) => (
              <tr key={payment.id}>
                <td><div className="table-text-stack"><strong>{orderId(payment)}</strong><small>{payment.studentName || payment.studentEmail || payment.userId}</small>{payment.couponCode ? <small>Coupon {payment.couponCode}</small> : null}</div></td>
                <td><strong>{money.format(payment.amount)}</strong>{payment.discountAmount ? <small className="subtle-line">−{money.format(payment.discountAmount)} discount</small> : null}</td>
                <td><span className={`status-pill ${payment.paymentStatus === "success" ? "status-published" : "status-draft"}`}><i />{payment.paymentStatus}</span><small className="subtle-line">{payment.enrollmentStatus.replaceAll("_", " ")}</small></td>
                <td><code className="playback-id">{paymentId(payment) || "—"}</code></td>
                <td><div className="table-text-stack"><span>{date(payment.createdAt)}</span><small>Verified {date(payment.verifiedAt)}</small></div></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <AdminSectionEmpty label="No transactions match these filters." />}
      </section>
      <p className="management-footnote">Payment statuses reflect server-side Razorpay verification; existing Cashfree history remains visible.</p>
    </div>
  );
}
