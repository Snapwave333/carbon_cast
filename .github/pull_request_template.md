<!--
Thanks for contributing to CarbonCast IPTV! ⚡

Keep the description focused — what changed and why is enough.
For large changes, link to the relevant architecture doc or issue.
-->

## 📋 What Changed

<!-- Short bullet summary of the changes in this PR. -->

## 🎯 Why

<!-- The motivation — bug fix, feature, refactor, etc. Link to the issue if applicable: Closes #123 -->

## 📝 Release Note

Changes a user could notice need one file in `.changes/` describing the change in plain language.
See [`.changes/README.md`](.changes/README.md) for the format. It becomes the release notes and website post.

- [ ] Added a `.changes/<area>-<slug>.md` note
- [ ] Not needed — test-only, docs, CI, or a pure refactor with no behavior change

## ✅ Checks

- [ ] Tests added or updated for the changed behavior
- [ ] `pnpm run lint` passes (or affected project lint target)
- [ ] `pnpm nx test <project>` passes for affected projects
- [ ] No new files added to `tools/eslint/max-lines-baseline.mjs`
