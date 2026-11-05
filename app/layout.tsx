import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admin | Subhan Academy",
  description: "Manage courses and learning content for Subhan Academy.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
