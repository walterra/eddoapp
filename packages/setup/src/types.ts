/**
 * Shared types for setup wizard
 */

export interface SetupConfig {
  startDocker: boolean;
  generateEnv: boolean;
  envOverwrite: boolean;
  createUser: boolean;
  userPassword?: string;
  buildAgentImage: boolean;
  installPiSkills: boolean;
}

export interface SetupOptions {
  ci?: boolean;
  force?: boolean;
}
