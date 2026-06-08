# create-fullstack-app

`create-fullstack-app` is a CLI generator for scaffolding a single-app-first full-stack workspace.

## What it generates

- Frontend: **Vite + React Router**
- Backend choice:
  - **Hono** for a serverless-oriented backend
  - **Express** for a Node runtime backend
- Monorepo structure:

```text
apps/
  web/
  api/
packages/
  shared/
  contracts/
  schemas/
```

The generated backend serves the built frontend assets by default, while keeping frontend and backend apps explicit so they can still be deployed separately later.

## Usage

```bash
npx create-fullstack-app@latest my-app
```

You can also let the CLI prompt for the project name and backend selection:

```bash
npx create-fullstack-app@latest
```

Or pass the backend up front:

```bash
npx create-fullstack-app@latest my-app --backend hono
npx create-fullstack-app@latest my-app --backend express
```

## Development

```bash
npm test
```

For local debugging, use the fixed playground app in the repo-local `playground/` directory:

```bash
npm run playground:generate
npm run playground:install -- --backend express
npm run playground:dev -- --backend hono
```

The playground commands delete and regenerate that sandbox before each run, so you can iterate on generator templates without manually recreating a test app.
