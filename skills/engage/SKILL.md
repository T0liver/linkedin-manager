---
name: engage
description: Propose a reaction and/or a specific comment on another person's LinkedIn post, preview it, and act only after confirmation. Use when the user pastes a LinkedIn post link or text and wants to react or comment.
---

# engage

Help the user respond to someone else's post. LinkedIn's API currently refuses comments and reactions for this app, so by default the tools return a draft-only result: the text and link for the user to use by hand. See `docs/api-findings.md`.

## Hard rules

- Never write generic filler ("Great post!", "Thanks for sharing", "Totally agree"). A comment must add something specific from the post: a point, a question, an experience the user actually has.
- Never invent facts, metrics or personal experience. If a comment needs the user's own experience, ask for it (max 1-2 questions).
- Always preview before any write tool call. Call `comment` or `react` with `confirm: true` only after the user approves that exact action.
- One action per confirmation: one comment or one reaction per call. Never batch. A reaction and a comment on the same post are two separate confirmations.
- Do not fetch or scrape the post page. Official API only.

## Workflow

1. Read `~/.linkedin-agent/voice.md`.
2. The user pastes a post URL, and the post text if they want a comment (the post can't be read through the API). If the text is missing and a comment is wanted, ask them to paste it.
3. If the link is a short link or in an unknown shape (for example `lnkd.in`), ask for the post's "Copy link to post" URL. Don't try to resolve it.
4. Propose, don't act:
   - A reaction type, with its reason. Types and LinkedIn UI labels: `LIKE` (Like), `PRAISE` (Celebrate), `EMPATHY` (Love), `INTEREST` (Insightful), `APPRECIATION` (Support), `ENTERTAINMENT` (Funny).
   - Optionally, one comment in the user's voice, short, specific to the post. Offer a skip if there is nothing worth saying.
5. User approves, edits or declines. Apply edits verbatim.
6. For each approved action separately: call `react({ postUrn, type, confirm: false })` or `comment({ postUrn, text, confirm: false })`, show the preview, ask "Do this?", and only on a clear yes call again with `confirm: true`.
7. Report by status:
   - `draft-only`: present it as "open this link and react/paste this yourself", with the link and the exact text. Say that nothing was sent to LinkedIn.
   - `done`: say it was posted, with the link.
   - `rejected` (cap, duplicate, unreadable link): say why; don't work around it.
   - `failed`: relay the hint; don't retry.
8. Note that draft-only actions aren't logged, so the duplicate check can't see what the user pasted by hand.

## Tools used

`comment`, `react`.
