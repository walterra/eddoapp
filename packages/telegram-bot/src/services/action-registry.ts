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

  constructor(private readonly discoveryService: McpToolDiscoveryService) {}

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
   * Generate aliases for an action dynamically based on patterns
   */
  private generateAliases(actionName: string, toolName: string): string[] {
    const aliases: string[] = [];

    // Add snake_case version
    aliases.push(this.toSnakeCase(actionName));

    // Generate aliases based on action name patterns (dynamic approach)
    const lowerAction = actionName.toLowerCase();
    
    // Create/Add patterns
    if (lowerAction.includes('create') || lowerAction.includes('add')) {
      aliases.push('create', 'add');
      if (lowerAction.includes('todo')) {
        aliases.push('create_todo', 'add_todo');
      }
    }
    
    // List/Get patterns
    if (lowerAction.includes('list') || lowerAction.includes('get')) {
      aliases.push('list', 'get');
      if (lowerAction.includes('todo')) {
        aliases.push('list_todos', 'get_todos');
      }
    }
    
    // Update/Edit patterns
    if (lowerAction.includes('update') || lowerAction.includes('edit')) {
      aliases.push('update', 'edit');
      if (lowerAction.includes('todo')) {
        aliases.push('update_todo', 'edit_todo');
      }
    }
    
    // Delete/Remove patterns
    if (lowerAction.includes('delete') || lowerAction.includes('remove')) {
      aliases.push('delete', 'remove');
      if (lowerAction.includes('todo')) {
        aliases.push('delete_todo', 'remove_todo');
      }
    }
    
    // Complete/Toggle patterns
    if (lowerAction.includes('complete') || lowerAction.includes('toggle')) {
      aliases.push('complete');
      if (lowerAction.includes('toggle')) {
        aliases.push('toggle');
      }
    }
    
    // Timer/Tracking patterns
    if (lowerAction.includes('start') && (lowerAction.includes('time') || lowerAction.includes('track') || lowerAction.includes('timer'))) {
      aliases.push('start_timer', 'start_tracking');
    }
    if (lowerAction.includes('stop') && (lowerAction.includes('time') || lowerAction.includes('track') || lowerAction.includes('timer'))) {
      aliases.push('stop_timer', 'stop_tracking');
    }

    // Add the full tool name as an alias
    if (toolName !== actionName) {
      aliases.push(toolName);
    }

    // Remove duplicates and the original action name (it will be added separately)
    return [...new Set(aliases.filter(alias => alias !== actionName))];
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
