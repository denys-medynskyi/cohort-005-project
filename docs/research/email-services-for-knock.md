# Email services that work with Knock

Research for GitHub issue #12, "Compare email services that work with Knock". Checked 2026-11-10. Every URL below was accessed on that date.

**Question.** Which email services can Knock send Cadence's Notification emails through, and how do they compare on price at low volume, deliverability setup, test/sandbox mode, EU data residency, and how Knock connects to them?

**Scope.** ADR 0013 chose Knock, which brings its own email provider (BYO ESP), so Cadence needs one. Email goes out only for Notification Kinds that change the recipient's own money or Enrollment (Purchase confirmed, Enrollment gained, Refund approved/declined/issued/failed and so on). That is transactional, one-to-one, sent immediately, and low volume. No budget or residency limit is set. This note records price and EU residency but does not apply them. Knock itself has no EU data residency ("We expect to support EU data residency by the end of 2026", [Knock plans](https://docs.knock.app/manage-your-account/knock-plans)), so Notification content passes through Knock's US-hosted service whichever ESP is chosen.

**Sources.** Primary sources only: Knock's docs, and each ESP's own pricing, docs and privacy pages. Anything marked _unverified_ is something I could not confirm from a primary source.

## Which providers Knock supports

Knock's email overview lists 13 providers ([email overview](https://docs.knock.app/integrations/email/overview)):

| Provider | Delivery tracking | Bounce support | Provider link/open tracking |
| --- | :-: | :-: | :-: |
| Knock (testing only) | Yes | Yes | Yes |
| Amazon SES | Yes | Yes | No |
| Cloudflare Email | No | No | No |
| MailerSend | Yes | Yes | No |
| Mailgun | Yes | Yes | Yes |
| Mailjet | Yes | No | Yes |
| Mailtrap | Yes | No | No |
| Mandrill | Yes | No | Yes |
| Postmark | Yes | Yes | Yes |
| Resend | Yes | Yes | No |
| SendGrid | Yes | Yes | Yes |
| SMTP | No | No | No |
| SparkPost | Yes | No | Yes |

"Bounce support" means Knock marks a message `bounced` from the provider's events. Knock's own link and open tracking works on every provider, so the last column matters only if Cadence wants the ESP to do the tracking. For receipts and Refund outcomes, open and click tracking is optional anyway.

Brevo, Loops (except through a webhook channel) and other ESPs are not native Knock providers. They could only be reached through SMTP, which loses delivery tracking ([SMTP](https://docs.knock.app/integrations/email/smtp)).

## How Knock's own test features work with an ESP

This shapes the "tests and local runs must not send anything real" requirement more than any ESP sandbox does.

- **Channels are configured per Knock environment.** Each email channel takes its credentials and settings separately for Development, Production and any custom environment ([Resend](https://docs.knock.app/integrations/email/resend), [Postmark](https://docs.knock.app/integrations/email/postmark)). So Development can point at a different ESP account, or at none.
- **Knock sandbox mode blocks delivery in Knock.** "Sandbox mode enables you to generate and preview messages for a given channel without delivering them." "When sandbox is enabled, Knock will never send the request to your downstream provider, blocking all delivery." It is set per channel per environment, and it can be saved **without provider credentials** ("You'll need to add them before you turn sandbox mode off") ([integrations overview](https://docs.knock.app/integrations/overview)). Every one of the 13 provider pages lists sandbox mode as a feature.
- **The built-in "Knock" test provider** is for testing only. It is "limited to sending emails to email addresses associated with the members of your Knock account only", and "You can send up to 100 emails per month for free". Over that limit, emails are marked `undelivered` ([Knock test provider](https://docs.knock.app/integrations/email/knock-test)).
- **Plan gating.** Knock's plans page says "Most features are available across all three plans" and doesn't list email channels or sandbox mode as Enterprise-only ([Knock plans](https://docs.knock.app/manage-your-account/knock-plans)).

**What this means.** Cadence's tests and local runs can use a Knock Development environment whose email channel is in sandbox mode. No ESP account or credentials are needed, and no request ever reaches an ESP. Choosing an ESP therefore doesn't depend on its own sandbox. An ESP's test features only matter for a staging environment that really sends, for example to check rendering in a real inbox or to exercise bounce webhooks.

## Comparison table

Prices are list prices in USD on the vendor's site on 2026-11-10. "EU residency" means stored data (logs, recipient addresses, events), not only where mail is sent from.

| | Low-volume price | Deliverability setup | ESP test/sandbox | EU data residency | How Knock connects |
| --- | --- | --- | --- | --- | --- |
| **Resend** | Free: 3,000/mo, 100/day, 3 domains. Pro: $20/mo for 50k, then $0.90 per 1k | Verify a domain with DKIM and SPF records (TXT plus MX or CNAME); Return-Path on a `send.` subdomain by default; DMARC recommended | `delivered@`, `bounced@`, `complained@`, `suppressed@resend.dev` test addresses; they **count against quota** | **No.** Can send from Ireland (eu-west-1), but "All account data ... is stored in the United States" | API key + From address; webhook for delivered, bounced, suppressed, complained |
| **Postmark** | Free: 100/mo, test only, no overage. Basic: $15/mo for 10k, then $1.80 per 1k | Domain: DKIM TXT + Return-Path CNAME (`pm_bounces` → `pm.mtasv.net`) gives SPF alignment; DMARC `p=none` suggested | `POSTMARK_API_TEST` server token validates without delivering; sandbox-mode servers exist (_details unverified_) | **No.** Hosted near Chicago and on AWS; "We currently don't have plans to add servers in the EU" | Server API key + From address; sends on the transactional `outbound` stream by default; webhook for Delivery, Bounce, Spam complaint |
| **Amazon SES** | $0.10 per 1k; attachments $0.12/GB. New AWS accounts get up to $200 in Free Tier credits | Easy DKIM (CNAMEs, 2048-bit); custom MAIL FROM subdomain for SPF alignment (_record details from AWS docs I couldn't fully render_) | New accounts start in the SES sandbox per region: verified recipients or mailbox simulator only, 200/24h, 1/s; production access reviewed within ~96h | **Yes, by region choice.** Pick an EU region (e.g. eu-central-1) in the Knock channel (_EU region list unverified here_) | IAM access keys or an assumed IAM role with external ID; region + verified From; delivery events need an SNS topic → Knock webhook |
| **Mailgun** | Free: 100/day, 1 domain. Basic: from $15/mo for 10k, then from $1.80 per 1k. Foundation: $35/mo for 50k | Verified domain (SPF/DKIM records per Mailgun's domain setup; _exact records unverified_) | Sandbox domains deliver only to authorized recipients (_limits unverified_) | **Yes.** EU region with `api.eu.mailgun.net`; "message data never leaves the region in which it is processed" | API key + **region (US/EU)** + verified domain + From; webhook for Delivered, Permanent failure, Spam complaints |
| **SendGrid** | Free trial: 100/day for **60 days only**. Essentials: from $19.95/mo. Pro: from $89.95/mo | Domain authentication (_records unverified_) | `mail_settings.sandbox_mode` validates the request without delivering; "No Credits will be consumed" | **Pro/Premier only.** Needs a dedicated EU IP, an EU subuser and `api.eu.sendgrid.com` | API key with Mail Send; Event Webhook for Delivered, Bounce, Dropped, Spam Report. **Knock's page shows no region setting**, so EU residency through Knock is _unverified_ |
| **Mailjet** | Free: 6,000/mo, 200/day. Essential: $19/mo for 15k | _Unverified_ | _Not researched_ | **Yes.** "Your data is stored in secure data centers located exclusively within the European Union" | API key + secret key + From |
| **MailerSend** | Free: 500/mo, 1 domain. Hobby: $7/mo for 5k, then $1.50 per 1k. Starter: page conflicts (50k vs 100k at $68) | _Unverified_ | _Not researched_ | **Storage yes.** "Our data storage centers are in the European Union"; the company is US-based and transfers EEA data to the US under the Data Privacy Framework | API key + From |
| **Mailtrap** | Free: 4,000/mo, 150/day. Basic: $15/mo for 10k, then $1.00 per 1k | _Unverified_ | Separate Email Sandbox product (free: 50 test emails/mo) that catches mail in a fake inbox; doesn't count against sending quota | _Unverified_; pricing page silent | API key + choice of **Sending or Testing API** (+ Inbox ID for Testing) + From |
| **SparkPost (Bird)** | Free: 1,000/mo, 50/day. Email Startup: $15 deposit, $0.40 per 1k | _Unverified_ | _Not researched_ | EU region exists in Knock's settings; Bird's pricing page makes no EU statement (_unverified_) | API key + **region (US/EU)** + From. sparkpost.com/pricing now redirects to Bird |
| **Mandrill** | Needs a paid Mailchimp Standard or Premium plan, plus $20 per 25k block; 500 free sends for new users | _Unverified_ | _Not researched_ | _Unverified_ | API key + From |
| **Cloudflare Email** | Workers Paid plan: 3,000/mo included, then $0.35 per 1k; not on Workers Free | Domain DNS must be on Cloudflare | Sends to verified destination addresses are free | _Unverified_ | API token + account ID + From. **Beta**, and Knock gets **no delivery tracking** |
| **SMTP** | Depends on the relay | Depends on the relay | — | Depends on the relay | Host, TLS port, username/password; messages only ever show "Sent", never "Delivered" |
| **Knock test provider** | Free, 100/mo | — | Is the test path | Knock is US-only | Built in; only Knock account members can receive |

## The most plausible candidates

For low-volume transactional email with delivery and bounce status reported back to Knock, five providers have full tracking and bounce support: **Resend, Postmark, Amazon SES, Mailgun and SendGrid**. MailerSend also has both, but I verified less about it.

### Resend

- **Price.** Free covers 3,000 emails/mo with a 100/day cap and 3 domains. Pro is $20/mo for 50,000, with no daily cap, then $0.90 per 1,000. A dedicated IP is a $30/mo add-on on Scale only ([pricing](https://resend.com/pricing)).
- **Deliverability.** You must verify a domain. DKIM and SPF records "must match exactly what Resend generated". The Return-Path defaults to `send.<domain>`. DMARC is added after verification ([add a domain](https://resend.com/docs/add-a-domain)). Resend recommends sending from a subdomain to isolate reputation ([domains](https://resend.com/docs/dashboard/domains/introduction)). Knock gives an "Identity not found" error if the domain isn't verified ([Knock Resend](https://docs.knock.app/integrations/email/resend)).
- **Test mode.** Test addresses at `resend.dev` simulate delivery, bounce, complaint and suppression, but "Test emails count against your account's sending quota" ([send test emails](https://resend.com/docs/dashboard/emails/send-test-emails)).
- **EU.** It can send from Ireland, but "All account data, including email metadata, logs, and API records, is stored in the United States regardless of the sending region you select". To change region you delete and re-add the domain ([regions](https://resend.com/docs/dashboard/domains/regions)).
- **Knock.** Needs an API key and From address. A webhook maps `email.delivered` to delivered and `email.bounced` to bounced. A complaint records `message.complaint` ([Knock Resend](https://docs.knock.app/integrations/email/resend)).

### Postmark

- **Price.** The free developer tier is 100 emails/mo for testing, with no overage. Basic is $15/mo for 10,000, then $1.80 per 1,000 ([pricing](https://postmarkapp.com/pricing)).
- **Deliverability.** Domain verification takes a DKIM TXT record and a Return-Path CNAME (`pm_bounces` → `pm.mtasv.net`). After that, mail passes SPF alignment. DMARC `p=none` is suggested to start ([verify a domain](https://postmarkapp.com/support/article/1046-how-do-i-verify-a-domain)).
- **Test mode.** Sending with the server token `POSTMARK_API_TEST` validates the request without delivering it ([API overview](https://postmarkapp.com/developer/api/overview)). Postmark also has per-server sandbox mode, which I didn't read in detail (_unverified_).
- **EU.** No. Data is hosted at Deft near Chicago and on AWS, and "We currently don't have plans to add servers in the EU". Transfers rely on Standard Contractual Clauses ([EU privacy](https://postmarkapp.com/euprivacy)).
- **Knock.** Needs a server API key and From address. With no override, Knock sends on the transactional `outbound` stream. A webhook on the stream covers Delivery, Bounce and Spam complaint ([Knock Postmark](https://docs.knock.app/integrations/email/postmark)).

### Amazon SES

- **Price.** $0.10 per 1,000 emails, plus $0.12/GB of attachments. A dedicated IP is $24.95/mo. New AWS customers get up to $200 in Free Tier credits ([pricing](https://aws.amazon.com/ses/pricing/)). That makes it the cheapest per email by far, but the lack of a free allowance outside credits matters little at Cadence's volume.
- **Deliverability.** Easy DKIM adds a 2048-bit key, verified through DNS records (Route 53 can create them automatically) ([Easy DKIM](https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dkim-easy.html)). For SPF alignment you set a custom MAIL FROM subdomain with MX and SPF records. I couldn't render AWS's authentication overview page, so the exact record shapes are _unverified_ here.
- **Test mode.** All new accounts start in the SES sandbox, separately in each AWS Region. You can send only to verified addresses or the mailbox simulator, at most 200 per 24 hours and 1 per second. Production access is requested in the console, and AWS answers within about 96 hours ([production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)).
- **EU.** SES runs per AWS Region, and Knock asks for the region, so sending and SES-side data can stay in an EU region. I didn't fetch AWS's region list for SES (_unverified here_).
- **Knock.** Takes IAM user access keys (`ses:SendEmail`, `ses:SendRawEmail`) or an assumed IAM role that trusts Knock's AWS account with an external ID. The role path needs STS enabled in `us-east-2`. By default Knock only records "Sent". For delivery and bounce status you create an SNS topic, subscribe Knock's webhook URL, and point the identity's notifications at it ([Knock SES](https://docs.knock.app/integrations/email/aws-ses)). This is the most setup of the five.

### Mailgun

- **Price.** Free is 100/day with 1 custom domain. Basic starts at $15/mo for 10,000, then from $1.80 per 1,000. Foundation is $35/mo for 50,000 ([pricing](https://www.mailgun.com/pricing/)).
- **Deliverability.** Needs a verified domain. Knock's domain field accepts Liquid for per-tenant domains ([Knock Mailgun](https://docs.knock.app/integrations/email/mailgun)). I didn't read Mailgun's DNS record guide (_unverified_).
- **Test mode.** Sandbox domains deliver only to authorized recipients, which you add with `POST /v5/sandbox/auth_recipients`. Third-party sources disagree on the limits, so they are _unverified_.
- **EU.** Yes. EU-region domains use `https://api.eu.mailgun.net/`, and "message data never leaves the region in which it is processed" ([API overview](https://documentation.mailgun.com/docs/mailgun/api-reference/api-overview)).
- **Knock.** Needs a private API key, region (US or EU, which must match the account or webhooks can fail), a verified domain and a From address. A webhook covers Delivered, Permanent failure and Spam complaints ([Knock Mailgun](https://docs.knock.app/integrations/email/mailgun)).

### SendGrid

- **Price.** The free option is now a trial: 100/day for 60 days. Essentials starts at $19.95/mo, Pro at $89.95/mo ([pricing](https://www.twilio.com/en-us/products/email-api/pricing)).
- **Test mode.** `mail_settings.sandbox_mode.enable: true` on a request validates it without delivering, and "No Credits will be consumed" ([sandbox mode](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/sandbox-mode)). Knock doesn't document a way to set it, though a payload override might (_unverified_).
- **EU.** Only on Pro or Premier. It needs a dedicated EU IP, a subuser "designated for the EU", and the endpoint `https://api.eu.sendgrid.com/`. Sending through a parent or global subuser routes data outside the EU ([data residency FAQ](https://www.twilio.com/docs/sendgrid/data-residency/faq)).
- **Knock.** Needs an API key with Mail Send access and a From address. The Event Webhook covers Delivered, Bounce, Dropped and Spam Report. Polling instead needs a paid Email Activity add-on ([Knock SendGrid](https://docs.knock.app/integrations/email/sendgrid)). Knock's SendGrid page has **no region or endpoint setting**, so I could not confirm that Knock can send through `api.eu.sendgrid.com`.

## The other providers, briefly

- **MailerSend.** Free covers 500/mo. Hobby is $7/mo for 5,000, then $1.50 per 1,000. The Starter tier is shown inconsistently on the page ([pricing](https://www.mailersend.com/pricing)). Its privacy policy says "Our data storage centers are in the European Union", but MailerSend, Inc. is a US company and transfers EEA data to the US under the Data Privacy Framework ([privacy policy](https://www.mailersend.com/legal/privacy-policy)). Knock supports delivery and bounce tracking, but its page doesn't describe webhook setup ([Knock MailerSend](https://docs.knock.app/integrations/email/mailersend)).
- **Mailjet.** Free covers 6,000/mo at 200/day. Essential is $19/mo for 15,000 ([pricing](https://www.mailjet.com/pricing/)). "Your data is stored in secure data centers located exclusively within the European Union" ([data security](https://www.mailjet.com/products/data-security-and-privacy/)). Knock has no bounce support for it ([email overview](https://docs.knock.app/integrations/email/overview)).
- **Mailtrap.** Free sending covers 4,000/mo at 150/day. Basic is $15/mo for 10,000. Its Email Sandbox is a separate product that catches mail in a test inbox (free: 50 test emails/mo) ([pricing](https://mailtrap.io/pricing/)). In Knock you pick the Sending or the Testing API per environment ([Knock Mailtrap](https://docs.knock.app/integrations/email/mailtrap)). No bounce support in Knock.
- **SparkPost.** It is now sold under Bird; `sparkpost.com/pricing` redirects there. Free covers 1,000/mo at 50/day. Paid starts with a $15 deposit at $0.40 per 1,000 ([Bird pricing](https://bird.com/pricing/email?sp=true)). Knock offers a US/EU region setting ([Knock SparkPost](https://docs.knock.app/integrations/email/sparkpost)). No bounce support in Knock.
- **Mandrill.** It is an add-on to a paid Mailchimp Standard or Premium plan, at $20 per 25,000-email block ([pricing](https://mailchimp.com/pricing/transactional-email/)). That is a poor fit when Cadence doesn't use Mailchimp.
- **Cloudflare Email.** Email Sending is in **beta** and needs the Workers Paid plan: 3,000 included per month, then $0.35 per 1,000 ([overview](https://developers.cloudflare.com/email-service/), [pricing](https://developers.cloudflare.com/email-service/platform/pricing/)). "Cloudflare Email Service does not currently support delivery status tracking", so Knock can't show delivered or bounced ([Knock Cloudflare](https://docs.knock.app/integrations/email/cloudflare-email)).
- **SMTP.** Any authenticated TLS relay works, but messages show only "Sent" ([Knock SMTP](https://docs.knock.app/integrations/email/smtp)).

## What I couldn't verify

- Exact DNS records for Mailgun, SendGrid, Mailjet, MailerSend, SparkPost and Mandrill. Every serious ESP needs DKIM on the sending domain plus an aligned Return-Path/SPF, but I didn't read each one's guide.
- Mailgun sandbox domain limits. Third-party figures conflict.
- Whether Knock's SendGrid channel can use SendGrid's EU endpoint.
- EU data residency for Mailtrap, Mandrill, Cloudflare Email and SparkPost/Bird.
- Postmark's per-server sandbox mode.
- MailerSend's Starter tier price and volume. Its own page contradicts itself.
- AWS's SES region list and its authentication overview page, which didn't render.
