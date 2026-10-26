---
name: profile-diff
description: Show what changed in the user's recorded LinkedIn profile since an earlier recorded version, using the local changelog. Use when the user asks what changed on their profile or wants the changelog.
---

# profile-diff

Read-only report over the local record. It reflects only what was recorded with `profile-record`; it cannot see edits the user made on LinkedIn without recording them.

## Hard rules

- This skill never calls a write tool (`create_post`, `comment`, `react`). Anything that would go to LinkedIn is shown as a preview and pasted by the user.

- Work only from local files (`profile/*.md`, `profile/changelog.md`). Do not scrape or read LinkedIn.
- Never invent changes or fill gaps. If the changelog is empty or a section has no history, say so.
- Ask at most 1-2 questions (which section or time range, if unclear).
- Show real before/after text; don't paraphrase it.
- Writes nothing except the changelog if the user asks you to add a note.

## Workflow

1. Read `~/.linkedin-agent/profile/changelog.md`. If it doesn't exist, say that no changes have been recorded yet and suggest `profile-record`.
2. Choose the scope: all sections, one section, or entries since a date the user names (default: the last 5 entries per section).
3. For each entry, show: date, section, the old text and the current text (changelog holds the old, the profile file holds the newest), and a short summary of what changed.
4. Flag sections where `Last recorded` is old or `Current` is empty, and sections where `Proposed` differs from `Current` (an unapplied draft).
5. Offer next steps: `profile-record <section>` for unrecorded edits, `profile-rewrite <section>` for stale ones. If asked, append a free-text note to the changelog.

## Tools used

None. Reads local files only.
