# Frontend: optional job status config integration

**Purpose:** Contract for the frontend to use the backend’s canonical job status (optional GET /config/job-status) with a static fallback. Product/alignment: wire status/transition UI to this when the backend exposes the endpoint; otherwise the app keeps using static constants.

---

## Backend endpoint (optional)

- **GET /config/job-status** (no auth)  
  Returns `{ data: { statuses, events, transitions, eventPermissions } }`.  
  See [BACKEND_ENDPOINTS.md](./BACKEND_ENDPOINTS.md) Config (optional) section.

---

## Frontend implementation (for frontend repo)

### 1. Service: `src/services/config.service.ts`

- **getJobStatusConfig()**  
  Calls `GET /config/job-status` (using `NEXT_PUBLIC_API_URL` or equivalent).  
  Returns a normalized shape, e.g. `{ statuses, terminal?, transitions?, labels? }`, or **null** on failure (network error, 404, or non-2xx).  
  Do not throw; return null so the app can fall back to static config.

### 2. Hook: `src/hooks/useJobStatusConfig.ts`

- **useJobStatusConfig()**  
  - Fetches job status config (e.g. 5 min stale) via `getJobStatusConfig()`.  
  - Exposes: **getLabel(status)**, **canTransition(from, event)**, **isTerminal(status)**, **isFromServer** (true when data came from the API).  
  - If the endpoint is missing or fails, falls back to **src/constants/jobStatus.ts** (or equivalent static copy of statuses/transitions).  
  - So: status/transition UI can always use `useJobStatusConfig()`; when the backend exposes the endpoint, the app uses server config; otherwise it uses the static constants.

### 3. Static fallback: `src/constants/jobStatus.ts`

- Copy from backend’s canonical source (`src/constants/jobStatus.ts` in this repo) or keep in sync: statuses list, transition matrix, event permissions.  
  Used when GET /config/job-status is not available or fails.

---

## Product / alignment

- **BACKEND_ENDPOINTS.md** has a **Config (optional)** section for GET /config/job-status.  
- **FRONTEND_QA_COMPLETE_REFERENCE.md** (in the frontend repo): in the Product/alignment section, mention this integration and **useJobStatusConfig**: “Wire status/transition UI to useJobStatusConfig() when the backend exposes GET /config/job-status; otherwise the app uses static constants from src/constants/jobStatus.ts.”
