import PouchDB from 'pouchdb-browser';
import PouchFind from 'pouchdb-find';
import { createSafeDbOperations } from '../../packages/web-client/src/api/safe-db-operations';
import { ensureDesignDocuments } from '../../packages/web-client/src/database_setup';
import {
  createRemoteAttachmentsDb,
  createRemoteDb,
} from '../../packages/web-client/src/hooks/use_couchdb_sync_helpers';

PouchDB.plugin(PouchFind);

interface BootstrapState {
  stage: string;
  docs: number;
  total: number;
  elapsedMs: number;
  done: boolean;
  error?: string;
}

interface SyntheticToken {
  token: string;
}

declare global {
  interface Window {
    __eddoBootstrap: BootstrapState;
  }
}

const started = performance.now();
window.__eddoBootstrap = {
  stage: 'authenticating synthetic account',
  docs: 0,
  total: 0,
  elapsedMs: 0,
  done: false,
};

/** Updates the visible preparation status without mounting the application. */
function displayProgress(): void {
  window.__eddoBootstrap.elapsedMs = performance.now() - started;
  const element = document.getElementById('progress');
  if (element) element.textContent = JSON.stringify(window.__eddoBootstrap, null, 2);
}

/** Authenticates only the disposable synthetic account. */
async function login(): Promise<SyntheticToken> {
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'benchmark', password: 'synthetic-benchmark-password' }),
  });
  if (!response.ok) throw new Error('Synthetic bootstrap login failed');
  const token: SyntheticToken = await response.json();
  localStorage.setItem('authToken', JSON.stringify(token));
  sessionStorage.setItem('eddoBenchmark', 'true');
  const params = new URLSearchParams(location.search);
  sessionStorage.setItem('eddoBenchmarkTelemetry', String(params.get('telemetry') === '1'));
  sessionStorage.setItem('eddoBenchmarkRunId', params.get('runId') ?? 'unknown');
  sessionStorage.setItem('eddoBenchmarkScenario', params.get('scenario') ?? 'control');
  return token;
}

/** Creates replication checkpoints before mounting the measured application. */
async function prepare(): Promise<void> {
  const token = await login();
  const local = new PouchDB('eddo_user_benchmark', { revs_limit: 5, auto_compaction: true });
  const remote = createRemoteDb(token.token);
  const attachments = new PouchDB('eddo_attachments_benchmark', {
    revs_limit: 3,
    auto_compaction: true,
  });
  const remoteAttachments = createRemoteAttachmentsDb(token.token);
  try {
    const info = await remote.info();
    window.__eddoBootstrap.total = info.doc_count;
    window.__eddoBootstrap.stage = 'preparing local database; application not mounted';
    displayProgress();
    await local.replicate
      .from(remote, { batch_size: 500, batches_limit: 1 })
      .on('change', (change) => {
        window.__eddoBootstrap.docs = change.docs_written;
        displayProgress();
      });
    window.__eddoBootstrap.stage = 'preparing production design documents and indexes';
    displayProgress();
    await ensureDesignDocuments(createSafeDbOperations(local), local);
    window.__eddoBootstrap.stage = 'establishing replication checkpoints';
    displayProgress();
    await local.replicate.to(remote, { batch_size: 500, batches_limit: 1 });
    await attachments.replicate.from(remoteAttachments, { batch_size: 500, batches_limit: 1 });
    await attachments.replicate.to(remoteAttachments, { batch_size: 500, batches_limit: 1 });
  } finally {
    await Promise.all([
      local.close(),
      remote.close(),
      attachments.close(),
      remoteAttachments.close(),
    ]);
  }
  window.__eddoBootstrap.stage = 'local database prepared';
  window.__eddoBootstrap.done = true;
  displayProgress();
}

prepare().catch((error) => {
  window.__eddoBootstrap.error = error instanceof Error ? error.message : 'Bootstrap failed';
  window.__eddoBootstrap.stage = 'failed';
  displayProgress();
});
