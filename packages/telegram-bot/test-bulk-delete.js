#!/usr/bin/env node

// Simple test script to verify bulk delete logic
import { getClaudeAI } from './dist/ai/claude.js';

async function testBulkDeleteParsing() {
  console.log('🧪 Testing bulk delete intent parsing...\n');
  
  const claude = getClaudeAI();
  
  // Test cases
  const testCases = [
    {
      name: 'Direct bulk delete request',
      message: 'delete all todos with health context',
      expectedActions: 2,
      expectedSequential: true
    },
    {
      name: 'Contextual confirmation', 
      message: 'yes delete these todos',
      lastBotMessage: 'I found 3 health todos: "morning meditation", "evening walk", "drink water". Should I delete them all?',
      expectedActions: 2,
      expectedSequential: true
    },
    {
      name: 'Create multiple todos',
      message: 'create 2 new todos: fix the terrasse and build the pergola',
      expectedActions: 2,
      expectedSequential: false
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`📝 Test: ${testCase.name}`);
    console.log(`   Message: "${testCase.message}"`);
    if (testCase.lastBotMessage) {
      console.log(`   Context: "${testCase.lastBotMessage}"`);
    }
    
    try {
      const intent = await claude.parseUserIntent(testCase.message, testCase.lastBotMessage);
      
      if (!intent) {
        console.log('   ❌ Result: null (not recognized as todo request)');
        continue;
      }
      
      if ('actions' in intent) {
        console.log(`   ✅ Result: Multi-action with ${intent.actions.length} actions`);
        console.log(`   📋 Actions: ${intent.actions.map(a => a.action).join(', ')}`);
        console.log(`   🔄 Sequential: ${intent.requiresSequential || false}`);
        
        if (intent.actions.length === testCase.expectedActions && 
            (intent.requiresSequential || false) === testCase.expectedSequential) {
          console.log('   🎉 PASS: Expected behavior achieved');
        } else {
          console.log('   ⚠️  PARTIAL: Structure correct but details differ');
        }
      } else {
        console.log(`   ✅ Result: Single action - ${intent.action}`);
        if (testCase.expectedActions === 1) {
          console.log('   🎉 PASS: Expected single action');
        } else {
          console.log('   ⚠️  FAIL: Expected multi-action');
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
    
    console.log('');
  }
}

testBulkDeleteParsing().catch(console.error);