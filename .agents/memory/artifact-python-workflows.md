---
name: Artifact Python workflows
description: Working-directory behavior for Python services launched as managed artifact workflows.
---

Managed artifact service commands execute from the artifact directory rather than the workspace root. Python commands that rely on the workspace's dependency project or source tree must resolve those paths relative to the artifact directory.

**Why:** The first Python workflow launch duplicated the artifact path because the command assumed it was already running from the workspace root.

**How to apply:** When adding or changing a Python artifact workflow, verify the command from the artifact's working directory and set the dependency-project and script paths relative to that directory.
