BEGIN;

INSERT INTO trivia.questions
  (external_id, text, options, correct_answer, explanation, difficulty, topic_id, source, expires_at, status)
VALUES
-- Durable. Phrased so the ANSWER is the crop, not "Oregon" - a "which state leads in X"
-- question inside the Oregon collection is guessable from the collection alone, which is
-- the defect that got queny-137 archived.
('ore-209',
 'Oregon grows about 99% of the United States'' supply of which nut?',
 '["Almonds","Hazelnuts","Pecans","Walnuts"]'::jsonb, 1,
 'According to the Oregon Encyclopedia, Oregon growers produce roughly 99 percent of the hazelnuts grown in the United States, almost all of them in the Willamette Valley, whose mild climate and volcanic soils suit the crop.',
 'easy', 493, '{"name":"The Oregon Encyclopedia","url":"https://www.oregonencyclopedia.org/articles/hazelnut_industry/"}'::jsonb, NULL, 'active'),

('ore-210',
 'Oregon leads every other state in growing which seasonal crop, supplying roughly a third of the national market?',
 '["Pumpkins","Christmas trees","Cranberries","Poinsettias"]'::jsonb, 1,
 'According to Oregon State University Extension, Oregon is the nation''s leading Christmas tree producer, selling about 3.2 million trees in 2023 - close to one in every three cut in the United States. Noble and Douglas firs are the main species.',
 'easy', 493, '{"name":"Oregon State University Extension Service","url":"https://extension.oregonstate.edu/news/oregon-maintains-top-christmas-tree-producer-title-adapting"}'::jsonb, NULL, 'active'),

-- Expiring, and deliberately NOT a seventh "Who is X as of 2026?". The six officeholder
-- questions already in this collection all share that one shape; adding another would
-- compound the repeated-shape defect the Queens audit was about. A volatile statistic
-- carries the expiry instead, the same way queny-207 does for Queens.
('ore-211',
 'Roughly how many people live in Oregon?',
 '["About 2.6 million","About 4.3 million","About 6.1 million","About 8.4 million"]'::jsonb, 1,
 'According to Wikipedia, citing US Census Bureau estimates, Oregon''s population is roughly 4.3 million, making it the 27th most populous state. Growth has been close to flat since 2020.',
 'medium', 489, '{"name":"Wikipedia","url":"https://en.wikipedia.org/wiki/Oregon"}'::jsonb, '2027-12-31', 'active');

-- Guarded link into the collection (never the bare LIKE form).
INSERT INTO trivia.collection_questions (collection_id, question_id, created_at)
SELECT 79, q.id, now() FROM trivia.questions q
WHERE q.external_id IN ('ore-209','ore-210','ore-211')
  AND q.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM trivia.collection_questions cq WHERE cq.question_id = q.id);

COMMIT;
