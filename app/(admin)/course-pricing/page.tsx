"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, CircleDollarSign, RefreshCw, Save } from "lucide-react";
import { AdminSectionError, AdminSectionLoading } from "@/components/admin-section";
import { adminRequest, getErrorMessage } from "@/lib/admin-api";
import { useAdminUser } from "../layout";

type CoursePricing = {
  id: string;
  title: string;
  price: number;
  originalPrice: number;
  published: boolean;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CoursePricingPage() {
  const user = useAdminUser();
  const [pricing, setPricing] = useState<CoursePricing | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [published, setPublished] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadPricing() {
    setError("");
    try {
      const current = await adminRequest<CoursePricing>(user, "course-pricing");
      setPricing(current);
      setTitle(current.title);
      setPrice(String(current.price));
      setOriginalPrice(String(current.originalPrice));
      setPublished(current.published);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void adminRequest<CoursePricing>(user, "course-pricing").then((current) => {
      if (!active) return;
      setPricing(current);
      setTitle(current.title);
      setPrice(String(current.price));
      setOriginalPrice(String(current.originalPrice));
      setPublished(current.published);
    }).catch((loadError: unknown) => {
      if (active) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  const sellingPrice = Number(price);
  const mrp = Number(originalPrice);
  const discountPercent = useMemo(
    () => Number.isFinite(mrp) && mrp > 0 && sellingPrice >= 0 && sellingPrice <= mrp
      ? Math.round(((mrp - sellingPrice) / mrp) * 100)
      : 0,
    [mrp, sellingPrice],
  );
  const isDirty = pricing !== null && (
    title !== pricing.title ||
    price !== String(pricing.price) ||
    originalPrice !== String(pricing.originalPrice) ||
    published !== pricing.published
  );

  async function savePricing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (
      !title.trim() ||
      !Number.isSafeInteger(sellingPrice) ||
      !Number.isSafeInteger(mrp) ||
      sellingPrice < (published ? 1 : 0) ||
      sellingPrice > 100_000_000 ||
      mrp < sellingPrice ||
      mrp > 100_000_000
    ) {
      setError("Enter a course title and whole-number prices. MRP must be at least the selling price.");
      return;
    }
    if (pricing?.published && !published &&
      !window.confirm("Making this course inactive removes it from the student app and prevents new purchases. Continue?")) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await adminRequest<CoursePricing>(user, "course-pricing", {
        method: "PUT",
        body: JSON.stringify({
          title: title.trim(),
          price: sellingPrice,
          originalPrice: mrp,
          published,
        }),
      });
      setPricing(updated);
      setTitle(updated.title);
      setPrice(String(updated.price));
      setOriginalPrice(String(updated.originalPrice));
      setPublished(updated.published);
      setSuccess("Course pricing saved. Students will see the updated price automatically.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <AdminSectionLoading label="Loading course pricing…" />;
  }

  return (
    <div className="pricing-page">
      <div className="page-heading heading-with-action">
        <div>
          <div className="eyebrow">ACADEMY MANAGEMENT</div>
          <h1>Course Pricing</h1>
          <p>Manage the course details and the live price used for student checkout.</p>
        </div>
        <div className="pricing-course-id">{pricing?.id}</div>
      </div>

      <AdminSectionError message={error} onRetry={() => void loadPricing()} />
      {success ? <div className="pricing-success" role="status"><Check size={16} />{success}</div> : null}

      {pricing ? (
        <>
          <section className="pricing-summary panel" aria-label="Current course price">
            <div className="pricing-summary-icon"><CircleDollarSign size={22} /></div>
            <div className="pricing-summary-copy">
              <span>Current selling price</span>
              <strong>{formatCurrency(pricing.price)}</strong>
              <small>MRP {formatCurrency(pricing.originalPrice)} · {pricing.published ? "Active" : "Inactive"}</small>
            </div>
            <div className="pricing-discount">
              <span>Current discount</span>
              <strong>{pricing.originalPrice > 0
                ? `${Math.round(((pricing.originalPrice - pricing.price) / pricing.originalPrice) * 100)}%`
                : "0%"}</strong>
            </div>
          </section>

          <form className="panel pricing-editor" onSubmit={(event) => void savePricing(event)}>
            <div className="panel-heading">
              <div><h2>Course details</h2><p>Changes are saved to the existing course record.</p></div>
              <span className={`status-pill ${published ? "status-published" : "status-draft"}`}><i />{published ? "Active" : "Inactive"}</span>
            </div>
            <div className="form-grid management-form pricing-form-grid">
              <label className="form-field form-span-two">
                <span>Course title</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
              </label>
              <label className="form-field">
                <span>Original price (MRP) <small>INR</small></span>
                <input type="number" min="0" max="100000000" step="1" value={originalPrice} onChange={(event) => setOriginalPrice(event.target.value)} required />
              </label>
              <label className="form-field">
                <span>Selling price <small>INR</small></span>
                <input type="number" min={published ? "1" : "0"} max="100000000" step="1" value={price} onChange={(event) => setPrice(event.target.value)} required />
              </label>
              <div className="pricing-discount-preview">
                <span>Discount percentage</span>
                <strong>{discountPercent}%</strong>
                <small>Calculated automatically from MRP and selling price</small>
              </div>
            </div>
            <label className="publish-toggle pricing-status-toggle">
              <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
              <span>
                <strong>Course {published ? "active" : "inactive"}</strong>
                <small>{published ? "Visible in the student app and available for checkout." : "Hidden from the student app and unavailable for new purchases."}</small>
              </span>
            </label>
            <div className="pricing-form-footer">
              <span>Student app pricing updates in real time.</span>
              <button className="button button-primary" type="submit" disabled={isSaving || !isDirty}>
                {isSaving ? <RefreshCw size={15} className="pricing-saving-icon" /> : <Save size={15} />}
                {isSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </>
      ) : (
        <div className="empty-state course-empty">
          <div className="empty-illustration"><CircleDollarSign size={23} /></div>
          <h2>Course pricing unavailable</h2>
          <p>The existing student course record could not be loaded.</p>
          <button className="button button-primary" onClick={() => void loadPricing()}>Try again</button>
        </div>
      )}
    </div>
  );
}
