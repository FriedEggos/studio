# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.
<<<<<<< HEAD
=======

---

## CI / Deployment (GitHub Actions) 🔁

This repo includes workflows to test DB connectivity on PRs and to build & deploy the site on pushes to `main`.

### Secrets & recommended setup 🔐

- Option A — **Workload Identity Federation (recommended)**
  - Create a **service account** in GCP for CI with least privilege (e.g., `roles/datastore.viewer` for smoke tests and `roles/firebasehosting.admin` for deploys if needed).
  - Create a **Workload Identity Pool** and **Provider** that trusts GitHub Actions.
  - Grant the provider permission to impersonate the service account (role: `roles/iam.workloadIdentityUser`).
  - Add two repository secrets:
    - `WIF_PROVIDER` — the provider resource name (e.g., `projects/123456/locations/global/workloadIdentityPools/POOL/providers/PROVIDER`)
    - `GCP_SA_EMAIL` — the service account email (e.g., `sa-name@PROJECT_ID.iam.gserviceaccount.com`) 

- Option B — **Service account JSON (fallback)**
  - Create a service account key JSON (if allowed by your org). Save it as a GitHub secret named `FIREBASE_SERVICE_ACCOUNT` or use `FIREBASE_TOKEN` (for hosting deploys via `firebase login:ci`).
  - If using `FIREBASE_SERVICE_ACCOUNT`, the PR test workflow will write it to `sa.json` during the job and set `GOOGLE_APPLICATION_CREDENTIALS`.

### Workflow behavior ⚙️
- `.github/workflows/test-db.yml` runs a smoke test on PRs and will fail if `FIREBASE_SERVICE_ACCOUNT` (or WIF config in your environment) is not present.
- `.github/workflows/deploy.yml` runs on `push: main`, and supports both `FIREBASE_TOKEN` and Workload Identity (`WIF_PROVIDER` + `GCP_SA_EMAIL`). It also supports manual dispatch (`workflow_dispatch`) and scheduled deploys (CRON).

### Environment protection / approval 🔒
- The deploy workflow uses a `production` environment to require manual approvals (configure environment protection in your repo settings: Settings → Environments → `production` → set required reviewers).

If you want, I can add example `gcloud` commands for creating the Workload Identity resources or a sample request you can send to your GCP admins to finish setup.
>>>>>>> d60579ca3826a009b2ac56ff42588c3aa4470913
