import { auditQuestion } from '../services/qualityRules/index.js';
import { QuestionInput } from '../services/qualityRules/types.js';

// Test question with ambiguous answers
const ambiguousQuestion: QuestionInput = {
  externalId: 'test-001',
  text: 'What is the capital of the United States?',
  options: [
    'Washington, DC',
    'Washington DC',
    'District of Columbia',
    'New York'
  ],
  correctAnswer: 0,
  explanation: 'Washington, DC is the capital.',
  difficulty: 'easy',
  source: { name: 'Test', url: 'https://example.com' }
};

// Test question with vague qualifiers
const vagueQuestion: QuestionInput = {
  externalId: 'test-002',
  text: 'What is the most important amendment to the Constitution?',
  options: ['First', 'Second', 'Fifth', 'Tenth'],
  correctAnswer: 0,
  explanation: 'This is subjective.',
  difficulty: 'medium',
  source: { name: 'Test', url: 'https://example.com' }
};

// Test pure lookup question
const lookupQuestion: QuestionInput = {
  externalId: 'test-003',
  text: 'In what year was the Taft-Hartley Act passed?',
  options: ['1947', '1948', '1949', '1950'],
  correctAnswer: 0,
  explanation: 'The Taft-Hartley Act was passed in 1947.',
  difficulty: 'hard',
  source: { name: 'Test', url: 'https://example.com' }
};

// Good question (should pass)
const goodQuestion: QuestionInput = {
  externalId: 'test-004',
  text: 'How many senators does each state have in the US Senate?',
  options: ['1', '2', '3', 'It varies by state population'],
  correctAnswer: 1,
  explanation: 'Each state has exactly 2 senators, regardless of population. This ensures equal representation in the Senate.',
  difficulty: 'easy',
  source: { name: 'Constitution', url: 'https://example.com' }
};

// Anachronistic year — past-tense question offering a year that has not arrived
const anachronisticQuestion: QuestionInput = {
  externalId: 'test-anachronism-001',
  text: 'In what year was the new city charter adopted?',
  options: ['2024', '2025', '2026', '2027'],
  correctAnswer: 2,
  explanation: 'The charter was adopted in 2026 after a two-year review.',
  difficulty: 'medium',
  source: { name: 'Test', url: 'https://example.com' }
};

// Forward-looking — legitimately offers future years, must NOT be flagged
const forwardLookingQuestion: QuestionInput = {
  externalId: 'test-anachronism-002',
  text: 'What year will the councilors first face re-election?',
  options: ['2025', '2026', '2027', '2028'],
  correctAnswer: 1,
  explanation: 'They first face re-election in 2026 under the new charter.',
  difficulty: 'medium',
  source: { name: 'Test', url: 'https://example.com' }
};

// queny-059 exactly as it shipped: four nested lower bounds, the correct one not the
// weakest, so three options are true at once.
const nestedOptionsQuestion: QuestionInput = {
  externalId: 'test-007',
  text: 'How many languages are spoken in Queens, according to census research?',
  options: ['More than 50', 'More than 80', 'More than 138', 'More than 200'],
  correctAnswer: 2,
  explanation: 'Research identifies roughly 140 languages spoken across the borough.',
  difficulty: 'easy',
  source: { name: 'Test', url: 'https://example.com' }
};

// The repaired form: non-overlapping approximations, exactly one true.
const repairedBracketsQuestion: QuestionInput = {
  externalId: 'test-008',
  text: 'How many languages are spoken in Queens, according to census research?',
  options: ['About 40', 'About 90', 'About 140', 'About 300'],
  correctAnswer: 2,
  explanation: 'Research identifies roughly 140 languages spoken across the borough.',
  difficulty: 'easy',
  source: { name: 'Test', url: 'https://example.com' }
};

// ica-013: "below" belongs to "below sea level", not a threshold. Must NOT flag.
const seaLevelQuestion: QuestionInput = {
  externalId: 'test-009',
  text: 'What is the elevation of Indio City Hall relative to sea level?',
  options: ['14 feet above sea level', 'At sea level', '14 feet below sea level', '50 feet below sea level'],
  correctAnswer: 2,
  explanation: 'Indio City Hall sits below sea level in the Coachella Valley.',
  difficulty: 'medium',
  source: { name: 'Test', url: 'https://example.com' }
};

// Competing exact spans, not buckets. Overlap does not make a second option true.
const competingSpansQuestion: QuestionInput = {
  externalId: 'test-010',
  text: "Roughly what period did Milwaukee's sewer socialist movement span?",
  options: ['About 1870 to 1900', 'About 1892 to 1960', 'About 1930 to 1945', 'About 1950 to 1980'],
  correctAnswer: 1,
  explanation: 'The movement ran from the 1890s into the 1960s.',
  difficulty: 'hard',
  source: { name: 'Test', url: 'https://example.com' }
};

async function testRules() {
  console.log('=== TESTING QUALITY RULES ===\n');
  
  const result1 = await auditQuestion(ambiguousQuestion, { skipUrlCheck: true });
  console.log('Test 1: Ambiguous answers');
  console.log('- Score:', result1.score);
  console.log('- Blocking violations:', result1.hasBlockingViolations);
  console.log('- Violations:', result1.violations.map(v => `${v.rule} (${v.severity})`).join(', '));
  
  const result2 = await auditQuestion(vagueQuestion, { skipUrlCheck: true });
  console.log('\nTest 2: Vague qualifiers');
  console.log('- Score:', result2.score);
  console.log('- Blocking violations:', result2.hasBlockingViolations);
  console.log('- Violations:', result2.violations.map(v => `${v.rule} (${v.severity})`).join(', '));
  
  const result3 = await auditQuestion(lookupQuestion, { skipUrlCheck: true });
  console.log('\nTest 3: Pure lookup');
  console.log('- Score:', result3.score);
  console.log('- Blocking violations:', result3.hasBlockingViolations);
  console.log('- Violations:', result3.violations.map(v => `${v.rule} (${v.severity})`).join(', '));
  
  const result4 = await auditQuestion(goodQuestion, { skipUrlCheck: true });
  console.log('\nTest 4: Good question');
  console.log('- Score:', result4.score);
  console.log('- Blocking violations:', result4.hasBlockingViolations);
  console.log('- Violations:', result4.violations.map(v => `${v.rule} (${v.severity})`).join(', '));
  
  const result5 = await auditQuestion(anachronisticQuestion, { skipUrlCheck: true });
  console.log('\nTest 5: Anachronistic year (past tense, offers 2027)');
  console.log('- Blocking violations:', result5.hasBlockingViolations);
  console.log('- Violations:', result5.violations.map(v => `${v.rule} (${v.severity})`).join(', '));

  const result6 = await auditQuestion(forwardLookingQuestion, { skipUrlCheck: true });
  console.log('\nTest 6: Forward-looking year (must NOT be flagged)');
  console.log('- Blocking violations:', result6.hasBlockingViolations);
  console.log('- Violations:', result6.violations.map(v => `${v.rule} (${v.severity})`).join(', '));

  const result7 = await auditQuestion(nestedOptionsQuestion, { skipUrlCheck: true });
  console.log('\nTest 7: Nested options, three simultaneously true (queny-059 as shipped)');
  console.log('- Blocking violations:', result7.hasBlockingViolations);
  console.log('- Violations:', result7.violations.map(v => `${v.rule} (${v.severity})`).join(', '));

  const result8 = await auditQuestion(repairedBracketsQuestion, { skipUrlCheck: true });
  console.log('\nTest 8: Repaired non-overlapping brackets (must NOT be flagged)');
  console.log('- Violations:', result8.violations.map(v => `${v.rule} (${v.severity})`).join(', '));

  const result9 = await auditQuestion(seaLevelQuestion, { skipUrlCheck: true });
  console.log('\nTest 9: "below sea level" is not a bound (must NOT be flagged)');
  console.log('- Violations:', result9.violations.map(v => `${v.rule} (${v.severity})`).join(', '));

  const result10 = await auditQuestion(competingSpansQuestion, { skipUrlCheck: true });
  console.log('\nTest 10: Competing exact spans (must NOT be flagged)');
  console.log('- Violations:', result10.violations.map(v => `${v.rule} (${v.severity})`).join(', '));

  console.log('\n=== RESULTS ===');
  console.log('✓ Ambiguous detection:', result1.hasBlockingViolations ? 'WORKS' : 'FAILED');
  console.log('✓ Vague qualifier detection:', result2.hasBlockingViolations ? 'WORKS' : 'FAILED');
  console.log('✓ Pure lookup detection:', result3.hasBlockingViolations ? 'WORKS' : 'FAILED');
  console.log('✓ Good question passes:', !result4.hasBlockingViolations ? 'WORKS' : 'FAILED');
  console.log('✓ Anachronistic year detection:', result5.hasBlockingViolations ? 'WORKS' : 'FAILED');
  console.log('✓ Forward-looking year passes:', !result6.violations.some(v => v.rule === 'anachronistic-year-option') ? 'WORKS' : 'FAILED');
  console.log('✓ Nested options detection:', result7.violations.some(v => v.rule === 'nested-options') ? 'WORKS' : 'FAILED');
  console.log('✓ Repaired brackets pass:', !result8.violations.some(v => v.rule.startsWith('nested-option')) ? 'WORKS' : 'FAILED');
  console.log('✓ Sea-level phrasing passes:', !result9.violations.some(v => v.rule.startsWith('nested-option')) ? 'WORKS' : 'FAILED');
  console.log('✓ Competing spans pass:', !result10.violations.some(v => v.rule.startsWith('nested-option')) ? 'WORKS' : 'FAILED');
}

testRules().catch(console.error);
