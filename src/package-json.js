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
      concurrently: '^10.0.3',
      typescript: '^6.0.3',
    },
    engines: {
      node: '>=22.12.0',
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
      react: '^19.2.7',
      'react-dom': '^19.2.7',
      'react-router-dom': '^7.17.0',
    },
    devDependencies: {
      '@types/react': '^19.2.17',
      '@types/react-dom': '^19.2.3',
      '@vitejs/plugin-react': '^6.0.2',
      vite: '^8.0.16',
    },
  });
}

function apiPackageJson(backend) {
  const dependencies =
    backend === 'hono'
      ? {
          '@hono/node-server': '^2.0.4',
          hono: '^4.12.24',
        }
      : {
          express: '^5.2.1',
        };

  const devDependencies =
    backend === 'hono'
      ? {
          '@types/node': '^25.9.2',
          tsx: '^4.22.4',
        }
      : {
          '@types/express': '^5.0.6',
          '@types/node': '^25.9.2',
          tsx: '^4.22.4',
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
