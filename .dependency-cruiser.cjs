/**
 * The architecture's walls. The npm workspace and TypeScript project setup do NOT stop a
 * package importing a sibling it never declared (npm symlinks every member into
 * node_modules), and a relative path walks straight past an `exports` map. These rules
 * are the only thing holding the layering — treat them as load-bearing.
 *
 * Paths below are *resolved* paths: `@hmpt/*` specifiers resolve through the workspace
 * symlinks back to their source directories (see options.enhancedResolveOptions — without
 * it every workspace import is "unknown" and every rule passes green over a broken tree).
 */
const PACKAGE = '(platform/[^/]+|domain/[^/]+|user-side/[^/]+|infra/[^/]+|design-system|application/[^/]+)';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-unresolvable',
      severity: 'error',
      comment: 'An import that does not resolve means the resolver is misconfigured — and then every other rule is blind.',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'platform-is-the-bottom',
      severity: 'error',
      comment: 'platform/ is shared by everyone and depends on no layer above it.',
      from: { path: '^platform/' },
      to: { path: '^(domain|user-side|infra|design-system|application)/' },
    },
    {
      name: 'contract-depends-on-kernel-only',
      severity: 'error',
      comment: 'The contract face is the most stable thing in the repository.',
      from: { path: '^domain/contract/' },
      to: { path: '^(domain/core|platform/commons|user-side|infra|design-system|application)/' },
    },
    {
      name: 'core-depends-on-contract-and-kernel-only',
      severity: 'error',
      comment: 'The hexagon knows nothing of adapters, the design system or the shell.',
      from: { path: '^domain/core/' },
      to: { path: '^(platform/commons|user-side|infra|design-system|application)/' },
    },
    {
      name: 'only-the-assembly-sees-the-core',
      severity: 'error',
      comment: 'Adapters reach the domain through its contract; only application/ wires the core.',
      from: { pathNot: '^(domain/core|application)/' },
      to: { path: '^domain/core/' },
    },
    {
      name: 'driving-adapters-never-import-driven-ones',
      severity: 'error',
      from: { path: '^user-side/' },
      to: { path: '^(infra|application)/' },
    },
    {
      name: 'driven-adapters-stay-driven',
      severity: 'error',
      comment: 'infra implements domain ports; it never reaches the UI, the shell or another adapter.',
      from: { path: '^infra/' },
      to: { path: '^(user-side|design-system|application)/' },
    },
    {
      name: 'infra-adapters-are-independent',
      severity: 'error',
      from: { path: '^infra/([^/]+)/' },
      to: { path: '^infra/', pathNot: '^infra/$1/' },
    },
    {
      name: 'design-system-is-domain-blind',
      severity: 'error',
      comment: 'Atoms, molecules and the card illustration never know a port exists.',
      from: { path: '^design-system/' },
      to: { path: '^(domain|user-side|infra|application|platform/commons)/' },
    },
    {
      name: 'no-relative-escape',
      severity: 'error',
      comment: 'A relative path out of a package bypasses its exports map. Cross-package imports use @hmpt/* specifiers.',
      from: { path: `^${PACKAGE}/` },
      to: { dependencyTypes: ['local'], pathNot: `^$1/` },
    },
    {
      name: 'tests-and-fakes-stay-out-of-production',
      severity: 'error',
      comment: "The domain's in-memory fakes are for tests and previews, never for a shipped adapter.",
      from: { pathNot: '(\\.test\\.ts$|^domain/core/src/testing/)' },
      to: { path: '^domain/core/src/testing/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|test-results|playwright-report)/' },
    parser: 'swc', // TypeScript 7.0's API lacks what the tsc parser needs
    tsPreCompilationDeps: true,
    combinedDependencies: false,
    tsConfig: { fileName: 'tsconfig.tests.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'default', 'types'],
      extensions: ['.ts', '.js', '.mjs', '.json', '.css'],
      mainFields: ['module', 'main', 'types'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
