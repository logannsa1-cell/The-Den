---
name: Jaguar product direction
description: User-specified branding and exam-preparation behavior
---
The product name is just "Jaguar", with black and purple as the default, Rose/Ocean/Jungle alternatives and subtle jaguar spots. The user now wants a stylized vector jaguar similar to their SVG, not the earlier realistic face. Remove decorative star/sparkle icons.

**Why:** The user explicitly requested this direction and replaced the earlier green design.

Notes must be analyzed and synthesized into readable exam material, not just extracted text shown as notes. Multiple source files should form one study set; summary, timed exam, objective A–E questions (1–50), theory questions with a/b/c parts, Tutor Lesson and Cram Sheet must be selectable together after upload.

Input is file-upload-only: no typed/pasted notes box. A top-right Settings button opens a separate profile view; profile pictures and banners must not appear on the study home page. The jaguar icon must follow the selected accent color.

**Why:** The user explicitly requested these changes to the workflow.

Mode selection belongs in the upload popup, not a duplicate "Build it your way" panel. Its Generate action should open a study view with the selected modes on the side and a small jaguar running left during generation.

**Why:** The user explicitly requested a Studley-like selection-to-study flow.

Timed papers follow the supplied school exam: Section A objective, Section B theory with one of two Part A questions and three of five Part B questions. Personal exam scheduling must not affect study generation. Provider names should not appear in product UI, while service failures must still be explained honestly.

**Why:** The user repeated these requirements after showing a failed slide-generation recording.

**How to apply:** Preserve these product expectations when changing generation or redesigning. The latest wording removes the source subtitle and motivational eyebrow; do not restore the earlier proposed Man United or Mr. Omoks wording.

Use the owner's own Gemini API access, not managed AI setup or automatic paid-provider fallback.

**Why:** After repeated credit-limit failures, the user explicitly approved switching to Gemini and previously declined managed AI setup. Keeping an SDK with an OpenAI name is acceptable when it sends exclusively to Google's documented compatibility endpoint; it does not mean OpenAI is the provider.

Gemini's model listing is not proof that an account can generate with a model. On 2026-10-27, the listing included Gemini 2.5 Flash, but generation returned 404 saying it was unavailable to new users and recommended Gemini 3.8 Flash.

**Why:** Listing-based availability checks alone gave a misleading result. Verify a real generation before claiming a configured model works; distinguish 503 capacity failures from quota or credential errors.

Natural-language-only JSON generation can omit requested questions and return theory subparts with letter keys instead of the required label/question/modelAnswer shape. Use structural response schemas plus runtime validation; a successful HTTP response alone is not successful generation. Avoid nested numeric array bounds in Gemini's response schema: express counts in descriptions and enforce them after parsing instead.

**Why:** A live response contained 10 objective and 5 malformed theory questions despite a request for 50 objective and 7 theory questions. Full schemas with nested array/numeric bounds also returned opaque INVALID_ARGUMENT errors; removing those bounds allowed real complete exam generation. Excess questions can be trimmed, but missing questions must never be fabricated to pass validation.
