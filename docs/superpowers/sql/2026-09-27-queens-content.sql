BEGIN;

INSERT INTO trivia.questions
  (external_id, text, options, correct_answer, explanation, difficulty, topic_id, source, expires_at, status)
VALUES
('queny-209',
 'Which punk rock band formed in the Forest Hills neighborhood of Queens in 1974?',
 '["Talking Heads","Blondie","The Ramones","Television"]'::jsonb, 2,
 'According to Wikipedia, the Ramones formed in Forest Hills, Queens in 1974 and are widely regarded as the first punk rock band. Every member took the stage surname Ramone, though none were related.',
 'easy', 723, '{"name":"Wikipedia","url":"https://en.wikipedia.org/wiki/Ramones"}'::jsonb, NULL, 'active'),

('queny-210',
 'The pioneering hip-hop group Run-DMC came from which Queens neighborhood?',
 '["Astoria","Flushing","Corona","Hollis"]'::jsonb, 3,
 'According to Wikipedia, Run-DMC was formed in Hollis, Queens in 1983 by Joseph Simmons, Darryl McDaniels and Jason Mizell.',
 'easy', 723, '{"name":"Wikipedia","url":"https://en.wikipedia.org/wiki/Run-DMC"}'::jsonb, NULL, 'active'),

('queny-211',
 'Which band played the landmark 1965 concert at Shea Stadium in Queens, often called the first true stadium rock show?',
 '["The Rolling Stones","The Beach Boys","The Beatles","The Who"]'::jsonb, 2,
 'According to Wikipedia, the Beatles opened their 1965 North American tour at Shea Stadium in Queens on 15 August 1965, playing to a crowd that set a new record for a music concert at the time.',
 'easy', 723, '{"name":"Wikipedia","url":"https://en.wikipedia.org/wiki/The_Beatles_at_Shea_Stadium"}'::jsonb, NULL, 'active'),

('queny-212',
 'Which of tennis''s four Grand Slam tournaments is played each year in Flushing Meadows, Queens?',
 '["Wimbledon","The French Open","The Australian Open","The US Open"]'::jsonb, 3,
 'According to Wikipedia, the US Open is held annually at the USTA Billie Jean King National Tennis Center in Flushing Meadows, Queens, where it has been staged since 1978.',
 'easy', 725, '{"name":"Wikipedia","url":"https://en.wikipedia.org/wiki/US_Open_(tennis)"}'::jsonb, NULL, 'active'),

('queny-213',
 'Which bridge, renamed in honour of Robert F. Kennedy, links Queens with Manhattan and the Bronx?',
 '["The Queensboro Bridge","The Robert F. Kennedy Bridge","The Throgs Neck Bridge","The Bronx-Whitestone Bridge"]'::jsonb, 1,
 'According to Wikipedia, the Robert F. Kennedy Bridge connects Manhattan, Queens and the Bronx. Locals still widely call it by its name prior to 2008, the Triborough Bridge.',
 'easy', 726, '{"name":"Wikipedia","url":"https://en.wikipedia.org/wiki/Robert_F._Kennedy_Bridge"}'::jsonb, NULL, 'active'),

('queny-214',
 'Who serves as New York City''s Public Advocate?',
 '["Melinda Katz","Donovan Richards Jr.","Jumaane Williams","Mark Levine"]'::jsonb, 2,
 'According to Wikipedia, Jumaane Williams has served as New York City Public Advocate since 2019 and was re-elected in November 2025. The Public Advocate is elected citywide and is first in line to succeed the Mayor.',
 'medium', 721, '{"name":"Wikipedia","url":"https://en.wikipedia.org/wiki/Jumaane_Williams"}'::jsonb, '2029-12-31', 'active'),

('queny-215',
 'New York City''s Comptroller audits city agencies and manages the city''s pension funds. Who currently holds that office?',
 '["Jumaane Williams","Brad Lander","Julie Menin","Mark Levine"]'::jsonb, 3,
 'According to Wikipedia, Mark D. Levine has served as Comptroller of New York City since January 2026, succeeding Brad Lander.',
 'medium', 721, '{"name":"Wikipedia","url":"https://en.wikipedia.org/wiki/Mark_D._Levine"}'::jsonb, '2029-12-31', 'active'),

('queny-216',
 'In January 2026 the New York City Council unanimously elected which of its members as Speaker?',
 '["Julie Menin","Nantasha Williams","Adrienne Adams","Jumaane Williams"]'::jsonb, 0,
 'According to Wikipedia, the New York City Council unanimously elected Julie Menin as Speaker on 7 January 2026. The Speaker presides over the Council, the citywide legislature on which Queens residents are represented.',
 'medium', 721, '{"name":"Wikipedia","url":"https://en.wikipedia.org/wiki/Julie_Menin"}'::jsonb, '2029-12-31', 'active');

-- Fix 1: queny-059 had four NESTED options ("More than 50/80/138/200"). If "more than 138"
-- is correct then "more than 50" and "more than 80" are also true - three correct answers.
UPDATE trivia.questions
SET options = '["About 40","About 90","About 140","About 300"]'::jsonb,
    correct_answer = 2,
    explanation = 'According to Wikipedia, research on Queens has identified roughly 140 languages spoken across the borough, one of the highest counts of any place on earth.',
    expires_at = '2028-06-30',
    updated_at = now()
WHERE external_id = 'queny-059';

-- Fix 2: volatile American Community Survey statistic, previously carrying no expiry.
UPDATE trivia.questions
SET expires_at = '2027-06-30', updated_at = now()
WHERE external_id = 'queny-071';

-- Guarded link into the collection (never the bare LIKE form).
INSERT INTO trivia.collection_questions (collection_id, question_id, created_at)
SELECT 262, q.id, now() FROM trivia.questions q
WHERE q.external_id IN ('queny-209','queny-210','queny-211','queny-212','queny-213','queny-214','queny-215','queny-216')
  AND q.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM trivia.collection_questions cq WHERE cq.question_id = q.id);

COMMIT;

-- ---------------------------------------------------------------------------
-- Applied as above, then queny-212 was rewritten in place. As first written it
-- asked which Grand Slam is played in Flushing Meadows; queny-055's own text
-- states that answer ("Before the US Open tennis tournament moved to Flushing
-- Meadows in 1978..."), so it was replaced before the pass was called done.
-- ---------------------------------------------------------------------------
BEGIN;
UPDATE trivia.questions SET
  text = 'Which expressway carries traffic across Queens from the Queens-Midtown Tunnel eastward onto Long Island?',
  options = '["The Belt Parkway","The Long Island Expressway","The Grand Central Parkway","The Van Wyck Expressway"]'::jsonb,
  correct_answer = 1,
  explanation = 'According to Wikipedia, the Long Island Expressway (Interstate 495) begins at the Queens-Midtown Tunnel and runs east across Queens into Nassau and Suffolk counties. The Belt, Grand Central and Van Wyck are also Queens routes, but none is the tunnel-to-Long Island spine.',
  difficulty = 'easy',
  topic_id = 726,
  source = '{"name":"Wikipedia","url":"https://en.wikipedia.org/wiki/Long_Island_Expressway"}'::jsonb,
  updated_at = now()
WHERE external_id = 'queny-212';
COMMIT;
