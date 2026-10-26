---
name: post-draft
description: Draft 2-3 LinkedIn post variants from the user's idea in their voice, then publish one only after an explicit preview and confirmation. Use when the user gives a post idea or asks to write or publish a LinkedIn post.
---

# post-draft

Turn an idea into a post the user approves, then publish it through `create_post`.

## Hard rules

- Ask at most 1-2 clarifying questions, in one message. If the idea is clear enough, ask none.
- Never invent metrics, names, outcomes or facts. If a post needs a number or detail you don't have, ask for it or leave it out.
- No generic filler or engagement bait ("Thrilled to announce", "Agree?").
- Always preview before any write tool call. `create_post` is called with `confirm=true` only after the user approves that exact text and visibility.
- One post per confirmation. Never batch.

## Workflow

1. Read `~/.linkedin-agent/voice.md`. If it is missing, tell the user to copy `templates/voice.md` there and fill it in; offer to draft with neutral plain wording in the meantime.
2. Take the user's idea. Ask 1-2 clarifying questions only if essential (the point, or a missing fact).
3. Write 2-3 variants in the user's voice, differing in angle or structure, not just wording. Show them with the character count of each (limit 3000).
4. The user picks or edits one. Apply their edits verbatim; don't "improve" them.
5. Ask for visibility if not stated: `connections` (default) or `public`. Optional `imagePath` (absolute path to a png, jpg or gif).
6. Call `create_post({ text, visibility, imagePath?, confirm: false })`. Show the returned preview and any warnings, and ask: "Publish this exact post?"
7. Only on a clear yes, call `create_post` again with the same arguments and `confirm: true`.
8. Report the result:
   - `done`: give the post URL. Mention it was logged.
   - `rejected` (daily cap, duplicate, missing image): say why; do not retry or work around it.
   - `failed`: say the draft was saved locally and where; do not retry automatically. For a rate limit or auth error, relay the hint (for example `npm run login`).
9. `list_posts` shows what was published recently; use it if the user asks about past posts or to avoid repeating a topic.

## Tools used

`create_post`, `list_posts`.
