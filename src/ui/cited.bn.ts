// The Bangla of the data's cited texts (spec UI rule 48): real history, a target's "what we learn", postcard titles
// and captions, Rescue History, the Jupiter lesson, the rank jobs. Keyed by the exact English in src/data, so the
// data stays English and Sourced, and ⓘ keeps the English original with its source and link. A changed English text
// loses its Bangla until it is translated again: tests/cited.test.ts fails on any cited text with no Bangla here, and
// on any Bangla left over for an English text that is gone. Latin digits; NASA mission and target names in English.
export const CITED_BN: Readonly<Record<string, string>> = {
  // Danger cards: real history (hazards.json)
  '2001 Mars Odyssey: the MARIE radiation instrument stopped working after the large solar storms of October–November 2003.':
    '2001 Mars Odyssey: 2003 সালের অক্টোবর–নভেম্বরের বড় সৌরঝড়গুলোর পর এর MARIE বিকিরণ-যন্ত্রটি কাজ করা বন্ধ করে দেয়।',
  'In September 2017 a strong CME reached Mars. MAVEN saw a global aurora, and the radiation dose at the surface measured by Curiosity doubled.':
    '2017 সালের সেপ্টেম্বরে একটা শক্তিশালী CME মঙ্গলে পৌঁছায়। MAVEN পুরো গ্রহজুড়ে মেরুজ্যোতি দেখে, আর Curiosity-র মাপা ভূপৃষ্ঠের বিকিরণের মাত্রা দ্বিগুণ হয়ে যায়।',
  'Mariner 9 reached Mars in November 1971 during a planet-wide dust storm and waited for the dust to clear before mapping. A global storm in 2018 ended the solar-powered Opportunity rover.':
    'Mariner 9 মঙ্গলে পৌঁছায় 1971 সালের নভেম্বরে, যখন পুরো গ্রহজুড়ে ধুলোঝড় চলছিল; ধুলো না সরা পর্যন্ত সে মানচিত্র আঁকা শুরু না করে অপেক্ষা করে। 2018 সালের এক বিশ্বজোড়া ঝড়ে সৌরশক্তিতে চলা Opportunity রোভারের অভিযান শেষ হয়ে যায়।',
  'Comet Siding Spring passed close to Mars on Oct. 19, 2014. MAVEN, MRO and Mars Odyssey changed their orbit timing to shelter behind Mars when its dust was expected.':
    '2014 সালের 19 অক্টোবর ধূমকেতু Siding Spring মঙ্গলের খুব কাছ দিয়ে যায়। এর ধুলো যখন আসার কথা, তখন মঙ্গলের আড়ালে থাকতে MAVEN, MRO আর Mars Odyssey তাদের কক্ষপথের সময় বদলে নেয়।',
  'Kepler lost one reaction wheel in 2012 and a second in 2013. Engineers found a new way to point it using sunlight pressure, which became the K2 mission.':
    'Kepler 2012 সালে একটা রিঅ্যাকশন হুইল হারায়, 2013 সালে আরেকটা। প্রকৌশলীরা সূর্যের আলোর চাপ দিয়ে তাকে তাক করার নতুন উপায় বের করেন; সেটাই হয়ে ওঠে K2 মিশন।',
  'In February 2013 Curiosity\'s main computer had a memory problem, and the team switched the rover to its backup computer. In 2023–24 a failed memory chip garbled Voyager 1\'s data until engineers moved the code, with a day-long light-time each way.':
    '2013 সালের ফেব্রুয়ারিতে Curiosity-র প্রধান কম্পিউটারে মেমরির গোলমাল দেখা দেয়, আর দলটি রোভারকে তার ব্যাকআপ কম্পিউটারে চালায়। 2023–24 সালে একটা নষ্ট মেমরি-চিপ Voyager 1 যানের তথ্য এলোমেলো করে দেয়, যতক্ষণ না প্রকৌশলীরা কোডটি সরিয়ে নেন; প্রতি দিকে আলো যেতে লাগত প্রায় এক দিন।',
  'In 2016 Juno\'s main-engine helium valves did not work as expected. NASA kept Juno in its 53-day orbit instead of firing the engine again to reach the planned 14-day orbit.':
    '2016 সালে Juno-র প্রধান ইঞ্জিনের হিলিয়াম ভালভ ঠিকমতো কাজ করেনি। পরিকল্পিত 14 দিনের কক্ষপথে যেতে ইঞ্জিন আবার চালানোর বদলে NASA, Juno-কে তার 53 দিনের কক্ষপথেই রেখে দেয়।',
  'Juno carries its electronics in a titanium radiation vault, and its orbits were planned to limit the dose from Jupiter\'s radiation belts.':
    'Juno তার ইলেকট্রনিক যন্ত্রাংশ রাখে টাইটানিয়ামের একটা বিকিরণ-ভল্টে, আর তার কক্ষপথগুলো এমনভাবে সাজানো হয়েছিল যাতে বৃহস্পতির বিকিরণ-বলয় থেকে পাওয়া মাত্রা সীমার মধ্যে থাকে।',
  'Mars Global Surveyor began aerobraking in 1997 with a solar panel damaged at launch. When the panel bent on a low pass through the air, the team raised the periapsis, paused for a month and then dipped more gently, finishing in 1999.':
    'Mars Global Surveyor 1997 সালে এয়ারোব্রেকিং শুরু করে, উৎক্ষেপণের সময় ক্ষতিগ্রস্ত একটা সৌর প্যানেল নিয়ে। বাতাসের ভেতর দিয়ে এক নিচু পাসে প্যানেলটি বেঁকে গেলে দলটি কক্ষপথের সবচেয়ে নিচু বিন্দু উঁচু করে, এক মাস থামে, তারপর আরও আলতো করে নামে; কাজ শেষ হয় 1999 সালে।',
  // The old crisis cards: real history (crisisCards.json; Notebook lessons point at them)
  'Mars Climate Orbiter, 1999: one team used imperial units, the other metric; the craft flew too low and was lost.':
    'Mars Climate Orbiter, 1999: এক দল ব্যবহার করেছিল ইম্পেরিয়াল একক, অন্য দল মেট্রিক; মহাকাশযানটি খুব নিচ দিয়ে উড়ে হারিয়ে যায়।',
  'Genesis, 2004: deceleration sensors were installed backwards; the parachute never opened.':
    'Genesis, 2004: গতি কমার সেন্সরগুলো উল্টো করে বসানো হয়েছিল; প্যারাশুট আর খোলেনি।',
  'Mars Polar Lander, 1999: likely shut its engine early after reading leg vibration as touchdown.':
    'Mars Polar Lander, 1999: পায়ের কাঁপুনিকে মাটি ছোঁয়া ভেবে সম্ভবত আগেভাগেই ইঞ্জিন বন্ধ করে দেয়।',
  'Spirit rover, 2004: too many files filled flash memory and caused reboots; fixed from Earth.':
    'Spirit রোভার, 2004: অনেক বেশি ফাইলে ফ্ল্যাশ মেমরি ভরে গিয়ে বারবার রিবুট হয়; পৃথিবী থেকে ঠিক করা হয়।',
  'SOHO, 1998: lost attitude control and contact; recovered months later.':
    'SOHO, 1998: দিক ধরে রাখার নিয়ন্ত্রণ আর যোগাযোগ দুটোই হারায়; কয়েক মাস পরে উদ্ধার হয়।',
  'Solar particle events can trigger spacecraft safe mode.':
    'সৌরকণার ঝড় মহাকাশযানকে সেফ মোডে পাঠিয়ে দিতে পারে।',
  // Science targets: what we learn (targets.json, moonTargets.json)
  'How a volcano grows about 2.5 times taller than Everest.':
    'একটা আগ্নেয়গিরি কীভাবে এভারেস্টের প্রায় 2.5 গুণ উঁচু হয়ে ওঠে।',
  'A canyon over 3,000 km long and 8 km deep, and what tore it open.':
    '3,000 km-এর বেশি লম্বা আর 8 km গভীর এক গিরিখাত, আর কী তাকে ছিঁড়ে খুলেছিল।',
  'Ice cut by spiral troughs that show its layers, a record of Mars weather.':
    'সর্পিল খাদে কাটা বরফ, যা তার স্তরগুলো দেখিয়ে দেয়: মঙ্গলের আবহাওয়ার এক দলিল।',
  'Grooves and landslides on a moon slowly falling toward Mars.':
    'এমন এক চাঁদের খাঁজ আর ভূমিধস, যে ধীরে ধীরে মঙ্গলের দিকে পড়ে যাচ্ছে।',
  'Why the smaller moon looks smoothed over, as if with sand.':
    'ছোট চাঁদটি কেন দেখতে মসৃণ, যেন বালি দিয়ে ঢেকে দেওয়া।',
  'How the thin air is stacked in layers of ice cloud and dust.':
    'পাতলা বাতাস কীভাবে বরফ-মেঘ আর ধুলোর স্তরে স্তরে সাজানো।',
  'Where people first walked on another world. Their footpaths still show from orbit.':
    'যেখানে মানুষ প্রথম অন্য এক জগতে হেঁটেছিল। তাদের পায়ে চলা পথ আজও কক্ষপথ থেকে দেখা যায়।',
  'A young crater, about 110 million years old. Its bright rays reach across the near side.':
    'এক তরুণ গহ্বর, বয়স প্রায় 110 মিলিয়ন বছর। এর উজ্জ্বল রশ্মি কাছের দিক জুড়ে ছড়িয়ে আছে।',
  'The south pole is on its rim. Its floor never sees the Sun, and may hold frozen water.':
    'দক্ষিণ মেরু এর কিনারায়। এর তলায় কখনো সূর্যের আলো পড়ে না, হয়তো সেখানে জমাট পানি আছে।',
  'A crater 185 km wide on the far side, which Earth never sees. Dark lava flooded its floor.':
    'দূরের দিকের 185 km চওড়া এক গহ্বর, যা পৃথিবী থেকে কখনো দেখা যায় না। কালো লাভা এর তলা ভাসিয়ে দিয়েছিল।',
  // Postcards: titles and captions (postcards.json)
  'Earthrise':
    'পৃথিবীর উদয়',
  'NASA’s Lunar Reconnaissance Orbiter took this picture of Earth from its orbit around the Moon.':
    'NASA-র Lunar Reconnaissance Orbiter চাঁদের চারপাশের কক্ষপথ থেকে পৃথিবীর এই ছবিটি তুলেছে।',
  'Sunrise on Tycho':
    'Tycho গহ্বরে সূর্যোদয়',
  'Sunrise on the central peak of Tycho crater, seen by the Lunar Reconnaissance Orbiter. Tycho is about 82 km wide, and its peak rises about 2 km above the crater floor.':
    'Tycho গহ্বরের মাঝের চূড়ায় সূর্যোদয়, Lunar Reconnaissance Orbiter-এর চোখে। Tycho প্রায় 82 km চওড়া, আর এর চূড়া গহ্বরের মেঝে থেকে প্রায় 2 km উঁচু।',
  'Apollo 11, from above':
    'Apollo 11, ওপর থেকে',
  'The Apollo 11 landing site, seen by the Lunar Reconnaissance Orbiter in 2009. The labels mark the Eagle lander’s descent stage and the experiments the astronauts left behind.':
    'Apollo 11 অভিযানের নামার জায়গা, 2009 সালে Lunar Reconnaissance Orbiter-এর চোখে। লেবেলগুলো দেখাচ্ছে Eagle ল্যান্ডারের নামার অংশ আর নভোচারীদের রেখে আসা পরীক্ষাগুলো।',
  'The whole red planet':
    'পুরো লাল গ্রহ',
  'Mars from space: the white north polar cap at the top and the giant canyon Valles Marineris across the middle.':
    'মহাকাশ থেকে মঙ্গল: ওপরে সাদা উত্তর মেরুর বরফ-টুপি, আর মাঝ বরাবর বিশাল গিরিখাত Valles Marineris।',
  'Dunes on the move':
    'চলমান বালিয়াড়ি',
  'Nili Patera is one of the most active dune fields on Mars. The HiRISE camera on Mars Reconnaissance Orbiter takes a new picture of it about every six weeks.':
    'Nili Patera মঙ্গলের সবচেয়ে সক্রিয় বালিয়াড়ি-অঞ্চলগুলোর একটা। Mars Reconnaissance Orbiter-এর HiRISE ক্যামেরা প্রায় প্রতি ছয় সপ্তাহে এর একটা নতুন ছবি তোলে।',
  'Victoria Crater':
    'Victoria গহ্বর',
  'Victoria Crater, seen at a sideways angle by HiRISE on Mars Reconnaissance Orbiter. The Opportunity rover explored this crater from its rim.':
    'Victoria গহ্বর, Mars Reconnaissance Orbiter-এর HiRISE-এর চোখে, পাশ থেকে হেলানো কোণে। Opportunity রোভার এর কিনারা থেকে গহ্বরটি ঘুরে দেখেছিল।',
  'Venus without clouds':
    'মেঘ ছাড়া শুক্র',
  'The surface of Venus, mapped by the Magellan spacecraft’s radar, which sees through the thick clouds.':
    'শুক্রের ভূপৃষ্ঠ, Magellan মহাকাশযানের রাডারে আঁকা মানচিত্রে; রাডার ঘন মেঘ ভেদ করে দেখতে পায়।',
  'Maat Mons':
    'আগ্নেয়গিরি Maat Mons',
  'Maat Mons, a giant volcano on Venus, in a 3-D view made from Magellan data.':
    'শুক্রের এক বিশাল আগ্নেয়গিরি Maat Mons, Magellan-এর তথ্য থেকে বানানো 3-D দৃশ্যে।',
  'Coronae':
    'শুক্রের করোনা',
  'Two coronae, huge round structures on Venus, mapped by Magellan. Bahet Corona, on the left, is about 230 km long.':
    'শুক্রের দুটো করোনা, মানে বিশাল গোল কাঠামো, Magellan-এর আঁকা মানচিত্রে। বাঁদিকের Bahet Corona প্রায় 230 km লম্বা।',
  'Bennu up close':
    'কাছ থেকে Bennu',
  'A patch of asteroid Bennu about 180 m wide: rocks, big boulders and a smooth “pond” of fine material, seen by OSIRIS-REx’s cameras.':
    'গ্রহাণু Bennu-র প্রায় 180 m চওড়া এক টুকরো জায়গা: পাথর, বড় বড় চাঁই আর মিহি উপাদানের এক মসৃণ “পুকুর”, OSIRIS-REx-এর ক্যামেরায়।',
  'Home with a sample':
    'নমুনা নিয়ে ঘরে ফেরা',
  'September 24, 2023: the OSIRIS-REx sample capsule has just landed in the Utah desert, with rocks and dust from asteroid Bennu inside.':
    '24 সেপ্টেম্বর, 2023: OSIRIS-REx-এর নমুনা-ক্যাপসুল সবে Utah-র মরুভূমিতে নেমেছে, ভেতরে গ্রহাণু Bennu-র পাথর আর ধুলো।',
  'A piece of Bennu':
    'Bennu-র এক টুকরো',
  'A piece of asteroid Bennu, brought to Earth by OSIRIS-REx, set into a microscope slide at NASA Goddard.':
    'OSIRIS-REx-এর পৃথিবীতে আনা গ্রহাণু Bennu-র এক টুকরো, NASA Goddard-এ মাইক্রোস্কোপের স্লাইডে বসানো।',
  // Rescue History, Mars Climate Orbiter: what happened, the clues and the failure report (rescueCases.json)
  'Lost on arrival at Mars on Sept. 23, 1999. Ground software used English units while onboard software worked in metric; the error sent the spacecraft too close to Mars.':
    '1999 সালের 23 সেপ্টেম্বর মঙ্গলে পৌঁছানোর সময় হারিয়ে যায়। মাটির সফটওয়্যার ব্যবহার করছিল ইংরেজি একক, আর মহাকাশযানের নিজের সফটওয়্যার কাজ করছিল মেট্রিক এককে; এই ভুল মহাকাশযানকে মঙ্গলের খুব কাছে পাঠিয়ে দেয়।',
  'Lopsided solar wing':
    'একপেশে সৌর ডানা',
  'The solar array sat on one side of the craft. Sunlight pushed on it, so small thrusters fired far more often than the navigators expected to keep the craft steady.':
    'সৌর প্যানেলটি বসানো ছিল যানের এক পাশে। সূর্যের আলো তাতে ধাক্কা দিত, তাই যানটিকে স্থির রাখতে ছোট থ্রাস্টারগুলো নেভিগেটরদের ধারণার চেয়ে অনেক বেশিবার জ্বলত।',
  'Real, and it made things worse: more firings meant the error grew faster. But each firing was logged. The bug was in how the pushes were written down.':
    'সত্যি, আর এতে অবস্থা আরও খারাপ হয়েছিল: বেশি জ্বলা মানে ভুলটা আরও দ্রুত বাড়া। কিন্তু প্রতিটি জ্বলা লিখে রাখা হতো। বাগটা ছিল ধাক্কাগুলো কীভাবে লেখা হয়েছিল, তাতে।',
  'Angular momentum desaturation (AMD) events happened 10-14 times more often than the navigation team expected, because MCO\'s solar array was asymmetrical.':
    'কৌণিক ভরবেগ কমানোর (AMD) ঘটনা নেভিগেশন দলের ধারণার চেয়ে 10-14 গুণ বেশি ঘটত, কারণ MCO-র সৌর প্যানেল ছিল অপ্রতিসম।',
  'Thruster-firing file':
    'থ্রাস্টার জ্বলার ফাইল',
  'After every small thruster firing, the spacecraft team\'s software wrote down how hard the thrusters pushed, and sent the file to the navigators in another state.':
    'প্রতিবার ছোট থ্রাস্টার জ্বলার পর মহাকাশযান-দলের সফটওয়্যার লিখে রাখত থ্রাস্টারগুলো কত জোরে ধাক্কা দিল, আর ফাইলটা পাঠাত অন্য এক অঙ্গরাজ্যের নেভিগেটরদের কাছে।',
  'Found it! The file gave each push in pound-force seconds, but the navigators read the numbers as newton-seconds.':
    'পেয়েছ! ফাইলে প্রতিটি ধাক্কা লেখা ছিল পাউন্ড-ফোর্স সেকেন্ডে, কিন্তু নেভিগেটররা সংখ্যাগুলো পড়েছিলেন নিউটন-সেকেন্ড হিসেবে।',
  'The SM_FORCES software was required to give its output in newton-seconds (N·s). Instead the data in the Angular Momentum Desaturation (AMD) file was in pound-force seconds (lbf·s).':
    'SM_FORCES সফটওয়্যারের ফল দেওয়ার কথা ছিল নিউটন-সেকেন্ডে (N·s)। তার বদলে Angular Momentum Desaturation (AMD) ফাইলের তথ্য ছিল পাউন্ড-ফোর্স সেকেন্ডে (lbf·s)।',
  'Skipped safety burn':
    'বাদ পড়া নিরাপত্তা-বার্ন',
  'A last-chance course correction (TCM-5) was ready to raise the craft if it came in too low. It was discussed just before arrival, but never done.':
    'শেষ সুযোগের একটা পথ-সংশোধন (TCM-5) তৈরি ছিল, যান খুব নিচু দিয়ে এলে তাকে উঁচুতে তোলার জন্য। পৌঁছানোর ঠিক আগে এ নিয়ে কথা হয়েছিল, কিন্তু করা হয়নি।',
  'Real, and it might have saved the craft at the last minute. But it would only have patched the symptom: the bad data was still there.':
    'সত্যি, আর শেষ মুহূর্তে হয়তো এটা যানটিকে বাঁচাতে পারত। কিন্তু এটা শুধু লক্ষণটাই ঢাকত: ভুল তথ্য তখনও থেকে যেত।',
  'A request to perform TCM-5 was discussed verbally shortly before the orbit insertion procedure began, but was never executed.':
    'কক্ষপথে ঢোকার কাজ শুরুর অল্প আগে মুখে মুখে TCM-5 করার একটা অনুরোধ নিয়ে কথা হয়েছিল, কিন্তু তা কখনো করা হয়নি।',
  'Busy navigators':
    'ব্যস্ত নেভিগেটর',
  'The navigation team was looking after three missions at the same time, so very few people were watching this one.':
    'নেভিগেশন দল একসঙ্গে তিনটি মিশন দেখছিল, তাই খুব কম মানুষ এটির দিকে নজর রাখছিলেন।',
  'Real, and it made the mistake harder to catch. But the navigators were working with numbers that were wrong from the start.':
    'সত্যি, আর এতে ভুলটা ধরা কঠিন হয়েছিল। কিন্তু নেভিগেটররা শুরু থেকেই ভুল সংখ্যা নিয়ে কাজ করছিলেন।',
  'The operations project was running three missions at once (Mars Global Surveyor, Mars Climate Orbiter, Mars Polar Lander); MCO navigation was handled by the navigation team lead and the MCO navigator.':
    'অপারেশন প্রকল্পটি একসঙ্গে তিনটি মিশন চালাচ্ছিল (Mars Global Surveyor, Mars Climate Orbiter, Mars Polar Lander); MCO-র নেভিগেশন সামলাতেন নেভিগেশন দলের প্রধান আর MCO-র নেভিগেটর।',
  // The Jupiter lesson (lessons.json)
  'Borrow speed from a planet':
    'একটা গ্রহের কাছ থেকে গতি ধার নাও',
  'No rocket of its day could throw Juno straight to Jupiter. Juno launched on an Atlas V on Aug. 5, 2011, flew back past Earth 26 months later to pick up speed from Earth\'s gravity (a gravity assist), and reached Jupiter on July 4, 2016.':
    'সে সময়ের কোনো রকেট Juno-কে সরাসরি বৃহস্পতিতে ছুড়ে দিতে পারত না। Juno উৎক্ষেপিত হয় 5 আগস্ট, 2011, একটা Atlas V রকেটে; 26 মাস পরে পৃথিবীর পাশ দিয়ে ফিরে এসে পৃথিবীর মাধ্যাকর্ষণ থেকে গতি নেয় (গ্র্যাভিটি অ্যাসিস্ট), আর বৃহস্পতিতে পৌঁছায় 4 জুলাই, 2016।',
  // Ranks: the real jobs (ranks.json)
  'A trainee in Mission Control, learning how robots in deep space stay alive.':
    'মিশন কন্ট্রোলের একজন শিক্ষানবিশ, যে শিখছে গভীর মহাকাশে রোবটরা কীভাবে টিকে থাকে।',
  'In NASA Mission Control, each flight controller watches one part of the spacecraft, such as power or communications, from a console.':
    'NASA-র মিশন কন্ট্রোলে প্রত্যেক ফ্লাইট কন্ট্রোলার একটা কনসোল থেকে মহাকাশযানের একটা অংশ দেখেন, যেমন শক্তি বা যোগাযোগ।',
  'CAPCOM, the capsule communicator: on crewed flights, the one person in Mission Control who talks to the astronauts.':
    'CAPCOM, মানে ক্যাপসুল কমিউনিকেটর: মানুষ-বহনকারী অভিযানে মিশন কন্ট্রোলের সেই একজন, যিনি নভোচারীদের সঙ্গে কথা বলেন।',
  'The flight director leads the Mission Control team and makes the final call on every decision.':
    'ফ্লাইট ডিরেক্টর মিশন কন্ট্রোল দলের নেতৃত্ব দেন, আর প্রতিটি সিদ্ধান্তে শেষ কথা বলেন।',
  'Every star in the game. Mission Control will tell stories about you.':
    'খেলার প্রতিটি তারা। মিশন কন্ট্রোল তোমাকে নিয়ে গল্প বলবে।',
  // Notebook rules: the rule's own citation is its real history (notebook.ts fromRule)
  'JPL news, \'Mars Missions to Pause Commanding in June, Due to Sun\' (2015): the moratorium applies while \'the sun will be within two degrees of Mars in Earth\'s sky\'':
    'JPL-এর খবর, \'Mars Missions to Pause Commanding in June, Due to Sun\' (2015): আদেশ পাঠানো বন্ধ থাকে যতক্ষণ \'পৃথিবীর আকাশে সূর্য মঙ্গলের দুই ডিগ্রির মধ্যে থাকবে\'।',
  'Game estimate, to verify against a mission battery design: chosen from JPL D-101146, Energy Storage Technologies for Future Planetary Science Missions (Dec. 2017), which reports Li-ion cycle life of >30,000 cycles at 30% depth of discharge (an orbiter in a low orbit sees thousands of eclipses a year)':
    'গেমের অনুমান, কোনো মিশনের ব্যাটারি-নকশার সঙ্গে মিলিয়ে দেখা বাকি: JPL D-101146, Energy Storage Technologies for Future Planetary Science Missions (ডিসেম্বর 2017) থেকে বেছে নেওয়া, যেখানে বলা হয়েছে 30% ডিসচার্জ গভীরতায় Li-ion ব্যাটারি 30,000 বারের বেশি চক্র টেকে (নিচু কক্ষপথের একটা অরবিটার বছরে হাজার হাজার গ্রহণ দেখে)।',
};
