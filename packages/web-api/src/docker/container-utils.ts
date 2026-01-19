/**
 * Docker container utility functions and constants.
 */

import type Docker from 'dockerode';

import type {
  ContainerConfig,
  ContainerInfo,
  ContainerManagerConfig,
  ContainerState,
} from './types';

/** Default Docker network name for eddo chat containers */
export const DEFAULT_NETWORK_NAME = 'eddo-chat';

/** Docker Compose project name for container grouping */
export const DOCKER_PROJECT_NAME = 'eddo';

/**
 * Sanitize a string for use in Docker container/network names.
 * Docker names must match [a-zA-Z0-9][a-zA-Z0-9_.-]*
 */
export function sanitizeForDocker(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/-+/g, '-')
    .substring(0, 63);
}

/** Generate container name from config, session ID, and optional username */
export function getContainerName(
  config: ContainerManagerConfig,
  sessionId: string,
  username?: string,
): string {
  const prefix = config.labelPrefix.replace(/\./g, '-');
  const safeSession = sanitizeForDocker(sessionId);
  if (username) {
    const safeUsername = sanitizeForDocker(username);
    return `${prefix}-${safeUsername}-${safeSession}`;
  }
  return `${prefix}-${safeSession}`;
}

/** Generate container labels for filtering and identification */
export function getContainerLabels(
  config: ContainerManagerConfig,
  sessionId: string,
  username?: string,
): Record<string, string> {
  const labels: Record<string, string> = {
    [`${config.labelPrefix}.managed`]: 'true',
    [`${config.labelPrefix}.session`]: sessionId,
    'com.docker.compose.project': DOCKER_PROJECT_NAME,
  };
  if (username) {
    labels[`${config.labelPrefix}.username`] = username;
  }
  return labels;
}

/** Build label filters for Docker API queries */
export function buildLabelFilters(
  config: ContainerManagerConfig,
  sessionId?: string,
  username?: string,
): string[] {
  const filters: string[] = [`${config.labelPrefix}.managed=true`];
  if (sessionId) {
    filters.push(`${config.labelPrefix}.session=${sessionId}`);
  }
  if (username) {
    filters.push(`${config.labelPrefix}.username=${username}`);
  }
  return filters;
}

/** Build Docker bind mounts from container config */
export function buildMounts(config: ContainerConfig): string[] {
  const mounts: string[] = [`${config.workspacePath}:/workspace`, `${config.sessionDir}:/sessions`];

  if (config.gitDir) {
    mounts.push(`${config.gitDir}:/git:ro`);
  }
  if (config.mainGitDir) {
    mounts.push(`${config.mainGitDir}:/main-git:ro`);
  }
  if (config.piConfigDir) {
    mounts.push(`${config.piConfigDir}:/root/.pi:ro`);
  }

  return mounts;
}

/** Map Docker container state to our ContainerState type */
function mapDockerState(state: Docker.ContainerInspectInfo['State']): ContainerState {
  if (state.Running) return 'running';
  if (state.Paused) return 'paused';
  if (state.Restarting) return 'creating';
  if (state.Dead || state.OOMKilled) return 'error';
  return 'stopped';
}

/** Map Docker container inspect info to our ContainerInfo type */
export function mapContainerInfo(
  _config: ContainerManagerConfig,
  info: Docker.ContainerInspectInfo,
  sessionId: string,
  _username?: string,
): ContainerInfo {
  return {
    id: info.Id,
    name: info.Name.replace(/^\//, ''),
    state: mapDockerState(info.State),
    image: info.Config.Image,
    createdAt: info.Created,
    startedAt: info.State.StartedAt !== '0001-01-01T00:00:00Z' ? info.State.StartedAt : undefined,
    sessionId,
  };
}
