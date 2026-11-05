"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, ChevronRight, CirclePlus, Clock3, Eye, EyeOff, Pencil, Plus, Search, Trash2 } from "lucide-react";
import CourseForm from "@/components/course-form";
import { adminRequest, getErrorMessage } from "@/lib/admin-api";
import type { Course } from "@/lib/types";
import { useAdminUser } from "../layout";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function CoursesPage() {
  const user = useAdminUser();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formCourse, setFormCourse] = useState<Course | null | undefined>(undefined);
  const [busyCourseId, setBusyCourseId] = useState("");

  const fetchCourses = useCallback(
    () => adminRequest<{ courses: Course[] }>(user, "courses"),
    [user],
  );

  useEffect(() => {
    let active = true;
    void fetchCourses().then((result) => {
      if (active) setCourses(result.courses);
    }).catch((loadError: unknown) => {
      if (active) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [fetchCourses]);

  async function loadCourses() {
    try {
      const result = await fetchCourses();
      setCourses(result.courses);
      setError("");
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  function refreshCourses() {
    setIsLoading(true);
    setError("");
    void loadCourses();
  }

  const filteredCourses = useMemo(() => {
    const term = search.trim().toLowerCase();
    const availableCourses = courses ?? [];
    return term ? availableCourses.filter((course) => course.title.toLowerCase().includes(term) || course.id.includes(term)) : availableCourses;
  }, [courses, search]);

  async function saveCourse(course: Omit<Course, "lessonCount">) {
    const isExistingCourse = (courses ?? []).some((existing) => existing.id === course.id);
    await adminRequest(user, isExistingCourse ? `courses/${encodeURIComponent(course.id)}` : "courses", {
      method: isExistingCourse ? "PUT" : "POST",
      body: JSON.stringify(course),
    });
    setFormCourse(undefined);
    await loadCourses();
  }

  async function togglePublished(course: Course) {
    if (
      course.published &&
      !window.confirm("Unpublishing hides this course and removes lesson access for enrolled students. Continue?")
    ) return;
    setBusyCourseId(course.id);
    setError("");
    try {
      const { id, title, description, price, originalPrice, thumbnail, learningOutcomes } = course;
      await adminRequest(user, `courses/${encodeURIComponent(course.id)}`, {
        method: "PUT",
        body: JSON.stringify({ id, title, description, price, originalPrice, thumbnail, learningOutcomes, published: !course.published }),
      });
      await loadCourses();
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setBusyCourseId("");
    }
  }

  async function deleteCourse(course: Course) {
    if (!window.confirm(`Delete “${course.title}” and its modules and lessons? This cannot be undone.`)) return;
    setBusyCourseId(course.id);
    setError("");
    try {
      await adminRequest(user, `courses/${encodeURIComponent(course.id)}`, { method: "DELETE" });
      await loadCourses();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setBusyCourseId("");
    }
  }

  const publishedCount = (courses ?? []).filter((course) => course.published).length;
  const draftCount = (courses ?? []).length - publishedCount;

  return (
    <div className="courses-page">
      <div className="page-heading heading-with-action">
        <div><div className="eyebrow">ACADEMY CONTENT</div><h1>Courses</h1><p>Create and manage the courses students see in your app.</p></div>
        <button className="button button-primary" onClick={() => setFormCourse(null)}><Plus size={17} />Create course</button>
      </div>

      <section className="course-overview-strip">
        <div className="overview-course-count"><span className="overview-icon"><BookOpen size={19} /></span><div><strong>{courses?.length ?? "—"}</strong><span>Total courses</span></div></div>
        <span className="overview-divider" />
        <div className="overview-status"><span className="status-dot published-dot" /><span>Published</span><strong>{courses ? publishedCount : "—"}</strong></div>
        <div className="overview-status"><span className="status-dot draft-dot" /><span>Drafts</span><strong>{courses ? draftCount : "—"}</strong></div>
        <div className="overview-hint"><Clock3 size={15} />Changes to published content appear in the student app.</div>
      </section>

      {error ? <div className="page-alert" role="alert"><span>{error}</span><button className="text-button" onClick={refreshCourses}>Try again</button></div> : null}

      <section className="panel course-list-panel">
        <div className="course-list-toolbar">
          <div><h2>All courses</h2><p>{filteredCourses.length} {filteredCourses.length === 1 ? "course" : "courses"}</p></div>
          <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search courses" aria-label="Search courses" /></label>
        </div>
        {isLoading ? <div className="content-loading"><span className="spinner" />Loading courses…</div> : courses === null ? (
          <div className="empty-state course-empty"><div className="empty-illustration"><BookOpen size={22} /></div><h2>Courses couldn&apos;t be loaded</h2><p>Check your connection and try again.</p><button className="button button-primary" onClick={refreshCourses}>Try again</button></div>
        ) : filteredCourses.length ? (
          <div className="course-table-wrap">
            <table className="course-table">
              <thead><tr><th>COURSE</th><th>STATUS</th><th>PRICE</th><th>LESSONS</th><th className="actions-heading">ACTIONS</th></tr></thead>
              <tbody>
                {filteredCourses.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <Link href={`/courses/${encodeURIComponent(course.id)}`} className="course-name-cell">
                        <div className="table-course-thumb">{course.thumbnail ? <Image src={course.thumbnail} alt="" width={38} height={38} unoptimized /> : <BookOpen size={18} />}</div>
                        <span><strong>{course.title}</strong><small>{course.id}</small></span>
                      </Link>
                    </td>
                    <td><span className={`status-pill ${course.published ? "status-published" : "status-draft"}`}><i />{course.published ? "Active" : "Inactive"}</span></td>
                    <td><strong className="price-cell">{formatCurrency(course.price)}</strong>{course.originalPrice > course.price ? <small className="original-price">{formatCurrency(course.originalPrice)}</small> : null}</td>
                    <td><span className="lesson-count">{course.lessonCount ?? 0} lessons</span></td>
                    <td>
                      <div className="course-actions">
                        <Link className="icon-button row-action" href={`/courses/${encodeURIComponent(course.id)}`} aria-label={`Manage ${course.title}`} title="Manage course"><Pencil size={16} /></Link>
                        <button className="icon-button row-action" onClick={() => void togglePublished(course)} disabled={busyCourseId === course.id} aria-label={course.published ? "Unpublish course" : "Publish course"} title={course.published ? "Unpublish" : "Publish"}>{course.published ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                        <button className="icon-button row-action row-action-danger" onClick={() => void deleteCourse(course)} disabled={busyCourseId === course.id || course.id === "build-your-own-local-business"} aria-label={`Delete ${course.title}`} title={course.id === "build-your-own-local-business" ? "This course is wired into the student app and cannot be deleted" : "Delete course"}><Trash2 size={16} /></button>
                        <Link className="icon-button row-action row-action-more" href={`/courses/${encodeURIComponent(course.id)}`} aria-label={`Open ${course.title}`}><ChevronRight size={17} /></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state course-empty">
            <div className="empty-illustration"><CirclePlus size={23} /></div>
            <h2>{search ? "No matching courses" : "Start with your first course"}</h2>
            <p>{search ? "Try a different title or course ID." : "Create a course to organize its modules and lessons."}</p>
            {search ? <button className="button button-quiet" onClick={() => setSearch("")}>Clear search</button> : <button className="button button-primary" onClick={() => setFormCourse(null)}><Plus size={16} />Create course</button>}
          </div>
        )}
      </section>

      {formCourse !== undefined ? <CourseForm initialCourse={formCourse ?? undefined} onClose={() => setFormCourse(undefined)} onSave={saveCourse} /> : null}
    </div>
  );
}
