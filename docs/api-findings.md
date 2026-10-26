# LinkedIn API findings: comments and reactions

Researched 2026-10-26 against the official docs (Marketing version `li-lms-2026-10`). Our app has the self-serve products "Share on LinkedIn" (`w_member_social`) and "Sign In with LinkedIn using OpenID Connect" (`openid profile`).

## Endpoints (official, versioned `/rest`)

- **React:** `POST https://api.linkedin.com/rest/reactions?actor={encoded personUrn}` with body `{ "root": "<activity|share|ugcPost URN>", "reactionType": "<TYPE>" }`. 201 Created on success. [Reactions API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/reactions-api) (updated 2026-06-24).
- **Comment:** `POST https://api.linkedin.com/rest/socialActions/{shareUrn|ugcPostUrn|commentUrn}/comments` with body `{ "actor": "<personUrn>", "object": "<post URN>", "message": { "text": "..." } }`. The new comment id comes back in `x-restli-id`. Images in comments are rejected (403). A per-member one-minute rate limit applies (429). [Comments API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/comments-api) (updated 2026-04-30).

## Reaction types (verified 2026-10-26)

| API value | UI label |
|---|---|
| `LIKE` | Like |
| `PRAISE` | Celebrate |
| `EMPATHY` | Love |
| `INTEREST` | Insightful |
| `APPRECIATION` | Support |
| `ENTERTAINMENT` | Funny |

`MAYBE` (Curious) is deprecated since 202307 and returns 400 on create. **The spec's labels are out of date:** it calls `EMPATHY` "Support". In the current docs `EMPATHY` is "Love" and `APPRECIATION` is "Support".

## Permissions: the docs contradict each other

- The Comments and Reactions API pages list **`w_member_social_feed`** ("Post, comment, and react to posts on behalf of an authenticated member"). They do not mention `w_member_social`.
- [Getting Access to LinkedIn APIs](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access) (updated 2026-06-03) lists **`w_member_social`** from Share on LinkedIn as an open permission: "Post, comment and like posts on behalf of an authenticated member."
- `w_member_social_feed` comes with the **Community Management API**, a vetted product ([overview](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview), updated 2026-05-15). Getting it needs an application, a business email, a LinkedIn Page super admin to verify the app, a new app with no other products, and a screencast for Standard tier. Third-party guides say individuals without a registered legal entity are not eligible. LinkedIn's own pages don't say this outright.
- Reading posts, comments and reactions (`r_member_social`) is closed. We cannot read a post's text or check whether we already reacted to it.

**Conclusion:** the docs don't settle the question, but the probe below does. A Share on LinkedIn token **cannot** comment or react through the API. Getting Community Management access is not realistic for a personal app.

## Probe result (2026-10-26, user-approved)

Token scope `openid,profile,w_member_social`, header `LinkedIn-Version: 202610`. The requests could not create anything on their own (a deprecated `MAYBE` reaction, and a comment with no `message`):

| Request | Result |
|---|---|
| `POST /rest/reactions?actor=urn:li:person:…` | `403 ACCESS_DENIED`: "Not enough permissions to access: partnerApiReactions.CREATE.20261001" |
| `POST /rest/socialActions/{urn}/comments` | `403 ACCESS_DENIED`: "Not enough permissions to access: partnerApiSocialActions.CREATE.20261001" |

The validation errors (400) never came back, so LinkedIn rejected both calls on permissions alone.

## What this means

- **Not possible with our app:** creating comments or reactions, and reading posts, comments or reactions.
- **Possible:** publishing our own posts (`create_post`, Story 4).
- `comment` and `react` therefore run in **draft-only** mode by default: they return the text and the post link, and the user acts on LinkedIn by hand. The API mode stays in the code for an app that gets `w_member_social_feed` later. It is switched on through `engagementMode: "api"` in `config.json`.
- Re-check this if LinkedIn changes the Share on LinkedIn product or the app gets Community Management access.

## Post URL to URN

These URL shapes can be turned into a URN without any API call:

- `https://www.linkedin.com/feed/update/urn:li:activity:123/` (also `share`, `ugcPost`)
- `https://www.linkedin.com/posts/<slug>-activity-123-abcd` gives `urn:li:activity:123`
- A bare URN `urn:li:activity:123`

Anything else (for example a `lnkd.in` short link) is not resolved. We ask the user for the "Copy link to post" URL instead of fetching the page, which would be scraping.
