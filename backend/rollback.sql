-- Rollback: Phase 13 Database Schema
-- Run this to revert all Phase 13 schema changes
-- WARNING: This will DELETE all collection and question data

DROP TABLE IF EXISTS civic_trivia.collection_questions CASCADE;
DROP TABLE IF EXISTS civic_trivia.questions CASCADE;
DROP TABLE IF EXISTS civic_trivia.collection_topics CASCADE;
DROP TABLE IF EXISTS civic_trivia.topics CASCADE;
DROP TABLE IF EXISTS civic_trivia.collections CASCADE;
