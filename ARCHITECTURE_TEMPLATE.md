# 🏗️ PROJECT ARCHITECTURE

**Project Name:** [Insert Name]
**Last Updated:** [Insert Date]

This document is the source of truth for how this project is built. Both human developers and AI agents should read this before making changes.

---

## ⚠️ DOCUMENTATION VS CODE

This document describes the **intended** architecture. However, AI agents MUST verify important claims against the actual codebase before making changes.

If this document and the actual implementation disagree:
1. Do NOT silently change the code to match this document.
2. Do NOT silently change this document to match the code.
3. Flag the discrepancy explicitly and resolve it deliberately with the project owner.

---

## 1. PROJECT PURPOSE

[Briefly explain what this application does in plain English. One to three sentences. No jargon.]

*Example: "This is a CRM designed for real estate agents to track leads, manage follow-ups, and send automated emails via third-party providers."*

---

## 2. TECHNOLOGY STACK

| Layer | Technology |
|---|---|
| **Frontend** | [e.g., React, Next.js, Vite, Tailwind CSS] |
| **Backend / Database** | [e.g., Supabase, PostgreSQL, Node.js, Firebase] |
| **State Management** | [e.g., React Query, Zustand, Context API] |
| **Authentication** | [e.g., Supabase Auth, Firebase Auth, Auth0] |
| **Hosting** | [e.g., Vercel, Netlify, AWS, Railway] |
| **Secret Management** | [e.g., Supabase Secrets, Vercel Env Vars, AWS Secrets Manager] |

---

## 3. CORE DATA FLOW

[Explain how the different parts of the app communicate. Use plain arrows. Keep it simple.]

```text
User
  ↓
Frontend UI
  ↓
Service Layer (src/services/)
  ↓
Database / Backend
```

External communication (API keys must never leave the server):
```text
Frontend UI
  ↓
Server / Edge Function
  ↓
Third-party API (Email, Payments, AI, etc.)
```

---

## 4. DIRECTORY STRUCTURE

[Highlight the most important folders so the AI knows where to look. Delete rows that do not apply.]

| Folder | Purpose |
|---|---|
| `src/features/` | Isolated business features (one folder per feature) |
| `src/components/` | Shared UI components reused across features |
| `src/services/` | All database and API communication |
| `src/hooks/` | Custom reusable hooks |
| `src/pages/` | Full page layouts |
| `src/types/` | Type definitions |
| `src/config/` | Application configuration |
| `[migrations folder]` | Database schema migrations |
| `[functions folder]` | Server-side / edge functions |
| `tests/` | Unit, integration, and E2E tests |

---

## 5. FEATURE MAP

[Map each major feature to its location in the codebase. Add or remove rows as needed.]

| Feature | Location |
|---|---|
| Authentication | `src/features/auth/` |
| [Feature Name] | `src/features/[name]/` |
| [Feature Name] | `src/features/[name]/` |
| [Feature Name] | `src/features/[name]/` |
| Database Migrations | `[path to migrations]/` |
| Edge / Server Functions | `[path to functions]/` |

---

## 6. AUTHENTICATION & AUTHORIZATION

**Authentication** (who are you):
[How users log in. E.g., "Handled via Supabase Auth with email/password."]

**Authorization** (what are you allowed to do):
[How permissions are enforced. E.g., "Row Level Security policies on all business-data tables. The UI hides unauthorized actions, but the database is the actual enforcement layer. Frontend visibility is never the only protection."]

---

## 7. EXTERNAL INTEGRATIONS

[List third-party APIs and how they are accessed. The frontend must never talk directly to services that require secret keys.]

| Service | Provider | How It Is Accessed |
|---|---|---|
| Email | [e.g., Brevo, Resend, SendGrid] | Server/Edge Function only — never direct from frontend |
| Payments | [e.g., Stripe] | [Access method] |
| AI | [e.g., OpenAI, Gemini] | Server/Edge Function only |
| Messaging | [e.g., Twilio, WhatsApp] | Server/Edge Function only |

---

## 8. ARCHITECTURAL DECISIONS & CONSTRAINTS

This section uses four explicit categories. The AI must understand what each category means before making any changes.

**Category definitions:**
- **Intentional Decision** — Deliberately chosen. Do not change without explicit approval and a documented reason.
- **Current Implementation** — How the system works today. May be changed as part of a planned improvement, but inspect before touching.
- **External Constraint** — Externally imposed and non-negotiable (hosting platform, client requirement, budget). Never violate.
- **Technical Debt** — Known to be imperfect. Document it; do not silently "fix" it without approval.

### Intentional Decisions
[Things the AI must never change without explicit approval.]

| Decision | Rationale |
|---|---|
| [e.g., Use Zustand, not Redux] | [e.g., Simpler for this project size. Do not install Redux.] |
| [e.g., UUIDs for all record IDs] | [e.g., Required for distributed systems compatibility.] |
| [e.g., Soft deletion via `deleted_at`] | [e.g., Business records must always be recoverable.] |
| [e.g., No direct DB calls in UI components] | [e.g., All DB access goes through the service layer.] |

### External Constraints
[Non-negotiable limitations imposed from outside the project.]

- [e.g., Must remain deployable on Vercel. Do not introduce server requirements that Vercel cannot support.]
- [e.g., Must use the existing database. Do not propose migrating to a different provider.]
- [e.g., No paid third-party services or APIs without approval.]
- [e.g., Must support mobile browsers.]

### Current Implementation Notes
[How the system works today that may not be obvious from the code alone.]

- [e.g., Email is sent synchronously via the API route, not queued. This is intentional for now.]
- [Add any other non-obvious implementation details here.]

---

## 9. CURRENT PROJECT STATUS

[Keep this section up to date. This is the fastest way for an AI to understand the current state without reading 50 files.]

### Completed
- [e.g., Authentication and user management]
- [e.g., Core data management]

### In Progress
- [e.g., Bulk export feature]
- [e.g., Mobile responsive layout]

### Known Issues
- [e.g., Search is slow above 10,000 records]
- [e.g., Background job occasionally creates duplicate entries]

### Do Not Modify Without Explicit Approval
- [e.g., Authentication architecture]
- [e.g., Core database schema for primary tables]
- [e.g., Access control policies — any change must be reviewed and tested]

---

## 10. KNOWN TECHNICAL DEBT

[Document anything that is knowingly imperfect so the AI does not repeatedly rediscover it — and does not try to "fix" it without understanding the tradeoff.]

| ID | Issue | Impact | Priority | Proposed Fix |
|---|---|---|---|---|
| TD-001 | [Description of the issue] | [Impact if left unfixed] | Low / Med / High | [What the eventual fix should be] |
| TD-002 | [Description of the issue] | [Impact if left unfixed] | Low / Med / High | [What the eventual fix should be] |

---

## 11. DEEP DOCUMENTATION REFERENCES

[For topics too detailed to live in this file, list the relevant `docs/` files and what they cover. AI agents must read the referenced file before modifying the relevant feature.]

| Topic | File |
|---|---|
| [e.g., Calculation methodology] | [`docs/calculation-methodology.md`] |
| [e.g., Data model detail] | [`docs/data-model.md`] |
| [e.g., Testing approach] | [`docs/testing-methodology.md`] |
| [e.g., Integration specs] | [`docs/integrations.md`] |
