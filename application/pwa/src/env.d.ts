/// <reference types="vite/client" />
// planks publishes its tokens as a CSS-only subpath export without the .css extension;
// TypeScript 7 checks side-effect imports, so declare it.
declare module '@rgoussu.dev/planks/tokens';

interface ImportMetaEnv {
  /** Set for a staging build (`VITE_STAGE=staging`); unset in production. */
  readonly VITE_STAGE?: string;
}
