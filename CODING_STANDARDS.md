# AI & HUMAN SOFTWARE ENGINEERING STANDARDS

**Version:** 2.0
**Applies to:** All projects, all tools, all contributors
**Audience:** AI coding agents, developers, technical contractors, and anyone modifying the codebase

---

# 0. PURPOSE & PHILOSOPHY

This document defines the universal standards for building, modifying, debugging, testing, documenting, and maintaining software.

The goal is to produce software that is:
- Understandable
- Maintainable
- Secure
- Testable
- Modular
- Recoverable
- Documented
- Easy for another AI or human to continue

### Core Principle
> **A feature is not complete when it works once. A feature is complete when it is implemented correctly, isolated appropriately, documented, tested, secure, and can be safely modified later.**

### Design Philosophy
> **Maximum reliability with minimum unnecessary complexity.**

Do not over-engineer. Do not under-engineer. Build the simplest system that is genuinely robust.

---

# 0.1 PRIORITY CLASSIFICATION

Not all rules carry equal weight. This document uses three tiers:

### MUST (Critical)
Mandatory. Violation risks data loss, security breaches, or project failure.

Applies to: Security, Data Integrity, Scope Control, Secrets, Database Safety, Migrations, Core Documentation, Modularity, Error Handling, Testing, Change Verification.

### SHOULD (Important)
Strong recommendation. Follow unless there is a documented reason not to.

Applies to: Accessibility, Performance, Responsive Design, Dependency Discipline, Loading/Empty States, Logging, Auditability, Cost Awareness, Provider Abstraction.

### MAY (Recommended)
Good practice. Apply based on project needs.

Applies to: Design System, Vendor Lock-in Mitigation, Data Exportability, Architectural Decision Records.

---

# PART I: CODE QUALITY & STRUCTURE

---

## 1. NON-CODER OPERATING PRINCIPLES

AI agents must assume that the project owner may not understand the underlying code.

Therefore, the AI must:
1. Explain important architectural decisions in plain English.
2. Never assume the user understands technical consequences.
3. Never silently make major architectural changes.
4. Never delete or replace working functionality without explaining why.
5. Never make a large number of unrelated changes in response to a small request.
6. Clearly distinguish what was requested, what was changed, what was discovered, what remains unresolved, and what should be tested.
7. Prefer safe, reversible changes.
8. Ask for clarification when a decision could materially affect data, security, architecture, existing functionality, costs, or production behavior.
9. If a user instruction would cause a material problem (data loss, security weakness, broken functionality, significant cost), the AI MUST say so clearly before proceeding — not after. Warn first. Then ask whether to proceed.

---

## 2. PROJECT STRUCTURE

Every project MUST have a predictable structure. The exact layout varies by framework, but the principle of **predictable separation** must remain.

A typical structure:
```text
/project
├── README.md
├── AGENTS.md
├── CODING_STANDARDS.md
├── CHANGELOG.md
├── .env.example
├── .gitignore
│
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── security.md
│   ├── integrations.md
│   └── decisions/
│
├── src/
│   ├── components/
│   ├── features/
│   ├── pages/
│   ├── layouts/
│   ├── hooks/
│   ├── services/
│   ├── api/
│   ├── utils/
│   ├── types/
│   └── config/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── scripts/
```

---

## 3. FEATURE-BASED ORGANIZATION

Features MUST be isolated. Do not create enormous generic files containing unrelated functionality.

Instead of one giant file, use a dedicated folder per feature:
```text
src/features/leads/
    LeadList.jsx
    LeadProfile.jsx
    LeadForm.jsx
    leadService.js
    leadTypes.js
```

This makes it easy for both humans and AI agents to understand where functionality belongs and to modify one feature without breaking another.

---

## 4. FILE SIZE

A file becoming very large usually means it is doing too many things.

### Guidelines
- **< 200 lines:** Ideal
- **200–300 lines:** Review whether splitting would help
- **> 300 lines:** Should be refactored
- **> 400 lines:** MUST be reviewed and broken down unless there is a documented reason

Exceptions: Generated files, configuration, database migrations, simple data definitions.

Do not split files artificially just to meet a number. The objective is **logical separation**, not arbitrary line counts.

---

## 5. COMPONENT RESPONSIBILITY

Each component should have **one primary responsibility**.

Bad — one file doing ten things:
```text
ProfilePage.jsx → Fetches user, fetches history, handles permissions,
sends messages, renders timeline, renders form, handles validation...
```

Better — composed from focused parts:
```text
ProfilePage
 ├── ProfileHeader
 ├── ProfileDetails
 ├── ActivityTimeline
 ├── ActionList
 └── ProfileActions
```

Logic should be separated from presentation where practical.

---

## 6. SEPARATION OF CONCERNS

UI components MUST NOT contain large amounts of raw database, API, or business logic.

Use a service or hook layer:
```text
UI Component  →  Service / Hook  →  Database / API
```

- **Components handle:** Display, user interaction, local UI state.
- **Services handle:** Data operations, API requests, transformations, external communication.

---

# PART II: DATA & DATABASE

---

## 7. DATABASE-FIRST DEVELOPMENT

For applications with a database, this is the preferred development order:
> **Data Model → Security → Services → UI**

Do not build the UI first and figure out the database later.

Before implementing a major feature:
1. Define data model and relationships.
2. Define constraints and validation rules.
3. Define permissions and access control.
4. Create migration.
5. Test database access and security.
6. Build service/API layer.
7. Build UI.

---

## 8. DATABASE MIGRATIONS

Every database change MUST be represented by a versioned migration file. Never make undocumented database changes.

Migration files should be sequential, descriptive, version controlled, and reproducible:
```text
001_initial_schema.sql
002_add_lead_stages.sql
003_add_followups.sql
```

Never modify an old migration that may already have been applied to another environment. Create a new migration instead.

---

## 9. DATABASE SAFETY

AI agents MUST assume that production data is valuable.

**NEVER:**
- Drop a table without explicit approval
- Delete production data casually
- Rewrite schema without a migration
- Run destructive SQL without a warning
- Remove columns without verifying all dependencies

Before any destructive operation: explain what will happen, identify affected data, confirm backup/recovery strategy, and obtain approval.

---

## 10. SOFT DELETION

Core business records SHOULD use soft deletion (e.g., `deleted_at`, `deleted_by`). Normal queries should automatically exclude soft-deleted records. Deleted records should remain recoverable by authorized administrators.

---

## 11. DATA INTEGRITY

The database should enforce important rules wherever possible. Do not rely only on frontend validation.

Validate at multiple layers:
```text
UI validation  +  Service validation  +  Database constraints
```

---

# PART III: SECURITY

---

## 12. AUTHENTICATION VS AUTHORIZATION

- **Authentication:** Who are you?
- **Authorization:** What are you allowed to do?

Never assume that because a user is authenticated, they are authorized to access everything. Every protected action must consider authorization.

---

## 13. SECURITY AT THE AUTHORITATIVE LAYER

Frontend permission checks are **not security**. The frontend may hide a "Delete" button, but a malicious user could still send a delete request directly.

**Security MUST be enforced at the appropriate authoritative layer.** For database-backed applications, database-level security (such as row-level security) should be used where the platform supports it. For API-backed applications, the backend must enforce access control.

The frontend provides a good user experience. The backend provides actual security.

---

## 14. SECRETS MANAGEMENT

Secrets (API keys, database credentials, tokens, signing keys) MUST be stored using the project's approved server-side secret management mechanism. See `ARCHITECTURE.md` for the specific mechanism used in this project.

**NEVER place secrets in:**
- Frontend code or client-accessible environment variables
- Version control (Git)
- Documentation, screenshots, or AI responses
- Client-side JavaScript

Maintain `.env.example` with variable names but **never real values**. If a secret accidentally enters Git, **treat it as compromised** and rotate it immediately.

---

## 15. PUBLIC VS SECRET CONFIGURATION

Every project MUST clearly distinguish between:
- **Public configuration** (safe for frontend): API URLs, public keys
- **Secret configuration** (backend only): API keys, service role keys, OAuth secrets, webhook signing secrets

Never assume an environment variable is secret merely because it is in a `.env` file. Frontend environment variables are often exposed to end users.

---

## 16. PRIVILEGED DATABASE FUNCTIONS

Functions that bypass normal access control MUST be used carefully:
- Explicitly set and restrict `search_path`
- Schema-qualify all objects
- Restrict execution permissions
- Document why each privileged function exists
- Never use them merely for convenience

---

# PART IV: THIRD-PARTY INTEGRATIONS

---

## 17. INTEGRATION ISOLATION

External APIs should be isolated behind a server-side layer.

**Preferred:**
```text
Frontend  →  Server / Edge Function  →  Third-party API
```

**Not:**
```text
Frontend  →  Third-party API directly
```

This keeps secrets secure, provider logic isolated, and rate limiting manageable.

---

## 18. PROVIDER ABSTRACTION

Isolate external providers behind a clear service boundary so that the rest of the application does not need to know which provider is in use.

```text
Application  →  Email Service (internal)  →  [Provider]
```

Do not build elaborate provider-abstraction frameworks unless multiple providers or a genuine future provider replacement justifies the complexity. A single clean service file is sufficient for most projects. The principle is clear isolation, not over-engineering.

---

## 19. WEBHOOKS

All incoming webhooks should:
1. Verify authenticity/signature where supported
2. Validate payload structure
3. Prevent duplicate processing (idempotency)
4. Log relevant events
5. Handle retries safely

---

# PART V: ERROR HANDLING & UX

---

## 20. GRACEFUL ERROR HANDLING

Errors must fail gracefully. Never allow a blank screen or cryptic error message to reach the user.

User-facing errors should be **clear, short, and actionable**.

- Bad: `Error 23505`
- Better: **"This email already belongs to another record. Please review the existing entry."**

Technical details should go into logs, not the user interface.

---

## 21. NEVER SWALLOW ERRORS

User-friendly messages do NOT mean silently ignoring failures. Every important failure must remain diagnosable.

**Bad:**
```text
catch { return; }
```

**Better:**
```text
catch(error) {
  logError(error);
  showUserMessage();
}
```

---

## 22. LOADING STATES

Every asynchronous operation SHOULD have appropriate states: **Idle → Loading → Success / Error**.

Do not allow buttons to appear dead. Prevent duplicate submissions by disabling controls during operations.

---

## 23. EMPTY STATES

Every list SHOULD have a useful empty state explaining why nothing is shown:

> "No follow-ups due today."
> "No records match these filters."

Do not leave large blank screens without explanation.

---

# PART VI: TESTING

---

## 24. TESTING PYRAMID

Use the appropriate combination of testing levels based on the project's architecture and risk profile. Not every project requires all four types equally.

| Level | Purpose |
|---|---|
| **Unit Tests** | Test individual functions and logic |
| **Integration Tests** | Test interactions between components, services, and database |
| **E2E Tests** | Test real user workflows end to end |
| **Security Tests** | Attempt unauthorized actions to verify they are denied |

**Security-sensitive applications MUST include security testing.** Applications with complex logic (calculations, financial processing, data transformations) MUST prioritize unit tests covering known cases, boundary cases, and edge cases.

---

## 25. SECURITY TESTING

Security tests MUST attempt to break the system:
- User accesses another user's data
- User modifies unauthorized records
- User invokes privileged endpoints directly
- User attempts to escalate their own permissions

The expected result must be **denial at the backend layer**, not just absence of a button in the UI.

---

## 26. REGRESSION TESTING

When fixing a bug:
1. Reproduce the bug
2. Create a test that fails because of the bug
3. Fix the bug
4. Confirm the new test passes
5. Confirm existing tests still pass

This prevents the same bug from returning.

---

## 27. DO NOT PATCH SYMPTOMS

If something fails repeatedly, stop adding patches. Investigate the underlying root cause and fix it permanently.

---

## 28. DEBUGGING PROTOCOL

1. Reproduce the issue
2. Capture the exact error message
3. Identify which layer failed (UI → Service → API → Database → External)
4. Inspect logs
5. Fix the root cause
6. Test the fix
7. Add regression protection

---

# PART VII: CHANGE MANAGEMENT

---

## 29. SMALLEST SAFE CHANGE

Prefer the minimum amount of code required to accomplish the objective. Do not rewrite an entire module merely because existing code could theoretically be improved.

---

## 30. SCOPE CONTROL

If asked to add a field, do not redesign the page. If asked to fix a bug, do not refactor the module. Implement the requested change and document anything else separately.

---

## 31. NO UNRELATED CLEANUP

NEVER use a small feature request as an excuse to refactor unrelated parts of the application. If unrelated technical debt is discovered, document it:

> "I noticed the auth service could be improved, but I did not change it because it is outside the requested scope."

---

## 32. BEFORE MODIFYING A FEATURE

Identify the full feature stack before touching anything:
```text
Feature
├── UI
├── Services
├── Database
├── Security
├── Tests
└── Documentation
```
Then modify only the relevant layers.

---

## 32b. DEPENDENCY IMPACT CHECK

Before modifying any **shared** component, utility, service, hook, database function, schema, or calculation — search for every place in the codebase that uses it.

```text
Modifying shared function calculateReturn()
              ↓
Search all usages:
  - Performance report page
  - Portfolio dashboard
  - Investor statement generator
  - Data export module
  - Unit tests
              ↓
Assess impact on each consumer
              ↓
Test affected functionality
              ↓
Then declare the change complete
```

Do not modify shared code and check only the file you were asked to change. A function that "looks fine" in isolation may silently break three other features that depend on it.

If the impact is wider than expected, stop and report before proceeding.

---

## 33. AFTER MODIFYING A FEATURE

Verify:
1. New functionality works
2. Existing functionality still works
3. Security is not weakened
4. Tests pass
5. No unrelated files were unnecessarily modified

---

## 34. FEATURE COMPLETION STANDARD

Apply the layers relevant to the change. Not every task requires every layer — a color change does not need a database migration. However, **security must always be considered regardless of task size** — even small UI changes can trigger data operations that require authorization.

For **substantial new features**, verify all applicable layers:
- [ ] Data model / database implemented
- [ ] Security / access control implemented
- [ ] Service / API layer implemented
- [ ] UI implemented
- [ ] Loading states implemented
- [ ] Empty states implemented
- [ ] Error handling implemented
- [ ] Permissions tested
- [ ] Edge cases considered
- [ ] Documentation updated
- [ ] No unrelated functionality broken

---

# PART VIII: VERSION CONTROL

---

## 35. GIT DISCIPLINE

Git is the source of truth for code. Every meaningful change should have a clear, descriptive commit message.

Good:
```text
feat: add distributor relationships
fix: prevent unauthorized lead access
refactor: isolate email service
test: add authorization coverage
```

Bad:
```text
changes / fix / stuff / final / final-final
```

---

## 36. SMALL COMMITS

Prefer small logical commits over monolithic ones. This makes rollback and review much easier.

---

## 37. BRANCHING

Use branches for non-trivial features. Never work directly on the production branch without a plan.

Preferred flow: **Development → Testing → Staging → Production**

---

# PART IX: DOCUMENTATION

---

## 38. PROJECT DOCUMENTATION

Every project MUST contain:

| File | Purpose |
|---|---|
| `README.md` | How to set up, run, and use the project |
| `AGENTS.md` | AI operational instructions |
| `CODING_STANDARDS.md` | Universal engineering laws |
| `ARCHITECTURE.md` | Project-specific architecture and decisions |
| `CHANGELOG.md` | History of meaningful changes |

---

## 39. CHANGELOG

Every meaningful feature or architectural change should be recorded:
```text
## 2026-08-26
### Added
- Lead priority field
### Changed
- Follow-up architecture
### Fixed
- Lead visibility security policy
### Security
- Added direct API authorization tests
```

---

## 40. ARCHITECTURAL DECISION RECORDS

For important decisions, create records in `docs/decisions/`:
```text
001-use-postgresql.md
002-use-edge-functions-for-email.md
```

Each should explain: Problem, Options considered, Decision, Reason, Consequences. This prevents future AI agents from undoing intentional decisions.

---

## 41. AI HANDOFFS

Every AI agent should leave the project so another AI can continue. At the end of substantial work, document: what was built, what was changed, what was tested, what was NOT tested, known issues, and next steps. This information MUST live in the repository, not only in chat history.

---

# PART X: DEPLOYMENT & OPERATIONS

---

## 42. ENVIRONMENTS

Keep separate environments where practical (Development, Staging, Production). Never accidentally point development code at a production database. Clearly document environment configuration.

---

## 43. PRE-MERGE CHECKLIST

Before merging a significant change:

- **Functionality:** Requested feature works. Main workflow works. Edge cases handled.
- **Security:** Authentication checked. Authorization checked. Secrets protected. Direct API access tested.
- **Database:** Migration exists. Constraints considered. No accidental destructive operations.
- **Code:** Files appropriately sized. Responsibilities isolated. No duplicated logic. No unnecessary dependencies.
- **UX:** Loading state. Error state. Empty state. Success feedback. Responsive behavior considered.
- **Documentation:** README, Architecture, Changelog updated as needed.

---

## 44. PRODUCTION RELEASE CHECKLIST

Before production:
- [ ] Tests pass
- [ ] Build succeeds
- [ ] Migrations verified
- [ ] Environment variables configured
- [ ] Secrets secured and not exposed in frontend
- [ ] Authentication and authorization verified
- [ ] Backup strategy confirmed
- [ ] External integrations tested
- [ ] Rollback strategy understood

---

## 45. POST-DEPLOYMENT CHECK

After deployment, verify: login works, primary workflows work, database writes work, permissions work, and error logs are clean. Do not assume "Deployment succeeded" means "Application works."

---

## 46. ROLLBACK PRINCIPLE

Every significant production change should have a rollback plan. Before implementation, know: **If this breaks production, how do we undo it?** If the answer is unclear, the change is not ready.

---

## 47. BACKUPS

Before material database changes, verify backup availability and understand the restoration process. A backup that has never been tested is not a fully trusted backup.

---

# PART XI: ADDITIONAL STANDARDS

---

## 48. DEPENDENCY MANAGEMENT

Do not add a new library simply because it makes one task slightly easier. Before adding a dependency, consider: Is it necessary? Does an existing library solve this? Is it maintained? Does it introduce security risk or vendor lock-in?

---

## 49. UI CONSISTENCY

Create reusable components for common patterns (buttons, inputs, tables, modals, loading states, error states). Do not create multiple visually inconsistent versions of the same UI element.

---

## 50. DESIGN SYSTEM

Maintain centralized styling (colors, typography, spacing, etc.). AI agents must reuse the existing design system instead of inventing new styles for every feature.

---

## 51. ACCESSIBILITY

The application SHOULD support keyboard navigation, proper labels, focus states, sufficient contrast, and screen-reader-friendly semantics. Never use color alone to communicate important information.

---

## 52. RESPONSIVE DESIGN

Unless explicitly desktop-only, consider Desktop, Tablet, and Mobile. Do not merely shrink desktop layouts for small screens.

---

## 53. PERFORMANCE

Avoid unnecessary database queries, API calls, and re-renders. Large datasets should use pagination, server-side filtering, and appropriate indexing. Do not load thousands of records into the browser to filter them client-side.

---

## 54. STATE MANAGEMENT

Use the simplest state architecture that remains understandable. Do not introduce state management libraries unless genuinely needed.

---

## 55. DATA VALIDATION

Validate at multiple layers where appropriate: UI + Service + Database. Never rely on frontend validation alone for important business rules.

---

## 56. AUDITABILITY

Important changes to sensitive data should be traceable: who changed what, when, and from what to what.

---

## 57. LOGGING

Logs must contain enough information to diagnose failures without exposing sensitive data.

**Log these things:**
- Application startup and configuration (without secrets)
- Incoming requests — method, endpoint, user ID (not personal data), timestamp
- Database query failures and their context
- External API calls — service name, success/failure, response time
- Authentication events — login, logout, failed attempts (no passwords)
- Important state changes — record created, deleted, status changed
- Background job start, completion, and failure
- Any unhandled exception — with stack trace

**NEVER log:**
- Passwords or password hashes
- API keys or tokens
- Full credit card numbers or bank details
- Raw personal data beyond what is needed to identify a record
- Authentication tokens or session secrets

Use structured logs where possible (key/value pairs) so they can be searched and filtered easily.

---

## 58. PERSONAL DATA

Treat personal data (names, emails, phones, financial information) as sensitive. Do not expose it unnecessarily in logs, error messages, URLs, or debug screens.

---

## 59. COST AWARENESS

Consider infrastructure costs before implementing expensive operations. Do not create patterns where every page load triggers many API or AI calls when one would suffice.

---

## 60. VENDOR LOCK-IN

Where practical, isolate external services behind internal interfaces so providers can be replaced later. Maintain clear ownership of your database, code, and business data.

---

## 61. DATA EXPORTABILITY

Business data should be exportable where practical. Do not build systems where the only copy of critical data exists inside a vendor-specific UI.

---

## 62. BULK OPERATIONS

Bulk operations (mass delete, mass message, mass update) MUST be treated as high-risk. The UI should clearly show the impact and require explicit confirmation before proceeding.

---

## 63. DUPLICATE PREVENTION

Important external operations should be idempotent. A user clicking "Send" twice should not send a message twice. Use idempotency keys, unique provider IDs, or status checks where appropriate.

---

## 64. TECHNICAL DEBT REGISTER

If something is knowingly imperfect, document it so future developers and AI agents don't repeatedly rediscover the same problem:
```text
TD-001
Issue: Search uses basic pattern matching.
Impact: May slow above 100k records.
Priority: Medium.
Proposed solution: Full-text search index.
```

---

## 65. COMMUNICATION SYSTEMS

If the project sends messages to users (email, chat, SMS), track the full message lifecycle: Queued → Sent → Delivered → Failed. Do not simply record "message sent" and discard all other state.

---

## 66. NUMERICAL & FINANCIAL CALCULATION ACCURACY

For financial, numerical, scientific, or otherwise high-precision calculations, correctness is non-negotiable.

- Results MUST be verified using known test cases, boundary cases, and independently calculated expected results.
- Avoid floating-point arithmetic where it can materially affect correctness. Use appropriate decimal or integer precision handling.
- Precision errors must also be prevented at the **storage layer** — do not store a financial value as a float in the database when a decimal or integer is required.
- When the calculation methodology is complex, document it in `docs/` and reference it from `ARCHITECTURE.md`. Do not embed methodology assumptions silently in code.

---

## 67. DEEP DOCUMENTATION CONVENTION

For topics too detailed to belong in `ARCHITECTURE.md` (complex calculation methodology, detailed data models, testing strategy, integration specifications), create a dedicated file in `docs/` and reference it from `ARCHITECTURE.md`.

```text
docs/
├── calculation-methodology.md
├── data-model.md
└── testing-methodology.md
```

`ARCHITECTURE.md` should point to these files, not absorb their content. AI agents must follow the pointer and read the referenced file before modifying the relevant feature.

---


## 68. CODE COMMENTS & INLINE DOCUMENTATION

Code comments are documentation for the next person — human or AI — who opens the file. They must be maintained alongside the code.

**Comment on WHY, not WHAT.** The code already shows what it does. Comments should explain why it does it that way.

Good:
```text
// We use optimistic locking here because two users can edit the same
// lead simultaneously. Without this, the second save would silently
// overwrite the first without warning.
```

Bad:
```text
// Set the lock
```

**Rules for comments:**
- Every function or method with non-obvious logic MUST have a comment explaining its purpose and any important constraints.
- Every file MUST have a one-line comment at the top describing what the file is responsible for.
- Any workaround, edge-case fix, or temporary solution MUST have a comment explaining why it exists and what the proper solution would be.
- Do not leave commented-out code without an explanation of why it was left and when it can be removed.
- Do not add comments that merely repeat the function name in prose.

**AI agents must write comments as they write code.** Comments are not optional polish to be added later.

---

# MASTER RULE

> **Build small. Isolate features. Protect data. Document decisions. Test security. Preserve context. Make changes reversible. Never hide problems.**

If a choice exists between **fast but fragile** and **slightly slower but understandable, secure, and maintainable** — choose the latter.

The codebase should always be left in a state where **another competent human or AI can understand what exists, why it exists, safely modify it, and verify that they have not broken anything.**
