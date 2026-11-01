# EMFLS Notion article publishing: external scheduler

Status: **30-MINUTE TARGET / EXTERNAL SCHEDULER CHANGE REQUIRED**. The external scheduler is configured historically, but its 30-minute recurrence must be changed in cron-job.org and then verified. The original workflow_dispatch end-to-end test of article #5 occurred on 2026-10-23 KST.
Updated: 2026-11-01 KST.

## Architecture

The only supported production trigger of `.github/workflows/notion-two-hour-publisher.yml` is the authenticated GitHub Actions `workflow_dispatch` API.

cron-job.org => GitHub Actions workflow_dispatch => validated Notion stage => GitHub PR auto-merge => GitHub Pages live verification => Notion finalize.

GitHub `schedule:` is deliberately disabled because scheduled runs were skipped. The former ChatGPT scheduled write-to-main trigger is also disabled, because that scheduled task was blocked. Do **not** create a second publisher or manually change Notion to 발행완료 without verifying the publicly available article.

### External schedule (configure in cron-job.org account; never put authentication tokens in GitHub or Notion documents)

- Name: existing EMFLS Notion publishing job (keep the existing job, do not create a second one)
- Time zone: `Asia/Seoul`
- Frequency: **every 30 minutes**, at `:00` and `:30` every hour (00:00, 00:30, ... 23:30 KST). Update the **existing** cron-job.org task; do not create a second publisher. The repository enforces at most one article per 30-minute interval.
- If the service offers a five-field cron syntax with the time zone configured: `*/30 * * * *`.
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

1. Confirm the latest successfully published Notion page is publicly reachable and the last publication slot is respected. The publisher enforces a strict 30-minute gap and can wait up to ten minutes for small scheduler drift.
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

### One-time action for switching to 30-minute publishing (target: 48 articles per full day)

1. Open the **existing** cron-job.org job and change its Custom schedule to every 30 minutes at :00 and :30 (Asia/Seoul). Do not add a duplicate job.
2. Save and confirm the next executions are spaced 30 minutes apart, including both :00 and :30.
3. The endpoint, token, POST method, request headers, and JSON body stay unchanged.
4. Confirm a subsequent workflow_dispatch run publishes no more than one article, with the 30-minute cooldown respected.

The external scheduler was historically tested with HTTP 204 and article #5 published in an end-to-end run on 2026-10-23. **The 30-minute cron-job.org recurrence has not been verified by this repository change.** HTTP 204 from workflow_dispatch is dispatch acceptance, not proof of publication. A full day produces at most 48 publishing opportunities; actual successful releases may be fewer if the queue is empty, GitHub Actions delays occur, a run fails, or live publication verification blocks the next release.
