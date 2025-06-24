#!/usr/bin/env tsx
/**
 * Simple test to verify the LangGraph telegram context fix
 * This script tests the context passing without requiring bot tokens
 */

import { SimpleLangGraphWorkflow } from './simple-langgraph-workflow.js';

// Mock BotContext
const mockTelegramContext = {
  chat: { id: 12345 },
  from: { id: 67890, username: 'testuser' },
  reply: async (text: string, options?: any) => {
    console.log('📤 Bot Reply:', text);
    if (options) {
      console.log('   Options:', options);
    }
  },
  session: {
    userId: '67890',
    lastActivity: new Date(),
    context: {}
  }
} as any;

async function testLangGraphFix() {
  console.log('🧪 Testing LangGraph Telegram Context Fix...\n');
  
  try {
    // Create workflow instance
    const workflow = new SimpleLangGraphWorkflow();
    console.log('✅ SimpleLangGraphWorkflow created successfully');
    
    // Test the execute method with mock context
    console.log('🚀 Testing workflow execution...');
    
    const result = await workflow.execute(
      "what's up today",
      '67890',
      mockTelegramContext
    );
    
    console.log('\n📊 Test Results:');
    console.log('Success:', result.success);
    console.log('Final Response:', result.finalResponse || 'No response');
    
    if (result.error) {
      console.log('Error:', result.error.message);
      console.log('Stack:', result.error.stack);
    }
    
    if (result.success) {
      console.log('\n✅ SUCCESS: LangGraph telegram context fix is working!');
    } else {
      console.log('\n❌ FAILED: There are still issues with the fix');
    }
    
  } catch (error) {
    console.error('\n💥 Test failed with error:', error);
    
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

// Run the test
testLangGraphFix().catch(console.error);