/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NODE_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
