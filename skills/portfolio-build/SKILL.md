---
name: portfolio-build
description: Propose 3-5 Featured items for the user's LinkedIn profile from GitHub repos, talks and writing they point to. Use when the user asks to build or improve their Featured section or portfolio.
---

# portfolio-build

Pick the few things most worth pinning in Featured. Draft-only: the user adds the items in LinkedIn.

## Hard rules

- This skill never calls a write tool (`create_post`, `comment`, `react`). Anything that would go to LinkedIn is shown as a preview and pasted by the user.

- Only propose items the user points to (links, repo names, talk titles, posts). Don't search for or scrape their work, and don't read LinkedIn.
- Never invent facts or metrics about an item. Describe only what the user told you or what is visible in material they gave you (for example a README they pasted or a repo you can read locally).
- Ask at most 1-2 clarifying questions (for example the target audience, or which items they are proud of).
- No generic descriptions ("An awesome project"). Each description says what it is and why it matters, using given facts.
- Profile edits are draft-only; the user adds items themselves.

## Workflow

1. Read `~/.linkedin-agent/voice.md` and `~/.linkedin-agent/profile/featured.md` (create it from `templates/profile/featured.md` if missing). Skim `about.md` and the experience files for the profile's focus.
2. If the user hasn't named candidates, ask them to list repos, talks, articles or posts with links. If they point at local repo folders, read their README files.
3. Choose 3-5 items. Rank by relevance to the focus of the profile, evidence of quality (given by the user), and variety. Explain each pick in one line, and name anything left out and why.
4. Write the proposal into the `Proposed` section of `featured.md`: title, link, one-or-two-sentence description, why this item. Fill `Open questions` for missing facts.
5. End with a copy-ready block per item (title, link, description) and the LinkedIn UI path: Profile > Add profile section > Recommended > Add featured. Note that the first two items are the most visible.
6. Tell the user to run `profile-record featured` after adding them.

## Tools used

None. Reads and writes local files only.
