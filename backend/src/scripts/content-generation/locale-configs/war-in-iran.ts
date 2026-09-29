import type { LocaleConfig } from './bloomington-in.js';

/**
 * War in Iran — Events-Focused collection configuration.
 *
 * REWRITTEN 2026-09-29. What was here before was the CITY template, unedited:
 * topic categories reading "War in Iran city government — mayor, city council,
 * departments, and municipal services", "War in Iran utilities, parks and
 * recreation", a distribution across those three, and `sourceUrls: []` with a
 * TODO. The collection has been live in production the whole time.
 *
 * That stub is why two questions about EUROPEAN HEAT PUMP SALES were sitting in
 * this collection: `pipelineCron` re-ingests the same feeds once per registered
 * news collection, and nothing here told it what this collection is about.
 *
 * ── How this collection is fed ──────────────────────────────────────────────
 * Registered in `pipelineCron.ts` as { collectionSlug: 'war-in-iran', prefix:
 * 'wiran', volatility: 'fast' }. The nightly pipeline supplies the EXPIRING
 * layer and stamps it with short TTLs — three and four days, in practice.
 *
 * So the readiness gate's 15–30% expiring target does NOT read the same way here
 * as on a locale collection. On an Events-Focused collection the ratio measures
 * how recently the pipeline ran, not the health of the bank (session 9,
 * `climate-change`). Do not manufacture expiring questions to hit the floor;
 * that re-arms the same cliff a fortnight later.
 *
 * ── The baseline is the point ───────────────────────────────────────────────
 * Chris's direction, 2026-09-29: this collection needs durable history that
 * gives it a foundation beyond the expiring layer. It now carries 54 durable
 * questions (`wiran-0016`–`0040`, `wiran-1730`, `wiran-1734`–`1761`), which is
 * what keeps it above the 50-question floor between pipeline bursts.
 *
 * **The pipeline does not write baseline questions and should not be expected
 * to.** Baseline growth is a hand-written job against the sources below.
 *
 * ── A trap the pipeline sets ────────────────────────────────────────────────
 * It stamps an expiry on everything it writes, including facts that are
 * permanently true. `wiran-1730` — "in what month and year did the war break
 * out" — was given a four-day expiry. The date a war started does not stop being
 * true. **When reviewing pipeline output, promote the durable ones** by clearing
 * `expires_at` rather than letting them lapse.
 *
 * ── CRITICAL ACCURACY NOTES ─────────────────────────────────────────────────
 * - Iranians are PERSIAN, not Arab; the language is PERSIAN (Farsi), not Arabic.
 * - The SUPREME LEADER is head of state and outranks the elected president on
 *   defence, foreign policy and the nuclear file. Do not call the president
 *   Iran's leader.
 * - SIX statewide-equivalent bodies are easy to confuse: the Guardian Council
 *   (12 members, vets candidates and vetoes legislation), the Assembly of
 *   Experts (88 elected clerics, appoints and can dismiss the Supreme Leader),
 *   the Expediency Council, the Majlis (parliament), the Supreme National
 *   Security Council and the IRGC. They are not interchangeable.
 * - The IRGC is a PARALLEL military to the regular armed forces, not a branch of
 *   them. The Basij is one of the IRGC's five branches. The Quds Force is the
 *   IRGC's external arm.
 * - Iran IS a party to the Non-Proliferation Treaty. India, Pakistan and Israel
 *   are not; North Korea withdrew.
 * - The Strait of Hormuz is about 21 NAUTICAL miles at its narrowest (~24 statute
 *   miles) and is shared between Iranian and Omani waters — not Iranian alone.
 * - Iran's proxies cross the Sunni–Shia line: Hamas is Sunni and Iran-backed. The
 *   Taliban are NOT part of the Axis of Resistance.
 * - Dates that are repeatedly got wrong: the 1953 coup; the revolution in 1979;
 *   the hostage crisis running 444 days to January 1981; the Iran–Iraq War
 *   1980–88 ending on the prewar borders; Iran Air 655 shot down in 1988;
 *   the JCPOA signed 2015 and the US withdrawal in 2018; Soleimani killed
 *   January 2020; the first direct Iranian strike on Israel April 2024; the
 *   Twelve-Day War 13–24 June 2025; the current war from February 2026.
 * - Write neutrally. This is a live armed conflict; state what happened and who
 *   says what, and do not adopt either side's framing.
 */
export const warInIranConfig: LocaleConfig = {
  locale: 'war-in-iran',
  name: 'War in Iran',
  externalIdPrefix: 'wiran',
  collectionSlug: 'war-in-iran',
  targetQuestions: 100,
  batchSize: 25,

  topicCategories: [
    {
      slug: 'iran-state-and-society',
      name: 'How Iran Is Governed',
      description:
        'Iran\'s political structure: the Supreme Leader and the elected president, the Guardian Council, the Assembly of Experts, the Majlis, the IRGC and the Basij. Also the country itself — Tehran, the Persian language and identity, geography from the Caspian to the Gulf.',
    },
    {
      slug: 'iran-history',
      name: 'How It Got Here',
      description:
        'The 1906 Constitutional Revolution, the Pahlavi era and SAVAK, the 1953 coup, the 1979 revolution and hostage crisis, the Iran–Iraq War, the Green Movement, and the 2022 Woman, Life, Freedom protests.',
    },
    {
      slug: 'iran-nuclear-and-sanctions',
      name: 'The Nuclear File',
      description:
        'Enrichment and the sites that do it, the IAEA and the Non-Proliferation Treaty, Stuxnet, the 2015 deal and its snapback mechanism, the 2018 US withdrawal, and the sanctions architecture.',
    },
    {
      slug: 'iran-region',
      name: 'The Region',
      description:
        'The Axis of Resistance — Hezbollah, Hamas, the Houthis, Iraqi and Syrian militias — the Strait of Hormuz and Red Sea shipping, and Iran\'s relations with its neighbours.',
    },
    {
      slug: 'iran-current-conflict',
      name: 'The Conflict',
      description:
        'The direct Iran–Israel exchanges of 2024, the Twelve-Day War of June 2025 and the US strikes within it, and the war that began in February 2026. Expiring pipeline output lands here.',
    },
  ],

  topicDistribution: {
    'iran-state-and-society': 20,
    'iran-history': 25,
    'iran-nuclear-and-sanctions': 20,
    'iran-region': 15,
    'iran-current-conflict': 20,
  },

  /**
   * Baseline sources. All 38 titles used by this collection were checked in a
   * single MediaWiki API call (`action=query&titles=A|B|C&redirects=1`) rather
   * than fetched one at a time — three turned out to be redirects and are listed
   * here at their canonical titles.
   */
  sourceUrls: [
    'https://en.wikipedia.org/wiki/Iran',
    'https://en.wikipedia.org/wiki/Politics_of_Iran',
    'https://en.wikipedia.org/wiki/Guardian_Council',
    'https://en.wikipedia.org/wiki/Assembly_of_Experts',
    'https://en.wikipedia.org/wiki/Basij',
    'https://en.wikipedia.org/wiki/Islamic_Revolutionary_Guard_Corps',
    'https://en.wikipedia.org/wiki/Quds_Force',
    'https://en.wikipedia.org/wiki/Guardianship_of_the_Islamic_Jurist',
    'https://en.wikipedia.org/wiki/Name_of_Iran',
    'https://en.wikipedia.org/wiki/Persian_Constitutional_Revolution',
    'https://en.wikipedia.org/wiki/White_Revolution',
    'https://en.wikipedia.org/wiki/SAVAK',
    'https://en.wikipedia.org/wiki/1953_Iranian_coup_d%27%C3%A9tat',
    'https://en.wikipedia.org/wiki/Iranian_Revolution',
    'https://en.wikipedia.org/wiki/Iran_hostage_crisis',
    'https://en.wikipedia.org/wiki/Iran%E2%80%93Iraq_War',
    'https://en.wikipedia.org/wiki/Iran_Air_Flight_655',
    'https://en.wikipedia.org/wiki/Iranian_Green_Movement',
    'https://en.wikipedia.org/wiki/Mahsa_Amini_protests',
    'https://en.wikipedia.org/wiki/Ebrahim_Raisi',
    'https://en.wikipedia.org/wiki/Ali_Khamenei',
    'https://en.wikipedia.org/wiki/Nuclear_program_of_Iran',
    'https://en.wikipedia.org/wiki/Fordow_Uranium_Enrichment_Plant',
    'https://en.wikipedia.org/wiki/Natanz',
    'https://en.wikipedia.org/wiki/Stuxnet',
    'https://en.wikipedia.org/wiki/Iran_nuclear_deal',
    'https://en.wikipedia.org/wiki/International_Atomic_Energy_Agency',
    'https://en.wikipedia.org/wiki/Treaty_on_the_Non-Proliferation_of_Nuclear_Weapons',
    'https://en.wikipedia.org/wiki/Atoms_for_Peace',
    'https://en.wikipedia.org/wiki/Axis_of_evil',
    'https://en.wikipedia.org/wiki/Axis_of_Resistance',
    'https://en.wikipedia.org/wiki/Hezbollah',
    'https://en.wikipedia.org/wiki/Houthis',
    'https://en.wikipedia.org/wiki/Strait_of_Hormuz',
    'https://en.wikipedia.org/wiki/Assassination_of_Qasem_Soleimani',
    'https://en.wikipedia.org/wiki/April_2024_Iranian_strikes_on_Israel',
    'https://en.wikipedia.org/wiki/October_2024_Iranian_strikes_on_Israel',
    'https://en.wikipedia.org/wiki/Twelve-Day_War',
  ],
};
