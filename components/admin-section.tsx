import type { ReactNode } from "react";

export function AdminSectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading heading-with-action">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function AdminSectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  if (!message) return null;
  return (
    <div className="page-alert" role="alert">
      <span>{message}</span>
      <button className="text-button" onClick={onRetry}>Try again</button>
    </div>
  );
}

export function AdminSectionLoading({ label }: { label: string }) {
  return <div className="content-loading"><span className="spinner" />{label}</div>;
}

export function AdminSectionEmpty({ label }: { label: string }) {
  return <div className="section-empty">{label}</div>;
}
