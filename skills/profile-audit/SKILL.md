---
name: profile-audit
description: Produce a ranked list of fixes for the user's LinkedIn profile from their local profile files and voice.md. Use when the user asks to audit, review or improve their LinkedIn profile.
---

# profile-audit

Review the recorded profile and rank what to fix first. Read-only: it changes nothing on LinkedIn and writes no profile text.

## Hard rules

- This skill never calls a write tool (`create_post`, `comment`, `react`). Anything that would go to LinkedIn is shown as a preview and pasted by the user.

- Work only from `~/.linkedin-agent/profile/*.md` and `voice.md`. Do not scrape LinkedIn or the user's public page.
- Never invent metrics or facts. Where a fix needs a fact you don't have, list it as a question.
- Ask at most 1-2 clarifying questions (for example the user's goal: job search, clients, visibility).
- No generic advice ("be more engaging"). Each finding names the section, the problem and the specific change.
- Profile edits are draft-only; this skill proposes, the user pastes.

## Workflow

1. Read `~/.linkedin-agent/voice.md` and every file in `~/.linkedin-agent/profile/` (headline, about, `experience/*`, featured, skills). Use the `Current` section; note `Last recorded` dates.
2. If files are missing or still contain template placeholders, list them as "not recorded" and suggest `profile-record`. Do not guess their contents.
3. Check each section for: clarity of what the user does and for whom, specifics instead of vague claims, the opening of About (visible before "see more"), consistency across sections, stale or missing roles, thin Featured, skills order (top 3 pinned), and fit with `voice.md`. Respect LinkedIn limits: headline 220, About 2,600, role description 2,000 characters.
4. Output a ranked list, highest impact first, each item as:
   - **N. Section: short title** (impact: high/medium/low)
   - Problem: what is wrong, quoting the current text.
   - Fix: the concrete change.
   - Needs from you: facts required, if any.
   - Next step: the skill to run (`profile-rewrite <section>`, `portfolio-build`).
5. End with a "not recorded" list and at most 1-2 questions. Offer to start with the top item via `profile-rewrite`.

## Tools used

None. Reads local files only.
