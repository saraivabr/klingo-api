#!/usr/bin/env node
/**
 * MongoDB Index Migration Script
 * 
 * Adds performance-critical indexes to the conversations collection.
 * Run this before deploying to production.
 * 
 * Usage:
 *   node scripts/add-mongodb-indexes.js
 * 
 * Or with custom MongoDB URI:
 *   MONGO_URI=mongodb://... node scripts/add-mongodb-indexes.js
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/irb_whatsapp';

async function addIndexes() {
  console.log('🔗 Connecting to MongoDB...');
  console.log(`   URI: ${MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
  
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    const conversations = db.collection('conversations');
    
    console.log('📊 Current indexes:');
    const existingIndexes = await conversations.indexes();
    existingIndexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    console.log('');
    
    // Index 1: patientPhone + lastMessageAt (compound index for lookups + sorting)
    console.log('🔨 Creating index: { patientPhone: 1, lastMessageAt: -1 }');
    await conversations.createIndex(
      { patientPhone: 1, lastMessageAt: -1 },
      { 
        name: 'patientPhone_lastMessageAt',
        background: true  // Don't block other operations
      }
    );
    console.log('✅ Index created: patientPhone_lastMessageAt\n');
    
    // Index 2: lastMessageAt (for general sorting/filtering)
    console.log('🔨 Creating index: { lastMessageAt: -1 }');
    await conversations.createIndex(
      { lastMessageAt: -1 },
      {
        name: 'lastMessageAt',
        background: true
      }
    );
    console.log('✅ Index created: lastMessageAt\n');
    
    console.log('📊 Updated indexes:');
    const newIndexes = await conversations.indexes();
    newIndexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    console.log('');
    
    // Verify index usage with explain
    console.log('🔍 Verifying index usage...');
    const testPhone = '5511999999999';
    const explainResult = await conversations.find({ patientPhone: testPhone })
      .sort({ lastMessageAt: -1 })
      .limit(1)
      .explain('executionStats');
    
    const usedIndex = explainResult.executionStats?.executionStages?.inputStage?.indexName;
    const docsExamined = explainResult.executionStats?.totalDocsExamined || 0;
    const executionTime = explainResult.executionStats?.executionTimeMillis || 0;
    
    if (usedIndex === 'patientPhone_lastMessageAt') {
      console.log(`✅ Query is using index: ${usedIndex}`);
      console.log(`   Documents examined: ${docsExamined}`);
      console.log(`   Execution time: ${executionTime}ms`);
    } else {
      console.warn(`⚠️  Query not using expected index. Using: ${usedIndex || 'collection scan'}`);
    }
    console.log('');
    
    console.log('🎉 MongoDB indexes successfully created!');
    console.log('');
    console.log('Expected performance improvement:');
    console.log('   - Query time: 300ms → 5-10ms (30-60x faster)');
    console.log('   - Cron job duration: 15s → 2s (7-8x faster)');
    
  } catch (error) {
    console.error('❌ Error adding indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  addIndexes().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { addIndexes };
