"use client";

import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  BookOpen,
  ChevronDown,
  CircleDollarSign,
  Clapperboard,
  GraduationCap,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  TicketPercent,
  UsersRound,
  X,
} from "lucide-react";
import { AdminApiError, adminRequest, getErrorMessage } from "@/lib/admin-api";
import { auth, firebaseSetupMessage } from "@/lib/firebase";

const AdminUserContext = createContext<User | null>(null);

export function useAdminUser(): User {
  const user = useContext(AdminUserContext);
  if (!user) throw new Error("Admin pages must be rendered inside AdminShell.");
  return user;
}

const navigation = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Courses", href: "/courses", icon: BookOpen },
  { label: "Course Pricing", href: "/course-pricing", icon: CircleDollarSign },
  { label: "Featured Course", href: "/featured-course", icon: ImageIcon },
  { label: "Banners", href: "/banners", icon: ImageIcon },
];

const academyNavigation = [
  { label: "Students", href: "/students", icon: UsersRound },
  { label: "Video library", href: "/video-library", icon: Clapperboard },
  { label: "Payments", href: "/payments", icon: CircleDollarSign },
  { label: "Coupons", href: "/coupons", icon: TicketPercent },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Analytics", href: "/analytics", icon: Activity },
  { label: "Settings", href: "/settings", icon: Settings },
];

function initials(user: User) {
  return (user.displayName || user.email || "SA")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeSection = [...navigation, ...academyNavigation].find(({ href }) =>
    href === "/courses" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`),
  );
  const pageTitle = pathname.startsWith("/courses/")
    ? "Course content"
    : activeSection?.label ?? "Overview";
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(auth));
  const [authError, setAuthError] = useState(
    auth ? "" : firebaseSetupMessage || "Firebase Authentication is unavailable.",
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const currentAuth = auth;
    if (!currentAuth) return;
    return onAuthStateChanged(currentAuth, async (signedInUser) => {
      if (!signedInUser) {
        router.replace("/");
        return;
      }
      try {
        await adminRequest(signedInUser, "session");
        setUser(signedInUser);
        setAuthError("");
      } catch (error) {
        if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
          await signOut(currentAuth);
          router.replace("/");
        } else {
          setAuthError(getErrorMessage(error));
        }
      } finally {
        setIsLoading(false);
      }
    });
  }, [router]);

  async function handleSignOut() {
    const currentAuth = auth;
    if (!currentAuth) return;
    await signOut(currentAuth);
    router.replace("/");
  }

  if (isLoading) {
    return <div className="page-loading"><span className="spinner" />Verifying administrator access…</div>;
  }
  if (authError || !user) {
    return (
      <div className="page-loading page-loading-error">
        <div className="notice-card">
          <ShieldCheck size={25} />
          <h1>Admin access unavailable</h1>
          <p>{authError || "Sign in with your Super Admin account to continue."}</p>
          <button className="button button-primary" onClick={() => router.replace("/")}>Return to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <AdminUserContext.Provider value={user}>
      <div className="admin-app">
        {mobileMenuOpen ? <button className="sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation" /> : null}
        <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
          <div className="sidebar-brand">
            <div className="brand-mark"><BookOpen size={21} strokeWidth={2.2} /></div>
            <div className="brand-copy"><strong>Subhan Academy</strong><span>ADMIN WORKSPACE</span></div>
            <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)}><X size={20} /></button>
          </div>
          <div className="sidebar-section-label">WORKSPACE</div>
          <nav className="side-nav" aria-label="Main navigation">
            {navigation.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link ${pathname === href || (href === "/courses" && pathname.startsWith("/courses/")) ? "nav-link-active" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
                {href === "/courses" && pathname.startsWith("/courses/") ? <ChevronDown size={15} className="nav-chevron" /> : null}
              </Link>
            ))}
          </nav>
          <div className="sidebar-section-label secondary-section-label">ACADEMY</div>
          <nav className="side-nav" aria-label="Academy management">
            {academyNavigation.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link ${pathname === href ? "nav-link-active" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="plan-card">
              <div className="plan-icon"><GraduationCap size={17} /></div>
              <div><strong>Academy workspace</strong><span>Private · Super Admin</span></div>
            </div>
            <div className="sidebar-user">
              <div className="user-avatar">{initials(user)}</div>
              <div className="sidebar-user-copy"><strong>{user.displayName || "Administrator"}</strong><span>{user.email}</span></div>
              <button className="icon-button signout-button" onClick={handleSignOut} aria-label="Sign out"><LogOut size={17} /></button>
            </div>
          </div>
        </aside>
        <div className="admin-main">
          <header className="topbar">
            <button className="icon-button mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
            <div className="topbar-context"><span>Subhan Academy</span><span className="topbar-slash">/</span><strong>{pageTitle}</strong></div>
            <div className="topbar-right">
              <span className="secure-indicator"><span className="secure-dot" />Secure workspace</span>
              <div className="topbar-avatar">{initials(user)}</div>
            </div>
          </header>
          <main className="page-content">{children}</main>
        </div>
      </div>
    </AdminUserContext.Provider>
  );
}
