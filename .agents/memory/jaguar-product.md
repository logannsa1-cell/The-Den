---
name: Jaguar product direction
description: User-specified branding and exam-preparation behavior
---
The product name is just "Jaguar", with black and purple as the default, Rose/Ocean/Jungle alternatives and subtle jaguar spots. The user now wants a stylized vector jaguar similar to their SVG, not the earlier realistic face. Remove decorative star/sparkle icons.

**Why:** The user explicitly requested this direction and replaced the earlier green design.

Avoid the stacked generated-app appearance: violet glow, huge tight headlines, tiny all-caps monospace labels, and repeated large rounded cards with tinted icon squares. The user wants the compact outlined jaguar logo and interface cues from their dashboard reference.

**Why:** The user said people were calling the interface “AI slop” and specifically identified these combined habits.

**How to apply:** Retain Jaguar identity and study functionality while using restrained accents, ordinary sentence-case labels, and varied, less boxed layouts.

Notes must be analyzed and synthesized into readable exam material, not just extracted text shown as notes. Multiple source files should form one study set; summary, timed exam, objective A–E questions (1–50), theory questions with a/b/c parts, Tutor Lesson and Cram Sheet must be selectable together after upload.

Multi-file sets must stay organised by subject, explaining each subject's supplied weeks in order before the next subject. Exams and theory use subject sections in one combined paper, not separate papers.

**Why:** The user explicitly chose "Subject sections in one paper" for Biology, Chemistry and Physics uploads.

Week-level headings must be specified in both generation instructions and structured-output field descriptions. Generic numbered-topic directions can otherwise collapse weeks; theory may invent an "Integrated" subject unless explicitly prohibited.

**Why:** Live three-subject generation initially combined weeks into subject overviews and later invented a mixed-subject theory question despite the organisation instructions. Field-level constraints and explicit precedence corrected the test output.

Input is file-upload-only: no typed/pasted notes box. A top-right Settings button opens a separate profile view; profile pictures and banners must not appear on the study home page. The jaguar icon must follow the selected accent color.

Legacy browser-only sets have no known owner and must be imported only through an explicit user choice. New unsynced backups belong to the signed-in account; never silently claim old shared-browser data for whoever signs in next.

**Why:** Older local sets predate account ownership. Automatic claiming would risk exposing one student's notes to another on a shared device; preserving a consent-based import avoids guessing.

**Why:** The user explicitly requested these changes to the workflow.

Mode selection belongs in the upload popup, not a duplicate "Build it your way" panel. Its Generate action should open a study view with the selected modes on the side and a small jaguar running left during generation.

**Why:** The user explicitly requested a Studley-like selection-to-study flow.

Tutor Lesson should be medium-length and detailed; Note Summary should be long and very detailed; Cram Sheet should be short and concise for last-minute test preparation. Do not make them interchangeable copies.

The later Studley reference clarifies that "medium" is relative: substantial multi-topic tutor lessons should resemble the supplied ~3,200-word, 14-page teaching document, not a 500–800-word overview. Keep summaries more comprehensive and cram sheets brief.

**Why:** The user supplied a full lesson to clarify the expected depth, examples and explanation quality.

Long-form quality needs live output checks, not just larger word targets. Both multi-mode structured generation and a single plain-text expansion returned short overviews despite explicit length instructions; developing each draft topic separately produced substantial, distinct lessons and reference notes.

**Why:** A ~3,200-word reference yielded only ~400-word outputs until generation was broken into topic-sized teaching requests. Preserve source grounding and bounded requests rather than padding text or assuming prompts enforce length.

The source slideshow must be available beside each mode, with study content taking most space by default. Users must be able to resize either side, completely hide the slideshow, and restore it without deleting originals.

Put study mode links directly beneath "Open set" in the main sidebar, not in an additional separate column. Slide previews should preserve the original full-slide layout and decoration, not display enlarged cropped extracted text.

**Why:** The user supplied comparison screenshots and explicitly requested more room for each mode.

**Why:** The user explicitly requested distinct learning formats and flexible study/slideshow screen space.

Timed papers follow the supplied school exam: Section A objective, Section B theory with one of two Part A questions and three of five Part B questions. Personal exam scheduling must not affect study generation. Provider names should not appear in product UI, while service failures must still be explained honestly.

**Why:** The user repeated these requirements after showing a failed slide-generation recording.

**How to apply:** Preserve these product expectations when changing generation or redesigning. The latest wording removes the source subtitle and motivational eyebrow; do not restore the earlier proposed Man United or Mr. Omoks wording.

Use the owner's own Gemini API access, not managed AI setup or automatic paid-provider fallback.

Retry fast transient provider failures with a bounded budget. Permit just one recovery attempt for a slow 503 within the first minute; do not retry quota or credential errors. Keep topic expansion concurrency low across all selected modes.

**Why:** A latency investigation found slow AI requests while ordinary routes were healthy. Failing immediately on every slow 503 left users unable to generate during intermittent capacity issues, so one recovery attempt balances availability against repeated long waits.

Optional depth expansion must not discard already generated study materials on transient service failure. Preserve the original generated section with an explicit visible notice that extra detail was unavailable; keep strict validation of requested exam questions.

Give optional expansion a separate short deadline and stop the entire expansion pass on service failure, including in-flight siblings and unscheduled sections. Preserve completed expansions and remaining drafts.

**Why:** Limiting concurrency alone can extend serial waits, and rejecting a Promise.all does not cancel sibling provider requests. Optional detail must not keep work running after the usable initial material is ready and the provider is failing.

**Why:** A real multi-mode test completed its initial generation but failed during a topic expansion, making the entire otherwise usable pack unavailable.

**Why:** After repeated credit-limit failures, the user explicitly approved switching to Gemini and previously declined managed AI setup. Keeping an SDK with an OpenAI name is acceptable when it sends exclusively to Google's documented compatibility endpoint; it does not mean OpenAI is the provider.

Gemini's model listing is not proof that an account can generate with a model. On 2026-10-27, the listing included Gemini 2.5 Flash, but generation returned 404 saying it was unavailable to new users and recommended Gemini 3.8 Flash.

**Why:** Listing-based availability checks alone gave a misleading result. Verify a real generation before claiming a configured model works; distinguish 503 capacity failures from quota or credential errors.

Natural-language-only JSON generation can omit requested questions and return theory subparts with letter keys instead of the required label/question/modelAnswer shape. Use structural response schemas plus runtime validation; a successful HTTP response alone is not successful generation. Avoid nested numeric array bounds in Gemini's response schema: express counts in descriptions and enforce them after parsing instead.

**Why:** A live response contained 10 objective and 5 malformed theory questions despite a request for 50 objective and 7 theory questions. Full schemas with nested array/numeric bounds also returned opaque INVALID_ARGUMENT errors; removing those bounds allowed real complete exam generation. Excess questions can be trimmed, but missing questions must never be fabricated to pass validation.
