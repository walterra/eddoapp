/**
 * Types for Docker container management.
 */

/** Container lifecycle states */
export type ContainerState = 'pending' | 'creating' | 'running' | 'paused' | 'stopped' | 'error';

/** Container configuration for pi-coding-agent */
export interface ContainerConfig {
  /** Docker image to use */
  image: string;
  /** Workspace directory to mount */
  workspacePath: string;
  /** Session directory for JSONL files */
  sessionDir: string;
  /** Git directory (bare clone) to mount */
  gitDir?: string;
  /** Main git directory for reference (optional) */
  mainGitDir?: string;
  /** Pi agent config directory path */
  piConfigDir?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Memory limit in MB */
  memoryMB?: number;
  /** CPU limit (e.g., "1.0" for 1 CPU) */
  cpuLimit?: string;
}

/** Container information */
export interface ContainerInfo {
  /** Container ID */
  id: string;
  /** Container name */
  name: string;
  /** Current state */
  state: ContainerState;
  /** Image used */
  image: string;
  /** Creation timestamp */
  createdAt: string;
  /** Start timestamp (if running) */
  startedAt?: string;
  /** Associated session ID */
  sessionId: string;
  /** Port mappings */
  ports?: Record<string, number>;
}

/** RPC command to send to container */
export interface RpcCommand {
  id?: string;
  type: string;
  [key: string]: unknown;
}

/** RPC response from container */
export interface RpcResponse {
  id?: string;
  type: 'response';
  command: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

/** RPC event from container */
export interface RpcEvent {
  type: string;
  [key: string]: unknown;
}

/** Container manager configuration */
export interface ContainerManagerConfig {
  /** Docker socket path (default: /var/run/docker.sock) */
  socketPath?: string;
  /** Docker host (alternative to socket) */
  dockerHost?: string;
  /** Default image for pi-coding-agent */
  defaultImage: string;
  /** Network name for containers */
  networkName?: string;
  /** Container label prefix */
  labelPrefix: string;
}

/** Callback for RPC events */
export type RpcEventCallback = (event: RpcEvent) => void;

/** Container spawn options */
export interface SpawnContainerOptions {
  /** Session ID */
  sessionId: string;
  /** Username for container context */
  username?: string;
  /** Container configuration */
  config: ContainerConfig;
  /** Callback for RPC events */
  onEvent?: RpcEventCallback;
}

/** Result of container operations */
export interface ContainerOperationResult {
  success: boolean;
  containerId?: string;
  error?: string;
}
