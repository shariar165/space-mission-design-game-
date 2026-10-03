# Mission Drafting Table — Science Spec v0.1

Oct 3, 2026 · @Shariar

## Purpose and model philosophy

Every number the game shows must come from a published NASA source or a named physics equation. Nothing is hand-typed into the UI. The engine computes it, and the UI only displays it.

The models are simplified on purpose, so a 10-year-old can play. But each simplification is the standard first-order method that mission designers use in early concept studies. Each one is also listed on the Sources & Assumptions page.

Three rules for the engine:

1. **One model for everyone.** The player's craft and the real missions (MAVEN, LRO, OSIRIS-REx) run through the exact same equations. If the engine cannot roughly reproduce a real mission, the model is wrong, not the mission.
2. **Sourced inputs.** Every constant and catalogue value carries a `source` field. The UI shows it in the ⓘ popover.
3. **Engineer mode shows the working.** Every meter can expand to show its equation and the inputs that fed it.

## Constants and units

The engine works in SI internally (m, s, kg, W) and converts to km, km/s and days only for display.

| Constant | Symbol | Value | Unit | Source |
| --- | --- | --- | --- | --- |
| Standard gravity | g₀ | 9.80665 | m/s² | SI definition (exact) |
| Astronomical unit | AU | 149,597,870.7 | km | IAU 2012 definition (exact) |
| Speed of light | c | 299,792.458 | km/s | SI definition (exact) |
| Solar irradiance at Earth (1 AU) | S₀ | 1361.0 | W/m² | [NASA Mars/Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Sun gravitational parameter | μ☉ | 1.32712 × 10¹¹ | km³/s² | Approximate; confirm on the NASA Sun Fact Sheet |
| Earth gravitational parameter | μ⊕ | 398,600 | km³/s² | [NASA Mars/Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Earth equatorial radius | R⊕ | 6378.1 | km | [NASA Mars/Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |

Display rules: speeds in m/s below 10 km/s and km/s above, mass in kg, power in W, distance in million km, light delay in minutes, cost in $M with the year stated.

## Destinations

Five destinations give a clear difficulty ladder: Moon (easy), Venus and Mars (medium), Bennu (rendezvous, hard), Jupiter (very hard, solar power nearly fails). Orbit and size values come from the [NASA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/index.html); Mars values were checked on the [Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html).

| Destination | Distance from Sun (10⁶ km) | Orbit period (days) | Synodic period (days) | GM (km³/s²) | Equatorial radius (km) | Sunlight vs Earth | Mission type |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Moon | 149.6 (0.384 from Earth) | 27.3 around Earth | — | 4,902.8 (approx.) | 1738.1 (approx.) | 100% | Orbiter |
| Venus | 108.2 | 224.7 | 583.9 (computed) | 324,859 (approx.) | 6051.8 (approx.) | \~191% | Orbiter |
| Mars | 227.956 | 686.980 | 779.94 | 42,828 | 3396.2 | 43.1% | Orbiter |
| Bennu (asteroid) | \~168 (approx.) | \~437 (approx.) | — | negligible | \~0.25 (approx.) | \~79% | Rendezvous + sample |
| Jupiter | 778.5 | 4331 | 398.9 (computed) | 126,686,534 (approx.) | 71,492 (approx.) | \~3.7% | Orbiter |

Values marked approx. still need to be copied from each body's own NASA fact sheet (Venus, Moon, Jupiter) and from the JPL Small-Body Database (Bennu) before release. Synodic period S = 1 / |1/T\_Earth − 1/T\_planet| is the time between launch windows, so Mars windows repeat every \~26 months.

Mars distance from Earth ranges from 54.6 to 401.4 million km ([Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)). The game must compute this from planet positions on each mission day, never show a fixed number.

## Trajectory model

The engine uses patched conics: the Sun's gravity alone between planets, the planet's gravity alone near it. This is the standard first-order method for concept studies, and it gives the launch energy (C3), the arrival speed (v∞) and the capture burn the spacecraft must pay for.

**Planet positions.** Use the Keplerian elements and rates from JPL's [Approximate Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html), the table valid for 1800–2050 AD. No API call is needed, so it runs offline in the browser. Planet distance from Earth, light delay and the flight map all come from this.

**Transfer (Cadet mode explanation).** A Hohmann transfer between circular orbits r₁ (Earth) and r₂ (target):

```latex
a_t = \frac{r_1 + r_2}{2}, \qquad t_{flight} = \pi \sqrt{\frac{a_t^3}{\mu_\odot}}
```

```latex
v_{\infty,dep} = \left| \sqrt{\mu_\odot\left(\frac{2}{r_1} - \frac{1}{a_t}\right)} - \sqrt{\frac{\mu_\odot}{r_1}} \right|, \qquad C_3 = v_{\infty,dep}^2
```

```latex
v_{\infty,arr} = \left| \sqrt{\frac{\mu_\odot}{r_2}} - \sqrt{\mu_\odot\left(\frac{2}{r_2} - \frac{1}{a_t}\right)} \right|
```

For Mars this gives about 259 days, C3 ≈ 8.7 km²/s² and arrival v∞ ≈ 2.6 km/s. These are textbook minimum-energy values; real launch years cost more because the orbits are elliptical and inclined.

**Launch windows (Engineer mode and the Window screen).** Solve Lambert's problem between Earth's position on the launch date and the target's position on the arrival date. A grid of launch × arrival dates gives the porkchop plot. The Hohmann phase rule is the Cadet explanation: the target must lead Earth by

```latex
\theta = 180^\circ - n_{target} \cdot t_{flight}
```

For Mars that is about 44°, and it recurs once per synodic period (\~780 days).

**Capture burn.** The launch vehicle pays for C3. The spacecraft pays for capture. Entering an orbit with periapsis rₚ and apoapsis rₐ around a body with parameter μ:

```latex
\Delta v_{cap} = \sqrt{v_{\infty,arr}^2 + \frac{2\mu}{r_p}} - \sqrt{\mu\left(\frac{2}{r_p} - \frac{2}{r_p + r_a}\right)}
```

An elliptical capture orbit costs much less than a low circular one. This is a real design trade the player should discover.

**Special cases**

- **Moon:** Earth-centred, not Sun-centred. The launch vehicle does trans-lunar injection; the spacecraft does lunar orbit insertion with the same capture equation (μ of the Moon).
- **Bennu:** gravity is negligible, so rendezvous Δv ≈ arrival v∞. The real OSIRIS-REx used an Earth flyby; the game must say it does not model flybys.
- **Jupiter:** a direct Hohmann transfer needs C3 ≈ 77 km²/s², which almost no launch vehicle can give a useful payload. Real missions use gravity assists. The game should show this as the reason Jupiter is "very hard", not hide it.

Open question: the Lambert solver is the biggest coding task in the engine. If time runs short, ship Hohmann + phase angle first and add Lambert after the core loop works.

## Propulsion

The spacecraft's Δv capability comes from one equation, applied to every craft including the real ones. This fixes the mockup bug where the player and MAVEN were scored on different numbers.

```latex
\Delta v = I_{sp} \, g_0 \, \ln\left(\frac{m_{wet}}{m_{dry}}\right), \qquad m_{prop} = m_{dry}\left(e^{\Delta v / (I_{sp} g_0)} - 1\right)
```

The second form answers the Debrief hint "carry X kg more propellant" exactly.

| Engine type | Isp (s) | Thrust class | Game rule |
| --- | --- | --- | --- |
| Hydrazine monopropellant | \~220–230 | Low–medium | Simple, reliable, default choice |
| Bipropellant (MMH/NTO) | \~310–320 | Medium–high | Less propellant, higher cost and more failure points |
| Solar-electric ion (xenon) | \~3000 | Very low | Cruise and rendezvous only; cannot do a fast capture burn; needs high power |

Isp values are typical textbook ranges, not from a single sourced datasheet yet. Before release, replace each with a named flight engine and its published Isp.

**Propellant tanks.** Tank and feed-system dry mass = 12% of propellant mass (game approximation, shown in the Assumptions page).

**Δv budget.** Required Δv = capture burn + trajectory corrections (fixed 50 m/s for planets) + orbit maintenance over the mission. Margin = (capability − required) / required. Below 10% margin, the craft gets a warning; below 0%, it cannot launch.

**Check with MAVEN.** NASA lists MAVEN at 809 kg dry and 2,454 kg wet, fuelled with hydrazine ([NASA Science: MAVEN](https://science.nasa.gov/mission/maven/)). That is 1,645 kg of propellant. At Isp 220–230 s, the equation gives roughly 2.4–2.5 km/s of Δv. The engine must show this number for MAVEN, not a hand-typed one.

## Launch vehicles

A launch vehicle is a curve, not a single number: the higher the launch energy (C3) the mission needs, the less mass the rocket can send. The game reads payload capacity off that curve at the mission's C3.

**Data source.** NASA's [Launch Services Program performance site](https://elvperf.ksc.nasa.gov/) publishes payload-vs-C3 curves for the vehicles on NASA's launch contract. NASA notes that its contract performance can differ from what providers advertise, so the game should say "NASA LSP performance" in the ⓘ popover. The site is an interactive query tool, so the data person must export 6–8 points per vehicle (C3 from −2 to 40 km²/s²) into `launchVehicles.json`.

**Model.** Piecewise-linear interpolation between the exported points:

```latex
m_{max}(C_3) = m_i + (m_{i+1} - m_i)\frac{C_3 - C_{3,i}}{C_{3,i+1} - C_{3,i}}
```

Mass margin = (m\_max − m\_wet) / m\_max. Over capacity blocks launch with a message such as "Too heavy by 120 kg for this rocket at C3 = 12".

**Reliability.** Launch success probability uses the vehicle's flight record with a Laplace estimate, so a rocket with few flights is not shown as 100% safe:

```latex
p_{success} = \frac{successes + 1}{flights + 2}
```

**Validation anchor.** MAVEN (2,454 kg wet) launched on an Atlas V 401 to Mars in November 2013 ([NASA Science: MAVEN](https://science.nasa.gov/mission/maven/)). The Atlas V 401 curve at the 2013 Mars C3 must be at or above 2,454 kg, or the curve data is wrong.

Still to collect: launch price per vehicle, from NASA Announcement of Opportunity documents rather than news articles.

## Power

Solar power falls with the square of distance from the Sun. With one calibrated efficiency number, this single equation reproduces MAVEN's published power range to within 2%.

```latex
P_{solar} = S_0 \left(\frac{1\,\text{AU}}{r}\right)^2 A \, \eta_{sys} \, \cos\theta \, (1 - d)^{t}
```

S₀ = 1361 W/m², r = distance from the Sun on that mission day (from the ephemeris), A = array area, η\_sys = end-to-end system efficiency, θ = Sun angle (0 when pointed), d = yearly degradation, t = years since launch.

**Calibration from MAVEN.** NASA lists MAVEN's 12 m² of arrays as producing 1,150 to 1,700 W depending on position in Mars orbit ([NASA Science: MAVEN](https://science.nasa.gov/mission/maven/)). Mars ranges from 206.65 to 249.26 million km from the Sun ([Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)), so sunlight ranges from about 713 to 490 W/m². Both ends give η\_sys ≈ 0.20 (0.199 at perihelion, 0.196 at aphelion). Use η\_sys = 0.20 for the default solar array.

**RTG option.** NASA's [MMRTG fact sheet](https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf) gives about 110 W at launch and about 45 kg. Power does not depend on the Sun, so it is the only real option for Jupiter and beyond. In-game it is expensive, scarce, and adds a launch-approval step.

**Power budget.** Required power = bus + instruments + comms transmit + heaters. Heater power rises as sunlight falls (game approximation). Margin = (available − required) / required, shown on the Power meter.

**Batteries.** Must cover the longest eclipse in the science orbit. Battery mass = energy needed / specific energy (game value for Li-ion, to be sourced). Eclipse length comes from the orbit geometry.

## Communications

Data rate falls with the square of distance, so the same craft sends much less data from Mars at its farthest than at its closest. The game uses a scaled link budget: the physics of the full link equation, anchored to one real, published spacecraft link.

```latex
R = R_{ref} \cdot \frac{P_t}{P_{t,ref}} \cdot \left(\frac{D_{sc}}{D_{sc,ref}}\right)^2 \cdot \left(\frac{D_{gs}}{D_{gs,ref}}\right)^2 \cdot \left(\frac{d_{ref}}{d}\right)^2
```

Pₜ = transmitter power, D\_sc = spacecraft dish diameter, D\_gs = ground dish diameter (Deep Space Network 34 m or 70 m), d = Earth–craft distance that day. Antenna gain scales with diameter squared, which is why each dish appears squared. Frequency band and coding are held equal to the reference link.

**Reference link.** Pick one mission whose data rate, distance, transmitter power and both antenna sizes are all published, ideally from JPL's DESCANSO telecom summaries. Ground station parameters come from the [DSN Telecommunications Link Design Handbook (810-005)](https://deepspace.jpl.nasa.gov/dsndocs/810-005/), which NASA tells proposers to use when designing spacecraft radios ([DSN mission documents](https://deepspace.jpl.nasa.gov/about/commitments-office/mission-documents/)). Until that anchor is filled in, the Comms meter must show "uncalibrated" in Engineer mode.

**Data per day.** Volume = R × DSN pass length. Default one 8-hour pass per day; a 70 m pass costs more but gives about (70/34)² ≈ 4.2× the rate.

**Light delay.** t = d / c. For Mars this ranges from about 3.0 to 22.3 minutes (54.6 to 401.4 million km, [Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)). This is shown on the Flight screen and is why crisis decisions cannot be made in real time.

**Science return link.** Science data produced per day is capped by data downlinked per day. The Debrief must say when the radio, not the instruments, limited the science.

## Mass and cost

The budget cap must come from a real NASA mission class, never from one mission's actual cost. This fixes the mockup problem where the cap equalled MAVEN's cost and looked rigged.

**Mass model.**

```latex
m_{dry} = (1 + k_{margin}) \left( m_{bus} + \sum m_{instruments} + m_{power} + m_{comms} + m_{tanks} \right)
```

```latex
m_{wet} = m_{dry} + m_{prop}
```

k\_margin = 0.30 at concept stage (game rule, shown in Assumptions). Players learn that early designs carry mass reserves for growth.

**Cost caps by mission class.** NASA caps competed planetary missions on development cost (Phases A–D), with launch and operations counted separately. The game uses the same convention.

| Mission class | Cap | What it excludes | Source |
| --- | --- | --- | --- |
| Discovery | $500M (FY2019) | Launch vehicle, operations (Phases E–F), contributions | [NASA Discovery 2019 AO overview](https://discovery.larc.nasa.gov/PDF_FILES/03a_Brown_Overview.pdf) |
| New Frontiers | \~$850M | Launch and operations | [SpaceNews on New Frontiers 4 AO](https://spacenews.com/?p=64699) (replace with the NASA AO itself) |

Cadet mode shows one total budget bar. Engineer mode splits it into development (vs cap), launch and operations.

**Part costs.** Each catalogue part carries a cost. Until sourced, they are game values tagged "estimate" in the ⓘ popover. Candidate sources to check: NASA's Cost Estimating Handbook and NASA instrument cost models.

**MAVEN cost.** Published figures differ by what they include (for example, build + launch + prime operations). The Debrief should compare MAVEN on mass, power and Δv only, unless a NASA figure on the same accounting basis is found. Note that MAVEN was a Mars Scout mission, not Discovery.

## Risk model and crisis cards

Risk is computed, not rolled blindly: each phase has a failure probability that the player's own margins push up or down. Crisis cards are based on real NASA missions, which is the game's main novelty.

**Phase risk.**

```latex
p_{fail,phase} = p_{base,phase} \cdot \prod_i f_i(\text{margin}_i)
```

fᵢ = 1 at the recommended margin, rising as a margin shrinks (for example, Δv margin below 10% raises capture-burn risk). Launch uses the vehicle's p\_success from the Launch vehicles section. Other base rates are game values and are labelled as such.

**Monte Carlo in Engineer mode.** Run the mission 1,000 times with the same design and show the success rate. This teaches that a good design lowers risk but never removes it.

**Crisis cards (first set).** One card per flight, drawn from those that fit the mission phase.

| Card | Phase | Real event | Player decision | Margin that matters |
| --- | --- | --- | --- | --- |
| Unit mismatch | Cruise | Mars Climate Orbiter, 1999: one team used imperial units, the other metric; the craft flew too low and was lost | Spend propellant on an extra navigation check, or trust the plan | Δv |
| Upside-down sensor | Return/landing | Genesis, 2004: deceleration sensors were installed backwards; the parachute never opened | Pay for an extra test before launch, or skip it | Budget |
| False touchdown | Landing | Mars Polar Lander, 1999: likely shut its engine early after reading leg vibration as touchdown | Not used for orbiters; for future lander missions | — |
| Memory full | Science ops | Spirit rover, 2004: too many files filled flash memory and caused reboots; fixed from Earth | Pause science to fix, or keep going at risk | Data |
| Lost attitude | Cruise | SOHO, 1998: lost attitude control and contact; recovered months later | Spend propellant and power to recover now, or wait | Power, Δv |
| Solar storm | Any | Solar particle events can trigger spacecraft safe mode | Raise orbit (costs propellant) or ride it out (risk to instruments) | Power, Δv |

These are summaries from general knowledge. Before release, each card's text must be checked against NASA's [Lessons Learned Information System](https://llis.nasa.gov/) or the mission's official failure report, and the link goes on the card's "Real history" box.

**Timeline rule.** A card's day number must fall inside its phase. A Mars transfer takes about 8–10 months, so a day-214 event is a cruise event, not an orbit event.

## Validation set

The engine passes validation when it reproduces each real mission's key numbers within ±10% using the same equations as the player. The results table goes on the Sources & Assumptions page; it is the strongest evidence for the Validity score.

| Mission | Launch vehicle | Wet mass (kg) | Dry mass (kg) | Other published values | Engine must reproduce | Source |
| --- | --- | --- | --- | --- | --- | --- |
| [MAVEN](https://science.nasa.gov/mission/maven/) (Mars, 2013) | Atlas V 401 | 2,454 | 809 | 12 m² arrays, 1,150–1,700 W at Mars; 2 m high-gain antenna; 65 kg science payload; Mars orbit insertion Sept 21, 2014 | Power range (η\_sys ≈ 0.20); Δv capability from the rocket equation; transfer time \~10 months | NASA Science |
| [OSIRIS-REx](https://arxiv.org/pdf/1702.06981) (Bennu, 2016) | Atlas V 411 | 2,105 | \~860–880 (sources differ) | Launch C3 = 29.3 km²/s²; Earth flyby Sept 2017 | Atlas V 411 curve ≥ 2,105 kg at C3 29.3; game must flag that the real mission used a flyby | Mission description paper (arXiv 1702.06981) |
| LRO (Moon, 2009) | Atlas V 401 | to verify | to verify | to verify | Lunar orbit insertion Δv; power; data rate | NASA LRO mission page (to open) |

MAVEN's mission ended after contact was lost on Dec. 6, 2025; NASA declared the end of mission on June 3, 2026 ([NASA Science: MAVEN](https://science.nasa.gov/mission/maven/)). The game should label it "MAVEN (2013–2025)", which also gives it a strong "real history" story.

**How to run it.** A unit test file `validation.test.ts` loads each mission as a player design, runs the full engine, and asserts the tolerance. If a test fails, fix the model or the data, never the expected value.

## Scoring

The total is a weighted sum shown openly in Engineer mode, so the Debrief number always adds up. Science comes first, because that is why missions fly.

```latex
Score = 100 \sum_i w_i \, s_i, \qquad s_i \in [0, 100], \quad \sum_i w_i = 1
```

| Category | Weight | How sᵢ is computed |
| --- | --- | --- |
| Science return | 0.30 | Data downlinked ÷ data the science goal needs (capped at 100) |
| Mission success | 0.20 | 100 if all phases complete; partial credit per phase reached |
| Budget discipline | 0.15 | 100 at or under cap; falls steeply above it |
| Propellant (Δv) margin | 0.10 | Margin band score (below) |
| Power margin | 0.10 | Margin band score |
| Mass margin | 0.10 | Margin band score |
| Crisis handling | 0.05 | Outcome of the crisis decision vs the risk taken |

**Margin band score.** Margins are scored on a band, not "more is better". Too little margin is risky; too much means the player carried mass or power they did not need. 100 inside 10–30% margin, falling linearly to 0 at 0% margin and at 80% margin. This mirrors real design practice and is the trade-off judges will look for.

**Stars.**

1. Reached the destination and started science.
2. Science return ≥ 70%.
3. Every margin inside its band at the end of the mission.

The Debrief's "For the next star" hint is computed by the engine (for example, extra propellant from the rocket equation, checked against unused launch capacity).

## Assumptions (for the Sources & Assumptions page)

These are stated openly in the game. Each one is a standard simplification for early concept design.

1. Patched conics: only one body's gravity acts at a time.
2. Planet positions from JPL's approximate Keplerian elements (valid 1800–2050), not a full ephemeris.
3. Launch windows from a Lambert solver (or Hohmann + phase angle in the first version); no gravity assists, no deep-space manoeuvres.
4. Launch vehicle performance interpolated from NASA LSP points; mission-specific analysis would change it.
5. Impulsive burns: engines change speed instantly. Ion engines are limited to cruise and rendezvous to stay honest about this.
6. Solar power from the inverse-square law with one calibrated efficiency (η\_sys = 0.20 from MAVEN).
7. Data rate from a scaled link budget anchored to one real mission; band and coding held fixed.
8. Mass growth margin 30%, tank mass 12% of propellant, and 50 m/s for trajectory corrections: game rules, not NASA requirements.
9. Part costs are estimates until sourced; caps follow NASA Discovery / New Frontiers conventions.
10. Base failure rates for non-launch phases are game values; launch reliability uses each vehicle's flight record.
11. Thermal, radiation dose and atmospheric drag are not modelled, except through crisis cards.

Any game value must be labelled "game estimate" in its ⓘ popover, never presented as NASA data.

## Engine structure for Claude Code

The engine is pure TypeScript with no UI imports, so it can be unit-tested and validated before any screen exists. The UI calls one function, `evaluateDesign`, and renders what comes back.

```
src/engine/
  constants.ts        // Section: Constants (each with source)
  ephemeris.ts        // JPL approximate positions → planet x,y on a date
  trajectory.ts       // Hohmann, Lambert, C3, v∞, capture Δv
  propulsion.ts       // rocket equation, propellant needed
  launch.ts           // payload(C3) interpolation, reliability
  power.ts            // solar 1/r², RTG, batteries
  comms.ts            // scaled link budget, light delay
  massCost.ts         // mass roll-up, cost vs cap
  risk.ts             // phase risk, Monte Carlo
  crisis.ts           // crisis cards + effects
  scoring.ts          // weights, margin bands, stars, next-star hint
  index.ts            // evaluateDesign(), simulateMission()
src/data/
  destinations.json   launchVehicles.json   parts.json
  missions.json       // MAVEN, OSIRIS-REx, LRO presets
  crisisCards.json
tests/
  physics.test.ts     // each equation vs hand calculation
  validation.test.ts  // real missions within ±10%
```

```ts
interface Sourced<T> { value: T; unit: string; source: string; url?: string; isGameEstimate: boolean }

interface Design {
  destination: 'moon' | 'venus' | 'mars' | 'bennu' | 'jupiter';
  launchVehicleId: string; launchDate: string; arrivalDate: string;
  busId: string; instrumentIds: string[];
  power: { type: 'solar' | 'rtg'; arrayArea_m2?: number; rtgCount?: number };
  comms: { dishDiameter_m: number; txPower_W: number; groundDish_m: 34 | 70 };
  engineId: string; propellant_kg: number;
  captureOrbit: { periapsis_km: number; apoapsis_km: number };
}

interface Meter { used: number; limit: number; margin: number; status: 'ok' | 'warning' | 'over';
  equation: string; inputs: Record<string, Sourced<number>> }

interface Evaluation {
  meters: { mass: Meter; power: Meter; deltaV: Meter; data: Meter; cost: Meter; risk: Meter };
  blockers: string[];          // plain language, e.g. "Too heavy by 120 kg"
  trajectory: { c3: number; vInfArr: number; flightDays: number; path: [number, number][] };
}
```

Build order: constants → ephemeris → trajectory → propulsion → launch → power → comms → massCost → validation tests → risk, crisis, scoring. Don't build UI on a module until its tests pass.
