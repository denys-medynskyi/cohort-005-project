# Hosted notification providers for Cadence

Research for GitHub issue #7, "Compare hosted notification providers". Checked 2026-11-10.

**Question.** Which hosted services can deliver Notifications to a Notification Feed (in-app), by email and by web push for Cadence, and how do they compare?

**Scope.** Cadence runs `react@^19.2.7`, `react-dom@^19.2.7`, and `react-router` / `@react-router/node` / `@react-router/dev` at `8.3.0` in framework mode with SSR (see `package.json`). There is no mobile app. Delivery must use a hosted third-party service. In-house builds and self-hosted OSS are out of scope. No budget or data-residency limits are set yet. This note records those facts but does not apply them.

**Candidates.** The ticket names Knock, Novu Cloud, Courier, MagicBell and SuprSend. I did not add any others, because no primary source I read made a stronger case for another vendor.

**Glossary note.** `GLOSSARY.md` doesn't define "Notification", "Notification Kind" or "Notification Feed" yet. Its people terms are **Learner** and **Admin**, and it lists "Student" under _Avoid_. The ticket's audience of Students, Instructors, Platform Admins and Team Admins doesn't match the glossary yet. Resolve that in the spec work.

**Sources.** I used primary sources only: vendor docs, vendor pricing pages, and npm package source. Any claim marked _unverified_ is one I couldn't confirm from a primary source.

## How the SSR check was done

I installed each vendor's React feed package next to `react@19.2.7` / `react-dom@19.2.7` in a scratch project. Then I ran `import` + `renderToString(<Provider><FeedOrBell/></Provider>)` in Node 26. This is the same thing React Router's SSR does on the server. I did **not** test client hydration in a browser, and I did not test inside a real React Router 8 app. Versions tested: `@knocklabs/react@0.15.1`, `@novu/react@3.19.2`, `@trycourier/courier-react@9.3.5`, `@magicbell/react@1.14.0`, `@suprsend/react@1.5.0`.

| Package | Server render result | How it handles SSR (from package source) |
| --- | --- | --- |
| `@knocklabs/react` | OK. It renders the bell `<button>` markup. | The bundle starts with `"use client"` and guards `window`. It also ships `./next` and `./tanstack` entry points (for Guides location sensing) but no React Router entry. Its peer deps are `react ^17‖^18‖^19`; `next` and `@tanstack/react-router` are optional. |
| `@novu/react` | OK. It renders only a hidden placeholder `<div data-shadow-root-detector>`. | `package.json` `exports` sends the non-`browser` condition to `dist/esm/server/index.js`. That file stubs `Inbox`, `Bell` and the other components, so the real UI mounts only on the client. Its realtime client (`@novu/js`) uses `socket.io-client` and `partysocket`. |
| `@trycourier/courier-react` | OK. It renders an empty string. | `courier-react-components` returns `null` when `typeof window === "undefined"` and waits for `useEffect` to mount. The UI is built from web components in `@trycourier/courier-ui-inbox`. |
| `@magicbell/react` | OK. It renders full bell and inbox markup. | 38 files carry `"use client"`. The WebSocket (`reconnecting-websocket` to `wss://ws.magicbell.com`) is created with `startClosed: typeof window === "undefined"`. |
| `@suprsend/react` | **Failed on first install**: `Cannot read properties of undefined (reading 'ReactCurrentDispatcher')`. | Its dependency `react-popper@2.3.0` makes npm nest `react-dom@18.3.1` inside the package. That breaks under React 19 on the server and in the browser alike. **It passed after adding an npm `overrides` entry** (`"react-popper": { "react-dom": "$react-dom" }`) and then rendered feed markup with Emotion styles. |

## Comparison table

"BYO ESP" means bring your own email service provider: you connect your own SendGrid, SES, Postmark, Resend or similar account.

| | Knock | Novu Cloud | Courier | MagicBell | SuprSend |
| --- | --- | --- | --- | --- | --- |
| **Prebuilt React feed / bell** | Yes: `NotificationIconButton`, `NotificationFeedPopover`, `NotificationFeed` | Yes: `<Inbox>`, `Bell`, `Notifications`, `Preferences` | Yes: `CourierInbox` (web-component based), plus toast | Yes: `FloatingInbox`, `Inbox`, `WebPushButton` | Yes: `Inbox` and related components |
| **SSR with React 19 (server render test)** | Renders markup on server | Placeholder on server, client-only UI | `null` on server, client-only UI | Renders markup on server | Works only with an npm override for `react-popper` |
| **Realtime transport** | WebSocket via Phoenix channels (`phoenix` dependency of `@knocklabs/client`) | WebSocket via socket.io (`socket.io-client` in `@novu/js`; EU host `wss://eu.socket.novu.co`) | WebSocket (`new WebSocket` to `wss://realtime.courier.io` / `wss://realtime.eu.courier.io` in `courier-js`) | WebSocket (`wss://ws.magicbell.com`) | socket.io (`socket.io-client` in `@suprsend/web-sdk`) |
| **Email** | BYO ESP. A "Knock" provider is for testing only. | BYO ESP. The demo provider allows 300/month to your own address only. | BYO ESP. The Test env has a built-in provider that sends to the signup address only. | BYO ESP (SMTP, SendGrid, Mailgun, SES, Ping) | BYO ESP. Sandbox workspace has vendors preconnected for 30 days. |
| **Web push** | No first-party web push. Goes through FCM (or OneSignal). | Through FCM, OneSignal, Pushpad or Pusher Beams. No native VAPID. | Through FCM or OneSignal. "Courier Push" is in-app, not browser push. | **Native VAPID web push channel** | **Native VAPID web push** through its web SDK and service worker |
| **Per-kind workflows / templates** | Yes, workflows | Yes, workflows | Yes (Journeys, plus legacy Automations) | Workflows (`broadcast`, `wait`, `pause`, `abort`) | Yes, workflows |
| **Digest / batching** | Batch function, per recipient | Digest step (regular or scheduled, per subscriber) | Batch node in Journeys; digests on subscription topics | Not documented (_unverified_) | Digest node, including per-recipient schedules |
| **Fan-out** | Up to 1,000 recipients per trigger; object subscriptions are unlimited | Topics (up to 100k subscribers each) and bulk trigger | Lists, audiences and `/bulk` | `POST /v2/broadcasts` with many recipients | Up to 100 recipients per trigger; lists and broadcasts for larger groups |
| **Feed auth** | Public key plus RS256 JWT signed by your backend ("enhanced security mode") | Public app ID plus `HMAC-SHA256(secret, subscriberId)` hash | JWT minted by calling Courier's `/auth/issue-token` from your backend, with scopes | HS256 JWT signed with the project secret | Public key plus ES256 JWT ("enhanced security mode"), with a refresh callback |
| **Test / CI isolation** | Development, production and custom environments, each with its own keys; email sandbox mode | Development and Production environments (custom ones on Team plan and up); demo providers | Test and Production environments; Mock key (Enterprise only) skips providers | Projects (1 on free, 5 on Startup); no documented sandbox (_unverified_) | Sandbox, Staging and Production workspaces; **Test Mode** sends only to designated testers, with a catch-all channel |
| **Free tier** | 10,000 messages/mo | 10,000 workflow runs/mo | 10,000 sends/mo | 1,000 deliveries/mo | 10,000 notifications/mo (feed shows SuprSend branding) |
| **First paid tier** | Starter $250/mo, 50k messages, then $0.005 each | Pro from $30/mo, 30k runs | Business $0.005/send, pay as you go | Startup $249/mo, 50k deliveries, then $0.0025 each | Essentials $100/mo, 50k, then $0.002 each |
| **EU data residency** | **Not available**; "expected by end of 2026" | **Yes, all plans** (Frankfurt) | Yes (eu-west-1 Ireland), provisioned by request; plan gating unclear | Not documented (_unverified_) | "EU-data residency options" exist; plan gating unclear |
| **History export** | List Messages API inside the retention window (30 days, or 90 on Enterprise); feed items kept indefinitely; warehouse sync is Enterprise only | List messages and notifications APIs; retention 30 days free, 90 days paid; no bulk export documented | List messages API and CLI `jsonl` export; retention 30 to 90 days (sources conflict), 365 on Enterprise | v2 REST API (bulk export _unverified_) | Continuous S3 export (parquet, every 3 to 5 min); per-message logs kept 30 days free, 90 paid |

## Knock

- **Feed components.** `@knocklabs/react` provides `NotificationIconButton`, `NotificationFeedPopover` and `NotificationFeed`, plus hooks for headless builds. It is set up with `KnockProvider` and `KnockFeedProvider` ([React overview](https://docs.knock.app/in-app-ui/react/overview), [feed](https://docs.knock.app/in-app-ui/react/feed)).
- **SSR.** The docs say nothing about SSR, Next.js or `"use client"` ([feed](https://docs.knock.app/in-app-ui/react/feed)). The package source has `"use client"` and window guards, and it server-rendered under React 19 in the scratch test. Peer deps cover React 17 to 19 ([npm](https://www.npmjs.com/package/@knocklabs/react)).
- **Realtime.** The docs describe socket connections that close in inactive tabs (`auto_manage_socket_connection`) and cross-tab sync through BroadcastChannel ([feed](https://docs.knock.app/in-app-ui/react/feed)). The transport is Phoenix WebSocket channels, from the `phoenix` dependency of [`@knocklabs/client`](https://www.npmjs.com/package/@knocklabs/client).
- **Email.** BYO ESP. Supported providers are SES, Cloudflare Email, MailerSend, Mailgun, Mailjet, Mailtrap, Mandrill, Postmark, Resend, SendGrid, SMTP and SparkPost. A "Knock" provider exists for testing only, and there is a sandbox mode for email steps ([email overview](https://docs.knock.app/integrations/email/overview)).
- **Web push.** Knock's own tutorial says it "does not have a first-party web push channel". You use FCM with a Firebase service worker and store the browser token as channel data ([FCM web push tutorial](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm), [FCM integration](https://docs.knock.app/integrations/push/firebase)).
- **Model.** You build one workflow per Notification Kind. The batch function aggregates events per recipient, with an optional batch key. For fixed daily or weekly digests, Knock recommends pulling events from your own system at send time instead ([batch function](https://docs.knock.app/designing-workflows/batch-function)).
- **Fan-out.** A trigger accepts at most 1,000 recipients. Beyond that, object subscriptions fan out to an unlimited number of subscribers, with deduplication ([trigger via API](https://docs.knock.app/send-notifications/triggering-workflows/api), [subscriptions](https://docs.knock.app/concepts/subscriptions)).
- **Auth.** Without enhanced security mode, "a request with your public key can act as any user". With it on, your backend signs an RS256 JWT with `sub` set to the user ID. The default lifetime is 3,600 s, and `onUserTokenExpiring` handles refresh ([security and authentication](https://docs.knock.app/in-app-ui/security-and-authentication)).
- **Dev/test.** Production, development and custom environments each have their own API keys and fully isolated data. A new environment "will not send anything until you … reconfigure your provider credentials" ([environments](https://docs.knock.app/concepts/environments)).
- **Pricing.** Free covers 10,000 messages/mo. Starter is $250/mo with 50k messages, then $0.005 each. A "message" is one message to one user on one channel, and in-app feed messages appear to be billed as messages. Free has no hard cap ([pricing](https://knock.app/pricing)).
- **EU residency.** Not available. "We expect to support EU data residency by the end of 2026" ([plans](https://docs.knock.app/manage-your-account/knock-plans)).
- **Export and lock-in.**
  - Message logs are kept 30 days (90 on Enterprise) and can be read through the List Messages API inside that window.
  - In-app feed items are available indefinitely through the feed endpoint ([data retention](https://docs.knock.app/manage-your-account/data-retention), [Messages API](https://docs.knock.app/api-reference/messages)).
  - Data warehouse sync is Enterprise only ([features](https://docs.knock.app/getting-started/knocks-features)).

## Novu Cloud

- **Feed components.** `@novu/react` provides `<Inbox>` and its sub-parts (`Bell`, `Notifications`, `Preferences`) ([npm](https://www.npmjs.com/package/@novu/react)).
- **SSR.** Its `exports` map uses a separate non-browser build that renders a placeholder, so the Inbox is effectively client-only. This was verified in the package source and the scratch render. Peer deps are React 18 or 19.
- **Realtime.** WebSocket through `socket.io-client` and `partysocket` in [`@novu/js`](https://www.npmjs.com/package/@novu/js). The EU socket host is `wss://eu.socket.novu.co` ([prepare for production](https://docs.novu.co/platform/inbox/prepare-for-production)).
- **Email.** BYO ESP, with 19 providers including SendGrid, SES, Resend, Postmark, Brevo, Mailgun and SMTP ([email integrations](https://docs.novu.co/platform/integrations/email)). The demo email integration is capped at 300/month and sends only to your Novu login address ([demo providers](https://docs.novu.co/platform/integrations/demo-providers)).
- **Web push.** Through FCM (with `webPush` overrides), OneSignal, Pushpad or Pusher Beams. No native VAPID channel was found ([push integrations](https://docs.novu.co/platform/integrations/push), [Pushpad](https://docs.novu.co/platform/integrations/push/pushpad), [FCM](https://docs.novu.co/platform/integrations/push/fcm)).
- **Model.** Workflows contain steps. The digest step groups events per subscriber, plus one optional extra key. It runs as a regular window or on a schedule (hourly, daily, weekly, monthly) in the subscriber's time zone ([digest](https://docs.novu.co/platform/workflow/add-and-configure-steps/configure-action-steps/digest)).
- **Fan-out.** Topics fan out with deduplication across topics, up to 100,000 subscribers per topic. Each subscriber counts as one billed workflow run ([topics](https://docs.novu.co/platform/concepts/topics)). A bulk trigger endpoint also exists ([bulk trigger](https://docs.novu.co/api-reference/events/bulk-trigger-event)).
- **Auth.** The `applicationIdentifier` is public. With HMAC on, your server computes `subscriberHash = HMAC-SHA256(secretKey, subscriberId)`, and if the hash is missing "the Inbox will not load" ([prepare for production](https://docs.novu.co/platform/inbox/prepare-for-production)). The hash never expires, because it is a hash of the user ID.
- **Dev/test.**
  - Development and Production environments come as standard; custom environments need Team or Enterprise.
  - Each environment has its own keys, subscribers, integrations and activity feed ([environments](https://docs.novu.co/platform/concepts/environments)).
  - The docs don't say whether Development triggers deliver through real providers (_unverified_). The safe route is to connect test credentials in Development.
- **Pricing.** Free covers 10,000 workflow runs/mo, 20 workflows and 3 seats. Pro starts at $30/mo with 30k runs. Team starts at $250/mo with 250k runs. Overage reads as $1.20 per 1k runs, but that comes from a hard-to-parse table, so treat it as _unverified_ ([pricing](https://novu.co/pricing)).
- **EU residency.** US (Virginia) and EU (Frankfurt) are available **on all plans**. The region is picked when the account is created and can't be changed self-serve ([security](https://docs.novu.co/platform/additional-resources/security)).
- **Export and lock-in.**
  - Inbox messages are kept 30 days on Free and 90 days on Pro and Team; activity logs 24 h to 90 days ([security](https://docs.novu.co/platform/additional-resources/security)).
  - Messages and notifications can be listed through the API ([API reference](https://docs.novu.co/api-reference)). No bulk export feature is documented.
  - Novu is also OSS, which may ease a later exit, but self-hosting is out of scope here.

## Courier

- **Feed components.** `@trycourier/courier-react` provides `CourierInbox` and toast, and `signIn({ userId, jwt })` connects the user ([npm README](https://www.npmjs.com/package/@trycourier/courier-react)).
- **SSR.** Components return `null` on the server and mount after `useEffect`, so the feed is client-only. This was verified in source and in the scratch render. Peer deps are React 18 or later.
- **Realtime.** WebSocket to `wss://realtime.courier.io`, with an EU host `wss://realtime.eu.courier.io`, per the [`@trycourier/courier-js`](https://www.npmjs.com/package/@trycourier/courier-js) source. The docs only say `signOut` "disconnects the real-time socket" ([Inbox auth](https://www.courier.com/docs/platform/inbox/authentication)).
- **Email.** BYO ESP: SES, SendGrid, Postmark, Mailgun, Resend, SMTP, Mandrill, SparkPost, Mailjet, MailerSend and others ([email](https://www.courier.com/docs/external-integrations/email/intro-to-email)).
- **Web push.** Through FCM, which covers web, or OneSignal. "Courier Push" is an in-app WebSocket channel, not browser push ([push overview](https://www.courier.com/docs/external-integrations/push/intro-to-push)).
- **Model.**
  - Journeys has a batch node per recipient: 100 items by default, up to 1,000, with inactivity and max-wait windows.
  - Legacy automation digests run on subscription topics and need two automations ([digest](https://www.courier.com/docs/platform/automations/digest)).
  - Fan-out uses lists, audiences and `/bulk` ([API overview](https://www.courier.com/docs/reference/api-overview)).
- **Auth.** Your backend calls `POST /auth/issue-token` with scopes `user_id:<id> inbox:read:messages inbox:write:events` and an `expires_in`. If you leave out `expires_in`, the token never expires. The SDKs don't refresh tokens for you ([Inbox auth](https://www.courier.com/docs/platform/inbox/authentication)).
- **Dev/test.**
  - Test and Production environments each have their own keys, templates and logs.
  - The Test environment's built-in email provider sends only to the signup address.
  - A Mock key, Enterprise only, simulates sends without calling providers ([environments and API keys](https://courier.com/docs/platform/workspaces/environments-api-keys)).
- **Pricing.** The free Developer plan includes 10,000 sends/mo. Business is $0.005 per send, pay as you go, and lists EU data residency as a feature. The page doesn't say whether Inbox messages count as sends (_unverified_) ([pricing](https://www.courier.com/pricing)).
- **EU residency.** EU region in AWS eu-west-1 (Ireland) at `api.eu.courier.com`. It is provisioned on request and new workspaces can't be created there ([security: regions](https://www.courier.com/docs/workspaces/security#regions-and-data-residency)). The pricing page ties it to Business, while a Courier blog says Enterprise, so plan gating is _unverified_.
- **Export and lock-in.**
  - The List Messages API pages through history inside the retention window ([list messages](https://www.courier.com/docs/api-reference/messages/list-messages)).
  - Courier documents a CLI `jsonl` export ([CLI](https://www.courier.com/docs/tools/cli)).
  - Retention is 30 or 90 days on Developer and Business (Courier pages conflict) and 365 days on Enterprise ([logs](https://www.courier.com/docs/monitor/logs)).

## MagicBell

- **Feed components.** `@magicbell/react` provides `ContextProvider` (taking a `token`), `FloatingInbox`, `Inbox`, `WebPushButton` and `UserPreferences` ([React library](https://www.magicbell.com/docs/libraries/magicbell-react)).
- **SSR.** The docs give no SSR guidance. The package marks files `"use client"` and keeps its socket closed when there is no `window`. It server-rendered full markup in the scratch test.
- **Realtime.** The docs don't say. The package source opens `reconnecting-websocket` to `wss://ws.magicbell.com` ([npm](https://www.npmjs.com/package/@magicbell/react)).
- **Email.** BYO ESP: SMTP, SendGrid, Mailgun, SES or Ping Email ([email channel](https://www.magicbell.com/docs/channels/email)).
- **Web push.** A native web push channel configured with your VAPID key pair. Browser `PushSubscription` endpoint and keys are stored through `PUT /v2/channels/web_push/tokens` ([web push channel](https://www.magicbell.com/docs/channels/web_push)). The React package includes `WebPushButton`. Safari support isn't stated (_unverified_).
- **Model.** Workflows run ordered `broadcast`, `wait`, `pause` and `abort` commands with `if` conditions ([workflows](https://www.magicbell.com/workflows)). Digesting or batching is **not documented** (_unverified_). Fan-out is `POST /v2/broadcasts` with many recipients ([API v2](https://www.magicbell.com/docs/api)).
- **Auth.** An HS256 JWT signed with the project secret, carrying `user_email` and/or `user_external_id` plus `api_key`. The docs' examples use a 1-year expiry ([user JWT](https://www.magicbell.com/docs/api/authentication/user)).
- **Dev/test.** Isolation is per project: 1 project on Builder, 5 on Startup ([pricing](https://www.magicbell.com/pricing)). No sandbox or test mode was found (_unverified_).
- **Pricing.** Builder is free with 1,000 deliveries/mo. Startup is $249/mo with 50k deliveries, then $0.0025 each ([pricing](https://www.magicbell.com/pricing)).
- **EU residency.** Not documented. The trust centre claims GDPR compliance but names no EU region ([security](https://www.magicbell.com/security)) (_unverified_).
- **Export and lock-in.** REST API v2 only. A bulk export or retention policy is _unverified_.

## SuprSend

- **Feed components.** `@suprsend/react` (built on `@suprsend/react-core` and `@suprsend/web-sdk`) provides `SuprSendProvider` and `Inbox` components ([npm](https://www.npmjs.com/package/@suprsend/react)). The older `@suprsend/react-inbox` still exists.
- **SSR.** Peer deps say `react >=16.8`. But the `react-popper@2.3.0` dependency pulls a nested `react-dom@18`, which breaks under React 19 until you add an npm `overrides` entry. After that it server-rendered. This was verified in the scratch install.
- **Realtime.** `socket.io-client` in [`@suprsend/web-sdk`](https://www.npmjs.com/package/@suprsend/web-sdk).
- **Email.** BYO ESP ("vendors"): SendGrid, SES, Mailgun, Resend, Postmark and Mailjet, with fallback routing between them. The Sandbox workspace has SuprSend vendors preconnected ([email quick start](https://docs.suprsend.com/docs/email-quick-start)).
- **Web push.** Native VAPID. SuprSend generates the key pair, the web SDK registers a service worker served from the site root, and the private key stays in SuprSend ([JS web push](https://docs.suprsend.com/docs/js-webpush), [React web push](https://docs.suprsend.com/docs/react-webpush), [quick start](https://docs.suprsend.com/docs/web-push-quick-start)).
- **Model.**
  - Workflows support a digest node, including per-recipient category schedules in the recipient's time zone ([design workflow](https://docs.suprsend.com/docs/design-workflow)).
  - A trigger accepts up to 100 recipients, and lists and broadcasts are recommended above about 1,000 ([trigger workflow](https://docs.suprsend.com/docs/trigger-workflow), [lists](https://docs.suprsend.com/docs/lists)).
  - Tenants, an Enterprise or Business add-on for vendors, could map to Teams ([tenant vendor](https://docs.suprsend.com/docs/tenant-vendor)).
- **Auth.** A public key plus, in enhanced security mode, an ES256 JWT with `entity_type: "subscriber"`, `entity_id`, `exp`, `iat` and optional `scope.tenant_id`. The SDK's `refreshUserToken` callback handles expiry ([client authentication](https://docs.suprsend.com/docs/client-authentication)).
- **Dev/test.**
  - Sandbox (30-day trial), Staging and Production workspaces share no data.
  - **Test Mode** in Staging delivers only to designated internal testers and can redirect everything else to a catch-all channel ([what is SuprSend](https://docs.suprsend.com/docs/what-is-suprsend), [workflows](https://docs.suprsend.com/docs/workflows)).
- **Pricing.**
  - Free is 10k notifications/mo, with a SuprSend-branded feed and 30-day logs.
  - Essentials is $100/mo for 50k, then $0.002 each.
  - Business is $250/mo for 50k, then $0.005 each.
  - Processing isn't stopped when you go over the Free limit ([pricing](https://www.suprsend.com/pricing)).
- **EU residency.** "We support EU-data residency options", but plans aren't named ([security](https://docs.suprsend.com/docs/security)). Enterprise lists a "custom data center region" ([pricing](https://www.suprsend.com/pricing)). Whether lower tiers get the EU region is _unverified_.
- **Export and lock-in.** A continuous Amazon S3 export writes notification status as daily parquet files and templates as JSON, syncing every 3 to 5 minutes ([S3 export](https://docs.suprsend.com/docs/amazon_s3)). Plan gating is _unverified_.

## Implications for the decision

These are the facts that most separate the options. No winner is picked here; that belongs to the grilling ticket.

1. **Web push.** Only **MagicBell** and **SuprSend** have a native VAPID web push channel. Knock, Novu and Courier route web push through FCM or OneSignal, which adds a second third-party account and the Firebase SDK and service worker.
2. **Email is BYO everywhere.** No candidate is a production email sender. Every option still needs an ESP account (SES, Postmark, Resend and so on), so ESP choice is a separate decision.
3. **EU data residency.**
   - **Novu** offers an EU region (Frankfurt) on every plan, including Free.
   - **Courier** offers EU on request, and plan gating is unclear.
   - **SuprSend** claims EU options without naming plans.
   - **Knock** has none until "end of 2026".
   - **MagicBell** documents none.
   - The region is fixed when the account is created at Novu and Courier, so it must be decided before signing up.
4. **SSR.**
   - **Knock** and **MagicBell** render real feed markup on the server.
   - **Novu** and **Courier** render nothing or a placeholder and mount client-side, which is safe but means no bell or unread count in the SSR HTML.
   - **SuprSend** needs an npm override to run with React 19 at all.
   - None document React Router specifically, and client hydration in React Router 8 is untested.
5. **Feed auth.**
   - Knock (RS256), SuprSend (ES256) and MagicBell (HS256) use JWTs your server signs locally.
   - Courier needs a network call to its issue-token endpoint.
   - Novu uses a non-expiring HMAC of the user ID.
   - Token expiry and refresh support varies: Knock and SuprSend have callbacks, and Courier and MagicBell leave refresh to you.
6. **Testing safety in CI.** **SuprSend Test Mode** (testers-only delivery plus a catch-all) and **Courier's** restricted Test email provider are the most explicit guards. Knock and Novu rely on separate environments with test credentials. A no-provider mock exists only in Courier Enterprise.
7. **Digest.** Knock, Novu, Courier and SuprSend document digest or batch steps. MagicBell does not.
8. **Free tier and first paid step.** Four vendors give about 10k/mo free; MagicBell gives 1k.

   | Vendor | First paid tier |
   | --- | --- |
   | Novu | $30/mo |
   | SuprSend | $100/mo |
   | Courier | $0.005/send pay as you go |
   | MagicBell | $249/mo |
   | Knock | $250/mo |

   The usage units differ (messages, workflow runs, sends, deliveries, notifications), and Novu bills per subscriber per topic fan-out, so compare on Cadence's expected events × recipients × channels.
9. **Lock-in.**
   - History export is weakest where retention is short and only paged APIs exist: Novu, Courier, and Knock below Enterprise.
   - SuprSend's continuous S3 export and Knock's indefinite feed-item retention are the strongest exit paths.
   - Knock warehouse sync is Enterprise only.

## Unverified / gaps

- Client hydration and realtime behaviour inside an actual React Router 8 app, for all five vendors. Only `renderToString` was tested.
- Whether in-app feed items count toward billable units at Courier, and the exact Novu overage.
- Plan gating for EU residency at Courier and SuprSend. Any EU option at MagicBell.
- MagicBell: digest support, sandbox or test mode, retention and export, Safari web push.
- Whether Novu Development-environment triggers reach real providers.
- Plan gating for SuprSend S3 export.
