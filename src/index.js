const fs = require('node:fs');
const path = require('node:path');
const { stdin: input, stdout: output } = require('node:process');
const { createInterface } = require('node:readline/promises');

const BACKENDS = {
  hono: {
    label: 'Hono (serverless-oriented)',
    description: 'Hono backend geared toward serverless-friendly apps.',
  },
  express: {
    label: 'Express (Node runtime)',
    description: 'Express backend for classic Node deployments.',
  },
};

function toPackageName(value) {
  let normalized = '';
  let previousWasDash = false;

  for (const character of value.trim().toLowerCase()) {
    const isAlphaNumeric =
      (character >= 'a' && character <= 'z') || (character >= '0' && character <= '9');

    if (isAlphaNumeric || character === '_') {
      normalized += character;
      previousWasDash = false;
      continue;
    }

    if (!previousWasDash) {
      normalized += '-';
      previousWasDash = true;
    }
  }

  return normalized.replace(/^-/, '').replace(/-$/, '');
}

function toTitle(value) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseArgs(argv) {
  const options = {};
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--backend' || token === '-b') {
      options.backend = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--backend=')) {
      options.backend = token.slice('--backend='.length);
      continue;
    }

    if (token === '--yes' || token === '-y') {
      options.yes = true;
      continue;
    }

    positionals.push(token);
  }

  if (positionals[0]) {
    options.projectName = positionals[0];
  }

  return options;
}

async function readPipedAnswers() {
  let buffer = '';

  for await (const chunk of input) {
    buffer += chunk;
  }

  return buffer.split(/\r?\n/);
}

async function promptForMissingOptions(options) {
  const resolved = { ...options };

  if (!input.isTTY) {
    const answers = await readPipedAnswers();
    let cursor = 0;

    if (!resolved.projectName) {
      output.write('Project name: ');
      resolved.projectName = (answers[cursor] ?? '').trim();
      if (resolved.projectName) {
        output.write(`${resolved.projectName}\n`);
      }
      cursor += 1;
    }

    if (!resolved.backend) {
      output.write('\nSelect a backend:\n');
      output.write('  1) Hono (serverless-oriented)\n');
      output.write('  2) Express (Node runtime)\n\n');
      output.write('Backend [1/2]: ');
      const choice = (answers[cursor] ?? '').trim();
      if (choice) {
        output.write(`${choice}\n`);
      }
      resolved.backend = choice === '2' ? 'express' : 'hono';
    }

    return resolved;
  }

  const rl = createInterface({ input, output });

  try {
    if (!resolved.projectName) {
      const answer = await rl.question('Project name: ');
      resolved.projectName = answer.trim();
    }

    if (!resolved.projectName) {
      throw new Error('Project name is required.');
    }

    if (!resolved.backend) {
      output.write('\nSelect a backend:\n');
      output.write('  1) Hono (serverless-oriented)\n');
      output.write('  2) Express (Node runtime)\n\n');
      const answer = await rl.question('Backend [1/2]: ');
      const choice = answer.trim();
      resolved.backend = choice === '2' ? 'express' : 'hono';
    }
  } finally {
    rl.close();
  }

  return resolved;
}

function validateOptions(options) {
  const backend = options.backend && options.backend.toLowerCase();
  const projectName = options.projectName && options.projectName.trim();
  const packageName = projectName ? toPackageName(path.basename(projectName)) : '';

  if (!projectName) {
    throw new Error('Project name is required.');
  }

  if (!packageName) {
    throw new Error('Project name must include letters or numbers.');
  }

  if (!BACKENDS[backend]) {
    throw new Error('Backend must be either "hono" or "express".');
  }

  return {
    projectName,
    packageName,
    backend,
  };
}

function ensureTargetDirectory(targetDirectory) {
  try {
    const stats = fs.statSync(targetDirectory);
    if (!stats.isDirectory()) {
      throw new Error(`Target path exists and is not a directory: ${targetDirectory}`);
    }

    const entries = fs.readdirSync(targetDirectory);
    if (entries.length > 0) {
      throw new Error(`Target directory is not empty: ${targetDirectory}`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      fs.mkdirSync(targetDirectory, { recursive: true });
      return;
    }

    throw error;
  }
}

function rootPackageJson(packageName) {
  return JSON.stringify(
    {
      name: packageName,
      private: true,
      version: '0.1.0',
      workspaces: ['apps/*', 'packages/*'],
      scripts: {
        dev: 'concurrently -n web,api -c cyan,green "npm run dev --workspace apps/web" "npm run dev --workspace apps/api"',
        'dev:web': 'npm run dev --workspace apps/web',
        'dev:api': 'npm run dev --workspace apps/api',
        build:
          'npm run build --workspace packages/contracts && npm run build --workspace packages/schemas && npm run build --workspace packages/shared && npm run build --workspace apps/web && npm run build --workspace apps/api',
        check:
          'npm run typecheck --workspace packages/contracts && npm run typecheck --workspace packages/schemas && npm run typecheck --workspace packages/shared && npm run typecheck --workspace apps/web && npm run typecheck --workspace apps/api',
      },
      devDependencies: {
        concurrently: '^9.0.1',
        typescript: '^5.8.3',
      },
      engines: {
        node: '>=18',
      },
    },
    null,
    2,
  );
}

function tsconfigBase() {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        forceConsistentCasingInFileNames: true,
      },
    },
    null,
    2,
  );
}

function workspaceTsconfig(include) {
  return JSON.stringify(
    {
      extends: '../../tsconfig.base.json',
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        outDir: 'dist',
        rootDir: 'src',
        declaration: true,
      },
      include,
    },
    null,
    2,
  );
}

function contractsPackageJson() {
  return JSON.stringify(
    {
      name: '@repo/contracts',
      private: true,
      version: '0.1.0',
      type: 'module',
      exports: {
        '.': './dist/index.js',
      },
      types: './dist/index.d.ts',
      scripts: {
        build: 'tsc -p tsconfig.json',
        typecheck: 'tsc --noEmit -p tsconfig.json',
      },
    },
    null,
    2,
  );
}

function contractsIndex(backend) {
  return `export type BackendKind = '${backend}';\n\nexport interface HealthResponse {\n  ok: true;\n  backend: BackendKind;\n  message: string;\n}\n`;
}

function schemasPackageJson() {
  return JSON.stringify(
    {
      name: '@repo/schemas',
      private: true,
      version: '0.1.0',
      type: 'module',
      exports: {
        '.': './dist/index.js',
      },
      types: './dist/index.d.ts',
      scripts: {
        build: 'tsc -p tsconfig.json',
        typecheck: 'tsc --noEmit -p tsconfig.json',
      },
    },
    null,
    2,
  );
}

function schemasIndex() {
  return `export const appShape = {\n  apps: ['web', 'api'],\n  packages: ['shared', 'contracts', 'schemas'],\n} as const;\n`;
}

function sharedPackageJson() {
  return JSON.stringify(
    {
      name: '@repo/shared',
      private: true,
      version: '0.1.0',
      type: 'module',
      exports: {
        '.': './dist/index.js',
      },
      types: './dist/index.d.ts',
      scripts: {
        build: 'tsc -p tsconfig.json',
        typecheck: 'tsc --noEmit -p tsconfig.json',
      },
    },
    null,
    2,
  );
}

function sharedIndex(projectName, backend) {
  return `export const appInfo = {\n  name: '${projectName}',\n  backend: '${backend}',\n  frontend: 'vite + react router',\n} as const;\n`;
}

function webPackageJson() {
  return JSON.stringify(
    {
      name: 'web',
      private: true,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
        typecheck: 'tsc --noEmit -p tsconfig.json',
      },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
        'react-router-dom': '^6.30.1',
      },
      devDependencies: {
        '@types/react': '^18.3.12',
        '@types/react-dom': '^18.3.1',
        '@vitejs/plugin-react': '^4.3.4',
        vite: '^5.4.11',
      },
    },
    null,
    2,
  );
}

function webTsconfig() {
  return JSON.stringify(
    {
      extends: '../../tsconfig.base.json',
      compilerOptions: {
        jsx: 'react-jsx',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        noEmit: true,
        types: ['vite/client'],
      },
      include: ['src', 'vite.config.ts'],
    },
    null,
    2,
  );
}

function viteConfig() {
  return `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n  server: {\n    port: 5173,\n    proxy: {\n      '/api': {\n        target: 'http://localhost:3000',\n        changeOrigin: true,\n      },\n    },\n  },\n});\n`;
}

function indexHtml(title) {
  return `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${title}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`;
}

function webMain() {
  return `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport { App } from './app';\nimport './styles.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n);\n`;
}

function webApp(projectName, backend) {
  return `import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';\nimport { useEffect, useState } from 'react';\n\ninterface HealthResponse {\n  ok: boolean;\n  backend: string;\n  message: string;\n}\n\nfunction Home() {\n  const [health, setHealth] = useState<HealthResponse | null>(null);\n  const [error, setError] = useState<string | null>(null);\n\n  useEffect(() => {\n    fetch('/api/health')\n      .then(async (response) => {\n        if (!response.ok) {\n          throw new Error('Request failed');\n        }\n\n        return response.json() as Promise<HealthResponse>;\n      })\n      .then(setHealth)\n      .catch(() => setError('API is not reachable yet. Start the backend to see live status.'));\n  }, []);\n\n  return (\n    <main className="layout">\n      <section className="hero">\n        <p className="eyebrow">create-fullstack-app</p>\n        <h1>${toTitle(projectName)}</h1>\n        <p>\n          Single-app-first full-stack template with Vite + React Router on the frontend and ${BACKENDS[backend].label}.\n        </p>\n      </section>\n\n      <section className="card-grid">\n        <article className="card">\n          <h2>Architecture</h2>\n          <ul>\n            <li>apps/web for the frontend</li>\n            <li>apps/api for the backend</li>\n            <li>packages/shared for shared utilities</li>\n            <li>packages/contracts for API contracts</li>\n            <li>packages/schemas for shared validation</li>\n          </ul>\n        </article>\n\n        <article className="card">\n          <h2>Backend</h2>\n          <p>${BACKENDS[backend].description}</p>\n          <p>{health ? health.message : error ?? 'Waiting for /api/health...'}</p>\n        </article>\n      </section>\n\n      <nav className="nav">\n        <Link to="/">Home</Link>\n        <Link to="/about">About</Link>\n      </nav>\n    </main>\n  );\n}\n\nfunction About() {\n  return (\n    <main className="layout">\n      <section className="hero">\n        <p className="eyebrow">About this starter</p>\n        <h1>One repo, one app by default</h1>\n        <p>\n          The backend serves the built frontend in production, while local development keeps the frontend and backend workflows explicit.\n        </p>\n      </section>\n    </main>\n  );\n}\n\nexport function App() {\n  return (\n    <BrowserRouter>\n      <Routes>\n        <Route path="/" element={<Home />} />\n        <Route path="/about" element={<About />} />\n      </Routes>\n    </BrowserRouter>\n  );\n}\n`;
}

function webStyles() {
  return `:root {\n  color-scheme: light dark;\n  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;\n  line-height: 1.5;\n  font-weight: 400;\n  background: #0f172a;\n  color: #e2e8f0;\n}\n\n* {\n  box-sizing: border-box;\n}\n\nbody {\n  margin: 0;\n  min-width: 320px;\n  min-height: 100vh;\n  background: radial-gradient(circle at top, #1e293b, #0f172a 55%);\n}\n\na {\n  color: inherit;\n}\n\n.layout {\n  max-width: 960px;\n  margin: 0 auto;\n  padding: 3rem 1.5rem 4rem;\n}\n\n.hero {\n  margin-bottom: 2rem;\n}\n\n.eyebrow {\n  text-transform: uppercase;\n  letter-spacing: 0.14em;\n  font-size: 0.8rem;\n  color: #38bdf8;\n}\n\n.card-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));\n  gap: 1rem;\n}\n\n.card {\n  padding: 1.25rem;\n  border-radius: 1rem;\n  background: rgba(15, 23, 42, 0.8);\n  border: 1px solid rgba(148, 163, 184, 0.22);\n}\n\n.card h2 {\n  margin-top: 0;\n}\n\n.nav {\n  display: flex;\n  gap: 1rem;\n  margin-top: 2rem;\n}\n`;
}

function apiPackageJson(backend) {
  if (backend === 'hono') {
    return JSON.stringify(
      {
        name: 'api',
        private: true,
        version: '0.1.0',
        type: 'module',
        scripts: {
          dev: 'tsx watch src/index.ts',
          build: 'tsc -p tsconfig.json',
          start: 'node dist/index.js',
          typecheck: 'tsc --noEmit -p tsconfig.json',
        },
        dependencies: {
          '@hono/node-server': '^1.13.8',
          hono: '^4.6.15',
        },
        devDependencies: {
          '@types/node': '^22.10.2',
          tsx: '^4.19.2',
        },
      },
      null,
      2,
    );
  }

  return JSON.stringify(
    {
      name: 'api',
      private: true,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'tsx watch src/index.ts',
        build: 'tsc -p tsconfig.json',
        start: 'node dist/index.js',
        typecheck: 'tsc --noEmit -p tsconfig.json',
      },
      dependencies: {
        express: '^4.21.2',
      },
      devDependencies: {
        '@types/express': '^5.0.0',
        '@types/node': '^22.10.2',
        tsx: '^4.19.2',
      },
    },
    null,
    2,
  );
}

function apiTsconfig() {
  return JSON.stringify(
    {
      extends: '../../tsconfig.base.json',
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        outDir: 'dist',
        rootDir: 'src',
      },
      include: ['src'],
    },
    null,
    2,
  );
}

function expressServer(projectName) {
  return `import express from 'express';\nimport path from 'node:path';\nimport { fileURLToPath } from 'node:url';\nimport fs from 'node:fs';\n\nconst __filename = fileURLToPath(import.meta.url);\nconst __dirname = path.dirname(__filename);\nconst app = express();\nconst port = Number(process.env.PORT ?? 3000);\nconst webDist = path.resolve(__dirname, '../../web/dist');\nconst indexHtml = path.join(webDist, 'index.html');\n\napp.get('/api/health', (_req, res) => {\n  res.json({\n    ok: true,\n    backend: 'express',\n    message: '${projectName} is running with an Express backend.',\n  });\n});\n\nif (fs.existsSync(webDist)) {\n  app.use(express.static(webDist));\n\n  app.get('*', (req, res) => {\n    if (req.path.startsWith('/api/')) {\n      res.status(404).json({ ok: false, message: 'Not found' });\n      return;\n    }\n\n    res.sendFile(indexHtml);\n  });\n} else {\n  app.get('/', (_req, res) => {\n    res.type('text/plain').send('Frontend assets are not built yet. Run "npm run build --workspace apps/web" or "npm run dev".');\n  });\n}\n\napp.listen(port, () => {\n  console.log(\`API server listening on http://localhost:\${port}\`);\n});\n`;
}

function honoServer(projectName) {
  return `import { serve } from '@hono/node-server';\nimport { Hono } from 'hono';\nimport fs from 'node:fs/promises';\nimport path from 'node:path';\nimport { fileURLToPath } from 'node:url';\n\nconst __filename = fileURLToPath(import.meta.url);\nconst __dirname = path.dirname(__filename);\nconst app = new Hono();\nconst port = Number(process.env.PORT ?? 3000);\nconst webDist = path.resolve(__dirname, '../../web/dist');\nconst contentTypes: Record<string, string> = {\n  '.css': 'text/css; charset=utf-8',\n  '.html': 'text/html; charset=utf-8',\n  '.js': 'text/javascript; charset=utf-8',\n  '.json': 'application/json; charset=utf-8',\n  '.svg': 'image/svg+xml',\n};\n\napp.get('/api/health', (c) => {\n  return c.json({\n    ok: true,\n    backend: 'hono',\n    message: '${projectName} is running with a Hono backend.',\n  });\n});\n\napp.get('*', async (c) => {\n  if (c.req.path.startsWith('/api/')) {\n    return c.json({ ok: false, message: 'Not found' }, 404);\n  }\n\n  const requestPath = c.req.path === '/' ? '/index.html' : c.req.path;\n  const assetPath = path.join(webDist, requestPath);\n  const contentType = contentTypes[path.extname(assetPath)] ?? 'application/octet-stream';\n\n  try {\n    const file = await fs.readFile(assetPath);\n    return new Response(file, {\n      headers: {\n        'Content-Type': contentType,\n      },\n    });\n  } catch {\n    const indexPath = path.join(webDist, 'index.html');\n\n    try {\n      const html = await fs.readFile(indexPath, 'utf8');\n      return c.html(html);\n    } catch {\n      return c.text('Frontend assets are not built yet. Run "npm run build --workspace apps/web" or "npm run dev".', 200);\n    }\n  }\n});\n\nserve({\n  fetch: app.fetch,\n  port,\n}, () => {\n  console.log(\`API server listening on http://localhost:\${port}\`);\n});\n`;
}

function generatedReadme(projectName, backend) {
  return `# ${projectName}\n\nGenerated by \`create-fullstack-app\`.\n\n## Stack\n\n- Frontend: Vite + React Router\n- Backend: ${BACKENDS[backend].label}\n- Architecture: single-app-first monorepo\n\n## Structure\n\n\`\`\`text\napps/\n  web/\n  api/\npackages/\n  shared/\n  contracts/\n  schemas/\n\`\`\`\n\n## Scripts\n\n- \`npm install\`\n- \`npm run dev\` to run the frontend and backend together\n- \`npm run build\` to build shared packages, web, and api\n- \`npm run check\` to run TypeScript checks across the workspace\n`;
}

function generatedGitignore() {
  return `node_modules/\ndist/\n.vite/\n.env\n.env.*\n`;
}

function buildTemplateFiles({ projectName, packageName, backend }) {
  const title = toTitle(projectName);

  return {
    '.gitignore': generatedGitignore(),
    'README.md': generatedReadme(projectName, backend),
    'package.json': rootPackageJson(packageName),
    'tsconfig.base.json': tsconfigBase(),
    'apps/web/package.json': webPackageJson(),
    'apps/web/tsconfig.json': webTsconfig(),
    'apps/web/vite.config.ts': viteConfig(),
    'apps/web/index.html': indexHtml(title),
    'apps/web/src/main.tsx': webMain(),
    'apps/web/src/app.tsx': webApp(projectName, backend),
    'apps/web/src/styles.css': webStyles(),
    'apps/api/package.json': apiPackageJson(backend),
    'apps/api/tsconfig.json': apiTsconfig(),
    'apps/api/src/index.ts': backend === 'hono' ? honoServer(projectName) : expressServer(projectName),
    'packages/contracts/package.json': contractsPackageJson(),
    'packages/contracts/tsconfig.json': workspaceTsconfig(['src']),
    'packages/contracts/src/index.ts': contractsIndex(backend),
    'packages/schemas/package.json': schemasPackageJson(),
    'packages/schemas/tsconfig.json': workspaceTsconfig(['src']),
    'packages/schemas/src/index.ts': schemasIndex(),
    'packages/shared/package.json': sharedPackageJson(),
    'packages/shared/tsconfig.json': workspaceTsconfig(['src']),
    'packages/shared/src/index.ts': sharedIndex(projectName, backend),
  };
}

function writeTemplateFiles(targetDirectory, files) {
  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(targetDirectory, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents, 'utf8');
  }
}

function generateProject(targetDirectory, options) {
  const resolved = validateOptions(options);
  ensureTargetDirectory(targetDirectory);
  const files = buildTemplateFiles(resolved);
  writeTemplateFiles(targetDirectory, files);
  return resolved;
}

async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const prompted = args.yes ? args : await promptForMissingOptions(args);
  const resolved = validateOptions(prompted);
  const targetDirectory = path.resolve(process.cwd(), resolved.projectName);

  await generateProject(targetDirectory, resolved);

  output.write(`\nCreated ${resolved.projectName} with ${BACKENDS[resolved.backend].label}.\n`);
  output.write(`Next steps:\n  cd ${resolved.projectName}\n  npm install\n  npm run dev\n`);
}

module.exports = {
  BACKENDS,
  buildTemplateFiles,
  generateProject,
  parseArgs,
  promptForMissingOptions,
  runCli,
  toPackageName,
  validateOptions,
};
