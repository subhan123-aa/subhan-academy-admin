"use client";

import type { User } from "firebase/auth";

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

function getApiBaseUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_ADMIN_API_URL?.trim();
  if (!rawUrl) {
    throw new AdminApiError("Set NEXT_PUBLIC_ADMIN_API_URL to your existing Cloudflare Worker URL.", 0);
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AdminApiError("The configured Worker URL is invalid.", 0);
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new AdminApiError("The Worker URL must use HTTPS.", 0);
  }
  return url.toString().replace(/\/+$/, "");
}

export async function adminRequest<T>(
  user: User,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  if (init.body !== undefined && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/admin/${path.replace(/^\/+/, "")}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof AdminApiError) throw error;
    throw new AdminApiError("Could not connect to the Admin API. Check the Worker URL and your connection.", 0);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AdminApiError(`The Admin API returned an invalid response (HTTP ${response.status}).`, response.status);
  }
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : `The request failed (HTTP ${response.status}).`;
    throw new AdminApiError(message, response.status);
  }
  return body as T;
}

export async function adminUpload<T>(
  user: User,
  path: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<T> {
  const token = await user.getIdToken();
  const url = `${getApiBaseUrl()}/admin/${path.replace(/^\/+/, "")}`;

  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.responseType = "json";
    request.timeout = 35_000;
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.setRequestHeader("Content-Type", file.type);
    request.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      const body: unknown = request.response;
      if (request.status < 200 || request.status >= 300) {
        const message =
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof body.message === "string"
            ? body.message
            : `The upload failed (HTTP ${request.status}).`;
        reject(new AdminApiError(message, request.status));
        return;
      }
      if (typeof body !== "object" || body === null) {
        reject(new AdminApiError("The Admin API returned an invalid upload response.", request.status));
        return;
      }
      resolve(body as T);
    };
    request.onerror = () => {
      reject(new AdminApiError("Could not upload the image. Check your connection and retry.", 0));
    };
    request.ontimeout = () => {
      reject(new AdminApiError("The image upload timed out. Check your connection and retry.", 0));
    };
    request.send(file);
  });
}

export function uploadDirectVideo(
  uploadUrl: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", uploadUrl);
    request.timeout = 0;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new AdminApiError(`Cloudflare Stream upload failed (HTTP ${request.status}).`, request.status));
        return;
      }
      onProgress(100);
      resolve();
    };
    request.onerror = () => {
      reject(new AdminApiError("Could not upload the video. Check your connection and retry.", 0));
    };
    request.onabort = () => {
      reject(new AdminApiError("The video upload was cancelled.", 0));
    };
    const body = new FormData();
    body.set("file", file);
    request.send(body);
  });
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request could not be completed.";
}
