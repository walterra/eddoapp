/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COUCHDB_API_KEY: string;
  readonly NODE_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
