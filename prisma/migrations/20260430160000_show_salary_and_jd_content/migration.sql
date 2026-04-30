-- Add showSalary column (default false — HR prefers salary hidden by default).
-- Then update every seeded job with a detailed JD.

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "showSalary" BOOLEAN NOT NULL DEFAULT false;

-- Detailed JDs for all 39 roles (applied to both seed-real-wm-* and seed-real-wc-*).
UPDATE "Job" SET description = 'ABOUT THE ROLE
Set the company''s direction, drive growth and revenue, make the high-impact decisions, own the most important partnerships, and control budget and capital allocation. You will be the public face of the company and the person the Board, employees and investors look to for strategic clarity.

WHAT YOU''LL DO
- Define and communicate company vision, OKRs and the 12-24 month strategy
- Own the P&L, capital allocation and runway across business units
- Lead fundraising — pitch decks, investor updates, term-sheet negotiation
- Close strategic partnerships with telcos, banks, regulators and brands
- Hire, coach and hold accountable the executive team (COO, CTO, CPO, CFO, CGO, CRO)
- Set the cultural tone — operating cadence, hiring bar, decision-making norms
- Run the weekly leadership meeting and the monthly Board update
- Represent the company externally: press, conferences, regulators', requirements = 'REQUIRED QUALIFICATIONS
- 12+ years of senior leadership at consumer, fintech or platform companies
- Prior experience as a founder or general manager owning P&L at scale
- Demonstrated track record of fundraising at Series A or beyond
- Strong commercial intuition and pricing sense across multiple revenue streams
- Experience scaling teams from 30 to 300+ across multiple disciplines
- Excellent written and verbal communication — the kind investors quote back
- Comfort in regulated environments (CBK, KICA-equivalent, GDPR-equivalent)

NICE TO HAVE
- East African market exposure (Kenya, Uganda, Tanzania, Rwanda)
- Operator background in social, super-app, marketplace or payments
- MBA or equivalent strategic-finance fluency

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-ceo', 'seed-real-wc-ceo');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Own the day-to-day execution of the company. You set the operating cadence, enforce accountability, remove blockers, and run the reporting system that the CEO and Board rely on every week. If something must ship, you make sure it ships.

WHAT YOU''LL DO
- Run the weekly operating cadence: standups, leadership review, all-hands
- Own the company-wide OKR and KR tracking system
- Build and maintain the reporting cockpit (DAU, revenue, burn, hiring, NPS)
- Identify cross-functional blockers and unblock them with the right exec
- Lead the procurement, vendor and SaaS-stack rationalisation
- Run incident response: when something breaks, you orchestrate the fix
- Partner with HR on org design, headcount planning and performance cycles
- Drive operational projects: office, IT, expansion, M&A integration', requirements = 'REQUIRED QUALIFICATIONS
- 10+ years in operating, GM or chief-of-staff roles at high-growth companies
- Deep cross-functional command — engineering, product, finance, growth
- Strong KPI discipline and a track record of moving the needle on a metric
- Comfort with both BPO-style operational rigour and product-org pace
- Ability to write a 1-page memo that resolves a 50-message Slack thread

NICE TO HAVE
- Exposure to platforms with both consumer and B2B revenue streams
- Background in management consulting or chief-of-staff to a CEO
- PMP, Lean Six Sigma or similar process credentials

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-coo', 'seed-real-wc-coo');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Own the engineering organisation, the architecture and the production stack. You set the technical bar, approve all TDDs, and are accountable for system uptime, scalability and cost. You partner with the CPO on what to build and the COO on how to ship it.

WHAT YOU''LL DO
- Define the technical strategy, platform architecture and 12-month roadmap
- Own backend, frontend, mobile, DevOps, QA, security and ML engineering
- Approve every TDD before code is written and every release before it ships
- Enforce the SRS-to-TDD-to-build-to-release workflow without exception
- Hire, coach and grow engineering leads across each discipline
- Run the on-call and incident-response programme (post-mortems, paging)
- Own infrastructure cost — cloud bill, CDN, tooling, third-party APIs
- Partner with the CPO on what is technically feasible inside each quarter', requirements = 'REQUIRED QUALIFICATIONS
- 12+ years engineering, with 5+ in senior leadership at consumer scale
- Hands-on background in distributed systems, real-time chat or payments
- Has scaled an engineering org past 30 people across at least 4 disciplines
- Strong on cloud architecture (AWS / GCP), Kubernetes, observability
- Track record of >99.9% uptime SLA on a non-trivial system
- Excellent technical writing — you set the standard for TDDs and post-mortems

NICE TO HAVE
- Production experience with WebRTC, SFU/MCU, in-app payments or e-money
- Open-source contributions or conference talks
- Familiarity with on-prem K8s and ArgoCD-style GitOps

TECH / TOOLS
Node.js / TypeScript, Go, PostgreSQL, Redis, Kafka, Kubernetes, AWS / GCP, Prometheus + Grafana, Sentry

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-cto', 'seed-real-wc-cto');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Own product strategy, the feature roadmap, and the alignment between product, design and monetisation. You approve every SRS before engineering starts, you manage the PMs and UX team, and you are accountable for retention and engagement metrics.

WHAT YOU''LL DO
- Define product vision and the quarterly + annual roadmap
- Approve every SRS before it moves to TDD
- Manage the team of PMs across Core Platform, Monetisation and other surfaces
- Own retention (D1/D7/D30), engagement and feature-adoption metrics
- Run weekly product reviews and quarterly portfolio prioritisation
- Partner with CGO and CRO on which features unlock which revenue line
- Own the design system, design ops and the UX hiring bar
- Represent product in Board updates and investor conversations', requirements = 'REQUIRED QUALIFICATIONS
- 10+ years in senior product leadership at consumer or marketplace platforms
- Strong design taste and willingness to challenge unclear specs
- Track record of moving D7 or D30 retention by a measurable amount
- Has owned both engagement and monetisation surfaces simultaneously
- Excellent written communication — your SRSs are the standard

NICE TO HAVE
- Background as a designer or engineer before moving into product
- Experience with social, gaming, content or fintech product surfaces

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-cpo', 'seed-real-wc-cpo');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Own financial planning, the burn rate, and the company''s financial reporting. You track P&L per business unit, manage payments and compliance, and produce the weekly and monthly reports the CEO, COO and Board rely on.

WHAT YOU''LL DO
- Build and maintain the rolling 18-month financial model
- Track burn vs. plan weekly; surface variance early with mitigation options
- Produce the monthly management accounts and quarterly investor update
- Lead audit and tax compliance across all entities
- Own treasury — cash, FX, banking relationships, payment-gateway settlement
- Manage payroll, vendor payments and procurement controls
- Partner with the CRO on pricing, margin and unit economics
- Lead the finance side of every fundraising round', requirements = 'REQUIRED QUALIFICATIONS
- Qualified accountant — CPA, ACCA, CIMA or CFA
- 10+ years in finance leadership, ideally at a fintech or payments business
- Experience preparing financials for due diligence on at least one Series A+
- Strong on KE / EAC tax, payroll and CBK regulatory environment
- Excel / Google Sheets fluency at modelling-power-user level

NICE TO HAVE
- Experience with NetSuite, Xero or QuickBooks at scale
- Familiarity with virtual currencies, prepaid payments or e-money
- Big-Four background early in career

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-cfo', 'seed-real-wc-cfo');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Own user acquisition, engagement and the viral and referral mechanics that drive DAU and MAU growth. You lead Wasaa Stars and creator onboarding, set the CAC budget, and partner with the CRO on the path from acquisition to revenue.

WHAT YOU''LL DO
- Set quarterly DAU, MAU and CAC targets and own the budget against them
- Lead the creator-acquisition pipeline (Wasaa Stars and partner programmes)
- Build viral and referral mechanics into the product with the CPO
- Run weekly growth reviews — channels, cohorts, funnels, leakage
- Own performance marketing, organic, paid social and influencer budgets
- Build the data-driven growth team (performance marketing, lifecycle, SEO)
- Partner with the CTO on tracking infrastructure and event taxonomy', requirements = 'REQUIRED QUALIFICATIONS
- 8+ years senior growth leadership at consumer, social or marketplace
- Track record of building DAU growth from low six figures to seven
- Has owned a multi-million-dollar paid budget across Meta, Google, TikTok
- Deep grasp of viral coefficient, k-factor and referral-loop math
- Strong on attribution, MMP / SDK setup and cohort analysis

NICE TO HAVE
- Creator-economy or influencer-marketing exposure
- African market familiarity

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-cgo', 'seed-real-wc-cgo');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Own all monetisation streams, hit revenue targets across products, and oversee Ads, Coins, Marketplace and Subscriptions. You set pricing governance and report revenue performance to the CEO and Board weekly.

WHAT YOU''LL DO
- Set quarterly revenue targets per stream and own the path to hit them
- Manage the Ads, Coins, Marketplace and Subscriptions sub-leads
- Own pricing governance — every price change goes through your review
- Run weekly revenue reviews; surface revenue risks before they hit the P&L
- Partner with the CPO on the monetisation roadmap and feature trade-offs
- Own commercial-partner relationships that move revenue
- Build the revenue-operations function (forecast, deal desk, analytics)', requirements = 'REQUIRED QUALIFICATIONS
- 10+ years owning revenue at a consumer, marketplace or platform business
- Has run at least three distinct revenue streams in the same business
- Strong on pricing experimentation, price-elasticity analysis and packaging
- Comfortable with both subscription and transaction-based unit economics
- Excellent commercial communicator — Board-grade revenue narratives

NICE TO HAVE
- Background in advertising platforms, in-app currencies or marketplaces
- MBA or strong commercial-finance fluency

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-cro', 'seed-real-wc-cro');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Own enterprise risk: payments fraud, content moderation policy, data privacy, regulatory exposure and operational risk. You define the controls, run the audits, and brief the CEO and Board on the company''s risk posture.

WHAT YOU''LL DO
- Maintain the enterprise risk register and update it monthly
- Define controls and run quarterly internal audits on critical processes
- Lead regulatory engagement — CBK, ODPC, KICA-equivalents
- Own fraud strategy across payments, ads and the marketplace
- Partner with Security, Legal and Operations on incident handling
- Brief the Board quarterly on the top 5 risks and the mitigation plan
- Build the compliance training programme for all employees', requirements = 'REQUIRED QUALIFICATIONS
- 10+ years in risk leadership at fintech, banking or platform companies
- Deep knowledge of KE Data Protection Act, GDPR-equivalent obligations
- Familiarity with CBK National Payment Systems Act and prudential rules
- Ability to write a 1-page risk memo a non-specialist Board can act on

NICE TO HAVE
- FRM, CFA, CISA or equivalent risk credentials
- Background that combines internal audit + product / engineering literacy

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-crisk', 'seed-real-wc-crisk');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Lead all engineering execution. You enforce the SRS-to-TDD-to-build-to-release workflow without exception, set sprint targets, ensure code quality and reviews, and grow the senior engineers under you.

WHAT YOU''LL DO
- Run weekly sprint planning, mid-sprint check-ins and retros
- Approve TDDs across backend, frontend, mobile and DevOps
- Sign off on releases — no release ships without your approval and QA''s
- Own the engineering hiring bar; sit on every senior+ panel
- Manage on-call rotation and incident-response process
- Coach senior engineers via 1:1s, design review and code review
- Track and improve engineering quality: bug rate, deploy frequency, lead time', requirements = 'REQUIRED QUALIFICATIONS
- 10+ years engineering experience, 3+ leading teams of 8-20
- Strong in at least two of: distributed backend, mobile, web frontend
- Comfortable owning sprint delivery, incident response and post-mortems
- Has hired senior engineers and shaped a hiring bar
- Excellent written communication — TDDs, post-mortems, hiring scorecards

NICE TO HAVE
- Has led an org through a stack migration or major rewrite
- Background contributing to open-source

TECH / TOOLS
Node.js / TypeScript, PostgreSQL, Redis, Kubernetes, AWS / GCP, Sentry, GitHub / GitLab

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-eng-lead', 'seed-real-wc-eng-lead');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Build and own the core APIs, the chat system, payments and the ads backend. You ship features that scale, integrate third-party services without leaking abstraction, and mentor mid-level engineers.

WHAT YOU''LL DO
- Own one or more services end-to-end: design, build, ship, operate
- Write clean, tested, observable code with sensible cardinality on metrics
- Lead TDD authorship for new services and major migrations
- Mentor mid-level engineers via code review and design review
- Participate in on-call rotation and own production for your services
- Identify and fix scaling bottlenecks before they become incidents
- Integrate payment, KYC, communication and AI third-party APIs', requirements = 'REQUIRED QUALIFICATIONS
- 5+ years building production backends
- Strong with Node.js / TypeScript or Go
- Deep with PostgreSQL: indexing, query planning, replication
- Comfortable with Redis, message queues and caching strategy
- Experience scaling a single service past 100k MAU
- Strong testing discipline — unit, integration, contract

NICE TO HAVE
- WebRTC, SFU/MCU or real-time messaging experience
- Payments, e-money or ledger experience
- OpenTelemetry or Prometheus expertise

TECH / TOOLS
Node.js / TypeScript, NestJS, PostgreSQL, Redis, Kafka or RabbitMQ, Docker, Kubernetes, AWS S3 / MinIO

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-be-senior', 'seed-real-wc-be-senior');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Implement backend features and bug fixes alongside seniors. Write tests, contribute to design reviews, and grow into ownership of services as you build skill.

WHAT YOU''LL DO
- Implement features against an approved TDD
- Write unit and integration tests for everything you ship
- Pair with senior engineers on architecture and design
- Triage and fix bugs from QA and production tickets
- Participate in code review with a high signal-to-noise rate
- Contribute to internal docs and runbooks', requirements = 'REQUIRED QUALIFICATIONS
- 2-4 years backend experience in a real production environment
- Strong fundamentals in REST, databases and async programming
- Comfortable writing tests with the right coverage discipline
- Hungry to learn distributed systems and operational practice

NICE TO HAVE
- Side projects or open-source contributions
- Familiarity with TypeScript, Prisma or similar typed ORMs

TECH / TOOLS
Node.js / TypeScript, PostgreSQL, Redis, Docker, Postman or similar

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-be-mid', 'seed-real-wc-be-mid');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Build the web dashboards: the Ads Manager, the Creator Portal, the recruiter cockpit and internal tools. Ship responsive, performant UI that implements design with fidelity.

WHAT YOU''LL DO
- Build new web surfaces from Figma to production
- Maintain and extend the design system and component library
- Hit Core Web Vitals targets on every page you ship
- Implement accessible UI per WCAG AA
- Partner with backend on API shape — push back when an endpoint is wrong
- Write component and integration tests
- Own browser-compatibility QA for your features', requirements = 'REQUIRED QUALIFICATIONS
- 4+ years React / Next.js in production
- TypeScript fluent
- Strong CSS / Tailwind, with a feel for design system thinking
- Has shipped at least one product with a real design system, not raw CSS
- Comfortable with browser performance profiling and CWV optimisation

NICE TO HAVE
- Experience with React Server Components and the App Router
- A11y certification or strong personal practice
- Storybook + visual-regression testing experience

TECH / TOOLS
React 18+, Next.js 14+, TypeScript, Tailwind, Vercel / Cloudflare Pages, Playwright, Storybook

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-fe-web', 'seed-real-wc-fe-web');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Build and maintain the WasaaChat Flutter app on iOS and Android. Ship features cleanly, optimise startup and scroll performance, and own crash-free release quality.

WHAT YOU''LL DO
- Implement product features against approved SRSs and TDDs
- Ship to App Store and Play Store on a regular cadence
- Optimise startup time, frame rate and battery
- Own crash triage and fix flow with Firebase Crashlytics
- Build platform-channel bridges for iOS / Android-specific work
- Maintain CI for mobile (Codemagic, Bitrise or similar)
- Write widget and integration tests', requirements = 'REQUIRED QUALIFICATIONS
- 4+ years Flutter / Dart in production
- Comfortable with platform channels, local storage, push notifications
- Has shipped to both App Store and Play Store at least once
- Strong on state management (Bloc, Riverpod or similar)
- Working knowledge of native iOS or Android for platform bridging

NICE TO HAVE
- WebRTC integration in Flutter
- Large-app experience: code splitting, deferred components
- Native Swift or Kotlin contributions in past lives

TECH / TOOLS
Flutter / Dart, Riverpod or Bloc, Firebase, Codemagic / Bitrise, Charles Proxy, Xcode, Android Studio

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-mobile', 'seed-real-wc-mobile');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Manage CI/CD pipelines, container orchestration, cloud infrastructure, observability and autoscaling. You are the person on call when production breaks.

WHAT YOU''LL DO
- Maintain and extend Kubernetes clusters across environments
- Own the CI/CD pipeline — GitHub Actions, ArgoCD, image registry
- Run cloud cost reviews and identify savings
- Maintain observability: Prometheus, Grafana, Loki, alerting rules
- Partner with engineering on autoscaling and capacity planning
- Lead disaster-recovery drills and backup verification
- Harden infrastructure: IAM, network policies, secrets management', requirements = 'REQUIRED QUALIFICATIONS
- 4+ years DevOps / SRE in production
- Kubernetes in production — not just kubectl, but operators and policies
- Strong with one cloud (AWS / GCP / Azure)
- Observability stack experience: Prometheus, Grafana, Loki / ELK
- Comfortable scripting in Bash, Python or Go

NICE TO HAVE
- ArgoCD, Flux or other GitOps tooling
- Service mesh experience (Istio, Linkerd)
- Compliance experience (SOC2, ISO 27001)

TECH / TOOLS
Kubernetes, Docker, ArgoCD, GitHub Actions, AWS / GCP, Prometheus, Grafana, Loki / ELK, Terraform

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-devops', 'seed-real-wc-devops');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Run functional, integration and load testing across the platform. Approve releases, document bugs precisely, and enforce the no-release-without-QA rule.

WHAT YOU''LL DO
- Define test plans for every major feature before it ships
- Run manual exploratory + scripted regression on each release
- Build and maintain the automation suite (Playwright, Cypress, Detox)
- Run periodic load tests with k6 or Gatling
- Own the bug bug-tracker — triage, prioritise, escalate
- Sign off on releases — no production deploy without your approval', requirements = 'REQUIRED QUALIFICATIONS
- 3+ years QA in a real product environment
- Both manual and automation experience
- Comfortable writing automation in JavaScript / TypeScript or Python
- Strong on bug-report quality — repro steps, logs, environment, severity

NICE TO HAVE
- Mobile testing on iOS and Android with Detox or Appium
- Performance / load testing experience
- ISTQB or similar credential

TECH / TOOLS
Playwright, Cypress, Detox or Appium, k6 or Gatling, Postman, JIRA / Linear

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-qa', 'seed-real-wc-qa');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Secure the platform end to end. Implement and enforce security controls, run vulnerability assessments and penetration tests, monitor for threats, and respond to incidents.

WHAT YOU''LL DO
- Run quarterly vulnerability assessments and pen tests
- Maintain the security-controls catalogue and audit it
- Own incident response — detection, containment, eradication, post-mortem
- Embed secure-coding practice via reviews and training
- Manage IAM, secrets management and key rotation
- Partner with Legal on data-protection compliance
- Maintain the SOC, SIEM rules and on-call paging for security events', requirements = 'REQUIRED QUALIFICATIONS
- 5+ years application or infrastructure security
- Hands-on with OWASP Top 10 across web and mobile
- Cloud security experience: IAM, VPC, network policies
- Incident-response practice — has actually run an IR, not just read about it
- Strong written communication for post-mortems and exec briefings

NICE TO HAVE
- OSCP, CISSP, CEH or comparable credentials
- Bug-bounty or red-team background
- PCI-DSS or SOC2 audit exposure

TECH / TOOLS
Burp Suite, Nmap, Wireshark, AWS / GCP IAM, HashiCorp Vault, Datadog / Wazuh

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-secops', 'seed-real-wc-secops');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Build and deploy ML models that drive recommendation, chat intelligence and content moderation. Own the pipeline from data preprocessing to production inference.

WHAT YOU''LL DO
- Design and train models for ranking, recommendation and moderation
- Stand up the inference layer — API, autoscaling, monitoring
- Build and maintain feature pipelines and feature stores
- Run A/B experiments to validate model impact on product metrics
- Partner with backend on integration and inference SLAs
- Manage model drift, retraining and versioning', requirements = 'REQUIRED QUALIFICATIONS
- 4+ years ML engineering in a real production environment
- Strong Python; PyTorch or TensorFlow at production level
- Experience deploying at least one model that serves real traffic
- Comfortable with cloud GPU/CPU inference cost optimisation
- Strong SQL and data-engineering fundamentals

NICE TO HAVE
- LLM and RAG experience — embeddings, vector DBs, prompt engineering
- Recommendation or ranking systems experience
- MLOps tooling: MLflow, Weights & Biases, Kubeflow

TECH / TOOLS
Python, PyTorch / TensorFlow, Hugging Face, MLflow, Pinecone or pgvector, AWS SageMaker / Vertex AI

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-ml', 'seed-real-wc-ml');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Design user flows for every platform feature. Improve onboarding conversion, ship Figma mockups that engineering can implement without ambiguity, and grow the design system.

WHAT YOU''LL DO
- Run discovery — interviews, usability testing, journey mapping
- Produce wireframes, mockups and prototypes for every SRS
- Maintain the Figma component library and design tokens
- Pair with engineers during build to keep fidelity
- Own onboarding conversion as a measurable KPI
- Lead design reviews with the CPO and engineering', requirements = 'REQUIRED QUALIFICATIONS
- 4+ years product design at a consumer app
- Strong portfolio with shipped work, not just dribbble shots
- Figma fluent: components, variables, auto-layout, prototyping
- Comfortable shipping in two-week cycles, not six-month redesigns
- Strong written communication — designs explain themselves

NICE TO HAVE
- Motion / Lottie experience
- Background in user research or behavioural science
- Design-system leadership in a previous role

TECH / TOOLS
Figma, FigJam, Lottie, Maze or UserTesting, Principle / Origami

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-uxui', 'seed-real-wc-uxui');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Run the program-management office across product, design and engineering. Standardise the SRS-to-TDD-to-release flow, run weekly cross-functional reviews, and own the risk register.

WHAT YOU''LL DO
- Define and enforce the standard delivery workflow across squads
- Run weekly cross-functional reviews with PMs, eng leads and design
- Maintain the company-wide programme dashboard
- Identify cross-team dependencies early and surface them
- Coach PMs on roadmap quality and SRS authorship
- Own the risk register with the COO', requirements = 'REQUIRED QUALIFICATIONS
- 8+ years senior PM, programme management or PMO leadership
- Strong process discipline without being process-fetishistic
- Excellent stakeholder management and prioritisation under pressure
- Has stood up a PMO from scratch in at least one prior role

NICE TO HAVE
- PMP, SAFe or comparable credential
- Background as a PM before moving into PMO

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-pmo-head', 'seed-real-wc-pmo-head');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Define features for feed, chat, messaging and Wasaa Stars. Write SRS documents that engineering can build from without 50 follow-up questions, align with growth and revenue, and coordinate releases.

WHAT YOU''LL DO
- Define quarterly OKRs for the Core Platform surface
- Write SRS documents that pass review on the first round
- Run discovery, user interviews and behavioural-data analysis
- Coordinate releases across engineering, design and growth
- Own a north-star engagement metric for the surface
- Run weekly product reviews with the CPO', requirements = 'REQUIRED QUALIFICATIONS
- 4+ years PM at a consumer platform
- Track record of moving an engagement metric (DAU, retention, time-spent)
- Strong written communication and SRS discipline
- Comfort with SQL and behavioural analytics
- Has shipped a feature that saw a real product impact, not just a release

NICE TO HAVE
- Background in social, content, marketplace or chat products
- Has worked alongside a creator-economy product

TECH / TOOLS
Mixpanel / Amplitude, Looker / Metabase, SQL, Figma, Linear / JIRA

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-pm-core', 'seed-real-wc-pm-core');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Own the monetisation surfaces — Coins, Ads Manager, Marketplace and Subscriptions. Ensure every feature has a clear path to revenue, run A/B pricing experiments, and track conversion funnels end to end.

WHAT YOU''LL DO
- Define monetisation OKRs and ladders per surface
- Write SRSs that always include the revenue model and unit economics
- Run pricing experiments with rigorous statistical discipline
- Own conversion funnels from impression to paid action
- Partner with the CRO on packaging and pricing decisions
- Coordinate compliance and payment-provider integration', requirements = 'REQUIRED QUALIFICATIONS
- 4+ years PM with a primary monetisation focus
- Strong analytics — funnel analysis, cohort retention, LTV / CAC modelling
- Has run pricing or paywall A/B tests with real revenue impact
- Comfortable with the math: elasticity, marginal revenue, take-rates

NICE TO HAVE
- Background on a marketplace, ads platform or in-app currency surface
- Some commercial-finance or pricing-strategy formal training

TECH / TOOLS
Mixpanel / Amplitude, Looker / Metabase, SQL, Figma, Stripe / payments tooling

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-pm-mon', 'seed-real-wc-pm-mon');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Build and maintain the CEO dashboard. Set up KPI tracking pipelines, produce weekly analytics reports, and support every team''s data-driven decisions.

WHAT YOU''LL DO
- Own the CEO and Board dashboard — uptime, accuracy, freshness
- Build reliable ETL/ELT pipelines into the warehouse
- Define and document the canonical metric layer
- Produce the weekly business review report
- Partner with PMs on funnel and cohort analysis
- Train the rest of the team on self-serve analytics', requirements = 'REQUIRED QUALIFICATIONS
- 3+ years data analytics or BI
- Strong SQL — window functions, CTEs, performance tuning
- Familiarity with dbt and a modern warehouse
- Strong on a BI tool (Looker, Metabase or Mode)
- Excellent at translating ambiguous business questions into metrics

NICE TO HAVE
- Python for ad-hoc analysis
- Exposure to event-tracking schemas (Mixpanel / Amplitude / Segment)
- Data-engineering fundamentals — orchestration, lineage

TECH / TOOLS
dbt, BigQuery / Snowflake / Redshift, Looker / Metabase, Mixpanel / Amplitude, Python, Airflow

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-data', 'seed-real-wc-data');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Drive user acquisition, lead Wasaa Stars campaigns, and own the creator-onboarding pipeline. Optimise referral loops and track DAU as your primary north-star metric.

WHAT YOU''LL DO
- Set quarterly growth OKRs (DAU, MAU, CAC, viral coefficient)
- Run paid + organic + creator acquisition channels
- Build and operate a referral programme that actually compounds
- Manage relationships with top creators and influencers
- Run weekly growth reviews with leadership
- Coach performance marketers and creator managers', requirements = 'REQUIRED QUALIFICATIONS
- 5+ years growth at a consumer platform
- Has owned a real paid budget with measurable ROI
- Strong with experimentation, funnels and creator marketing
- Comfortable in SQL or with a strong data partner

NICE TO HAVE
- African market exposure
- Fintech or social-app growth background

TECH / TOOLS
Meta / Google / TikTok Ads, AppsFlyer / Adjust, Mixpanel / Amplitude, Notion / Airtable

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-growth', 'seed-real-wc-growth');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Run paid acquisition campaigns. Optimise CPA and conversion, manage social media ad budgets, A/B test creatives and audiences, and report on ROI weekly.

WHAT YOU''LL DO
- Plan and run campaigns across Meta, Google, TikTok
- Build, test and rotate creatives every week
- Own attribution setup and reporting
- Identify winning audiences and scale them
- Maintain a healthy creative-fatigue rotation', requirements = 'REQUIRED QUALIFICATIONS
- 3+ years performance marketing for a consumer or app product
- Hands-on with Meta Ads, Google Ads and TikTok Ads
- Comfortable with attribution tooling and dashboards
- Numerate — you can reason about CAC, payback and ROAS

NICE TO HAVE
- App-install campaign experience
- Creative-production background

TECH / TOOLS
Meta Ads Manager, Google Ads, TikTok Ads, AppsFlyer / Adjust, GA4, Looker Studio

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-perfmkt', 'seed-real-wc-perfmkt');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Recruit and onboard micro-influencers, manage Wasaa Stars creator relationships, run creator incentive programmes, and quality-control content.

WHAT YOU''LL DO
- Build a pipeline of 50+ active creators per month
- Onboard creators end to end: paperwork, training, content brief
- Run incentive programmes and pay-out workflows
- Curate and quality-check content
- Partner with growth on creator-led acquisition campaigns', requirements = 'REQUIRED QUALIFICATIONS
- 2+ years community, creator-relations or talent-management work
- Active in Kenyan or East African creator scene
- Strong on tone, content judgement and brand fit

NICE TO HAVE
- A personal creator or producer background
- Tools fluency: Notion, Airtable, basic video tooling

TECH / TOOLS
Notion / Airtable, Slack / WhatsApp, Basic video tools

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-creator', 'seed-real-wc-creator');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Identify and close telco, bank and brand partnerships. Manage MOUs and revenue-sharing agreements, support the CEO on strategic deals, and own the deal pipeline.

WHAT YOU''LL DO
- Build and maintain the partnership pipeline (Salesforce or Notion)
- Originate, qualify and close partnership deals
- Negotiate MOU and revenue-share terms
- Run quarterly business reviews with active partners
- Support the CEO on strategic partner conversations', requirements = 'REQUIRED QUALIFICATIONS
- 5+ years business development
- Strong network in Kenyan telco / banking / brand ecosystem
- Comfortable owning a deal pipeline and closing complex deals
- Excellent written communication for MOUs and follow-ups

NICE TO HAVE
- Background in fintech or telecoms partnerships
- MBA or strategic-finance fluency

TECH / TOOLS
Notion / Salesforce / HubSpot, DocuSign, Excel

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-partnerships', 'seed-real-wc-partnerships');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Own the Ads Manager product and revenue. Acquire business advertisers, optimise PPC rates, track daily ad revenue, and improve ad conversion rates.

WHAT YOU''LL DO
- Set quarterly ad-revenue and CPM/CPC targets
- Lead the advertiser-acquisition motion (sales + self-serve)
- Partner with the PM on Ads Manager roadmap
- Run weekly revenue and ad-quality reviews
- Manage agency and direct-advertiser relationships', requirements = 'REQUIRED QUALIFICATIONS
- 6+ years in digital advertising platforms or ad sales leadership
- Deep CPM/CPC pricing intuition
- Has owned ad revenue for a real product, not just a portfolio of campaigns

NICE TO HAVE
- Experience standing up an ad-tech sales team from scratch
- Familiarity with header bidding, SSP and DSP integrations

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-ads-head', 'seed-real-wc-ads-head');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Manage P&L, budgeting and burn-rate tracking day to day. Process payroll and vendor payments, produce weekly and monthly financial reports, audit spend.

WHAT YOU''LL DO
- Maintain the books and the management-account pack
- Run monthly close and the management report
- Process payroll, vendor payments and reimbursements
- Audit spend and surface variance to the CFO
- Manage tax filings and statutory compliance', requirements = 'REQUIRED QUALIFICATIONS
- 5+ years finance / FP&A experience
- Qualified or part-qualified accountant (CPA / ACCA)
- Strong Excel / Sheets and accounting-tools skills (NetSuite / Xero / QB)
- Sharp attention to detail

NICE TO HAVE
- Tech / startup finance experience
- Experience with multi-entity consolidation

TECH / TOOLS
NetSuite / Xero / QuickBooks, Excel / Sheets, Bank portals

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-fin-mgr', 'seed-real-wc-fin-mgr');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Own the Wasaa Coins virtual economy. Manage coin purchase flows, ensure payment-provider integration is solid, and track transaction volume, conversion and fraud rates.

WHAT YOU''LL DO
- Set quarterly coin-revenue and conversion targets
- Manage payment-provider relationships (M-Pesa, cards, wallets)
- Own the fraud strategy and chargeback rate
- Partner with the PM on the coin-purchase UX
- Run weekly reconciliation between providers and our ledger', requirements = 'REQUIRED QUALIFICATIONS
- 6+ years in payments, fintech or in-app currencies
- Deep understanding of chargebacks, KYC and reconciliation
- Comfortable across mobile money, cards and bank transfers

NICE TO HAVE
- M-Pesa or other mobile-money-rails experience
- Background launching a virtual currency or in-app economy

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-coins', 'seed-real-wc-coins');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Own the marketplace product and revenue. Onboard sellers, track GMV and commission, improve listing quality, and lift buyer conversion.

WHAT YOU''LL DO
- Set quarterly GMV and take-rate targets
- Run the seller-acquisition pipeline
- Partner with the PM on listing quality and trust signals
- Manage seller-success and dispute-resolution operations
- Run weekly marketplace reviews', requirements = 'REQUIRED QUALIFICATIONS
- 5+ years on a marketplace product, either supply or demand side
- Strong on supply / demand mechanics and seller success
- Comfortable with cohort analysis and unit economics

NICE TO HAVE
- African marketplace experience
- Background as a marketplace PM before moving into ownership

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-mp-lead', 'seed-real-wc-mp-lead');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Track all revenue streams daily. Produce weekly revenue reports, identify trends and drops early, and support pricing decisions with data.

WHAT YOU''LL DO
- Produce the daily revenue snapshot and weekly review
- Build forecast models for each revenue stream
- Investigate anomalies and write up the root cause
- Support pricing experiments with statistical analysis
- Maintain the revenue dashboard alongside the data team', requirements = 'REQUIRED QUALIFICATIONS
- 2+ years analytics or finance role
- Strong SQL and modelling
- Comfortable presenting findings to leadership

NICE TO HAVE
- Python for ad-hoc analysis
- Some commercial-finance background

TECH / TOOLS
SQL, Excel / Sheets, Python (pandas), Looker / Metabase

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-rev-analyst', 'seed-real-wc-rev-analyst');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Own customer support, content moderation and internal workflows. Ensure platform trust and safety, manage SOP compliance, and handle every escalation.

WHAT YOU''LL DO
- Set support and moderation OKRs (resolution time, CSAT, removal rate)
- Run the support team and the content-moderation team
- Maintain SOPs and the internal knowledge base
- Partner with engineering on bug escalation and product feedback
- Own the trust & safety incident-response process', requirements = 'REQUIRED QUALIFICATIONS
- 5+ years operations leadership at a platform or BPO scale
- Strong process discipline; you can document and enforce SOPs
- Trust & safety background or willingness to grow into it
- Empathy and judgement at the same time

NICE TO HAVE
- BPO / contact-centre tooling experience (Zendesk, Intercom)

TECH / TOOLS
Zendesk / Intercom / Freshdesk, Notion / Confluence, Slack

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-ops-lead', 'seed-real-wc-ops-lead');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Handle user issues and complaints. Process refunds and disputes, escalate bugs to engineering, and maintain a high satisfaction score.

WHAT YOU''LL DO
- Respond to support tickets within SLA
- Process refunds and dispute resolutions
- Escalate bugs and feature requests with clean repro steps
- Maintain personal CSAT above target
- Contribute to the support knowledge base', requirements = 'REQUIRED QUALIFICATIONS
- 1-2 years support experience
- Excellent written English; Swahili a strong plus
- Calm, empathetic and detail-oriented
- Comfort with ticketing tools and basic SQL or admin panels

NICE TO HAVE
- Experience supporting a fintech or social product

TECH / TOOLS
Zendesk / Intercom, Slack, Internal admin panels

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-csa', 'seed-real-wc-csa');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Review flagged content. Enforce community guidelines, manage abuse and harassment reports, and coordinate with automated moderation tooling to scale fairly.

WHAT YOU''LL DO
- Review and action flagged content within SLA
- Apply community guidelines consistently and fairly
- Coordinate with auto-moderation tooling and feedback to ML team
- Handle escalations: harassment, hate speech, illegal content
- Contribute to the policy playbook', requirements = 'REQUIRED QUALIFICATIONS
- Resilient under exposure to sensitive content
- Strong judgement and attention to policy nuance
- Comfort with emotionally difficult work in a structured environment

NICE TO HAVE
- Prior trust-and-safety, moderation or law-enforcement-adjacent role
- Local-language fluency (Swahili, Sheng) for context

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-mod', 'seed-real-wc-mod');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Ensure payment and data compliance, review contracts and MOUs, manage GDPR-equivalent obligations, and support fundraising due diligence.

WHAT YOU''LL DO
- Review and negotiate contracts and MOUs across the business
- Maintain the data-protection programme and DSAR workflow
- Lead privacy reviews on every new feature
- Support fundraising and partnership due diligence
- Brief the leadership team on regulatory changes', requirements = 'REQUIRED QUALIFICATIONS
- Qualified lawyer with at least 4 years in tech / fintech
- Familiar with Kenya Data Protection Act and CBK guidelines
- Strong on commercial contracts and partnership deal terms
- Excellent written communication; clear, concise legal advice

NICE TO HAVE
- Some compliance or audit exposure
- Experience working with a Data Protection Officer or as one

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-legal', 'seed-real-wc-legal');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Plan and run brand events, creator meet-ups, launches and partner activations. Own logistics, vendors and the run-of-show.

WHAT YOU''LL DO
- Plan and execute 4-6 events per quarter
- Manage vendors: venue, catering, AV, production
- Own logistics, run-of-show and post-event reporting
- Partner with marketing and creator team on programming
- Stay within budget without compromising quality', requirements = 'REQUIRED QUALIFICATIONS
- 2+ years events / activations experience
- Strong project management and supplier negotiation skills
- Calm in execution mode; problem-solver at heart

NICE TO HAVE
- Brand or production background

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-events', 'seed-real-wc-events');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Own talent strategy, hiring, performance and culture. Build the People function from the ground up, coach managers, and run the comp framework.

WHAT YOU''LL DO
- Build and own the company-wide hiring pipeline
- Run the recruiting team and partner with hiring managers on every panel
- Define and roll out the performance-management framework
- Maintain the comp bands and the pay-equity audit
- Coach managers on people-leadership skills
- Lead the culture and engagement programme', requirements = 'REQUIRED QUALIFICATIONS
- 6+ years HRBP or People leadership at a tech / startup
- Strong on hiring at speed (10-30 hires per quarter)
- Has stood up or significantly evolved a culture programme
- Comp-framework design experience

NICE TO HAVE
- SHRM-CP, CIPD or similar credential
- Background as a recruiter before HR generalist

TECH / TOOLS
Greenhouse / Lever / Ashby, BambooHR / Rippling, Slack, Notion

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-pc-lead', 'seed-real-wc-pc-lead');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Support recruiting pipelines, onboarding, employee experience and HR operations. Maintain HRIS data and policies and keep the People function running smoothly.

WHAT YOU''LL DO
- Coordinate hiring pipelines: scheduling, candidate experience, offers
- Run new-hire onboarding end to end
- Maintain HRIS data and run the monthly payroll handoff
- Support performance and engagement-survey cycles
- Maintain the policy library', requirements = 'REQUIRED QUALIFICATIONS
- 2+ years HR or recruiting coordination
- Highly organised, proactive and communicative
- Comfortable with HRIS and ATS tools

NICE TO HAVE
- Background in a high-volume recruiting environment

TECH / TOOLS
Greenhouse / Lever, BambooHR / Rippling, Notion / Slack

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-pc-assoc', 'seed-real-wc-pc-assoc');
UPDATE "Job" SET description = 'ABOUT THE ROLE
Run the office. Supplies, vendor coordination, front-desk hospitality, light admin and travel logistics — you keep the building functional.

WHAT YOU''LL DO
- Manage office supplies, snacks and equipment requests
- Coordinate with cleaning, security and IT vendors
- Greet visitors and manage front-desk hospitality
- Book travel and accommodation for staff and guests
- Support events and offsites with logistics', requirements = 'REQUIRED QUALIFICATIONS
- 1+ year office admin experience
- Friendly, organised, proactive
- Reliable timekeeping

NICE TO HAVE
- Tech-startup environment exposure

WHAT WE OFFER
- Competitive package with equity for senior hires
- Health insurance for you and your dependents
- Quarterly learning and development stipend
- Hybrid work — Nairobi office + flexible remote days
- A small senior team — your work moves the metrics directly', "updatedAt" = NOW() WHERE id IN ('seed-real-wm-office', 'seed-real-wc-office');

-- Updated 39 roles × 2 companies = 78 job rows with detailed content
