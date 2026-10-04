# Mission Drafting Table — Science Spec v0.3

Oct 3, 2026 · @Shariar

v0.2 (Oct 3, 2026) added the decisions taken while building the engine. v0.3 (Oct 3, 2026) adds the UI rules. All decisions are applied in the sections below and listed in the **Decision log** at the end.

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
- **Bennu:** gravity is negligible, so rendezvous Δv ≈ arrival v∞. The real OSIRIS-REx used an Earth flyby; the game must say it does not model flybys. The player can also pick a fixed, clearly labelled **"NASA real route (Earth flyby)"** option. It uses the published launch C3 = 29.29678 km²/s² ([Lauretta et al. 2017, arXiv 1702.06981](https://arxiv.org/pdf/1702.06981)) and the published launch date. The flyby is not simulated: only the post-flyby leg (flyby → start of approach, Aug 13, 2018) is computed by Lambert, to get the arrival v∞. The deep-space manoeuvre (Dec 28, 2016) is charged to the spacecraft as Δv; its size is a game estimate.
- **Jupiter:** a direct Hohmann transfer needs C3 ≈ 77 km²/s², which almost no launch vehicle can give a useful payload. Real missions use gravity assists. The game should show this as the reason Jupiter is "very hard", not hide it.

**Transfer cap (decided).** The Lambert solver is zero-revolution only; there are no multi-revolution solutions. A direct player transfer must take less than one revolution of the minimum-energy transfer orbit:

```latex
t_{flight} < 2\,t_{Hohmann}
```

That is about 518 days to Mars and 399 days to Bennu. Longer flights are blocked with a plain-language message. Reason: a zero-revolution Lambert solution for a longer flight is still mathematically valid but physically absurd. For OSIRIS-REx's real 816-day dates it dives to 0.03 AU and needs C3 ≈ 1,755 km²/s².

**Best arrival date.** For a given launch date, the engine scans arrival dates within the cap and picks the lowest departure v∞ + arrival v∞. For MAVEN's launch on Nov 18, 2013 this gives 300 days, against 307 days flown.

**Best launch window (decided).** `bestLaunchWindow(dest, fromDate)` scans launch dates over one synodic period after `fromDate`. It uses a 10-day grid, then a 1-day refinement within ±10 days of the best grid point. For each launch date it takes the best arrival (above). It returns the single launch date with the lowest **departure v∞ + arrival v∞**: launch energy plus the arrival burn, with equal weight. This is a standard porkchop figure of merit. The game uses it to set starter dates.

It is **not** how real missions pick their launch day. A real mission plans a *launch period*: every day on which its vehicle can deliver the C3 needed to reach a fixed arrival date. It then launches on the first day, so a slip still fits.
- **MAVEN's case:** the published launch period was Nov 18 – Dec 7, 2013, with orbit insertion planned for Sept 22, 2014 ([NASA: The 2013 MAVEN Mission To Mars](https://mars.nasa.gov/files/resources/MAVENPresentation2013.pdf)). MAVEN launched on the opening day.
- **The model's optimum:** from June 2013 the search returns **Dec 6, 2013** (C3 ≈ 9.4 km²/s²), inside the published period, near its close. The opening day to the planned arrival needs C3 ≈ 12.2 km²/s² in the model.

So Nov 18 is where the period opens, not where the energy is lowest. The validation table checks that the optimum lies inside the published period. Launch periods, launch-vehicle C3 limits, the declination of the launch asymptote and arrival-date constraints are not modelled. A future Window screen can show a launch period as the days on which the chosen vehicle meets the needed C3 for the player's wet mass.

**Orbits are altitudes.** Capture and science orbits are given as periapsis and apoapsis **altitudes** above the equatorial radius. When only a period is published, the apoapsis is derived by Kepler's third law: a = (μT²/4π²)^{1/3}.

**Science-orbit transfer.** If the science orbit differs from the capture orbit, the spacecraft pays a two-burn transfer with each burn at an apsis (vis-viva, cheaper of the two burn orders):

```latex
v = \sqrt{\mu\left(\frac{2}{r} - \frac{2}{r_p + r_a}\right)}
```

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

**Δv budget.** Required Δv = capture burn + capture→science orbit transfer + trajectory corrections (fixed 50 m/s) + orbit maintenance over the planned science phase + lifetime reserve + any fixed-route manoeuvre.

- Orbit maintenance is 20 m/s per year (game estimate).
- Lifetime reserve = maintenance rate × (planned lifetime − planned science days). It is zero when no extended mission is planned at launch.
- Real-mission presets use the **planned** prime mission, not the as-flown lifetime.

Margin = (capability − required) / required. Below 10% margin, the craft gets a warning; below 0%, it cannot launch.

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

**Batteries.** Must cover the longest eclipse in the science orbit (worst case: cylindrical shadow centred on apoapsis). Battery mass = energy needed / specific energy (game value for Li-ion, to be sourced). Eclipse length comes from the orbit geometry.

## Communications

Data rate falls with the square of distance, so the same craft sends much less data from Mars at its farthest than at its closest. The game uses a scaled link budget: the physics of the full link equation, anchored to one real, published spacecraft link.

```latex
R = R_{ref} \cdot \frac{P_t}{P_{t,ref}} \cdot \left(\frac{D_{sc}}{D_{sc,ref}}\right)^2 \cdot \left(\frac{D_{gs}}{D_{gs,ref}}\right)^2 \cdot \left(\frac{d_{ref}}{d}\right)^2
```

Pₜ = transmitter power, D\_sc = spacecraft dish diameter, D\_gs = ground dish diameter (Deep Space Network 34 m or 70 m), d = Earth–craft distance that day. Antenna gain scales with diameter squared, which is why each dish appears squared. Frequency band and coding are held equal to the reference link.

**Reference link.** Pick one mission whose data rate, distance, transmitter power and both antenna sizes are all published, ideally from JPL's DESCANSO telecom summaries. Ground station parameters come from the [DSN Telecommunications Link Design Handbook (810-005)](https://deepspace.jpl.nasa.gov/dsndocs/810-005/), which NASA tells proposers to use when designing spacecraft radios ([DSN mission documents](https://deepspace.jpl.nasa.gov/about/commitments-office/mission-documents/)). Until that anchor is filled in, the Comms meter must show "uncalibrated" in Engineer mode.

**Reference link (decided): MRO.** [DESCANSO Article 12, Mars Reconnaissance Orbiter Telecommunications](https://descanso.jpl.nasa.gov/DPSummary/MRO_092106.pdf) (JPL, 2006) gives MRO's X-band design point: "at a maximum distance from Earth (400 million km) … at least 500 kbps", with a 100 W X-band TWTA and a 3 m high-gain antenna.
- The article does not name the ground station for that figure. **34 m is inferred**: MRO schedules two 34-m stations daily, and a 34-m link budget built from the 810-005 gains is consistent with 500 kbps. That one anchor value stays a labelled game estimate, and the Data meter's limit badge points to it.
- The ground term is the ratio of the 810-005 X-band receive gains, not (D_gs/D_gs,ref)²: 74.55 dBi for the 70 m (DSS-14, module 101 Rev. I, Table 2) against 68.24 dBi for the 34 m BWG (DSS-24, module 104 Rev. Q, Table 6). That is 6.31 dB, or 4.28×, close to the (70/34)² = 4.24 the diameter rule gives.
- **Known limit:** inverse-square scaling of the 400-million-km anchor predicts 8 Mbps at 100 million km on a 34 m. MRO's article cites 3–4 Mbps there ("as high as 6 Mbps"), because its coding and ground decoders cap the rate (turbo decoding ≤ 1.6 Mbps). The game does not model those caps, so close-range rates are optimistic. The validation table shows this as an info row.

**Data per day.** Volume = R × DSN pass length. Default one 8-hour pass per day; a 70 m pass costs more but gives about (70/34)² ≈ 4.2× the rate.

**Light delay.** t = d / c. For Mars this ranges from about 3.0 to 22.3 minutes (54.6 to 401.4 million km, [Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)). This is shown on the Flight screen and is why crisis decisions cannot be made in real time.

**Science return link.** Science data produced per day is capped by data downlinked per day. The Debrief must say when the radio, not the instruments, limited the science.

**Downlink caps science (decided).** The science **goal** is Σ instrument data/day × planned science days. It does not depend on the radio. The data actually **sent home** does: on each science day the engine adds min(data produced, downlink capacity that day), with the capacity taken from the scaled link budget at that day's Earth distance. The Science return score (downlinked ÷ goal) and the "radio-limited" note therefore rest on the comms reference link. That link is now MRO's published design point, but its ground station is inferred, so the Debrief still marks the downlink figures and the Science return row "rests on an estimate", and the Data meter's limit carries the same badge. The badges go when a published link that names its station replaces the anchor.

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

**Decided values (game estimates, labelled):**
- **Margin factor:** f(m) = 1 for m ≥ 10%, rising linearly to 3 at 0%. Below 0% the phase fails for certain.
- **Which margins feed which phase:** cruise ← power; arrival (capture or rendezvous) ← Δv; science ← power; sample return ← Δv.
- **Base rates:** cruise 2%, arrival 4%, science 2% per year, sample return 3%.
- **Risk meter:** shows 1 − Π(1 − p_phase) against an acceptable mission risk of 20%.
  - The 20% limit is a **game estimate**. No NASA source giving a single numeric acceptable-loss probability for robotic science missions was found; NASA's payload risk classes are qualitative.
  - The meter shows a "game estimate" badge next to its limit, and ⓘ opens the record.

**Why there is no Reliability meter (decided).** The Build Bay mockup showed "Reliability ≥ 85%" as R = Π Rᵢ over 14 subsystems. The game uses the Risk meter in that slot instead, for three reasons:
1. **No sourced data.** A series-reliability product needs a sourced reliability Rᵢ for every part. The catalogue has none, so the 85% target and every Rᵢ would be invented numbers.
2. **One model.** The Risk meter is the same phase-risk model that `simulateMission` and the Monte Carlo fly. A separate reliability number would disagree with what then happens in flight.
3. **It teaches the trade.** Risk responds to the player's margins (f(margin) above), so cutting Δv or power margin visibly raises the risk.

If sourced part reliabilities are added later, they belong in p_base for each phase, not in a second meter.

**Monte Carlo in Engineer mode.** Run the mission 1,000 times with the same design and show the success rate. This teaches that a good design lowers risk but never removes it. The run is seeded (default seed 2013, shown on screen), so the same design always gives the same result: a live demo is reproducible. Single flights from Build Bay use a fresh random seed each launch, shown on the crisis card and the Debrief. Opening the game with `?seed=N` fixes every flight to seed N (retries included), so one flight also replays identically; the Debrief links to `?seed=` for the flight just flown.

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

**Crisis simplification (decided).**
- Each option has costs (Δv, budget, science days, or a minimum power margin) and a failure chance (game estimates). An option the player's spare margins cannot pay for is not offered; the free option is always there.
- A bad outcome ends the phase that option affects.
- Costs apply only if the crisis is reached, except a test bought before launch (Genesis card), which is always paid.
- Crisis handling score: safe choice and fine 100 · risky and fine 70 · safe and unlucky 50 · risky and lost 0.

## Validation set

The engine passes validation when it reproduces each real mission's key numbers within ±10% using the same equations as the player. The results table goes on the Sources & Assumptions page; it is the strongest evidence for the Validity score.

| Mission | Launch vehicle | Wet mass (kg) | Dry mass (kg) | Other published values | Engine must reproduce | Source |
| --- | --- | --- | --- | --- | --- | --- |
| [MAVEN](https://science.nasa.gov/mission/maven/) (Mars, 2013) | Atlas V 401 | 2,454 | 809 | 12 m² arrays, 1,150–1,700 W at Mars; 2 m high-gain antenna; 65 kg science payload; Mars orbit insertion Sept 21, 2014 | Power range (η\_sys ≈ 0.20); Δv capability from the rocket equation; transfer time \~10 months | NASA Science |
| [OSIRIS-REx](https://arxiv.org/pdf/1702.06981) (Bennu, 2016) | Atlas V 411 | 2,105 | \~860–880 (sources differ) | Launch C3 = 29.3 km²/s²; Earth flyby Sept 2017 | Atlas V 411 curve ≥ 2,105 kg at C3 29.3; game must flag that the real mission used a flyby | Mission description paper (arXiv 1702.06981) |
| LRO (Moon, 2009) | Atlas V 401 | to verify | to verify | to verify | Lunar orbit insertion Δv; power; data rate | NASA LRO mission page (to open) |

MAVEN's mission ended after contact was lost on Dec. 6, 2025; NASA declared the end of mission on June 3, 2026 ([NASA Science: MAVEN](https://science.nasa.gov/mission/maven/)). The game should label it "MAVEN (2013–2025)", which also gives it a strong "real history" story.

**How to run it.** A unit test file `validation.test.ts` loads each mission as a player design, runs the full engine, and asserts the tolerance. If a test fails, fix the model or the data, never the expected value.

**Row kinds (decided).** Every row in the results table is labelled:
- **validation:** engine output vs an independent published value.
- **calibration:** a constant was fitted to this value, so agreement is by construction (MAVEN power → η\_sys).
- **info:** not a pass/fail check.

**MAVEN checks added in v0.2**, from [NASAfacts: MAVEN Orbit Insertion](https://science.nasa.gov/wp-content/uploads/2024/03/44740_MAVEN-Fact-Sheet.pdf):
- Capture orbit: 35-hour period, 380 km periapsis.
- Science orbit: about 150 × 6,300 km. Kepler's third law must give the published 4.5-hour period.
- The orbit-insertion burn must use more than half the propellant.
- 1-Earth-year primary mission.

**Known gap:** the Atlas V payload curves are placeholders until NASA LSP points are exported, so the launch-capacity rows are not real evidence yet.

## Scoring

The total is a weighted sum shown openly in Engineer mode, so the Debrief number always adds up. Science comes first, because that is why missions fly.

```latex
Score = \sum_i w_i \, s_i, \qquad s_i \in [0, 100], \quad \sum_i w_i = 1 \qquad (\text{Score} \in [0, 100])
```

| Category | Weight | How sᵢ is computed |
| --- | --- | --- |
| Science return | 0.30 | Data downlinked ÷ science goal (capped at 100). Science goal = Σ instrument data/day × planned science days, so the radio or a lost mission lowers it |
| Mission success | 0.20 | 100 if all phases complete; partial credit per phase reached |
| Budget discipline | 0.15 | 100 at or under cap; falls linearly to 0 at 20% over (game rule) |
| Propellant (Δv) margin | 0.10 | Margin band score (below) |
| Power margin | 0.10 | Margin band score |
| Mass margin | 0.10 | Margin band score |
| Crisis handling | 0.05 | Outcome of the crisis decision vs the risk taken |

**Margin band score.** Margins are scored on a band, not "more is better". Too little margin is risky; too much means the player carried mass or power they did not need. 100 inside 10–30% margin, falling linearly to 0 at 0% margin and at 80% margin. This mirrors real design practice and is the trade-off judges will look for.

**Stars.**

1. Reached the destination and started science.
2. Science return ≥ 70%.
3. Every margin inside its band at the end of the mission.

Stars are earned in order. The end-of-mission Δv margin includes crisis spending, and the power margin is computed at the end of the science phase.

The Debrief's "For the next star" hint is computed by the engine (for example, extra propellant from the rocket equation, checked against unused launch capacity).

## Assumptions (for the Sources & Assumptions page)

These are stated openly in the game. Each one is a standard simplification for early concept design.

1. Patched conics: only one body's gravity acts at a time.
2. Planet positions from JPL's approximate Keplerian elements (valid 1800–2050), not a full ephemeris.
3. Launch windows from a zero-revolution Lambert solver, capped at less than one revolution of the Hohmann transfer orbit; no gravity assists or deep-space manoeuvres, except the fixed, labelled NASA real route to Bennu.
4. Launch vehicle performance interpolated from NASA LSP points; mission-specific analysis would change it.
5. Impulsive burns: engines change speed instantly. Ion engines are limited to cruise and rendezvous to stay honest about this.
6. Solar power from the inverse-square law with one calibrated efficiency (η\_sys = 0.20 from MAVEN).
7. Data rate from a scaled link budget anchored to one real mission; band and coding held fixed.
8. Mass growth margin 30%, tank mass 12% of propellant, and 50 m/s for trajectory corrections: game rules, not NASA requirements.
9. Part costs are estimates until sourced; caps follow NASA Discovery / New Frontiers conventions.
10. Base failure rates for non-launch phases are game values; launch reliability uses each vehicle's flight record.
11. Thermal, radiation dose and atmospheric drag are not modelled, except through crisis cards.
12. Real-mission presets use published as-built dry mass (no 30% growth margin on top) and their planned prime-mission duration.

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
  missions.ts         // real-mission presets → Design
  index.ts            // evaluateDesign(), simulateMission(), monteCarloMission(), previewCrisis()
  compare.ts          // designDelta() for part cards, compareWithRealMission() for the Debrief
  designEdits.ts      // pure edits to a Design, shared by the UI and cadet.ts
  cadet.ts            // Cadet guided build: sizing, cards, chips, gauges, testFlight()
  flightMap.ts        // craft position, signalDelay(), countdown(), flight frames, map, ghostFor()
  rescue.ts           // Rescue History cases, clues, consequence, stars
src/data/
  destinations.json   launchVehicles.json   parts.json
  missions.json       // MAVEN, OSIRIS-REx, LRO presets
  crisisCards.json
  lessons.json        // Cadet lesson cards (Jupiter: Juno's gravity assist)
  rescueCases.json    // Rescue History: Mars Climate Orbiter
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
  captureOrbit: { periapsis_km: number; apoapsis_km: number };      // altitudes
  missionClass?: 'discovery' | 'newFrontiers';                        // cost cap; default discovery
  scienceDays?: number;                                               // planned science phase; default 365
  lifetimeDays?: number;                                              // planned lifetime ≥ scienceDays (Δv reserve)
  scienceOrbit?: { periapsis_km: number; apoapsis_km: number };      // altitudes; default = capture orbit
  trajectoryOption?: 'direct' | 'nasa-earth-flyby';                   // fixed route: Bennu only
  asFlownDryMass_kg?: Sourced<number>;                                // real-mission presets only
}

interface Meter { used: number; limit: number; margin: number; status: 'ok' | 'warning' | 'over';
  equation: string; inputs: Record<string, Sourced<number>>; calibrated?: boolean }

interface Evaluation {
  meters: { mass: Meter; power: Meter; deltaV: Meter; data: Meter; cost: Meter; risk: Meter };
  blockers: string[];          // plain language, e.g. "Too heavy by 120 kg"
  notes: string[];             // non-blocking, e.g. "flybys are not modelled"
  trajectory: { c3: number; vInfArr: number; flightDays: number; path: [number, number][];
    method: 'lambert' | 'hohmann' | 'fixed-route'; maxFlightDays?: number };
  details: { /* masses, Δv budget, power at arrival and end of science, cost and mass breakdowns,
               phase risks, light delay … everything the Build Bay and Debrief show */ };
}
```

Entry points: `evaluateDesign`, `simulateMission`, `monteCarloMission`, `previewCrisis`, `crisisOrders` and `standingOrderPolicy` (`index.ts`); `designDelta` and `compareWithRealMission` (`compare.ts`); `bestLaunchWindow` (`trajectory.ts`); `cadetOptions`, `buildCadetDesign`, `cadetGauges` and `testFlight` (`cadet.ts`); `flightFrames`, `flightMap`, `signalDelay`, `countdown` and `ghostFor` (`flightMap.ts`); `rescueCase`, `inspectClue` and `rescueConsequence` (`rescue.ts`).

Build order: constants → ephemeris → trajectory → propulsion → launch → power → comms → massCost → validation tests → risk, crisis, scoring. Don't build UI on a module until its tests pass.

## UI rules

The UI (`src/ui/`, React + Vite) follows the Claude Design mockups for Build Bay and Debrief (reference copies in `docs/design/`).

1. **The engine computes every number on screen.** The UI only converts units for display (the display rules in "Constants and units"). Part-card effects come from `designDelta`, the real-mission comparison from `compareWithRealMission`, the crisis card from `previewCrisis`, and starter launch dates from `bestLaunchWindow`.
2. **Engineer mode** shows each meter's `equation` and every entry in `inputs`. **ⓘ** opens the `Sourced<T>` record: source, unit, link, and a "game estimate" badge when `isGameEstimate` is true.
3. **Status** is always shown with an icon, a colour and a label. Over-limit bars are also hatched.
4. **Mission Budget meters:** mass, power, Δv, data, cost and risk. The mockup's "Reliability ≥ 85% (Π Rᵢ)" meter is replaced by the engine's Risk meter (mission failure probability against 20%, game estimate). See "Why there is no Reliability meter" in the risk section. When a meter's limit rests on a game estimate (risk limit, comms reference link), the badge shows on the meter itself, not only in ⓘ.
5. **Debrief comparison** with a real mission uses mass, power and Δv only (see "MAVEN cost"), with the biggest gap flagged. Mars is compared with MAVEN and Bennu with OSIRIS-REx. Other destinations have no comparison until a sourced preset exists.
6. **Score** is shown as 0–100. Category grades are STRONG ≥ 70, FAIR 40–69, WEAK < 40 (game rule). The row the next-star hint is about is highlighted.
7. **English only for now.** The language toggle is hidden until engine messages are returned as codes with values.
8. **Engineer flow, until the Window screen exists:** Build Bay → Launch → one crisis card (only the options the margins can pay for) → Debrief. Cadet flies through the Flight screen (rule 12).

**Cadet mode (the default).** Engineer mode keeps rules 1–8 exactly. Cadet follows rule 1 too: every number comes from the engine.

9. **One decision per screen.** The guided build asks Science, Power, Radio, Fuel, Rocket in turn ("Step 2 of 5 — Power"), with 2–3 big cards and at most one short helper line.
   - Each card is a whole design from `cadetOptions`.
   - Sized cards come from the model itself: `sizeKnob` finds the smallest array, RTG count or propellant load that reaches a target margin, by bisection over `evaluateDesign`. Power is sized on the worse of arrival day and end of science.
   - Targets are labelled game estimates: lean 10%, balanced 25%, roomy 50%. Fuel is re-sized last, so an earlier change never leaves a stale load.
   - Chips show what the part on the card weighs, makes and costs: ⚖ kg, 🔋 W, 📷/📡 photos per day, ⛽ spare kg, coins (one coin = 5% of the cost cap, game estimate). A red tag names any gauge the card would push over its limit.
10. **Metaphor gauges** replace the meters: weight → a balance scale (with the rocket straining when over), power → a battery, Δv → "Fuel to reach …", data → photos sent home per day (one photo = an 8.39 Mbit frame, game estimate), cost → a coin jar against the cap.
    - Each gauge carries its meter's status, shown with icon, colour and label.
    - Tapping a gauge shows the meter's real numbers with the ⓘ of every input. Equations stay in Engineer mode.
11. **Test Flight** (`testFlight`) places each blocker in the phase where it bites (too heavy → launch, power → cruise, Δv or no-capture engine → arrival) and marks thin margins (below 10%) as shaky. It shows the seeded Monte Carlo loss per phase, and the preview stops at the first failure.
12. **Standing orders and light-delay Mission Control.** From Mars on, the player queues an order for each crisis card the mission can meet (`crisisOrders`).
    - The craft acts on its order when the crisis comes (`standingOrderPolicy`). The odds are the same as for any other choice.
    - The Flight screen pauses on the crisis day. A pulse carries the news to Earth with a countdown of the real one-way light time (`signalDelay`, `countdown`).
    - A new command arrives one round trip after the crisis began, too late. No new risk rule is added.
13. **Level map.** Moon (3 parts) → Mars → Venus → Bennu → Jupiter. Each level opens only the steps it teaches; the others keep balanced cards, so every level starts flyable. One star opens the next level.
    - Jupiter is the "impossible" lesson: no Atlas V in the catalogue reaches the direct C3. A Test Flight that fails at launch earns its star and shows Juno's real gravity-assist route (sourced).
14. **Rescue History.** A real lost mission's published file and the clues from its failure report. Mars Climate Orbiter is the first case: the board's root cause and three contributing causes.
    - The player picks the bug. Stars drop by one per wrong guess (game rule).
    - The consequence is computed from the published altitudes.
15. **Ghost on the flight map.** Mars and Bennu show the real mission's path (MAVEN, OSIRIS-REx) from its preset through `evaluateDesign`.
    - It is turned about the Sun to start beside the player, which keeps its shape and Sun distances, and is labelled so.
    - Other destinations have no ghost until a sourced preset exists (rule 5).

## Decision log

| # | Date | Decision |
| --- | --- | --- |
| 1 | Oct 3, 2026 | **Toolchain** in `.venv` (Node via nodeenv). Values the spec marks approx./to verify are kept but flagged `isGameEstimate`, and are listed in `TODO_DATA.md`. |
| 2 | Oct 3, 2026 | **Real-mission presets** use published as-built dry mass; the 30% growth margin is for concept designs only. |
| 3 | Oct 3, 2026 | **Atlas V curves** are placeholder estimates: the NASA LSP query tool cannot be exported by script. |
| 4 | Oct 3, 2026 | **Δv budget** adds the capture→science orbit transfer (vis-viva) and a mission-lifetime reserve. |
| 5 | Oct 3, 2026 | **No multi-revolution Lambert.** Direct transfers are capped at < 2 t_Hohmann. For Bennu, a fixed "NASA real route (Earth flyby)" uses the published C3 of 29.29678 km²/s², clearly labelled. |
| 6 | Oct 3, 2026 | **Validation rows** are labelled validation, calibration or info. MAVEN power is calibration. |
| 7 | Oct 3, 2026 | **Approved:** score on 0–100 (Σ wᵢsᵢ); game-estimate values for base risks, acceptable risk, budget fall-off and crisis outcomes, all labelled; the crisis simplification; the Bennu cap. |
| 8 | Oct 3, 2026 | **MAVEN Δv reserve** uses the planned prime mission (1 Earth year), not the as-flown 4,094 days. Capture and science orbits come from NASAfacts: MAVEN Orbit Insertion (35 h, 380 km; 150 × 6,300 km, 4.5 h). |
| 9 | Oct 3, 2026 | **Science goal** = Σ instrument data/day × planned science days, replacing per-destination goals. |
| 10 | Oct 3, 2026 | **UI stack:** React + Vite, English only (no language toggle yet). Every tool and package is installed through `.venv` (venv Node and npm, pip into `.venv`), never globally. |
| 11 | Oct 3, 2026 | **The engine computes every displayed number,** including part-card deltas, the real-mission comparison, the crisis preview and launch windows. The UI only formats units. |
| 12 | Oct 3, 2026 | **No Reliability meter:** the mockup's Π Rᵢ reliability meter becomes the engine's Risk meter. The Debrief compares mass, power and Δv only (no cost or downlink rows). |
| 13 | Oct 3, 2026 | **Score display** 0–100, with STRONG / FAIR / WEAK grades at 70 / 40 (game rule). **Flight bridge:** Build → Launch → one crisis card → Debrief until the Window and Flight screens exist. |
| 14 | Oct 3, 2026 | **Launch window criterion:** minimum departure v∞ + arrival v∞. It finds the energy optimum, not a launch period's opening day. Validated: the 2013 optimum (Dec 6) lies inside MAVEN's published period (Nov 18 – Dec 7). |
| 15 | Oct 3, 2026 | **Downlink caps daily science** through the uncalibrated link budget, so the science return figures carry a "game estimate" badge. |
| 16 | Oct 3, 2026 | **Risk limit 20%** stays a labelled game estimate (no numeric NASA source found), shown on the meter. **Reliability → Risk** swap recorded with its reasons. |
| 17 | Oct 3, 2026 | **Monte Carlo is seeded** (default 2013, shown on screen) for reproducible demos. |
| 18 | Oct 4, 2026 | **Comms anchored to MRO** (DESCANSO Article 12: ≥500 kbps at 400 million km, 100 W, 3 m HGA). The ground term uses DSN 810-005 X-band gains (70 m 74.55 dBi, 34 m 68.24 dBi). The 34 m pairing is inferred and stays labelled. Close-range rates are optimistic (no coding or decoder caps). |
| 19 | Oct 4, 2026 | **Cadet mode is a guided game** (UI rules 9–15); Engineer mode is unchanged. Cadet sizing targets are game estimates: lean 10%, balanced 25%, roomy 50% margin. Power is sized on the worse of arrival and end of science. One coin = 5% of the cost cap; one photo = an uncompressed 1024 × 1024, 8-bit frame (8.39 Mbit). |
| 20 | Oct 4, 2026 | **Standing orders, not a new delay rule.** The craft follows the order queued before launch; light delay is shown with the real one-way and round-trip times but does not change any odds. |
| 21 | Oct 4, 2026 | **Jupiter is the "impossible" lesson** with the two Atlas V curves: its star is for finding the launch failure in a Test Flight. The lesson card uses NASA Science: Juno (Earth flyby 26 months after the Aug. 5, 2011 launch; Jupiter on July 4, 2016). |
| 22 | Oct 4, 2026 | **Rescue History: Mars Climate Orbiter.** Facts from the NASA/JPL MCO Arrival press kit (Sept. 1999) and the MCO Mishap Investigation Board Phase I Report (Nov. 10, 1999). Root cause: SM_FORCES / AMD file in lbf·s instead of N·s (factor 4.45). Planned periapsis 226 km, 80 km survivable, 57 km estimated. |
| 23 | Oct 4, 2026 | **Ghost path is rotated** about the Sun to start beside the player (the real mission flew in another year), and is labelled so. |
| 24 | Oct 4, 2026 | **Fix: free crisis options are always offered.** `availableOptions` dropped the free option when a spare margin was negative, so an over-budget craft (which may launch) crashed the flight on its crisis. Zero-cost options are now always payable. |
| 25 | Oct 4, 2026 | **Moon transfer timing.** The Moon transfer path is sampled evenly in angle, so craft positions in cruise come from Kepler's equation in time. The fixed Bennu route and the trip home stay approximate (drawing and light delay only). |
