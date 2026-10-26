---
name: profile-rewrite
description: Write a proposed version of one LinkedIn profile section (headline, about, an experience role, skills) into the local profile file, ending with a copy-ready block and the LinkedIn UI path. Use when the user asks to rewrite or improve a profile section.
---

# profile-rewrite

Usage: `profile-rewrite <section>` where section is `headline`, `about`, `experience/<role>`, `skills` (or `featured`, but prefer `portfolio-build`).

## Hard rules

- This skill never calls a write tool (`create_post`, `comment`, `react`). Anything that would go to LinkedIn is shown as a preview and pasted by the user.

- Ask at most 1-2 clarifying questions, in one message, and only for facts you need.
- Never invent metrics, employers, titles, dates, tools or outcomes. If a strong sentence needs a number, ask for it or write the sentence without it and list the gap under "Open questions".
- No generic filler ("results-driven professional", "passionate about"). Use the user's voice from `voice.md`.
- Profile edits are draft-only: you write to the local file, the user pastes into LinkedIn. Nothing is sent to LinkedIn.
- Always end with a copy-ready block and the LinkedIn UI path.

## Workflow

1. Read `~/.linkedin-agent/voice.md` and `~/.linkedin-agent/profile/<section>.md`. If the file is missing, copy it from the repo's `templates/profile/` first (for experience, one file per role). Read the other profile files for consistency.
2. If `Current` is empty or a placeholder, ask the user to paste it, or to describe what they want if the section is new.
3. Ask 1-2 questions for missing facts only if needed. Keep any facts the user gives in this session; don't store them anywhere else.
4. Write the proposal into the `Proposed` section of the file, replacing any previous proposal, within the section's limit (headline 220, About 2,600, role 2,000 characters). Fill `Open questions` with facts you lacked.
5. Show the user a short rationale (what changed and why, 3-5 bullets), then end with:

   **Copy-ready**

   ````
   <the exact proposed text, nothing else>
   ````

   **Paste it here:** <LinkedIn UI path from the template, e.g. Profile > pencil icon (Edit intro) > Headline>

   Character count: <n> / <limit>.
6. Tell the user to run `profile-record <section>` after pasting, so the file reflects what is actually on LinkedIn.

## Tools used

None. Reads and writes local files only.
