---
name: profile-record
description: Record what the user actually pasted into a LinkedIn profile section as the new `current` text, note how it differs from the draft, and offer to update voice.md. Use after the user says they updated a profile section on LinkedIn.
---

# profile-record

Usage: `profile-record <section>`. Keeps the local files truthful: `Current` must be what is really on LinkedIn.

## Hard rules

- This skill never calls a write tool (`create_post`, `comment`, `react`). Anything that would go to LinkedIn is shown as a preview and pasted by the user.

- Record only what the user reports or pastes. Never assume they pasted your proposal unchanged; ask.
- Never invent or "fix" text when recording. Save it verbatim.
- Ask at most 1-2 questions (the final text if it differs; whether to update `voice.md`).
- Do not read LinkedIn. Nothing is sent anywhere.
- Updating `voice.md` happens only if the user agrees.

## Workflow

1. Read `~/.linkedin-agent/profile/<section>.md`.
2. Ask whether they pasted the `Proposed` text as is. If yes, use it. If they edited it, ask them to paste the final text exactly as it now appears on LinkedIn.
3. Before changing anything, keep the old `Current` for the changelog.
4. Write the final text into `Current`, set `Last recorded` to today's date, and keep `Proposed` as the draft that was used (rename the heading line to `Proposed (last draft)` only if they differ, otherwise leave it).
5. Append an entry to `~/.linkedin-agent/profile/changelog.md` (create if missing): date, section, one-line summary of the change, and the old text.
6. If the final text differs from the draft, say how: list the concrete edits (words cut, tone changes, facts added) in 2-4 bullets. Then offer to add the lesson to `voice.md` under "Corrections log", for example "I cut exclamation marks." Add it only if they say yes.
7. Confirm what was saved and where.

## Tools used

None. Reads and writes local files only.
