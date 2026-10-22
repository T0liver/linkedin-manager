# Follow-ups

- Story 4: `checkWrite` only checks; tools must call `appendLog` after a successful write, or the cap and duplicate check never see it.
- Story 4: a failed write must not be logged (otherwise it counts toward the cap and blocks a retry as a duplicate).
- Story 1 test (`server.test.ts`) skips itself when `dist/` is missing; consider a `pretest` build so it can never skip silently.
- Add a `.gitattributes` (`* text=auto eol=lf`) to stop the CRLF warnings on Windows.
- Gate counts all logged actions toward the cap (posts, comments, reactions); confirm this matches intent.
