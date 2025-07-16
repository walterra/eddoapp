/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_COUCHDB_API_KEY: string;
  readonly COUCHDB_DB_NAME: string;
  readonly COUCHDB_API_KEY: string;
  readonly VITE_COUCHDB_API_KEY: string;
  readonly NODE_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
