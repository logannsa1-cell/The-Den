---
name: Artifact Python workflows
description: Working-directory behavior for Python services launched as managed artifact workflows.
---

Managed development workflow commands execute from the artifact directory, but production artifact build and run commands execute from the workspace root. Python project and source paths must match the working directory of the specific command.

**Why:** A production run used development-relative paths, so startup looked for the Python app in the wrong directory and the service crash-looped.

**How to apply:** Check deployment logs and verify production commands from the workspace root; use workspace-root-relative script paths and project references there. Keep development workflow paths relative to the artifact directory.
