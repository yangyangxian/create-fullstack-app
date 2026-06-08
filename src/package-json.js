function stringifyPackageJson(contents) {
  return JSON.stringify(contents, null, 2);
}

function rootPackageJson(packageName) {
  return stringifyPackageJson({
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
  });
}

function contractsPackageJson() {
  return stringifyPackageJson({
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
  });
}

function schemasPackageJson() {
  return stringifyPackageJson({
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
  });
}

function sharedPackageJson() {
  return stringifyPackageJson({
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
  });
}

function webPackageJson() {
  return stringifyPackageJson({
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
  });
}

function apiPackageJson(backend) {
  const dependencies =
    backend === 'hono'
      ? {
          '@hono/node-server': '^1.13.8',
          hono: '^4.6.15',
        }
      : {
          express: '^4.21.2',
        };

  const devDependencies =
    backend === 'hono'
      ? {
          '@types/node': '^22.10.2',
          tsx: '^4.19.2',
        }
      : {
          '@types/express': '^5.0.0',
          '@types/node': '^22.10.2',
          tsx: '^4.19.2',
        };

  return stringifyPackageJson({
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
    dependencies,
    devDependencies,
  });
}

export {
  apiPackageJson,
  contractsPackageJson,
  rootPackageJson,
  schemasPackageJson,
  sharedPackageJson,
  webPackageJson,
};
