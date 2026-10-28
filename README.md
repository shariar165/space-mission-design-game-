<div align="center">

# 🛰️ Signal Delay

### A deep-space mission game built on real NASA data and real orbital physics

*You don't fly the rocket. You keep a robot alive millions of kilometres away, and every order you send arrives minutes late.*

**[▶ Play in your browser](https://shariar165.github.io/space-mission-design-game-/)** · no install, no account

[![Deploy to GitHub Pages](https://github.com/shariar165/space-mission-design-game-/actions/workflows/pages.yml/badge.svg)](https://github.com/shariar165/space-mission-design-game-/actions/workflows/pages.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![React](https://img.shields.io/badge/React-19-61dafb)
![Vite](https://img.shields.io/badge/Vite-8-646cff)
![Tests](https://img.shields.io/badge/tests-vitest-6e9f18)

<img src="docs/images/home.png" alt="Signal Delay home screen: an order crawls from Earth to a spacecraft at Mars at the speed of light" width="860">

</div>

---

## Contents

- [About the game](#about-the-game)
- [How to play](#how-to-play)
- [Real science, not invented numbers](#real-science-not-invented-numbers)
- [NASA data used in this game](#nasa-data-used-in-this-game)
- [Validation against real missions](#validation-against-real-missions)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [Acknowledgements and disclaimer](#acknowledgements-and-disclaimer)
- [License](#license)

---

## About the game

> **Keep a robot you'll never touch alive, under the real sky, with words that arrive too late.**
> **Keep it alive long enough to bring the science home.**

**Signal Delay** is a browser game about the hardest part of robotic space exploration: you are not there. A spacecraft at Mars is between 3 and 22 light-minutes from Earth. When a solar storm is coming, the team on the ground has to decide, send the order, and hope it crosses space before the danger arrives.

The game turns the work of a NASA mission team into three steps:

1. **Pack.** Choose which parts fit in the rocket's nose and which dangers to prepare for.
2. **Fly & Survive.** The mission runs day by day. Danger cards stop the clock, you choose a response, and your order travels to the spacecraft at the speed of light. At Mars the robot asks **what it should look at**: six science targets, each picture costing fuel, battery or risk, each one coming home through a DSN pass and printing on the teletype.
3. **Mission Report.** It opens with the **mission album** of the pictures that made it home, then the robot's final transmission; your flight is printed as a comic strip, scored, compared with the real NASA mission to the same place, and turned into a real engineering lesson.

It is designed for students and curious players first (**Cadet mode**), and for anyone who wants to see the physics underneath (**Engineer mode**, where every number can be opened to show its equation, its inputs and its source).

### What makes it different

- **Every number comes from physics or a cited source.** Distances come from JPL planetary positions, power from the inverse-square law calibrated on MAVEN, data rates from a link budget anchored to Mars Reconnaissance Orbiter, launch energy from a Lambert solver.
- **Real missions are flown through the same model as the player.** MAVEN and OSIRIS-REx are loaded as ordinary designs and must reproduce their published numbers. If the model can't, the model is fixed, not the mission.
- **Honest about guesses.** All physics and mission data are sourced. Values with no public source (failure chances, part costs, hazard rates) are labelled **game estimate** in the game itself and listed in [`TODO_DATA.md`](TODO_DATA.md).
- **Light delay is the core mechanic.** Commands obey `t = d / c` using the real Earth–spacecraft distance on that mission day. Solar conjunctions black out the radio for about two weeks, as they do for real Mars missions.

---

## How to play

<table>
<tr>
<td width="50%"><img src="docs/images/pack.png" alt="Pack screen: rocket nose grid, parts shelf, danger deck and launch calendar"></td>
<td width="50%"><img src="docs/images/fly-danger-card.png" alt="Fly and Survive: a solar storm danger card with two responses"></td>
</tr>
<tr>
<td><b>Pack.</b> The nose is a 6 × 6 grid (volume) and the scale is the rocket's lift (weight): two separate limits. The danger deck shows what is coming at this destination, and the launch calendar shows which days the planets line up.</td>
<td><b>Fly & Survive.</b> A danger card shows when the danger arrives and how long your order takes to get there. Pick a response, or let the robot use its default.</td>
</tr>
</table>

<p align="center"><img src="docs/images/report.png" alt="Mission Report: comic strip of the flight, stars, comparison with MAVEN and a new notebook card" width="860"></p>

### Missions

| # | Mission | Destination | What it teaches |
| --- | --- | --- | --- |
| 1 | First Light | Moon | Power: solar wings that keep the craft charged |
| 2 | Heavy Lifting | Moon | Fuel and weight: every kilogram of fuel must be lifted too |
| 3 | Full Build | Moon | Science and radio: build the whole craft |
| 4 | Red Planet | Mars | Light delay: too far to steer live |
| 5 | Cloud Diver | Venus | Budget: big radar, small wallet |
| 6 | Pebble Catcher | Bennu (asteroid) | Rendezvous and sample return |
| 7 | Giant Leap | Jupiter | Rocket limits: why real missions to Jupiter need gravity assists |

Each mission earns up to three stars, all for the **science you bring home** (the main score): the **first science home**, **half of it**, and **80% of it**. At Mars that is the weight of the target pictures that came home (pictures already home count even if the robot is lost later); elsewhere it is the data sent home against the goal. One star opens the next mission. Margins in the healthy 10–30% band still score in Engineer mode.

### More ways to play

- **বাংলা.** EN / বাংলা in every top bar switches the game's words to Bangla (numbers and units stay the same; NASA mission and target names stay in English). Being translated screen by screen.
- **Cold open.** A first launch opens on a single key, ▶ RECEIVE TRANSMISSION (it lets the sound start), then the night Mars Climate Orbiter went silent (Sept. 23, 1999), in about 15 seconds told only from the game's cited facts, then you name your robot. SKIP anytime; INTRO on Home replays it.
- **Sound.** Synthesised in the browser (no audio files): teletype clack, CRT hum, radio static while a signal is in transit, beeps when an order or reply arrives, the danger alert and the printer's rattle. It starts after your first click or key, is quiet by default, and the 🔊 key in every top bar mutes it.
- **Daily mission.** The same Mars flight for every player each day, with a spoiler-free share card (like a word-puzzle grid).
- **Rescue History.** Investigate a real lost mission from its published failure report. The first case is Mars Climate Orbiter (1999), lost to a pound-force versus newton mix-up.
- **Engineer's Notebook.** Lessons unlocked by what you do in flight. Each one points at a real event already cited in the game's data.
- **Engineer mode.** Design the whole spacecraft in the Build Bay (bus, instruments, arrays or RTGs, antenna, engine, propellant, orbits, launch dates), then fly it with live readouts and an EQUATIONS drawer.

**Controls:** ← / → (or swipe) to choose a response, ↓ for a third option, `?` for help. Time runs at 10×, 100× or 1000× mission days a minute, and **FINISH MISSION** lets the robot fly the rest so every flight reaches the report.

---

## Real science, not invented numbers

The game follows three rules from its science specification ([`docs/SCIENCE_SPEC.md`](docs/SCIENCE_SPEC.md)):

1. **One model for everyone.** The player's craft and real missions run through the same equations.
2. **Sourced inputs.** Every constant and catalogue value is stored as a `Sourced<T>` record: value, unit, source, link, and an `isGameEstimate` flag. A test fails the build if any number in the data files is not wrapped this way.
3. **Show the working.** In Engineer mode every meter opens to its equation and inputs, and the ⓘ button shows where each input came from.

The interface never calculates anything. It asks the engine and only formats units, and an automated test rejects any digits typed into the UI.

The full rule book of the simulation (equations, constants, how hazards are drawn, how the score is computed) is in **[`game_engine.md`](game_engine.md)**.

---

## NASA data used in this game

All values below are stored in `src/data/*.json` or `src/engine/*.ts` with their source and link, and can be opened in the game with ⓘ.

### Planets, the Moon and Bennu

| Data | Used for | Source |
| --- | --- | --- |
| Mars semimajor axis, orbit and synodic periods, radius, GM, distance from Earth (54.6–401.4 million km), solar irradiance, pole of rotation | Mars orbit, light delay, power, eclipses, dust-storm season | [NASA NSSDC Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Earth GM, equatorial radius, sidereal year; solar irradiance at 1 AU (1361 W/m²) | Launch and power calculations | [NASA NSSDC Earth/Mars Fact Sheets](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Venus GM, radius, solar irradiance (2601.3 W/m²), pole of rotation | Venus missions | [NASA NSSDC Venus Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html) |
| Jupiter GM, radius, solar irradiance (50.26 W/m²), pole of rotation | Jupiter missions | [NASA NSSDC Jupiter Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html) |
| Moon semimajor axis, orbit period, GM, radius | Lunar missions | [NASA NSSDC Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html) |
| Orbit and size summary for all destinations | Destination catalogue | [NASA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/index.html) |
| Keplerian elements and rates, Table 1 (1800–2050) for Earth–Moon barycentre, Venus, Mars, Jupiter; obliquity at J2000 | Planet positions on every mission day | [JPL Approximate Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html) |
| 101955 Bennu osculating elements (orbit solution 118) and GM | Asteroid position and rendezvous | [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=101955) |
| Mars perihelion solar longitude, Lₛ = 251.000° + 0.0064891° × (year − 2000) | Mars seasons and dust storms | [NASA GISS Mars24 technical notes](https://www.giss.nasa.gov/tools/mars24/help/notes.html) |

### Real missions

| Mission | Data used | Source |
| --- | --- | --- |
| **MAVEN** (Mars, 2013–2025) | 2,454 kg wet / 809 kg dry, hydrazine, 12 m² arrays producing 1,150–1,700 W, 2 m high-gain antenna, 65 kg science payload, Atlas V 401, launch Nov 18 2013, orbit insertion Sept 21 2014 | [NASA Science: MAVEN](https://science.nasa.gov/mission/maven/) |
| | Capture orbit (35 h, 380 km), science orbit (150 × 6,300 km, 4.5 h), insertion burn uses more than half the fuel, one-year prime mission | [NASAfacts: MAVEN Orbit Insertion](https://science.nasa.gov/wp-content/uploads/2024/03/44740_MAVEN-Fact-Sheet.pdf) |
| | Launch period Nov 18 – Dec 7 2013, planned insertion Sept 22 2014 | [NASA: The 2013 MAVEN Mission to Mars](https://mars.nasa.gov/files/resources/MAVENPresentation2013.pdf) |
| | Science orbit inclination 75° | [L. J. Wood, AAS 21-211 (JPL DESCANSO)](https://descanso.jpl.nasa.gov/evolution/AAS%2021-211.pdf) |
| **OSIRIS-REx** (Bennu, 2016) | Launch Sept 8 2016, launch C3 = 29.29678 km²/s², 2,105 kg, Earth flyby route, deep-space manoeuvre Dec 28 2016, approach Aug 13 2018, 1,226–2,500 W arrays, hydrazine | [Lauretta et al. 2017, OSIRIS-REx mission description (arXiv 1702.06981)](https://arxiv.org/pdf/1702.06981) |
| **LRO and LCROSS** (Moon, 2009) | LRO 1,850 kg on Atlas V 401 AV-020, June 18 2009; LCROSS as the secondary payload, limited to 1,000 kg fuelled | [NASA Science: LRO](https://science.nasa.gov/mission/lro/about/), [NASA Science: LCROSS](https://science.nasa.gov/mission/lcross/), [NTRS 20100028203](https://ntrs.nasa.gov/citations/20100028203) |
| **Juno** (Jupiter, 2011) | Atlas V launch Aug 5 2011, Earth flyby 26 months later, Jupiter arrival July 4 2016 (the "Giant Leap" lesson) | [NASA Science: Juno](https://science.nasa.gov/mission/juno/) |
| **Mars Climate Orbiter** (1999) | Launch, masses, solar array, main engine, arrival distance and light time | [NASA/JPL MCO Arrival press kit](https://mars.nasa.gov/internal_resources/812/), [NASA Science: MCO](https://science.nasa.gov/mission/mars-climate-orbiter/) |
| | Root cause (impulse in lbf·s instead of N·s), planned 226 km periapsis, 80 km survivable, 57 km actual, contributing causes | [MCO Mishap Investigation Board Phase I Report](https://discovery.larc.nasa.gov/PDF_FILES/MCO_report_2.pdf) |

### Spacecraft systems, communications and operations

| Data | Used for | Source |
| --- | --- | --- |
| MMRTG: about 110 W at launch, about 45 kg | Nuclear power option | [NASA MMRTG fact sheet](https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf) |
| Li-ion cycle life at 30% depth of discharge | Battery sizing rule | [JPL D-101146, Energy Storage Technologies for Future Planetary Science Missions](https://solarsystem.nasa.gov/system/downloadable_items/716_Energy_Storage_Tech_Report_FINAL.PDF) |
| MRO X-band design point: ≥ 500 kbps at 400 million km, 100 W TWTA, 3 m antenna | Anchor of the communications model | [DESCANSO Article 12: MRO Telecommunications](https://descanso.jpl.nasa.gov/DPSummary/MRO_092106.pdf) |
| DSN X-band receive gains: 70 m (74.55 dBi) and 34 m BWG (68.24 dBi) | Small vs big dish data rates | [DSN 810-005 module 101](https://deepspace.jpl.nasa.gov/dsndocs/810-005/101/101I.pdf), [module 104](https://deepspace.jpl.nasa.gov/dsndocs/810-005/104/104Q.pdf) |
| DSN aperture fee formula, $1,057/h (FY09), aperture weights 1 (34 m) and 4 (70 m), pass set-up and tear-down | Cost of booking a call home | [NASA Mission Operations and Communications Services (JPL D-22674)](https://deepspace.jpl.nasa.gov/files/6_NASA_MOCS_2014_10_01_14.pdf) |
| No commanding while the Sun is within 2° of Mars in Earth's sky | Solar conjunction blackouts | [JPL news, 2015](https://www.jpl.nasa.gov/news/mars-missions-to-pause-commanding-in-june-due-to-sun/) |
| Discovery cost cap, $500M (FY2019), excluding launch and operations | Mission budget | [NASA Discovery 2019 AO overview](https://discovery.larc.nasa.gov/PDF_FILES/03a_Brown_Overview.pdf) |
| Payload vs launch energy (C3) curves for Atlas V 401 and 411 | Rocket lift | [NASA Launch Services Program performance site](https://elvperf.ksc.nasa.gov/) (see the note below) |

### Space weather and Mars dust storms

| Data | Used for | Source |
| --- | --- | --- |
| Strong (S3) and severe (S4) solar radiation storms: 10 + 3 per 11-year cycle | Solar storm hazard rate | [NOAA Space Weather Scales](https://www.spaceweather.gov/noaa-scales-explanation) |
| Solar cycle 24 (minimum Dec 2008, maximum Apr 2014) and cycle 25 (minimum Dec 2019, maximum Oct 2024) | Storms are likelier near solar maximum | [NOAA SWPC](https://www.swpc.noaa.gov/news/sun-solar-maximum-solar-cycle-24-seeing-second-higher-peak-sunspot-number-updated), [NASA/NOAA 2024](https://science.nasa.gov/science-research/heliophysics/nasa-noaa-sun-reaches-maximum-phase-in-11-year-solar-cycle/) |
| Global dust storms about once every three Mars years | Mars dust-storm hazard rate | [NASA: The Fact and Fiction of Martian Dust Storms](https://www.nasa.gov/solar-system/the-fact-and-fiction-of-martian-dust-storms/) |

### Live NASA data

Two features follow the real sky day by day. Both stay deterministic and fully tested.

| Feature | Data | How it works | Source |
| --- | --- | --- | --- |
| **Mars right now** (Home) | Today's Earth–Mars distance, one-way light time (d / c), and the next solar conjunction (Sun within 2° of Mars in Earth's sky) with its closest day | Computed in the browser from the JPL approximate elements above, for today's date. No API call. The closest day of the Jan 2026 conjunction (computed: Jan 9) falls inside NASA's published commanding pause, Dec 29, 2025 – Jan 16, 2026 | [JPL Approximate Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html), [NASA MAVEN blog, Dec 2025](https://science.nasa.gov/blogs/maven/2025/12/23/nasa-works-maven-spacecraft-issue-ahead-of-solar-conjunction/) |
| **The Daily's real Sun** | NASA DONKI solar energetic particle events (SEP), coronal mass ejections (CME) with NASA's WSA-ENLIL arrival predictions, and solar flares (FLR) from the 7 whole UTC days before today | See the steps below the table | [CCMC DONKI-API](https://ccmc.gsfc.nasa.gov/news/major-updates/) (base `https://ccmc.gsfc.nasa.gov/DONKI-API/get/`, no API key), [NOAA flare classes](https://www.swpc.noaa.gov/phenomena/solar-flares-radio-blackouts) |

How the Daily's real Sun works:
1. **The snapshot.** The site's deploy build ([`pages.yml`](.github/workflows/pages.yml)) runs on every change and daily at 00:20 UTC (GitHub sometimes starts it hours late). It fetches the week from DONKI and publishes it with the site as `data/donki-latest.json`, with the fetch time and source URLs; the file is never committed. The game reads only that file and never calls NASA from your browser.
2. **Which events are dangers.** Every SEP event is a **solar radiation storm** (DONKI logs one record per instrument, so records linked to the same flare count once). A CME is a danger only when NASA's **WSA-ENLIL** model predicts it reaches Mars; it becomes a **CME shock**. Flares are never cards themselves: a flare DONKI links to an SEP or CME is named on that card. The 4 most severe are kept.
3. **When they strike.** The real week is replayed across your flight: an event a fraction f into the week happens the same fraction of the way from the start of cruise to the end of the prime mission. A CME's shock then arrives after its real ENLIL transit time, so "danger arrives in" is NASA's predicted travel time. ENLIL's glancing-blow and minor-impact flags make a hit less dangerous (×0.5 and ×0.25 on the failure chance, game estimates).
4. **What you see.** Each card names the real event and its flare, and its ⓘ opens the DONKI record. On a CME card a second ⓘ, beside "danger arrives", shows the arrival as a **NASA WSA-ENLIL model prediction**, not an observation.
5. **The seed.** It is the date plus the DONKI event IDs, so everyone with the same snapshot flies the same Daily.
6. **When the file can't be used.** If it is missing, unreadable or more than 2 days old, the Daily flies seeded storms and says **"offline — simulated weather"**.
7. **The game rules.** The severity factors, the cap of 4, the 7-day window and the 2-day staleness limit are game rules, listed in [`TODO_DATA.md`](TODO_DATA.md).

DONKI moved from `api.nasa.gov` to CCMC on Sept 30, 2026; the old URLs now redirect to CCMC's announcement.

### Mars science targets and their pictures

At Mars the science is six targets. What each picture costs comes from the same physics as the rest of the game: lowering the periapsis (vis-viva burns there and back) for a sharper view, drag on the low passes from an upper atmosphere fitted to MAVEN's published periapsis densities, a deep dip for the limb (MAVEN's campaigns), an orbit change to reach Phobos or Deimos, and camera power (repeat passes for dusty targets). Each picture comes down on a DSN pass at that day's link rate and is home one light time later. The pictures are real NASA images, checked against their catalogue pages; optimised copies ship in `public/targets/` (made by [`scripts/fetch-targets.py`](scripts/fetch-targets.py)).

| Target | NASA picture | Credit | Use |
| --- | --- | --- | --- |
| Olympus Mons | [PIA02982 Color Mosaic of Olympus Mons](https://science.nasa.gov/photojournal/color-mosaic-of-olympus-mons/) (Viking 1 Orbiter, 1978) | NASA/JPL | JPL Image Use Policy: any purpose |
| Valles Marineris | [PIA00422 Valles Marineris](https://pds-rings.seti.org/press_releases/pages/PIA00xxx/PIA00422.html) (Viking mosaic) | NASA/JPL/USGS | JPL Image Use Policy: any purpose |
| North Polar Cap | [PIA00161 MC-1 Mare Boreum Region](https://science.nasa.gov/photojournal/mc-1-mare-boreum-region) (Viking Orbiter 1) | NASA/JPL/USGS | JPL Image Use Policy: any purpose |
| Phobos | [PIA10368 Phobos from 6,800 Kilometers](https://science.nasa.gov/photojournal/phobos-from-6800-kilometers-color/) (MRO HiRISE, 2008) | NASA/JPL-Caltech/University of Arizona | Third-party: educational and personal use |
| Deimos | [PIA11826 Martian Moon Deimos in High Resolution](https://science.nasa.gov/resource/martian-moon-deimos-in-high-resolution/) (MRO HiRISE, 2009) | NASA/JPL/University of Arizona | Third-party: educational and personal use |
| Thin Air at the Limb | [PIA26203 Odyssey's THEMIS Views the Horizon of Mars](https://science.nasa.gov/photojournal/odysseys-themis-views-the-horizon-of-mars) (false colour, 2023) | NASA/JPL-Caltech/ASU | Third-party: educational and personal use |
| The Mars globe | [Mars Viking Colorized Global Mosaic 232 m](https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m) | NASA/USGS Astrogeology | Public domain |

Usage terms follow the [JPL Image Use Policy](https://www.jpl.nasa.gov/jpl-image-use-policy). Olympus Mons is about 2.5 times taller than Everest (21.9 km against 29,032 ft, [PIA26055](https://science.nasa.gov/photojournal/pj-olympus-mons-26/)). The science weights, the camera and the atmosphere fit are labelled game estimates in [`TODO_DATA.md`](TODO_DATA.md). The globe is the game's only 3D element (three.js, loaded on demand; a flat globe takes over without WebGL or when the frame rate drops).

### The Moon: far side, trim burns and four targets

The Moon levels fly the Lunar Reconnaissance Orbiter's mission orbit: 50 km up, circular, over the poles. Flying that low over a body that always shows Earth the same face has three real consequences, all in the engine and on the Moon globe:

- **Behind the Moon.** The near side faces Earth by construction (the IAU rotation angle W = W₀ + Ẇ·d turns the prime meridian, the mean sub-Earth point). For part of every orbit the Moon hides the craft from Earth: up to 48 of every 113 minutes when Earth lies in the orbit plane, none when it is face-on. Orders and pictures wait for the link instead of being refused, and the robot says BEHIND THE MOON and LINK BACK. Light time is 1.28 s from the mean Earth–Moon distance (384,400 km).
- **Station-keeping.** Mascons pull low orbits down. LRO held 50 ± 20 km with one pair of burns every sidereal month, 5.46 + 5.34 = 10.81 m/s, inside a 150 m/s per year allocation ([Beckman & Lamb, NTRS 20080012683](https://ntrs.nasa.gov/citations/20080012683)). A year of pairs is 144.5 m/s, a validation row. A heavy Moon 3 pack without the extra tank runs out of fuel, and Pack says so: "PACK THE EXTRA FUEL TANK — THE 50 KM ORBIT NEEDS TRIM BURNS EVERY MONTH".
- **Eclipses.** The same cylinder test with the Sun: up to 48 minutes on battery each orbit.

The globe shows it: Earth over the near side at a shortened distance (NOT TO SCALE · // EARTH DISTANCE SHORTENED), the signal line solid while linked and broken behind the Moon, the ring dashed where the far side hides the craft, the shadow arc and the trim burns, all from the engine. Moon 1 and Moon 2 show the orbit; Moon 3 adds four targets, scored with the Mars rules. The camera is LROC's Narrow Angle Camera (10 µrad, so 0.5 m per pixel from 50 km). Coordinates are from the [IAU Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/) (the Apollo 11 site from LROC/NSSDC). The pictures are cropped by [`scripts/fetch-targets.py`](scripts/fetch-targets.py) from public-domain LROC frames in the PDS archive, each checked on its catalogue page.

| Target | Picture (LROC NAC frame) | Credit | Use |
| --- | --- | --- | --- |
| The Apollo 11 site (0.674°N 23.473°E) | [M175124932R](https://data.lroc.im-ldi.com/lroc/view_lroc/LRO-L-LROC-3-CDR-V1.0/M175124932RC), Tranquility Base from 24 km | NASA/GSFC/Arizona State University | Public domain (PDS) |
| Tycho (43.30°S 11.22°W) | [M162350671L](https://data.lroc.im-ldi.com/lroc/view_lroc/LRO-L-LROC-3-CDR-V1.0/M162350671LC)/R, the central peak at sunrise | NASA/GSFC/Arizona State University | Public domain (PDS) |
| Shackleton (89.67°S 129.78°E) | [M1346257675L](https://data.lroc.im-ldi.com/lroc/view_lroc/LRO-L-LROC-3-CDR-V1.0/M1346257675LC), oblique across the south pole, squeezed by cos 66.7° to undo the slant | NASA/GSFC/Arizona State University | Public domain (PDS) |
| Tsiolkovskiy (20.38°S 128.97°E, far side) | [M113107391L](https://data.lroc.im-ldi.com/lroc/view_lroc/LRO-L-LROC-3-CDR-V1.0/M113107391LC), the crater floor | NASA/GSFC/Arizona State University | Public domain (PDS) |
| The Moon globe | [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720), LROC colour map 2048 × 1024 (the LROC WAC mosaic) | NASA's Scientific Visualization Studio | NASA media guidelines: educational use with credit |

The science weights and the image sizes are labelled game estimates in [`TODO_DATA.md`](TODO_DATA.md). Earth's direction leaves out the libration terms (several degrees), a labelled simplification.

### Physical constants

Standard gravity, speed of light (SI definitions), the astronomical unit (IAU 2012), and the unit conversion behind the Mars Climate Orbiter case ([NIST SP 811](https://www.nist.gov/pml/special-publication-811)).

> **Note on data quality.** Some NSSDC fact sheets were read from Internet Archive copies (Sept 28 – Oct 3, 2026) because the live site refused connections; each record says so. The **Atlas V payload curves are placeholders**: NASA's LSP site is an interactive tool that can't be exported by script, so the launch-capacity checks are not yet real evidence. The real-history texts on danger cards are marked **"to verify"** until checked against NASA's Lessons Learned system or official failure reports. Everything without a public source (failure chances, part costs, hazard rates, Isp ranges) is a labelled **game estimate**, listed in [`TODO_DATA.md`](TODO_DATA.md).

---

## Validation against real missions

`tests/validation.test.ts` loads real missions as ordinary player designs and checks the engine against independent published values (±10%). The full, auto-generated table is in [`docs/VALIDATION_RESULTS.md`](docs/VALIDATION_RESULTS.md). Highlights:

| Check | Engine | Published | Result |
| --- | --- | --- | --- |
| MAVEN Δv capability (rocket equation) | 2,449 m/s | ≈ 2,450 m/s | ✅ −0.1% |
| MAVEN transfer time (best Lambert arrival) | 300 days | 307 days | ✅ −2.3% |
| MAVEN best launch date lies in the published launch period | Dec 6, 2013 | Nov 18 – Dec 7, 2013 | ✅ |
| MAVEN science-orbit period from published altitudes | 4.5 h | 4.5 h | ✅ |
| MAVEN insertion burn uses more than half the propellant | 60% | > 50% | ✅ |
| Mars solar conjunctions 2015, 2017, 2019 (centre of the command moratorium) | within 0.6 days | JPL moratorium dates | ✅ |
| 2015 conjunction blackout length at 2° | 13.9 days | 14 days | ✅ |
| Mars perihelion Lₛ (2022) | 251.15° | 251.15° (Mars24) | ✅ |
| MAVEN solar power at perihelion / aphelion | 1,712 W / 1,177 W | 1,700 W / 1,150 W | calibration* |

\* The system efficiency η = 0.20 was fitted to these MAVEN figures, so agreement is by construction and is labelled *calibration*, not evidence. The rule for this project: when a validation check fails, the model or data is fixed, never the expected value.

---

## Architecture

```
src/data/*.json  ──►  src/engine (pure TypeScript)  ──►  src/ui (React + Vite)
 Sourced values        physics, missions, operations       displays only, formats units
```

- **Engine** (`src/engine`): no UI imports, fully unit-tested. `evaluateDesign` sizes a design (trajectory, power, batteries, mass, Δv, launch, comms, cost). The Mission Operations engine (`src/engine/ops`) flies it day by day with seeded hazards, light-delayed commands, DSN bookings, eclipses and conjunctions.
- **UI** (`src/ui`): React 19 screens built from the Claude Design "Signal Delay" mockups (`docs/design/signal-delay/`). The Risk meter's 500-run Monte Carlo runs in a Web Worker.
- **Deterministic:** a mission is a function of (design, seed, command log), so any flight can be replayed exactly.

| Area | Technology |
| --- | --- |
| Language | TypeScript 7 (strict, `noUncheckedIndexedAccess`) |
| UI | React 19, Vite 8, plain CSS with design tokens |
| Tests | Vitest 5, Testing Library + jsdom, Playwright screenshots |
| Hosting | GitHub Pages via GitHub Actions (tests must pass before deploy) |

See [`game_engine.md`](game_engine.md) for the engine rules and [`docs/SCIENCE_SPEC.md`](docs/SCIENCE_SPEC.md) for the full specification and decision log.

---

## Getting started

Everything, including Node itself, lives in a Python virtual environment, so nothing is installed globally. Node 22.16.0 is placed inside `.venv` by [nodeenv](https://github.com/ekalinin/nodeenv).

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\nodeenv -p --node=22.16.0   # puts node/npm into .venv\Scripts
.\.venv\Scripts\Activate.ps1                # Git Bash: export PATH="$PWD/.venv/Scripts:$PATH"
npm install
npm run dev                                 # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the game at http://localhost:5173 |
| `npm run build` | Typecheck, then build the static site into `dist/` |
| `npm test` | All tests: physics, validation, data audit, engine API, UI guards, component tests |
| `npx vitest run tests/ui` | Component tests only |
| `npm run test:validation` | Real-mission validation; rewrites `docs/VALIDATION_RESULTS.md` |
| `npm run todo-data` | Data audit; rewrites `TODO_DATA.md` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run shots` | Playwright screenshots at 1440 × 900 and 390 × 844 (browsers live in `.venv/ms-playwright`) |

Every push to `main` runs the tests, builds with the Pages base path and publishes to GitHub Pages.

---

## Project structure

```
src/
  data/            Sourced catalogues: destinations, orbitalElements, launchVehicles, rideshares, parts,
                   missions, hazards, operations, pack, crisisCards, lessons, rescueCases, notebook, targets
  engine/          Simulation engine (pure TypeScript, no UI)
    ephemeris.ts   JPL approximate planet positions; Bennu from the JPL SBDB
    trajectory.ts  Hohmann, Lambert, capture Δv, orbit changes, launch windows
    propulsion.ts  rocket equation, Δv budget
    launch.ts      payload(C3) curves, rideshare, launch reliability
    power.ts       solar and RTG power, eclipses, batteries
    comms.ts       scaled link budget (MRO anchor, DSN gains), light delay
    massCost.ts    mass roll-up, cost against the mission-class cap
    risk.ts / scoring.ts   margins → risk → score and stars
    index.ts       evaluateDesign, simulateMission, monteCarloMission
    ops/           Mission Operations: day-by-day clock, hazards, commands, DSN, extension,
                   Fly & Survive view (fly.ts), Mission Report (report.ts), science targets
                   (observe.ts: OBSERVE orders, pictures, science returned; scienceView.ts: panel,
                   downlink, album)
    science.ts / targets.ts   what a picture costs (vis-viva, MAVEN-fitted drag); the six Mars targets
    pack.ts / daily.ts / notebook.ts / rescue.ts   game modes
  ui/              React screens (Home, Pack, FlyAndSurvive, MissionReport, Daily, Notebook,
                   Rescue, BuildBay), components, words (sdWords.ts), styles
tests/             physics, validation, data audit, engine API, UI guards, ui/ component tests,
                   visual/ Playwright screenshot specs
docs/              SCIENCE_SPEC.md, VALIDATION_RESULTS.md, design/ (mockup copies), images/
```

---

## Known limitations

The models are simplified on purpose, using the standard first-order methods of early mission concept studies. The main limits:

- **Patched conics and a zero-revolution Lambert solver.** Gravity assists are not simulated. Direct transfers are capped below twice the Hohmann time (518 days to Mars, 399 to Bennu). The real OSIRIS-REx route is offered as a fixed, labelled option.
- **Approximate ephemeris.** JPL's approximate elements (valid 1800–2050), the Earth–Moon barycentre for Earth, and two-body propagation for Bennu.
- **Communications.** Close-range data rates are optimistic, because coding and decoder caps aren't modelled. The 34 m station behind MRO's anchor figure is inferred.
- **Operations.** Science orbits are fixed in inertial space (no J2 precession), shadows are cylindrical, hazards are independent Poisson processes, and the Moon has no conjunctions.
- **Placeholder launch curves** for the Atlas V, as noted above.
- **The live Daily** uses that day's DONKI snapshot. DONKI sometimes adds or revises records later, and a snapshot deployed mid-day can differ from the morning's. Each browser keeps the first snapshot it reads for the whole day. Players without the file fly the offline Daily, which has different storms. The storm cards are real events replayed on a game timeline; the model does not predict how a CME propagates.
- **Science targets.** The camera's resolution, the science weights and the drag-heating rate are game estimates. Orbit changes are coplanar (no plane change to reach the moons), the upper atmosphere is a single exponential fitted to two MAVEN densities, and the Cadet Mars campaign is shortened to 100 days so a run lasts about five minutes.
- **The Moon.** No lunar ephemeris: the Earth–Moon distance is the mean 384,400 km, and Earth's direction leaves out libration. Loss of signal is the cylinder test, and the downlink and image passes are scaled by each day's visible fraction rather than lined up with single orbits. Trim burns are LRO's published pair, not a mascon gravity model, and Earth's shadow (a lunar eclipse) is not modelled.
- **Scoring** uses `Σ wᵢsᵢ` on a 0–100 scale (the spec's `100 Σ wᵢsᵢ` was read this way); since v0.8 the headline and the stars use the science returned.

The full list is in the *Assumptions* section of [`docs/SCIENCE_SPEC.md`](docs/SCIENCE_SPEC.md) and in [`game_engine.md`](game_engine.md).

---

## Contributing

The most valuable contributions are **better sources**:

- Export the NASA LSP payload-vs-C3 points for the Atlas V 401 and 411 into `src/data/launchVehicles.json`.
- Replace a game estimate in [`TODO_DATA.md`](TODO_DATA.md) with a published NASA value (and set `isGameEstimate: false`).
- Check a danger card's real-history text against NASA's [Lessons Learned Information System](https://llis.nasa.gov/) or the official failure report.

Code rules: write the physics test first (with the hand calculation in a comment), wrap every new value in `Sourced<T>`, keep numbers out of the UI, and run `npm test` before opening a pull request.

---

## Acknowledgements and disclaimer

This game is built on public data from NASA, JPL, the NSSDC, the Deep Space Network, NOAA and the published literature cited above. Thanks to the scientists and engineers whose fact sheets, mission papers and failure reports make a game like this possible.

**Signal Delay is an independent educational project. It is not affiliated with, sponsored by or endorsed by NASA, JPL or NOAA.** It does not use the NASA insignia or logotype. Mission names are used only to identify the real missions whose published data the game cites. The game's results are simplified models for learning, not mission analysis.

## License

The code is released under the [MIT License](LICENSE). Teachers and students may use, copy and adapt it freely. The NASA pictures in `public/postcards/` are public domain (see `src/data/postcards.json`), and NASA's own data keep their original terms.
