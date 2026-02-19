import 'dotenv/config';
import { db } from '../db/index.js';
import { collections, questions } from '../db/schema.js';
import { sql, inArray } from 'drizzle-orm';

async function activate() {
  try {
    // Activate collections
    const result1 = await db
      .update(collections)
      .set({ isActive: true, updatedAt: sql`NOW()` })
      .where(inArray(collections.slug, ['bloomington-in', 'los-angeles-ca']))
      .returning();

    console.log('Collections activated:', result1.map(c => c.slug));

    // Activate Bloomington questions
    const result2 = await db
      .update(questions)
      .set({ status: 'active', updatedAt: sql`NOW()` })
      .where(sql`${questions.externalId} LIKE 'bli-%' AND ${questions.status} = 'draft'`)
      .returning({ externalId: questions.externalId });

    console.log('Bloomington questions activated:', result2.length);

    // Activate LA questions
    const result3 = await db
      .update(questions)
      .set({ status: 'active', updatedAt: sql`NOW()` })
      .where(sql`${questions.externalId} LIKE 'lac-%' AND ${questions.status} = 'draft'`)
      .returning({ externalId: questions.externalId });

    console.log('LA questions activated:', result3.length);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

activate();
