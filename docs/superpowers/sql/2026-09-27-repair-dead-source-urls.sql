BEGIN;

-- Bulk: dead URL -> verified live replacement (all re-checked HTTP 200 this session).
UPDATE trivia.questions q
SET source = jsonb_build_object('name', m.nm, 'url', m.nu), updated_at = now()
FROM (VALUES
 ('https://bloomington.in.gov/finance/budget','https://bloomington.in.gov/budget','City of Bloomington'),
 ('https://clerk.lacity.gov/clerk-services/legislative-and-records-management/city-charter','https://en.wikipedia.org/wiki/Government_of_Los_Angeles','Wikipedia'),
 ('https://en.wikipedia.org/wiki/Dave_McCormick_(politician)','https://en.wikipedia.org/wiki/Dave_McCormick','Wikipedia'),
 ('https://interurbanrailwaymuseum.org/mission','https://planoconservancy.org/interurban-railway-museum/','Plano Conservancy for Historic Preservation'),
 ('https://lacity.gov/city-government/about-la','https://en.wikipedia.org/wiki/Los_Angeles','Wikipedia'),
 ('https://sos.oregon.gov/blue-book/Pages/facts-symbols.aspx','https://sos.oregon.gov/blue-book/Pages/explore-symbols.aspx','Oregon Blue Book'),
 ('https://sos.oregon.gov/blue-book/Pages/facts/symbols.aspx','https://sos.oregon.gov/blue-book/Pages/explore-symbols.aspx','Oregon Blue Book'),
 ('https://sos.oregon.gov/blue-book/Pages/facts/elections.aspx','https://en.wikipedia.org/wiki/Oregon_Ballot_Measure_60_(1998)','Wikipedia'),
 ('https://sos.oregon.gov/blue-book/Pages/facts/geography.aspx','https://en.wikipedia.org/wiki/Willamette_Valley','Wikipedia'),
 ('https://tarpits.org/experience-pits/about','https://tarpits.org/','La Brea Tar Pits and Museum'),
 ('https://unfccc.int/sites/default/files/english_paris_agreement.pdf','https://unfccc.int/sites/default/files/resource/parisagreement_publication.pdf','UNFCCC - text of the Paris Agreement'),
 ('https://www.assembly.ca.gov/content/about-assembly','https://en.wikipedia.org/wiki/California_State_Assembly','Wikipedia'),
 ('https://www.bbc.co.uk/news/world-asia-58393329','https://en.wikipedia.org/wiki/Withdrawal_of_United_States_troops_from_Afghanistan_(2020%E2%80%932021)','Wikipedia'),
 ('https://www.bbc.co.uk/news/world-middle-east-56523659','https://en.wikipedia.org/wiki/2021_Suez_Canal_obstruction','Wikipedia'),
 ('https://www.boe.ca.gov/proptaxes/prop13.htm','https://en.wikipedia.org/wiki/1978_California_Proposition_13','Wikipedia'),
 ('https://www.dof.ca.gov/budget/budget_frequently_asked_questions/','https://en.wikipedia.org/wiki/Government_of_California','Wikipedia'),
 ('https://www.fs.usda.gov/hellscanyon','https://en.wikipedia.org/wiki/Hells_Canyon','Wikipedia'),
 ('https://www.glo.texas.gov/the-alamo/','https://www.thealamo.org/','The Alamo'),
 ('https://www.in.gov/courts/about/structure/','https://www.in.gov/courts/','Indiana Judicial Branch'),
 ('https://www.in.gov/doe/schools/school-funding/','https://www.in.gov/doe/','Indiana Department of Education'),
 ('https://www.in.gov/dor/tax-forms/individual-income-taxes/','https://www.in.gov/dor/','Indiana Department of Revenue'),
 ('https://www.in.gov/history/about-indiana-history-and-trivia/indiana-history/','https://www.in.gov/history/','Indiana Historical Bureau'),
 ('https://www.in.gov/history/about-indiana-history/indiana-constitution/','https://en.wikipedia.org/wiki/Constitution_of_Indiana','Wikipedia'),
 ('https://www.in.gov/history/about-indiana-history/indiana-history/indiana-becomes-a-state/','https://en.wikipedia.org/wiki/Constitution_of_Indiana','Wikipedia'),
 ('https://www.in.gov/history/about-indiana-history/indiana-history/the-constitution-of-1851/','https://en.wikipedia.org/wiki/Constitution_of_Indiana','Wikipedia'),
 ('https://www.in.gov/library/files/Indiana_Constitution_History.pdf','https://en.wikipedia.org/wiki/Constitution_of_Indiana','Wikipedia'),
 ('https://www.in.gov/lgov/','https://www.in.gov/lg/','Office of the Indiana Lieutenant Governor'),
 ('https://www.in.gov/sos/elections/voter-information/absentee-voting/','https://www.in.gov/sos/elections/voter-information/','Indiana Secretary of State'),
 ('https://www.in.gov/sos/elections/voter-information/voter-id/','https://www.in.gov/sos/elections/voter-information/','Indiana Secretary of State'),
 ('https://www.kcur.org/arts-life/2021-08-25/chef-david-leong-invented-springfield-style-cashew-chicken','https://www.kcur.org/arts-life/2021-08-25/springfield-cashew-chicken-missouri-chinese-food-david-leong','KCUR'),
 ('https://www.lacity.gov/about-la','https://en.wikipedia.org/wiki/Los_Angeles','Wikipedia'),
 ('https://www.lacity.gov/government/popular-information/city-government-la-101/elected-officials','https://en.wikipedia.org/wiki/Los_Angeles_City_Council','Wikipedia'),
 ('https://www.lacitysan.org/san/faces/home/portal/s/wpc/stormwater','https://www.lacitysan.org/','LA Sanitation and Environment'),
 ('https://www.ladwp.com/about-us','https://www.ladwp.com/who-we-are','Los Angeles Department of Water and Power'),
 ('https://www.ladwp.com/water/water-system','https://en.wikipedia.org/wiki/Los_Angeles_Aqueduct','Wikipedia'),
 ('https://www.library.ca.gov/california-history/state-history/','https://en.wikipedia.org/wiki/California','Wikipedia'),
 ('https://www.norwich.gov.uk/bins-recycling-and-littering','https://www.norwich.gov.uk/info/20011/about_your_council','Norwich City Council'),
 ('https://www.norwich.gov.uk/council','https://www.norwich.gov.uk/info/20190/councillors_and_decision_making/1315/councillors','Norwich City Council'),
 ('https://www.norwich.gov.uk/environmental-health','https://www.norwich.gov.uk/info/20011/about_your_council','Norwich City Council'),
 ('https://www.norwich.gov.uk/leisure-and-culture','https://www.norwich.gov.uk/info/20011/about_your_council','Norwich City Council'),
 ('https://www.norwich.gov.uk/lord-mayor','https://en.wikipedia.org/wiki/Norwich_City_Council','Wikipedia'),
 ('https://www.nps.gov/jela/learn/historyculture/acadian-history.htm','https://en.wikipedia.org/wiki/Acadians','Wikipedia'),
 ('https://www.portoflosangeles.org/about/facts-and-figures','https://en.wikipedia.org/wiki/Port_of_Los_Angeles','Wikipedia'),
 ('https://www.queensbp.org/','https://en.wikipedia.org/wiki/Queens','Wikipedia'),
 ('https://www.santamonica.gov/rent-control','https://en.wikipedia.org/wiki/Santa_Monica,_California','Wikipedia'),
 ('https://www.sos.ca.gov/archives/collections/1850','https://en.wikipedia.org/wiki/California','Wikipedia'),
 ('https://www.sos.ca.gov/elections/ballot-measures/how-initiatives-qualify','https://www.sos.ca.gov/elections/ballot-measures','California Secretary of State'),
 ('https://www.sos.ca.gov/elections/ballot-measures/initiative-and-referendum','https://www.sos.ca.gov/elections/ballot-measures','California Secretary of State'),
 ('https://www.sos.ca.gov/elections/ballot-measures/initiative-and-referendum-process','https://www.sos.ca.gov/elections/ballot-measures','California Secretary of State'),
 ('https://www.sos.ca.gov/elections/ballot-measures/initiative-process','https://www.sos.ca.gov/elections/ballot-measures','California Secretary of State'),
 ('https://www.sos.ca.gov/elections/voter-registration/initiatives','https://www.sos.ca.gov/elections/ballot-measures','California Secretary of State'),
 ('https://www.sos.ca.gov/elections/voter-registration/voting-california/initiatives','https://www.sos.ca.gov/elections/ballot-measures','California Secretary of State'),
 ('https://www.supremecourt.gov/opinions/06pdf/05-1120.pdf','https://en.wikipedia.org/wiki/Massachusetts_v._EPA','Wikipedia'),
 ('https://www.treasurer.ca.gov/about/index.asp','https://www.treasurer.ca.gov/','California State Treasurer'),
 ('https://www.unep.org/ozonaction/kigali-amendment','https://en.wikipedia.org/wiki/Kigali_Amendment','Wikipedia')
) AS m(ou, nu, nm)
WHERE q.source->>'url' = m.ou AND q.status = 'active';

-- Per-question overrides ---------------------------------------------------

-- queny-208's claim is about Jamaica specifically, not Queens generally.
UPDATE trivia.questions
SET source = '{"name":"Wikipedia","url":"https://en.wikipedia.org/wiki/Jamaica,_Queens"}'::jsonb, updated_at = now()
WHERE external_id = 'queny-208';

-- ica-014: correct as written (Jeff Gonzalez, AD-36); only the source was dead.
UPDATE trivia.questions
SET source = '{"name":"Wikipedia","url":"https://en.wikipedia.org/wiki/Jeff_Gonzalez"}'::jsonb, updated_at = now()
WHERE external_id = 'ica-014';

-- ica-001 was WRONG, not merely unsourced. Indio's mayor is Elaine Holmes;
-- Waymond Fermon is Mayor Pro Tem. The council rotates the mayoralty at its
-- first meeting each December, so the distractors should be fellow members.
UPDATE trivia.questions SET
  options = '["Waymond Fermon","Oscar Ortiz","Elaine Holmes","Glenn Miller"]'::jsonb,
  correct_answer = 2,
  explanation = 'According to Wikipedia, Elaine Holmes serves as Mayor of Indio. Indio does not elect its mayor directly - the City Council selects one of its own members as Mayor on a rotational basis at its first meeting each December, so the office changes hands yearly.',
  source = '{"name":"Wikipedia","url":"https://en.wikipedia.org/wiki/Indio,_California"}'::jsonb,
  expires_at = '2026-12-01',
  updated_at = now()
WHERE external_id = 'ica-001';

-- ashnc-006 conflated two dates: DK Wesley was sworn in 8 January 2026 and the
-- appointment took effect on 12 January. The question asserted the 12th as the
-- swearing-in date. Reworded so it no longer states a wrong date.
UPDATE trivia.questions SET
  text = 'Who became Asheville''s City Manager in January 2026?',
  explanation = 'According to the City of Asheville, Dakisha "DK" Wesley was named City Manager and was sworn in on 8 January 2026, with the appointment taking effect on 12 January. She had previously served as an Assistant County Manager for Buncombe County.',
  source = '{"name":"City of Asheville","url":"https://www.ashevillenc.gov/news/asheville-city-council-names-dk-wesley-as-new-city-manager/"}'::jsonb,
  updated_at = now()
WHERE external_id = 'ashnc-006';

COMMIT;
