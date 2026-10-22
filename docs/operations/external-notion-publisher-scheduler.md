# EMFLS Notion article publishing: external scheduler

Status: **ACTIVE / VERIFIED ON 2026-10-23 KST**. External scheduler is configured; a workflow_dispatch end-to-end publication of article #5 was verified. Token rotation and subsequent requests require ongoing monitoring.
Updated: 2026-10-23 KST.

## Architecture

The only supported production trigger of `.github/workflows/notion-two-hour-publisher.yml` is the authenticated GitHub Actions `workflow_dispatch` API.

cron-job.org => GitHub Actions workflow_dispatch => validated Notion stage => GitHub PR auto-merge => GitHub Pages live verification => Notion finalize.

GitHub `schedule:` is deliberately disabled because scheduled runs were skipped. The former ChatGPT scheduled write-to-main trigger is also disabled, because that scheduled task was blocked. Do **not** create a second publisher or manually change Notion to 발행완료 without verifying the publicly available article.

### External schedule (configure in cron-job.org account; never put authentication tokens in GitHub or Notion documents)

- Name: `EMFLS Notion 2h publishing`
- Time zone: `Asia/Seoul`
- Frequency: **every hour at `:30`** (00:30, 01:30, ... 23:30 KST). Update the cron-job.org job schedule manually from two-hour to hourly; repository code already enforces the one-hour cooldown.
- If the service offers a five-field cron syntax with the time zone configured: `30 * * * *`.
- URL: `https://api.github.com/repos/emfls/emfls.github.io/actions/workflows/notion-two-hour-publisher.yml/dispatches`
- HTTP method: `POST`
- Request body type: `application/json`
- Body: `{"ref":"main"}`
- Headers:
  - `Accept: application/vnd.github+json`
  - `Content-Type: application/json`
  - `Authorization: Bearer <FINE_GRAINED_GITHUB_TOKEN>`

Create the fine-grained GitHub personal access token in GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens. Repository access: **only** `emfls/emfls.github.io`. Repository permission: **Actions = Read and write**. Grant no other write permissions. Set an expiration date; record a private rotation reminder. Paste the token **only in the scheduler's Authorization header**, never into ChatGPT, Notion, a GitHub commit or this file.

GitHub official source: https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event
cron-job.org documentation: https://cron-job.org/en/faq/

### End-to-end smoke test after configuring the scheduler

1. Confirm the latest successfully published Notion page is publicly reachable, and its publication slot was at least one hour ago. This publisher enforces a strict one-hour gap and can wait up to ten minutes for small scheduler drift.
2. Use the scheduler's **Execute now / Test run** feature once.
3. Verify that GitHub Actions launched a new **workflow_dispatch** run: https://github.com/emfls/emfls.github.io/actions/workflows/notion-two-hour-publisher.yml
4. Verify run steps: stage one page -> commit and auto-merge PR -> GitHub Pages live verified -> Notion `발행완료`.
5. Verify actual HTTP 200 of the **correct** new public page and its canonical, analytics/AdSense template and category sitemap.
6. Do not infer successful publication from the scheduler's HTTP 200 response alone. This HTTP result confirms dispatch acceptance, not completion of the asynchronous GitHub Actions workflow.
7. If `QUEUE_EMPTY`, no article is published; this is normal. If `COOLDOWN`, spacing prevented a publication, and the next external schedule will retry. If a job fails, review the GitHub Actions job logs and Notion state.
8. Disable retries for unsuccessful HTTP requests that might create duplicate dispatches. The repository's serialized concurrency and ledger provide defense in depth, but do not intentionally generate redundant attempts.

### Security and operations

The third-party scheduler stores the GitHub token; use a single-repository fine-grained credential, enable scheduler MFA, and never log the token. A leaked token with Actions write access can trigger *any* workflow in the selected repository, not merely the Notion publisher. Revoke it immediately if exposure is suspected. Rotate on expiry.

Use the separate read-only ChatGPT monitoring task for run-state and missing-publication alerts. Monitoring must never modify GitHub files or Notion rows, dispatch workflows, or pretend an HTTP success from GitHub is a published article.

### One-time action for switching to hourly publishing

1. Open the already configured cron-job.org job and change its Custom schedule from every two hours at :30 to every hour at :30.
2. Save and confirm Next executions are hourly.
3. The endpoint, token, POST method, request headers, and JSON body stay unchanged.
4. Confirm a subsequent workflow_dispatch run publishes no more than one article, with the one-hour cooldown respected.

The external scheduler was tested with an HTTP 204 request, and article #5 successfully published in an end-to-end run on 2026-10-23. The **hourly recurrence remains pending** until the cron-job.org schedule is manually updated and subsequently verified.
