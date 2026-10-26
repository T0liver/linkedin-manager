# Example: profile-rewrite headline

Illustrative transcript. Facts are made up for the example.

**User:** profile-rewrite headline

**Agent:** I read `profile/headline.md` and `voice.md`. Current headline: "Software Engineer at Acme | Passionate about technology". It says nothing about what you work on. Two questions: what do you mainly work on, and who is it for?

**User:** Backend and build tooling for a telecom product, mostly C++ and Python. For the dev teams in the company.

**Agent:** Written to the `Proposed` section of `profile/headline.md`. Changes:

- Replaced "Passionate about technology" (no information) with your actual focus.
- Kept the employer you gave; didn't add a title or numbers you didn't tell me.
- Plain register, as in `voice.md`.

Open question saved in the file: your exact job title, in case you want it up front.

**Copy-ready**

```
Software engineer at Acme | Backend and build tooling in C++ and Python for telecom dev teams
```

**Paste it here:** Profile > pencil icon (Edit intro) > Headline.

Character count: 94 / 220.

After pasting, run `profile-record headline` so the file matches what's on LinkedIn.
