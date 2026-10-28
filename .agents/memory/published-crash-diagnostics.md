---
name: Published crash diagnostics
description: Evidence limits when diagnosing Jaguar's published React fallback
---
Do not treat healthy HTTP responses, reachable scripts, working Clerk endpoints, or a successful signed-out preview as proof that the published signed-in app opens.

**Why:** Repeated production opening failures displayed only the generic React fallback while server requests stayed healthy. The affected browser exception was unavailable to server-log investigations.

**How to apply:** Capture the affected client exception or sanitized bundled source locations before attributing a published crash to storage, authentication, or quota. Separate proven defensive fixes from confirmation of the reported root cause.
