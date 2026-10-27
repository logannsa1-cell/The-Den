# Jaguar Mobile

Expo/React Native companion to the existing Jaguar website, using the same Clerk
environment, authenticated study API and account-owned study sets.

## Run

Use the managed `artifacts/jaguar-mobile: expo` workflow. Open **Preview on your
phone** in the workspace to use Expo Go. The website and API retain their existing
workflows; do not start a second API server.

The development script forwards the public Clerk key and API domain. The build
script forwards the environment-specific public key, API domain and managed Clerk
proxy URL. AI and Clerk secret keys must never enter the mobile bundle.
Development and production Clerk accounts are separate.

## Data behavior

- Saved study sets and extracted source text sync through the existing account API.
- Unsynced sets have account-scoped device backups and an explicit retry action.
  If both account and local saving fail, the generated result stays in memory with
  a warning; keep the app open until saving succeeds.
- Original files, practice drafts, timed-paper answers/deadlines, banners, and exam
  scheduling remain on the device. Profile pictures use the Clerk account.
- Original documents can be reattached on a phone. The built-in source viewer is
  an accessible text preview, **not** the original PDF/PowerPoint artwork.
- Uploads are temporarily processed by an authenticated, size-limited server
  worker. Original bytes are not saved or logged. Scans without selectable text
  require a text-based version; there is no OCR.
- Timed papers use an absolute deadline, not a paused countdown. Returning after
  the deadline submits the stored answers automatically.

## Checks performed

- Expo dependency compatibility check passed; Expo Doctor passed 21/21 checks.
- iOS and Android Hermes bundle exports passed.
- Mobile, API and website TypeScript checks passed.
- Public mobile preview rendered at 390 × 844.
- Ten production-worker tests passed, including the uploaded Word/PDF references,
  PPTX ordering, malformed input, XML entities and expansion/text limits.
- Authenticated transient extraction returned readable Biology and Chemistry
  text; unauthenticated extraction returned 401.
- A fresh standard Clerk session token authenticated a Bearer-only API request.

## Verification limitations

The automated Clerk claims helper could sign in on the regular web preview host
but not on Expo's separate preview origin. The complete signed-in mobile journey
was therefore **not** exercised. A real six-mode provider request encountered a
temporary 503; no successful generated pack was captured in this verification.
Do not treat compilation or the public screenshot as proof of the following:

- native Google redirect approval and secure-session persistence;
- native file selection, original-file sharing and photo permissions;
- account create/open/delete round-trip through the mobile UI;
- answer persistence through operating-system suspension/termination and expiry.

These still need a supported authenticated mobile test session or physical phones.
The custom sign-in currently supports email-code second-factor challenges, not
all possible Clerk MFA methods.
