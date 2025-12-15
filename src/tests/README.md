# Tests Overview

- **Smoke tests** (`npm run test:smoke`): gatekeepers for uptime and contract sanity.
- **Integration tests** (`npm run test:integration`): validate end-to-end flows (jobs, payments, payouts, disputes).
- **Unit tests**: optional/V2; use as needed for isolated logic.

Keep smoke tests fast and deterministic. Integration tests may require a live/test database and Stripe secrets.

