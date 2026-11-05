"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { Clapperboard, Copy, Pencil, Play, Plus, RefreshCw, Search, Trash2, Upload, X } from "lucide-react";
import { Upload as TusUpload } from "tus-js-client";
import { AdminSectionEmpty, AdminSectionError, AdminSectionHeader, AdminSectionLoading } from "@/components/admin-section";
import { adminRequest, getErrorMessage, uploadDirectVideo } from "@/lib/admin-api";
import { STREAM_VIDEO_ENABLED, type Course, type Lesson, type Module } from "@/lib/types";
import { useAdminUser } from "../layout";

const tusThreshold = 200 * 1024 * 1024;
const uploadUrlStorageKey = (uid: string) => `subhan-stream-upload-url:${uid}`;

type VideoState = "uploading" | "processing" | "ready" | "failed";
type StreamVideo = {
  uid: string;
  meta?: { name?: string; description?: string; courseId?: string; moduleId?: string; lessonId?: string };
  status?: { state?: string; errorReasonText?: string };
  duration?: number | null;
  thumbnail?: string;
  requireSignedURLs?: boolean;
};
type CourseContent = { course: Course; modules: Module[]; lessons: Lesson[] };
type UploadResponse = { uid: string; uploadURL: string; uploadType: "post" | "tus" };
type EditVideo = { uid: string; name: string; description: string };

function getVideoState(video: StreamVideo): VideoState {
  if (video.status?.state === "ready") return "ready";
  if (video.status?.state === "error" || video.status?.state === "failed") return "failed";
  return "processing";
}

function formatDuration(seconds: number | null | undefined) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "—";
  const totalSeconds = Math.round(seconds);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function uploadTusFile(
  file: File,
  uploadURL: string,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const upload = new TusUpload(file, {
      uploadUrl: uploadURL,
      chunkSize: 50 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      onProgress: (bytesSent, bytesTotal) => {
        onProgress(Math.round((bytesSent / bytesTotal) * 100));
      },
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

export default function VideoLibraryPage() {
  const user = useAdminUser();
  const [videos, setVideos] = useState<StreamVideo[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [content, setContent] = useState<CourseContent | null>(null);
  const [courseContentLoading, setCourseContentLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonPublished, setLessonPublished] = useState(false);
  const [youtubeVideoId, setYoutubeVideoId] = useState("");
  const [selectedVideoUid, setSelectedVideoUid] = useState("");
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [maxDurationSeconds, setMaxDurationSeconds] = useState("3600");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<EditVideo | null>(null);
  const [previewToken, setPreviewToken] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const contentRequestId = useRef(0);

  const refreshVideos = useCallback(async () => {
    if (!STREAM_VIDEO_ENABLED) {
      setVideos([]);
      return;
    }
    const result = await adminRequest<{ videos: StreamVideo[] }>(user, "videos");
    setVideos(result.videos);
  }, [user]);

  const refreshContent = useCallback(async () => {
    if (!courseId) {
      return;
    }
    const result = await adminRequest<CourseContent>(user, `courses/${encodeURIComponent(courseId)}`);
    setContent(result);
  }, [courseId, user]);

  const loadCourseContent = useCallback(async (id: string) => {
    const requestId = ++contentRequestId.current;
    if (!id) {
      setContent(null);
      setCourseContentLoading(false);
      return;
    }
    setCourseContentLoading(true);
    try {
      const result = await adminRequest<CourseContent>(user, `courses/${encodeURIComponent(id)}`);
      if (requestId === contentRequestId.current) setContent(result);
    } catch (loadError) {
      if (requestId === contentRequestId.current) setError(getErrorMessage(loadError));
    } finally {
      if (requestId === contentRequestId.current) setCourseContentLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      adminRequest<{ courses: Course[] }>(user, "courses"),
      STREAM_VIDEO_ENABLED
        ? adminRequest<{ videos: StreamVideo[] }>(user, "videos")
        : Promise.resolve({ videos: [] as StreamVideo[] }),
    ]).then(([courseResult, videoResult]) => {
      if (!active) return;
      if (courseResult.status === "fulfilled") {
        setCourses(courseResult.value.courses);
        const firstCourseId = courseResult.value.courses[0]?.id ?? "";
        if (firstCourseId) {
          setCourseId((current) => current || firstCourseId);
          void loadCourseContent(firstCourseId);
        }
      } else {
        setError(getErrorMessage(courseResult.reason));
      }
      if (videoResult.status === "fulfilled") {
        setVideos(videoResult.value.videos);
      } else if (STREAM_VIDEO_ENABLED) {
        setError(getErrorMessage(videoResult.reason));
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loadCourseContent, user]);

  const selectedLesson = useMemo(
    () => content?.lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [content, selectedLessonId],
  );
  const selectedVideo = useMemo(
    () => videos.find((video) => video.uid === selectedVideoUid) ?? null,
    [selectedVideoUid, videos],
  );
  const filteredVideos = useMemo(() => {
    const term = search.trim().toLowerCase();
    return videos.filter((video) =>
      !term ||
      video.uid.toLowerCase().includes(term) ||
      video.meta?.name?.toLowerCase().includes(term) ||
      video.meta?.description?.toLowerCase().includes(term),
    );
  }, [search, videos]);
  const pendingVideoIds = useMemo(
    () => videos.filter((video) => !["ready", "error", "failed"].includes(video.status?.state ?? ""))
      .map((video) => video.uid)
      .join(","),
    [videos],
  );

  useEffect(() => {
    if (!pendingVideoIds) return;
    const ids = pendingVideoIds.split(",");
    const interval = window.setInterval(() => {
      void Promise.all(ids.map(async (uid) => {
        try {
          const result = await adminRequest<{ video: StreamVideo }>(
            user,
            `videos/${encodeURIComponent(uid)}/status`,
          );
          setVideos((current) => current.map((video) => video.uid === uid ? result.video : video));
          if (["ready", "error", "failed"].includes(result.video.status?.state ?? "")) {
            await refreshContent();
          }
        } catch (statusError) {
          setError(getErrorMessage(statusError));
        }
      }));
    }, 8000);
    return () => window.clearInterval(interval);
  }, [pendingVideoIds, refreshContent, user]);

  async function load() {
    setBusy(true);
    setError("");
    try {
      await Promise.all([refreshVideos(), refreshContent()]);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }

  async function createModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseId || !newModuleTitle.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await adminRequest<Module>(
        user,
        `courses/${encodeURIComponent(courseId)}/modules`,
        {
          method: "POST",
          body: JSON.stringify({
            title: newModuleTitle.trim(),
            order: content?.modules.length ?? 0,
          }),
        },
      );
      setNewModuleTitle("");
      setSelectedModuleId(result.id);
      await refreshContent();
      setNotice("Module created.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  function startNewLesson() {
    setSelectedLessonId("");
    setLessonTitle("");
    setLessonPublished(false);
    setYoutubeVideoId("");
    setSelectedVideoUid("");
    setUploadName("");
  }

  function selectLesson(lessonId: string) {
    setSelectedLessonId(lessonId);
    const lesson = content?.lessons.find((item) => item.id === lessonId);
    if (!lesson) {
      startNewLesson();
      return;
    }
    setSelectedModuleId(lesson.moduleId);
    setLessonTitle(lesson.title);
    setLessonPublished(lesson.published);
    setYoutubeVideoId(lesson.youtubeVideoId);
    setSelectedVideoUid(lesson.streamVideoUid ?? "");
    setUploadName(lesson.title);
  }

  async function saveLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseId || !lessonTitle.trim()) return;
    setBusy(true);
    setError("");
    const body = {
      courseId,
      moduleId: selectedModuleId,
      title: lessonTitle.trim(),
      order: selectedLesson?.order ?? content?.lessons.length ?? 0,
      youtubeVideoId: selectedVideoUid ? "" : youtubeVideoId.trim(),
      streamVideoUid: selectedVideoUid,
      durationSeconds: selectedVideo?.duration ?? selectedLesson?.durationSeconds ?? 0,
      thumbnail: selectedVideo?.thumbnail ?? selectedLesson?.thumbnail ?? "",
      processingStatus: selectedVideo
        ? getVideoState(selectedVideo)
        : selectedLesson?.processingStatus ?? "failed",
      published: lessonPublished,
    };
    try {
      if (selectedLessonId) {
        await adminRequest(
          user,
          `courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(selectedLessonId)}`,
          { method: "PUT", body: JSON.stringify(body) },
        );
      } else {
        const result = await adminRequest<Lesson>(
          user,
          `courses/${encodeURIComponent(courseId)}/lessons`,
          { method: "POST", body: JSON.stringify(body) },
        );
        setSelectedLessonId(result.id);
      }
      await refreshContent();
      setNotice("Lesson saved.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function uploadVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a video file to upload.");
      return;
    }
    if (!courseId || !content) {
      setError("Select a course before uploading.");
      return;
    }
    if (!uploadName.trim()) {
      setError("Enter a video name.");
      return;
    }
    if (Number(maxDurationSeconds) < 1 || Number(maxDurationSeconds) > 21600) {
      setError("Maximum duration must be from 1 second to 6 hours.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError("");
    setNotice("");
    let uid = "";
    let uploadUrl = "";
    let uploadType: "post" | "tus" = "post";
    let targetLessonId = selectedLessonId;
    try {
      if (!targetLessonId) {
        if (!lessonTitle.trim()) {
          throw new Error("Enter a lesson title or select an existing lesson.");
        }
        const created = await adminRequest<Lesson>(
          user,
          `courses/${encodeURIComponent(courseId)}/lessons`,
          {
            method: "POST",
            body: JSON.stringify({
              courseId,
              moduleId: selectedModuleId,
              title: lessonTitle.trim(),
              order: content.lessons.length,
              youtubeVideoId: "",
              streamVideoUid: "",
              durationSeconds: 0,
              thumbnail: "",
              processingStatus: "failed",
              published: false,
            }),
          },
        );
        targetLessonId = created.id;
        setSelectedLessonId(created.id);
        await refreshContent();
      }

      const savedUploadUrl = file.size > tusThreshold && selectedLesson?.streamVideoUid
        ? sessionStorage.getItem(uploadUrlStorageKey(selectedLesson.streamVideoUid))
        : null;
      if (savedUploadUrl && selectedLesson?.streamVideoUid) {
        uid = selectedLesson.streamVideoUid;
        uploadUrl = savedUploadUrl;
        uploadType = "tus";
        await adminRequest(user, `videos/${encodeURIComponent(uid)}/upload-state`, {
          method: "POST",
          body: JSON.stringify({ state: "uploading" }),
        });
      } else {
        const created = await adminRequest<UploadResponse>(user, "videos", {
          method: "POST",
          body: JSON.stringify({
            name: uploadName.trim(),
            description: uploadDescription.trim(),
            courseId,
            moduleId: selectedModuleId,
            lessonId: targetLessonId,
            maxDurationSeconds: Number(maxDurationSeconds),
            uploadLength: file.size,
          }),
        });
        uid = created.uid;
        uploadUrl = created.uploadURL;
        uploadType = created.uploadType;
        if (uploadType === "tus") {
          sessionStorage.setItem(uploadUrlStorageKey(uid), uploadUrl);
        }
      }

      if (uploadType === "tus") {
        await uploadTusFile(file, uploadUrl, setUploadProgress);
        sessionStorage.removeItem(uploadUrlStorageKey(uid));
      } else {
        await uploadDirectVideo(uploadUrl, file, setUploadProgress);
      }

      const status = await adminRequest<{ video: StreamVideo }>(
        user,
        `videos/${encodeURIComponent(uid)}/status`,
      );
      setVideos((current) => [
        status.video,
        ...current.filter((video) => video.uid !== status.video.uid),
      ]);
      await refreshContent();
      setFile(null);
      setUploadProgress(null);
      setUploadDescription("");
      setNotice(
        getVideoState(status.video) === "ready"
          ? `“${uploadName}” is ready.`
          : `“${uploadName}” uploaded. Cloudflare Stream is processing it.`,
      );
    } catch (uploadError) {
      if (uid) {
        try {
          await adminRequest(user, `videos/${encodeURIComponent(uid)}/upload-state`, {
            method: "POST",
            body: JSON.stringify({ state: "failed" }),
          });
        } catch (statusError) {
          console.error("Could not save the failed video upload state:", statusError);
        }
      }
      setError(getErrorMessage(uploadError));
      if (uid) {
        try {
          await refreshVideos();
        } catch (refreshError) {
          console.error("Could not refresh the video library after an upload error:", refreshError);
        }
      }
    } finally {
      setUploading(false);
    }
  }

  async function refreshVideoStatus(video: StreamVideo) {
    setBusy(true);
    setError("");
    try {
      const result = await adminRequest<{ video: StreamVideo }>(
        user,
        `videos/${encodeURIComponent(video.uid)}/status`,
      );
      setVideos((current) => current.map((item) => item.uid === video.uid ? result.video : item));
      await refreshContent();
    } catch (statusError) {
      setError(getErrorMessage(statusError));
    } finally {
      setBusy(false);
    }
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(user, `videos/${encodeURIComponent(editing.uid)}`, {
        method: "PUT",
        body: JSON.stringify({ name: editing.name.trim(), description: editing.description }),
      });
      setEditing(null);
      await refreshVideos();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function previewVideo(video: StreamVideo) {
    setBusy(true);
    setError("");
    try {
      const result = await adminRequest<{ token: string }>(
        user,
        `videos/${encodeURIComponent(video.uid)}/playback`,
        { method: "POST" },
      );
      setPreviewToken(result.token);
      setPreviewTitle(video.meta?.name || "Video preview");
    } catch (previewError) {
      setError(getErrorMessage(previewError));
    } finally {
      setBusy(false);
    }
  }

  async function deleteVideo(video: StreamVideo) {
    if (!window.confirm(`Permanently delete “${video.meta?.name || video.uid}” from Cloudflare Stream? Its lesson will be unpublished.`)) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await adminRequest(user, `videos/${encodeURIComponent(video.uid)}`, { method: "DELETE" });
      setVideos((current) => current.filter((item) => item.uid !== video.uid));
      await refreshContent();
      setNotice("Video deleted from Cloudflare Stream.");
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setBusy(false);
    }
  }

  async function copyVideoId(uid: string) {
    try {
      await navigator.clipboard.writeText(uid);
      setNotice("Stream video ID copied.");
    } catch (copyError) {
      setError(getErrorMessage(copyError));
    }
  }

  return (
    <div>
      <AdminSectionHeader
        eyebrow="VIDEO CONTENT"
        title="Video library"
        description="Upload private Cloudflare Stream videos, connect them to lessons, and monitor processing."
      />
      {!STREAM_VIDEO_ENABLED ? (
        <div className="success-alert" role="status">
          <strong>Course video lessons — Coming Soon:</strong> Cloudflare Stream video uploads and playback are currently disabled and will be enabled soon. You can still manage course modules and lesson titles below.
        </div>
      ) : null}
      <AdminSectionError message={error} onRetry={() => void load()} />
      {notice ? <div className="success-alert" role="status">{notice}</div> : null}

      <section className="panel stream-course-panel">
        <div className="panel-heading">
          <div><h2>Course and lesson</h2><p>Select where this video belongs before creating an upload.</p></div>
          <button className="button button-quiet" onClick={() => void load()} disabled={busy || uploading}>
            <RefreshCw size={14} />Refresh
          </button>
        </div>
        <div className="stream-manager-grid">
          <label className="form-field"><span>Course</span><select value={courseId} onChange={(event) => {
            const id = event.target.value;
            setCourseId(id);
            setContent(null);
            setSelectedModuleId("");
            startNewLesson();
            void loadCourseContent(id);
          }} disabled={loading}><option value="">Select a course</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}</select></label>
          <label className="form-field"><span>Module</span><select value={selectedModuleId} onChange={(event) => setSelectedModuleId(event.target.value)} disabled={!content}><option value="">No module</option>{(content?.modules ?? []).slice().sort((left, right) => left.order - right.order).map((module) => <option value={module.id} key={module.id}>{module.title}</option>)}</select></label>
          <label className="form-field"><span>Lesson</span><select value={selectedLessonId} onChange={(event) => {
            selectLesson(event.target.value);
          }} disabled={!content}><option value="">Create a new lesson</option>{(content?.lessons ?? []).slice().sort((left, right) => left.order - right.order).map((lesson) => <option value={lesson.id} key={lesson.id}>{lesson.title}</option>)}</select></label>
        </div>
        {courseContentLoading ? <AdminSectionLoading label="Loading course modules and lessons…" /> : null}
        <form className="stream-module-create" onSubmit={(event) => void createModule(event)}>
          <label className="form-field"><span>Create module</span><input value={newModuleTitle} onChange={(event) => setNewModuleTitle(event.target.value)} maxLength={120} placeholder="e.g. Finding your first customers" disabled={!courseId} /></label>
          <button className="button button-quiet" type="submit" disabled={!courseId || busy || !newModuleTitle.trim()}><Plus size={14} />Add module</button>
        </form>

        <form className="stream-lesson-form" onSubmit={(event) => void saveLesson(event)}>
          <div className="panel-subheading"><div><h3>{selectedLesson ? "Edit lesson" : "Create lesson"}</h3><p>{STREAM_VIDEO_ENABLED ? "Unpublished lessons remain hidden until a ready video is connected." : "Video playback is Coming Soon. Organize lesson titles and modules now."}</p></div></div>
          <div className="stream-manager-grid">
            <label className="form-field"><span>Lesson title</span><input value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} maxLength={160} required disabled={!courseId} /></label>
            <label className="form-field"><span>Video</span><select value={selectedVideoUid} onChange={(event) => {
              const uid = event.target.value;
              setSelectedVideoUid(uid);
              if (uid) setYoutubeVideoId("");
            }} disabled={!courseId || !STREAM_VIDEO_ENABLED}><option value="">{STREAM_VIDEO_ENABLED ? "Choose a Stream video" : "Cloudflare Stream — Coming Soon"}</option>{videos.map((video) => <option value={video.uid} key={video.uid} disabled={getVideoState(video) !== "ready"}>{video.meta?.name || video.uid} · {getVideoState(video)}</option>)}</select></label>
            {STREAM_VIDEO_ENABLED && selectedVideoUid ? <label className="form-field form-span-two"><span>Legacy YouTube video ID <small>Leave blank to use the private Stream video.</small></span><input value={youtubeVideoId} onChange={(event) => setYoutubeVideoId(event.target.value)} maxLength={128} /></label> : null}
          </div>
          {selectedLesson ? <div className="stream-current-video">
            {selectedLesson.thumbnail ? <Image src={selectedLesson.thumbnail} alt="" width={72} height={48} unoptimized /> : <Clapperboard size={18} />}
            <span>{STREAM_VIDEO_ENABLED ? (selectedLesson.streamVideoUid ? `Stream ${selectedLesson.streamVideoUid} · ${selectedLesson.processingStatus ?? "processing"}` : selectedLesson.youtubeVideoId || "No video connected") : "Video lesson · Coming Soon"}</span>
            {!STREAM_VIDEO_ENABLED ? <span className="status-pill status-published"><i />Coming Soon</span> : null}
          </div> : null}
          <label className="publish-toggle"><input type="checkbox" checked={lessonPublished} onChange={(event) => setLessonPublished(event.target.checked)} /><span><strong>Publish this lesson</strong><small>Cloudflare lessons can only be published after processing is ready.</small></span></label>
          <div className="stream-lesson-actions">
            <button type="submit" className="button button-primary" disabled={busy || uploading || !courseId || !lessonTitle.trim()}>
              {selectedLesson ? "Save lesson" : "Create lesson"}
            </button>
            {selectedLesson ? <button type="button" className="button button-quiet" onClick={startNewLesson} disabled={busy || uploading}>New lesson</button> : null}
          </div>
        </form>
      </section>

      <section className="panel video-upload-panel stream-upload-panel">
        <div className="panel-heading">
          <div><h2>Upload a lesson video</h2><p>{STREAM_VIDEO_ENABLED ? "Videos over 200 MB use resumable TUS uploads directly to Cloudflare." : "Cloudflare Stream direct video uploads will be enabled soon."}</p></div>
          <span className="panel-badge"><Clapperboard size={13} /> {STREAM_VIDEO_ENABLED ? "Private Stream" : "Coming Soon"}</span>
        </div>
        <form className="form-grid video-upload-form" onSubmit={(event) => void uploadVideo(event)}>
          <label className="form-field"><span>Video name</span><input value={uploadName} onChange={(event) => setUploadName(event.target.value)} maxLength={120} required disabled={!STREAM_VIDEO_ENABLED} /></label>
          <label className="form-field"><span>Maximum duration (seconds)</span><input type="number" min="1" max="21600" step="1" value={maxDurationSeconds} onChange={(event) => setMaxDurationSeconds(event.target.value)} required disabled={!STREAM_VIDEO_ENABLED} /></label>
          <label className="form-field form-span-two"><span>Description</span><textarea value={uploadDescription} onChange={(event) => setUploadDescription(event.target.value)} maxLength={1000} rows={2} disabled={!STREAM_VIDEO_ENABLED} /></label>
          <label className="form-field form-span-two"><span>Video file <small>MP4 recommended. Large uploads can resume if interrupted in this browser session.</small></span><input type="file" accept="video/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required disabled={!STREAM_VIDEO_ENABLED} /></label>
          {uploadProgress !== null ? <div className="form-span-two stream-upload-progress"><div><span>{uploading ? "Uploading video" : "Upload complete"}</span><strong>{uploadProgress}%</strong></div><progress max="100" value={uploadProgress} /></div> : null}
          <div className="form-span-two video-upload-actions"><button className="button button-primary" type="submit" disabled={!STREAM_VIDEO_ENABLED || uploading || busy || !courseId || !content || (!selectedLessonId && !lessonTitle.trim()) || !file}><Upload size={15} />{!STREAM_VIDEO_ENABLED ? "Upload to Stream — Coming Soon" : uploading ? "Uploading…" : selectedLesson?.processingStatus === "failed" ? "Retry failed upload" : "Upload to Stream"}</button></div>
        </form>
      </section>

      <section className="panel course-list-panel video-list-panel">
        <div className="course-list-toolbar">
          <div><h2>Stream videos</h2><p>{STREAM_VIDEO_ENABLED ? `${filteredVideos.length} videos` : "Coming Soon"}</p></div>
          <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search videos" aria-label="Search videos" disabled={!STREAM_VIDEO_ENABLED} /></label>
        </div>
        {loading && videos.length === 0 ? <AdminSectionLoading label="Loading Cloudflare Stream videos…" /> : videos.length === 0 ? (
          <AdminSectionEmpty label={STREAM_VIDEO_ENABLED ? "No Stream videos found. Upload a lesson video to get started." : "Cloudflare Stream video playback and uploads are Coming Soon."} />
        ) : filteredVideos.length ? (
          <div className="course-table-wrap"><table className="course-table video-table">
            <thead><tr><th>VIDEO</th><th>STATUS</th><th>DURATION</th><th>VIDEO ID</th><th>ACTIONS</th></tr></thead>
            <tbody>{filteredVideos.map((video) => {
              const state = getVideoState(video);
              return <tr key={video.uid}>
                <td><div className="video-row"><div className="video-thumbnail">{video.thumbnail ? <Image src={video.thumbnail} alt="" width={54} height={38} unoptimized /> : <Clapperboard size={18} />}</div><div className="table-text-stack"><strong>{video.meta?.name || "Untitled video"}</strong><small>{video.meta?.description || video.uid}</small></div></div></td>
                <td><span className={`status-pill ${state === "ready" ? "status-published" : state === "failed" ? "status-draft status-failed" : "status-draft"}`}><i />{STREAM_VIDEO_ENABLED ? state : "Coming Soon"}</span></td>
                <td>{STREAM_VIDEO_ENABLED ? formatDuration(video.duration) : "Coming Soon"}</td>
                <td><code className="playback-id">{video.uid}</code><button className="icon-button row-action" title="Copy video ID" aria-label="Copy video ID" onClick={() => void copyVideoId(video.uid)}><Copy size={14} /></button></td>
                <td><div className="course-actions">
                  <button className="icon-button row-action" aria-label="Preview video" title="Preview video" disabled={!STREAM_VIDEO_ENABLED || busy || state !== "ready"} onClick={() => void previewVideo(video)}><Play size={15} /></button>
                  <button className="icon-button row-action" aria-label="Refresh processing status" title="Refresh status" disabled={busy} onClick={() => void refreshVideoStatus(video)}><RefreshCw size={14} /></button>
                  <button className="icon-button row-action" aria-label="Edit video metadata" title="Edit metadata" disabled={busy} onClick={() => setEditing({ uid: video.uid, name: video.meta?.name ?? "", description: video.meta?.description ?? "" })}><Pencil size={15} /></button>
                  <button className="icon-button row-action row-action-danger" aria-label="Delete video" title="Delete video" disabled={busy || uploading} onClick={() => void deleteVideo(video)}><Trash2 size={15} /></button>
                </div></td>
              </tr>;
            })}</tbody>
          </table></div>
        ) : <AdminSectionEmpty label="No Stream videos match this search." />}
      </section>

      {editing ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setEditing(null); }}>
        <section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="video-edit-title">
          <div className="modal-heading"><div><span className="eyebrow">STREAM METADATA</span><h2 id="video-edit-title">Edit video details</h2></div><button className="icon-button" aria-label="Close dialog" onClick={() => setEditing(null)}><X size={20} /></button></div>
          <form className="modal-form" onSubmit={(event) => void saveMetadata(event)}>
            <label className="form-field"><span>Name</span><input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} maxLength={120} required /></label>
            <label className="form-field video-description-field"><span>Description</span><textarea value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} maxLength={1000} rows={4} /></label>
            <div className="modal-actions"><button className="button button-quiet" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" disabled={busy}>Save metadata</button></div>
          </form>
        </section>
      </div> : null}

      {previewToken ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setPreviewToken(""); setPreviewTitle(""); } }}>
        <section className="modal stream-preview-modal" role="dialog" aria-modal="true" aria-labelledby="video-preview-title">
          <div className="modal-heading"><div><span className="eyebrow">SIGNED PREVIEW</span><h2 id="video-preview-title">{previewTitle}</h2></div><button className="icon-button" aria-label="Close preview" onClick={() => { setPreviewToken(""); setPreviewTitle(""); }}><X size={20} /></button></div>
          <iframe
            className="stream-preview-frame"
            src={`https://videodelivery.net/${encodeURIComponent(previewToken)}/iframe?controls=true`}
            title={previewTitle}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
          />
          <p className="stream-preview-note">This preview uses a short-lived signed token. No public playback URL is stored.</p>
        </section>
      </div> : null}
    </div>
  );
}
