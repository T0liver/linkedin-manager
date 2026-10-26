# Follow-ups

- Story 4: LinkedIn versions sunset after ~1 year (HTTP 426); bump `API_VERSION` in `server/src/linkedin/client.ts` at least yearly. Live check on 2026-10-26 confirmed the Posts API request shape for text posts with 202610; the image upload path is untested live.
- Story 1 test (`server.test.ts`) skips itself when `dist/` is missing; consider a `pretest` build so it can never skip silently.
- Add a `.gitattributes` (`* text=auto eol=lf`) to stop the CRLF warnings on Windows.
- Spec text (story 5): reaction labels are out of date (EMPATHY is "Love", APPRECIATION is "Support"). The `engage` skill uses the docs labels; the spec itself is still wrong.
- Story 5: draft-only actions aren't logged, so the duplicate check can't catch a comment the user already pasted by hand. Consider a `profile-record`-style "I did it" record if that matters.
- Gate counts all logged actions toward the cap (posts, comments, reactions); confirm this matches intent.
- Story 6: profile skills write only local files and have no tool to test; their behavior is checked by `docs/examples/` and manual use. Examples for `profile-audit`, `portfolio-build` and `profile-diff` are not written (spec requires only post-draft, engage, profile-rewrite).
