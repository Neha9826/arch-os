# ArchOS

**ArchOS is a cloud architecture engineering workspace for designing, reviewing, versioning, and executing system architecture decisions.**

It combines an interactive architecture canvas with persistent architecture history, semantic diffs, branching and pull requests, deterministic architecture health analysis, project engineering workflows, and execution tracking.

> Built as a production-oriented portfolio SaaS by **Neha Pattnayak**.

## Why ArchOS?

Architecture diagrams are often disconnected from the engineering work that follows them.

ArchOS is designed to keep these concerns connected:

```text
Architecture
    ↓
Design + Canvas
    ↓
History + Snapshots
    ↓
Branches + Pull Requests
    ↓
Health + Review
    ↓
Engineering Sections
    ↓
Execution Tasks
```

The goal is to make architecture a persistent engineering artifact rather than a static diagram.

## Current capabilities

### Architecture canvas

- Interactive architecture design with React Flow
- Custom architecture components and relations
- Persistent architecture state
- Architecture-aware React Flow conversion
- Support for application, service, database, cache, queue, storage, API, gateway, client, external-system, and generic components
- Relationship types including HTTP, gRPC, GraphQL, events, messages, database access, dependencies, reads, and writes

### Architecture history

- Immutable architecture commits
- Snapshots with saved architecture IR and canvas layout
- Main-branch history
- Commit history and read-only previews
- Restore a historical commit as the working state
- Semantic architecture diffs
- Component and relation additions, removals, and modifications
- Canvas/layout change detection

Semantic diffs intentionally focus on architecture meaning rather than transient canvas positioning and styling.

### Branching and pull requests

ArchOS models architecture changes with a Git-like workflow:

```text
Main
 │
 ├── feature branch
 │       │
 │       └── architecture changes
 │
 └── Pull Request
          │
          └── review → merge
```

The merge lifecycle is transactionally protected:

- Branches are created from architecture snapshots
- Branch base snapshots are immutable
- Main changes are checked before branch merge
- Merged branches become terminal
- Pull requests cannot claim `merged` independently
- A pull request becomes merged only in the same transaction that merges its linked architecture branch

### Architecture health

ArchOS includes a deterministic architecture health engine.

It reports:

- Health score from 0–100
- Status: `healthy`, `good`, `needs-attention`, or `critical`
- Component count
- Relation count
- Connected components
- Isolated components
- Maximum incoming relations
- Maximum outgoing relations
- Lint findings and severity counts

The current score is intentionally explainable: it is derived from the architecture lint findings rather than an opaque heuristic.

### Project engineering model

Projects are organized into canonical engineering sections:

1. Planning
2. Requirements
3. Roadmap
4. Design
5. Architecture
6. API
7. Database
8. Infrastructure
9. Code
10. Testing
11. Documentation

Section state is persisted as:

- `not-started`
- `in-progress`
- `complete`

### Project execution

Execution tasks connect engineering planning to delivery.

Tasks support:

- Title and description
- Priority: low / medium / high / critical
- Status: todo / in-progress / blocked / done
- Engineering section association
- Source reference
- Due date
- Search
- Status filtering
- Priority filtering
- Section filtering
- Editing
- Deletion

Execution data is scoped to the owning project and protected by Firestore rules.

## Security model

Security is treated as a product requirement rather than a final checklist item.

The application uses:

- Firebase Authentication
- Firestore owner-scoped access control
- Workspace ownership checks
- Architecture ownership checks
- Project ownership checks
- Strict identity-field protection
- Immutable architecture history
- Terminal branch-state protection
- Transactional commit/head invariants
- Transactional branch/PR merge invariants
- Strict Firestore field validation
- Security rules tests using the Firebase Rules Unit Testing SDK

### Current security validation

The repository includes focused Firestore security coverage for:

- Workspaces
- Architectures
- Architecture branches
- Architecture commits
- Architecture snapshots
- Architecture pull requests
- Project execution tasks

## Engineering approach

ArchOS is developed as a domain-oriented application rather than putting all business rules inside UI components.

Important domain areas include:

```text
src/domain/
├── architecture/
│   ├── branches.ts
│   ├── commits.ts
│   ├── diff.ts
│   ├── lint.ts
│   ├── pullRequests.ts
│   ├── reactFlowAdapter.ts
│   ├── types.ts
│   └── validation.ts
└── project/
    └── types.ts
```

Persistence is isolated behind repository modules:

```text
src/lib/repositories/
├── architectureBranches.ts
├── architecturePullRequests.ts
└── projectExecution.ts
```

This keeps domain invariants testable independently from the UI and makes security-sensitive workflows explicit.

## Tech stack

| Area | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI | React 19 |
| Architecture canvas | React Flow |
| State | Zustand |
| Backend / persistence | Firebase |
| Database | Cloud Firestore |
| Authentication | Firebase Authentication |
| Styling | Tailwind CSS |
| Testing | Vitest |
| Security testing | Firebase Rules Unit Testing |

## Project structure

```text
src/
├── app/
│   ├── canvas/[id]/
│   ├── dashboard/
│   ├── projects/
│   │   ├── [id]/
│   │   └── [id]/execution/
│   └── login/
│
├── domain/
│   ├── architecture/
│   └── project/
│
└── lib/
    └── repositories/

tests/
├── architecture.lint.test.ts
├── architecture.pullRequests.test.ts
└── firestore.rules.test.ts
```

## Local development

### Requirements

- Node.js
- npm
- Firebase CLI

### Install

```bash
npm install
```

### Run development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### Run the production build

```bash
npm run build
```

### Run Firestore security tests

Start the Firestore emulator when required:

```bash
firebase emulators:start --only firestore
```

Then run:

```bash
npm run test:rules
```

Architecture-specific tests can be run with:

```bash
npx vitest run tests/architecture.lint.test.ts
npx vitest run tests/architecture.pullRequests.test.ts
```

## Engineering validation

Every substantial feature is expected to go through:

```text
Feature branch
    ↓
Domain implementation
    ↓
Repository / persistence changes
    ↓
Security rules
    ↓
Focused tests
    ↓
Full security-rule suite
    ↓
Production build
    ↓
Pull Request
    ↓
Merge
```

The repository intentionally keeps feature branches after merge as historical development pointers.

## Roadmap

The product is actively evolving. Planned areas include:

- More advanced architecture review and analysis
- Richer architecture-to-project traceability
- Deeper execution planning
- Expanded collaboration workflows
- Infrastructure/export workflows
- AI-assisted architecture workflows
- Improved documentation and project-level visibility
- Additional production hardening and observability

Roadmap items are intentionally listed separately from implemented functionality.

## Project status

**Active development.**

Implemented capabilities are continuously validated with automated tests and production builds. Some roadmap capabilities remain experimental or planned and should not be considered production functionality yet.

## Author

**Neha Pattnayak**  
Senior Full Stack Engineer · Founder & Lead Full Stack Engineer, Dev Engine AI

- GitHub: https://github.com/Neha9826
- ArchOS: https://github.com/Neha9826/arch-os

## License

This repository is currently maintained as a personal engineering project and portfolio application.
