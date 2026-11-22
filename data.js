// =========================================================================
// LIGHTHOUSE — SHARED DATA, LIBRARIES, NAVIGATION MAP & INITIAL STATE
// =========================================================================

export const STORAGE_KEY = 'lighthouse_v3_state';

export const SUPABASE_CONFIG = {
  url: 'https://apgfskdxexlyyavmhdlg.supabase.co',
  anonKey: 'sb_publishable_rvwuan8wg1tyegGFSt2jMA_E1CJaM5L',
  schema: 'Lighthouse'
};

// Maps every station tab to its dedicated HTML file
export const NAV_STATIONS = [
  { id: 'calendar', page: 'index.html', label: 'Watchtower (24h)', shortLabel: '24h Watch', icon: 'compass' },
  { id: 'workouts', page: 'index.html', label: 'Training & Workouts', shortLabel: 'Workouts', icon: 'dumbbell' },
  { id: 'lists', page: 'index.html', label: 'Harbor Wall Lists', shortLabel: 'Lists', icon: 'check-square' },
  { id: 'morning', page: 'sanctuary.html', label: 'Morning Watch & Rest', shortLabel: 'Morning', icon: 'sun' },
  { id: 'night', page: 'sanctuary.html', label: 'Night Watch & Log', shortLabel: 'Night', icon: 'moon' },
  { id: 'prayer', page: 'sanctuary.html', label: 'Prayer Sanctuary', shortLabel: 'Prayer', icon: 'heart' },
  { id: 'goals', page: 'command.html', label: 'Charted Course & Log', shortLabel: 'Course & Log', icon: 'target' },
  { id: 'launchpad', page: 'command.html', label: 'Fleet Dock (Sites)', shortLabel: 'Sites', icon: 'layout-grid' },
  { id: 'settings', page: 'command.html', label: 'Themes & Filters', shortLabel: 'Settings', icon: 'sliders-horizontal' }
];

// =========================================================================
// 4 HARMONIOUS COLOR THEMES (COLOR THEORY DESIGNED)
// =========================================================================
export const COLOR_THEMES = [
  {
    id: 'nordic',
    name: 'Nordic Harbor (Default)',
    subtitle: 'Deep slate navy with warm brass accents — balanced low-glare contrast',
    swatches: ['#0b111e', '#121b2d', '#e09f3e', '#4ea8de']
  },
  {
    id: 'daylight',
    name: 'Coastal Daylight',
    subtitle: 'Warm alabaster paper, sand & deep maritime navy — crisp daytime legibility',
    swatches: ['#f6f4f0', '#ffffff', '#1d4e89', '#b5651d']
  },
  {
    id: 'deepsea',
    name: 'Deep Sea Watch',
    subtitle: 'Midnight abyssal teal with soft seafoam — zero harsh glare for evening focus',
    swatches: ['#071318', '#0d1f27', '#48bfe3', '#f4a261']
  },
  {
    id: 'olive',
    name: 'Olive Sanctuary',
    subtitle: 'Monastic warm charcoal, sage leaf & terracotta — grounded organic stillness',
    swatches: ['#141613', '#1d201b', '#a3b18a', '#d4a373']
  }
];

export const WORKOUT_MODALITIES = [
  'Indoor Spinning',
  'Outdoor Cycling (Road)',
  'Outdoor Cycling (Single-Track)',
  'Lifting (Video-Led)',
  'Pilates / Mobility',
  'Yoga',
  'Walking',
  'Custom / Other...'
];

export const PRAYER_CATEGORY_OPTIONS = [
  'Marriage & Regla',
  'Family & Sons',
  'Church & Safety Team',
  'Work & Arborist Wisdom',
  'Personal Walk',
  'Health & Strength',
  'Friends & Neighbors',
  'Mission & Witness',
  'Other / General',
  'Custom Category...'
];

// =========================================================================
// DATE HELPERS
// =========================================================================
export function getLocalIsoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getDayOffsetFromIsoDate(dateStr) {
  if (!dateStr) return 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - todayMid) / 86400000);
}

export const TODAY_ISO = getLocalIsoDate(0);
export const YESTERDAY_ISO = getLocalIsoDate(-1);
export const TOMORROW_ISO = getLocalIsoDate(1);

// =========================================================================
// EXPANDED MORNING WATCH & REST LIBRARY (22 CARDS ACROSS 5 CATEGORIES)
// =========================================================================
export const MORNING_LIBRARY = [
  // CATEGORY 1: 30-Min Wake-to-Workout Launch Ramp
  {
    id: 'mw-1',
    title: 'Minute 0–3: Feet on Floor & Bright Light Pulse',
    category: 'Wake-to-Workout (30m Ramp)',
    durationMins: 3,
    defaultTime: '05:30',
    summary: 'Immediate vertical posture + outdoor or bright overhead light to halt melatonin.',
    neuroPrinciple: 'Cortisol Awakening Response (CAR) Ignition',
    scienceDetail: 'Staying horizontal in a dim bedroom lets sleep inertia (adenosine + melatonin) linger for up to 90 minutes. Stepping onto the floor and viewing bright light within 3 minutes signals the suprachiasmatic nucleus (SCN) to trigger a clean epinephrine and cortisol pulse.',
    scriptureRef: 'Ephesians 5:14',
    scriptureDetail: 'Awake, O sleeper, and arise—shaking off sluggishness in the first 180 seconds.',
    actionSteps: '1. No snooze button. 2. Stand up immediately. 3. Step onto the porch or turn on bright daylight bulbs while putting on training shorts.'
  },
  {
    id: 'mw-2',
    title: 'Minute 3–8: 14oz Warm Water + Pinch of Sea Salt',
    category: 'Wake-to-Workout (30m Ramp)',
    durationMins: 5,
    defaultTime: '05:33',
    summary: 'Rapid blood-volume expansion for tendon perfusion and cardiac output before training.',
    neuroPrinciple: 'Plasma Volume & Baroreceptor Priming',
    scienceDetail: 'You lose ~500ml of water overnight via respiration. Training dehydrated reduces joint synovial lubrication and spikes perceived exertion. Warm water with sodium absorbs rapidly across the gut wall.',
    scriptureRef: 'Proverbs 3:7-8',
    scriptureDetail: 'Refreshing the body’s frame and bones before asking them to bear load.',
    actionSteps: 'Drink 12–16oz of room-temp or warm water with a pinch of salt or electrolytes before any coffee.'
  },
  {
    id: 'mw-3',
    title: 'Minute 8–14: Pre-Workout Breath & Neural Drive Primer',
    category: 'Wake-to-Workout (30m Ramp)',
    durationMins: 6,
    defaultTime: '05:38',
    summary: '15 brisk nasal breaths + 1-verse morning consecration to wake up motor cortex drive.',
    neuroPrinciple: 'Sympathetic Motor Unit Recruitment',
    scienceDetail: 'Before lifting or spinning early in the morning, central nervous system (CNS) motor unit recruitment is low. Brisk nasal inhales slightly elevate alertness without jitteriness.',
    scriptureRef: 'Psalm 18:32-34',
    scriptureDetail: 'It is God who arms me with strength and makes my way secure.',
    actionSteps: 'Perform 15 deep nasal inhales with crisp exhales, read one verse of focus, and step toward your workout space.'
  },
  {
    id: 'mw-4',
    title: 'Minute 14–22: Core Temp & Synovial Tendon Ramp',
    category: 'Wake-to-Workout (30m Ramp)',
    durationMins: 8,
    defaultTime: '05:44',
    summary: 'Unloaded joint CARs (hips, shoulders, spine, ankles) to heat stiff morning discs and tendons.',
    neuroPrinciple: 'Intervertebral Disc & Tendon Viscoelasticity',
    scienceDetail: 'During sleep, spinal discs super-hydrate and swell, making cold heavy flexion risky in the first 20 minutes awake. Controlled articular rotations (CARs) and bodyweight squats warm collagen fibers safely.',
    scriptureRef: '1 Corinthians 9:25-27',
    scriptureDetail: 'Disciplining the body with wisdom so you can train consistently for decades.',
    actionSteps: 'Cat-cow x8, thoracic rotations x6/side, deep squat pry x60s, scapular pushups x10, glute bridges x12.'
  },
  {
    id: 'mw-5',
    title: 'Minute 22–30: First Warm-Up Set / Spin Cadence Ignition',
    category: 'Wake-to-Workout (30m Ramp)',
    durationMins: 8,
    defaultTime: '05:52',
    summary: 'Cross the threshold into your actual workout before the 30-minute mark.',
    neuroPrinciple: 'Dopamine-Epinephrine Action Threshold',
    scienceDetail: 'Once your heart rate crosses ~110 BPM before 30 minutes of waking, friction vanishes and norepinephrine locks in focus for the rest of the session.',
    scriptureRef: 'Colossians 3:23',
    scriptureDetail: 'Working heartily as for the Lord from the very first rep.',
    actionSteps: 'Start your spin bike warmup or perform your first 2 light ramp-up sets on your primary lift.'
  },

  // CATEGORY 2: Circadian & Neural Primers
  {
    id: 'mw-6',
    title: 'Low-Solar-Angle Sunlight + Optic Flow Walk',
    category: 'Circadian & Neural',
    durationMins: 12,
    defaultTime: '06:30',
    summary: 'Outdoor morning sky exposure + forward walking to quiet amygdala threat circuits.',
    neuroPrinciple: 'SCN Circadian Phase Lock & Lateral Optic Flow',
    scienceDetail: 'Viewing natural outdoor photons stimulates ipRGCs in the retina, starting a 16-hour timer for nighttime melatonin while forward locomotion generates optic flow that lowers amygdala activity.',
    scriptureRef: 'Psalm 113:3 • Lamentations 3:22-23',
    scriptureDetail: 'From the rising of the sun to its setting, the name of the Lord is to be praised.',
    actionSteps: 'Walk outside for 10–12 minutes without sunglasses or phone scrolling.'
  },
  {
    id: 'mw-7',
    title: '90-Minute Caffeine Delay Protocol',
    category: 'Circadian & Neural',
    durationMins: 5,
    defaultTime: '07:30',
    summary: 'Allow morning cortisol to clear residual adenosine naturally before your first cup of coffee.',
    neuroPrinciple: 'Adenosine Receptor Clearance',
    scienceDetail: 'Caffeine blocks adenosine receptors rather than clearing adenosine. Waiting 60–90 minutes prevents the afternoon crash when caffeine wears off.',
    scriptureRef: '1 Corinthians 6:12',
    scriptureDetail: 'Using good gifts wisely without being mastered by energy spikes and crashes.',
    actionSteps: 'Enjoy your coffee after your morning workout or 75–90 minutes after waking.'
  },
  {
    id: 'mw-8',
    title: '60-Second Cold Face or End-of-Shower Rinse',
    category: 'Circadian & Neural',
    durationMins: 3,
    defaultTime: '06:40',
    summary: 'Brief cold water exposure to trigger a sustained 2–3 hour rise in baseline dopamine.',
    neuroPrinciple: 'Sustained Catecholamine Release',
    scienceDetail: 'Cool/cold water exposure triggers a gradual, multi-hour elevation in norepinephrine and baseline dopamine without the crash of high-sugar stimulants.',
    scriptureRef: 'Proverbs 25:25',
    scriptureDetail: 'Like cold water to a weary soul is good news from a distant land.',
    actionSteps: 'Turn the shower to cool/cold for the final 30–60 seconds, breathing slowly through your nose.'
  },
  {
    id: 'mw-9',
    title: 'Visual Focus & 24h Watch Lock',
    category: 'Circadian & Neural',
    durationMins: 5,
    defaultTime: '07:45',
    summary: 'Review your top 3 anchors for the day and lock your 24-Hour Watchtower plan.',
    neuroPrinciple: 'Prefrontal Goal Shielding',
    scienceDetail: 'Defining your top targets before checking messages prevents reactive task-switching.',
    scriptureRef: 'Psalm 90:12',
    scriptureDetail: 'Teach us to number our days that we may present to You a heart of wisdom.',
    actionSteps: 'Open the Watchtower tab, verify today’s blocks, and tap "Lock 24h Watch".'
  },

  // CATEGORY 3: Tendon, Joint & Physical Longevity
  {
    id: 'mw-10',
    title: 'Isometric Tendon Loading (Patellar, Achilles & Elbow)',
    category: 'Tendon & Mobility',
    durationMins: 10,
    defaultTime: '06:15',
    summary: '45-second isometric holds to induce tendon analgesia and aligned collagen synthesis.',
    neuroPrinciple: 'Keith Baar Tendon Mechanotransduction',
    scienceDetail: 'Research shows 3–5 sets of 30–45 second isometric holds reduce cortical motor inhibition (tendon pain) and signal tenocytes to reinforce collagen stiffness.',
    scriptureRef: 'Isaiah 40:29-31',
    scriptureDetail: 'Renewing physical resilience through patient, steady tension.',
    actionSteps: 'Perform 3x45s Spanish squats or wall sits, calf isometric holds, or wrist/elbow holds.'
  },
  {
    id: 'mw-11',
    title: 'Dead Hang & Scapular Decompression',
    category: 'Tendon & Mobility',
    durationMins: 4,
    defaultTime: '06:25',
    summary: 'Accumulate 90 seconds of passive and active bar hanging to open the subacromial space.',
    neuroPrinciple: 'Glenohumeral Capsule & Grip Longevity',
    scienceDetail: 'Traction decompresses thoracic and lumbar vertebrae while reshaping the coracoacromial arch for pain-free overhead reaching.',
    scriptureRef: 'Psalm 144:1',
    scriptureDetail: 'Training hands and shoulders for enduring strength.',
    actionSteps: 'Hang from a pull-up bar for 3 sets of 30 seconds with relaxed breathing.'
  },
  {
    id: 'mw-12',
    title: '90/90 Hip Capsule & Ankle Dorsiflexion Flow',
    category: 'Tendon & Mobility',
    durationMins: 8,
    defaultTime: '06:35',
    summary: 'Restore internal and external hip rotation before sitting at a desk.',
    neuroPrinciple: 'Articular Mechanoreceptor Mapping',
    scienceDetail: 'Active end-range hip transitions expand the brain’s somatosensory map of the joint and take torque off the knees and lower back.',
    scriptureRef: 'Proverbs 4:26',
    scriptureDetail: 'Watch the path of your feet and all your ways will be established.',
    actionSteps: 'Sit on the floor in 90/90 position; smoothly rotate hips side to side for 8 slow reps.'
  },
  {
    id: 'mw-13',
    title: '30g+ Leucine-Rich First Meal',
    category: 'Tendon & Mobility',
    durationMins: 15,
    defaultTime: '07:15',
    summary: 'Anchor morning blood sugar and supply amino acids for muscle & tendon repair.',
    neuroPrinciple: 'mTOR Muscle Protein Synthesis & Tyrosine Supply',
    scienceDetail: 'Hitting ~3g of leucine (30–40g protein) after morning training flips the mTOR switch for tissue repair and supplies L-tyrosine, the precursor to dopamine.',
    scriptureRef: 'Acts 27:34',
    scriptureDetail: 'Taking nourishment with thanksgiving for the day’s work ahead.',
    actionSteps: 'Eat eggs, Greek yogurt, or protein + berries + Vitamin C (which supports tendon collagen synthesis).'
  },

  // CATEGORY 4: Spiritual Firstfruits
  {
    id: 'mw-14',
    title: 'Scripture Before Screens (No-Scroll First Hour)',
    category: 'Spiritual Firstfruits',
    durationMins: 15,
    defaultTime: '06:50',
    summary: 'Open the Word of God before letting notifications or headlines shape your mood.',
    neuroPrinciple: 'Tonic Dopamine Protection (Alpha-to-Theta)',
    scienceDetail: 'As the brain wakes, it moves through theta and alpha states. Algorithmic feeds spike cheap phasic dopamine and fragment attention for hours.',
    scriptureRef: 'Psalm 5:3 • Mark 1:35',
    scriptureDetail: 'In the morning, O Lord, You will hear my voice; in the morning I will order my prayer to You.',
    actionSteps: 'Read one chapter from the Gospels or Psalms before opening email or news.'
  },
  {
    id: 'mw-15',
    title: '1-Verse Breath Prayer & Memorization',
    category: 'Spiritual Firstfruits',
    durationMins: 5,
    defaultTime: '07:05',
    summary: 'Anchor a single verse in working memory to carry through the workday.',
    neuroPrinciple: 'Hippocampal Encoding & Default Mode Re-Anchoring',
    scienceDetail: 'Repeating a short truth slowly pairs prefrontal meaning with calm vagal breathing, giving your brain an anchor when stress hits at 2 PM.',
    scriptureRef: 'Psalm 119:11',
    scriptureDetail: 'Your word I have treasured in my heart, that I may not sin against You.',
    actionSteps: 'Inhale the first half of a verse (e.g., "The Lord is my shepherd"), exhale the second ("I shall not want").'
  },
  {
    id: 'mw-16',
    title: '2-Minute Marriage & Household Blessing',
    category: 'Spiritual Firstfruits',
    durationMins: 5,
    defaultTime: '07:25',
    summary: 'Pray specifically for Regla and an intentional word of encouragement before parting ways.',
    neuroPrinciple: 'Oxytocin Co-Regulation',
    scienceDetail: 'Warm eye contact, a 20-second embrace, or spoken gratitude lowers morning cortisol for both spouses.',
    scriptureRef: 'Ephesians 5:25-29 • Proverbs 16:24',
    scriptureDetail: 'Pleasant words are a honeycomb, sweet to the soul and healing to the bones.',
    actionSteps: 'Ask "How can I pray for your day today?" or send a short encouraging note.'
  },

  // CATEGORY 5: Biblical Rest & Rejuvenation (Menuha)
  {
    id: 'mw-17',
    title: 'Menuha Safe Harbor Block (Zero Production)',
    category: 'Biblical Rest (Menuha)',
    durationMins: 20,
    defaultTime: '14:30',
    summary: 'Complete pause from building, fixing, or coding—resting as an act of trust in God.',
    neuroPrinciple: 'Genesis 2:2-3 • Default Mode Network Restoration',
    scienceDetail: 'In Hebrew wisdom, Menuha is joyful tranquility where you stop producing to remember God sustains the world. Neurologically, it lets the prefrontal executive network recover.',
    scriptureRef: 'Genesis 2:2-3 • Psalm 23:2',
    scriptureDetail: 'He makes me lie down in green pastures; He leads me beside quiet waters.',
    actionSteps: 'Leave your phone in another room for 20 minutes. Sit on the porch or couch with zero tasks.'
  },
  {
    id: 'mw-18',
    title: 'Outdoor Solitude & Tree Walk (Luke 5:16)',
    category: 'Biblical Rest (Menuha)',
    durationMins: 25,
    defaultTime: '16:00',
    summary: 'Step outside to observe the trees, sky, and quiet without earbuds or podcasts.',
    neuroPrinciple: 'Attention Restoration Theory (Soft Fascination)',
    scienceDetail: 'Natural fractals (leaves, bark, clouds) engage "soft fascination," allowing directed-attention fatigue in the dorsolateral prefrontal cortex to heal.',
    scriptureRef: 'Luke 5:16',
    scriptureDetail: 'Jesus Himself would often slip away to the wilderness and pray.',
    actionSteps: 'Walk your yard or neighborhood with zero audio input; notice creation and converse with God.'
  },
  {
    id: 'mw-19',
    title: 'The Easy Yoke Unburdening Pause',
    category: 'Biblical Rest (Menuha)',
    durationMins: 10,
    defaultTime: '17:15',
    summary: 'Trade work pressure for Christ’s gentle yoke before transitioning into family evening.',
    neuroPrinciple: 'Autonomic Shift (Sympathetic to Parasympathetic)',
    scienceDetail: 'Deliberately naming and setting down work roles prevents spillover stress into family dinner.',
    scriptureRef: 'Matthew 11:28-30',
    scriptureDetail: 'Come to Me, all who are weary and heavy-laden, and I will give you rest.',
    actionSteps: 'Pause in your driveway or at your desk; name 2 work weights and hand them to Jesus.'
  },
  {
    id: 'mw-20',
    title: 'Midday 10-Minute NSDR / Selah Stillness',
    category: 'Biblical Rest (Menuha)',
    durationMins: 12,
    defaultTime: '13:15',
    summary: 'Eyes-closed horizontal body scan to replenish striatal dopamine after a heavy morning.',
    neuroPrinciple: 'Striatal Dopamine Replenishment',
    scienceDetail: 'PET scan studies show 10–20 minutes of Non-Sleep Deep Rest restores baseline striatal dopamine and sharpens afternoon cognitive performance.',
    scriptureRef: 'Psalm 46:10 (Selah)',
    scriptureDetail: 'Cease striving and know that I am God.',
    actionSteps: 'Lie flat for 10 minutes with eyes closed, relaxing from forehead to feet with slow exhales.'
  },
  {
    id: 'mw-21',
    title: 'Physiological Sigh Reset (3 Cycles)',
    category: 'Biblical Rest (Menuha)',
    durationMins: 2,
    defaultTime: '15:00',
    summary: 'Double nasal inhale + extended mouth exhale to rapidly slow heart rate.',
    neuroPrinciple: 'Alveolar Re-Inflation & Vagal Brake',
    scienceDetail: 'The fastest real-time physiological tool to offload carbon dioxide and activate the parasympathetic nervous system.',
    scriptureRef: 'Isaiah 30:15',
    scriptureDetail: 'In returning and rest you will be saved; in quietness and trust is your strength.',
    actionSteps: 'Inhale deeply through the nose, take a second sharp top-off inhale, then exhale slowly for 8 seconds.'
  },
  {
    id: 'mw-22',
    title: 'Elijah’s Refreshment (Nourish & Nap)',
    category: 'Biblical Rest (Menuha)',
    durationMins: 25,
    defaultTime: '14:00',
    summary: 'When spiritually or physically depleted, honor God’s design for water, food, and a 20-min nap.',
    neuroPrinciple: '1 Kings 19:5-8 • Somatovisceral Recovery',
    scienceDetail: 'When Elijah was exhausted, God did not lecture him—He gave him bread, water, and sleep first.',
    scriptureRef: '1 Kings 19:5-7',
    scriptureDetail: 'Arise, eat, because the journey is too great for you.',
    actionSteps: 'Drink water, eat a clean snack, and take a guilt-free 20-minute power nap.'
  }
];

// =========================================================================
// EXPANDED NIGHT WATCH LIBRARY (18 CARDS BY EVENING STAGE)
// =========================================================================
export const NIGHT_LIBRARY = [
  // STAGE 1: Sunset Transition (90–60m Before Sleep)
  {
    id: 'nw-1',
    title: 'Stage Tomorrow’s Workout Clothes & Shoes',
    stage: 'Stage 1: Sunset Transition (90–60m Out)',
    durationMins: 5,
    defaultTime: '20:30',
    summary: 'Eliminate all decision friction so tomorrow’s 30-Minute Wake-to-Workout ramp is automatic.',
    neuroPrinciple: 'Pre-Commitment & Friction Removal',
    scienceDetail: 'At 5:30 AM your prefrontal cortex is offline. Laying out shorts, socks, shoes, and water glass the night before removes the micro-frictions that derail morning workouts.',
    scriptureRef: 'Proverbs 21:5',
    scriptureDetail: 'The plans of the diligent lead surely to advantage.',
    actionSteps: 'Set workout clothes, shoes, and water glass on the counter before 9:00 PM.'
  },
  {
    id: 'nw-2',
    title: 'Overhead Light Shutdown & Amber Lamps',
    stage: 'Stage 1: Sunset Transition (90–60m Out)',
    durationMins: 5,
    defaultTime: '20:35',
    summary: 'Turn off bright ceiling lights; switch to low eye-level warm lamps.',
    neuroPrinciple: 'Pineal Melatonin & Lateral Habenula Protection',
    scienceDetail: 'Retinal ipRGCs sit primarily in the lower half of the eye, looking upward at ceiling fixtures. Switching to low warm lamps preserves melatonin onset.',
    scriptureRef: 'Psalm 104:19-20',
    scriptureDetail: 'Honoring the natural rhythm of evening darkness God appointed.',
    actionSteps: 'Switch off overhead kitchen/living room lights at 8:30 PM.'
  },
  {
    id: 'nw-3',
    title: 'Hard Stop on Code, Hardware & Troubleshooting',
    stage: 'Stage 1: Sunset Transition (90–60m Out)',
    durationMins: 5,
    defaultTime: '20:45',
    summary: 'Close IDEs and workbench problems so hyper-vigilant beta brainwaves can subside.',
    neuroPrinciple: 'Glutamate & Norepinephrine Down-Regulation',
    scienceDetail: 'Debugging code or fixing hardware late at night spikes glutamate and norepinephrine, keeping the brain solving problems during light sleep.',
    scriptureRef: 'Psalm 127:2',
    scriptureDetail: 'It is vain for you to rise up early, to retire late, to eat the bread of painful labors; for He gives to His beloved sleep.',
    actionSteps: 'Close all active dev tabs and write tomorrow’s first step on paper.'
  },
  {
    id: 'nw-4',
    title: 'Kitchen Counter Reset & Fasting Window Start',
    stage: 'Stage 1: Sunset Transition (90–60m Out)',
    durationMins: 10,
    defaultTime: '20:15',
    summary: 'Finish last calorie intake 2–3 hours before bed to lower nocturnal resting heart rate.',
    neuroPrinciple: 'Vagal Heart Rate Variability (HRV) Optimization',
    scienceDetail: 'Late digestion diverts blood flow to the gut and elevates core body temperature, reducing deep slow-wave sleep by up to 25%.',
    scriptureRef: 'Ecclesiastes 3:1',
    scriptureDetail: 'Marking the close of the day’s labor and feasting.',
    actionSteps: 'Clear the kitchen sink, start the dishwasher, and switch to water or herbal tea.'
  },
  {
    id: 'nw-5',
    title: 'Unhurried Couch Check-In with Regla',
    stage: 'Stage 1: Sunset Transition (90–60m Out)',
    durationMins: 15,
    defaultTime: '20:50',
    summary: '15 minutes of phone-free conversation or shared laughter to boost evening oxytocin.',
    neuroPrinciple: 'Relational Safety & Cortisol Clearance',
    scienceDetail: 'Safe relational connection signals the autonomic nervous system that the "tribe is secure," accelerating the shift into parasympathetic rest.',
    scriptureRef: 'Ephesians 4:26-27 • 1 Peter 3:7',
    scriptureDetail: 'Closing the day in harmony, peace, and mutual care.',
    actionSteps: 'Put both phones across the room and share one highlight from the day.'
  },
  {
    id: 'nw-6',
    title: 'Evening Walk Under the Stars (Digestive Stroll)',
    stage: 'Stage 1: Sunset Transition (90–60m Out)',
    durationMins: 12,
    defaultTime: '20:00',
    summary: 'Gentle 10-minute walk after dinner to clear blood glucose and view evening twilight.',
    neuroPrinciple: 'GLUT-4 Glucose Disposal & Circadian Dusk Signal',
    scienceDetail: 'Viewing fading evening light tells the SCN that night has arrived, anchoring the second half of your circadian clock.',
    scriptureRef: 'Psalm 8:3-4',
    scriptureDetail: 'When I consider Your heavens, the work of Your fingers, the moon and the stars...',
    actionSteps: 'Take a slow 10-minute stroll outside after dinner.'
  },

  // STAGE 2: Somatic Downshift (60–30m Before Sleep)
  {
    id: 'nw-7',
    title: 'Warm Shower Thermal Dump + 66°F Bedroom',
    stage: 'Stage 2: Somatic Downshift (60–30m Out)',
    durationMins: 15,
    defaultTime: '21:05',
    summary: 'Warm water dilates hands/feet blood vessels to rapidly drop core temperature afterward.',
    neuroPrinciple: 'Core Body Temperature Drop (-1°C) for Slow-Wave Sleep',
    scienceDetail: 'Your brain must drop ~1–2°F in core temperature to initiate deep delta slow-wave sleep. A warm shower brings blood to the skin surface so heat radiates out fast.',
    scriptureRef: 'Proverbs 3:24',
    scriptureDetail: 'When you lie down, you will not be afraid; when you lie down, your sleep will be sweet.',
    actionSteps: 'Take a warm 10-minute shower and set bedroom thermostat to ~65–67°F.'
  },
  {
    id: 'nw-8',
    title: 'Magnesium Glycinate / Chamomile Apigenin Tea',
    stage: 'Stage 2: Somatic Downshift (60–30m Out)',
    durationMins: 5,
    defaultTime: '21:00',
    summary: 'Support GABA receptor calming and muscle relaxation 45 minutes before bed.',
    neuroPrinciple: 'GABAergic Inhibition & NMDA Relaxation',
    scienceDetail: 'Magnesium glycinate and chamomile (apigenin) gently support inhibitory GABA pathways in the forebrain without disrupting sleep architecture.',
    scriptureRef: 'Psalm 104:14',
    scriptureDetail: 'Receiving calming provision from the earth with gratitude.',
    actionSteps: 'Take evening magnesium or sip a small cup of decaf herbal tea.'
  },
  {
    id: 'nw-9',
    title: 'Legs-Up-The-Wall Vagal Baroreceptor Reset',
    stage: 'Stage 2: Somatic Downshift (60–30m Out)',
    durationMins: 6,
    defaultTime: '21:20',
    summary: 'Lie on the floor with legs resting vertically on the wall or couch for 5 minutes.',
    neuroPrinciple: 'Carotid Baroreceptor Reflex & Venous Return',
    scienceDetail: 'Elevating the legs drains pooled lower-limb fluid back to the heart, gently stretching carotid baroreceptors and triggering an immediate vagus nerve heart-rate drop.',
    scriptureRef: 'Psalm 62:1',
    scriptureDetail: 'My soul waits in silence for God only; from Him is my salvation.',
    actionSteps: 'Lie on your back with calves on the couch or wall for 5 minutes of slow nasal breathing.'
  },
  {
    id: 'nw-10',
    title: 'Psoas, Piriformis & Thoracic Foam Roll Release',
    stage: 'Stage 2: Somatic Downshift (60–30m Out)',
    durationMins: 8,
    defaultTime: '21:25',
    summary: 'Slow myofascial pressure + long exhales to release hip flexors and upper back tension.',
    neuroPrinciple: 'Golgi Tendon Organ & Ruffini Ending Stimulation',
    scienceDetail: 'Slow sustained pressure stimulates interstitial Ruffini mechanoreceptors, which directly lower global sympathetic muscle tone before bed.',
    scriptureRef: 'Psalm 38:3',
    scriptureDetail: 'Releasing stored physical tension so the body can rest without tossing.',
    actionSteps: 'Spend 4 minutes gently rolling upper back and glutes/hips with slow 6-second exhales.'
  },
  {
    id: 'nw-11',
    title: '4-7-8 Parasympathetic Breath Cadence',
    stage: 'Stage 2: Somatic Downshift (60–30m Out)',
    durationMins: 4,
    defaultTime: '21:33',
    summary: 'Inhale 4s, hold 7s, exhale 8s for 4 cycles to engage the vagal brake.',
    neuroPrinciple: 'Respiratory Sinus Arrhythmia (RSA) Amplification',
    scienceDetail: 'Exhaling twice as long as you inhale activates the nucleus ambiguus of the vagus nerve, directly slowing the sinoatrial pacemaker of the heart.',
    scriptureRef: 'Job 33:4',
    scriptureDetail: 'The Spirit of God has made me, and the breath of the Almighty gives me life.',
    actionSteps: 'Complete 4 slow rounds of 4-7-8 breathing sitting on the edge of the bed.'
  },
  {
    id: 'nw-12',
    title: 'Phone Parked Across Room / Outside Bedroom',
    stage: 'Stage 2: Somatic Downshift (60–30m Out)',
    durationMins: 2,
    defaultTime: '21:37',
    summary: 'Plug your phone in away from the bed so midnight or 5:30 AM scrolling is impossible.',
    neuroPrinciple: 'Cue Extinction & Vigilance Reduction',
    scienceDetail: 'Even a face-down phone on the nightstand keeps low-level anticipatory dopamine vigilance active. Placing it across the room also forces you to stand up when the alarm rings.',
    scriptureRef: 'Proverbs 4:23',
    scriptureDetail: 'Guard your heart with all diligence, for from it flow the springs of life.',
    actionSteps: 'Plug your phone into a charger across the room or outside the bedroom door.'
  },

  // STAGE 3: Final Harbor (30–0m to Sleep)
  {
    id: 'nw-13',
    title: '5-Minute Baylor Cognitive Offload',
    stage: 'Stage 3: Final Harbor (30–0m to Sleep)',
    durationMins: 5,
    defaultTime: '21:40',
    summary: 'Write down tomorrow’s open loops in the Captain’s Log so your hippocampus stops pinging.',
    neuroPrinciple: 'Zeigarnik Effect Extinction (Polysomnography Proven)',
    scienceDetail: 'Baylor University’s sleep lab proved that writing a specific list of tomorrow’s tasks speeds up sleep onset faster than any other journaling style because the brain stops rehearsing unfinished items.',
    scriptureRef: 'Proverbs 16:3',
    scriptureDetail: 'Commit your works to the Lord and your plans will be established.',
    actionSteps: 'Open the Captain’s Log below, offload tomorrow’s tasks, and push #1 to your Watchtower.'
  },
  {
    id: 'nw-14',
    title: 'Physical Paper Book or Narrative Scripture',
    stage: 'Stage 3: Final Harbor (30–0m to Sleep)',
    durationMins: 15,
    defaultTime: '21:45',
    summary: 'Read a physical book under a warm reading light to transition into alpha/theta waves.',
    neuroPrinciple: 'Saccadic Eye Fatigue & Default Mode Calming',
    scienceDetail: 'Reading printed pages under warm light tires the oculomotor muscles naturally without blue-spectrum photon suppression of melatonin.',
    scriptureRef: 'Psalm 63:6',
    scriptureDetail: 'When I remember You on my bed, I meditate on You in the night watches.',
    actionSteps: 'Read 5–10 pages of a physical book or narrative Scripture.'
  },
  {
    id: 'nw-15',
    title: '5-Step Biblical Examen of the Day',
    stage: 'Stage 3: Final Harbor (30–0m to Sleep)',
    durationMins: 8,
    defaultTime: '21:50',
    summary: 'Walk through the 5 classic movements of gratitude, light, review, forgiveness, and grace.',
    neuroPrinciple: 'Relational Gratitude & Threat-Scan Deactivation',
    scienceDetail: 'Reviewing the day through the lens of grace rewires hippocampal memory consolidation away from anxiety before REM sleep.',
    scriptureRef: 'Psalm 139:23-24',
    scriptureDetail: 'Search me, O God, and know my heart; try me and know my anxious thoughts.',
    actionSteps: 'Complete the 5-step Examen in the Captain’s Log below.'
  },
  {
    id: 'nw-16',
    title: 'Progressive Muscle Relaxation (Jaw to Toes)',
    stage: 'Stage 3: Final Harbor (30–0m to Sleep)',
    durationMins: 5,
    defaultTime: '21:55',
    summary: 'Consciously unclench the jaw, drop the tongue from the roof of the mouth, and soften shoulders.',
    neuroPrinciple: 'Trigeminal & Motor Cortex De-Activation',
    scienceDetail: 'Relaxing the masseter (jaw) and ocular muscles sends a direct safety signal through the trigeminal nerve to the brainstem reticular activating system.',
    scriptureRef: 'Psalm 16:9',
    scriptureDetail: 'Therefore my heart is glad and my glory rejoices; my flesh also will dwell securely.',
    actionSteps: 'Lying in bed, unclench your jaw, soften your eyes, and release shoulder tension.'
  },
  {
    id: 'nw-17',
    title: 'Psalm 4:8 Night Watch Surrender',
    stage: 'Stage 3: Final Harbor (30–0m to Sleep)',
    durationMins: 3,
    defaultTime: '21:58',
    summary: 'Consciously hand the night watch over to God who neither slumbers nor sleeps.',
    neuroPrinciple: 'Cognitive Hyper-Arousal Release',
    scienceDetail: 'Releasing responsibility for overnight outcomes drops nocturnal cortisol and protects early-night deep sleep.',
    scriptureRef: 'Psalm 4:8 • Psalm 121:3-4',
    scriptureDetail: 'In peace I will both lie down and sleep, for You alone, O Lord, make me to dwell in safety.',
    actionSteps: 'Whisper Psalm 4:8 as your head hits the pillow.'
  },
  {
    id: 'nw-18',
    title: 'Pitch-Black Room & Nasal Sleep Posture',
    stage: 'Stage 3: Final Harbor (30–0m to Sleep)',
    durationMins: 2,
    defaultTime: '22:00',
    summary: 'Eliminate ambient LEDs and breathe quietly through the nose for deep glymphatic clearance.',
    neuroPrinciple: 'Glymphatic Brain Wash & Nitric Oxide Perfusion',
    scienceDetail: 'During deep delta sleep, glial channels expand by 60% to wash metabolic waste from the brain. Darkness and nasal breathing maximize slow-wave sleep depth.',
    scriptureRef: 'Proverbs 3:24',
    scriptureDetail: 'When you lie down, your sleep will be sweet.',
    actionSteps: 'Cover any bright LEDs, close your mouth, and rest.'
  }
];

// =========================================================================
// EXPANDED JESUS'S PRAYER TEACHINGS (12 THEMES WITH NASB & NLT LENSES)
// =========================================================================
export const JESUS_PRAYER_THEMES = [
  {
    id: 'jp-1',
    theme: 'Hallowing the Father’s Name (Adoration)',
    reference: 'Matthew 6:9',
    category: 'Adoration',
    summary: 'Re-center your heart on the Father’s holiness and love before rushing into requests.',
    nasbLens: 'NASB Structural Lens: Emphasizes the reverence due to our Father in heaven and petitions that His name be treated as sacred and supreme.',
    nltLens: 'NLT Heart Lens: Invites us to draw near to a loving Father while praying that our lives bring honor to His holy name.',
    samplePrayer: 'Father, re-center my mind on Your greatness, goodness, and faithfulness before I bring my requests.'
  },
  {
    id: 'jp-2',
    theme: 'Kingdom Alignment & Surrendered Will',
    reference: 'Matthew 6:10 • Luke 22:42',
    category: 'Surrender',
    summary: 'Align your home, work, and schedule with God’s rule rather than self-will.',
    nasbLens: 'NASB Structural Lens: Petitions for the decisive arrival of God’s royal reign and the execution of His will on earth as in heaven.',
    nltLens: 'NLT Heart Lens: Echoes Jesus in Gethsemane—trusting the Father’s wise plan above our own comfort or control.',
    samplePrayer: 'Lord, let Your Kingdom rule in my attitude, my home, and my decisions today.'
  },
  {
    id: 'jp-3',
    theme: 'Daily Bread & 24-Hour Dependence',
    reference: 'Matthew 6:11 • Matthew 6:33-34',
    category: 'Provision',
    summary: 'Ask for the strength, wisdom, and provision needed for today without borrowing tomorrow’s worry.',
    nasbLens: 'NASB Structural Lens: The Greek epiousios points to bread sufficient for the coming day—cultivating daily reliance.',
    nltLens: 'NLT Heart Lens: Encourages seeking God’s Kingdom first today and trusting Him to supply what our family needs.',
    samplePrayer: 'Give us the strength, clarity, and provision needed for these next 24 hours.'
  },
  {
    id: 'jp-4',
    theme: 'Forgiveness & Releasing Grudges Quickly',
    reference: 'Matthew 6:12 • Mark 11:25',
    category: 'Forgiveness',
    summary: 'Receive God’s mercy and immediately release offenses or irritation toward others.',
    nasbLens: 'NASB Structural Lens: Connects the Father’s pardon of our moral debts with our active release of debtors.',
    nltLens: 'NLT Heart Lens: Calls us to drop resentment whenever we stand praying so nothing hinders fellowship with God.',
    samplePrayer: 'Search my heart, Lord; forgive my impatience and help me release any frustration toward others.'
  },
  {
    id: 'jp-5',
    theme: 'Protection from Temptation & Spiritual Drift',
    reference: 'Matthew 6:13 • Luke 22:40',
    category: 'Protection',
    summary: 'Ask for alertness and protection over your eyes, tongue, and mind when tired.',
    nasbLens: 'NASB Structural Lens: Petitions the Father to steer us away from testing snares and deliver us from the evil one.',
    nltLens: 'NLT Heart Lens: Keeps us watchful so we don’t slip into compromise or distraction under fatigue.',
    samplePrayer: 'Guard my eyes, my tongue, and my attention today; keep me anchored in integrity.'
  },
  {
    id: 'jp-6',
    theme: 'Laborers for the Harvest & Church Teams',
    reference: 'Luke 10:2',
    category: 'Mission',
    summary: 'Pray earnestly for church ministry teams, outreach, and gospel encouragement.',
    nasbLens: 'NASB Structural Lens: Jesus commands disciples to beseech the Lord of the harvest to send out workers into His harvest.',
    nltLens: 'NLT Heart Lens: Moves our prayers beyond personal comfort to care deeply for people who need hope.',
    samplePrayer: 'Lord of the harvest, strengthen our church serving teams and open doors for gospel encouragement.'
  },
  {
    id: 'jp-7',
    theme: 'Marriage & Family Unity (High Priestly Prayer)',
    reference: 'John 17:15-21',
    category: 'Family & Church',
    summary: 'Pray for deep spiritual unity, humility, and peace between you, Regla, and your household.',
    nasbLens: 'NASB Structural Lens: Jesus prays that believers be sanctified in truth and perfected in unity.',
    nltLens: 'NLT Heart Lens: Shows that visible love and harmony in our home and church point people to Jesus.',
    samplePrayer: 'Knit my heart together with Regla and our family in patience, tenderness, and unity.'
  },
  {
    id: 'jp-8',
    theme: 'Abiding in the Vine for Fruitfulness',
    reference: 'John 15:5-7',
    category: 'Intimacy',
    summary: 'Stay connected to Christ in the middle of tasks rather than relying on sheer grit.',
    nasbLens: 'NASB Structural Lens: Remaining rooted in Christ and His words shapes our desires so our prayers bear lasting fruit.',
    nltLens: 'NLT Heart Lens: Reminds us that apart from Jesus we can do nothing of eternal value, but remaining in Him brings rich fruit.',
    samplePrayer: 'Jesus, keep me abiding in You through the middle of my workday.'
  },
  {
    id: 'jp-9',
    theme: 'Persistent Asking, Seeking & Knocking',
    reference: 'Luke 11:9-13 • Luke 18:1',
    category: 'Perseverance',
    summary: 'Pray with shameless persistence for long-term needs without losing heart.',
    nasbLens: 'NASB Structural Lens: Present-imperative verbs ("keep asking, keep seeking, keep knocking") call for steadfast perseverance.',
    nltLens: 'NLT Heart Lens: Assures us that our Father delights to give the Holy Spirit and good gifts to His children.',
    samplePrayer: 'Father, teach me to pray persistently and expectantly without growing discouraged.'
  },
  {
    id: 'jp-10',
    theme: 'Secret-Place Sincerity (The Inner Room)',
    reference: 'Matthew 6:6',
    category: 'Intimacy',
    summary: 'Step away from noise and performance to meet the Father who sees in secret.',
    nasbLens: 'NASB Structural Lens: Entering the inner room and shutting the door strips away human applause for pure communion.',
    nltLens: 'NLT Heart Lens: Promises that the Father who sees in private rewards authentic, unhurried time with Him.',
    samplePrayer: 'Meet me in the quiet of this moment, Father; quiet every competing voice.'
  },
  {
    id: 'jp-11',
    theme: 'Blessing Difficult People & Peacemaking',
    reference: 'Matthew 5:44 • Matthew 5:9',
    category: 'Forgiveness',
    summary: 'Pray for the good of difficult coworkers or frustrating situations.',
    nasbLens: 'NASB Structural Lens: Jesus commands active intercession for those who oppose or frustrate us, reflecting the Father’s character.',
    nltLens: 'NLT Heart Lens: Frees our nervous system from hostility and turns us into agents of peace.',
    samplePrayer: 'Lord, bless those who have frustrated me this week and make me a steady peacemaker.'
  },
  {
    id: 'jp-12',
    theme: 'Strength to Stand & Watchfulness',
    reference: 'Luke 21:36 • Mark 14:38',
    category: 'Protection',
    summary: 'Keep your heart from being weighed down by life’s worries or spiritual drowsiness.',
    nasbLens: 'NASB Structural Lens: Commands constant alertness and petition so our hearts are not weighted down with the worries of life.',
    nltLens: 'NLT Heart Lens: Recognizes that even when our spirit is willing, our body gets tired and needs God’s sustaining grace.',
    samplePrayer: 'Keep my heart awake, buoyant, and uncluttered by the anxieties of this age.'
  }
];

// =========================================================================
// DEFAULT APPLICATION STATE
// =========================================================================
export const INITIAL_STATE = {
  activeTab: 'calendar',
  selectedDayOffset: 0,
  peekFilteredEvents: false,
  mobilePlanViewMode: 'unified',
  planLocked: false,
  dailyAmccScore: 7,
  amccNoteDraft: '',

  // Workout & Daily Backtrack State
  workoutFilterModality: 'All',
  backtrackDate: TODAY_ISO,
  workouts: [
    {
      id: 'wk-1',
      date: TODAY_ISO,
      startTime: '06:00',
      durationMins: 40,
      modality: 'Indoor Spinning',
      title: 'Zone 2 Endurance + 4x2m Tempo Cadence Spins',
      videoOrRoute: 'Peloton / Zwift Watopia Flat Route',
      intensity: 'Moderate-High',
      notes: '30m Wake-to-Workout ramp complete before clipping in.',
      completed: true
    },
    {
      id: 'wk-2',
      date: TODAY_ISO,
      startTime: '17:00',
      durationMins: 20,
      modality: 'Pilates / Mobility',
      title: 'Evening Thoracic, Hip Capsule & Tendon Decompression',
      videoOrRoute: 'Mat Routine',
      intensity: 'Recovery',
      notes: 'Unload lower back and hips after desk work.',
      completed: false
    },
    {
      id: 'wk-3',
      date: TOMORROW_ISO,
      startTime: '06:00',
      durationMins: 45,
      modality: 'Lifting (Video-Led)',
      title: 'Full-Body Dumbbell & Isometric Tendon Strength',
      videoOrRoute: '35m Guided Strength Video',
      intensity: 'High',
      notes: 'Focus on controlled eccentric tempo and scapular stability.',
      completed: false
    },
    {
      id: 'wk-4',
      date: YESTERDAY_ISO,
      startTime: '07:30',
      durationMins: 75,
      modality: 'Outdoor Cycling (Single-Track)',
      title: 'Morning Single-Track Trail Flow & Technical Climbs',
      videoOrRoute: 'Local Trail System',
      intensity: 'High',
      notes: 'Great traction; felt strong on punchy climbs.',
      completed: true
    }
  ],

  dailyHistory: {
    [TODAY_ISO]: {
      prayerDone: true,
      nightDone: false,
      morningDone: true,
      todos: [
        { id: 'dh-1', text: 'Complete 30-Min Wake-to-Workout Ramp', completed: true },
        { id: 'dh-2', text: 'Check slim computer status with Shannon', completed: false }
      ]
    },
    [YESTERDAY_ISO]: {
      prayerDone: true,
      nightDone: true,
      morningDone: true,
      todos: [
        { id: 'dh-3', text: 'Prep church safety team schedule & gear', completed: true },
        { id: 'dh-4', text: 'Stage morning workout clothes & hydration', completed: true },
        { id: 'dh-5', text: 'Inspect yard drainage around young trees', completed: true }
      ]
    }
  },

  // Sub-filters & active boards
  morningCategoryFilter: 'All',
  nightStageFilter: 'All',
  morningBoardIds: ['mw-1', 'mw-2', 'mw-4', 'mw-5', 'mw-14', 'mw-17'],
  nightBoardIds: ['nw-1', 'nw-2', 'nw-7', 'nw-13', 'nw-17'],
  prayerSubTab: 'board', // 'board' | 'guided' | 'jesus' | 'ebenezer'
  guidedStepIndex: 0,
  selectedJournalMode: 'baylor_offload',
  baylorTasksDraft: ['', '', ''],
  examenDraft: { s1: '', s2: '', s3: '', s4: '', s5: '' },
  pennebakerDraft: { raw: '', reframe: '', intensity: 5 },
  narrativeDraft: { scene: '', story: '', meaning: '' },
  closure321Draft: { w1: '', w2: '', w3: '', l1: '', l2: '', p1: '' },
  psalm4Draft: { burdens: '', prayer: '' },

  settings: {
    theme: 'nordic',
    userName: 'Dan',
    studyLens: 'BOTH',
    wakeTime: '05:30',
    sleepTime: '22:00',
    maxActiveGoals: 3,
    wifeFilterEnabled: true,
    hideShortSoloEvents: false,
    wifeFilterKeywords: ['dotti', 'musora', 'cancel', 'breakfast w/', 'advisement', 'remind', 'hair', 'nails', 'personal', 'rx'],
    gcalClientId: '974855148969-n2ejn4qosb4oreulnjljnijmkrm2lfnl.apps.googleusercontent.com',
    gcalReadOnlyScope: true,
    lastGcalSync: 'Nov 2026 Snapshot',
    lastCalendarSummary: []
  },

  gcalEvents: [
    { id: 'gcal-1', dayOffset: 0, startTime: '08:00', endTime: '17:00', title: 'No School', calendar: 'Wife Shared (regla317)', isSoloReminder: false, location: 'District Calendar' },
    { id: 'gcal-2', dayOffset: 1, startTime: '09:00', endTime: '10:00', title: 'Breakfast w/Erica', calendar: 'Wife Shared (regla317)', isSoloReminder: true, location: '5844 Reidville Rd, Moore, SC' },
    { id: 'gcal-3', dayOffset: 1, startTime: '18:30', endTime: '20:30', title: 'BSF North Gate Church', calendar: 'Wife Shared (reglaschuler)', isSoloReminder: false, location: '620 Holly Springs Rd, Lyman, SC' },
    { id: 'gcal-4', dayOffset: 2, startTime: '08:00', endTime: '08:30', title: 'Dotti replacement', calendar: 'Wife Shared (regla317)', isSoloReminder: true, location: 'Personal Reminder' },
    { id: 'gcal-5', dayOffset: 2, startTime: '08:15', endTime: '09:15', title: 'HSM Veterans', calendar: 'Wife Shared (regla317)', isSoloReminder: false, location: 'School Event' },
    { id: 'gcal-6', dayOffset: 2, startTime: '09:00', endTime: '09:30', title: 'Did Shannon reply about slim computer?', calendar: 'Primary (schuler314)', isSoloReminder: false, location: 'Do we have a free computer?' },
    { id: 'gcal-7', dayOffset: 2, startTime: '09:00', endTime: '10:00', title: 'Cancel Musora', calendar: 'Wife Shared (regla317)', isSoloReminder: true, location: 'Subscription Reminder' },
    { id: 'gcal-8', dayOffset: 2, startTime: '08:00', endTime: '10:00', title: 'Dan Safety Team', calendar: 'Primary (schuler314)', isSoloReminder: false, location: 'Church Campus' },
    { id: 'gcal-9', dayOffset: 2, startTime: '08:20', endTime: '11:00', title: 'Regla Serving - Greeting', calendar: 'Wife Shared (regla317)', isSoloReminder: false, location: 'Church Greeting Team' },
    { id: 'gcal-10', dayOffset: 2, startTime: '08:15', endTime: '09:15', title: 'SCC Advisement- Meredith Walsh', calendar: 'Wife Shared (regla317)', isSoloReminder: true, location: '107 Community College Dr, Spartanburg' }
  ],

  planBlocks: [
    { id: 'pb-1', title: 'Minute 0–3: Feet on Floor & Bright Light Pulse', startTime: '05:30', durationMins: 3, category: 'morning', completed: true, dayOffset: 0 },
    { id: 'pb-2', title: 'Minute 14–22: Core Temp & Synovial Tendon Ramp', startTime: '05:44', durationMins: 8, category: 'morning', completed: true, dayOffset: 0 },
    { id: 'pb-3', title: 'Minute 22–30: First Warm-Up Set / Spin Cadence Ignition', startTime: '05:52', durationMins: 8, category: 'morning', completed: false, dayOffset: 0 },
    { id: 'pb-4', title: 'Scripture Before Screens (No-Scroll First Hour)', startTime: '06:50', durationMins: 15, category: 'morning', completed: false, dayOffset: 0 },
    { id: 'pb-5', title: 'Menuha Safe Harbor Block (Zero Production)', startTime: '14:30', durationMins: 20, category: 'rest', completed: false, dayOffset: 0 },
    { id: 'pb-6', title: 'Stage Tomorrow’s Workout Clothes & Shoes', startTime: '20:30', durationMins: 5, category: 'night', completed: false, dayOffset: 0 },
    { id: 'pb-7', title: '5-Minute Baylor Cognitive Offload', startTime: '21:40', durationMins: 5, category: 'night', completed: false, dayOffset: 0 }
  ],

  lists: [
    {
      id: 'list-family',
      title: 'Family Hub & Weekend',
      category: 'Family',
      items: [
        { id: 'li-1', text: 'Plan weekend outdoor walk & tree check', assignedTo: 'Family', completed: false, scheduledTime: '10:00' },
        { id: 'li-2', text: 'Play a round of Conversation Cards after dinner', assignedTo: 'All', completed: false, scheduledTime: '19:00' },
        { id: 'li-3', text: 'Check slim computer status with Shannon', assignedTo: 'Dan', completed: false, scheduledTime: '14:00' }
      ]
    },
    {
      id: 'list-groceries',
      title: 'Groceries & Galley',
      category: 'Groceries',
      items: [
        { id: 'li-4', text: 'Whole bean coffee & sparkling water', assignedTo: 'Shared', completed: false, scheduledTime: '16:00' },
        { id: 'li-5', text: 'High-protein breakfast staples (eggs, Greek yogurt)', assignedTo: 'Shared', completed: false, scheduledTime: '16:00' },
        { id: 'li-6', text: 'Magnesium glycinate & chamomile night tea', assignedTo: 'Dan', completed: true, scheduledTime: '16:00' }
      ]
    },
    {
      id: 'list-workbench',
      title: 'House, Yard & Workbench',
      category: 'Workbench',
      items: [
        { id: 'li-7', text: 'Inspect yard drainage and mulch around young trees', assignedTo: 'Dan', completed: false, scheduledTime: '15:30' },
        { id: 'li-8', text: 'Organize garage tool bench & charging station', assignedTo: 'Dan', completed: false, scheduledTime: '16:30' }
      ]
    }
  ],

  journalEntries: [],

  prayerCards: [
    {
      id: 'pc-1',
      title: 'Regla — Peace, Joy & BSF Fellowship',
      category: 'Marriage & Family',
      scriptureTag: 'Ephesians 3:16-19',
      notes: 'Pray for deep spiritual refreshment, joy in her BSF leadership/group at North Gate Church, and Sunday greeting ministry.',
      prayedCount: 14,
      lastPrayed: 'Today',
      onActiveBoard: true,
      isAnswered: false
    },
    {
      id: 'pc-2',
      title: 'Sunday Safety Team & Church Campus Peace',
      category: 'Church & Ministry',
      scriptureTag: 'Psalm 127:1',
      notes: 'Alertness, calm discernment, and warm Christlike hospitality for every family arriving on campus.',
      prayedCount: 9,
      lastPrayed: 'Yesterday',
      onActiveBoard: true,
      isAnswered: false
    },
    {
      id: 'pc-3',
      title: 'Unhurried Spirit & Excellence in Daily Work',
      category: 'Personal Walk',
      scriptureTag: 'Matthew 11:28-30 • James 1:5',
      notes: 'Carry the easy yoke of Jesus; solve problems with wisdom without internal hurry or tension.',
      prayedCount: 18,
      lastPrayed: 'Today',
      onActiveBoard: true,
      isAnswered: false
    },
    {
      id: 'pc-4',
      title: 'Household Unity & Table Conversations',
      category: 'Marriage & Family',
      scriptureTag: 'Colossians 3:12-15',
      notes: 'Let the peace of Christ rule in our home, marriage, and evening conversations.',
      prayedCount: 21,
      lastPrayed: 'Yesterday',
      onActiveBoard: true,
      isAnswered: false
    },
    {
      id: 'pc-5',
      title: 'Physical Stewardship, Tendons & Training Consistency',
      category: 'Health & Strength',
      scriptureTag: '1 Corinthians 9:25-27',
      notes: 'Strength and wisdom to honor the body for decades of active service.',
      prayedCount: 7,
      lastPrayed: '2 days ago',
      onActiveBoard: false,
      isAnswered: false
    },
    {
      id: 'pc-6',
      title: 'North Gate Church & Local Gospel Impact',
      category: 'Church & Ministry',
      scriptureTag: 'Luke 10:2',
      notes: 'Boldness, unity, and spiritual fruit across our church family and community.',
      prayedCount: 6,
      lastPrayed: '3 days ago',
      onActiveBoard: false,
      isAnswered: false
    },
    {
      id: 'pc-7',
      title: 'Extended Family & Aging Loved Ones',
      category: 'Marriage & Family',
      scriptureTag: 'Isaiah 46:4',
      notes: 'Health, peace, and encouragement for parents and extended family members.',
      prayedCount: 11,
      lastPrayed: 'Yesterday',
      onActiveBoard: false,
      isAnswered: false
    },
    {
      id: 'pc-8',
      title: 'Neighbors & Coworkers Open to Faith',
      category: 'Mission',
      scriptureTag: 'Colossians 4:2-6',
      notes: 'Seasoned speech and genuine care for neighbors and colleagues.',
      prayedCount: 5,
      lastPrayed: 'This week',
      onActiveBoard: false,
      isAnswered: false
    }
  ],

  goals: [
    {
      id: 'goal-1',
      title: 'Wake-to-Workout in 30 Minutes',
      identityStatement: 'I am an athlete and steward who transitions from bed to movement before friction can negotiate.',
      wish: 'Start my first warm-up set or spin cadence within 30 minutes of waking 5 days a week.',
      outcome: 'High morning dopamine, resilient tendons, and workouts completed before the workday begins.',
      obstacle: 'Lingering in bed or checking phone notifications before putting on workout gear.',
      ifThenPlan: 'IF my alarm rings at 5:30 AM, THEN I put both feet on the floor within 60 seconds and drink 14oz salted water into my staged training clothes.',
      progressPct: 80,
      streakDays: 6,
      status: 'active'
    },
    {
      id: 'goal-2',
      title: 'Scripture & Prayer Before Digital Noise',
      identityStatement: 'I am a man anchored in God’s Word before the digital world makes its demands.',
      wish: 'Complete Scripture reading and my Active Prayer Board before checking news or social feeds.',
      outcome: 'Calm prefrontal focus and spiritual peace throughout the day.',
      obstacle: 'Opening browser tabs or messages right after finishing a workout.',
      ifThenPlan: 'IF I finish my morning workout, THEN I open my Bible and Lighthouse Prayer Board while cooling down.',
      progressPct: 70,
      streakDays: 5,
      status: 'active'
    },
    {
      id: 'goal-3',
      title: '21:30 Sunset & Captain’s Log Offload',
      identityStatement: 'I am a restful man who trusts God with unfinished work and protects deep sleep.',
      wish: 'Shut down code/troubleshooting by 9:30 PM and complete a Captain’s Log entry.',
      outcome: 'Rapid sleep onset and strong overnight recovery.',
      obstacle: 'Getting pulled into late-night coding or hardware tinkering.',
      ifThenPlan: 'IF it hits 9:15 PM and I am mid-project, THEN I log the next step in the Baylor Offload and close the laptop.',
      progressPct: 60,
      streakDays: 4,
      status: 'active'
    }
  ],

  codedSites: [
    {
      id: 'site-1',
      title: 'Vela FM — Web Radio & Podcast Streamer',
      tagline: 'Single-file HTML web radio player with curated station presets, podcast streaming, and local backup.',
      url: 'https://schuler314.github.io/Vela-FM/',
      category: 'Audio & Media',
      status: 'Live',
      nextTodo: 'Add sleep timer and new preset station streams.'
    },
    {
      id: 'site-2',
      title: 'Family & Table Conversation Cards',
      tagline: 'Interactive swipeable question decks for meaningful family dinners, marriage check-ins, and faith talks.',
      url: 'https://schuler314.github.io/Conversation-Cards/',
      category: 'Family & Faith',
      status: 'Live',
      nextTodo: 'Add a "Sunday Reflection" deck with NLT/NASB prompts.'
    },
    {
      id: 'site-3',
      title: 'Math Ninja: Mateo’s Quest',
      tagline: 'Gamified multiplication training web app with sprint modes, audio tracks, and leaderboard integration.',
      url: 'https://schuler314.github.io/Math-Ninja/',
      category: 'Education & Game',
      status: 'Live',
      nextTodo: 'Add boss battle division round.'
    },
    {
      id: 'site-4',
      title: 'Pedal Pals — Cycling & Workout Telemetry',
      tagline: 'Custom mobile workout & spin telemetry tracker with heart rate zone metrics.',
      url: 'https://schuler314.github.io/Pedal-Pals/',
      category: 'Fitness & Telemetry',
      status: 'Live',
      nextTodo: 'Add 45-second isometric tendon hold timer.'
    },
    {
      id: 'site-5',
      title: 'Kitchen Buddy — Galley & Pantry Tracker',
      tagline: 'Single-file inventory and grocery staple organizer hosted on GitHub Pages.',
      url: 'https://schuler314.github.io/Kitchen-Buddy/',
      category: 'Household',
      status: 'Live',
      nextTodo: 'Sync low-stock items to Harbor Wall Groceries.'
    },
    {
      id: 'site-6',
      title: 'Spelling Searcher — Interactive Word Grid',
      tagline: 'Custom elementary spelling practice word-search generator and interactive puzzle board.',
      url: 'https://schuler314.github.io/Spelling-Searcher/',
      category: 'Education',
      status: 'Live',
      nextTodo: 'Add weekly custom word list import.'
    },
    {
      id: 'site-7',
      title: 'Charleston Scavenger Hunt',
      tagline: 'Interactive coastal and historic district family exploration guide and clue tracker.',
      url: 'https://schuler314.github.io/Charleston-Scavenger-Hunt/',
      category: 'Family & Travel',
      status: 'Live',
      nextTodo: 'Add photo memory check-in badge.'
    }
  ],

  pdfConfig: {
    sheetDate: TODAY_ISO,
    pageTarget: '2page', // '2page' | '1page' | 'log_only'
    mobilePane: 'controls', // 'controls' | 'preview'
    threeHoleMargin: true,
    duplexMirrorMargin: true,
    lineDensity: 6,
    lineHeightPx: 24,
    lineStyle: 'ruled', // 'ruled' | 'dotted' | 'boxed'
    prayerNoteLines: 1,
    winsLines: 6,
    lessonsLines: 4,
    intentionLines: 3,
    examenStepLines: 4,
    baylorTaskRows: 8,
    baylorAnchorLines: 3,
    deepPrimaryLines: 8,
    deepSecondaryLines: 5,
    bibleVersion: 'BOTH', // 'NASB' | 'NLT' | 'BOTH'
    includeNightPlan: true,
    selectedNightCardIds: ['nw-1', 'nw-2', 'nw-7', 'nw-9', 'nw-13', 'nw-17'],
    includePrayerDeck: true,
    guidedPrayerMethod: 'PRAY', // 'PRAY' | 'LORDS_PRAYER' | 'NONE'
    selectedJesusThemeIds: ['jp-1', 'jp-3', 'jp-7'],
    includeCaptainsLog: true,
    selectedJournalModes: ['closure_321']
  }
};
