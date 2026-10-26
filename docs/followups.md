# Follow-ups

- Story 4: LinkedIn versions sunset after ~1 year (HTTP 426); bump `API_VERSION` in `server/src/linkedin/client.ts` at least yearly. Live check on 2026-10-26 confirmed the Posts API request shape for text posts with 202610; the image upload path is untested live.
- Story 1 test (`server.test.ts`) skips itself when `dist/` is missing; consider a `pretest` build so it can never skip silently.
- Add a `.gitattributes` (`* text=auto eol=lf`) to stop the CRLF warnings on Windows.
- Story 5: the spec's reaction labels are out of date (EMPATHY is "Love", APPRECIATION is "Support"; see `docs/api-findings.md`). Fix the spec text and use the docs labels in the `engage` skill (Story 6).
- Story 5: `engage` skill (Story 6) should present the draft-only result as "open this link and paste/react yourself"; the API mode is off unless `engagementMode: "api"` is set.
- Story 5: draft-only actions aren't logged, so the duplicate check can't catch a comment the user already pasted by hand. Consider a `profile-record`-style "I did it" record if that matters.
- Gate counts all logged actions toward the cap (posts, comments, reactions); confirm this matches intent.
