/**
 * SearXNG container manager for web search functionality.
 * Ensures SearXNG is running on the eddo-chat network before agent containers start.
 */

import Docker from 'dockerode';

import { DEFAULT_NETWORK_NAME, DOCKER_PROJECT_NAME } from './container-utils';

const SEARXNG_CONTAINER_NAME = 'searxng';
const SEARXNG_IMAGE = 'docker.io/searxng/searxng:latest';
const SEARXNG_PORT = 8080;

interface SearxngManagerContext {
  docker: Docker;
}

/** Create a SearXNG manager instance */
export function createSearxngManager(docker?: Docker) {
  const ctx: SearxngManagerContext = {
    docker: docker ?? new Docker(),
  };

  return {
    isRunning: () => isRunning(ctx),
    ensureRunning: () => ensureRunning(ctx),
    getStatus: () => getStatus(ctx),
  };
}

/** Check if SearXNG container is running */
async function isRunning(ctx: SearxngManagerContext): Promise<boolean> {
  try {
    const containers = await ctx.docker.listContainers({
      filters: { name: [SEARXNG_CONTAINER_NAME], status: ['running'] },
    });
    return containers.some((c) => c.Names.includes(`/${SEARXNG_CONTAINER_NAME}`));
  } catch {
    return false;
  }
}

/** Get SearXNG container status */
async function getStatus(
  ctx: SearxngManagerContext,
): Promise<{ exists: boolean; running: boolean; onNetwork: boolean }> {
  try {
    const allContainers = await ctx.docker.listContainers({
      all: true,
      filters: { name: [SEARXNG_CONTAINER_NAME] },
    });

    const container = allContainers.find((c) => c.Names.includes(`/${SEARXNG_CONTAINER_NAME}`));

    if (!container) {
      return { exists: false, running: false, onNetwork: false };
    }

    const running = container.State === 'running';
    const onNetwork = container.NetworkSettings?.Networks?.[DEFAULT_NETWORK_NAME] !== undefined;

    return { exists: true, running, onNetwork };
  } catch {
    return { exists: false, running: false, onNetwork: false };
  }
}

/** Ensure the eddo-chat network exists */
async function ensureNetwork(ctx: SearxngManagerContext): Promise<boolean> {
  try {
    const networks = await ctx.docker.listNetworks({
      filters: { name: [DEFAULT_NETWORK_NAME] },
    });
    const exists = networks.some((n) => n.Name === DEFAULT_NETWORK_NAME);

    if (!exists) {
      await ctx.docker.createNetwork({
        Name: DEFAULT_NETWORK_NAME,
        Driver: 'bridge',
      });
    }
    return true;
  } catch {
    return false;
  }
}

/** Start existing SearXNG container */
async function startExistingContainer(ctx: SearxngManagerContext): Promise<boolean> {
  try {
    const container = ctx.docker.getContainer(SEARXNG_CONTAINER_NAME);
    await container.start();
    return true;
  } catch {
    return false;
  }
}

/** Connect container to eddo-chat network */
async function connectToNetwork(ctx: SearxngManagerContext): Promise<boolean> {
  try {
    const network = ctx.docker.getNetwork(DEFAULT_NETWORK_NAME);
    await network.connect({ Container: SEARXNG_CONTAINER_NAME });
    return true;
  } catch (error: unknown) {
    // Already connected is fine
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('already exists')) return true;
    return false;
  }
}

/** Create and start SearXNG container */
async function createAndStartContainer(ctx: SearxngManagerContext): Promise<boolean> {
  try {
    // Pull image first
    const stream = await ctx.docker.pull(SEARXNG_IMAGE);
    await new Promise<void>((resolve, reject) => {
      ctx.docker.modem.followProgress(stream, (err) => (err ? reject(err) : resolve()));
    });

    // Create container with Docker Compose project labels for grouping
    const container = await ctx.docker.createContainer({
      name: SEARXNG_CONTAINER_NAME,
      Image: SEARXNG_IMAGE,
      ExposedPorts: { '8080/tcp': {} },
      Labels: {
        'com.docker.compose.project': DOCKER_PROJECT_NAME,
        'com.docker.compose.service': 'searxng',
      },
      HostConfig: {
        NetworkMode: DEFAULT_NETWORK_NAME,
        PortBindings: { '8080/tcp': [{ HostPort: String(SEARXNG_PORT) }] },
        RestartPolicy: { Name: 'unless-stopped' },
      },
      Env: [
        // Minimal config to enable JSON API
        'SEARXNG_SETTINGS_PATH=/etc/searxng/settings.yml',
      ],
    });

    await container.start();
    return true;
  } catch {
    return false;
  }
}

/** Handle running container not on network */
async function handleRunningNotOnNetwork(
  ctx: SearxngManagerContext,
): Promise<{ success: boolean; error?: string }> {
  const connected = await connectToNetwork(ctx);
  return connected
    ? { success: true }
    : { success: false, error: 'Failed to connect SearXNG to eddo-chat network' };
}

/** Handle stopped container */
async function handleStoppedContainer(
  ctx: SearxngManagerContext,
): Promise<{ success: boolean; error?: string }> {
  const started = await startExistingContainer(ctx);
  if (!started) {
    return { success: false, error: 'Failed to start existing SearXNG container' };
  }
  const newStatus = await getStatus(ctx);
  if (!newStatus.onNetwork) {
    await connectToNetwork(ctx);
  }
  return { success: true };
}

/** Handle missing container */
async function handleMissingContainer(
  ctx: SearxngManagerContext,
): Promise<{ success: boolean; error?: string }> {
  const created = await createAndStartContainer(ctx);
  return created
    ? { success: true }
    : { success: false, error: 'Failed to create SearXNG container' };
}

/** Ensure SearXNG is running on the eddo-chat network */
async function ensureRunning(
  ctx: SearxngManagerContext,
): Promise<{ success: boolean; error?: string }> {
  try {
    const networkReady = await ensureNetwork(ctx);
    if (!networkReady) {
      return { success: false, error: 'Failed to create eddo-chat network' };
    }

    const status = await getStatus(ctx);

    if (status.running && status.onNetwork) return { success: true };
    if (status.running && !status.onNetwork) return handleRunningNotOnNetwork(ctx);
    if (status.exists && !status.running) return handleStoppedContainer(ctx);
    return handleMissingContainer(ctx);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `SearXNG setup failed: ${msg}` };
  }
}

export type SearxngManager = ReturnType<typeof createSearxngManager>;
