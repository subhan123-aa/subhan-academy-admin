"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, TicketPercent, Trash2 } from "lucide-react";
import { AdminSectionEmpty, AdminSectionError, AdminSectionHeader, AdminSectionLoading } from "@/components/admin-section";
import { adminRequest, getErrorMessage } from "@/lib/admin-api";
import { useAdminUser } from "../layout";

type Coupon = {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  value: number;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  redemptionCount: number;
  createdAt: string;
};
type Draft = { code: string; discountType: Coupon["discountType"]; value: string; validFrom: string; validUntil: string; active: boolean };
const blankDraft: Draft = { code: "", discountType: "percentage", value: "10", validFrom: "", validUntil: "", active: true };
const dateField = (value: string | null) => value ? value.slice(0, 10) : "";

export default function CouponsPage() {
  const user = useAdminUser();
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editingCode, setEditingCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setCoupons((await adminRequest<{ coupons: Coupon[] }>(user, "coupons")).coupons);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void adminRequest<{ coupons: Coupon[] }>(user, "coupons").then((result) => {
      if (active) setCoupons(result.coupons);
    }).catch((loadError: unknown) => {
      if (active) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  const activeCount = useMemo(() => (coupons ?? []).filter((coupon) => coupon.active).length, [coupons]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      ...draft,
      code: editingCode || draft.code.trim().toUpperCase(),
      value: Number(draft.value),
      validFrom: draft.validFrom ? new Date(`${draft.validFrom}T00:00:00.000Z`).toISOString() : null,
      validUntil: draft.validUntil ? new Date(`${draft.validUntil}T23:59:59.999Z`).toISOString() : null,
    };
    try {
      await adminRequest(user, editingCode ? `coupons/${encodeURIComponent(editingCode)}` : "coupons", {
        method: editingCode ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      setDraft(blankDraft);
      setEditingCode("");
      await load();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function edit(coupon: Coupon) {
    setEditingCode(coupon.code);
    setDraft({
      code: coupon.code,
      discountType: coupon.discountType,
      value: String(coupon.value),
      validFrom: dateField(coupon.validFrom),
      validUntil: dateField(coupon.validUntil),
      active: coupon.active,
    });
  }

  async function toggle(coupon: Coupon) {
    setSaving(true);
    setError("");
    try {
      await adminRequest(user, `coupons/${encodeURIComponent(coupon.code)}`, {
        method: "PUT",
        body: JSON.stringify({
          code: coupon.code,
          discountType: coupon.discountType,
          value: coupon.value,
          active: !coupon.active,
          validFrom: coupon.validFrom,
          validUntil: coupon.validUntil,
        }),
      });
      await load();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!window.confirm(`Delete ${coupon.code}? Students will no longer be able to apply it; existing payment records will remain.`)) return;
    setSaving(true);
    setError("");
    try {
      await adminRequest(user, `coupons/${encodeURIComponent(coupon.code)}`, { method: "DELETE" });
      if (editingCode === coupon.code) {
        setEditingCode("");
        setDraft(blankDraft);
      }
      await load();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <AdminSectionHeader eyebrow="PROMOTIONS" title="Coupons" description="Create discount codes that are validated by the Worker at Razorpay checkout." />
      <AdminSectionError message={error} onRetry={() => void load()} />
      <section className="course-overview-strip">
        <div className="overview-course-count"><span className="overview-icon"><TicketPercent size={19} /></span><div><strong>{coupons?.length ?? "—"}</strong><span>Coupon codes</span></div></div>
        <span className="overview-divider" />
        <div className="overview-status"><span className="status-dot published-dot" /><span>Active</span><strong>{coupons ? activeCount : "—"}</strong></div>
      </section>
      <section className="panel coupon-form-panel">
        <div className="panel-heading"><div><h2>{editingCode ? `Edit ${editingCode}` : "Create a coupon"}</h2><p>Discounts are calculated against the current course selling price by the Worker.</p></div></div>
        <form className="form-grid management-form" onSubmit={(event) => void submit(event)}>
          <label className="form-field"><span>Coupon code</span><input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} maxLength={32} pattern="[A-Z0-9_-]{3,32}" required disabled={Boolean(editingCode)} placeholder="WELCOME10" /></label>
          <label className="form-field"><span>Discount type</span><select value={draft.discountType} onChange={(event) => setDraft({ ...draft, discountType: event.target.value as Coupon["discountType"] })}><option value="percentage">Percentage</option><option value="fixed">Fixed amount (INR)</option></select></label>
          <label className="form-field"><span>Discount value</span><input type="number" min="1" max={draft.discountType === "percentage" ? "100" : undefined} step="1" value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} required /></label>
          <label className="form-field"><span>Valid from (optional)</span><input type="date" value={draft.validFrom} onChange={(event) => setDraft({ ...draft, validFrom: event.target.value })} /></label>
          <label className="form-field"><span>Valid through (optional)</span><input type="date" value={draft.validUntil} onChange={(event) => setDraft({ ...draft, validUntil: event.target.value })} /></label>
          <label className="publish-toggle coupon-active-toggle"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span><strong>Coupon active</strong><small>Active coupons can be applied by students at checkout.</small></span></label>
          <div className="form-span-two modal-actions coupon-form-actions">
            {editingCode ? <button className="button button-quiet" type="button" onClick={() => { setEditingCode(""); setDraft(blankDraft); }}>Cancel edit</button> : null}
            <button className="button button-primary" type="submit" disabled={saving}><Plus size={15} />{saving ? "Saving…" : editingCode ? "Save changes" : "Create coupon"}</button>
          </div>
        </form>
      </section>
      <section className="panel course-list-panel">
        <div className="course-list-toolbar"><div><h2>All coupons</h2><p>{coupons?.length ?? 0} codes</p></div></div>
        {loading && !coupons ? <AdminSectionLoading label="Loading coupon records…" /> : coupons === null ? (
          <AdminSectionEmpty label="Coupon records could not be loaded." />
        ) : coupons.length ? (
          <div className="course-table-wrap"><table className="course-table">
            <thead><tr><th>CODE</th><th>DISCOUNT</th><th>VALIDITY</th><th>REDEMPTIONS</th><th>STATUS / ACTIONS</th></tr></thead>
            <tbody>{coupons.map((coupon) => (
              <tr key={coupon.id}>
                <td><strong>{coupon.code}</strong></td>
                <td>{coupon.discountType === "percentage" ? `${coupon.value}%` : `₹${coupon.value}`}</td>
                <td><div className="table-text-stack"><span>{coupon.validFrom ? dateField(coupon.validFrom) : "Any date"}</span><small>Until {coupon.validUntil ? dateField(coupon.validUntil) : "indefinitely"}</small></div></td>
                <td>{coupon.redemptionCount}</td>
                <td><div className="course-actions"><span className={`status-pill ${coupon.active ? "status-published" : "status-draft"}`}><i />{coupon.active ? "Active" : "Inactive"}</span><button className="icon-button row-action" aria-label={`Edit ${coupon.code}`} disabled={saving} onClick={() => edit(coupon)}><Pencil size={15} /></button><button className="button button-quiet coupon-toggle" disabled={saving} onClick={() => void toggle(coupon)}>{coupon.active ? "Deactivate" : "Activate"}</button><button className="icon-button row-action" aria-label={`Delete ${coupon.code}`} disabled={saving} onClick={() => void deleteCoupon(coupon)}><Trash2 size={15} /></button></div></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <AdminSectionEmpty label="No coupon codes have been created." />}
      </section>
    </div>
  );
}
