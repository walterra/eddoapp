/**
 * Type declarations for turndown-plugin-gfm
 */
declare module 'turndown-plugin-gfm' {
  import type TurndownService from 'turndown';

  /**
   * GitHub Flavored Markdown plugin for Turndown
   * Adds support for tables, strikethrough, and task lists
   */
  export function gfm(turndownService: TurndownService): void;

  /**
   * Table conversion plugin
   */
  export function tables(turndownService: TurndownService): void;

  /**
   * Strikethrough conversion plugin
   */
  export function strikethrough(turndownService: TurndownService): void;

  /**
   * Task list conversion plugin
   */
  export function taskListItems(turndownService: TurndownService): void;
}
