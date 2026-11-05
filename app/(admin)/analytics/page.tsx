"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CircleDollarSign, GraduationCap, UsersRound } from "lucide-react";
import { AdminSectionEmpty, AdminSectionError, AdminSectionHeader, AdminSectionLoading } from "@/components/admin-section";
import { adminRequest, getErrorMessage } from "@/lib/admin-api";
import { useAdminUser } from "../layout";

type Analytics = {
  days: number;
  totalRevenue: number;
  totalSales: number;
  totalEnrollments: number;
  totalStudents: number;
  activeStudents: number;
  daily: { date: string; revenue: number; sales: number; enrollments: number; activeStudents: number }[];
};
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function AnalyticsPage() {
  const user = useAdminUser();
  const [days, setDays] = useState(30);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(range = days) {
    setLoading(true);
    setError("");
    try {
      setAnalytics(await adminRequest<Analytics>(user, `analytics?days=${range}`));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void adminRequest<Analytics>(user, `analytics?days=${days}`).then((result) => {
      if (active) setAnalytics(result);
    }).catch((loadError: unknown) => {
      if (active) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [days, user]);

  const maxRevenue = Math.max(1, ...(analytics?.daily.map((day) => day.revenue) ?? []));
  const maxEnrollments = Math.max(1, ...(analytics?.daily.map((day) => day.enrollments) ?? []));
  const metrics = useMemo(() => analytics ? [
    { label: "Verified revenue", value: money.format(analytics.totalRevenue), note: "All successful payment records", icon: CircleDollarSign, tone: "mint" },
    { label: "Sales", value: analytics.totalSales.toLocaleString("en-IN"), note: "Verified successful payments", icon: Activity, tone: "blue" },
    { label: "Enrollments", value: analytics.totalEnrollments.toLocaleString("en-IN"), note: "Active and completed", icon: GraduationCap, tone: "lavender" },
    { label: "Active learners", value: analytics.activeStudents.toLocaleString("en-IN"), note: `Signed in during last ${days} days`, icon: UsersRound, tone: "amber" },
  ] : [], [analytics, days]);

  return (
    <div>
      <AdminSectionHeader eyebrow="ACADEMY PERFORMANCE" title="Analytics" description="Revenue, sales, enrollment and sign-in activity from Firebase and verified payment records." action={<select className="filter-select analytics-range" value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Analytics date range"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select>} />
      <AdminSectionError message={error} onRetry={() => void load()} />
      {loading && !analytics ? <AdminSectionLoading label="Loading real academy analytics…" /> : analytics ? (
        <>
          <section className="stats-grid analytics-stats">
            {metrics.map(({ label, value, note, icon: Icon, tone }) => <article className="stat-card" key={label}><div className={`stat-icon stat-icon-${tone}`}><Icon size={19} /></div><div className="stat-value">{value}</div><div className="stat-label">{label}</div><div className="stat-note">{note}</div></article>)}
          </section>
          <section className="panel analytics-detail-panel">
            <div className="panel-heading"><div><h2>Daily activity</h2><p>Verified payments and enrollment timestamps · {analytics.days} days</p></div><span className="panel-badge"><span />Live records</span></div>
            <div className="chart-legend"><span><i className="legend-dot revenue-dot" />Revenue</span><span><i className="legend-dot enrollment-dot" />Enrollments</span></div>
            <div className="activity-chart analytics-chart" style={{ gridTemplateColumns: `repeat(${analytics.days}, minmax(0, 1fr))` }} role="img" aria-label={`Daily revenue and enrollments over ${analytics.days} days`}>
              {analytics.daily.map((day, index) => {
                const showDate = analytics.days <= 7 || index % (analytics.days === 30 ? 5 : 15) === 0 || index === analytics.daily.length - 1;
                return <div className="chart-column" key={day.date} title={`${day.date}: ${money.format(day.revenue)}, ${day.sales} sales, ${day.enrollments} enrollments`}>
                  <div className="chart-bars"><div className="chart-bar revenue-bar" style={{ height: `${day.revenue ? Math.max(3, day.revenue / maxRevenue * 100) : 0}%` }} /><div className="chart-bar enrollment-bar" style={{ height: `${day.enrollments ? Math.max(3, day.enrollments / maxEnrollments * 100) : 0}%` }} /></div>
                  {showDate ? <span className="chart-date">{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day.date}T00:00:00Z`))}</span> : <span className="chart-date chart-date-empty" aria-hidden="true">·</span>}
                </div>;
              })}
            </div>
          </section>
          <section className="panel analytics-table-panel">
            <div className="course-list-toolbar"><div><h2>Daily breakdown</h2><p>New activity per UTC day</p></div></div>
            <div className="course-table-wrap"><table className="course-table">
              <thead><tr><th>DATE</th><th>REVENUE</th><th>SALES</th><th>ENROLLMENTS</th><th>ACTIVE LEARNERS</th></tr></thead>
              <tbody>{analytics.daily.slice().reverse().map((day) => <tr key={day.date}><td>{day.date}</td><td>{money.format(day.revenue)}</td><td>{day.sales}</td><td>{day.enrollments}</td><td>{day.activeStudents}</td></tr>)}</tbody>
            </table></div>
          </section>
        </>
      ) : <AdminSectionEmpty label="Analytics could not be loaded." />}
    </div>
  );
}
