/**
 * Docker container manager for pi-coding-agent sessions.
 * Uses dockerode for container lifecycle and RPC communication.
 */

import Docker from 'dockerode';

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
};

interface ContainerManagerContext {
  docker: Docker;
  config: ContainerManagerConfig;
  streams: Map<string, ContainerStream>;
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
  };

  return {
    spawnContainer: (opts: SpawnContainerOptions) => spawnContainer(ctx, opts),
    stopContainer: (sessionId: string) => stopContainer(ctx, sessionId),
    removeContainer: (sessionId: string) => removeContainer(ctx, sessionId),
    getContainerInfo: (sessionId: string) => getContainerInfo(ctx, sessionId),
    listContainers: () => listContainers(ctx),
    sendRpcCommand: (sessionId: string, cmd: RpcCommand) => sendRpcCommand(ctx, sessionId, cmd),
    onRpcEvent: (sessionId: string, cb: RpcEventCallback) => onRpcEvent(ctx, sessionId, cb),
    isDockerAvailable: () => isDockerAvailable(ctx),
    pullImage: (image: string) => pullImage(ctx, image),
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

function getContainerName(ctx: ContainerManagerContext, sessionId: string): string {
  return `${ctx.config.labelPrefix}-${sessionId}`;
}

function getContainerLabels(
  ctx: ContainerManagerContext,
  sessionId: string,
): Record<string, string> {
  return {
    [`${ctx.config.labelPrefix}.session`]: sessionId,
    [`${ctx.config.labelPrefix}.managed`]: 'true',
  };
}

async function spawnContainer(
  ctx: ContainerManagerContext,
  opts: SpawnContainerOptions,
): Promise<ContainerOperationResult> {
  const { sessionId, config, onEvent } = opts;

  try {
    const existing = await findContainerBySession(ctx, sessionId);
    if (existing)
      return { success: false, error: `Container already exists for session ${sessionId}` };

    const createOptions: Docker.ContainerCreateOptions = {
      name: getContainerName(ctx, sessionId),
      Image: config.image || ctx.config.defaultImage,
      Labels: getContainerLabels(ctx, sessionId),
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
        NetworkMode: ctx.config.networkName,
      },
    };

    const container = await ctx.docker.createContainer(createOptions);
    await container.start();

    const stream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
      hijack: true,
    });
    const containerStream = setupRpcStream(stream as unknown as NodeJS.ReadWriteStream, onEvent);
    ctx.streams.set(sessionId, containerStream);

    return { success: true, containerId: container.id };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function buildMounts(config: SpawnContainerOptions['config']): string[] {
  const mounts = [`${config.workspacePath}:/workspace:rw`, `${config.sessionDir}:/sessions:rw`];
  if (config.gitDir) mounts.push(`${config.gitDir}:/workspace/.git:ro`);
  return mounts;
}

async function stopContainer(
  ctx: ContainerManagerContext,
  sessionId: string,
): Promise<ContainerOperationResult> {
  try {
    const container = await findContainerBySession(ctx, sessionId);
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
): Promise<ContainerOperationResult> {
  try {
    const container = await findContainerBySession(ctx, sessionId);
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
): Promise<ContainerInfo | null> {
  try {
    const container = await findContainerBySession(ctx, sessionId);
    if (!container) return null;
    return mapContainerInfo(ctx, await container.inspect(), sessionId);
  } catch {
    return null;
  }
}

async function listContainers(ctx: ContainerManagerContext): Promise<ContainerInfo[]> {
  try {
    const containers = await ctx.docker.listContainers({
      all: true,
      filters: { label: [`${ctx.config.labelPrefix}.managed=true`] },
    });

    const infos: ContainerInfo[] = [];
    for (const c of containers) {
      const sessionId = c.Labels[`${ctx.config.labelPrefix}.session`];
      if (sessionId) {
        const fullInfo = await ctx.docker.getContainer(c.Id).inspect();
        infos.push(mapContainerInfo(ctx, fullInfo, sessionId));
      }
    }
    return infos;
  } catch {
    return [];
  }
}

function mapContainerInfo(
  ctx: ContainerManagerContext,
  info: Docker.ContainerInspectInfo,
  sessionId: string,
): ContainerInfo {
  return {
    id: info.Id,
    name: info.Name.replace(/^\//, ''),
    state: mapContainerState(info.State),
    image: info.Config.Image,
    createdAt: info.Created,
    startedAt: info.State.StartedAt,
    sessionId,
  };
}

function mapContainerState(state: Docker.ContainerInspectInfo['State']): ContainerState {
  if (state.Running) return 'running';
  if (state.Paused) return 'paused';
  if (state.Dead || state.OOMKilled) return 'error';
  return 'stopped';
}

async function findContainerBySession(
  ctx: ContainerManagerContext,
  sessionId: string,
): Promise<Docker.Container | null> {
  try {
    const containers = await ctx.docker.listContainers({
      all: true,
      filters: { label: [`${ctx.config.labelPrefix}.session=${sessionId}`] },
    });
    return containers.length > 0 ? ctx.docker.getContainer(containers[0].Id) : null;
  } catch {
    return null;
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
