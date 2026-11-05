"use client";

import { useEffect, useState, type FormEvent } from "react";
import { sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { Save, ShieldCheck } from "lucide-react";
import { AdminSectionError, AdminSectionHeader, AdminSectionLoading } from "@/components/admin-section";
import { adminRequest, getErrorMessage } from "@/lib/admin-api";
import { auth } from "@/lib/firebase";
import { useAdminUser } from "../layout";

type AcademyProfile = { name: string; tagline: string; supportEmail: string; website: string };
const emptyProfile: AcademyProfile = { name: "Subhan Academy", tagline: "", supportEmail: "", website: "" };

export default function SettingsPage() {
  const user = useAdminUser();
  const [profile, setProfile] = useState<AcademyProfile>(emptyProfile);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await adminRequest<{ profile: AcademyProfile; configured: boolean }>(user, "settings");
      setProfile(result.profile);
      setConfigured(result.configured);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void adminRequest<{ profile: AcademyProfile; configured: boolean }>(user, "settings").then((result) => {
      if (!active) return;
      setProfile(result.profile);
      setConfigured(result.configured);
    }).catch((loadError: unknown) => {
      if (active) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const currentAuth = auth;
      if (!currentAuth) throw new Error("Firebase Authentication is unavailable.");
      const response = await adminRequest<{ profile: AcademyProfile; configured: boolean }>(user, "settings", {
        method: "PUT",
        body: JSON.stringify(profile),
      });
      if (user.displayName !== profile.name) {
        await updateProfile(user, { displayName: profile.name });
        await user.reload();
      }
      setProfile(response.profile);
      setConfigured(response.configured);
      setNotice("Academy profile saved.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordReset() {
    if (!user.email || !auth) {
      setError("A signed-in administrator email address is required to send a password reset.");
      return;
    }
    setResettingPassword(true);
    setError("");
    setNotice("");
    try {
      await sendPasswordResetEmail(auth, user.email);
      setNotice(`Password reset email sent to ${user.email}.`);
    } catch (resetError) {
      setError(getErrorMessage(resetError));
    } finally {
      setResettingPassword(false);
    }
  }

  return (
    <div>
      <AdminSectionHeader eyebrow="WORKSPACE CONFIGURATION" title="Settings" description="Manage the academy profile and your signed-in administrator account." />
      <AdminSectionError message={error} onRetry={() => void load()} />
      {notice ? <div className="success-alert" role="status">{notice}</div> : null}
      {loading ? <AdminSectionLoading label="Loading academy settings…" /> : (
        <div className="settings-grid">
          <section className="panel settings-panel">
            <div className="panel-heading"><div><h2>Academy profile</h2><p>{configured ? "Saved to the existing Firebase project." : "Save these details to make them available to future admin features."}</p></div></div>
            <form className="management-form" onSubmit={(event) => void save(event)}>
              <label className="form-field"><span>Academy name</span><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} maxLength={120} required /></label>
              <label className="form-field"><span>Tagline</span><input value={profile.tagline} onChange={(event) => setProfile({ ...profile, tagline: event.target.value })} maxLength={240} placeholder="Learn. Build. Grow." /></label>
              <label className="form-field"><span>Support email</span><input type="email" value={profile.supportEmail} onChange={(event) => setProfile({ ...profile, supportEmail: event.target.value })} maxLength={254} placeholder="support@example.com" /></label>
              <label className="form-field"><span>Website (HTTPS)</span><input type="url" value={profile.website} onChange={(event) => setProfile({ ...profile, website: event.target.value })} maxLength={2048} placeholder="https://example.com" /></label>
              <div className="modal-actions"><button className="button button-primary" disabled={saving}><Save size={15} />{saving ? "Saving…" : "Save profile"}</button></div>
            </form>
          </section>
          <section className="panel settings-panel">
            <div className="panel-heading"><div><h2>Administrator account</h2><p>Changes apply only to your existing Firebase administrator account.</p></div></div>
            <div className="account-security-card">
              <div className="settings-security-icon"><ShieldCheck size={19} /></div>
              <div className="account-security-copy"><strong>{user.displayName || "Administrator"}</strong><span>{user.email}</span><small>UID authorization is enforced by the Worker.</small></div>
            </div>
            <div className="security-action-row"><div><strong>Password</strong><span>Send a secure password reset link to the admin email.</span></div><button className="button button-quiet" disabled={resettingPassword} onClick={() => void sendPasswordReset()}>{resettingPassword ? "Sending…" : "Send reset link"}</button></div>
            <p className="management-footnote">Changing this account’s email or the Worker&apos;s ADMIN_UID requires Firebase Console / Cloudflare configuration and is intentionally not exposed here.</p>
          </section>
        </div>
      )}
    </div>
  );
}
