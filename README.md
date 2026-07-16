# Dinners for Eight

Matches hosts and guests for lunch after Sunday church service. No database —
data lives as JSON in S3. No passwords — sign-in is via emailed magic links.
Deployed entirely on AWS with the frontend served from S3 through CloudFront.

## How it works

- **Sign in**: enter your name + email, get a magic link by email (via
  [Resend](https://resend.com)), click it to sign in. No passwords, no accounts
  to manage.
- **Pick a role**: every signed-in person chooses **Host** or **Guest**.
  - Hosts say how many people they can comfortably seat, "give or take a few"
    (a target headcount + a flex amount).
  - Guests say their party size, adults and children counted separately.
  - Both enter a home address, which is geocoded (Mapbox) so it can be placed
    on a map.
- **Address pre-fill**: when a signed-in person opens the host/guest form,
  their name is fuzzy-matched against a bundled church directory
  (`backend/src/data/members.json`) and their address is pre-filled (editable).
  The match is done server-side against the *signed-in* name only, so no one
  can look up anyone else's address.
- **Admin dashboard**: anyone whose email is in `ADMIN_EMAILS` sees a
  dashboard with host/guest counts, a map of every address, and these actions:
  - **Map hosts to guests** — runs a matching algorithm that balances headcount
    across hosts (so no one host is overloaded while another sits empty) while
    preferring geographically close pairings.
  - **Email groups** — after matching, emails each group (a host + their
    assigned guests) together to kick off a coordination thread; they reply-all
    to plan. Only enabled once a match has been run.
  - **Export CSV** — downloads all registrations (name, contact, address,
    headcount, notes) for spreadsheet use.
  - **Load test data** — loads a fixed set of fake `@example.test` hosts/guests
    (for trying out matching/map/email without real signups); idempotent.
  - **Wipe all data** — clears all registrations and match results for a fresh
    round. Requires a confirm; can't be undone.

## Architecture (no database, AWS-native)

```
┌────────────┐      ┌──────────────┐      ┌───────────────────┐
│ CloudFront │─────▶│  S3 (site)   │      │  S3 (data)         │
│ (HTTPS)    │      │  React build │      │  registrations.json│
└─────┬──────┘      └──────────────┘      │  matches.json       │
      │                                    └─────────▲───────────┘
      ▼                                              │
┌────────────┐      ┌──────────────────────────────┐ │
│ API Gateway│─────▶│ Lambda (8 functions)          │─┘
│ (HTTP API) │      │ auth, register, geocode,      │
└────────────┘      │ admin list, admin match        │──▶ Resend (magic-link email)
                     └──────────────────────────────┘──▶ Mapbox Geocoding API
```

- **`/frontend`** — Vite + React + TypeScript SPA (React Router for
  navigation, Mapbox GL JS for the map).
- **`/backend`** — TypeScript Lambda handlers. All "database" reads/writes
  are a single `registrations.json` and `matches.json` file in a private S3
  bucket (see `backend/src/lib/store.ts`). This is fine at the scale of a
  church small-group signup; see **Scaling notes** below if that changes.
- **`/infra`** — AWS CDK (TypeScript) that provisions everything: two S3
  buckets, a CloudFront distribution, 8 Lambda functions, and an HTTP API.

Auth is JWT-based and stateless: the magic-link email contains a short-lived
signed token (15 min); clicking it exchanges that for a longer-lived session
token (7 days) that the frontend keeps in `localStorage`. Nothing about
sessions is stored server-side, which is why no database is needed for auth
either.

## What you need before deploying

1. **An AWS account** with credentials configured locally (`aws configure`)
   and permission to create S3, CloudFront, Lambda, API Gateway, and IAM
   resources.
2. **AWS CDK bootstrapped** in your target account/region (one-time):
   ```
   cd infra && npm install && npx cdk bootstrap
   ```
   The `npm install` matters: without it, `npx` tries to fetch `cdk` and
   `ts-node` on the fly and the bootstrap dies with a cryptic
   `npm ERR! cb.apply is not a function`. Installing the local deps first
   avoids that entirely. Bootstrap itself needs **no** `-c` context values
   (the deploy secrets are only required by `cdk deploy`), so this command
   works as-is.
3. **A Mapbox account** (free tier is enough) — grab a token from
   https://account.mapbox.com/access-tokens/. This same token is used for
   both server-side geocoding and the client-side map, so keep it scoped
   appropriately (Mapbox lets you restrict tokens by URL).
4. **A [Resend](https://resend.com) account** for sending the magic-link
   emails (the free tier — 3,000 emails/month — is plenty for a congregation):
   - **Create an API key** (Resend dashboard → API Keys). You pass it at deploy
     time as `-c resendApiKey=re_...`; it becomes the `RESEND_API_KEY` env var
     on the Lambda. Treat it like a password — don't commit it.
   - **Verify the domain you'll send from** (Resend dashboard → Domains). Resend
     gives you a few DNS records (DKIM + SPF, and an optional DMARC) to add at
     your registrar. Once verified you can send from any address at that domain,
     e.g. `noreply@yourdomain` — no mailbox needs to exist, the app is
     outbound-only. That verified address is your `-c fromEmail=...`.
   - **Don't send from an unverified domain** (e.g. a raw `@gmail.com`): it
     fails the recipient's DKIM/SPF/DMARC checks and lands in spam, and a
     magic-link email in spam means people can't sign in.
   - Resend has no "sandbox" approval gate — once the domain is verified you can
     email anyone, so no production-access request is needed (unlike AWS SES).
5. **Decide who the admins are** — a comma-separated list of emails that
   should see `/admin` (e.g. the pastor, the small-group coordinator).

## Deploying

```bash
# 1. Install dependencies for each package
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd infra && npm install && cd ..

# 2. Build the frontend (the CDK stack deploys frontend/dist as-is)
cd frontend && npm run build && cd ..

# 3. Deploy the stack, passing required secrets/config as CDK context
cd infra
npx cdk deploy \
  -c authSecret="$(openssl rand -hex 32)" \
  -c mapboxToken="pk.your_mapbox_token" \
  -c adminEmails="you@yourchurch.org,coordinator@yourchurch.org" \
  -c fromEmail="noreply@yourchurch.org" \
  -c resendApiKey="re_your_resend_api_key"
```

To serve the site from a custom domain (instead of the `*.cloudfront.net`
URL), also pass the domain and its ACM certificate ARN. The certificate
**must be in `us-east-1`** (CloudFront's requirement) and validated. This
attaches the domain to the CloudFront distribution and makes it the canonical
app URL + CORS origin:

```bash
  -c siteDomain="dinnersforeight.food" \
  -c certArn="arn:aws:acm:us-east-1:<account-id>:certificate/<cert-id>"
```

`siteDomain` accepts a **comma-separated list** to serve several names (e.g.
apex + www) from the one distribution. The certificate must cover **every**
name listed (as SANs or a wildcard):

```bash
  -c siteDomain="dinnersforeight.food,www.dinnersforeight.food"
```

Point each name's DNS at the distribution — an A/AAAA **alias** in Route 53 for
the apex, and either an alias or a CNAME for `www`. Omit both flags to keep
using the CloudFront domain.

`cdk deploy` prints a `SiteUrl` output when it finishes — that's the app.
Because the frontend's `config.js` (which points it at the API and Mapbox)
is generated and injected by the CDK deploy itself, the same command handles
both "build the site" and "wire it up to this environment" — there's
nothing to hand-edit after deploying.

To redeploy after code changes, rebuild the frontend (`npm run build` in
`frontend/`) and re-run `cdk deploy` with the same context values.

### Updating the member directory

The address pre-fill list lives in `backend/src/data/members.json` and is
**bundled into the Lambda** (kept out of S3 and out of the browser, so member
addresses never ship to clients). Shape:

```json
{ "members": [ { "name": "Anderson", "address": "14203 Saint Clair Dr, Gainesville, VA 20155" } ] }
```

Names may be a last name only ("Anderson") or a full name ("Beth Rogers") when
you need to disambiguate two people who share a surname. Matching is fuzzy and
tolerant of case, accents, "Last, First" ordering, and typos. To change the
list, edit the file and redeploy (`cdk deploy`) — there's no runtime editing.

### Local development

```bash
cd backend && npm install
cd ../frontend && npm install
# edit frontend/public/config.js to point at a deployed API URL + your
# Mapbox token, then:
npm run dev
```

There's no local backend emulator included — the simplest loop is to deploy
the backend once and point local frontend dev at it while iterating on UI.

## Troubleshooting

Errors we've actually hit, and what they mean:

- **`npm ERR! cb.apply is not a function` during `cdk bootstrap`/`deploy`** —
  dependencies aren't installed, so `npx` tried to auto-install `cdk`/`ts-node`
  and choked. Run `npm install` in `infra/` (and `backend/`, `frontend/`)
  first. See the deploy steps above.
- **`Could not resolve "jose"` (or another package) while bundling Lambdas** —
  `backend/` dependencies aren't installed. `cd backend && npm install`.
- **`Cannot find asset at .../frontend/dist`** — the frontend hasn't been
  built. `cd frontend && npm run build` before `cdk deploy`. (`cdk bootstrap`
  does *not* need the build; only deploy does.)
- **`Missing required context values. Pass -c authSecret=...`** — a real
  `cdk deploy`/`synth` needs all of `authSecret`, `mapboxToken`, `fromEmail`,
  and `resendApiKey`. `cdk bootstrap` and `cdk ls` deliberately do *not* — they
  run with no `-c` args.
- **Sign-in returns a 500 / no email arrives** — check the `RequestMagicLinkFn`
  Lambda logs in CloudWatch; email failures are logged there. A
  `Resend API error (403/422): ...` means the API key is wrong/revoked or the
  `fromEmail` domain isn't verified in Resend. If the email sends but never
  shows up, the domain's DKIM/SPF records probably aren't verified yet (check
  the Resend dashboard) so it's being filtered as spam.

## Scaling notes

This is intentionally built for a small congregation's weekly signup, not
for high concurrency:

- Registrations are stored as one JSON file, read-modified-written on each
  submission. `backend/src/lib/store.ts` does a small retry loop but this
  is not a real transaction — collisions are unlikely at "a few dozen
  households signing up over a few days" scale but possible under heavy
  concurrent writes. If this ever needs to handle a much larger group,
  swap `store.ts` for DynamoDB (single-digit-millisecond reads/writes,
  still serverless, no server to manage) without touching any handler logic
  beyond that one file.
- The matching algorithm (`backend/src/lib/matching.ts`) runs in a single
  Lambda invocation over all registrations. Fine for hundreds of
  households; would need chunking well beyond that.

## Repo layout

```
backend/    Lambda handlers + shared logic (auth, storage, matching, email, geocoding)
frontend/   React + TypeScript SPA
infra/      AWS CDK app that deploys both
```
