"use client";

import Image from "next/image";
import { Image as ImageIcon, LoaderCircle, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AdminSectionLoading } from "@/components/admin-section";
import { adminRequest, adminUpload, getErrorMessage } from "@/lib/admin-api";
import { useAdminUser } from "../layout";

type FeaturedCourseBannerResponse = {
  imageUrl?: string;
  featuredBannerUrl?: string;
  imageCleanupWarning?: boolean;
};

const COURSE_ID = "build-your-own-local-business";
const DEFAULT_BANNER_URL = "/sabjihub-blueprint-banner.webp";
const maxImageBytes = 5 * 1024 * 1024;
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];

export default function FeaturedCoursePage() {
  const user = useAdminUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [localPreview, setLocalPreview] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void adminRequest<FeaturedCourseBannerResponse>(user, "featured-course-banner")
      .then((result) => {
        if (active) {
          setImageUrl(result.imageUrl || result.featuredBannerUrl || "");
          setPreviewFailed(false);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setError("");
    setNotice("");
    setUploadProgress(0);
    setUploadedImageUrl("");
    if (!file) return;
    setSelectedFile(null);
    setLocalPreview("");
    setPreviewFailed(false);
    if (!allowedImageTypes.includes(file.type)) {
      setError("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > maxImageBytes) {
      setError("Choose an image smaller than 5 MB.");
      return;
    }
    const preview = URL.createObjectURL(file);
    const decoded = await new Promise<boolean>((resolve) => {
      const image = new window.Image();
      image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
      image.onerror = () => resolve(false);
      image.src = preview;
    });
    if (!decoded) {
      URL.revokeObjectURL(preview);
      setError("The selected image could not be opened. Try another image.");
      return;
    }
    setLocalPreview(preview);
    setSelectedFile(file);
  }

  async function saveBanner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile && !localPreview) {
      setError("Choose a banner image before saving.");
      return;
    }
    setError("");
    setNotice("");
    setUploading(Boolean(selectedFile && !uploadedImageUrl));
    setSaving(true);
    try {
      let nextImageUrl = imageUrl;
      if (selectedFile) {
        if (!uploadedImageUrl) {
          const uploaded = await adminUpload<{ imageUrl: string }>(
            user,
            "banners/upload",
            selectedFile,
            setUploadProgress,
          );
          setUploadedImageUrl(uploaded.imageUrl);
          nextImageUrl = uploaded.imageUrl;
          setUploading(false);
        } else {
          nextImageUrl = uploadedImageUrl;
        }
      }
      const updated = await adminRequest<FeaturedCourseBannerResponse>(
        user,
        "featured-course-banner",
        {
          method: "PUT",
          body: JSON.stringify({ imageUrl: nextImageUrl }),
        },
      );
      const savedUrl = updated.imageUrl || updated.featuredBannerUrl || nextImageUrl;
      setImageUrl(savedUrl);
      setSelectedFile(null);
      setUploadedImageUrl("");
      setLocalPreview("");
      setPreviewFailed(false);
      setUploadProgress(100);
      setNotice(updated.imageCleanupWarning
        ? "Featured course banner saved. The previous R2 image could not be removed."
        : "Featured course banner saved. Students will see it automatically.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setUploading(false);
      setSaving(false);
    }
  }

  return (
    <div className="featured-course-page">
      <div className="page-heading">
        <div className="eyebrow">ACADEMY MANAGEMENT</div>
        <h1>Featured Course Management</h1>
        <p>Update the SabjiHub BluePrint banner shown on the student app Home screen.</p>
      </div>

      <form className="panel featured-course-panel" onSubmit={(event) => void saveBanner(event)}>
        <div className="featured-course-heading">
          <div>
            <span className="featured-course-eyebrow">HOME SCREEN</span>
            <h2>Featured Course Banner</h2>
            <p>Choose the image students see for SabjiHub BluePrint.</p>
          </div>
          <span className="featured-course-format">JPEG, PNG or WebP · up to 5 MB</span>
        </div>

        <div
          className="featured-course-preview"
          aria-label="Current Featured Course banner"
        >
          {(!previewFailed || localPreview) ? (
            <Image
              src={!previewFailed && imageUrl ? imageUrl : DEFAULT_BANNER_URL}
              alt="Current Featured Course banner shown in the Student App"
              fill
              sizes="(max-width: 760px) 100vw, (max-width: 1200px) 75vw, 900px"
              unoptimized
              className="featured-course-preview-image"
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <div className="featured-course-empty">
              <ImageIcon size={24} />
              <strong>Banner preview unavailable</strong>
              <span>Choose a new image to replace the unavailable preview.</span>
            </div>
          )}
          <span className="featured-course-preview-tag">
            {imageUrl ? "Current banner" : "Student App default banner"}
          </span>
        </div>

        {localPreview ? (
          <div className="featured-course-selected-preview">
            <div className="featured-course-selected-heading">
              <strong>Replacement preview</strong>
              <span>Not live until saved</span>
            </div>
            <div className="featured-course-preview">
              <Image
                src={localPreview}
                alt="Selected replacement banner preview"
                fill
                sizes="(max-width: 760px) 100vw, (max-width: 1200px) 75vw, 900px"
                unoptimized
                className="featured-course-preview-image"
              />
              <span className="featured-course-preview-tag">Preview</span>
            </div>
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          className="featured-course-file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => void chooseImage(event)}
          disabled={saving}
          aria-label="Choose a new featured course banner image"
        />

        <div className="featured-course-controls">
          <div className="featured-course-file-info" aria-live="polite">
            {selectedFile ? (
              <>
                <strong>{selectedFile.name}</strong>
                <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to upload</span>
              </>
            ) : (
              <>
                <strong>{loading ? "Loading saved banner…" : imageUrl ? "Current banner is live" : "Student App default banner is live"}</strong>
                <span>The current banner stays live until its replacement is saved.</span>
              </>
            )}
          </div>
          <button
            className="button button-quiet featured-course-upload-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
          >
            <Upload size={15} />
            Upload New Banner
          </button>
        </div>

        {uploading ? (
          <div className="featured-course-progress" role="status" aria-live="polite">
            <div className="featured-course-progress-label">
              <span>Uploading banner to R2</span><strong>{uploadProgress}%</strong>
            </div>
            <div
              className="featured-course-progress-track"
              role="progressbar"
              aria-label="Banner upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={uploadProgress}
            >
              <span style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        ) : null}

        {error ? <div className="featured-course-message featured-course-error" role="alert">{error}</div> : null}
        {notice ? <div className="featured-course-message featured-course-success" role="status">{notice}</div> : null}

        <div className="featured-course-footer">
          <span className="featured-course-footer-note">Changes appear in the student app after saving.</span>
          <button className="button button-primary featured-course-save-button" type="submit" disabled={saving || (!selectedFile && !uploadedImageUrl)}>
            {saving ? <LoaderCircle size={15} className="banner-spinner" /> : <Upload size={15} />}
            {uploading ? `Uploading ${uploadProgress}%` : saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
