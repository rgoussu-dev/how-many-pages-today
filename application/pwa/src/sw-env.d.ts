// The service worker compiles without vite/client (it pulls in DOM types); declare the one
// build-time variable it reads.
interface ImportMetaEnv {
  readonly VITE_STAGE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
