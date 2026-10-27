---
name: Mobile compatibility and verification
description: Expo SDK alignment and limits of the automated Clerk sign-in helper
---

Use the installed Expo SDK's compatibility checks when older package workarounds conflict with it.

**Why:** For Expo 57, the older instruction to pin expo-crypto 15 failed `expo install --check`. SDK-aligned expo-crypto passed all Expo Doctor checks and iOS/Android bundle exports. This does not establish physical-device runtime behavior.

**How to apply:** Run the installed SDK's dependency check and Doctor before changing native libraries; don't restore an older crypto pin solely from historical guidance.

The automated Clerk claims helper may establish a session on the normal web preview host but not on Expo's separate preview origin.

**Why:** The helper redirected to the regular host's mobile path; opening the Expo hostname in the same browser remained signed out. This was a test-environment limitation, not evidence that ordinary mobile sign-in failed.

**How to apply:** Do not weaken authentication or add an auth bypass for tests. Verify supported API flows separately, and report native sign-in, secure storage and operating-system background behavior as unverified unless actually exercised.
