"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Bell, Send } from "lucide-react";
import { AdminSectionEmpty, AdminSectionError, AdminSectionHeader, AdminSectionLoading } from "@/components/admin-section";
import { adminRequest, getErrorMessage } from "@/lib/admin-api";
import { useAdminUser } from "../layout";

type NotificationRecord = {
  id: string;
  title: string;
  body: string;
  status: "sent" | "partial" | "failed" | "sending";
  recipientCount: number;
  acceptedCount: number;
  createdAt: string;
  sentAt: string | null;
};

function formatDate(value: string) {
  return value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";
}

export default function NotificationsPage() {
  const user = useAdminUser();
  const [records, setRecords] = useState<NotificationRecord[] | null>(null);
  const [registeredDevices, setRegisteredDevices] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await adminRequest<{ notifications: NotificationRecord[]; registeredDevices: number }>(user, "notifications");
      setRecords(result.notifications);
      setRegisteredDevices(result.registeredDevices);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void adminRequest<{ notifications: NotificationRecord[]; registeredDevices: number }>(user, "notifications").then((result) => {
      if (!active) return;
      setRecords(result.notifications);
      setRegisteredDevices(result.registeredDevices);
    }).catch((loadError: unknown) => {
      if (active) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm(`Send this notification to ${registeredDevices} opted-in devices?`)) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      const result = await adminRequest<{ notification: NotificationRecord }>(user, "notifications", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      setNotice(`Push service accepted ${result.notification.acceptedCount} of ${result.notification.recipientCount} notifications.`);
      setTitle("");
      setBody("");
      await load();
    } catch (sendError) {
      const message = getErrorMessage(sendError);
      await load();
      setError(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <AdminSectionHeader eyebrow="STUDENT COMMUNICATION" title="Notifications" description="Send a real push notification to students who opted in from the app profile." />
      <AdminSectionError message={error} onRetry={() => void load()} />
      {notice ? <div className="success-alert" role="status">{notice}</div> : null}
      <section className="course-overview-strip">
        <div className="overview-course-count"><span className="overview-icon"><Bell size={19} /></span><div><strong>{registeredDevices}</strong><span>Opted-in devices</span></div></div>
        <span className="overview-divider" />
        <div className="overview-hint">Only the devices that completed push registration can receive messages.</div>
      </section>
      <section className="panel notification-compose-panel">
        <div className="panel-heading"><div><h2>Compose announcement</h2><p>Messages are sent through Expo Push Service and logged in Firestore.</p></div></div>
        <form className="management-form notification-form" onSubmit={(event) => void send(event)}>
          <label className="form-field"><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder="A new course update" /></label>
          <label className="form-field"><span>Message</span><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={1000} rows={4} required placeholder="Write the message students will see…" /></label>
          <div className="notification-send-row"><span>Recipients: {registeredDevices} opted-in devices</span><button className="button button-primary" disabled={sending || registeredDevices === 0}><Send size={15} />{sending ? "Sending…" : "Send notification"}</button></div>
          {registeredDevices === 0 ? <p className="management-footnote">No devices have registered yet. Students can opt in from Profile → Enable academy notifications in a development or production app build.</p> : null}
        </form>
      </section>
      <section className="panel course-list-panel">
        <div className="course-list-toolbar"><div><h2>Delivery history</h2><p>{records?.length ?? 0} notifications</p></div></div>
        {loading && !records ? <AdminSectionLoading label="Loading notification history…" /> : records === null ? (
          <AdminSectionEmpty label="Notification history could not be loaded." />
        ) : records.length ? (
          <div className="course-table-wrap"><table className="course-table">
            <thead><tr><th>MESSAGE</th><th>DELIVERY</th><th>ACCEPTED / TARGETED</th><th>SENT</th></tr></thead>
            <tbody>{records.map((record) => (
              <tr key={record.id}>
                <td><div className="table-text-stack"><strong>{record.title}</strong><small>{record.body}</small></div></td>
                <td><span className={`status-pill ${record.status === "sent" ? "status-published" : "status-draft"}`}><i />{record.status}</span></td>
                <td>{record.acceptedCount} / {record.recipientCount}</td>
                <td>{formatDate(record.sentAt || record.createdAt)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <AdminSectionEmpty label="No notifications have been sent." />}
      </section>
    </div>
  );
}
