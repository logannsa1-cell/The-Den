# Jaguar Study

An exam-preparation app that turns uploaded course material or pasted notes into study summaries, key terms, practice questions, cram sheets, and date-based plans.

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

- `artifacts/jaguar-study/` — React + Vite study app; document text extraction runs in the browser and study sets are saved in browser storage.
- `artifacts/api-server/src/routes/study.ts` — OpenAI-backed study-material generation endpoint.
- `lib/api-spec/openapi.yaml` — source of truth for the study-generation request and response.
- `lib/api-client-react/` and `lib/api-zod/` — generated API hooks and validation schemas.

## Architecture decisions

- Course files are parsed in the browser; only extracted text is sent for AI generation.
- Generated study sets are stored in local browser storage and do not sync across devices.
- The API key is read only by the server from the `OPENAI_API_KEY` Replit Secret.

## Product

Jaguar Study creates exam-focused summaries, key terms, interactive practice tests, cram sheets, and study plans from a student's own material. It supports PDF, DOCX, PPTX, TXT, MD, CSV, and pasted text.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Scanned/image-only PDFs and slide decks without extractable text are not OCR'd; the app reports when it cannot find readable source text.
- Regenerate API client and Zod files after editing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
