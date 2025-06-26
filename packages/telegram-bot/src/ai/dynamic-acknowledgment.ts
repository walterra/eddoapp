import type { ActionRegistry } from '../services/action-registry.js';
import type { Persona } from './persona-types.js';
import type {
  DynamicMultiTodoIntent,
  DynamicTodoIntent,
} from './dynamic-intent-parser.js';

/**
 * Service for generating acknowledgments based on dynamic actions
 */
export class DynamicAcknowledmentService {
  constructor(
    private readonly persona: Persona,
    private readonly actionRegistry: ActionRegistry,
  ) {}

  /**
   * Generate acknowledgment for dynamic intents
   */
  generateAcknowledgment(
    intent: DynamicTodoIntent | DynamicMultiTodoIntent,
  ): string {
    // Handle multi-intent
    if ('actions' in intent) {
      const actionCount = intent.actions.length;
      if (actionCount === 1) {
        return this.generateAcknowledgment(intent.actions[0]);
      }
      const actionDescription = `handle those ${actionCount} tasks`;
      return this.persona.acknowledgmentTemplates.action.replace(
        '{action_description}',
        actionDescription,
      );
    }

    // Handle single intent - get description from action registry
    const actionDescription = this.getActionDescription(intent.action);
    return this.persona.acknowledgmentTemplates.action.replace(
      '{action_description}',
      actionDescription,
    );
  }

  /**
   * Get a human-readable description for an action
   */
  private getActionDescription(action: string): string {
    // Get metadata from action registry
    const metadata = this.actionRegistry.getActionMetadata(action);
    if (metadata) {
      // Convert action name to user-friendly description
      return this.actionNameToDescription(action, metadata.description);
    }

    // Fallback to converting action name
    return this.actionNameToDescription(action);
  }

  /**
   * Convert action name to user-friendly description
   */
  private actionNameToDescription(
    action: string,
    metadataDescription?: string,
  ): string {
    // If we have metadata description, try to extract a simple verb phrase
    if (metadataDescription) {
      const simpleDesc = this.extractSimpleDescription(metadataDescription);
      if (simpleDesc) {
        return simpleDesc;
      }
    }

    // Convert camelCase/snake_case action names to descriptions
    const normalized = action
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase();

    // Map common patterns to user-friendly phrases
    const patterns: Record<string, string> = {
      'create todo': 'create that todo',
      'list todos': 'retrieve your todos',
      'update todo': 'update that todo',
      'delete todo': 'remove that todo',
      'toggle todo completion': 'mark that as completed',
      'start time tracking': 'start the timer',
      'stop time tracking': 'stop the timer',
      'get active time tracking': 'check your active timers',
    };

    // Check for exact matches
    if (patterns[normalized]) {
      return patterns[normalized];
    }

    // Generate description based on action verb
    if (normalized.includes('create')) return 'create that';
    if (normalized.includes('list') || normalized.includes('get')) {
      return 'retrieve that information';
    }
    if (normalized.includes('update') || normalized.includes('edit')) {
      return 'update that';
    }
    if (normalized.includes('delete') || normalized.includes('remove')) {
      return 'remove that';
    }
    if (normalized.includes('complete') || normalized.includes('toggle')) {
      return 'mark that as completed';
    }
    if (normalized.includes('start')) return 'start that';
    if (normalized.includes('stop')) return 'stop that';

    // Generic fallback
    return `handle that ${normalized.replace(' todo', '')}`;
  }

  /**
   * Extract a simple description from metadata description
   */
  private extractSimpleDescription(description: string): string | null {
    // Look for patterns like "Create new todos" -> "create that todo"
    const createMatch = description.match(/create\s+(?:new\s+)?(\w+)/i);
    if (createMatch) {
      return `create that ${createMatch[1].toLowerCase()}`;
    }

    // Look for patterns like "List todos" -> "retrieve your todos"
    const listMatch = description.match(/list\s+(\w+)/i);
    if (listMatch) {
      return `retrieve your ${listMatch[1].toLowerCase()}`;
    }

    // Look for patterns like "Update existing todos" -> "update that todo"
    const updateMatch = description.match(/update\s+(?:existing\s+)?(\w+)/i);
    if (updateMatch) {
      return `update that ${updateMatch[1].toLowerCase()}`;
    }

    // Look for patterns like "Delete todos" -> "remove that todo"
    const deleteMatch = description.match(/delete\s+(\w+)/i);
    if (deleteMatch) {
      return `remove that ${deleteMatch[1].toLowerCase()}`;
    }

    // Look for verb at start of description
    const verbMatch = description.match(/^(\w+)\s/);
    if (verbMatch) {
      const verb = verbMatch[1].toLowerCase();
      return `${verb} that`;
    }

    return null;
  }
}