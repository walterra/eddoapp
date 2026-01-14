/**
 * Docker container management module for pi-coding-agent sessions.
 */

export { createContainerManager, type ContainerManager } from './container-manager';
export { DEFAULT_NETWORK_NAME, sanitizeForDocker } from './container-utils';
export { onRpcEvent, sendRpcCommand, setupRpcStream, type ContainerStream } from './rpc-stream';
export { createSearxngManager, type SearxngManager } from './searxng-manager';
export type {
  ContainerConfig,
  ContainerInfo,
  ContainerManagerConfig,
  ContainerOperationResult,
  ContainerState,
  RpcCommand,
  RpcEvent,
  RpcEventCallback,
  RpcResponse,
  SpawnContainerOptions,
} from './types';
