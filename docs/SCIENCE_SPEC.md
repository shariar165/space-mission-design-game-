# Signal Delay — Science Spec v0.6

Oct 3, 2026 · @Shariar

v0.2 (Oct 3, 2026) added the decisions taken while building the engine. v0.3 (Oct 3, 2026) adds the UI rules. v0.4 (Oct 4, 2026) adds Mission operations (engine only). v0.5 (Oct 4, 2026) makes the Risk and Power meters come from the Mission operations model (Monte Carlo; worst day with eclipses), sizes batteries by depth of discharge, adds the Moon rideshare and copies the fact-sheet values. v0.6 (Oct 5, 2026) renames the game Signal Delay and rebuilds the UI from the Claude Design "Signal Delay" screens: Pack, Fly & Survive and the Mission Report, with one flight model (Mission operations) in both modes. All decisions are applied in the sections below and listed in the **Decision log** at the end.

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

**Rideshare (v0.5).** A craft can fly as the secondary payload of a real shared launch (`rideshares.json`). No smaller rocket is invented: the ride is the real rocket, with a real primary payload on board.
- **Moon: LRO, 2009.** LCROSS flew as the secondary payload on LRO's Atlas V 401 (AV-020), launched June 18, 2009 ([NASA Science: LCROSS](https://science.nasa.gov/mission/lcross/)). NASA's call for that secondary mission said it "could weigh no more than 1000 kg (fuelled)" ([D. Andrews, LCROSS project manager, NTRS 20100028203](https://ntrs.nasa.gov/citations/20100028203)). LRO's mass is 1,850 kg ([NASA Science: LRO](https://science.nasa.gov/mission/lro/about/)).
- **Mass limit:** m_max = min(secondary slot, m_LV(C3) − m_primary). The mass margin is measured against the slot.
- **Price (game rule, labelled):** the secondary pays a mass-proportional share of the rocket, price × m_wet / (m_wet + m_primary). Launch is paid outside the cost cap, as before, so a shared ride lowers the total mission cost, not the development cost.
- The ride only goes where its primary went. On any other destination it is a blocker.
- **Why it matters:** a small Moon craft on a whole Atlas V uses under 20% of its lift, so its mass margin (82–87%) can never be in the 10–30% band, and the Moon's third star was out of reach. In the 1000 kg slot the Cadet crafts sit at 16–41%, and four of the nine science × fuel cards are in the band (validation info row).

## Power

Solar power falls with the square of distance from the Sun. With one calibrated efficiency number, this single equation reproduces MAVEN's published power range to within 2%.

```latex
P_{solar} = S_0 \left(\frac{1\,\text{AU}}{r}\right)^2 A \, \eta_{sys} \, \cos\theta \, (1 - d)^{t}
```

S₀ = 1361 W/m², r = distance from the Sun on that mission day (from the ephemeris), A = array area, η\_sys = end-to-end system efficiency, θ = Sun angle (0 when pointed), d = yearly degradation, t = years since launch.

**Calibration from MAVEN.** NASA lists MAVEN's 12 m² of arrays as producing 1,150 to 1,700 W depending on position in Mars orbit ([NASA Science: MAVEN](https://science.nasa.gov/mission/maven/)). Mars ranges from 206.65 to 249.26 million km from the Sun ([Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)), so sunlight ranges from about 713 to 490 W/m². Both ends give η\_sys ≈ 0.20 (0.199 at perihelion, 0.196 at aphelion). Use η\_sys = 0.20 for the default solar array.

**RTG option.** NASA's [MMRTG fact sheet](https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf) gives about 110 W at launch and about 45 kg. Power does not depend on the Sun, so it is the only real option for Jupiter and beyond. In-game it is expensive, scarce, and adds a launch-approval step.

**Power budget.** Required power = bus + engine + comms transmit + heaters every day, plus the instruments in the science phase (Mission operations' default plan). Heater power rises as sunlight falls (game approximation). Margin = (available − required) / required.

**The Power meter shows the worst day (v0.5).** The engine computes power on every day from launch to the end of the prime mission. It uses the craft's own distance from the Sun (along the transfer in cruise) and the Mission operations equation, eclipses included (see "Mission operations › Power"):

- P_avail = min(P_gen(1 − f_ecl), E_batt/t_ecl) for solar; P_RTG for RTGs.
- f_ecl and t_ecl come from the science orbit fixed in inertial space (see "Eclipse seasons").

The meter shows the day with the lowest margin, and its ⓘ names that day. Mission operations reads the same days, so the meter and Ops are one model (`powerProfile.ts`). Before v0.5 the meter read only the arrival day in sunlight, so a design could look healthy and still shed load in an eclipse season. The arrival-day sunlit figure is still reported (`details.power.available_W`), because that is the number compared with real missions. The end-of-mission power margin used for scoring is the last science day, eclipse included.

**Batteries.** Must cover the longest eclipse in the science orbit (worst case: cylindrical shadow centred on apoapsis) at the heaviest science-day load, using at most the maximum depth of discharge (DoD):

- E_batt = t_ecl,max · P_load / DoD_max;
- battery mass = E_batt / specific energy (game value for Li-ion, to be sourced).

DoD_max = 30% is a game estimate, to verify against a mission battery design. It is chosen from JPL D-101146, *Energy Storage Technologies for Future Planetary Science Missions* (Dec. 2017): Li-ion gives more than 30,000 cycles at 30% DoD, and a low orbiter sees thousands of eclipses a year. Because the battery keeps this reserve, the battery term never limits P_avail, and the worst day is set by the sunlight lost to the shadow. Known consequence: an orbit with very long worst-case eclipses (the default Jupiter orbit) needs a very heavy battery.

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
- **Single-card flight:** `simulateMission` (the Cadet Flight and the Engineer crisis card) flies these phase risks. Their product 1 − Π(1 − p_phase) is reported only as the flight model's own loss chance.
- **Risk meter (v0.5): the Mission operations Monte Carlo, not a formula.** The engine flies the design through the day-by-day Ops simulation N = 500 times (seed 2013). It always takes the safest response and ends at the prime mission, both game rules. The meter shows the share of runs whose prime mission was lost, against an acceptable mission risk of 20%.
  - The run count, seed, lost runs and standard error √(p(1 − p)/N) are inputs of the meter and are shown on screen.
  - A design that cannot launch is lost in every run.
  - Run i always uses the same seed, so the result does not depend on how the runs are batched.
  - The UI flies the runs in a Web Worker and fills the meter in as they come; its status appears only when every run is in.
  - Hazard rates are **not** tuned to match the old phase formula. The validation table reports both as an info row: for MAVEN, 4.0% ± 0.9 (Ops) against 12.1% (phase formula).
  - The 20% limit is a **game estimate**. No NASA source giving a single numeric acceptable-loss probability for robotic science missions was found; NASA's payload risk classes are qualitative.
  - The meter shows a "game estimate" badge next to its limit, and ⓘ opens the record.

**Why there is no Reliability meter (decided).** The Build Bay mockup showed "Reliability ≥ 85%" as R = Π Rᵢ over 14 subsystems. The game uses the Risk meter in that slot instead, for three reasons:
1. **No sourced data.** A series-reliability product needs a sourced reliability Rᵢ for every part. The catalogue has none, so the 85% target and every Rᵢ would be invented numbers.
2. **One model.** The Risk meter is the Mission operations simulation itself (v0.5). A separate reliability number would disagree with what then happens in flight.
3. **It teaches the trade.** Risk responds to the player's margins: thin Δv raises the insertion anomaly chance, and thin power means shed loads, cold days and brownouts in Ops. So cutting a margin visibly raises the risk.

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

## Mission operations

Mission Operations is where the player **manages** the mission they designed, and the engine **simulates** it day by day. It is a separate entry point (`src/engine/ops/`); Engineer mode and the Cadet flight keep the single-card model above.

**Decided (v0.4):**
- Ops replaces the generic cruise and science base rates with explicit hazards, so no failure is counted twice. Launch keeps the vehicle's Laplace reliability. The orbit-insertion anomaly reuses `BASE_RISK.arrival × f(Δv margin)`. Since v0.5 the Risk meter *is* the Ops Monte Carlo; an info row compares it with the single-card flight's phase formula.
- A mission extension is reported separately. The 0–100 score and the stars stay on the prime mission, so losing the craft in an extension never removes prime-mission credit.

### Mission clock

The clock counts days from launch (day 0), through cruise, arrival, science and (for sample return) the trip home, then any extension. It moves in whole days, but every event has an exact time in fractional days. A command takes effect at its exact arrival time, so a day is split into segments and power and data are counted segment by segment. Nothing the player does is instant.

**Daily ledger.** Each day records:
- power available and required, and the load fault protection had to shed;
- data produced, downlinked, held in the recorder, and lost;
- Δv and propellant spent, from the rocket equation at the craft's mass at that moment;
- budget spent;
- radiation dose.

**Determinism.**
- The mission is a function of (design, seed, command log), so a save or a replay only needs the seed and the commands.
- Every hazard type has its own random stream: the seed mixed with an FNV-1a hash of the hazard name, fed to the same mulberry32 generator as the Monte Carlo.
- All candidate times and outcome draws are made at the start. A player decision changes the odds of what comes next but never reshuffles the future (the same random numbers whatever the player does).

### Power

```latex
P_{avail} = \min\left(P_{gen}(1 - f_{ecl}),\; \frac{E_{batt}}{t_{ecl,max}}\right) \quad (\text{solar}), \qquad P_{avail} = P_{RTG} \quad (\text{RTG})
```

- P_gen is the Power section's equation on that day (Sun distance from the ephemeris, degradation since launch).
- f_ecl is the fraction of the day in eclipse.
- E_batt is the battery energy from the existing sizing. The second term is the most the battery can carry through that day's longest eclipse.

**Loads:**
- the bus and engine (always);
- heaters (a fraction of the `heaterPower` need);
- each instrument at a duty cycle from 0 to 1 (science phase only);
- the radio at its full DC draw while it is on.

The default plan therefore needs exactly what the Power meter needs.

**Fault protection** sheds load on board, at once, in this order: instruments, then radio, then heaters. The bus is never shed. A day that cannot power the bus is a brownout day, and three in a row lose the craft (game estimate). A day with heaters below their need is a cold day, and it multiplies the hardware hazard rates by k_cold (game estimate).

### Data and the DSN

- Science data is produced only in the science phase, at Σ duty × instrument data/day.
- Each day's downlink capacity is the Communications link at that day's Earth distance, times the booked pass hours. It is zero during a solar conjunction or while the radio is off.
- Data waits in an on-board recorder. Data beyond the recorder size (game estimate, 160 Gbit after MRO, to verify) is lost.
- The pass is spread evenly over the day, so a command that arrives part-way through a day changes that day's downlink in proportion.

**DSN cost.** The [DSN aperture fee](https://deepspace.jpl.nasa.gov/files/6_NASA_MOCS_2014_10_01_14.pdf) is

```latex
AF = R_B\left[A_W\left(0.9 + \frac{F_C}{10}\right)\right]
```

- R_B = $1,057/h (FY09).
- A_W = 1 for a 34 m station and 4 for a 70 m station.
- F_C = 7 contacts per week (one pass a day).
- Each pass also pays 1 h of set-up and tear-down.
- The default daily pass is already inside the operations cost. The player pays only for hours and aperture above it.
- The FY09 rate is not inflated to the FY2019 cap year (stated).
- A booking must be made a lead time ahead (7 days, game estimate). It is ground-side, so it needs no light-time trip.

### Propellant

The planned Δv budget (Propulsion section) is spent on the day each part happens:
- trajectory corrections in four equal burns at fixed fractions of cruise (game estimate);
- the Bennu deep-space manoeuvre on its route date;
- the arrival burn and the capture → science orbit change on the arrival day;
- orbit maintenance on each science and extension day.

Responses to hazards are extra burns. Because Δv adds up across burns, with no hazards the prime mission ends with exactly capability − (required − lifetime reserve) left. A planned burn the remaining propellant cannot make loses the craft.

### Budget

The spare budget = (cost cap − development) + planned operations − spent. This is the same reserve convention as the crisis cards. Operations cost accrues daily; DSN extras and response costs are added when they happen.

### Events known in advance

**Solar conjunction.** The Sun–Earth–probe angle on each day:

```latex
\cos\varepsilon = \frac{(-\mathbf{r}_E)\cdot(\mathbf{r}_c - \mathbf{r}_E)}{|\mathbf{r}_E|\,|\mathbf{r}_c - \mathbf{r}_E|}
```

- r_E and r_c are the heliocentric positions of Earth and the craft (`craftPosition` in cruise, the destination's ephemeris position after arrival).
- While ε < 2°, NASA stops commanding Mars spacecraft ([JPL, 2015: "the sun will be within two degrees of Mars in Earth's sky"](https://www.jpl.nasa.gov/news/mars-missions-to-pause-commanding-in-june-due-to-sun/)). The game also stops the downlink, so data waits in the recorder.
- Hand check: near conjunction ε ≈ r_M/(r_E + r_M) · φ, where φ is the heliocentric angle off the Sun line, and φ̇ = n_E − n_M ≈ 0.462°/day. So ε̇ ≈ 0.28°/day and a 2° window lasts about 14 days, as NASA's ~2-week moratoria do.
- The Moon has no conjunction: the ephemeris has no real lunar position.

**Eclipse seasons.**
- The science orbit is fixed in inertial space (no J2 precession, stated). Its inclination, node and argument of periapsis are measured from the planet's equator: the IAU node at α₀ + 90° on the J2000 equator. They are rotated into the ecliptic with ε₀ = 23.43928°.
- Each day the engine finds when the craft is inside the cylindrical shadow, with the Sun direction ŝ = −r_planet/|r_planet|. Entry and exit are refined by bisection in mean anomaly, which gives the eclipse fraction and the longest single eclipse.
- A season is a run of days with eclipse. With the Sun in the orbit plane and the shadow centred on apoapsis, this reproduces the Power section's worst-case eclipse.
- Defaults are a polar orbit (game estimate). MAVEN's preset uses its published 75° ([Wood, DESCANSO / AAS 21-211](https://descanso.jpl.nasa.gov/evolution/AAS%2021-211.pdf)).

**Jupiter radiation.**

```latex
\dot D(r) = \dot D_{ref}\left(\frac{r_{ref}}{r}\right)^{k} \quad (r < r_{belt}), \qquad 0 \text{ outside}
```

- The dose rate is averaged over the orbit each day and adds up against an electronics tolerance behind the vault.
- The forecast gives the days on which the dose reaches 50%, 75% and 100% of the tolerance.
- Beyond 100%, a daily loss rate applies.
- Every value is a game estimate, to verify against Juno's radiation-vault design. Other destinations get no dose; solar storms carry their own risk.

### Hazards drawn from rates

Each hazard is a non-homogeneous Poisson process λ(t, state). It is drawn by thinning: candidates come at a bound rate λ̄, and a candidate becomes a hazard if u < λ(t, state)/λ̄, judged when Earth would learn of it. Every rate is a `Sourced` value. Rates without a source are game estimates.

| Hazard | Rate model | Source of the rate |
| --- | --- | --- |
| Solar storm | λ = (λ_min + (λ_max − λ_min)·A(t))·(1 AU/r)². A(t) rises as (1 − cos)/2 from a cycle minimum (0) to its maximum (1), then falls back to the next minimum. The cycle mean of λ is the NOAA S3 + S4 count. | [NOAA Space Weather Scales](https://www.spaceweather.gov/noaa-scales-explanation): S3 10 and S4 3 per 11-year cycle. Cycle 24: minimum Dec 2008, maximum Apr 2014. Cycle 25: minimum Dec 2019, maximum Oct 2024 ([NASA/NOAA](https://science.nasa.gov/science-research/heliophysics/nasa-noaa-sun-reaches-maximum-phase-in-11-year-solar-cycle/)). Other cycles repeat every 11 years. λ_min/λ_max and the exponent are game estimates. |
| Mars global dust storm | Constant inside the Ls 180–360° season (southern spring and summer), zero outside, averaging one per 3 Mars years. Ls is computed from the IAU pole and the ephemeris, so "more likely near perihelion" (Ls ≈ 251°) follows. | ["Once every three Mars years … on average"](https://www.nasa.gov/solar-system/the-fact-and-fiction-of-martian-dust-storms/). The season bounds are to verify. |
| Debris or comet | A constant, rare rate at the destination. Earth sees it coming a long time ahead. | Game estimate |
| Reaction wheel | Weibull per wheel, h(t) = (β/η)(t/η)^(β−1) with β > 1, times the wheels still working. 4 wheels are fitted and 3 are needed. | Game estimate |
| Memory corruption | λ = λ₀ (1 + k_storm · [solar storm active]) (1 + k_rad · Ḋ/Ḋ_ref) | Game estimate |
| Orbit-insertion anomaly | On the arrival day, if u < `BASE_RISK.arrival` × f(Δv margin left at arrival) | The Risk model's game values |

### Commands and light time

```latex
t_{arrive} = t_{send} + \frac{d(t_{send})}{c}
```

- d is the Earth–craft distance when the command is sent (the light-time equation is not iterated; the craft moves very little in minutes).
- **When Earth learns of a hazard:**
  - one that the craft detects reaches Earth at t_onset + d/c;
  - one that Earth sees first (solar observatories, comet surveys) is known a lead time *before* onset.
- A response cannot be sent before the team has reacted (game estimate, 4 h).
- Every hazard has a deadline. If no response has reached the craft by then, the craft follows its standing order if one is set and affordable; otherwise it does its fault-protection default, the free option.
- No command can be sent during a conjunction moratorium; the receipt names the first day it can be.

### Responses

- Each hazard offers 2–3 responses. Each costs Δv (propellant), power (a minimum power margin that day), data (science days paused) or budget. Each has a failure chance and a failure effect: the craft, an instrument, the stored data, or a spell in safe mode.
- Only the responses the remaining margins can pay for are offered. The free option is always offered.
- A response is checked again when it reaches the craft. If it can no longer be paid for, the default runs instead.
- Each outcome uses a number drawn at the start. Costs, failure chances and effects are game estimates.
- **Real history.** Each hazard has a real-history text marked "to verify against NASA source" until it is checked.

### Mission extension

When the prime science phase ends (orbiters only), the mission pauses for a decision: end it, or extend by 1 year or by one NASA Senior Review cycle (3 years, to verify).

**An option is offered only if all of these hold:**
- the maintenance Δv for the extension fits the Δv left;
- the power margin at the end of the extension is ≥ 0;
- at Jupiter, the projected dose stays below the tolerance;
- attitude control is still working;
- the prime science return is at least the approval threshold (game estimate). This stands in for the Senior Review's science judgement.

Extensions are paid with new money, so they do not draw on the prime budget. The extension's report gives the days flown, the data sent home, its cost and how it ended.

### Debrief

The prime mission is scored with the Scoring section's weights and band rules:
- **science:** data downlinked by the end of the prime mission against the goal;
- **mission success:** phases completed;
- **budget:** development plus any operations overspend;
- **Δv margin:** after response burns;
- **power margin:** the worst day of the prime mission, eclipse included (the Power meter, v0.5);
- **mass margin:** as at launch;
- **crisis handling:** the mean `crisisScore` over the hazards answered (100 when none came).

Messages from Ops are codes with values, never English sentences with numbers, so the UI can translate them later.

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

**Mission operations checks added in v0.4:**
- **Mars solar conjunctions.** The engine's least Sun–Earth–Mars angle must fall within ±2 days of the middle of each published command moratorium:
  - 2015: June 7–21, "within two degrees" ([JPL](https://www.jpl.nasa.gov/news/mars-missions-to-pause-commanding-in-june-due-to-sun/));
  - 2017: July 22 – Aug. 1 ([JPL](https://www.jpl.nasa.gov/news/for-moratorium-on-sending-commands-to-mars-blame-the-sun/));
  - 2019: Aug. 28 – Sept. 7 ([JPL](https://www.jpl.nasa.gov/news/whats-mars-solar-conjunction-and-why-does-it-matter/)).
  The 2015 window at 2° must also match the published length within ±2 days.
- **Mars perihelion Ls.** It is computed from the IAU pole and the ephemeris, against L_s,p = 251.000° + 0.0064891° × (year − 2000) ([NASA GISS Mars24 technical notes](https://www.giss.nasa.gov/tools/mars24/help/notes.html)).
- **Info:** the Ops loss rate against the Risk meter. Ops replaces the base rates with hazards, so this row shows the difference and is not a pass/fail check.

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

Stars are earned in order. The end-of-mission Δv margin includes crisis spending. The power margin is the Power meter's: the worst day of the prime mission, eclipses included (v0.5; before, it was the last science day). This is the margin the player sizes and sees, so the band is judged on the same number. Mission operations scores it the same way.

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
11. Thermal, radiation dose and atmospheric drag are not modelled, except through crisis cards. In Mission operations, the Jupiter radiation dose is modelled (game estimates), heaters are a power load, and cold days raise hardware hazard rates.
13. **Mission operations:**
    - the science orbit is fixed in inertial space (no J2 precession) and the shadow is cylindrical;
    - the clock moves in whole days, with commands taking effect part-way through a day;
    - hazards are independent Poisson processes;
    - the solar cycle is a two-part cosine between published minima and maxima;
    - the Moon has no conjunctions (no lunar ephemeris);
    - cruise positions are drawn in the ecliptic plane;
    - DSN fees are in FY09 dollars.
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
  ops/                // Mission operations (no UI yet)
    types.ts          //   state, ledger rows, events (codes + values), commands, decisions
    predictable.ts    //   Sun–Earth–probe angle, conjunctions, eclipse seasons, Ls, Jupiter dose, forecast
    random.ts         //   hazard rate models, per-hazard random streams, Poisson thinning
    commands.ts       //   light-delayed command queue, moratorium
    resources.ts      //   power plan and load shedding, recorder, DSN bookings and fees
    responses.ts      //   hazard responses the margins can pay for, effects
    extension.ts      //   extension options and report
    timeline.ts       //   prepareOps (fixed day-by-day environment) and the mission clock
    index.ts          //   startOperations, advanceOperations, sendCommand, decide, bookDsn, runOperations, operationsDebrief, operationsForecast
src/data/
  destinations.json   launchVehicles.json   parts.json
  missions.json       // MAVEN, OSIRIS-REx, LRO presets
  crisisCards.json
  lessons.json        // Cadet lesson cards (Jupiter: Juno's gravity assist)
  rescueCases.json    // Rescue History: Mars Climate Orbiter
  operations.json     // Mission operations parameters (conjunction threshold, solar cycles, DSN fees, …)
  hazards.json        // Mission operations hazards, responses, real history
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

Entry points: `evaluateDesign`, `simulateMission`, `monteCarloMission`, `previewCrisis`, `crisisOrders` and `standingOrderPolicy` (`index.ts`); `designDelta` and `compareWithRealMission` (`compare.ts`); `bestLaunchWindow` (`trajectory.ts`); `cadetOptions`, `buildCadetDesign`, `cadetGauges` and `testFlight` (`cadet.ts`); `flightFrames`, `flightMap`, `signalDelay`, `countdown` and `ghostFor` (`flightMap.ts`); `rescueCase`, `inspectClue` and `rescueConsequence` (`rescue.ts`); `startOperations`, `advanceOperations`, `sendCommand`, `decide`, `bookDsn`, `runOperations`, `operationsDebrief` and `operationsForecast` (`ops/index.ts`).

Build order: constants → ephemeris → trajectory → propulsion → launch → power → comms → massCost → validation tests → risk, crisis, scoring. Don't build UI on a module until its tests pass.

## UI rules

The UI (`src/ui/`, React + Vite) follows the Claude Design mockups for Build Bay and Debrief (reference copies in `docs/design/`).

1. **The engine computes every number on screen.** The UI only converts units for display (the display rules in "Constants and units"). Part-card effects come from `designDelta`, the real-mission comparison from `compareWithRealMission`, the crisis card from `previewCrisis`, and starter launch dates from `bestLaunchWindow`.
2. **Engineer mode** shows each meter's `equation` and every entry in `inputs`. **ⓘ** opens the `Sourced<T>` record: source, unit, link, and a "game estimate" badge when `isGameEstimate` is true.
3. **Status** is always shown with an icon, a colour and a label. Over-limit bars are also hatched.
4. **Mission Budget meters:** mass, power, Δv, data, cost and risk. The mockup's "Reliability ≥ 85% (Π Rᵢ)" meter is replaced by the engine's Risk meter (mission failure probability against 20%, game estimate). The Risk meter is the Mission operations Monte Carlo and always shows its run count and seed. While it runs, it shows the runs so far and a provisional value with no status. See "Why there is no Reliability meter" in the risk section. When a meter's limit rests on a game estimate (risk limit, comms reference link), the badge shows on the meter itself, not only in ⓘ.
5. **Real-mission comparison** (Mission Report) uses mass, power and Δv (see "MAVEN cost"), with the biggest gap flagged, plus the preset's launch date and planned science days. Burn length, actual lifetime and how the mission ended are not shown: there is no thrust data, and the history is free text (v0.6). Mars is compared with MAVEN and Bennu with OSIRIS-REx. Other destinations have no comparison until a sourced preset exists.
6. **Score** is shown as 0–100. Category grades are STRONG ≥ 70, FAIR 40–69, WEAK < 40 (game rule). The row the next-star hint is about is highlighted.
7. **English only for now.** The language toggle is hidden until engine messages are returned as codes with values.
8. **Engineer flow (v0.6):** Build Bay → Launch → Fly & Survive → Mission Report with Engineer details. The single crisis card is no longer flown in the UI; `simulateMission`, `previewCrisis` and `monteCarloMission` stay for the engine and validation tests.

**Cadet mode (the default).** Cadet follows rule 1 too: every number comes from the engine. Since v0.6, rules 9–12 are replaced in the UI by the Signal Delay rules 21–27 (Pack replaces the guided build, the Test Flight and standing orders; Fly & Survive replaces the Flight screen and Mission Control). The engine functions behind them (`cadetOptions`, `testFlight`, `crisisOrders`, `flightFrames`) are kept and tested.

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

**Operations Console (both modes).** Built from the Claude Design mockups `Operations Console.dc.html`, `Ops Console Desktop.dc.html` and `Ops Console Mobile.dc.html` (copies in `docs/design/`). It follows rule 1: every number comes from `consoleView`, `powerPlanPreview` and `dsnOptions` (`src/engine/ops/console.ts`). Cadet reads sentences; Engineer adds the mission elapsed time, distances, the Sun–Earth–probe angle, each gauge's equation and the ⓘ of its inputs.

16. **Console (v0.6: Fly & Survive).** Every launch, in both modes and from every level, flies the craft in Fly & Survive (rule 22), pinned at launch, with the flight's seed.
    - The layout has a clock row (day, phase, status chip, one-way light time, Pause / 1× / 10× / 100× = 0 / 1 / 10 / 100 mission days a real minute, "Next event").
    - The map reuses the flight map, with the real-mission ghost and light pulses along the Earth–craft line. Resources (power today, fuel, recorder, budget reserve) use rule 3 statuses.
    - The Upcoming strip shows the next 60 days (game rule): conjunctions and eclipse seasons as bands; planned burns (not daily upkeep), phases, marked passes and the first bookable day as points.
    - "Next event" stops at commands arriving, phases, planned burns, conjunction warnings and edges, eclipse seasons, science resuming and the end of the prime mission. It never stops at a hazard Earth has not seen yet (the clock stops by itself when one becomes known).
    - Keyboard: Space pause, 1/2/3 speed, N next event, Esc closes a side panel.
17. **Hazard alert.** The clock auto-pauses when a decision opens. The alert shows the hazard, its real history with the "to verify" badge (from `isGameEstimate`), and **every** response of the hazard type. The ones the margins could not pay for when Earth learned of it are shown disabled, with what is missing (`optionBlockers`). Each card shows its costs and a five-segment risk bar (failure-chance bounds 0.5 / 1 / 3 / 10%, game rule). The craft's fallback (standing order or fault protection) is tagged.
    - Send queues the response once the team has reacted, then the command crosses space with a live countdown (time runs fast until it arrives). The result card shows the outcome when it lands.
    - "Let the craft decide" leaves the hazard to the fallback at the deadline. During a conjunction nothing can be sent, so the alert says so and the clock may run.
18. **Commands and calls home.** The power plan is a dial with two handles (science duty, heater share) and a radio switch. `powerPlanPreview` gives today's margin, the battery's depth of discharge in the coming eclipse season against the 30% limit, photos per day and a cold warning. Sending it is a command with light delay.
    - "Book a call home" offers the small (34 m) or big (70 m) dish for one pass, with the data, photos and the extra aperture fee. It is ground-side (no light delay) but booked a lead time ahead; a refused day names the first free day.
    - The command queue shows commands in flight (countdown, progress) and the latest carried out or too late. It warns 14 days (game rule) before a conjunction.
19. **Blackout and safe mode.** In a conjunction the console shows "Radio blackout · day x of n", the day contact returns, and "Skip ahead". Send buttons are disabled. Safe mode shows the instruments off and the day science resumes: the engine resumes it by itself, so there is no "Recover" button.
20. **Extension and Ops debrief.** At the end of the prime mission the console offers End / +1 yr / +3 yr cards from the extension decision, with the reasons a blocked one cannot be flown. The Ops debrief shows the prime score and stars from `operationsDebrief`, with the extension reported separately.
    - **Not shown, because the engine does not model it:** a failure chance for an extension, DSN station names (DSS-xx), a "send all at the next pass" queue (each command leaves at once and pays the light delay), and the Bangla text (rule 7).

**Signal Delay screens (v0.6).** Built from the Claude Design project "Signal Delay" (`docs/design/signal-delay/`): the design is the visual source of truth, and rule 1 holds everywhere. Display game rules are Sourced and registered in the data audit (`FLY_RULES`, `STAR_RULES`, `pack.json`).

21. **Theme.** Colours, fonts (Big Shoulders Display, B612, B612 Mono, VT323), radii, spacing and shadows come from the design as CSS variables in `src/ui/styles/theme.css`. The design canvas's demo controls (screen headers, "jump to", the phone clock) are not shipped.
22. **Fly & Survive.** A CRT map (Sun-centred; the path flown and the path ahead; the real mission's turned ghost), a teletype log line, four five-segment tiles (power from today's margin, fuel from propellant left, data from science sent home against the goal, systems health), the day clock with Pause / 1× / 10× / 100×, and a Coming Up ribbon of the next 150 days (eclipse and conjunction seasons, course fixes, the arrival burn, Mars dust-storm seasons; never a hazard Earth has not seen).
    - A **danger card** stops time. It shows the hazard, "danger arrives in …", "your order takes …" (one-way light time), the real history with its "to verify" badge, and every response as a choice (← / →, ↓ for a third; swipe on a phone). Unaffordable responses are shown disabled with what is missing. Chips show the costs as segment drops and the **risk increase over the safest response as "⚠ +n risk", never as a negative number**.
    - Choosing sends the order: first the team's reaction, then the light-time trip with a live countdown and a pulse crawling from Earth to the robot. If the order lands before the danger strikes, time runs on until the outcome. The result is typed out as an INCOMING message.
    - An **eclipse planning card** opens a few days before each eclipse season: keep the plan (warm) or turn the heaters down (save power), with the battery depth-of-discharge segments from `powerPlanPreview`. Saving power is a command with light delay.
    - The power plan, call home, command queue, blackout, safe mode and extension are drawers. Engineer adds r, d, t = d/c and an EQUATIONS drawer with every gauge's equation and ⓘ.
23. **Systems health** (game rule): five segments, one off per reaction wheel lost, instrument lost, safe mode now, brownout streak and degraded pointing; none when the craft is lost.
24. **Pack.** The nose is volume: a 6 × 6 grid of squares, and each part has a footprint (game rules). Weight is a separate limit: the launch meter, drawn as a scale beside the nose. Every part changes the design or Mission operations (`pack.json`, `Design.kit`):
    - instruments, the 3 m dish, +4 m² of array (or one more RTG), +20% propellant, a 1.5× battery, kit mass;
    - failure-chance factors (shield, bumper, spare computer), a heater cold factor;
    - the autopilot: with no standing order, the robot takes its safest affordable response.

    Blockers name the limit that failed: "No room in the nose", "Too heavy for this rocket", power, fuel, capture, flight length, no science.
25. **Danger deck.** The destination's hazards plus the foreseeable eclipse season and solar conjunction. A danger is COVERED by two or more packed parts whose effect touches it, and has SOME COVER with one (game rule). The coverage lists are tested against the data (the tank covers exactly the hazards with a Δv-costing response).
26. **Launch calendar.** Six weeks of launch days around the best one, each with its lowest-energy arrival. A day is good, so-so or bad by the worse of the launch-mass and Δv meter statuses on that day (ok / warning / over). LAUNCH needs the ARM lever, a day that is not bad and no blockers.
27. **Mission Report.** The flight as four comic panels (launch, the two most significant moments, the end), stars with their rules (`STAR_RULES`), what saved you and what hurt you, you vs the real mission (rule 5) and a real lesson from the flight (a Sourced real-history text). Engineer adds the score breakdown (Σ wᵢsᵢ, with the next-star row highlighted), the ⓘ of every comparison value and the Mission operations risk.
28. **Home.** The landing screen in Cadet. It holds the wordmark, the teletype pitch, PLAY (the first open level without a star) and the Daily, Rescue History and Notebook keys. The keys carry engine counts: `rescueProgress`, `notebookProgress`, and "new today" from the Daily save. The CRT loops an order crawling to the robot with MAVEN's real one-way light time at Mars arrival (`signalDelay`, `countdown`). The mission map stays one click away ("Choose a mission").
29. **Daily mission.** The same mission for everyone each UTC day. The seed is an FNV-1a hash of the date, the number counts days since `DAILY_RULES.epoch` (game rule), and the craft is the Mars starter with the fixed extras (`dailyDesign`). The share card shows one row per danger answered: held, cost you or hurt (`dailyGrid`). It never says what was picked. It also shows the streak (`dailyStreak`) and the time to the next daily (`nextDailyIn_s`). COPY RESULT gives emoji text; SAVE IMAGE draws the card. Results are kept in the browser only.
30. **Engineer's Notebook.** Lessons from `notebook.json`. Each one points at a real-history text that is already Sourced elsewhere in the data (hazards, crisis cards, rescue cases, lessons, or a rule's own source), and none are invented. A lesson opens when its deed is done: face a hazard, earn a star on a level, solve a rescue, or fly through a conjunction or eclipse season (`notebook`, `flightFacts`). The count is whatever the data holds. A flight's newly opened lessons show as the Mission Report's NEW CARD and as NEW in the Notebook. Titles and plain-English bodies are game copy.
31. **Storms come from the Sun.** Every flight frame carries the Sun: the centre of the heliocentric maps, and −r_earth(t) on the Earth-centred Moon map, where it is drawn on the map edge in its true direction. A solar storm (`stormFront`) is drawn as a wave from the Sun that leaves when the eruption is seen (`knownAt`) and reaches the craft at onset (`hazards.json` `warningLead_days` later), linear in time; the robot glows while the storm lasts. The wave is a drawing, not a CME speed model; its 60° width is a game estimate (`FLY_RULES.cmeWidth_deg`). The order pulse from Earth is labelled YOUR ORDER.
32. **The robot talks.** The player names the robot on Pack (saved in the browser). Craft-side events become first-person messages (`robotMessages`), and each reaches Earth one light time after it was sent: t_arrive = t_sent + d(t_sent) / c, the same `newsArrival` as all news. The screen shows only messages that have arrived (`heardMessages`), with how long they took. A lost craft’s last words cite Opportunity’s last data (`VOICE_RULES`, to verify). Words are game copy.
33. **Moments and sound are presentation only.** The launch countdown (`countdownAt`, first flight of each level, holds the clock), the arrival and storm banners (`momentsSince`), the storm shake and the browser-made sound effects never change the simulation. Sound can be turned off and is quiet by default.
34. **Postcards.** Real NASA pictures (public domain, NASA Image and Video Library ids, credits) in `postcards.json`, three per flyable destination. A flight earns a card when downlinked / science goal ≥ its `unlockAt` (first data, half, all; game rules), after the first data has arrived. Captions come from the NASA description; anything added from general knowledge is marked to verify.
35. **Ranks and badges.** Ranks are named after real Mission Control jobs (`ranks.json`, job descriptions Sourced and marked to verify) and rise with the best stars per level (`starTotals`, `rankFor`; thresholds are game rules). Badges are deeds: Notebook flight facts (a storm with no instrument lost, an eclipse season with no brownout, an extension, a sample home, a conjunction), a full set of one destination’s postcards, a Daily streak, a rescue, the Jupiter lesson. The report announces what a flight earned against the crew file at launch.

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
| 26 | Oct 4, 2026 | **Mission operations** is a separate engine entry point (`src/engine/ops/`) with no UI yet. In Ops the explicit hazards **replace** the generic cruise and science base rates. Launch keeps the Laplace reliability, and the insertion anomaly reuses `BASE_RISK.arrival × f(Δv margin)`. |
| 27 | Oct 4, 2026 | **Extension report is separate:** the 0–100 score and the stars stay on the prime mission. |
| 28 | Oct 4, 2026 | **Determinism:** the mission is (design, seed, command log). Each hazard has its own random stream, and everything is drawn at the start by Poisson thinning, so decisions change the odds but never reshuffle the future. |
| 29 | Oct 4, 2026 | **Conjunction:** no commands and no downlink while the Sun–Earth–probe angle is < 2° (JPL, 2015). Validated against the published 2015, 2017 and 2019 Mars moratoria. |
| 30 | Oct 4, 2026 | **Eclipse seasons** come from a science orbit fixed in inertial space (no J2 precession), oriented from the IAU pole. MAVEN's inclination is 75° (AAS 21-211); the default is polar (game estimate). |
| 31 | Oct 4, 2026 | **Mars Ls** is computed from the NASA fact-sheet pole and the ephemeris. It is checked against Mars24's perihelion Ls = 251° and drives the dust-storm season. |
| 32 | Oct 4, 2026 | **DSN fees** use the published aperture-fee formula (R_B = $1,057/h FY09, A_W 1 for 34 m and 4 for 70 m, 1 h set-up per pass). The default daily pass is inside the operations cost; only extras are charged. |
| 33 | Oct 4, 2026 | **Space weather rate** from NOAA's S3 + S4 counts (13 per 11-year cycle), shaped by the published cycle 24 and 25 minima and maxima. Mars global dust storms average one per 3 Mars years (NASA). |
| 34 | Oct 4, 2026 | **Risk meter = the Mission operations Monte Carlo** (500 runs, seed 2013, safest responses, prime mission only), shown with its run count, seed and standard error and flown in a Web Worker. No separate formula: `phaseRisks` stay only as the single-card flight's own model. Hazard rates are not tuned to match: MAVEN 4.0% ± 0.9 (Ops) vs 12.1% (old phase formula), as an info row. |
| 35 | Oct 4, 2026 | **Power meter = the worst day of the prime mission**, eclipses included, from the same day-by-day profile Mission operations reads (`powerProfile.ts`). The arrival-day sunlit figure stays as `details.power.available_W` for the real-mission comparison. The Cadet battery gauge warns when the worst day is in an eclipse season. |
| 36 | Oct 4, 2026 | **Battery sized by depth of discharge:** E_batt = t_ecl,max · P_load / DoD_max, at the heaviest science-day load, DoD_max = 30%. This is a game estimate from JPL D-101146 (Li-ion: more than 30,000 cycles at 30% DoD). Without this reserve the battery term would cap every eclipse day at about 0% margin. |
| 37 | Oct 4, 2026 | **Stars and the Ops debrief score power on the worst day** (the Power meter), not on the last science day, so the band is judged on the margin the player sizes and sees. |
| 38 | Oct 4, 2026 | **Moon rideshare:** LCROSS's secondary slot on LRO's Atlas V 401 (June 18, 2009). 1000 kg fuelled (NTRS 20100028203); LRO 1,850 kg (NASA Science). The limit is min(slot, m_LV(C3) − m_primary), and the price is a mass-proportional share (game rule). The user first chose "capacity − LRO", then switched to the sourced slot once the measured margins showed it alone puts Moon crafts in the band (16–41% vs 71–80%). No smaller rocket is invented. |
| 39 | Oct 4, 2026 | **Fact sheets:** Venus, Jupiter and Moon values are copied from Internet Archive copies (Sept. 28 – Oct. 3, 2026) of the NSSDC fact sheets, because the live site refused connections; each source says so. The Moon pole stays flagged (not on the Moon fact sheet). |
| 40 | Oct 4, 2026 | **Operations Console in both modes** (UI rules 16–20), from the Claude Design mockups. Cadet opens it from the Mars level on; Engineer opens it for any design that can launch. The view model is engine code (`ops/console.ts`) with display game rules: a 60-day Upcoming window, a 14-day conjunction warning, risk-bar bounds of 0.5 / 1 / 3 / 10% and an 8-event feed. |
| 41 | Oct 4, 2026 | **Power dial = two handles + a radio switch.** The mockup's radio slice would need a radio power level the engine does not model, so the power plan keeps the radio on/off and no physics was added. |
| 42 | Oct 4, 2026 | **Safe mode resumes by itself** (`pausedUntil`); the mockup's "Recover" button is replaced by the day science resumes. |
| 43 | Oct 4, 2026 | **Ops sessions resume:** the action log and mission time are kept in the browser, and `replayOperations(design, opts, actions, until)` rebuilds the mission to that time. |
| 44 | Oct 5, 2026 | **Renamed Signal Delay; UI rebuilt from the Claude Design "Signal Delay" screens** (rules 21–27). The design is the visual source of truth; its tokens live in `theme.css`. Screenshots at 1440 × 900 and 390 × 844 are compared with the design copies (`npm run shots`; Playwright installed in the venv). |
| 45 | Oct 5, 2026 | **One flight model everywhere.** Both modes fly Fly & Survive (Mission operations) and end on the Mission Report. The crisis-card flight and the separate "Run mission operations" step are removed from the UI. |
| 46 | Oct 5, 2026 | **Pack is a real mechanic** (user decision). Footprints, the 6 × 6 nose, part effects and coverage are labelled game rules. Real missions carry no kit, so validation is unchanged. Volume and weight are separate limits, and blockers name which one failed. |
| 47 | Oct 5, 2026 | **Risk shows as an increase.** A choice's risk chip is the number of risk-bar steps above the hazard's safest response ("⚠ +n risk"), never a negative number. |
| 48 | Oct 5, 2026 | **Star rules Sourced** (`STAR_RULES`: 3 phases for the first star, a science score of 70 for the second) instead of literals. |
| 49 | Oct 5, 2026 | **Home, Daily and Notebook** (rules 28–30) complete the Signal Delay screens. Cadet opens on Home; the mission map stays one click away. The Daily turns over at UTC midnight from a Sourced epoch. |
| 50 | Oct 5, 2026 | **The Notebook uses only existing Sourced texts** (user decision): 15 lessons point at hazard histories, crisis cards, the Mars Climate Orbiter case, the Juno lesson and the sources of the conjunction and battery rules. No lesson text is invented, and the collection is not a fixed 24. |
| 51 | Oct 6, 2026 | **Solar storms come from the Sun on every map** (user report: on the Moon map the storm seemed to come from Earth, because the Sun was not drawn and only the order pulse moved). Rule 31. |
| 52 | Oct 6, 2026 | **Reasons to care** (user request: players could not connect with the game): the robot gets a name and a light-delayed voice, big moments and sound, real NASA postcards, and ranks and badges (rules 32–35). All of it sits on engine output; nothing changes the simulation or the score. |
