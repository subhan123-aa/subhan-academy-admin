"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UsersRound } from "lucide-react";
import { AdminSectionEmpty, AdminSectionError, AdminSectionHeader, AdminSectionLoading } from "@/components/admin-section";
import { adminRequest, getErrorMessage } from "@/lib/admin-api";
import { useAdminUser } from "../layout";

type Enrollment = { courseId: string; status: string; enrolledAt: string | null };
type Student = {
  uid: string;
  email?: string;
  displayName?: string;
  createdAt: string | null;
  lastLoginAt: string | null;
  disabled: boolean;
  enrollments: Enrollment[];
};

function formatDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

export default function StudentsPage() {
  const user = useAdminUser();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await adminRequest<{ students: Student[] }>(user, "students");
      setStudents(result.students);
      setSelected((current) => current ? result.students.find((student) => student.uid === current.uid) ?? null : null);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void adminRequest<{ students: Student[] }>(user, "students").then((result) => {
      if (active) setStudents(result.students);
    }).catch((loadError: unknown) => {
      if (active) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (students ?? []).filter((student) =>
      !term ||
      student.uid.toLowerCase().includes(term) ||
      student.email?.toLowerCase().includes(term) ||
      student.displayName?.toLowerCase().includes(term),
    );
  }, [search, students]);

  return (
    <div>
      <AdminSectionHeader eyebrow="LEARNER DIRECTORY" title="Students" description="Firebase Authentication accounts and their academy enrollments." />
      <AdminSectionError message={error} onRetry={() => void load()} />
      <section className="course-overview-strip">
        <div className="overview-course-count"><span className="overview-icon"><UsersRound size={19} /></span><div><strong>{students?.length ?? "—"}</strong><span>Registered accounts</span></div></div>
        <span className="overview-divider" />
        <div className="overview-status"><span className="status-dot published-dot" /><span>Enrolled</span><strong>{students?.filter((student) => student.enrollments.length > 0).length ?? "—"}</strong></div>
        <div className="overview-status"><span className="status-dot draft-dot" /><span>Disabled</span><strong>{students?.filter((student) => student.disabled).length ?? "—"}</strong></div>
      </section>
      <section className="panel course-list-panel">
        <div className="course-list-toolbar">
          <div><h2>All students</h2><p>{filtered.length} accounts</p></div>
          <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or UID" aria-label="Search students" /></label>
        </div>
        {loading && !students ? <AdminSectionLoading label="Loading Firebase accounts…" /> : students === null ? (
          <AdminSectionEmpty label="Student accounts could not be loaded." />
        ) : filtered.length ? (
          <div className="course-table-wrap">
            <table className="course-table">
              <thead><tr><th>STUDENT</th><th>STATUS</th><th>ENROLLMENTS</th><th>REGISTERED</th><th>LAST SIGN-IN</th></tr></thead>
              <tbody>
                {filtered.map((student) => (
                  <tr
                    key={student.uid}
                    className="selectable-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(student)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(student);
                      }
                    }}
                  >
                    <td><div className="table-text-stack"><strong>{student.displayName || "Unnamed student"}</strong><small>{student.email || student.uid}</small></div></td>
                    <td><span className={`status-pill ${student.disabled ? "status-draft" : "status-published"}`}><i />{student.disabled ? "Disabled" : "Active"}</span></td>
                    <td>{student.enrollments.length}</td>
                    <td>{formatDate(student.createdAt)}</td>
                    <td>{formatDate(student.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <AdminSectionEmpty label="No student accounts match this search." />}
      </section>
      {selected ? (
        <section className="panel student-detail-panel">
          <div className="panel-heading"><div><h2>{selected.displayName || "Student profile"}</h2><p>{selected.email || "No email address"} · Registered {formatDate(selected.createdAt)}</p></div><button className="button button-quiet" onClick={() => setSelected(null)}>Close</button></div>
          <div className="student-detail-grid">
            <div><span>Firebase UID</span><strong className="uid-value">{selected.uid}</strong></div>
            <div><span>Last sign-in</span><strong>{formatDate(selected.lastLoginAt)}</strong></div>
            <div><span>Account state</span><strong>{selected.disabled ? "Disabled" : "Enabled"}</strong></div>
          </div>
          <h3 className="subsection-title">Enrollment status</h3>
          {selected.enrollments.length ? (
            <div className="student-enrollment-list">{selected.enrollments.map((enrollment) => (
              <div key={`${enrollment.courseId}:${enrollment.status}`}><strong>{enrollment.courseId}</strong><span>{enrollment.status} · {formatDate(enrollment.enrolledAt)}</span></div>
            ))}</div>
          ) : <AdminSectionEmpty label="This account has no course enrollment records." />}
        </section>
      ) : null}
    </div>
  );
}
