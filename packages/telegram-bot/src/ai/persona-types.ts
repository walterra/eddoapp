/**
 * Generic persona interface and types
 */

export interface Persona {
  id: string;
  name: string;
  systemPrompt: string;
  acknowledgmentEmoji: string;
  acknowledgments: {
    create: string;
    list: string;
    update: string;
    complete: string;
    delete: string;
    start_timer: string;
    stop_timer: string;
    get_summary: string;
  };
  fallbackMessage: string;
  messages: {
    roleDescription: string;
    welcomeContent: string;
    closingMessage: string;
  };
}
