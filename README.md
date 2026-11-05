# Subhan Academy Admin

This is a standalone Next.js admin website. It lives beside the Expo student app so it does not change the mobile app's navigation, Firebase client, or payment screens.

## Local setup

1. Copy `.env.example` to `.env.local`. Map the existing `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, and `EXPO_PUBLIC_FIREBASE_APP_ID` values to their matching `NEXT_PUBLIC_FIREBASE_*` names. Set `NEXT_PUBLIC_ADMIN_API_URL` to the existing `EXPO_PUBLIC_PAYMENT_API_URL` Worker base URL. These `NEXT_PUBLIC_` values are client configuration, not service-account or payment secrets.
2. Enable Email/Password sign-in in Firebase Authentication and sign in with the existing administrator account. There is no admin sign-up page.
3. Keep the Worker `FIREBASE_PROJECT_ID` and `FIREBASE_STORAGE_BUCKET` variables aligned with the existing Firebase project and bucket. In `worker/wrangler.toml`, set `ADMIN_PANEL_ORIGIN` to the exact deployed Admin Panel origin (scheme and hostname only, no path or trailing slash). Configure the Worker secrets from the `worker` directory: `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_WEB_API_KEY` (the same client API key used above), and `ADMIN_UID` (the one administrator's Firebase UID). For each secret, run `npx wrangler secret put <NAME>` and enter its value when Wrangler prompts. The Worker verifies Firebase ID tokens and checks this UID on every admin endpoint; hiding the admin page in the browser is not the security boundary.
4. Install dependencies and start the website from this directory with `npm install` then `npm run dev`.

The Worker must already have its existing Firebase and Razorpay Test Mode bindings configured. Do not put its Firebase service-account JSON, Razorpay Key Secret, webhook secret, or Cloudflare credentials in this app or in a `NEXT_PUBLIC_` variable. The admin website makes no production deployment or Firebase rules changes.

## First-step features

- **Overview:** Revenue and successful sales come from existing successful payment records. Enrollment and student totals come from existing enrollment records; “students” counts distinct enrolled Firebase UIDs, not every Firebase Auth account. The activity chart uses the actual verified payment and enrollment timestamps.
- **Courses:** Reads and writes the existing `courses` documents and preserves the student app's current course fields.
- **Modules and lessons:** Module metadata is stored in `courses/{courseId}/modules/{moduleId}`. Lessons remain in the existing `courses/{courseId}/lessons` collection and retain `courseId`, `title`, `order`, `durationSeconds`, and `published`; `moduleId` associates a lesson with an admin module. Existing `youtubeVideoId` lessons remain supported. Private Stream lessons store `streamVideoUid`, `thumbnail`, and `processingStatus` (`uploading`, `processing`, `ready`, or `failed`) alongside the existing fields. Reordering updates lesson `order`, which the existing app already uses.

Modules are an admin-side organizational layer. The current student app continues to show its existing flat, ordered lesson list; adding module grouping to student screens is a separate, backward-compatible follow-up.

The student app and Worker checkout support the existing `build-your-own-local-business` course. **Course Pricing** updates its existing Firestore document through an authenticated, admin-only Worker endpoint. **Featured Course Management** uploads the Home screen banner to the existing R2 bucket and updates only the `featuredBannerUrl` field on that same course document; the Student App's existing course listener shows the new image automatically. Student course details and the home screen receive published course changes through Firestore listeners. For every order and coupon validation, the Worker reads the latest selling price, rejects inactive courses, and ignores client-supplied amounts. Each payment stores its order-time amount snapshot, so later course price or coupon edits do not alter payment verification. The admin can manage home banners in the existing `banners` collection, with no more than three active at a time. New banner images are uploaded to the `subhan-academy-assets` R2 bucket through the authenticated Worker; public image URLs use the Worker asset route. Uploads accept JPEG, PNG, and WebP files up to 5 MB, validate the file signature, and use immutable cache metadata. Admin uploads and deletions require a verified Firebase ID token and the configured `ADMIN_UID`. The student app listens to active banners in real time and sorts them by display order; content edits do not require an app rebuild.

The Worker uses the `ASSETS_BUCKET` R2 binding configured in `worker/wrangler.toml`; no R2 credentials or Firebase Storage upload permissions are needed for new banners. `ASSETS_PUBLIC_URL` must match the Worker's public HTTPS URL. The Worker's `ADMIN_PANEL_ORIGIN` setting must match the deployed Admin Panel origin exactly so the Admin API CORS policy remains restricted to that site. Existing banner records that still use Firebase Storage URLs continue to display, and their managed-image cleanup remains supported.

Deploy the Firestore rules in `firestore.rules` to the `subhanacademy` Firebase project with `firebase deploy --only firestore:rules --project subhanacademy` after reviewing the target. They allow students to read active banner documents and only their own enrollment documents, while continuing to deny client writes. Course, banner, and payment administration remains behind Firebase ID token verification and the Worker `ADMIN_UID` check. Deploy the changed Worker from the `worker` directory with `npx wrangler deploy` after creating the `subhan-academy-assets` R2 bucket and setting `ADMIN_PANEL_ORIGIN`, existing Firebase secrets, and `ADMIN_UID`. This change does not deploy automatically.

The configured course cannot be deleted from the admin panel because the current app depends on its ID. Unpublishing remains an explicit, confirmed action; it hides the course and prevents enrolled students from loading its lessons under the existing Firestore rules.

## Academy modules

The Students and Analytics routes use Firebase Authentication's `accounts:batchGet` API plus the existing Firestore enrollment records. Grant the Worker service account the Firebase Authentication Viewer role (`roles/firebaseauth.viewer`) in addition to its existing Cloud Datastore User role. Do not grant broad project admin access.

Payments read the existing `payments` records written only after Worker verification. New transactions use Razorpay; existing Cashfree history remains visible. Coupons are stored in `coupons`, announcements and send outcomes in `notifications`, opted-in device tokens in `studentDevices`, and academy profile settings in `academySettings/profile`. These are new feature records in the same Firestore project; client Firestore rules still deny access and all writes/reads use the authenticated Worker.

The Video Library uses the existing payment Worker for all Cloudflare Stream API calls. In the `worker` directory, set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_STREAM_API_TOKEN` with `npx wrangler secret put CLOUDFLARE_ACCOUNT_ID` and `npx wrangler secret put CLOUDFLARE_STREAM_API_TOKEN`. Scope the Cloudflare API token to **Stream Read** and **Stream Write** for the intended account. Neither value belongs in this Admin Panel or the Student App. The Worker issues private, single-use Direct Creator Upload URLs; the browser sends file bytes directly to Cloudflare and uses resumable TUS uploads for files over 200 MB. Uploads require signed playback, and the admin preview uses short-lived tokens.

Students request a short-lived signed playback token from the same Worker. The Worker verifies the Firebase ID token, checks the published course and lesson plus a matching `active` enrollment in Firestore, and only then asks Cloudflare Stream for a token. Completed or missing enrollments cannot obtain playback tokens. The app never turns a stored Stream UID into a permanent public playback URL. Existing YouTube lessons continue to work until they are migrated.

After adding `expo-video`, rebuild the mobile development/production binary before testing native playback; a normal JavaScript OTA update cannot add the native player module. No Firebase Storage dependency or Blaze plan is required. Deploy the changed Worker and mobile/admin apps only when you choose; no deployment or production secret changes are performed by this implementation.

Push announcements are delivered through Expo Push Service to tokens students explicitly register from **Profile → Enable academy notifications** in the iOS or Android app. Configure push credentials in EAS and rebuild the app with `expo-notifications`; remote push delivery is unavailable in Expo Go. The admin reports gateway acceptance, not guaranteed device receipt.

Settings store academy contact/profile fields in the same Firebase project. Admin account security stays with Firebase Authentication; the panel can send a password-reset email but cannot alter the server-enforced `ADMIN_UID`.

The dashboard loads current Firestore records rather than sample data. As payment and enrollment collections grow, these overview reads also grow; keep the Firebase Spark plan's Firestore read quota in mind.

## Vercel deployment

The admin app is a standalone Next.js project inside this repository. When importing
the repository into Vercel, set **Root Directory** to `admin-web`, keep the detected
Next.js framework and default build settings, and configure these environment
variables for the Production environment (and Preview if preview deployments will
be used):

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_ADMIN_API_URL` — the existing HTTPS Worker URL, for example
  `https://subhan-academy-payments.subhan-academy.workers.dev`

The Firebase web configuration is public client configuration. Never add the
Firebase service-account JSON, Razorpay secrets, `ADMIN_UID`, or Cloudflare
API tokens to Vercel environment variables.

To link the project and create a Preview deployment from Windows PowerShell, run
the following from the admin directory. Vercel will prompt for account/project
selection and environment-variable values; do not put values in command arguments:

```powershell
Set-Location 'C:\Project 2026\subhanacademyapp\admin-web'
npx vercel login
npx vercel link
npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY preview
npx vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN preview
npx vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID preview
npx vercel env add NEXT_PUBLIC_FIREBASE_APP_ID preview
npx vercel env add NEXT_PUBLIC_ADMIN_API_URL preview
npx vercel
```

After confirming the Preview app signs in with the intended administrator and
loads protected Worker data, configure the same five variables for Production,
then deploy Production only when explicitly approved:

```powershell
npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production
npx vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production
npx vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production
npx vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production
npx vercel env add NEXT_PUBLIC_ADMIN_API_URL production
npx vercel --prod
```

## Validation

From this directory:

```powershell
npm ci
npm run lint
npm run typecheck
npm run build
```

The Cloudflare Worker can be checked without deploying it by running `npm run build` and `npm test` from the `worker` directory.
