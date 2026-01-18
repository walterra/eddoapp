/**
 * Docker container manager for pi-coding-agent sessions.
 * Uses dockerode for container lifecycle and RPC communication.
 *
 * Container isolation:
 * - Dedicated 'eddo-chat' Docker network (created automatically)
 * - User-namespaced container names: eddo.chat-<username>-<sessionId>
 * - Labels for filtering: eddo.chat.managed, eddo.chat.session, eddo.chat.username
 */

import Docker from 'dockerode';

import {
  buildLabelFilters,
  buildMounts,
  DEFAULT_NETWORK_NAME,
  DOCKER_PROJECT_NAME,
  getContainerLabels,
  getContainerName,
  mapContainerInfo,
} from './container-utils';
import type { ContainerStream } from './rpc-stream';
import {
  onRpcEvent as onStreamEvent,
  sendRpcCommand as sendStreamCommand,
  setupRpcStream,
} from './rpc-stream';
import type {
  ContainerInfo,
  ContainerManagerConfig,
  ContainerOperationResult,
  ContainerState,
  RpcCommand,
  RpcEventCallback,
  RpcResponse,
  SpawnContainerOptions,
} from './types';

const DEFAULT_CONFIG: ContainerManagerConfig = {
  defaultImage: 'pi-coding-agent:latest',
  labelPrefix: 'eddo.chat',
  networkName: DEFAULT_NETWORK_NAME,
};

interface ContainerManagerContext {
  docker: Docker;
  config: ContainerManagerConfig;
  streams: Map<string, ContainerStream>;
  networkInitialized: boolean;
}

/** Create a container manager instance */
export function createContainerManager(config?: Partial<ContainerManagerConfig>) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const dockerOptions: Docker.DockerOptions = {};

  if (mergedConfig.socketPath) dockerOptions.socketPath = mergedConfig.socketPath;
  else if (mergedConfig.dockerHost) dockerOptions.host = mergedConfig.dockerHost;

  const ctx: ContainerManagerContext = {
    docker: new Docker(dockerOptions),
    config: mergedConfig,
    streams: new Map(),
    networkInitialized: false,
  };

  return {
    spawnContainer: (opts: SpawnContainerOptions) => spawnContainer(ctx, opts),
    stopContainer: (sessionId: string, username?: string) =>
      stopContainer(ctx, sessionId, username),
    removeContainer: (sessionId: string, username?: string) =>
      removeContainer(ctx, sessionId, username),
    getContainerInfo: (sessionId: string, username?: string) =>
      getContainerInfo(ctx, sessionId, username),
    listContainers: (username?: string) => listContainers(ctx, username),
    sendRpcCommand: (sessionId: string, cmd: RpcCommand) => sendRpcCommand(ctx, sessionId, cmd),
    onRpcEvent: (sessionId: string, cb: RpcEventCallback) => onRpcEvent(ctx, sessionId, cb),
    isDockerAvailable: () => isDockerAvailable(ctx),
    pullImage: (image: string) => pullImage(ctx, image),
    ensureNetwork: () => ensureNetwork(ctx),
    getConfig: () => ctx.config,
  };
}

async function isDockerAvailable(ctx: ContainerManagerContext): Promise<boolean> {
  try {
    await ctx.docker.ping();
    return true;
  } catch {
    return false;
  }
}

/** Ensure the dedicated Docker network exists */
async function ensureNetwork(ctx: ContainerManagerContext): Promise<boolean> {
  if (ctx.networkInitialized) return true;

  const networkName = ctx.config.networkName || DEFAULT_NETWORK_NAME;

  try {
    const networks = await ctx.docker.listNetworks({ filters: { name: [networkName] } });
    const exactMatch = networks.find((n) => n.Name === networkName);

    if (!exactMatch) {
      await ctx.docker.createNetwork({
        Name: networkName,
        Driver: 'bridge',
        Labels: {
          [`${ctx.config.labelPrefix}.managed`]: 'true',
          'com.docker.compose.project': DOCKER_PROJECT_NAME,
          'com.docker.compose.network': networkName,
          description: 'Isolated network for Eddo chat agent containers',
        },
      });
    }

    ctx.networkInitialized = true;
    return true;
  } catch {
    return false;
  }
}

async function pullImage(ctx: ContainerManagerContext, image: string): Promise<boolean> {
  try {
    const stream = await ctx.docker.pull(image);
    await new Promise<void>((resolve, reject) => {
      ctx.docker.modem.followProgress(stream, (err) => (err ? reject(err) : resolve()));
    });
    return true;
  } catch {
    return false;
  }
}

/** Find container by session ID, optionally filtered by username */
async function findContainerBySession(
  ctx: ContainerManagerContext,
  sessionId: string,
  username?: string,
): Promise<Docker.Container | null> {
  try {
    const filters = buildLabelFilters(ctx.config, sessionId, username);
    const containers = await ctx.docker.listContainers({ all: true, filters: { label: filters } });
    return containers.length > 0 ? ctx.docker.getContainer(containers[0].Id) : null;
  } catch {
    return null;
  }
}

/** Build container creation options */
function buildContainerOptions(
  ctx: ContainerManagerContext,
  opts: SpawnContainerOptions,
): Docker.ContainerCreateOptions {
  const { sessionId, username, config } = opts;
  return {
    name: getContainerName(ctx.config, sessionId, username),
    Image: config.image || ctx.config.defaultImage,
    Labels: getContainerLabels(ctx.config, sessionId, username),
    Cmd: ['pi', '--mode', 'rpc', '--session-dir', '/sessions', '--no-session'],
    WorkingDir: '/workspace',
    Tty: false,
    OpenStdin: true,
    StdinOnce: false,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Env: config.env ? Object.entries(config.env).map(([k, v]) => `${k}=${v}`) : [],
    HostConfig: {
      Binds: buildMounts(config),
      Memory: config.memoryMB ? config.memoryMB * 1024 * 1024 : undefined,
      NanoCpus: config.cpuLimit ? parseFloat(config.cpuLimit) * 1e9 : undefined,
      NetworkMode: ctx.config.networkName || DEFAULT_NETWORK_NAME,
    },
  };
}

/** Demultiplex Docker stream and setup RPC */
async function setupContainerStream(
  ctx: ContainerManagerContext,
  stream: NodeJS.ReadWriteStream,
  sessionId: string,
  onEvent?: RpcEventCallback,
): Promise<void> {
  const { PassThrough } = await import('stream');
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  ctx.docker.modem.demuxStream(stream, stdout, stderr);

  const combinedStream = {
    on: (event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'data') {
        stdout.on('data', handler);
        stderr.on('data', handler);
      } else if (event === 'end') {
        stdout.on('end', handler);
      } else if (event === 'error') {
        stdout.on('error', handler);
        stderr.on('error', handler);
      }
    },
    write: (data: string) => stream.write(data),
  };

  const containerStream = setupRpcStream(
    combinedStream as unknown as NodeJS.ReadWriteStream,
    onEvent,
  );
  ctx.streams.set(sessionId, containerStream);
}

async function spawnContainer(
  ctx: ContainerManagerContext,
  opts: SpawnContainerOptions,
): Promise<ContainerOperationResult> {
  const { sessionId, username, onEvent } = opts;

  try {
    await ensureNetwork(ctx);

    const existing = await findContainerBySession(ctx, sessionId, username);
    if (existing)
      return { success: false, error: `Container already exists for session ${sessionId}` };

    const container = await ctx.docker.createContainer(buildContainerOptions(ctx, opts));
    await container.start();

    const stream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
      hijack: true,
    });

    await setupContainerStream(ctx, stream as NodeJS.ReadWriteStream, sessionId, onEvent);

    return { success: true, containerId: container.id };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

async function stopContainer(
  ctx: ContainerManagerContext,
  sessionId: string,
  username?: string,
): Promise<ContainerOperationResult> {
  try {
    const container = await findContainerBySession(ctx, sessionId, username);
    if (!container) return { success: true };

    const info = await container.inspect();
    if (info.State.Running) await container.stop({ t: 10 });
    ctx.streams.delete(sessionId);

    return { success: true, containerId: container.id };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function removeContainer(
  ctx: ContainerManagerContext,
  sessionId: string,
  username?: string,
): Promise<ContainerOperationResult> {
  try {
    const container = await findContainerBySession(ctx, sessionId, username);
    if (!container) return { success: true };

    const info = await container.inspect();
    if (info.State.Running) await container.stop({ t: 5 });
    await container.remove({ force: true });
    ctx.streams.delete(sessionId);

    return { success: true, containerId: container.id };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function getContainerInfo(
  ctx: ContainerManagerContext,
  sessionId: string,
  username?: string,
): Promise<ContainerInfo | null> {
  try {
    const container = await findContainerBySession(ctx, sessionId, username);
    if (!container) return null;
    const info = await container.inspect();
    const labels = info.Config.Labels || {};
    return mapContainerInfo(
      ctx.config,
      info,
      sessionId,
      labels[`${ctx.config.labelPrefix}.username`],
    );
  } catch {
    return null;
  }
}

async function listContainers(
  ctx: ContainerManagerContext,
  username?: string,
): Promise<ContainerInfo[]> {
  try {
    const filters = buildLabelFilters(ctx.config, undefined, username);
    const containers = await ctx.docker.listContainers({ all: true, filters: { label: filters } });

    const infos: ContainerInfo[] = [];
    for (const c of containers) {
      const sessionId = c.Labels[`${ctx.config.labelPrefix}.session`];
      const containerUsername = c.Labels[`${ctx.config.labelPrefix}.username`];
      if (sessionId) {
        const fullInfo = await ctx.docker.getContainer(c.Id).inspect();
        infos.push(mapContainerInfo(ctx.config, fullInfo, sessionId, containerUsername));
      }
    }
    return infos;
  } catch {
    return [];
  }
}

async function sendRpcCommand(
  ctx: ContainerManagerContext,
  sessionId: string,
  cmd: RpcCommand,
): Promise<RpcResponse | null> {
  const stream = ctx.streams.get(sessionId);
  if (!stream) return { type: 'response', command: cmd.type, success: false, error: 'No stream' };
  return sendStreamCommand(stream, cmd);
}

function onRpcEvent(
  ctx: ContainerManagerContext,
  sessionId: string,
  cb: RpcEventCallback,
): () => void {
  const stream = ctx.streams.get(sessionId);
  return stream ? onStreamEvent(stream, cb) : () => {};
}

export type ContainerManager = ReturnType<typeof createContainerManager>;
