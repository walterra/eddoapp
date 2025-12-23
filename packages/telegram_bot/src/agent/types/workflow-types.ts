/**
 * Workflow execution result
 */
export interface WorkflowResult {
  success: boolean;
  error?: Error;
  finalResponse?: string;
}

/**
 * Workflow configuration options
 */
export interface WorkflowConfig {
  enableStreaming: boolean;
  enableApprovals: boolean;
  maxExecutionTime: number;
  maxRetries: number;
  checkpointInterval: number;
}
