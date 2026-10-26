# Follow-ups

- Story 4: LinkedIn versions sunset after ~1 year (HTTP 426); bump `API_VERSION` in `server/src/linkedin/client.ts` at least yearly. Live check on 2026-10-26 confirmed the Posts API request shape for text posts with 202610; the image upload path is untested live.
- Story 1 test (`server.test.ts`) skips itself when `dist/` is missing; consider a `pretest` build so it can never skip silently.
- Add a `.gitattributes` (`* text=auto eol=lf`) to stop the CRLF warnings on Windows.
- Gate counts all logged actions toward the cap (posts, comments, reactions); confirm this matches intent.
