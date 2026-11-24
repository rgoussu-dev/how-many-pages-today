/// <reference types="vite/client" />
// planks publishes its tokens as a CSS-only subpath export without the .css extension;
// TypeScript 7 checks side-effect imports, so declare it.
declare module '@rgoussu.dev/planks/tokens';
