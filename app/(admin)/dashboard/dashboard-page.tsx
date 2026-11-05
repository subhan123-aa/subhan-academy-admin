"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, CircleDollarSign, GraduationCap, UsersRound } from "lucide-react";
import { adminRequest, getErrorMessage } from "@/lib/admin-api";
import type { Course, Dashboard } from "@/lib/types";
import { useAdminUser } from "../layout";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
}

export default function DashboardPage() {
  const user = useAdminUser();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    const [metrics, courseResult] = await Promise.all([
        adminRequest<Dashboard>(user, "dashboard"),
        adminRequest<{ courses: Course[] }>(user, "courses"),
    ]);
    return { metrics, courses: courseResult.courses };
  }, [user]);

  useEffect(() => {
    let active = true;
    void fetchDashboard().then(({ metrics, courses: loadedCourses }) => {
      if (!active) return;
      setDashboard(metrics);
      setCourses(loadedCourses);
    }).catch((loadError: unknown) => {
      if (!active) return;
      setError(getErrorMessage(loadError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [fetchDashboard]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const { metrics, courses: loadedCourses } = await fetchDashboard();
      setDashboard(metrics);
      setCourses(loadedCourses);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  const maxRevenue = Math.max(1, ...(dashboard?.daily.map((day) => day.revenue) ?? []));
  const maxEnrollments = Math.max(1, ...(dashboard?.daily.map((day) => day.enrollments) ?? []));
  const stats = dashboard ? [
    { label: "Total revenue", value: currency.format(dashboard.revenue), note: "From successful payments", icon: CircleDollarSign, tone: "mint" },
    { label: "Enrolled students", value: dashboard.students.toLocaleString("en-IN"), note: "Unique enrolled learners", icon: UsersRound, tone: "blue" },
    { label: "Course enrollments", value: dashboard.enrollments.toLocaleString("en-IN"), note: "Active and completed", icon: GraduationCap, tone: "lavender" },
    { label: "Successful sales", value: dashboard.sales.toLocaleString("en-IN"), note: "Verified transactions", icon: BookOpen, tone: "amber" },
  ] : [];

  return (
    <div className="dashboard-page">
      <div className="page-heading heading-with-action">
        <div>
          <div className="eyebrow">YOUR ACADEMY AT A GLANCE</div>
          <h1>Overview</h1>
          <p>Welcome back. Here&apos;s what&apos;s happening at Subhan Academy.</p>
        </div>
        <div className="heading-date"><span className="status-pulse" />Connected</div>
      </div>

      {error ? (
        <div className="page-alert" role="alert">
          <span>{error}</span><button className="text-button" onClick={refresh}>Try again</button>
        </div>
      ) : null}

      {loading && !dashboard ? (
        <div className="content-loading"><span className="spinner" />Loading academy data…</div>
      ) : dashboard ? (
        <>
          <section className="stats-grid" aria-label="Academy statistics">
            {stats.map(({ label, value, note, icon: Icon, tone }) => (
              <article className="stat-card" key={label}>
                <div className="stat-top">
                  <div className={`stat-icon stat-icon-${tone}`}><Icon size={19} strokeWidth={1.9} /></div>
                </div>
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
                <div className="stat-note">{note}</div>
              </article>
            ))}
          </section>

          <section className="dashboard-grid">
            <article className="panel analytics-panel">
              <div className="panel-heading">
                <div><h2>Academy activity</h2><p>Revenue and new enrollments · last 7 days</p></div>
                <span className="panel-badge"><span />This week</span>
              </div>
              <div className="chart-legend">
                <span><i className="legend-dot revenue-dot" />Revenue</span>
                <span><i className="legend-dot enrollment-dot" />Enrollments</span>
              </div>
              <div className="activity-chart" role="img" aria-label="Daily revenue and enrollments over the last 7 days">
                {dashboard.daily.map((day) => (
                  <div className="chart-column" key={day.date} title={`${formatDay(day.date)}: ${currency.format(day.revenue)}, ${day.enrollments} enrollments`}>
                    <div className="chart-bars">
                      <div className="chart-bar revenue-bar" style={{ height: `${day.revenue ? Math.max(5, day.revenue / maxRevenue * 100) : 0}%` }} />
                      <div className="chart-bar enrollment-bar" style={{ height: `${day.enrollments ? Math.max(5, day.enrollments / maxEnrollments * 100) : 0}%` }} />
                    </div>
                    <span className="chart-date">{formatDay(day.date)}</span>
                  </div>
                ))}
              </div>
              <div className="chart-footer">
                <span>Tracked from verified payment and enrollment records</span>
                <span>{dashboard.daily.reduce((sum, day) => sum + day.enrollments, 0)} new this week</span>
              </div>
            </article>

            <article className="panel course-summary-panel">
              <div className="panel-heading">
                <div><h2>Your courses</h2><p>{dashboard.courses} {dashboard.courses === 1 ? "course" : "courses"} in your academy</p></div>
                <Link href="/courses" className="panel-icon-link" aria-label="Manage courses"><ArrowRight size={17} /></Link>
              </div>
              {courses.length ? (
                <div className="course-summary-list">
                  {courses.slice(0, 4).map((course) => (
                    <Link href={`/courses/${encodeURIComponent(course.id)}`} className="course-summary-item" key={course.id}>
                      <div className="course-summary-thumb"><BookOpen size={18} /></div>
                      <div className="course-summary-copy"><strong>{course.title}</strong><span>{course.lessonCount ?? 0} lessons</span></div>
                      <span className={`status-pill ${course.published ? "status-published" : "status-draft"}`}>{course.published ? "Published" : "Draft"}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mini-empty"><div className="empty-illustration"><BookOpen size={22} /></div><strong>No courses yet</strong><span>Your courses will appear here once created.</span></div>
              )}
              <Link className="panel-footer-link" href="/courses">Manage courses <ArrowRight size={15} /></Link>
            </article>
          </section>

          <div className="dashboard-footnote">
            <span><ArrowUpRight size={14} /> Data reflects records currently stored in your academy.</span>
            <span>Payment summaries include successful transactions only.</span>
          </div>
        </>
      ) : (
        <div className="empty-state panel">
          <div className="empty-illustration"><ArrowDownRight size={22} /></div>
          <h2>Academy data is unavailable</h2><p>We couldn&apos;t load your dashboard. Please try again.</p>
          <button className="button button-primary" onClick={refresh}>Refresh dashboard</button>
        </div>
      )}
    </div>
  );
}
