"use client";

import { FirebaseError } from "firebase/app";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() ?? "",
};

const missingConfig = Object.entries(config)
  .filter(([, value]) => value.length === 0)
  .map(([key]) => `NEXT_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`);

export const firebaseSetupMessage = missingConfig.length
  ? `Add these Firebase client settings to admin-web/.env.local: ${missingConfig.join(", ")}.`
  : "";

let authInstance: Auth | null = null;
if (!firebaseSetupMessage) {
  try {
    const app = getApps().find((existing) => existing.name === "[DEFAULT]") ?? initializeApp(config);
    authInstance = getAuth(app);
  } catch (error) {
    console.error(
      "Admin Firebase initialization failed:",
      error instanceof FirebaseError ? error.code : "unknown-error",
    );
  }
}

export const auth = authInstance;
