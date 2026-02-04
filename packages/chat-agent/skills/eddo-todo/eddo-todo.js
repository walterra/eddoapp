#!/usr/bin/env node
/**
 * Eddo Todo CLI for pi-coding-agent skill
 * Uses MCP SDK to communicate with Eddo MCP server
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';

const MCP_URL = process.env.EDDO_MCP_URL || 'http://localhost:3001/mcp';
const MCP_API_KEY = process.env.EDDO_MCP_API_KEY;

// API-key authentication (no user headers)
const USER_HEADERS = {
  ...(MCP_API_KEY ? { Authorization: `Bearer ${MCP_API_KEY}` } : {}),
};

/**
 * Create MCP client with authentication
 */
async function createClient() {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: {
      headers: USER_HEADERS,
    },
  });

  const client = new Client(
    { name: 'eddo-todo-skill', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  await client.connect(transport);
  return client;
}

/**
 * Call MCP tool and return result
 */
async function callTool(client, toolName, args = {}) {
  const result = await client.callTool({ name: toolName, arguments: args });

  if (result.content && result.content.length > 0) {
    return result.content.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c))).join('\n');
  }
  return 'No response';
}

/**
 * Format todo for display (compact list view)
 */
function formatTodo(todo) {
  const status = todo.completed ? '✅' : '⬜';
  const tags = todo.tags?.length ? ` [${todo.tags.join(', ')}]` : '';
  const due = todo.due ? ` 📅 ${todo.due}` : '';
  const context = todo.context ? ` @${todo.context}` : '';
  const link = todo.link ? `\n   🔗 ${todo.link}` : '';
  const parent = todo.parentId ? `\n   ↳ Parent: ${todo.parentId}` : '';
  const blockedBy = todo.blockedBy?.length
    ? `\n   🚫 Blocked by: ${todo.blockedBy.join(', ')}`
    : '';
  const metadata =
    todo.metadata && Object.keys(todo.metadata).length > 0
      ? `\n   📎 ${Object.entries(todo.metadata)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}`
      : '';

  return `${status} ${todo.title}${context}${tags}${due}\n   ID: ${todo._id}${link}${parent}${blockedBy}${metadata}`;
}

/**
 * Format a single note for display
 */
function formatNote(note, index) {
  const date = new Date(note.createdAt).toLocaleString();
  const edited = note.updatedAt ? ` (edited ${new Date(note.updatedAt).toLocaleString()})` : '';
  const preview = note.content.length > 100 ? note.content.substring(0, 100) + '...' : note.content;
  return `  [${index + 1}] ${date}${edited}\n      ${preview.replace(
    /\n/g,
    '\n      ',
  )}\n      ID: ${note.id}`;
}

/**
 * Format todo for detailed display (get command)
 */
function formatTodoDetailed(todo) {
  const status = todo.completed ? '✅ Completed' : '⬜ Pending';
  const lines = [
    `Title:       ${todo.title}`,
    `ID:          ${todo._id}`,
    `Status:      ${status}`,
    `Context:     ${todo.context || 'inbox'}`,
    `Due:         ${todo.due || 'none'}`,
    `Tags:        ${todo.tags?.length ? todo.tags.join(', ') : 'none'}`,
    `Link:        ${todo.link || 'none'}`,
    `External ID: ${todo.externalId || 'none'}`,
    `Parent ID:   ${todo.parentId || 'none'}`,
    `Blocked By:  ${todo.blockedBy?.length ? todo.blockedBy.join(', ') : 'none'}`,
  ];

  if (todo.completed) {
    lines.push(`Completed:   ${todo.completed}`);
  }

  // Add metadata section
  if (todo.metadata && Object.keys(todo.metadata).length > 0) {
    lines.push('');
    lines.push('Metadata:');
    for (const [key, value] of Object.entries(todo.metadata)) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  lines.push('');
  lines.push('Description:');
  lines.push(todo.description ? todo.description : '(empty)');

  // Add notes section
  if (todo.notes && todo.notes.length > 0) {
    lines.push('');
    lines.push(`Notes (${todo.notes.length}):`);
    // Sort by createdAt descending (newest first)
    const sortedNotes = [...todo.notes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    sortedNotes.forEach((note, i) => lines.push(formatNote(note, i)));
  }

  return lines.join('\n');
}

/**
 * Short flag aliases mapping to long names
 */
const FLAG_ALIASES = {
  c: 'context',
  t: 'tag',
  d: 'due',
  m: 'message',
  D: 'description',
  l: 'link',
  e: 'external-id',
  E: 'clear-external-id',
  p: 'parent-id',
  P: 'clear-parent',
  b: 'blocked-by',
  B: 'clear-blockers',
  M: 'metadata',
  u: 'undo',
  h: 'help',
};

/**
 * Parse command line arguments
 * Supports:
 * - Long flags: --context, --tag, --message
 * - Short flags: -c, -t, -m (mapped via FLAG_ALIASES)
 * - Multiple --tag/-t flags collected into an array
 */
function parseArgs(args) {
  const result = { _: [], tags: [], blockedBy: [], _blockedByProvided: false };
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    // Long flag: --name
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        if (key === 'tag') {
          result.tags.push(next);
        } else if (key === 'blocked-by') {
          result.blockedBy.push(next);
          result._blockedByProvided = true;
        } else {
          result[key] = next;
        }
        i += 2;
      } else {
        result[key] = true;
        i += 1;
      }
    }
    // Short flag: -x
    else if (arg.startsWith('-') && arg.length === 2) {
      const short = arg[1];
      const key = FLAG_ALIASES[short] || short;
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        if (key === 'tag') {
          result.tags.push(next);
        } else if (key === 'blocked-by') {
          result.blockedBy.push(next);
          result._blockedByProvided = true;
        } else {
          result[key] = next;
        }
        i += 2;
      } else {
        result[key] = true;
        i += 1;
      }
    }
    // Positional argument
    else {
      result._.push(arg);
      i += 1;
    }
  }

  return result;
}

// Commands

async function cmdGet(client, args) {
  const id = args._[0];
  if (!id) {
    console.error('Error: Todo ID is required');
    console.error('Usage: eddo.js get <id>');
    process.exit(1);
  }

  // Use getTodo tool for direct fetch by ID
  const response = await callTool(client, 'getTodo', { id });

  try {
    const data = JSON.parse(response);

    if (data.error) {
      console.log(`❌ ${data.summary || 'Todo not found'}: ${id}`);
      process.exit(1);
    }

    const todo = data.data;
    if (todo) {
      console.log(formatTodoDetailed(todo));
    } else {
      console.log(`❌ Todo not found: ${id}`);
      process.exit(1);
    }
  } catch {
    console.log(response);
  }
}

async function cmdList(client, args) {
  const params = {};
  if (args.context) params.context = args.context;
  if (args.completed) params.completed = true;
  if (args.tags && args.tags.length > 0) params.tags = args.tags;
  if (args.due) params.dateTo = args.due;

  const response = await callTool(client, 'listTodos', params);

  try {
    const data = JSON.parse(response);
    // Response structure: { summary, data: [...todos], metadata, pagination }
    const todos = data.data || data.todos || [];
    if (todos.length > 0) {
      console.log(`📋 ${data.summary || `Found ${todos.length} todo(s)`}:\n`);
      todos.forEach((todo) => console.log(formatTodo(todo) + '\n'));
    } else {
      console.log('No todos found.');
    }
  } catch {
    console.log(response);
  }
}

async function cmdCreate(client, args) {
  const title = args._[0];
  if (!title) {
    console.error('Error: Title is required');
    console.error('Usage: eddo.js create "Title" --context work --tag gtd:next --due 2025-01-10');
    process.exit(1);
  }

  const params = {
    title,
    context: args.context || 'inbox',
    due: args.due || new Date().toISOString().split('T')[0],
  };

  if (args.tags && args.tags.length > 0) {
    params.tags = args.tags;
  }
  if (args.description) {
    params.description = args.description;
  }
  if (args.link) {
    params.link = args.link;
  }
  if (args['external-id']) {
    params.externalId = args['external-id'];
  }
  if (args['parent-id']) {
    params.parentId = args['parent-id'];
  }
  if (args.blockedBy && args.blockedBy.length > 0) {
    params.blockedBy = args.blockedBy;
  }
  if (args.metadata) {
    try {
      params.metadata = JSON.parse(args.metadata);
    } catch {
      console.error('Error: --metadata must be valid JSON (e.g., \'{"key":"value"}\')');
      process.exit(1);
    }
  }
  if (args.message) {
    params.message = args.message;
  }

  const response = await callTool(client, 'createTodo', params);
  console.log('✅ Todo created:');
  console.log(response);
}

async function cmdUpdate(client, args) {
  const id = args._[0];
  if (!id) {
    console.error('Error: Todo ID is required');
    console.error('Usage: eddo.js update <id> --title "New title" --context work');
    process.exit(1);
  }

  const params = { id };
  if (args.title) params.title = args.title;
  if (args.context) params.context = args.context;
  if (args.due) params.due = args.due;
  if (args.description) params.description = args.description;
  if (args.tags && args.tags.length > 0) params.tags = args.tags;
  if (args.link) params.link = args.link;
  // Handle external-id: -e <id> sets, -E/--clear-external-id clears
  if (args['clear-external-id']) {
    params.externalId = null;
  } else if (args['external-id']) {
    params.externalId = args['external-id'];
  }
  // Handle parent-id: -p <id> sets, -P/--clear-parent clears
  if (args['clear-parent']) {
    params.parentId = null;
  } else if (args['parent-id']) {
    params.parentId = args['parent-id'];
  }
  // Handle blocked-by: -b <id> sets blockers, -B/--clear-blockers clears them
  if (args['clear-blockers']) {
    params.blockedBy = null;
  } else if (args._blockedByProvided && args.blockedBy.length > 0) {
    params.blockedBy = args.blockedBy;
  }
  // Handle metadata: -M <json> sets, --clear-metadata clears
  if (args['clear-metadata']) {
    params.metadata = null;
  } else if (args.metadata) {
    try {
      params.metadata = JSON.parse(args.metadata);
    } catch {
      console.error('Error: --metadata must be valid JSON (e.g., \'{"key":"value"}\')');
      process.exit(1);
    }
  }
  if (args.message) {
    params.message = args.message;
  }

  const response = await callTool(client, 'updateTodo', params);
  console.log('✅ Todo updated:');
  console.log(response);
}

async function cmdComplete(client, args) {
  const id = args._[0];
  if (!id) {
    console.error('Error: Todo ID is required');
    console.error('Usage: eddo.js complete <id> [--undo] [-m "message"]');
    process.exit(1);
  }

  const completed = !args.undo;
  const params = { id, completed };
  if (args.message) {
    params.message = args.message;
  }
  const response = await callTool(client, 'toggleTodoCompletion', params);
  console.log(completed ? '✅ Todo completed:' : '⬜ Todo marked incomplete:');
  console.log(response);
}

async function cmdDelete(client, args) {
  const id = args._[0];
  if (!id) {
    console.error('Error: Todo ID is required');
    console.error('Usage: eddo.js delete <id> [-m "message"]');
    process.exit(1);
  }

  const params = { id };
  if (args.message) {
    params.message = args.message;
  }
  const response = await callTool(client, 'deleteTodo', params);
  console.log('🗑️  Todo deleted:');
  console.log(response);
}

async function cmdStart(client, args) {
  const id = args._[0];
  if (!id) {
    console.error('Error: Todo ID is required');
    console.error('Usage: eddo.js start <id> [-M metadata] [-m "message"]');
    process.exit(1);
  }

  // If metadata provided, update the todo first
  if (args.metadata) {
    const updateParams = { id };
    try {
      updateParams.metadata = JSON.parse(args.metadata);
    } catch {
      console.error('Error: --metadata must be valid JSON (e.g., \'{"key":"value"}\')');
      process.exit(1);
    }
    if (args.message) {
      updateParams.message = args.message;
    }
    await callTool(client, 'updateTodo', updateParams);
  }

  const params = { id };
  if (args.message) {
    params.message = args.message;
  }
  const response = await callTool(client, 'startTimeTracking', params);
  console.log('⏱️  Time tracking started:');
  console.log(response);
}

async function cmdStop(client, args) {
  const id = args._[0];
  if (!id) {
    console.error('Error: Todo ID is required');
    console.error('Usage: eddo.js stop <id> [-m "message"]');
    process.exit(1);
  }

  const params = { id };
  if (args.message) {
    params.message = args.message;
  }
  const response = await callTool(client, 'stopTimeTracking', params);
  console.log('⏹️  Time tracking stopped:');
  console.log(response);
}

async function cmdActive(client) {
  const response = await callTool(client, 'getActiveTimeTracking', {});
  console.log('⏱️  Active time tracking:');
  console.log(response);
}

async function cmdInfo(client) {
  const response = await callTool(client, 'getServerInfo', { section: 'all' });
  console.log('ℹ️  Server info:');
  console.log(response);
}

/**
 * List children (subtasks) of a parent todo
 */
async function cmdChildren(client, args) {
  const parentId = args._[0];
  if (!parentId) {
    console.error('Error: Parent ID is required');
    console.error('Usage: eddo.js children <parent-id>');
    process.exit(1);
  }

  const response = await callTool(client, 'listTodos', { parentId });

  try {
    const data = JSON.parse(response);
    const todos = data.data || data.todos || [];

    if (todos.length > 0) {
      console.log(`📂 Subtasks of ${parentId}:\n`);

      const completed = todos.filter((t) => t.completed);
      const pending = todos.filter((t) => !t.completed);

      if (pending.length > 0) {
        console.log(`⬜ PENDING (${pending.length}):`);
        pending.forEach((todo) => console.log(`   ${formatTodo(todo)}\n`));
      }

      if (completed.length > 0) {
        console.log(`✅ COMPLETED (${completed.length}):`);
        completed.forEach((todo) => console.log(`   ${formatTodo(todo)}\n`));
      }

      console.log(`\n📊 Progress: ${completed.length}/${todos.length} subtasks completed`);
    } else {
      console.log(`📂 No subtasks found for ${parentId}`);
    }
  } catch {
    console.log(response);
  }
}

/**
 * Add a note to a todo
 */
async function cmdNote(client, args) {
  const id = args._[0];
  const content = args._[1];

  if (!id || !content) {
    console.error('Error: Todo ID and note content are required');
    console.error('Usage: eddo.js note <id> "Note content"');
    process.exit(1);
  }

  const response = await callTool(client, 'addNote', { todoId: id, content });
  console.log('📝 Note added:');
  console.log(response);
}

/**
 * List notes for a todo
 */
async function cmdNotes(client, args) {
  const id = args._[0];
  if (!id) {
    console.error('Error: Todo ID is required');
    console.error('Usage: eddo.js notes <id>');
    process.exit(1);
  }

  const response = await callTool(client, 'getTodo', { id });

  try {
    const data = JSON.parse(response);

    if (data.error) {
      console.log(`❌ ${data.summary || 'Todo not found'}: ${id}`);
      process.exit(1);
    }

    const todo = data.data;
    if (!todo) {
      console.log(`❌ Todo not found: ${id}`);
      process.exit(1);
    }

    console.log(`📝 Notes for: ${todo.title}\n`);

    if (!todo.notes || todo.notes.length === 0) {
      console.log('No notes yet.');
      return;
    }

    // Sort by createdAt descending (newest first)
    const sortedNotes = [...todo.notes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    sortedNotes.forEach((note, i) => {
      const date = new Date(note.createdAt).toLocaleString();
      const edited = note.updatedAt ? ` (edited)` : '';
      console.log(`[${i + 1}] ${date}${edited}`);
      console.log(`    ${note.content.replace(/\n/g, '\n    ')}`);
      console.log(`    ID: ${note.id}\n`);
    });
  } catch {
    console.log(response);
  }
}

/**
 * Delete a note from a todo
 */
async function cmdNoteDelete(client, args) {
  const todoId = args._[0];
  const noteId = args._[1];

  if (!todoId || !noteId) {
    console.error('Error: Todo ID and Note ID are required');
    console.error('Usage: eddo.js note-delete <todo-id> <note-id>');
    process.exit(1);
  }

  const response = await callTool(client, 'deleteNote', { todoId, noteId });
  console.log('🗑️  Note deleted:');
  console.log(response);
}

/**
 * Detect MIME type from file extension
 */
function getMimeType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
  };
  return mimeTypes[ext] || null;
}

/**
 * Attach a file to a todo's description
 * Uploads the file and appends markdown reference to description
 */
async function cmdAttach(client, args) {
  const todoId = args._[0];
  const filePath = args._[1];

  if (!todoId || !filePath) {
    console.error('Error: Todo ID and file path are required');
    console.error('Usage: eddo.js attach <todo-id> <file-path> [--name filename]');
    process.exit(1);
  }

  // Determine filename (use --name if provided, otherwise derive from path)
  const filename = args.name || basename(filePath);
  const contentType = getMimeType(filename);

  if (!contentType) {
    console.error('Error: Unsupported file type');
    console.error('Supported: PNG, JPEG, GIF, WebP, PDF');
    process.exit(1);
  }

  // Read file and convert to base64
  let base64Data;
  try {
    const buffer = readFileSync(filePath);
    base64Data = buffer.toString('base64');
  } catch (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
  }

  // Upload attachment
  console.log(`📤 Uploading ${filename}...`);
  const uploadResponse = await callTool(client, 'uploadAttachment', {
    todoId,
    filename,
    base64Data,
    contentType,
    type: 'desc',
  });

  let uploadResult;
  try {
    uploadResult = JSON.parse(uploadResponse);
    if (uploadResult.error) {
      console.error(`❌ Upload failed: ${uploadResult.summary}`);
      process.exit(1);
    }
  } catch {
    console.error('❌ Upload failed:', uploadResponse);
    process.exit(1);
  }

  const markdownRef = uploadResult.data.markdownRef;
  console.log(`✅ Uploaded: ${markdownRef}`);

  // Get current todo to retrieve existing description
  const getResponse = await callTool(client, 'getTodo', { id: todoId });
  let todo;
  try {
    const getData = JSON.parse(getResponse);
    if (getData.error || !getData.data) {
      console.error(`❌ Could not fetch todo: ${todoId}`);
      process.exit(1);
    }
    todo = getData.data;
  } catch {
    console.error('❌ Failed to parse todo response');
    process.exit(1);
  }

  // Append markdown reference to description
  const currentDescription = todo.description || '';
  const newDescription = currentDescription
    ? `${currentDescription}\n\n${markdownRef}`
    : markdownRef;

  // Update todo with new description
  const updateParams = { id: todoId, description: newDescription };
  if (args.message) {
    updateParams.message = args.message;
  }

  const updateResponse = await callTool(client, 'updateTodo', updateParams);
  console.log('✅ Todo updated with attachment reference');
  console.log(updateResponse);
}

/**
 * List attachments for a todo
 */
async function cmdAttachments(client, args) {
  const todoId = args._[0];

  if (!todoId) {
    console.error('Error: Todo ID is required');
    console.error('Usage: eddo.js attachments <todo-id>');
    process.exit(1);
  }

  const response = await callTool(client, 'listAttachments', { todoId });

  try {
    const data = JSON.parse(response);
    if (data.error) {
      console.error(`❌ ${data.summary}`);
      process.exit(1);
    }

    console.log(`📎 Attachments for todo ${todoId}:\n`);

    if (data.data.count === 0) {
      console.log('No attachments.');
      return;
    }

    data.data.attachments.forEach((att, i) => {
      const size =
        att.size < 1024
          ? `${att.size} B`
          : att.size < 1024 * 1024
            ? `${(att.size / 1024).toFixed(1)} KB`
            : `${(att.size / (1024 * 1024)).toFixed(1)} MB`;
      console.log(`[${i + 1}] ${att.filename} (${size})`);
      console.log(`    Type: ${att.contentType}`);
      console.log(`    Ref: ${att.markdownRef}`);
      console.log(`    ID: ${att.docId}\n`);
    });
  } catch {
    console.log(response);
  }
}

/**
 * Get/download an attachment from a todo
 * Saves to file or outputs base64 to stdout
 */
async function cmdGetAttachment(client, args) {
  const docId = args._[0];

  if (!docId) {
    console.error('Error: Attachment document ID is required');
    console.error('Usage: eddo.js get-attachment <docId> [--output file.png]');
    console.error('       eddo.js get-attachment <docId> --base64');
    process.exit(1);
  }

  const response = await callTool(client, 'getAttachment', { docId });

  try {
    const data = JSON.parse(response);
    if (data.error) {
      console.error(`❌ ${data.summary}`);
      process.exit(1);
    }

    const { filename, contentType, size, base64Data } = data.data;

    // If --base64 flag, just output the base64 data
    if (args.base64) {
      console.log(base64Data);
      return;
    }

    // Determine output path
    const outputPath = args.output || `/tmp/${filename}`;

    // Write file
    const buffer = Buffer.from(base64Data, 'base64');
    writeFileSync(outputPath, buffer);

    console.log(`✅ Saved ${filename} (${(size / 1024).toFixed(1)} KB) to ${outputPath}`);
    console.log(`   Type: ${contentType}`);
  } catch {
    console.log(response);
  }
}

/**
 * Check if a todo is blocked by incomplete blockers
 * @param {object} todo - The todo to check
 * @param {Map} todoMap - Map of todo IDs to todos for lookup
 * @returns {boolean} True if blocked by at least one incomplete todo
 */
function isBlockedByIncompleteTodos(todo, todoMap) {
  if (!todo.blockedBy || todo.blockedBy.length === 0) {
    return false;
  }

  for (const blockerId of todo.blockedBy) {
    const blocker = todoMap.get(blockerId);
    // If blocker doesn't exist or is not completed, consider it blocking
    if (!blocker || !blocker.completed) {
      return true;
    }
  }
  return false;
}

/**
 * GTD "What Next" - Fetch actionable candidates for agent decision
 * Returns todos that are actionable (excludes someday/waiting/blocked)
 * Agent makes the final decision based on context, energy, time available
 */
async function cmdNext(client, args) {
  const params = { completed: false };
  if (args.context) params.context = args.context;

  const response = await callTool(client, 'listTodos', params);
  let data;
  try {
    data = JSON.parse(response);
  } catch {
    console.log(response);
    return;
  }
  const todos = data.data || data.todos || [];

  if (todos.length === 0) {
    console.log('🎉 No pending todos! All caught up.');
    return;
  }

  // Build a map for quick lookup of blockers
  const todoMap = new Map(todos.map((t) => [t._id, t]));

  // Separate by actionability
  const nextActions = [];
  const projects = [];
  const overdue = [];
  const dueSoon = [];
  const other = [];
  const waiting = [];
  const someday = [];
  const blocked = [];

  const today = new Date().toISOString().split('T')[0];
  const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  for (const todo of todos) {
    const tags = todo.tags || [];

    if (tags.includes('gtd:waiting')) {
      waiting.push(todo);
    } else if (tags.includes('gtd:someday')) {
      someday.push(todo);
    } else if (tags.includes('gtd:blocked') || isBlockedByIncompleteTodos(todo, todoMap)) {
      // gtd:blocked tag OR has incomplete blockedBy references
      blocked.push(todo);
    } else if (todo.due && todo.due < today) {
      overdue.push(todo);
    } else if (tags.includes('gtd:next')) {
      nextActions.push(todo);
    } else if (tags.includes('gtd:project')) {
      projects.push(todo);
    } else if (todo.due && todo.due <= threeDaysLater) {
      dueSoon.push(todo);
    } else {
      other.push(todo);
    }
  }

  // Output actionable items for agent decision
  console.log('🎯 ACTIONABLE CANDIDATES:\n');

  if (overdue.length > 0) {
    console.log(`⚠️  OVERDUE (${overdue.length}):`);
    overdue.forEach((t) => console.log(`   ${formatTodo(t)}\n`));
  }

  if (nextActions.length > 0) {
    console.log(`🚀 NEXT ACTIONS (${nextActions.length}):`);
    nextActions.forEach((t) => console.log(`   ${formatTodo(t)}\n`));
  }

  if (dueSoon.length > 0) {
    console.log(`📅 DUE SOON (${dueSoon.length}):`);
    dueSoon.forEach((t) => console.log(`   ${formatTodo(t)}\n`));
  }

  if (projects.length > 0) {
    console.log(`📋 PROJECTS (${projects.length}):`);
    projects.forEach((t) => console.log(`   ${formatTodo(t)}\n`));
  }

  if (other.length > 0) {
    console.log(`📝 OTHER (${other.length}):`);
    other.forEach((t) => console.log(`   ${formatTodo(t)}\n`));
  }

  // Show non-actionable for awareness
  if (waiting.length > 0 || someday.length > 0 || blocked.length > 0) {
    console.log('---\n📭 NOT ACTIONABLE NOW:');
    if (blocked.length > 0) console.log(`   🚫 Blocked: ${blocked.length} items`);
    if (waiting.length > 0) console.log(`   ⏳ Waiting: ${waiting.length} items`);
    if (someday.length > 0) console.log(`   💭 Someday/Maybe: ${someday.length} items`);
  }

  const actionableCount =
    overdue.length + nextActions.length + dueSoon.length + projects.length + other.length;
  console.log(
    `\n💡 ${actionableCount} actionable items. Pick one based on context, energy, and time available.`,
  );
}

function showHelp() {
  console.log(`
Eddo Todo CLI - GTD-style todo management

Usage: eddo.js <command> [options]

Short Flags:
  -c  --context         -t  --tag            -d  --due
  -m  --message         -D  --description    -l  --link
  -e  --external-id     -E  --clear-external-id
  -p  --parent-id       -P  --clear-parent
  -b  --blocked-by      -B  --clear-blockers
  -M  --metadata        -u  --undo           -h  --help

Commands:
  next                     🎯 GTD: Show actionable candidates grouped by priority
    -c, --context <ctx>    Filter by context

  get <id>                 Get full details of a single todo

  list                     List todos
    -c, --context <ctx>    Filter by context (work, private, errands)
    --completed            Show completed todos
    -t, --tag <tag>        Filter by tag (repeatable)
    -d, --due <date>       Filter by due date (YYYY-MM-DD)

  create <title>           Create a new todo
    -c, --context <ctx>    Set context (default: inbox)
    -t, --tag <tag>        Add tag (repeatable)
    -d, --due <date>       Set due date (YYYY-MM-DD)
    -D, --description <s>  Add description
    -l, --link <url>       Add URL/reference link
    -e, --external-id <id> Set external ID for sync
    -p, --parent-id <id>   Set parent todo ID (creates subtask)
    -b, --blocked-by <id>  Set blocking todo ID (repeatable)
    -M, --metadata <json>  Set metadata as JSON
    -m, --message <msg>    Audit message (why this was created)

  update <id>              Update a todo
    --title <title>        New title
    -c, --context <ctx>    New context
    -d, --due <date>       New due date
    -t, --tag <tag>        Set tags (repeatable)
    -l, --link <url>       Set URL/reference link
    -e, --external-id <id> Set external ID for sync
    -E, --clear-external-id  Remove external ID
    -p, --parent-id <id>   Set parent todo ID
    -P, --clear-parent     Remove parent (make root-level)
    -b, --blocked-by <id>  Set blocking todo IDs (repeatable)
    -B, --clear-blockers   Remove all blockers
    -M, --metadata <json>  Set metadata as JSON
    --clear-metadata       Remove all metadata
    -m, --message <msg>    Audit message (why this was updated)

  complete <id>            Mark todo as completed
    -u, --undo             Mark as incomplete
    -m, --message <msg>    Audit message

  delete <id>              Delete a todo
    -m, --message <msg>    Audit message (why this was deleted)

  children <parent-id>     📂 List subtasks of a parent todo

  note <id> "content"      📝 Add a note to a todo
  notes <id>               📝 List all notes for a todo
  note-delete <id> <nid>   🗑️  Delete a note

  attach <id> <file>       📎 Attach file to todo description
    --name <filename>      Override filename
    -m, --message <msg>    Audit message
  attachments <id>         📎 List attachments for a todo
  get-attachment <docId>   📥 Download attachment
    --output <file>        Save to file (default: /tmp/{filename})
    --base64               Output base64 to stdout

  start <id>               Start time tracking
    -M, --metadata <json>  Set metadata (e.g., agent session info)
    -m, --message <msg>    Audit message
  stop <id>                Stop time tracking
    -m, --message <msg>    Audit message
  active                   Show active time tracking

  info                     Show server info

GTD Tags:
  gtd:next      Actionable now        gtd:project   Multi-step outcome
  gtd:waiting   Blocked (external)    gtd:blocked   Blocked (internal task)
  gtd:someday   Maybe later           gtd:calendar  Time-specific (prefix HH:MM)

Examples:
  eddo.js next -c eddoapp
  eddo.js create "Review PR" -c work -t gtd:next -m "Requested by @john"
  eddo.js update <id> -d 2025-01-15 -m "Pushed to next week, blocked on API"
  eddo.js complete <id> -m "Fixed the auth bug"
  eddo.js create "Subtask" -p "2025-01-07T10:00:00.000Z" -c work
  eddo.js update <id> -t gtd:blocked -b "2025-01-07T10:00:00.000Z" -m "Blocked by other task"
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  args._.shift(); // Remove command from positional args

  if (!command || command === 'help' || args.help) {
    showHelp();
    process.exit(0);
  }

  let client;
  try {
    client = await createClient();

    switch (command) {
      case 'get':
        await cmdGet(client, args);
        break;
      case 'list':
        await cmdList(client, args);
        break;
      case 'create':
        await cmdCreate(client, args);
        break;
      case 'update':
        await cmdUpdate(client, args);
        break;
      case 'complete':
        await cmdComplete(client, args);
        break;
      case 'delete':
        await cmdDelete(client, args);
        break;
      case 'start':
        await cmdStart(client, args);
        break;
      case 'stop':
        await cmdStop(client, args);
        break;
      case 'active':
        await cmdActive(client);
        break;
      case 'info':
        await cmdInfo(client);
        break;
      case 'next':
        await cmdNext(client, args);
        break;
      case 'children':
        await cmdChildren(client, args);
        break;
      case 'note':
        await cmdNote(client, args);
        break;
      case 'notes':
        await cmdNotes(client, args);
        break;
      case 'note-delete':
        await cmdNoteDelete(client, args);
        break;
      case 'attach':
        await cmdAttach(client, args);
        break;
      case 'attachments':
        await cmdAttachments(client, args);
        break;
      case 'get-attachment':
        await cmdGetAttachment(client, args);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      console.error('\nMake sure Eddo MCP server is running:');
      console.error('  cd /Users/walterra/dev/eddoapp && pnpm dev:mcp-server');
    }
    process.exit(1);
  } finally {
    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

main();
