# Example: engage (draft-only mode)

Illustrative transcript. The post and names are made up. This is the default outcome today: LinkedIn's API refuses comments and reactions for this app (see `docs/api-findings.md`), so the tools return text and a link.

**User:** https://www.linkedin.com/feed/update/urn:li:activity:7000000000000000000/ Here's the post: "We dropped microservices for a modular monolith. Deploys went from 40 minutes to 5, but we had to rewrite our service-to-service auth." Want to say something useful.

**Agent:** I can read the link as `urn:li:activity:7000000000000000000`. Proposal:

- Reaction: `INTEREST` (Insightful). It's a concrete trade-off write-up.
- Comment, drawing on something specific from the post, with no claims about you that I don't know. Do you have your own experience with moving off microservices? One question: did you hit the same auth problem?

**User:** Yes, we kept the services but merged the auth layer into a shared library.

**Agent:** Comment draft:

> The auth rewrite is the part people underestimate. We went a different way: kept the services and moved auth into a shared library. Did you consider that before collapsing everything into one deployable?

Two separate actions, so two separate confirmations. First, the reaction. Calling `react` with `confirm: false`:

> **Preview:** react `INTEREST` (Insightful) on urn:li:activity:7000000000000000000.

Do this?

**User:** Yes.

**Agent:** Calling `react` with `confirm: true`. Result: draft-only, nothing was sent to LinkedIn.

> Open https://www.linkedin.com/feed/update/urn:li:activity:7000000000000000000/ and choose **Insightful** yourself.

Now the comment. Calling `comment` with `confirm: false`: preview shows the text above. Post this one?

**User:** Yes.

**Agent:** Calling `comment` with `confirm: true`. Result: draft-only. Open the link above and paste this text yourself:

> The auth rewrite is the part people underestimate. We went a different way: kept the services and moved auth into a shared library. Did you consider that before collapsing everything into one deployable?

Note: hand-posted actions aren't logged, so the duplicate check can't see them.
