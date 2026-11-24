# MetricYak development guidelines

## Code guidance

### Tests

Test behaviour, not implementation. Tests drive the system the way a real client would, through its entry points (API routes, queue consumers, jobs). Do not unit test internal functions or helpers.

- **Extend relevant existing tests rather than add new tests.** If an existing test already passes through the code you change, add assertions to that test instead of writing a new one.
- **Every new test must catch a regression that no existing test catches.** If you cannot name the regression, then do not add the test. A test that only changes input values on a path that's already covered doesn't qualify. Fold it into the existing test as a parameterized case, or drop it.
- **Name tests as user scenarios**, e.g. "A person invites a teammate to their organization", not "createInvite returns 201".
- **Assert the full outcome, not just the response.** Assert the entire response body, then assert every store the test wrote to (database rows, queue messages, cache entries) and any side effects (emails sent, external calls made).

## Public repository

This repository is public. Anything pushed to it (code, comments, test data, commits, PRs, issues) is public and stays public. Deleting it or rewriting history does not undo that, because forks and caches keep copies.

- Never include customer data, secrets or credentials, private conversations, incident details or production logs.
- Never include internal hostnames, dashboard URLs, cloud account IDs or the names of internal tools.
- Use reserved values for fake data: `example.com` or `.test` domains, documentation IP ranges (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) and tokens that are obviously fake.
- Never describe an unpatched security vulnerability in a commit, PR or issue. Report it privately through a GitHub security advisory.
- If a secret is pushed, treat it as leaked: rotate it straight away, then clean up the history.
- Only copy code or add dependencies whose licences are compatible with this repository's licence.

## Commits and pull requests

### Format

Commit messages and PR titles both use [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>(<scope>): <description>
```

- **type**: only one of
  - `feat`: adds or changes behaviour users can see
  - `fix`: corrects a bug
  - `chore`: no change in behaviour (docs, tests, CI, config, refactors)
- **scope** (optional): the package or area, e.g. `auth`, `ingestion`
- **description**: imperative mood, lowercase, no trailing period
- Keep the whole title under 72 characters.

Example: `feat(auth): add GitHub sign-in`

**Breaking changes** are anything someone upgrading a self-hosted install must act on: renamed or removed env vars or config, changed API contracts, or migrations that need manual steps. Mark them with `!` after the type or scope and add a `BREAKING CHANGE:` footer that says what to do.

Example: `feat(config)!: rename DATABASE_URL to POSTGRES_URL`

### Pull request description

Follow `.github/pull_request_template.md` exactly. Fill in every section, delete the guidance comments, and uncomment `Closes #<issue>` when the PR closes an issue. Do not invent your own format.

- Keep each PR to one concern.
- Explain why the change is needed. Do not list every file that changed.
- Include screenshots or recordings for UI changes.
- Open the PR as a draft until it is ready for review.

### Stacked PRs

When a PR depends on another PR that hasn't merged, stack them with the `gh stack` CLI instead of chaining branches by hand. Read [.claude/skills/gh-stack/SKILL.md](.claude/skills/gh-stack/SKILL.md) for how to create, sync, submit and merge stacks.

- Each PR in a stack must pass CI, leave `main` working if merged on its own, and be reviewable without reading the PRs above it.
- Keep stacks to 3–4 PRs.
- Merge from the bottom up and sync the rest of the stack after each merge.
