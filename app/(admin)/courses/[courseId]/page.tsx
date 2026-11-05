"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Check,
  CirclePlus,
  Clock3,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Trash2,
  Video,
  X,
} from "lucide-react";
import CourseForm from "@/components/course-form";
import { adminRequest, getErrorMessage } from "@/lib/admin-api";
import { STREAM_VIDEO_ENABLED, type Course, type Lesson, type Module } from "@/lib/types";
import { useAdminUser } from "../../layout";

type CourseContent = { course: Course; modules: Module[]; lessons: Lesson[] };
type StreamVideo = {
  uid: string;
  meta?: { name?: string };
  status?: { state?: string };
  duration?: number | null;
  thumbnail?: string;
};

function sortedByOrder<T extends { order: number }>(items: T[]) {
  return [...items].sort((a, b) => a.order - b.order);
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
}

function ModuleDialog({
  initialModule,
  nextOrder,
  onClose,
  onSave,
}: {
  initialModule?: Module;
  nextOrder: number;
  onClose: () => void;
  onSave: (value: { title: string; order: number }) => Promise<void>;
}) {
  const [title, setTitle] = useState(initialModule?.title ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave({ title: title.trim(), order: initialModule?.order ?? nextOrder });
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="module-dialog-title">
        <div className="modal-heading"><div><span className="eyebrow">{initialModule ? "EDIT MODULE" : "NEW MODULE"}</span><h2 id="module-dialog-title">{initialModule ? "Update module" : "Add a module"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>
        <form className="modal-form" onSubmit={submit}>
          <label className="form-field"><span>Module title</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder="e.g. Getting started" /></label>
          {error ? <div className="form-alert" role="alert">{error}</div> : null}
          <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving…" : initialModule ? "Save module" : "Add module"}</button></div>
        </form>
      </section>
    </div>
  );
}

function LessonDialog({
  initialLesson,
  modules,
  videos,
  videoLoadError,
  nextOrder,
  onClose,
  onSave,
}: {
  initialLesson?: Lesson;
  modules: Module[];
  videos: StreamVideo[];
  videoLoadError: string;
  nextOrder: number;
  onClose: () => void;
  onSave: (value: Omit<Lesson, "id">) => Promise<void>;
}) {
  const [title, setTitle] = useState(initialLesson?.title ?? "");
  const [moduleId, setModuleId] = useState(initialLesson?.moduleId ?? "");
  const [videoId, setVideoId] = useState(initialLesson?.youtubeVideoId ?? "");
  const [streamVideoUid, setStreamVideoUid] = useState(initialLesson?.streamVideoUid ?? "");
  const [minutes, setMinutes] = useState(initialLesson ? initialLesson.durationSeconds / 60 : 0);
  const [published, setPublished] = useState(initialLesson?.published ?? false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave({
        courseId: initialLesson?.courseId ?? "",
        moduleId,
        title: title.trim(),
        order: initialLesson?.order ?? nextOrder,
        youtubeVideoId: streamVideoUid ? "" : videoId.trim(),
        streamVideoUid,
        durationSeconds: Math.round(Number(minutes) * 60),
        thumbnail: videos.find((video) => video.uid === streamVideoUid)?.thumbnail ?? initialLesson?.thumbnail ?? "",
        processingStatus: streamVideoUid
          ? "ready"
          : initialLesson?.processingStatus ?? "failed",
        published,
      });
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section className="modal lesson-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-dialog-title">
        <div className="modal-heading"><div><span className="eyebrow">{initialLesson?.id ? "EDIT LESSON" : "NEW LESSON"}</span><h2 id="lesson-dialog-title">{initialLesson?.id ? "Update lesson" : "Add a lesson"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>
        <form className="modal-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="form-field form-span-two"><span>Lesson title</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder="e.g. Introduction to the course" /></label>
            <label className="form-field form-span-two"><span>Module</span><select value={moduleId} onChange={(event) => setModuleId(event.target.value)}><option value="">No module (unassigned)</option>{sortedByOrder(modules).map((module) => <option value={module.id} key={module.id}>{module.title}</option>)}</select></label>
            {!STREAM_VIDEO_ENABLED ? (
              <div className="form-span-two pricing-success" role="status">
                Cloudflare Stream video playback is Coming Soon. Lesson titles and curriculum structure can be organized now.
              </div>
            ) : null}
            <label className="form-field form-span-two"><span>Cloudflare Stream video <small>{STREAM_VIDEO_ENABLED ? "Only ready videos are available to publish." : "Coming Soon"}</small></span><select value={streamVideoUid} disabled={!STREAM_VIDEO_ENABLED} onChange={(event) => {
              const uid = event.target.value;
              setStreamVideoUid(uid);
              if (uid) {
                setVideoId("");
                const video = videos.find((item) => item.uid === uid);
                if (typeof video?.duration === "number") setMinutes(video.duration / 60);
              }
            }}><option value="">{STREAM_VIDEO_ENABLED ? "Use a YouTube video instead" : "Cloudflare Stream — Coming Soon"}</option>{videos.filter((video) => video.status?.state === "ready").map((video) => <option value={video.uid} key={video.uid}>{video.meta?.name || video.uid}</option>)}</select></label>
            {STREAM_VIDEO_ENABLED && !streamVideoUid ? <label className="form-field form-span-two"><span>YouTube video ID <small>Legacy lessons can continue using YouTube.</small></span><input value={videoId} onChange={(event) => setVideoId(event.target.value)} maxLength={128} placeholder="e.g. dQw4w9WgXcQ" /></label> : null}
            {STREAM_VIDEO_ENABLED && videoLoadError ? <div className="form-span-two form-alert" role="status">{videoLoadError}</div> : null}
            {STREAM_VIDEO_ENABLED ? <label className="form-field"><span>Duration (minutes)</span><input type="number" min="0" step="0.5" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} required /></label> : null}
          </div>
          <label className="publish-toggle"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /><span><strong>Publish this lesson</strong><small>Visible to enrolled students when the course is published.</small></span></label>
          {error ? <div className="form-alert" role="alert">{error}</div> : null}
          <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving…" : initialLesson?.id ? "Save lesson" : "Add lesson"}</button></div>
        </form>
      </section>
    </div>
  );
}

export default function CourseContentPage() {
  const user = useAdminUser();
  const { courseId: rawCourseId } = useParams<{ courseId: string }>();
  const courseId = decodeURIComponent(rawCourseId);
  const [content, setContent] = useState<CourseContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [moduleForm, setModuleForm] = useState<Module | null | undefined>(undefined);
  const [lessonForm, setLessonForm] = useState<Lesson | null | undefined>(undefined);
  const [streamVideos, setStreamVideos] = useState<StreamVideo[]>([]);
  const [videoLoadError, setVideoLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchContent = useCallback(
    () => adminRequest<CourseContent>(user, `courses/${encodeURIComponent(courseId)}`),
    [courseId, user],
  );

  useEffect(() => {
    let active = true;
    void fetchContent().then((result) => {
      if (active) setContent(result);
    }).catch((loadError: unknown) => {
      if (active) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [fetchContent]);

  useEffect(() => {
    if (!STREAM_VIDEO_ENABLED) return;
    let active = true;
    void adminRequest<{ videos: StreamVideo[] }>(user, "videos")
      .then((result) => {
        if (active) {
          setStreamVideos(result.videos);
          setVideoLoadError("");
        }
      })
      .catch((loadError: unknown) => {
        if (active) setVideoLoadError(getErrorMessage(loadError));
      });
    return () => { active = false; };
  }, [user]);

  async function loadContent() {
    try {
      setContent(await fetchContent());
      setError("");
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  const modules = useMemo(() => sortedByOrder(content?.modules ?? []), [content]);
  const lessons = useMemo(() => sortedByOrder(content?.lessons ?? []), [content]);

  async function saveCourse(course: Omit<Course, "lessonCount">) {
    await adminRequest(user, `courses/${encodeURIComponent(courseId)}`, { method: "PUT", body: JSON.stringify(course) });
    setCourseFormOpen(false);
    await loadContent();
  }

  async function saveModule(value: { title: string; order: number }) {
    const isEditing = Boolean(moduleForm);
    await adminRequest(user, isEditing ? `courses/${encodeURIComponent(courseId)}/modules/${encodeURIComponent(moduleForm!.id)}` : `courses/${encodeURIComponent(courseId)}/modules`, {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify(value),
    });
    setModuleForm(undefined);
    await loadContent();
  }

  async function saveLesson(value: Omit<Lesson, "id">) {
    const body = { ...value, courseId };
    const isEditing = Boolean(lessonForm?.id);
    await adminRequest(user, isEditing ? `courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonForm!.id)}` : `courses/${encodeURIComponent(courseId)}/lessons`, {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    setLessonForm(undefined);
    await loadContent();
  }

  async function reorder(collection: "modules" | "lessons", orderedIds: string[]) {
    setBusy(true);
    setError("");
    try {
      await adminRequest(user, `courses/${encodeURIComponent(courseId)}/${collection}/reorder`, {
        method: "POST",
        body: JSON.stringify({ orderedIds }),
      });
      await loadContent();
    } catch (reorderError) {
      setError(getErrorMessage(reorderError));
    } finally {
      setBusy(false);
    }
  }

  async function moveModule(module: Module, offset: -1 | 1) {
    const index = modules.findIndex((item) => item.id === module.id);
    const target = index + offset;
    if (target < 0 || target >= modules.length) return;
    const reordered = [...modules];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await reorder("modules", reordered.map((item) => item.id));
  }

  async function moveLesson(moduleId: string, lessonId: string, offset: -1 | 1) {
    const belongsToGroup = (lesson: Lesson) =>
      moduleId
        ? lesson.moduleId === moduleId
        : !lesson.moduleId || !modules.some((module) => module.id === lesson.moduleId);
    const group = lessons.filter(belongsToGroup);
    const index = group.findIndex((lesson) => lesson.id === lessonId);
    const target = index + offset;
    if (target < 0 || target >= group.length) return;
    [group[index], group[target]] = [group[target], group[index]];
    const next = new Map(group.map((lesson, order) => [lesson.id, order]));
    const orderedIds = [
      ...group.map((lesson) => lesson.id),
    ];
    orderedIds.sort((a, b) => (next.get(a) ?? 0) - (next.get(b) ?? 0));
    const orderedGroup = new Set(orderedIds);
    const combined = lessons.filter((lesson) => !orderedGroup.has(lesson.id));
    const firstGroupIndex = lessons.findIndex((lesson) => orderedGroup.has(lesson.id));
    combined.splice(firstGroupIndex < 0 ? combined.length : firstGroupIndex, 0, ...orderedIds.map((id) => lessons.find((lesson) => lesson.id === id)!));
    await reorder("lessons", combined.map((lesson) => lesson.id));
  }

  async function deleteModule(module: Module) {
    if (!window.confirm(`Delete “${module.title}”? Lessons in it must be moved first.`)) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(user, `courses/${encodeURIComponent(courseId)}/modules/${encodeURIComponent(module.id)}`, { method: "DELETE" });
      await loadContent();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setBusy(false);
    }
  }

  async function deleteLesson(lesson: Lesson) {
    if (!window.confirm(`Delete “${lesson.title}”? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(user, `courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lesson.id)}`, { method: "DELETE" });
      await loadContent();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setBusy(false);
    }
  }

  async function toggleLessonPublished(lesson: Lesson) {
    setBusy(true);
    setError("");
    try {
      await adminRequest(user, `courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lesson.id)}`, {
        method: "PUT",
        body: JSON.stringify({ ...lesson, published: !lesson.published }),
      });
      await loadContent();
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="content-loading"><span className="spinner" />Loading course content…</div>;
  if (!content) {
    return <div className="empty-state panel"><div className="empty-illustration"><BookOpen size={23} /></div><h2>Course unavailable</h2><p>{error || "This course could not be found."}</p><Link className="button button-quiet" href="/courses"><ArrowLeft size={16} />Back to courses</Link></div>;
  }

  const unassignedLessons = lessons.filter((lesson) => !lesson.moduleId || !modules.some((module) => module.id === lesson.moduleId));
  const allGroups = [...modules.map((module) => ({ id: module.id, title: module.title, module, lessons: lessons.filter((lesson) => lesson.moduleId === module.id) })), ...(unassignedLessons.length ? [{ id: "", title: "Unassigned lessons", module: null, lessons: unassignedLessons }] : [])];

  return (
    <div className="course-content-page">
      <div className="breadcrumb"><Link href="/courses">Courses</Link><span>/</span><span>{content.course.title}</span></div>
      <div className="page-heading heading-with-action course-detail-heading">
        <div><div className="eyebrow">COURSE CONTENT</div><h1>{content.course.title}</h1><p>Manage modules, lessons, and what enrolled students can access.</p></div>
        <div className="heading-actions"><span className={`status-pill ${content.course.published ? "status-published" : "status-draft"}`}><i />{content.course.published ? "Published" : "Draft"}</span><button className="button button-quiet" onClick={() => setCourseFormOpen(true)}><Pencil size={16} />Edit course</button></div>
      </div>

      {error ? <div className="page-alert" role="alert"><span>{error}</span><button className="text-button" onClick={() => setError("")}>Dismiss</button></div> : null}

      <section className="content-summary-row">
        <div className="content-summary-card"><span className="content-summary-icon"><BookOpen size={17} /></span><span><strong>{modules.length}</strong><small>Modules</small></span></div>
        <div className="content-summary-card"><span className="content-summary-icon content-summary-icon-blue"><Play size={16} /></span><span><strong>{lessons.length}</strong><small>Lessons</small></span></div>
        <div className="content-summary-card"><span className="content-summary-icon content-summary-icon-mint"><Check size={17} /></span><span><strong>{lessons.filter((lesson) => lesson.published).length}</strong><small>Published lessons</small></span></div>
        <div className="content-summary-note"><Video size={16} />{STREAM_VIDEO_ENABLED ? "Video IDs use the existing YouTube lesson format." : "Video lessons: Coming Soon (Cloudflare Stream integration in progress)."}</div>
      </section>

      <section className="panel curriculum-panel">
        <div className="curriculum-heading">
          <div><h2>Course curriculum</h2><p>Arrange modules and lessons in the order students will learn them.</p></div>
          <div className="curriculum-actions"><button className="button button-quiet" onClick={() => setModuleForm(null)}><CirclePlus size={16} />Add module</button><button className="button button-primary" onClick={() => setLessonForm(null)}><Plus size={16} />Add lesson</button></div>
        </div>
        {modules.length === 0 && lessons.length === 0 ? (
          <div className="curriculum-empty"><div className="empty-illustration"><BookOpen size={22} /></div><strong>Your curriculum starts here</strong><span>Add a module to organize the course, then add lessons and video IDs.</span><button className="button button-primary" onClick={() => setModuleForm(null)}><Plus size={16} />Add first module</button></div>
        ) : (
          <div className="module-list">
            {allGroups.map(({ id, title, module, lessons: moduleLessons }) => (
              <article className={`module-card ${module ? "" : "module-card-unassigned"}`} key={id || "unassigned"}>
                <div className="module-header">
                  <div className="module-grip"><GripVertical size={18} /></div>
                  {module ? <span className="module-number">{String(module.order + 1).padStart(2, "0")}</span> : <span className="module-number module-number-muted">—</span>}
                  <div className="module-title-wrap"><h3>{title}</h3><span>{moduleLessons.length} {moduleLessons.length === 1 ? "lesson" : "lessons"}</span></div>
                  {module ? <div className="module-header-actions">
                    <button className="icon-button row-action" disabled={busy || modules[0]?.id === module.id} onClick={() => void moveModule(module, -1)} aria-label={`Move ${module.title} up`} title="Move up"><ArrowUp size={16} /></button>
                    <button className="icon-button row-action" disabled={busy || modules.at(-1)?.id === module.id} onClick={() => void moveModule(module, 1)} aria-label={`Move ${module.title} down`} title="Move down"><ArrowDown size={16} /></button>
                    <button className="icon-button row-action" onClick={() => setModuleForm(module)} aria-label={`Edit ${module.title}`} title="Edit module"><Pencil size={15} /></button>
                    <button className="icon-button row-action row-action-danger" disabled={busy} onClick={() => void deleteModule(module)} aria-label={`Delete ${module.title}`} title="Delete module"><Trash2 size={15} /></button>
                  </div> : null}
                </div>
                {moduleLessons.length ? (
                  <div className="lesson-list">
                    {sortedByOrder(moduleLessons).map((lesson, index) => (
                      <div className="lesson-row-admin" key={lesson.id}>
                        <div className="lesson-row-grip"><GripVertical size={16} /></div>
                        <div className="lesson-play-icon"><Play size={13} fill="currentColor" /></div>
                        <div className="lesson-admin-copy">
                          <strong>{lesson.title}</strong>
                          <span>
                            {STREAM_VIDEO_ENABLED ? (
                              <>
                                <Clock3 size={13} />{formatDuration(lesson.durationSeconds)}
                                <span className="lesson-separator">·</span>
                                <span className="lesson-video-label">{lesson.streamVideoUid ? `Stream: ${lesson.streamVideoUid}` : lesson.youtubeVideoId || "No video selected"}</span>
                                {lesson.streamVideoUid ? <span className={`status-pill lesson-status ${lesson.processingStatus === "ready" ? "status-published" : "status-draft"}`}><i />{lesson.processingStatus ?? "processing"}</span> : null}
                              </>
                            ) : (
                              <span className="lesson-video-label">Video lesson · Coming Soon</span>
                            )}
                          </span>
                        </div>
                        {!STREAM_VIDEO_ENABLED ? (
                          <span className="status-pill lesson-status status-published"><i />Coming Soon</span>
                        ) : null}
                        <span className={`status-pill lesson-status ${lesson.published ? "status-published" : "status-draft"}`}><i />{lesson.published ? "Published" : "Draft"}</span>
                        <div className="lesson-actions">
                          <button className="icon-button row-action" disabled={busy || index === 0} onClick={() => void moveLesson(module?.id ?? "", lesson.id, -1)} aria-label={`Move ${lesson.title} up`} title="Move up"><ArrowUp size={15} /></button>
                          <button className="icon-button row-action" disabled={busy || index === moduleLessons.length - 1} onClick={() => void moveLesson(module?.id ?? "", lesson.id, 1)} aria-label={`Move ${lesson.title} down`} title="Move down"><ArrowDown size={15} /></button>
                          <button className="icon-button row-action" disabled={busy} onClick={() => void toggleLessonPublished(lesson)} aria-label={lesson.published ? "Unpublish lesson" : "Publish lesson"} title={lesson.published ? "Unpublish" : "Publish"}>{lesson.published ? <Check size={15} /> : <MoreHorizontal size={15} />}</button>
                          <button className="icon-button row-action" onClick={() => setLessonForm(lesson)} aria-label={`Edit ${lesson.title}`} title="Edit lesson"><Pencil size={15} /></button>
                          <button className="icon-button row-action row-action-danger" disabled={busy} onClick={() => void deleteLesson(lesson)} aria-label={`Delete ${lesson.title}`} title="Delete lesson"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="module-no-lessons">No lessons in this module yet.</div>}
                {module ? <button className="add-lesson-inline" onClick={() => setLessonForm({ id: "", courseId, moduleId: module.id, title: "", order: lessons.length, youtubeVideoId: "", durationSeconds: 0, published: false })}><Plus size={15} />Add lesson to this module</button> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {courseFormOpen ? <CourseForm initialCourse={content.course} onClose={() => setCourseFormOpen(false)} onSave={saveCourse} /> : null}
      {moduleForm !== undefined ? <ModuleDialog initialModule={moduleForm ?? undefined} nextOrder={modules.reduce((max, module) => Math.max(max, module.order), -1) + 1} onClose={() => setModuleForm(undefined)} onSave={saveModule} /> : null}
      {lessonForm !== undefined ? <LessonDialog initialLesson={lessonForm ?? undefined} modules={modules} videos={streamVideos} videoLoadError={videoLoadError} nextOrder={lessons.reduce((max, lesson) => Math.max(max, lesson.order), -1) + 1} onClose={() => setLessonForm(undefined)} onSave={saveLesson} /> : null}
    </div>
  );
}
