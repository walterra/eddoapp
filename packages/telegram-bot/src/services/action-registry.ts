import { logger } from '../utils/logger.js';
import type { McpToolDiscoveryService } from './mcp-tool-discovery.js';

/**
 * Metadata for an action including its aliases and categorization
 */
export interface ActionMetadata {
  name: string;
  aliases: string[]; // Legacy names, variations
  category: 'crud' | 'time-tracking' | 'utility' | 'analysis' | 'integration';
  description: string;
  toolName?: string; // The actual MCP tool name
}

/**
 * Registry for managing actions and their mappings to MCP tools
 */
export class ActionRegistry {
  private registry: Map<string, ActionMetadata> = new Map();
  private aliasToActionMap: Map<string, string> = new Map();
  private initialized = false;

  constructor(
    private readonly discoveryService: McpToolDiscoveryService,
    private readonly fallbackActions?: Map<string, ActionMetadata>,
  ) {}

  /**
   * Initialize the registry with discovered tools
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing ActionRegistry');

      // Clear existing registrations
      this.registry.clear();
      this.aliasToActionMap.clear();

      // Get discovered tools
      const tools = this.discoveryService.getAvailableTools();
      logger.info('Processing discovered tools', { toolCount: tools.length });

      // Register each discovered tool
      for (const tool of tools) {
        const actionName = this.extractActionName(tool.name);
        const metadata: ActionMetadata = {
          name: actionName,
          aliases: this.generateAliases(actionName, tool.name),
          category: this.categorizeAction(actionName),
          description: tool.description,
          toolName: tool.name,
        };

        this.registerAction(actionName, metadata);
      }

      // Register fallback actions if no tools were discovered
      if (this.registry.size === 0 && this.fallbackActions) {
        logger.warn('No tools discovered, using fallback actions');
        for (const [name, metadata] of this.fallbackActions) {
          this.registerAction(name, metadata);
        }
      }

      this.initialized = true;
      logger.info('ActionRegistry initialized', {
        actionCount: this.registry.size,
        aliasCount: this.aliasToActionMap.size,
      });
    } catch (error) {
      logger.error('Failed to initialize ActionRegistry', { error });
      throw error;
    }
  }

  /**
   * Register an action with its metadata
   */
  private registerAction(name: string, metadata: ActionMetadata): void {
    // Register the action
    this.registry.set(name, metadata);

    // Register all aliases
    for (const alias of metadata.aliases) {
      this.aliasToActionMap.set(alias, name);
    }

    // Also register the name itself as an alias
    this.aliasToActionMap.set(name, name);
  }

  /**
   * Get all available action names
   */
  getAvailableActions(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Get formatted action list for prompts
   */
  getActionListForPrompt(
    format: 'camelCase' | 'snake_case' = 'camelCase',
  ): string {
    const actions = this.getAvailableActions();
    const formattedActions = actions.map((action) => {
      if (format === 'snake_case') {
        return this.toSnakeCase(action);
      }
      return action;
    });

    return formattedActions.map((a) => `- ${a}`).join('\n');
  }

  /**
   * Get action metadata
   */
  getActionMetadata(actionName: string): ActionMetadata | undefined {
    return this.registry.get(actionName);
  }

  /**
   * Resolve an action name from input (including aliases)
   */
  resolveActionName(input: string): string | undefined {
    // Direct match
    if (this.registry.has(input)) {
      return input;
    }

    // Check aliases
    const resolvedName = this.aliasToActionMap.get(input);
    if (resolvedName) {
      logger.debug('Resolved action via alias', {
        input,
        resolved: resolvedName,
      });
      return resolvedName;
    }

    // Try case-insensitive match
    const lowerInput = input.toLowerCase();
    for (const [alias, actionName] of this.aliasToActionMap) {
      if (alias.toLowerCase() === lowerInput) {
        logger.debug('Resolved action via case-insensitive match', {
          input,
          resolved: actionName,
        });
        return actionName;
      }
    }

    return undefined;
  }

  /**
   * Get the MCP tool name for an action
   */
  getToolNameForAction(actionName: string): string | undefined {
    const metadata = this.registry.get(actionName);
    return metadata?.toolName;
  }

  /**
   * Check if the registry is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Extract a clean action name from a tool name
   */
  private extractActionName(toolName: string): string {
    // Remove server prefixes (e.g., eddo_todo_createTodo -> createTodo)
    const parts = toolName.split('_');
    if (parts.length >= 3 && parts[0] === 'eddo') {
      return parts.slice(2).join('_');
    }
    return toolName;
  }

  /**
   * Generate aliases for an action
   */
  private generateAliases(actionName: string, toolName: string): string[] {
    const aliases: string[] = [];

    // Add snake_case version
    aliases.push(this.toSnakeCase(actionName));

    // Add specific aliases based on action name
    switch (actionName) {
      case 'createTodo':
        aliases.push('create_todo', 'addTodo', 'add_todo', 'create');
        break;
      case 'listTodos':
        aliases.push('list_todos', 'getTodos', 'get_todos', 'list');
        break;
      case 'updateTodo':
        aliases.push('update_todo', 'editTodo', 'edit_todo', 'update');
        break;
      case 'deleteTodo':
        aliases.push('delete_todo', 'removeTodo', 'remove_todo', 'delete');
        break;
      case 'toggleTodoCompletion':
        aliases.push(
          'toggle_completion',
          'toggleCompletion',
          'toggle_todo_completion',
          'complete_todo',
          'completeTodo',
        );
        break;
      case 'startTimeTracking':
        aliases.push('start_time_tracking', 'startTimer', 'start_timer');
        break;
      case 'stopTimeTracking':
        aliases.push('stop_time_tracking', 'stopTimer', 'stop_timer');
        break;
      case 'getActiveTimeTracking':
        aliases.push(
          'get_active_timers',
          'getActiveTimers',
          'active_timers',
          'activeTimers',
        );
        break;
    }

    // Add the full tool name as an alias
    if (toolName !== actionName) {
      aliases.push(toolName);
    }

    // Remove duplicates
    return [...new Set(aliases)];
  }

  /**
   * Categorize an action based on its name
   */
  private categorizeAction(
    actionName: string,
  ): 'crud' | 'time-tracking' | 'utility' | 'analysis' | 'integration' {
    const name = actionName.toLowerCase();

    if (
      name.includes('create') ||
      name.includes('list') ||
      name.includes('update') ||
      name.includes('delete') ||
      name.includes('toggle')
    ) {
      return 'crud';
    }

    if (
      name.includes('time') ||
      name.includes('track') ||
      name.includes('timer')
    ) {
      return 'time-tracking';
    }

    if (
      name.includes('analyze') ||
      name.includes('summary') ||
      name.includes('report')
    ) {
      return 'analysis';
    }

    if (
      name.includes('github') ||
      name.includes('slack') ||
      name.includes('notion')
    ) {
      return 'integration';
    }

    return 'utility';
  }

  /**
   * Convert camelCase to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  }
}
