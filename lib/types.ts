/**
 * Temporary feature flag while Cloudflare Stream video integration is being finalized.
 * Set to `true` to re-enable live video playback, Stream uploads, and durations.
 */
export const STREAM_VIDEO_ENABLED = false;

export type Course = {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice: number;
  thumbnail: string;
  learningOutcomes: string[];
  published: boolean;
  lessonCount?: number;
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  buttonText: string;
  destination: string;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  imageCleanupWarning?: boolean;
};

export type Module = {
  id: string;
  title: string;
  order: number;
};

export type Lesson = {
  id: string;
  courseId: string;
  moduleId: string;
  title: string;
  order: number;
  youtubeVideoId: string;
  streamVideoUid?: string;
  durationSeconds: number;
  thumbnail?: string;
  processingStatus?: "uploading" | "processing" | "ready" | "failed";
  published: boolean;
};

export type Dashboard = {
  revenue: number;
  sales: number;
  enrollments: number;
  students: number;
  courses: number;
  daily: { date: string; revenue: number; enrollments: number }[];
};
