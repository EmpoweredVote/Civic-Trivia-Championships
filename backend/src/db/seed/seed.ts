import 'dotenv/config';
import { db } from '../index.js';
import { collections, topics, collectionTopics, questions, collectionQuestions } from '../schema.js';
import { collectionsData } from './collections.js';
import { topicsData } from './topics.js';
import { getQuestionInserts } from './questions.js';
import { sql } from 'drizzle-orm';
import { pool } from '../../config/database.js';

async function seed() {
  console.log('Starting seed...\n');

  try {
    // Use a transaction for all seed operations
    await db.transaction(async (tx) => {
      // a) Insert collections (ON CONFLICT DO NOTHING on slug)
      console.log('Seeding collections...');
      const insertedCollections = await tx
        .insert(collections)
        .values(collectionsData)
        .onConflictDoNothing({ target: collections.slug })
        .returning();

      console.log(`Seeded ${insertedCollections.length} collections`);

      // Get all collections (including already existing)
      const allCollections = await tx.select().from(collections);
      const federalCollection = allCollections.find((c) => c.slug === 'federal');

      if (!federalCollection) {
        throw new Error('Federal collection not found after seeding');
      }

      // b) Insert topics (ON CONFLICT DO NOTHING on slug)
      console.log('\nSeeding topics...');
      const insertedTopics = await tx
        .insert(topics)
        .values(topicsData)
        .onConflictDoNothing({ target: topics.slug })
        .returning();

      console.log(`Seeded ${insertedTopics.length} topics`);

      // Get all topics and build slug -> id mapping
      const allTopics = await tx.select().from(topics);
      const topicIdMap: Record<string, number> = {};
      allTopics.forEach((topic) => {
        topicIdMap[topic.slug] = topic.id;
      });

      // c) Insert collection_topics for Federal collection (link all topics to Federal)
      console.log('\nLinking topics to Federal collection...');
      const collectionTopicsData = allTopics.map((topic) => ({
        collectionId: federalCollection.id,
        topicId: topic.id
      }));

      const insertedCollectionTopics = await tx
        .insert(collectionTopics)
        .values(collectionTopicsData)
        .onConflictDoNothing()
        .returning();

      console.log(`Linked ${insertedCollectionTopics.length} topics to Federal collection`);

      // d) Transform and insert questions
      console.log('\nSeeding questions...');
      const questionInserts = getQuestionInserts(topicIdMap);
      console.log(`Preparing to insert ${questionInserts.length} questions...`);

      const insertedQuestions = await tx
        .insert(questions)
        .values(questionInserts)
        .onConflictDoNothing({ target: questions.externalId })
        .returning();

      console.log(`Seeded ${insertedQuestions.length} questions`);

      // Count questions with learning content
      const questionsWithLearningContent = insertedQuestions.filter((q) => q.learningContent !== null);
      console.log(`  - ${questionsWithLearningContent.length} questions have learning content`);
      console.log(`  - ${insertedQuestions.length - questionsWithLearningContent.length} questions without learning content`);

      // e) Insert collection_questions (link all questions to Federal collection)
      console.log('\nLinking questions to Federal collection...');

      // Get all questions (including already existing)
      const allQuestions = await tx.select().from(questions);
      const collectionQuestionsData = allQuestions.map((question) => ({
        collectionId: federalCollection.id,
        questionId: question.id
      }));

      const insertedCollectionQuestions = await tx
        .insert(collectionQuestions)
        .values(collectionQuestionsData)
        .onConflictDoNothing()
        .returning();

      console.log(`Linked ${insertedCollectionQuestions.length} questions to Federal collection`);

      // f) Run ANALYZE on all tables
      console.log('\nRunning ANALYZE on all tables...');
      await tx.execute(sql`ANALYZE civic_trivia.collections`);
      await tx.execute(sql`ANALYZE civic_trivia.topics`);
      await tx.execute(sql`ANALYZE civic_trivia.collection_topics`);
      await tx.execute(sql`ANALYZE civic_trivia.questions`);
      await tx.execute(sql`ANALYZE civic_trivia.collection_questions`);
      console.log('ANALYZE complete');
    });

    // Print summary
    console.log('\n=== SEED SUMMARY ===');
    const collectionCount = await db.select().from(collections);
    const topicCount = await db.select().from(topics);
    const collectionTopicCount = await db.select().from(collectionTopics);
    const questionCount = await db.select().from(questions);
    const collectionQuestionCount = await db.select().from(collectionQuestions);

    console.log(`Collections: ${collectionCount.length}`);
    console.log(`Topics: ${topicCount.length}`);
    console.log(`Collection-Topics: ${collectionTopicCount.length}`);
    console.log(`Questions: ${questionCount.length}`);
    console.log(`Collection-Questions: ${collectionQuestionCount.length}`);

    console.log('\n✓ Seed complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Seed failed:', error);
    process.exit(1);
  }
}

// Run seed
seed();
