# ArchOS

ArchOS is a web-based engineering workspace for organizing technical projects, visual artifacts, and delivery workflows in one place.

The repository is an actively developed software project built with a modern TypeScript/React stack and Firebase-backed persistence.

## Highlights

- Project workspaces with structured engineering sections
- Interactive visual design workspace
- Project planning, requirements, and roadmap tracking
- Delivery and execution tracking
- Persistent project and visual-artifact state
- Authentication and owner-scoped data access
- Automated validation and security-rule testing

## Tech stack

| Area | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI | React 19 |
| Visual workspace | React Flow |
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
│   ├── canvas/
│   ├── dashboard/
│   ├── projects/
│   ├── domain/
│   └── login/
│
├── domain/
│   ├── architecture/
│   └── project/
│
└── lib/
    └── repositories/

tests/
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

### Run

```bash
npm run dev
```

Open `http://localhost:3000`.

### Production build

```bash
npm run build
```

### Tests

Focused tests can be run with Vitest:

```bash
npx vitest run
```

Firestore rules can be validated through the emulator:

```bash
npx firebase-tools emulators:exec --only firestore "npm run test:rules"
```

## Engineering workflow

Changes are developed through feature branches and validated with focused tests, linting, production builds, and Firestore security tests before merge.

## Project status

**Active development.**

Some functionality is still evolving as the project is developed and hardened.

## Author

**Neha Pattnayak**

- GitHub: https://github.com/Neha9826
- Project repository: https://github.com/Neha9826/arch-os

## License

This repository is currently maintained as a personal engineering project.
