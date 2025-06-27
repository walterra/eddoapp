#!/usr/bin/env node
/* eslint-env node */

/**
 * Mock data population script for CouchDB
 * Creates GTD todos for a typical week of a Starfleet officer
 */

import fetch from 'node-fetch';

// Configuration - matches project's environment variables
const COUCHDB_URL = process.env.COUCHDB_URL || 'http://admin:password@localhost:5984';
const COUCHDB_DB_NAME = process.env.COUCHDB_DB_NAME || 'todos-dev';

// Generate mock todo data for a Starfleet officer's typical week
function generateStarfleetTodos() {
  const todos = [];
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Start of current week

  // Helper to create dates relative to week start
  const getDate = (daysFromStart, hours = 9, minutes = 0) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + daysFromStart);
    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
  };

  // Generate diverse todos across the week
  const todoData = [
    // Monday - Week Planning & Bridge Duties
    { title: 'Review weekly mission objectives', context: 'bridge', due: getDate(0, 8, 0) },
    { title: 'Conduct senior staff briefing', context: 'bridge', due: getDate(0, 9, 0) },
    { title: 'Analyze long-range sensor data', context: 'science', due: getDate(0, 14, 0) },
    { title: 'Submit crew performance evaluations', context: 'starfleet', due: getDate(0, 16, 0) },
    { title: 'Review diplomatic protocols for Risa conference', context: 'diplomatic', due: getDate(0, 19, 0) },

    // Tuesday - Engineering & System Maintenance
    { title: 'Inspect warp core containment field', context: 'engineering', due: getDate(1, 10, 0) },
    { title: 'Calibrate deflector array sensors', context: 'engineering', due: getDate(1, 14, 30) },
    { title: 'Approve engineering staff rotation schedule', context: 'starfleet', due: getDate(1, 11, 0) },
    { title: 'Review quantum mechanics research proposal', context: 'science', due: getDate(1, 15, 0) },
    { title: 'Practice Vulcan meditation techniques', context: 'personal', due: getDate(1, 20, 0) },

    // Wednesday - Away Mission Prep
    { title: 'Prepare away team equipment manifest', context: 'away-team', due: getDate(2, 9, 30) },
    { title: 'Briefing on Class M planet survey protocols', context: 'away-team', due: getDate(2, 11, 0) },
    { title: 'Review xenobiology database for mission', context: 'science', due: getDate(2, 13, 0) },
    { title: 'Test universal translator updates', context: 'away-team', due: getDate(2, 15, 30) },
    { title: 'Send subspace message to Admiral Paris', context: 'starfleet', due: getDate(2, 17, 0) },

    // Thursday - Training & Development
    { title: 'Conduct phaser training simulation', context: 'training', due: getDate(3, 10, 0) },
    { title: 'Review Starfleet Academy curriculum updates', context: 'training', due: getDate(3, 14, 0) },
    { title: 'Mentor junior officer career development', context: 'training', due: getDate(3, 16, 0) },
    { title: 'Complete temporal mechanics certification', context: 'training', due: getDate(3, 19, 0) },
    { title: 'Call parents on Earth', context: 'personal', due: getDate(3, 21, 0) },

    // Friday - Diplomatic & Science
    { title: 'First contact protocols workshop', context: 'diplomatic', due: getDate(4, 9, 0) },
    { title: 'Analyze subspace anomaly readings', context: 'science', due: getDate(4, 11, 30) },
    { title: 'Prepare report for Starfleet Command', context: 'starfleet', due: getDate(4, 15, 0) },
    { title: 'Review trade negotiations with Ferengi', context: 'diplomatic', due: getDate(4, 17, 30) },

    // Weekend - Personal & Maintenance
    { title: 'Holodeck recreation program updates', context: 'personal', due: getDate(5, 10, 0) },
    { title: 'Monthly system diagnostics review', context: 'engineering', due: getDate(5, 14, 0) },
    { title: 'Read "Advanced Warp Theory" by Dr. Brahms', context: 'personal', due: getDate(6, 16, 0) },
    { title: 'Chess match with Data in Ten Forward', context: 'personal', due: getDate(6, 19, 0) },

    // Recurring & Overdue Items
    { title: 'Weekly replicator maintenance check', context: 'engineering', due: getDate(-2, 10, 0) }, // Overdue
    { title: 'Update personal log entries', context: 'personal', due: getDate(1, 22, 0) },
    { title: 'Review bridge officer duty roster', context: 'bridge', due: getDate(2, 8, 0) },
    { title: 'Coordinate with Engineering on shield upgrades', context: 'bridge', due: getDate(4, 13, 0) },

    // Long-term projects
    { title: 'Develop new first contact procedures', context: 'diplomatic', due: getDate(14, 12, 0) }, // Next week
    { title: 'Write paper on quantum field fluctuations', context: 'science', due: getDate(21, 15, 0) }, // Future
  ];

  // Convert to TodoAlpha3 format
  todoData.forEach((todo) => {
    const createdTime = new Date(now.getTime() - (Math.random() * 7 * 24 * 60 * 60 * 1000)); // Random time in past week

    const todoAlpha3 = {
      _id: createdTime.toISOString(),
      version: 'alpha3',
      title: todo.title,
      description: `Starfleet duty: ${todo.title}`,
      context: todo.context,
      due: todo.due,
      tags: generateTagsForTodo(todo),
      active: {},
      completed: Math.random() > 0.8 ? new Date().toISOString() : null, // 20% completed
      repeat: todo.title.includes('Weekly') ? 7 : null, // Weekly recurring items
      link: null
    };

    todos.push(todoAlpha3);
  });

  return todos;
}

// Generate appropriate tags based on todo content and context
function generateTagsForTodo(todo) {
  const tags = [];

  // Context-based tags
  switch (todo.context) {
    case 'bridge':
      tags.push('command', 'duty-shift');
      break;
    case 'engineering':
      tags.push('technical', 'maintenance');
      break;
    case 'away-team':
      tags.push('exploration', 'fieldwork');
      break;
    case 'science':
      tags.push('research', 'analysis');
      break;
    case 'diplomatic':
      tags.push('negotiations', 'protocol');
      break;
    case 'training':
      tags.push('education', 'development');
      break;
    case 'starfleet':
      tags.push('administration', 'paperwork');
      break;
    case 'personal':
      tags.push('self-care', 'recreation');
      break;
  }

  // Content-based tags
  if (todo.title.toLowerCase().includes('report')) {
    tags.push('documentation');
  }
  if (todo.title.toLowerCase().includes('briefing') || todo.title.toLowerCase().includes('meeting')) {
    tags.push('meeting');
  }
  if (todo.title.toLowerCase().includes('review')) {
    tags.push('review');
  }
  if (todo.title.toLowerCase().includes('training') || todo.title.toLowerCase().includes('practice')) {
    tags.push('skill-building');
  }
  if (todo.title.toLowerCase().includes('contact') || todo.title.toLowerCase().includes('call')) {
    tags.push('communication');
  }

  // Priority tags based on context importance
  if (['bridge', 'away-team', 'diplomatic'].includes(todo.context)) {
    tags.push('high-priority');
  }

  return tags;
}

// Check if database exists, create if not
async function ensureDatabase() {
  try {
    const response = await fetch(`${COUCHDB_URL}/${COUCHDB_DB_NAME}`);
    if (response.status === 404) {
      console.log(`Creating database: ${COUCHDB_DB_NAME}`);
      const createResponse = await fetch(`${COUCHDB_URL}/${COUCHDB_DB_NAME}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create database: ${createResponse.statusText}`);
      }
    } else if (!response.ok) {
      throw new Error(`Database check failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Database setup error:', error.message);
    throw error;
  }
}

// Populate database with mock data
async function populateMockData() {
  const dryRun = process.argv.includes('--dry-run');

  try {
    console.log(`Connecting to CouchDB at ${COUCHDB_URL}`);
    console.log(`Target database: ${COUCHDB_DB_NAME}`);

    if (dryRun) {
      console.log('🧪 DRY RUN MODE - No data will be inserted');
    } else {
      await ensureDatabase();
    }

    const todos = generateStarfleetTodos();
    console.log(`Generated ${todos.length} Starfleet officer todos`);

    // Show context distribution
    const contextCounts = {};
    todos.forEach((todo) => {
      contextCounts[todo.context] = (contextCounts[todo.context] || 0) + 1;
    });

    console.log('Todo distribution by context:');
    Object.entries(contextCounts).forEach(([context, count]) => {
      console.log(`  ${context}: ${count}`);
    });

    if (dryRun) {
      // Show sample todos in dry run
      console.log('\n📝 Sample todos that would be created:');
      todos.slice(0, 5).forEach((todo, i) => {
        console.log(`${i + 1}. [${todo.context}] ${todo.title}`);
        console.log(`   Due: ${new Date(todo.due).toLocaleString()}`);
        console.log(`   Tags: ${todo.tags.join(', ')}`);
        console.log('');
      });
      console.log(`... and ${todos.length - 5} more todos`);
      console.log('\n🖖 Run without --dry-run to actually insert data');
    } else {
      // Bulk insert todos
      const bulkDoc = {
        docs: todos
      };

      const response = await fetch(`${COUCHDB_URL}/${COUCHDB_DB_NAME}/_bulk_docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulkDoc)
      });

      if (!response.ok) {
        throw new Error(`Bulk insert failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Check for errors
      const errors = result.filter((doc) => doc.error);
      if (errors.length > 0) {
        console.warn(`${errors.length} documents failed to insert:`);
        errors.forEach((error) => console.warn(`  ${error.id}: ${error.error}`));
      }

      const successful = result.length - errors.length;
      console.log(`✅ Successfully inserted ${successful} todos`);
      console.log(`📅 Date range: ${new Date().toLocaleDateString()} week`);
      console.log(`🖖 Ready for a productive week in Starfleet!`);
    }

  } catch (error) {
    console.error('Mock data population failed:', error.message);
    process.exit(1);
  }
}

// Run population if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  populateMockData();
}

export { populateMockData };
