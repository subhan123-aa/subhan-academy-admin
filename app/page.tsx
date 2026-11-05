"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FirebaseError } from "firebase/app";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ArrowRight, BookOpen, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { AdminApiError, adminRequest, getErrorMessage } from "@/lib/admin-api";
import { auth, firebaseSetupMessage } from "@/lib/firebase";

function getLoginError(error: unknown) {
  if (error instanceof AdminApiError) return getErrorMessage(error);
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "Email or password is incorrect.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/too-many-requests":
        return "Too many sign-in attempts. Wait a little and try again.";
      case "auth/network-request-failed":
        return "Could not connect to Firebase. Check your connection and try again.";
      case "auth/operation-not-allowed":
        return "Email and password sign-in is not enabled for this Firebase project.";
      default:
        return "Firebase could not complete sign-in. Please try again.";
    }
  }
  return getErrorMessage(error);
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hasCheckedSession, setHasCheckedSession] = useState(!auth);

  useEffect(() => {
    const currentAuth = auth;
    if (!currentAuth) return;
    return onAuthStateChanged(currentAuth, async (user) => {
      if (!user) {
        setHasCheckedSession(true);
        return;
      }
      try {
        await adminRequest(user, "session");
        router.replace("/dashboard");
      } catch (sessionError) {
        if (sessionError instanceof AdminApiError && sessionError.status === 403) {
          setError("This Firebase account is not the configured Super Admin.");
          await signOut(currentAuth);
        } else if (sessionError instanceof AdminApiError && sessionError.status === 401) {
          setError("Your sign-in has expired. Sign in again.");
          await signOut(currentAuth);
        } else {
          setError(getErrorMessage(sessionError));
        }
        setHasCheckedSession(true);
      }
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const currentAuth = auth;
    if (!currentAuth) {
      setError(firebaseSetupMessage || "Firebase Authentication is unavailable.");
      return;
    }
    setIsSubmitting(true);
    try {
      const credentials = await signInWithEmailAndPassword(currentAuth, email.trim(), password);
      await adminRequest(credentials.user, "session");
      router.replace("/dashboard");
    } catch (submitError) {
      if (submitError instanceof AdminApiError && submitError.status === 403) {
        await signOut(currentAuth);
        setError("This Firebase account is not the configured Super Admin.");
      } else if (submitError instanceof AdminApiError && submitError.status === 401) {
        await signOut(currentAuth);
        setError("Your sign-in has expired. Sign in again.");
      } else {
        setError(getLoginError(submitError));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Subhan Academy">
        <div className="login-brand">
          <div className="brand-mark"><BookOpen size={22} strokeWidth={2.2} /></div>
          <span>Subhan <strong>Academy</strong></span>
        </div>
        <div className="story-copy">
          <span className="eyebrow light-eyebrow">ACADEMY MANAGEMENT</span>
          <h1>Build learning<br />that moves people forward.</h1>
          <p>A focused workspace to manage your courses and keep every lesson on track.</p>
        </div>
        <div className="story-footer">
          <span className="story-orbit orbit-one" />
          <span className="story-orbit orbit-two" />
          <span className="story-orbit orbit-three" />
          <span className="story-note"><ShieldCheck size={17} /> Private workspace for your academy</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-form-wrap">
          <Image className="login-logo" src="/subhan-academy-logo.webp" alt="Subhan Academy — Learn. Build. Grow." width={270} height={82} priority />
          <span className="eyebrow">ADMINISTRATOR ACCESS</span>
          <h2>Welcome back</h2>
          <p className="login-subtitle">Sign in with your Super Admin account to continue.</p>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="field-label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@subhanacademy.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <label className="field-label password-label" htmlFor="password">Password</label>
            <div className="password-input">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="icon-button password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {error ? <div className="form-alert" role="alert">{error}</div> : null}
            {firebaseSetupMessage && !error ? (
              <div className="form-alert" role="alert">{firebaseSetupMessage}</div>
            ) : null}
            <button className="button button-primary login-submit" type="submit" disabled={isSubmitting || !hasCheckedSession}>
              {isSubmitting ? "Verifying access…" : "Sign in to dashboard"}
              {!isSubmitting ? <ArrowRight size={17} /> : null}
            </button>
          </form>

          <div className="login-security"><ShieldCheck size={17} /> Access is restricted to one verified administrator.</div>
          <p className="login-help">Need access? Ask your Firebase project administrator.</p>
        </div>
        <div className="login-copyright">© {new Date().getFullYear()} Subhan Academy</div>
      </section>
    </main>
  );
}
