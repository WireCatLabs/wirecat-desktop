---
name: release-notes
description: Write the plain-language release notes for a WireCat Desktop version into docs/releases/<version>.md before bin/tag-release. Use when asked to prepare a release, write release notes, or when bin/tag-release says the notes file is missing.
---

# Release notes

`bin/tag-release` refuses to tag until `docs/releases/<version>.md` exists. The release workflow publishes that file
as the body of the GitHub release, and the update dialog shows its text before "All changes".

Write it for people who use the app, not for people who build it.

## Steps

1. Version: `jq -r .version package.json`. Previous tag: `git describe --tags --abbrev=0`.
2. List what reached main since that tag:
   `gh pr list --state merged --base main --search "merged:>$(git log -1 --format=%cI <prev-tag>)" --limit 200 --json number,title,body`.
   Cross-check with `git log <prev-tag>..HEAD --oneline`: some commits have no PR, and a PR merged before the tag
   date may still be in the range.
3. Read each PR body, not only its title. Work out what a user will notice.
4. Write `docs/releases/<version>.md` in this shape, in this order:

```md
One or two sentences: what this version is about.

## New
- What a user can now do, in plain words.

## Improved
- What works better, or is easier.

## Fixed
- What was broken and now is not.

## Known issues
- Only when there are any. Leave the section out otherwise.

## All changes
- Title rewritten so a person can read it (#79)
```

Leave out a section that has nothing in it.

## Rules

- Say what the user sees or can do. Leave out internal refactors, tests, CI and code structure.
- Simplified Technical English: short sentences, one idea each, common words, active voice.
- No jargon, no internal ids (`A11`, `NEED-`, `WC-SECR-`), no author names, no semicolons, no long dashes, no hype
  words ("powerful", "seamless", "blazing").
- Name a tool by what it is for when you can ("Telegram", "Email"), and keep command names for the one place a user
  needs to type them.
- "All changes" has one line per PR: the title in plain words, then the link as `(#79)`. No author. Keep the number
  as plain text, GitHub links it. Leave out docs, journal, plan, test and release-bump PRs. A change with no PR
  (a direct commit) gets a line without a number.
- Do not edit the published GitHub release by hand. Commit the file, then tag.
