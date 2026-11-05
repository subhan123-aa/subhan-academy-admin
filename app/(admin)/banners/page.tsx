"use client";

import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CircleCheck,
  CircleX,
  Image as ImageIcon,
  Images,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { AdminSectionEmpty, AdminSectionError, AdminSectionLoading } from "@/components/admin-section";
import { adminRequest, adminUpload, getErrorMessage } from "@/lib/admin-api";
import type { Banner } from "@/lib/types";
import { useAdminUser } from "../layout";

type BannerDraft = Omit<Banner, "id" | "createdAt" | "updatedAt" | "imageCleanupWarning">;

const maxImageBytes = 5 * 1024 * 1024;
const maxImageDimension = 1600;
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxActiveBanners = 3;

async function optimizeBannerImage(file: File): Promise<File> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The selected banner image could not be decoded."));
      image.src = imageUrl;
    });

    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("The selected banner image has invalid dimensions.");
    }

    const scale = Math.min(1, maxImageDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("The selected banner image could not be optimized.");
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const preferredType = file.type === "image/webp"
      ? "image/png"
      : file.type;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("The selected banner image could not be optimized."));
        },
        "image/webp",
        0.84,
      );
    });
    const outputType = blob.type === "image/webp" ? "image/webp" : preferredType;
    const outputBlob = blob.type === outputType
      ? blob
      : await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (result) => {
              if (result) resolve(result);
              else reject(new Error("The selected banner image could not be optimized."));
            },
            outputType,
            0.84,
          );
        });
    const extension = outputType === "image/webp" ? ".webp" : outputType === "image/jpeg" ? ".jpg" : ".png";
    const filename = `${file.name.replace(/\.[^.]+$/, "")}${extension}`;
    return new File([outputBlob], filename, { type: outputType });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

const blankDraft = (order = 0): BannerDraft => ({
  title: "",
  subtitle: "",
  imageUrl: "",
  buttonText: "",
  destination: "",
  order,
  active: false,
});

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export default function BannersPage() {
  const user = useAdminUser();
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [draft, setDraft] = useState<BannerDraft>(blankDraft());
  const [editingId, setEditingId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const loadBanners = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminRequest<{ banners: Banner[] }>(user, "banners");
      setBanners(result.banners.slice().sort((left, right) => left.order - right.order));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setBanners(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    void adminRequest<{ banners: Banner[] }>(user, "banners")
      .then((result) => {
        if (active) {
          setBanners(result.banners.slice().sort((left, right) => left.order - right.order));
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(getErrorMessage(loadError));
          setBanners(null);
        }
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

  function clearPreview() {
    setSelectedFile(null);
    setLocalPreview("");
    setUploadProgress(0);
  }

  function openCreateForm() {
    setDraft(blankDraft(banners?.length ?? 0));
    setEditingId("");
    clearPreview();
    setError("");
    setNotice("");
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingId("");
    clearPreview();
  }

  function editBanner(banner: Banner) {
    setEditingId(banner.id);
    setDraft({
      title: banner.title,
      subtitle: banner.subtitle,
      imageUrl: banner.imageUrl,
      buttonText: banner.buttonText,
      destination: banner.destination,
      order: banner.order,
      active: banner.active,
    });
    clearPreview();
    setError("");
    setNotice("");
    setIsFormOpen(true);
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (!allowedImageTypes.includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size === 0 || file.size > maxImageBytes) {
      setError("Choose an image larger than 0 bytes and no more than 5 MB.");
      return;
    }
    setError("");
    setNotice("");
    setSelectedFile(file);
    setLocalPreview(URL.createObjectURL(file));
    setUploadProgress(0);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!selectedFile && !isHttpsUrl(draft.imageUrl)) {
      setError("Choose a banner image before saving.");
      return;
    }
    if (draft.destination && draft.destination !== "course" && !isHttpsUrl(draft.destination)) {
      setError("Destination must be “course” or a valid HTTPS URL.");
      return;
    }
    if (!Number.isInteger(draft.order) || draft.order < 0) {
      setError("Display order must be a non-negative whole number.");
      return;
    }
    if (
      draft.active &&
      !banners?.find((banner) => banner.id === editingId)?.active &&
      (banners?.filter((banner) => banner.active).length ?? 0) >= maxActiveBanners
    ) {
      setError("You can have up to 3 active banners. Deactivate another banner first.");
      return;
    }

    setSaving(true);
    try {
      let imageUrl = draft.imageUrl;
      if (selectedFile) {
        setUploading(true);
        const optimizedFile = await optimizeBannerImage(selectedFile);
        const upload = await adminUpload<{ imageUrl: string }>(
          user,
          "banners/upload",
          optimizedFile,
          setUploadProgress,
        );
        if (!isHttpsUrl(upload.imageUrl)) {
          throw new Error("The Worker returned an invalid banner image URL.");
        }
        imageUrl = upload.imageUrl;
      }

      const payload = {
        ...draft,
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        imageUrl,
        buttonText: draft.buttonText.trim(),
        destination: draft.destination.trim(),
      };
      const saved = await adminRequest<Banner>(
        user,
        editingId ? `banners/${encodeURIComponent(editingId)}` : "banners",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      await loadBanners();
      closeForm();
      setNotice(
        saved.imageCleanupWarning
          ? "Banner saved, but its previous uploaded image could not be removed from storage."
          : editingId
            ? "Banner updated."
            : "Banner added.",
      );
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  async function setBannerActive(banner: Banner, active: boolean) {
    if (active && !banner.active && activeCount >= maxActiveBanners) {
      setError("You can have up to 3 active banners. Deactivate another banner first.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await adminRequest<Banner>(user, `banners/${encodeURIComponent(banner.id)}`, {
        method: "PUT",
        body: JSON.stringify({ ...banner, active }),
      });
      await loadBanners();
      setNotice(active ? "Banner activated." : "Banner deactivated.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function changeOrder(banner: Banner, direction: -1 | 1) {
    if (!banners) return;
    const sorted = banners.slice().sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
    const index = sorted.findIndex((item) => item.id === banner.id);
    const destinationIndex = index + direction;
    if (index < 0 || destinationIndex < 0 || destinationIndex >= sorted.length) return;
    const other = sorted[destinationIndex];
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await Promise.all([
        adminRequest<Banner>(user, `banners/${encodeURIComponent(banner.id)}`, {
          method: "PUT",
          body: JSON.stringify({ ...banner, order: other.order }),
        }),
        adminRequest<Banner>(user, `banners/${encodeURIComponent(other.id)}`, {
          method: "PUT",
          body: JSON.stringify({ ...other, order: banner.order }),
        }),
      ]);
      await loadBanners();
      setNotice("Banner order updated.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
      await loadBanners();
    } finally {
      setSaving(false);
    }
  }

  async function deleteBanner(banner: Banner) {
    if (!window.confirm(`Delete “${banner.title || "Untitled banner"}”? This also removes its managed image.`)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await adminRequest<{ deleted: boolean; imageCleanupWarning?: boolean }>(
        user,
        `banners/${encodeURIComponent(banner.id)}`,
        { method: "DELETE" },
      );
      if (editingId === banner.id) closeForm();
      await loadBanners();
      setNotice(result.imageCleanupWarning
        ? "Banner deleted, but its uploaded image could not be removed from storage."
        : "Banner deleted.");
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setSaving(false);
    }
  }

  function handleBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !saving && !uploading) closeForm();
  }

  function handleModalKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !saving && !uploading) closeForm();
  }

  const activeCount = banners?.filter((banner) => banner.active).length ?? 0;
  const totalCount = banners?.length ?? 0;
  const inactiveCount = totalCount - activeCount;
  const previewUrl = localPreview || draft.imageUrl;
  const sortedBanners = banners?.slice().sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)) ?? [];

  return (
    <div className="banners-page">
      <header className="banners-heading">
        <div>
          <h1>Home Banners</h1>
          <p>Manage banners displayed in the student app.</p>
        </div>
        <button className="button button-primary banners-add-button" type="button" onClick={openCreateForm}>
          <Plus size={16} />
          Add Banner
        </button>
      </header>

      <AdminSectionError message={error} onRetry={() => void loadBanners()} />
      {notice ? <div className="success-alert banners-notice" role="status">{notice}</div> : null}

      <section className="banner-stats" aria-label="Banner statistics">
        <article className="banner-stat-card">
          <span className="banner-stat-icon banner-stat-total"><Images size={17} /></span>
          <div><span>Total Banners</span><strong>{loading && !banners ? "—" : totalCount}</strong></div>
        </article>
        <article className="banner-stat-card">
          <span className="banner-stat-icon banner-stat-active"><CircleCheck size={17} /></span>
          <div><span>Active</span><strong>{loading && !banners ? "—" : activeCount}</strong></div>
        </article>
        <article className="banner-stat-card">
          <span className="banner-stat-icon banner-stat-inactive"><CircleX size={17} /></span>
          <div><span>Inactive</span><strong>{loading && !banners ? "—" : inactiveCount}</strong></div>
        </article>
      </section>

      <section className="banners-section" aria-label="Banner list">
        <div className="banners-list-heading">
          <div>
            <h2>Your banners</h2>
            <p>{banners?.length ?? 0} total <span aria-hidden="true">·</span> {activeCount} of {maxActiveBanners} active</p>
          </div>
          <button className="button button-quiet banners-refresh" type="button" onClick={() => void loadBanners()} disabled={loading || saving}>
            Refresh
          </button>
        </div>

        {loading && !banners ? (
          <AdminSectionLoading label="Loading banners…" />
        ) : banners === null ? (
          <AdminSectionEmpty label="Banner records could not be loaded. Try again to refresh." />
        ) : banners.length ? (
          <div className="banners-grid">
            {sortedBanners.map((banner, index) => (
              <article className="banner-card" key={banner.id}>
                <div className="banner-card-image">
                  <Image src={banner.imageUrl} alt={banner.title || "Home banner"} width={720} height={405} unoptimized />
                  <span className={`banner-status ${banner.active ? "banner-status-active" : ""}`}>
                    <i />
                    {banner.active ? "Active" : "Inactive"}
                  </span>
                  <span className="banner-order">Order {index + 1}</span>
                </div>
                <div className="banner-card-content">
                  <div className="banner-card-copy">
                    <h3>{banner.title || "Untitled banner"}</h3>
                    <p>{banner.subtitle || "No subtitle"}</p>
                    {banner.destination ? (
                      <span className="banner-destination">
                        {banner.destination === "course" ? "Course details" : "External link"}
                      </span>
                    ) : null}
                  </div>
                  <div className="banner-card-actions">
                    <button
                      className="button button-quiet banner-icon-action"
                      type="button"
                      aria-label={`Move ${banner.title || "banner"} up`}
                      title="Move up"
                      disabled={saving || index === 0}
                      onClick={() => void changeOrder(banner, -1)}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="button button-quiet banner-icon-action"
                      type="button"
                      aria-label={`Move ${banner.title || "banner"} down`}
                      title="Move down"
                      disabled={saving || index === sortedBanners.length - 1}
                      onClick={() => void changeOrder(banner, 1)}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      className="button button-quiet banner-status-action"
                      type="button"
                      disabled={saving || (!banner.active && activeCount >= maxActiveBanners)}
                      onClick={() => void setBannerActive(banner, !banner.active)}
                    >
                      {banner.active ? <X size={14} /> : <Check size={14} />}
                      {banner.active ? "Deactivate" : "Activate"}
                    </button>
                    <button className="button button-quiet banner-icon-action" type="button" aria-label="Edit banner" disabled={saving} onClick={() => editBanner(banner)}>
                      <Pencil size={14} />
                    </button>
                    <button className="button button-quiet banner-icon-action banner-delete-action" type="button" aria-label="Delete banner" disabled={saving} onClick={() => void deleteBanner(banner)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="banners-empty">
            <span className="banners-empty-icon"><Upload size={21} /></span>
            <h3>No banners yet</h3>
            <p>Add a banner to feature content on the student app home screen.</p>
            <button className="button button-primary" type="button" onClick={openCreateForm}>
              <Plus size={15} />Add Banner
            </button>
          </div>
        )}
      </section>

      {isFormOpen ? (
        <div className="banner-modal-backdrop" onClick={handleBackdropClick} onKeyDown={handleModalKeyDown}>
          <section className="banner-modal" role="dialog" aria-modal="true" aria-labelledby="banner-form-title">
            <header className="banner-modal-header">
              <div>
                <span className="banner-modal-eyebrow">{editingId ? "BANNER DETAILS" : "NEW HOME BANNER"}</span>
                <h2 id="banner-form-title">{editingId ? "Edit banner" : "Add Banner"}</h2>
                <p>Choose an image and preview it before saving.</p>
              </div>
              <button className="button button-quiet banner-icon-action" type="button" aria-label="Close dialog" disabled={saving || uploading} onClick={closeForm}>
                <X size={17} />
              </button>
            </header>

            <form className="banner-form" onSubmit={(event) => void submit(event)}>
              <label className="banner-field">
                <span>Banner image <small>JPEG, PNG or WebP · up to 5 MB</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} disabled={saving || uploading} />
              </label>

              {previewUrl ? (
                <div className="banner-form-preview" aria-label="Banner preview">
                  <Image src={previewUrl} alt="Selected banner preview" width={720} height={405} unoptimized />
                  {draft.title || draft.subtitle || draft.buttonText ? (
                    <div className="banner-form-preview-copy">
                      {draft.title ? <strong>{draft.title}</strong> : null}
                      {draft.subtitle ? <span>{draft.subtitle}</span> : null}
                      {draft.buttonText ? <b>{draft.buttonText}</b> : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="banner-preview-placeholder">
                  <ImageIcon size={22} />
                  <span>Image preview will appear here</span>
                </div>
              )}

              {uploading ? (
                <div className="banner-upload-progress" role="status" aria-live="polite">
                  <div><span>Uploading image</span><strong>{uploadProgress}%</strong></div>
                  <progress value={uploadProgress} max="100" />
                </div>
              ) : selectedFile ? (
                <p className="banner-file-detail">{selectedFile.name} · {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              ) : null}

              <div className="banner-form-fields">
                <label className="banner-field">
                  <span>Title <small>Optional</small></span>
                  <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={120} placeholder="Add a short title" disabled={saving} />
                </label>
                <label className="banner-field">
                  <span>Subtitle <small>Optional</small></span>
                  <input value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} maxLength={240} placeholder="Add a supporting line" disabled={saving} />
                </label>
                <label className="banner-field">
                  <span>Action label <small>Optional</small></span>
                  <input value={draft.buttonText} onChange={(event) => setDraft({ ...draft, buttonText: event.target.value })} maxLength={40} placeholder="e.g. Explore course" disabled={saving} />
                </label>
                <label className="banner-field">
                  <span>Destination <small>Optional</small></span>
                  <input value={draft.destination} onChange={(event) => setDraft({ ...draft, destination: event.target.value })} maxLength={2048} placeholder="course or https://…" disabled={saving} />
                </label>
                <label className="banner-field">
                  <span>Display order</span>
                  <input type="number" min="0" step="1" value={draft.order} onChange={(event) => setDraft({ ...draft, order: Number(event.target.value) })} required disabled={saving} />
                </label>
                <label className="banner-toggle">
                  <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} disabled={saving} />
                  <span className="banner-switch" aria-hidden="true" />
                  <span className="banner-toggle-copy">
                    <strong>Active</strong>
                    <small>{activeCount}/{maxActiveBanners} active banners</small>
                  </span>
                </label>
              </div>

              {error ? <div className="banner-modal-error" role="alert">{error}</div> : null}

              <footer className="banner-modal-actions">
                <button className="button button-quiet" type="button" onClick={closeForm} disabled={saving || uploading}>Cancel</button>
                <button className="button button-primary" type="submit" disabled={saving || uploading}>
                  {saving ? <LoaderCircle size={15} className="banner-spinner" /> : selectedFile ? <Upload size={15} /> : <Check size={15} />}
                  {uploading ? `Uploading ${uploadProgress}%` : saving ? "Saving…" : editingId ? "Save changes" : "Save Banner"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
