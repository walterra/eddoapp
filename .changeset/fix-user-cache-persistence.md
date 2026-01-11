---
"@eddo/web-client": patch
---

Fix bug where user data persists after logout/login as different user. QueryClient is now recreated when username changes to ensure cache isolation between users.
