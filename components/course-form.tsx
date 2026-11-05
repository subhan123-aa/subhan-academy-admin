"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Course } from "@/lib/types";

type CourseInput = Omit<Course, "lessonCount">;
const STUDENT_APP_COURSE_ID = "build-your-own-local-business";

export default function CourseForm({
  initialCourse,
  onClose,
  onSave,
}: {
  initialCourse?: CourseInput;
  onClose: () => void;
  onSave: (course: CourseInput) => Promise<void>;
}) {
  const [id, setId] = useState(initialCourse?.id ?? "");
  const [customId, setCustomId] = useState(false);
  const [title, setTitle] = useState(initialCourse?.title ?? "");
  const [description, setDescription] = useState(initialCourse?.description ?? "");
  const [price, setPrice] = useState(initialCourse?.price ?? 0);
  const [originalPrice, setOriginalPrice] = useState(initialCourse?.originalPrice ?? 0);
  const [thumbnail, setThumbnail] = useState(initialCourse?.thumbnail ?? "");
  const [outcomes, setOutcomes] = useState(initialCourse?.learningOutcomes.join("\n") ?? "");
  const [published, setPublished] = useState(initialCourse?.published ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const isEditing = Boolean(initialCourse);
  const canPublish = id === STUDENT_APP_COURSE_ID;
  const discountPercent = originalPrice > 0 && price <= originalPrice
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const learningOutcomes = outcomes.split("\n").map((outcome) => outcome.trim()).filter(Boolean);
    if (learningOutcomes.length < 2) {
      setError("Add at least two learning outcomes, one per line.");
      return;
    }
    if (
      !Number.isInteger(price) ||
      !Number.isInteger(originalPrice) ||
      price < 0 ||
      originalPrice < price ||
      (published && price < 1)
    ) {
      setError("Enter whole-number prices and keep the original price at least as high as the selling price.");
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]{2,100}$/.test(id)) {
      setError("Use a course ID with lowercase letters, numbers, and hyphens.");
      return;
    }
    if (
      initialCourse?.published &&
      !published &&
      !window.confirm("Unpublishing hides this course and removes lesson access for enrolled students. Continue?")
    ) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        id,
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        originalPrice: Number(originalPrice),
        thumbnail: thumbnail.trim(),
        learningOutcomes,
        published,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The course could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSaving) onClose();
    }}>
      <section className="modal course-modal" role="dialog" aria-modal="true" aria-labelledby="course-form-title">
        <div className="modal-heading">
          <div><span className="eyebrow">{isEditing ? "COURSE DETAILS" : "NEW COURSE"}</span><h2 id="course-form-title">{isEditing ? "Edit course" : "Create a course"}</h2></div>
          <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button>
        </div>
        <form className="modal-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="form-field form-span-two"><span>Course title</span><input value={title} onChange={(event) => {
              const nextTitle = event.target.value;
              setTitle(nextTitle);
              if (!isEditing && !customId) setId(nextTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
            }} maxLength={120} required placeholder="e.g. Build Your Own Local Business" /></label>
            <label className="form-field form-span-two"><span>Course ID <small>Used in existing app links</small></span><input value={id} onChange={(event) => { setCustomId(true); setId(event.target.value); }} disabled={isEditing} maxLength={101} required /></label>
            <label className="form-field form-span-two"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={5000} required placeholder="What will students learn in this course?" /></label>
            <label className="form-field"><span>Selling price (INR)</span><input type="number" min="0" step="1" value={price} onChange={(event) => setPrice(Number(event.target.value))} required /><small>Active course checkout uses the latest saved selling price, less any valid coupon.</small></label>
            <label className="form-field"><span>Original price (INR)</span><input type="number" min="0" step="1" value={originalPrice} onChange={(event) => setOriginalPrice(Number(event.target.value))} required /><small>Discount: {discountPercent}%</small></label>
            <label className="form-field form-span-two"><span>Thumbnail URL <small>Optional</small></span><input type="url" value={thumbnail} onChange={(event) => setThumbnail(event.target.value)} placeholder="https://…" /></label>
            <label className="form-field form-span-two"><span>Learning outcomes <small>One per line · at least 2</small></span><textarea value={outcomes} onChange={(event) => setOutcomes(event.target.value)} rows={4} required placeholder={"Learn the fundamentals\nBuild a practical plan"} /></label>
          </div>
          <label className="publish-toggle"><input type="checkbox" checked={published} disabled={!canPublish && !published} onChange={(event) => setPublished(event.target.checked)} /><span><strong>{published ? "Course active" : "Course inactive"}</strong><small>{canPublish ? "Active courses appear in the student app and can be purchased at the saved selling price." : "The current student app supports only its configured course. This course can be saved as a draft until multi-course checkout is added."}</small></span></label>
          {error ? <div className="form-alert" role="alert">{error}</div> : null}
          <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose} disabled={isSaving}>Cancel</button><button type="submit" className="button button-primary" disabled={isSaving}>{isSaving ? "Saving…" : isEditing ? "Save changes" : "Create course"}</button></div>
        </form>
      </section>
    </div>
  );
}
