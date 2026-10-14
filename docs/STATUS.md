# Forjora — Status

Last updated: 13 October 2026

This is the shipped product today, against the [roadmap](./ROADMAP.md).

## Snapshot

| Area | Status |
| --- | --- |
| Foundation (wallet, quiz, scoring, puzzle, CI) | Complete |
| Identity | Account sign-in (email or Google) with progress on the learner account |
| Learning experience | Partial — eight Avalanche tracks including Nodes & Validators and ICM messaging lab (**Wave A** shipped); further optional path polish not sequenced |
| Credentials | Partial — soulbound contract live on Fuji; learner mint is self-claimed |
| Gamification | Live community ranking (public Board browse); server-written XP ledger when Functions are deployed, otherwise event-log replay; XP, levels, achievements, streaks, path engine |
| Platform | Partial — account-backed progress and wallet linking; **Wave B** RTDB analytics + Ops question publish (partial); issuer ops not shipped |
| Security & Launch | Partial — production readiness gate is **closed**; launch validation **not approved** for public launch |
| Fuji credential | Live |
| Learner-progression agent, language model, MCP | Not shipped — planned extension; see [Architecture](./ARCHITECTURE.md) |

Fuji contract: [`0x3756be4955530Bba0844C4D2EcF35DB5ed7d90df`](https://testnet.snowtrace.io/address/0x3756be4955530Bba0844C4D2EcF35DB5ed7d90df) (chain ID 43113).

## Identity

The learner-facing mark is **Forjora**: a geometric “F” / upward pathway icon in charcoal with a forge-orange accent step, plus a bold FORJORA wordmark. Brand feeling: Learn → Build → Prove → Advance. The product UI is a digital sketchbook inside a modern forge — clean surfaces with hand-drawn doodle accents (not cartoon chrome). Major pages carry a dense atmospheric doodle field (100+ glyphs) behind content; signature motion language: **draw** (sketched into view), **forge** (hammer → diamond), and **verify** (nodes connect → check), with reduced-motion support.

Learners use an **account** (email/password or Google). Name, email, and password create the account; a verification link must be opened before the learner is treated as signed in for progress. Progress follows that account across browsers and devices. **Email verification is required** before account-backed Firestore and Storage access. Repeated sign-in, signup, and password-reset attempts are throttled in the app, in addition to Firebase Auth quotas. A **wallet** is optional until the learner mints and is not a signup gate. Connecting a wallet auto-links it to the signed-in account. On phones, stock browsers usually cannot inject MetaMask or Core, so Forjora opens inside the wallet app browser to connect and mint. If that wallet has local quiz or puzzle progress in this browser, that snapshot replaces the account copy. An empty wallet does not wipe the account. A wallet already linked to another account is not adopted. Switching wallets does not move another person’s XP or puzzle. Signing out does not leave progress on the next session’s account.

Privacy Policy and Terms of Service are linked from signup and the footer.

Existing browser progress is moved onto the account once, so a returning learner does not start from zero.

## Learning

- **Learn on Forjora** hub: continue learning, category filters, track cards (modules · lessons · challenges · skills · progress), and knowledge-check challenges.
- Track pages use a vertical **learning path** (completed / current / locked) ending in a credential milestone.
- Lesson workspace: track nav · lesson body · progress/skills rail (stacks on mobile).
- Easy, Medium, Hard, and Master quizzes are Foundation / Builder / Advanced / Mastery **challenges** in the learner UI (5 / 7 / 10 / 12 questions). Knowledge checks appear after a short stretch of learning, not on a fixed lesson count.
- Challenges award XP and puzzle fragments on first completion (retries do not farm rewards). Five fragments convert into one puzzle piece. Fuji seating/mint still uses the frozen Easy / Medium / Hard five-correct scale (80 points).
- Structured path with eight tracks: Fundamentals, Architecture, Nodes & Validators (lesson-only after Architecture), L1s, C-Chain & Smart Contracts, ICM (lessons + self-claimed messaging lab), Developer (tooling → self-claimed project lab → Hard), and Security Practices (lesson-only after Developer).
- Lessons unlock in order. Each lesson has a deeper body and an official Avalanche reference. Some lessons include a self-check steps checklist. Challenges sit on the path (Easy → Fundamentals, Medium → Architecture, Hard → Developer capstone after the project lab; Mastery is challenge-only). Nodes, ICM lab, and Security do not unlock a seating quiz.
- Shared layout tokens align nav, main, and footer gutters; page chrome (`page` → `page-header` → `section-block`) is consistent across Learn, Progress, Credentials, Board, and Profile. Unknown URLs show a custom Forjora 404 (“Path not forged”) with links home and to Lookup.

## Progression

- One event stream drives XP, levels, achievements, streaks, path completion, puzzle events, and credentials.
- Quiz retries do not farm XP or puzzle fragments.
- Mastery (accuracy by difficulty) sits beside XP (activity). Puzzle progress shows pieces seated and fragments toward the next piece.
- Streaks use UTC calendar days. Duplicate activity on the same UTC day does not inflate the streak.
- Achievements unlock from events (first quiz, perfect score, difficulties, streak milestones, puzzle milestones, skill ladders, credential, track certificates, path). The Progress forge shows family-grouped badges, streak calendar, puzzle milestones, and off-chain learning certificates — distinct from Fuji claimed or issuer-attested mints.
- Dashboard shows level, XP, streak, puzzle count, path progress, and the next activity on the path. That next step is path order (the first unlocked incomplete lesson or quiz). It is not a language-model recommendation.

## Puzzle and certificate

- Sixteen interlocking pieces, reserved by quiz: Easy 3, Medium 5, Hard 8. Points from a quiz only seat that quiz’s pieces. Puzzle fragments from assessments convert into additional pieces (5 fragments = 1 piece).
- Each of the eight tracks has a certificate. Quiz tracks are achieved when their pieces are seated. Lesson tracks (Nodes, L1s, C-Chain, ICM, Security) are achieved when the track is complete. Project labs (ICM messaging, Developer) are self-claimed learning records, not graded or issuer-attested reviews.
- The **Credential vault** on Credentials separates **track and learning certificates** (off-chain, earned / in progress / locked) from the **path snapshot** (sixteen pieces → name → optional claimed Fuji mint). Achieved cards do not pretend to be on-chain tokens.
- Artwork: Forjora forge certificate image — blacksmith in a workshop presenting a crafted diamond; banners say Forjora and Learn · Forge · Prove, not “certified” or “verified”.

## Credentials

- Soulbound NFT. It cannot be transferred.
- Learner mint records a **claimed** score.
- The Credentials page is a **Credential vault**: quiet summary metrics, featured proof, filters, multi-state cards, journey + puzzle, skills, and the optional claimed Fuji path mint panel. Looking up a Fuji record does not make a claimed score issuer-attested.
- The contract also supports **issuer-attested** mint with an owner signature. That path is not the default learner UI.
- Shareable lookup by credential ID, share URL, or QR, also reachable from Lookup in the nav and footer. The Lookup page is a quiet public confirmation portal: compact search, status, certificate preview, skills, evidence, mint-time snapshot, and on-chain record. Sharing the site or a credential URL shows Forjora forge artwork in the link preview. A found record is an on-chain record, not a verified exam.
- Forjora does not issue credentials on Avalanche C-Chain today.

## Leaderboard

New verified accounts appear on the live board under their display name, including at 0 XP and including people who signed up before opening Board. Guests can browse the Board without signing in. Learners can hide, and can optionally show a truncated linked wallet. Standing prefers a server-written XP ledger, materialized from first-time learning events; when that ledger is not yet available the board falls back to replaying the same event log. Learners cannot write XP totals or rank fields. Quiz retries do not farm standing. The board is a **community ranking**, not a tamper-proof exam. It is not on-chain, and is not issuer-attested.

Public learner profiles live at `/u/:slug` for opted-in board names. They show the same community standing honesty: not issuer-attested, not on-chain.

It is not a league with an issuer, not on-chain, and not a verified exam. A claimed credential remains distinct from this board.

## Not shipped yet

Tagged by extension wave — see [Flowchart](./FLOWCHART.md) §6 and [Roadmap](./ROADMAP.md).

- **Wave A** — shipped: Nodes & Validators lesson-only track; ICM messaging lab (no fourth seating quiz)
- **Wave B** — Remainder of question-bank operations and learning analytics dashboards. A partial operator surface can already publish questions and summarize learning events.
- **Wave C** — Attested mint in the learner UI, plus revocation and versioning. The contract owner can already sign an authorization from the issuer pane; that signature does not mint, and the learner flow cannot submit it.
- **Wave D** — Independent review of freeze v1, production monitoring, and Avalanche C-Chain issuance (the production readiness gate stays closed; launch validation is not public-launch approval; see [Security & Launch](./ROADMAP.md))
- **Wave E** — Partners, collections, third-party verification of attested credentials (after Wave D)
- **Agentic extension** — Learner-progression agent, a language model, tool use, outcome tracking, and MCP servers. None of this is in the product. The [architecture](./ARCHITECTURE.md) separates that plan from the shipped loop. An “AI Builder” badge is a skill ladder for builder-tooling progress, not an agent.