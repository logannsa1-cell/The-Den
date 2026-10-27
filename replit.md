# Jaguar Study

An exam-preparation app that turns uploaded course material or pasted notes into study summaries, key terms, flashcards, practice questions, cram sheets, and date-based plans.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/jaguar-study/` — React + Vite study app; document text extraction runs in the browser and signed-in study sets sync to the user's account.
- `artifacts/api-server/src/routes/study.ts` — OpenAI-backed study-material generation endpoint.
- `artifacts/api-server/src/routes/study-sets.ts` — authenticated, owner-scoped study-set storage endpoints.
- `lib/api-spec/openapi.yaml` — source of truth for study generation and study-set storage endpoints.
- `lib/api-client-react/` and `lib/api-zod/` — generated API hooks and validation schemas.

## Architecture decisions

- Course files are parsed in the browser; original file bytes are not uploaded.
- Extracted source text is sent to OpenAI for generation and saved with the study materials in the signed-in user's account for cross-device access.
- Clerk session cookies authenticate web requests; the API derives the owner from Clerk and scopes all study-set reads, writes, and deletes to that owner.
- Previously browser-only sets remain available locally until the user chooses to sync them to an account.
- The API key is read only by the server from the `OPENAI_API_KEY` Replit Secret.

## Product

Jaguar Study creates exam-focused summaries, key terms, flashcards, interactive practice tests, cram sheets, and study plans from a student's own material. It supports PDF, DOCX, PPTX, TXT, MD, CSV, and pasted text.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Scanned/image-only PDFs and slide decks without extractable text are not OCR'd; the app reports when it cannot find readable source text.
- Regenerate API client and Zod files after editing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
