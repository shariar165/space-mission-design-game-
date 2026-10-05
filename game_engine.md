# Signal Delay: Game Engine Rules

This document describes every rule the Signal Delay simulation engine (`src/engine`) uses: the physics equations, the constants and data, how a mission is flown day by day, how hazards are drawn, and how a flight is scored. It is a readable summary of the source of truth, [`docs/SCIENCE_SPEC.md`](docs/SCIENCE_SPEC.md), which also holds the full decision log.

Each rule says whether it rests on **published data / physics** or is a **game rule / game estimate**. In the game, every game estimate carries a "game estimate" badge in its ⓘ popover, and all of them are listed in [`TODO_DATA.md`](TODO_DATA.md).

---

## Contents

1. [Design principles](#1-design-principles)
2. [The evaluation pipeline](#2-the-evaluation-pipeline)
3. [Constants and units](#3-constants-and-units)
4. [Destinations and planet positions](#4-destinations-and-planet-positions)
5. [Trajectory](#5-trajectory)
6. [Propulsion and the Δv budget](#6-propulsion-and-the-δv-budget)
7. [Launch vehicles](#7-launch-vehicles)
8. [Power and batteries](#8-power-and-batteries)
9. [Communications and light delay](#9-communications-and-light-delay)
10. [Mass and cost](#10-mass-and-cost)
11. [Meters and margins](#11-meters-and-margins)
12. [Mission operations (the flight)](#12-mission-operations-the-flight)
13. [Hazards and responses](#13-hazards-and-responses)
14. [Risk](#14-risk)
15. [Scoring and stars](#15-scoring-and-stars)
16. [Signal Delay game rules (Pack, Fly & Survive, Report, Daily, Notebook)](#16-signal-delay-game-rules)
17. [Validation rules](#17-validation-rules)
18. [Assumptions and known limits](#18-assumptions-and-known-limits)
19. [Where each rule lives in the code](#19-where-each-rule-lives-in-the-code)

---

## 1. Design principles

1. **One model for everyone.** The player's spacecraft and real NASA missions (MAVEN, OSIRIS-REx, LRO) go through exactly the same `evaluateDesign`. A real mission is loaded from `src/data/missions.json` and turned into an ordinary `Design`. If the engine cannot roughly reproduce a real mission, the model is wrong, not the mission.
2. **Every value is sourced.** Every constant and data value is a `Sourced<T>`:

   ```ts
   interface Sourced<T> { value: T; unit: string; source: string; url?: string; isGameEstimate: boolean }
   ```

   A test (`tests/dataAudit.test.ts`) fails if any number in `src/data/*.json` is not wrapped this way. A value the spec marks "approx." or "to verify" keeps its value but gets `isGameEstimate: true`. An estimate is never presented as NASA data.
3. **The engine computes, the UI displays.** The UI never calculates a number; it calls the engine and only formats units. `tests/uiGuards.test.ts` rejects digits in JSX text and any React/DOM import inside the engine.
4. **Engineer mode shows the working.** Every meter returns its `equation` and the `inputs` that fed it, each with its source.
5. **Deterministic.** A mission is a pure function of *(design, seed, command log)*. The same inputs always give the same flight, so any flight can be replayed.
6. **SI inside.** The engine works in m, s, kg and W (μ in m³/s²). Data files keep the units things were published in, with the unit in the field name (`_km`, `_1e6km`, `gm_km3s2`).

---

## 2. The evaluation pipeline

`evaluateDesign(design)` sizes a spacecraft design before launch. It runs these steps in order:

| Step | What is computed | Section |
| --- | --- | --- |
| 1 | Trajectory: Lambert between the design's dates, a fixed route (Bennu), or an Earth-centred transfer (Moon) | [5](#5-trajectory) |
| 2 | Power on every day of the prime mission, eclipses included; the Power meter is the worst day | [8](#8-power-and-batteries) |
| 3 | Batteries sized for the worst-case eclipse at the heaviest science load | [8](#8-power-and-batteries) |
| 4 | Mass roll-up with 30% growth (or the as-flown dry mass for real missions) | [10](#10-mass-and-cost) |
| 5 | Δv budget against the rocket-equation capability | [6](#6-propulsion-and-the-δv-budget) |
| 6 | Launch capacity from the payload(C3) curve, or a rideshare slot | [7](#7-launch-vehicles) |
| 7 | Communications, cost, phase risks | [9](#9-communications-and-light-delay), [10](#10-mass-and-cost), [14](#14-risk) |

It returns:

- five **meters** (mass, power, Δv, data, cost), each with `used / limit / margin / status / equation / inputs`. The sixth meter, **Risk**, is a Monte Carlo of the flight model ([section 14](#14-risk)), run separately in a Web Worker;
- plain-language **blockers** (for example "Too heavy by 120 kg for this rocket at C3 = 12");
- non-blocking **notes** (for example "flybys are not modelled");
- **details**: every computed number the flight and the report need.

The flight itself is run by the Mission Operations engine (`src/engine/ops/`, [section 12](#12-mission-operations-the-flight)).

---

## 3. Constants and units

| Constant | Symbol | Value | Source |
| --- | --- | --- | --- |
| Standard gravity | g₀ | 9.80665 m/s² | SI definition (exact) |
| Astronomical unit | AU | 149,597,870.7 km | IAU 2012 (exact) |
| Speed of light | c | 299,792.458 km/s | SI definition (exact) |
| Solar irradiance at 1 AU | S₀ | 1361.0 W/m² | NASA Mars/Earth Fact Sheet |
| Sun gravitational parameter | μ☉ | 1.32712 × 10¹¹ km³/s² | Approximate (game estimate, to confirm) |
| Earth gravitational parameter | μ⊕ | 398,600 km³/s² | NASA Earth Fact Sheet |
| Earth equatorial radius | R⊕ | 6378.1 km | NASA Earth Fact Sheet |
| Earth sidereal year | | 365.256 days | NASA Earth Fact Sheet |
| Obliquity at J2000 | ε₀ | 23.43928° | JPL Approximate Positions of the Planets |
| 1 pound-force | | 0.45359237 kg × g₀ N | NIST SP 811 (exact) |

**Game rules (labelled estimates):**

| Rule | Value |
| --- | --- |
| Mass growth margin at concept stage | 30% |
| Tank and feed system mass | 12% of propellant mass |
| Trajectory correction allowance | 50 m/s |
| Orbit maintenance | 20 m/s per year |
| Margin warning threshold | 10% |
| DSN pass | one 8-hour pass per day |
| Earth parking orbit for lunar transfer | 185 km |

**Display rules.** Speeds in m/s below 10 km/s and km/s above; mass in kg; power in W; distance in million km; light delay in minutes; cost in $M with the year stated. C3 is in km²/s².

---

## 4. Destinations and planet positions

Five destinations form a difficulty ladder:

| Destination | Difficulty | Mission type | Key data source |
| --- | --- | --- | --- |
| Moon | Easy | Orbiter | NSSDC Moon Fact Sheet |
| Venus | Medium | Orbiter | NSSDC Venus Fact Sheet |
| Mars | Medium | Orbiter | NSSDC Mars Fact Sheet |
| Bennu (asteroid) | Hard | Rendezvous + sample return | JPL Small-Body Database |
| Jupiter | Very hard (solar power nearly fails, direct launch is beyond the rocket) | Orbiter | NSSDC Jupiter Fact Sheet |

**Planet positions.** Computed from JPL's *Approximate Positions of the Planets*, Table 1 (Keplerian elements and rates, valid 1800–2050). No API call is needed, so the game runs offline. Bennu uses JPL SBDB osculating elements (orbit solution 118) propagated two-body. The Moon problem is Earth-centred; for heliocentric purposes the Moon sits at Earth's position.

Earth–planet distance, light delay and the flight map are computed from these positions **on each mission day**, never shown as a fixed number.

**Synodic period** (time between launch windows):

```math
S = \frac{1}{\left|\,1/T_\oplus - 1/T_{planet}\,\right|}
```

**Planetary poles** (right ascension and declination from the fact sheets) orient science orbits and drive eclipse seasons and the Mars season (Lₛ).

---

## 5. Trajectory

The engine uses **patched conics**: only the Sun's gravity between planets, only the planet's gravity near it. This gives the launch energy (C3), the arrival speed (v∞) and the capture burn.

### 5.1 Hohmann transfer (the Cadet explanation)

```math
a_t = \frac{r_1 + r_2}{2}, \qquad t_{flight} = \pi \sqrt{\frac{a_t^3}{\mu_\odot}}
```

```math
v_{\infty,dep} = \left| \sqrt{\mu_\odot\left(\frac{2}{r_1} - \frac{1}{a_t}\right)} - \sqrt{\frac{\mu_\odot}{r_1}} \right|, \qquad C_3 = v_{\infty,dep}^2
```

```math
v_{\infty,arr} = \left| \sqrt{\frac{\mu_\odot}{r_2}} - \sqrt{\mu_\odot\left(\frac{2}{r_2} - \frac{1}{a_t}\right)} \right|
```

For Mars: about 259 days, C3 ≈ 8.7 km²/s², arrival v∞ ≈ 2.6 km/s. The phase rule (target leads Earth by θ = 180° − n_target · t_flight) gives about 44° for Mars.

### 5.2 Lambert transfer (what the engine actually flies)

Lambert's problem is solved (universal variables) between Earth's position on the launch date and the target's position on the arrival date. This is what produces the C3 and v∞ the game uses.

- **Zero-revolution only.** A direct transfer must take less than one revolution of the minimum-energy orbit:

  ```math
  t_{flight} < 2\,t_{Hohmann}
  ```

  That is about 518 days to Mars and 399 days to Bennu. Longer flights are blocked with a plain-language message.
- **Best arrival date.** For a launch date, the engine scans arrival dates within the cap and picks the lowest v∞,dep + v∞,arr.
- **Best launch window.** `bestLaunchWindow(dest, fromDate)` scans one synodic period on a 10-day grid, refines ±10 days at 1-day steps, and returns the launch date with the lowest v∞,dep + v∞,arr. This is an energy optimum, not a real launch period's opening day.

### 5.3 Capture burn

The rocket pays for C3; the spacecraft pays for capture into an orbit with periapsis radius rₚ and apoapsis radius rₐ:

```math
\Delta v_{cap} = \sqrt{v_{\infty,arr}^2 + \frac{2\mu}{r_p}} - \sqrt{\mu\left(\frac{2}{r_p} - \frac{2}{r_p + r_a}\right)}
```

An elliptical capture orbit costs much less than a low circular one; this is a trade the player discovers.

### 5.4 Orbits and orbit changes

- Capture and science orbits are given as **altitudes** above the equatorial radius, not radii.
- When only a period is published, the apoapsis comes from Kepler's third law: a = (μT²/4π²)^(1/3).
- If the science orbit differs from the capture orbit, the craft pays a two-burn transfer, each burn at an apsis (vis-viva, cheaper of the two burn orders):

  ```math
  v = \sqrt{\mu\left(\frac{2}{r} - \frac{2}{r_p + r_a}\right)}
  ```

### 5.5 Special cases

- **Moon:** Earth-centred. The rocket does trans-lunar injection from a 185 km parking orbit; the spacecraft does lunar orbit insertion with the capture equation (μ of the Moon).
- **Bennu:** gravity is negligible, so rendezvous Δv ≈ arrival v∞. The player can choose the fixed, labelled **"NASA real route (Earth flyby)"**: published launch C3 = 29.29678 km²/s² and launch date (Lauretta et al. 2017). The flyby is not simulated; only the post-flyby leg (flyby → start of approach, Aug 13 2018) is computed by Lambert. The deep-space manoeuvre (Dec 28 2016) is charged to the spacecraft; its size is a game estimate.
- **Jupiter:** a direct transfer needs C3 ≈ 77 km²/s², beyond any Atlas V in the catalogue. The game shows this as the reason Jupiter is "very hard", and the lesson card shows Juno's real gravity-assist route.

---

## 6. Propulsion and the Δv budget

**Rocket equation**, applied to every craft including real ones:

```math
\Delta v = I_{sp}\, g_0 \ln\left(\frac{m_{wet}}{m_{dry}}\right), \qquad m_{prop} = m_{dry}\left(e^{\Delta v / (I_{sp} g_0)} - 1\right)
```

The second form answers the report's hint "carry X kg more propellant" exactly.

| Engine type | Isp | Game rule |
| --- | --- | --- |
| Hydrazine monopropellant | ~220–230 s | Simple, reliable default |
| Bipropellant (MMH/NTO) | ~310–320 s | Less propellant, more cost and failure points |
| Solar-electric ion (xenon) | ~3000 s | Cruise and rendezvous only; cannot do a fast capture burn; needs high power |

Isp values are textbook ranges (game estimates) until each is replaced by a named flight engine.

**Required Δv** is the sum of:

1. the arrival burn (capture equation; for Bennu, v∞);
2. the capture → science orbit change (vis-viva);
3. 50 m/s of trajectory corrections;
4. orbit maintenance at 20 m/s per year over the planned science days;
5. a lifetime reserve = maintenance rate × (planned lifetime − science days), zero when no extension is planned at launch;
6. any fixed-route manoeuvre (Bennu's deep-space manoeuvre).

```math
\text{margin} = \frac{\text{capability} - \text{required}}{\text{required}}
```

Real-mission presets use the **planned** prime mission, not the as-flown lifetime.

---

## 7. Launch vehicles

**Payload vs C3 curve.** A rocket is a curve, not a number. Capacity is read by piecewise-linear interpolation between published points:

```math
m_{max}(C_3) = m_i + (m_{i+1} - m_i)\,\frac{C_3 - C_{3,i}}{C_{3,i+1} - C_{3,i}}
```

```math
\text{mass margin} = \frac{m_{max} - m_{wet}}{m_{max}}
```

Over capacity is a blocker ("Too heavy by 120 kg for this rocket at C3 = 12"). The intended source is the NASA Launch Services Program performance site; the current Atlas V 401 and 411 points are **placeholders** because that site cannot be exported by script.

**Reliability.** Launch success uses a Laplace estimate, so a rocket with few flights is never shown as 100% safe:

```math
p_{success} = \frac{\text{successes} + 1}{\text{flights} + 2}
```

**Rideshare (Moon).** A craft can fly as the secondary payload of a real shared launch: LCROSS's slot on LRO's Atlas V 401 (June 18 2009), limited to 1,000 kg fuelled (NTRS 20100028203), with LRO at 1,850 kg.

- m_max = min(secondary slot, m_LV(C3) − m_primary); the mass margin is measured against the slot.
- Price (game rule): a mass-proportional share, price × m_wet / (m_wet + m_primary). Launch is paid outside the cost cap.
- The ride only goes where its primary went; elsewhere it is a blocker.

---

## 8. Power and batteries

**Solar power** falls with the square of distance from the Sun:

```math
P_{solar} = S_0 \left(\frac{1\,\text{AU}}{r}\right)^2 A\, \eta_{sys} \cos\theta\, (1 - d)^{t}
```

r = Sun distance that day (from the ephemeris), A = array area, θ = Sun angle, d = yearly degradation, t = years since launch.

**Calibration.** MAVEN's 12 m² arrays produce 1,150–1,700 W across Mars's orbit (206.65–249.26 million km from the Sun). Both ends give η_sys ≈ 0.20, which is used for the default array. This is a *calibration*, not a validation.

**RTG.** One MMRTG gives about 110 W at launch and weighs about 45 kg (NASA MMRTG fact sheet). Power does not depend on the Sun, so it is the real option for Jupiter.

**Required power** = bus + engine + radio transmit + heaters every day, plus instruments in the science phase. Heater power rises as sunlight falls (game approximation).

**The Power meter is the worst day.** Power is computed on every day from launch to the end of the prime mission, along the transfer in cruise and in the science orbit after arrival, with eclipses:

```math
P_{avail} = \min\left(P_{gen}(1 - f_{ecl}),\; \frac{E_{batt}}{t_{ecl,max}}\right)\ \ (\text{solar}), \qquad P_{avail} = P_{RTG}\ \ (\text{RTG})
```

f_ecl is the fraction of the day in shadow and t_ecl,max the longest single eclipse that day. The meter shows the day with the lowest margin and names it. The flight reads the same days, so the meter and the flight are one model.

**Batteries** are sized to cover the longest eclipse in the science orbit (worst case: cylindrical shadow centred on apoapsis) at the heaviest science-day load, within a maximum depth of discharge:

```math
E_{batt} = \frac{t_{ecl,max}\; P_{load}}{DoD_{max}}, \qquad m_{batt} = \frac{E_{batt}}{\text{specific energy}}
```

DoD_max = 30% is a game estimate chosen from JPL D-101146 (Li-ion gives more than 30,000 cycles at 30% DoD).

---

## 9. Communications and light delay

**Scaled link budget**, anchored to one real spacecraft link:

```math
R = R_{ref} \cdot \frac{P_t}{P_{t,ref}} \cdot \left(\frac{D_{sc}}{D_{sc,ref}}\right)^2 \cdot \frac{G_{gs}}{G_{gs,ref}} \cdot \left(\frac{d_{ref}}{d}\right)^2
```

- **Anchor: Mars Reconnaissance Orbiter** (DESCANSO Article 12): at least 500 kbps at 400 million km with a 100 W X-band TWTA and a 3 m antenna. The ground station behind that figure is not named; **34 m is inferred**, so the Data meter carries a "rests on an estimate" badge.
- **Ground term:** the ratio of DSN 810-005 X-band receive gains, 74.55 dBi (70 m) vs 68.24 dBi (34 m BWG), a factor of 4.28 (close to (70/34)² = 4.24).
- **Data per day** = R × DSN pass hours (default one 8-hour pass).

**Light delay:**

```math
t = \frac{d}{c}
```

For Mars, about 3.0 to 22.3 minutes. This is why decisions can't be made in real time.

**Downlink caps science.** The science **goal** is Σ instrument data/day × planned science days. On each science day the data actually **sent home** is min(data produced, downlink capacity that day) at that day's distance. The report says when the radio, not the instruments, limited the science.

---

## 10. Mass and cost

```math
m_{dry} = (1 + k_{margin})\left(m_{bus} + \sum m_{instruments} + m_{power} + m_{comms} + m_{tanks}\right), \qquad m_{wet} = m_{dry} + m_{prop}
```

- k_margin = 0.30 at concept stage (game rule). Real-mission presets use their published as-built dry mass with no growth margin on top.
- Tanks = 12% of propellant mass (game rule).

**Cost caps by mission class** (development, Phases A–D; launch and operations counted separately):

| Class | Cap | Source |
| --- | --- | --- |
| Discovery (default) | $500M (FY2019) | NASA Discovery 2019 AO overview |
| New Frontiers | ~$850M | Game estimate pending the NASA AO |

Part costs are game estimates until sourced. MAVEN is compared on mass, power and Δv only, because published cost figures use different accounting.

---

## 11. Meters and margins

Every meter follows the same status rule (`meter.ts`):

| Margin | Status |
| --- | --- |
| ≥ 10% | **ok** |
| 0% to 10% | **warning** |
| < 0% | **over** (a blocker for mass, Δv and launch) |

Status is always shown with an icon, a colour and a label; over-limit bars are also hatched.

One margin feeds several outputs at once: it sets the meter status, raises phase risk ([section 14](#14-risk)) and is scored on a band ([section 15](#15-scoring-and-stars)). That is why "more margin" is not always better.

---

## 12. Mission operations (the flight)

The flight is a day-by-day simulation (`src/engine/ops/`). Both game modes fly it. Entry points: `startOperations`, `advanceOperations` (stops at each new decision), `sendCommand`, `decide`, `bookDsn`, `finishOperations`, `runOperations` (headless), `replayOperations` (seed + action log), `operationsDebrief`, `operationsForecast`.

### 12.1 Clock and ledger

- Days count from launch (day 0) through cruise, arrival, science, the trip home (sample return) and any extension.
- The clock moves in whole days, but events have exact fractional times. A command takes effect at its exact arrival time, so a day is split into segments and power and data are counted segment by segment. Nothing the player does is instant.
- `prepareOps(design)` precomputes the fixed environment for every day: distances, light time, Sun–Earth–probe angle, eclipses, power, link rate and radiation dose.
- **Daily ledger:** power available and required, load shed; data produced, downlinked, stored and lost; Δv and propellant spent (rocket equation at the current mass); budget spent; radiation dose.

### 12.2 Determinism

- Each hazard type has its own random stream: the seed mixed with an FNV-1a hash of the hazard name, fed to a mulberry32 generator.
- All candidate times and outcome draws are made **at the start** (Poisson thinning). A decision changes the odds of what comes next but never reshuffles the future.
- `rng: () => 0.999999` means no bad luck (used in tests).

### 12.3 Power and fault protection

Loads: bus and engine (always), heaters (a share of their need), each instrument at a duty cycle 0–1 (science phase only), the radio at full draw while on. The default plan needs exactly what the Power meter needs.

Fault protection sheds load on board, at once, in this order: **instruments → radio → heaters**. The bus is never shed.

| Rule | Value |
| --- | --- |
| Brownout day | the bus cannot be powered |
| Craft lost after | 3 brownout days in a row (game estimate) |
| Cold day | heaters below their need; hardware hazard rates × k_cold = 2 (game estimate) |
| Safe mode | instruments off for 7 days, then science resumes by itself (game estimate) |

### 12.4 Data and the Deep Space Network

- Science data is produced only in the science phase, at Σ duty × instrument data/day.
- Downlink capacity = the link rate at that day's distance × booked pass hours. Zero during a solar conjunction or while the radio is off.
- Data waits in an on-board recorder of 160 Gbit (game estimate, after MRO). Data beyond it is lost.
- **Calling home on a bigger dish** costs the DSN aperture fee:

  ```math
  AF = R_B\left[A_W\left(0.9 + \frac{F_C}{10}\right)\right]
  ```

  R_B = $1,057/h (FY09), A_W = 1 (34 m) or 4 (70 m), F_C = 7 contacts per week, plus 1 h set-up and tear-down per pass. The default daily pass is already in the operations cost; only extras are charged. A booking must be made 7 days ahead (game estimate) and needs no light-time trip (it is ground-side).

### 12.5 Propellant and budget

The planned Δv is spent on the day each part happens: four trajectory corrections at 5%, 30%, 70% and 95% of cruise (game estimate); Bennu's deep-space manoeuvre on its date; the arrival burn and orbit change on arrival day; maintenance on each science and extension day. Hazard responses are extra burns. A planned burn the remaining propellant cannot make loses the craft.

Spare budget = (cost cap − development) + planned operations − spent.

### 12.6 Events known in advance

**Solar conjunction.** The Sun–Earth–probe angle each day:

```math
\cos\varepsilon = \frac{(-\mathbf{r}_E)\cdot(\mathbf{r}_c - \mathbf{r}_E)}{|\mathbf{r}_E|\;|\mathbf{r}_c - \mathbf{r}_E|}
```

While ε < 2°, no commands can be sent and the downlink stops (JPL, 2015). A 2° window at Mars lasts about 14 days, matching NASA's two-week moratoria. The Moon has no conjunctions.

**Eclipse seasons.** The science orbit is fixed in inertial space (no J2 precession), oriented from the planet's IAU pole and rotated into the ecliptic. Each day the engine finds when the craft is inside the cylindrical shadow, refining entry and exit by bisection in mean anomaly. Default orientation is polar (game estimate); MAVEN's preset uses its published 75° inclination.

**Mars season.** Solar longitude Lₛ is computed from the IAU pole and the ephemeris, checked against Mars24's perihelion Lₛ = 251°.

**Jupiter radiation.**

```math
\dot D(r) = \dot D_{ref}\left(\frac{r_{ref}}{r}\right)^{k}\ \ (r < r_{belt}), \qquad 0\ \text{outside}
```

The dose is averaged over the orbit each day and adds up against an electronics tolerance; a daily loss rate applies beyond 100%. All values are game estimates, to verify against Juno's radiation vault.

### 12.7 Commands and light time

```math
t_{arrive} = t_{send} + \frac{d(t_{send})}{c}
```

- A hazard the craft detects reaches Earth at t_onset + d/c. A hazard Earth sees first (solar observatories, comet surveys) is known a lead time *before* onset.
- No response can be sent before the team has reacted: 4 hours (game estimate).
- Every hazard has a **deadline**. If no response has arrived by then, the craft follows its standing order (if set and affordable) or its fault-protection default, the free option.
- No command can be sent during a conjunction; the receipt names the first day it can be.

### 12.8 Mission extension

When the prime science phase ends (orbiters only), the player can end the mission or extend it by 1 year or 3 years (one Senior Review cycle, to verify). An option is offered only if:

- the extension's maintenance Δv fits the Δv left;
- the power margin at the end of the extension is ≥ 0;
- at Jupiter, the projected dose stays below the tolerance;
- attitude control still works;
- prime science return is at least 50% of the goal (game estimate, standing in for the Senior Review).

Extensions are paid with new money and **reported separately**: losing the craft in an extension never removes prime-mission credit.

### 12.9 Finish mission

`finishOperations` flies on from any state to the end with the default responses and stops at the extension decision, so every flight reaches the report.

---

## 13. Hazards and responses

Each hazard is a non-homogeneous Poisson process λ(t, state), drawn by thinning: candidates arrive at a bound rate λ̄, and a candidate becomes a hazard if u < λ(t, state)/λ̄.

| Hazard | Rate model | Source |
| --- | --- | --- |
| **Solar storm** | λ = (λ_min + (λ_max − λ_min)·A(t))·(1 AU/r)². A(t) rises as (1 − cos)/2 from solar minimum (0) to maximum (1) and falls back. The cycle mean equals 13 strong storms per 11-year cycle. | NOAA Space Weather Scales (S3: 10, S4: 3 per cycle); cycle 24 and 25 dates from NOAA/NASA. λ_min/λ_max = 0.1 and the exponent are game estimates. |
| **Mars global dust storm** | Constant inside the Lₛ 180–360° season, zero outside; one per 3 Mars years on average | NASA ("once every three Mars years"); season bounds to verify |
| **Comet dust stream** | 0.03 per year at the destination; Earth sees it coming far ahead | Game estimate |
| **Reaction wheel failure** | Weibull per wheel, h(t) = (β/η)(t/η)^(β−1), β = 2, η = 15 years; 4 fitted, 3 needed | Game estimate |
| **Memory corruption** | λ = λ₀(1 + k_storm·[storm active])(1 + k_rad·Ḋ/Ḋ_ref), λ₀ = 0.2/yr, k_storm = 5 | Game estimate |
| **Orbit-insertion anomaly** | On arrival day, if u < base arrival risk × f(Δv margin left) | Risk model game values |
| **Radiation damage** | Beyond the Jupiter dose tolerance | Game estimate |

**Responses.**

- Each hazard offers 2–3 responses. Each can cost Δv, power (a minimum power margin), science days paused or budget, and has a failure chance and a failure effect (the craft, an instrument, the stored data, or a spell in safe mode).
- Only responses the remaining margins can pay for are offered; the **free option is always offered**.
- A response is checked again when it reaches the craft. If it can no longer be paid for, the default runs instead.
- Each hazard has a **real-history** text (for example, 2001 Mars Odyssey's MARIE instrument after the 2003 solar storms), marked "to verify against NASA source" until checked.
- Costs, failure chances and effects are game estimates.

---

## 14. Risk

### 14.1 The Risk meter (Monte Carlo)

The Risk meter is not a formula: the engine flies the design through Mission Operations **N = 500 times** (seed 2013), always taking the safest response and ending at the prime mission. The meter shows the share of runs whose prime mission was lost, against an **acceptable risk of 20%** (game estimate; NASA's payload risk classes are qualitative).

- Run count, seed, lost runs and standard error √(p(1 − p)/N) are shown on screen.
- A design that cannot launch is lost in every run.
- Run *i* always uses the same seed, so results don't depend on batching. The UI runs it in a Web Worker and shows a status only when every run is in.

### 14.2 Margin factor and phase risk

Used by the orbit-insertion anomaly and by the legacy single-card flight:

```math
p_{fail,phase} = p_{base,phase} \cdot \prod_i f_i(\text{margin}_i)
```

```math
f(m) = \begin{cases} 1 & m \ge 10\% \\ \text{linear from 1 to 3} & 0\% \le m < 10\% \\ \infty & m < 0\% \end{cases}
```

| Phase | Base rate (game estimate) | Margin that feeds it |
| --- | --- | --- |
| Launch | Laplace estimate of the vehicle record | — |
| Cruise | 2% | Power |
| Arrival (capture or rendezvous) | 4% | Δv |
| Science | 2% per year | Power |
| Sample return | 3% | Δv |

In Mission Operations, the explicit hazards **replace** the cruise and science base rates, so no failure is counted twice.

### 14.3 Why there is no Reliability meter

A series-reliability product (R = Π Rᵢ) would need a sourced reliability for every part, and none exist publicly; the target and every Rᵢ would be invented. The Risk meter is the flight model itself, so it agrees with what happens in flight, and it responds visibly to the player's margins.

---

## 15. Scoring and stars

The prime mission is scored as a weighted sum (0–100):

```math
\text{Score} = \sum_i w_i\, s_i, \qquad s_i \in [0, 100], \quad \sum_i w_i = 1
```

| Category | Weight | How sᵢ is computed |
| --- | --- | --- |
| Science return | 0.30 | Data downlinked ÷ science goal (capped at 100) |
| Mission success | 0.20 | 100 if all phases complete; partial credit per phase reached |
| Budget discipline | 0.15 | 100 at or under the cap, falling linearly to 0 at 20% over |
| Δv margin | 0.10 | Margin band score, after response burns |
| Power margin | 0.10 | Margin band score on the worst day (the Power meter) |
| Mass margin | 0.10 | Margin band score at launch |
| Crisis handling | 0.05 | Mean over hazards answered (100 when none came) |

**Margin band.** Margins are scored on a band, not "more is better": **100 inside 10–30%**, falling linearly to 0 at 0% and at 80%. Too little margin is risky; too much means mass or power was carried for nothing.

**Crisis handling score:** safe choice and fine 100 · risky and fine 70 · safe and unlucky 50 · risky and lost 0.

**Stars** (earned in order):

1. Reached the destination and started science (launch, cruise and arrival completed).
2. Science score ≥ 70.
3. Every margin inside its 10–30% band at the end of the mission.

**Category grades** (display only): STRONG ≥ 70, FAIR 40–69, WEAK < 40. The report's "for the next star" hint is computed by the engine (for example, extra propellant from the rocket equation, checked against unused launch capacity).

---

## 16. Signal Delay game rules

These are the rules of the game layer built on top of the physics. All values are Sourced game rules, registered in the data audit (`pack.json`, `FLY_RULES`, `STAR_RULES`, `DAILY_RULES`).

### 16.1 Pack

- **Volume:** the rocket nose is a 6 × 6 grid of squares, and each part has a footprint.
- **Weight:** a separate limit, the launch meter, drawn as a scale.
- Blockers name the limit that failed: "No room in the nose", "Too heavy for this rocket", power, fuel, capture, flight length, no science.
- Every part changes the design or the flight (through `Design.kit`). Real missions carry no kit, so every factor defaults to 1 and validation is unchanged.

| Part | Footprint | Effect | Covers |
| --- | --- | --- | --- |
| Computer (bus) | 2 × 2, locked | Spacecraft bus | — |
| Engine | 2 × 1, locked | Main engine | — |
| Camera / Spectrometer / Magnetometer / Radar / Air sniffer | 2×2 / 2×1 / 1×1 / 3×1 / 2×3 | Science instruments (the air sniffer is MAVEN's science suite) | — |
| Big dish antenna | 2 × 2 | 3 m high-gain antenna | — |
| Extra solar panel | 3 × 1 | +4 m² of array (or one more RTG) | eclipse, reaction wheel, memory |
| Big battery | 2 × 1 | 1.5× battery | eclipse |
| Extra fuel tank | 2 × 2 | +20% propellant | dust storm, debris, reaction wheel, insertion anomaly |
| Heater pack | 1 × 1, 8 kg | Cold-day factor × 0.5 | eclipse, reaction wheel, memory |
| Radiation shield | 2 × 2, 40 kg | Solar-storm failure chance × 0.5 | solar storm |
| Debris bumper | 3 × 1, 30 kg | Debris failure chance × 0.4 | debris |
| Spare computer | 1 × 1, 12 kg | Memory-corruption failure chance × 0.5 | memory corruption |
| Autopilot chip | 1 × 2, 2 kg | With no standing order, the robot takes its safest affordable response | conjunction |

### 16.2 Danger deck

The destination's hazards plus the foreseeable eclipse season and solar conjunction. A danger is **COVERED** by two or more packed parts whose effect touches it, and has **SOME COVER** with one.

### 16.3 Launch calendar

Six weeks (42 days, 20 before the best day) of launch days around the best one, each with its lowest-energy arrival. A day is **good**, **so-so** or **bad** by the worse of the launch-mass and Δv meter statuses that day. LAUNCH needs the ARM switch, a day that is not bad, and no blockers.

### 16.4 Fly & Survive

- **Clock speeds:** pause, 10×, 100× and 1000× mission days per real minute. The chosen speed stays set; a card or overlay only holds the clock, and time runs on once it clears.
- **Tiles** (five segments each): power (full at a 30% margin), fuel (propellant left), data (science sent home vs the goal), systems health.
- **Systems health:** one segment off per reaction wheel lost, instrument lost, safe mode now, brownout streak and degraded pointing; none when the craft is lost.
- **Coming Up ribbon:** the next 150 days of foreseeable events (eclipse and conjunction seasons, course fixes, the arrival burn, Mars dust-storm seasons). It never shows a hazard Earth has not seen.
- **Danger card:** stops time; shows "danger arrives in …", "your order takes …" (team reaction + one-way light time), the real history, and every response. Unaffordable responses are disabled with what is missing. A cost always shows at least one segment, so no cost reads as free.
- **Risk chips** show the increase over the safest response, in risk-bar steps (bounds 0.5 / 1 / 3 / 10% failure chance), as "⚠ +n risk", never as a negative number.
- **Eclipse planning card:** opens 3 days before each eclipse season: keep the plan, or save power (heaters at 50% of need) as a light-delayed command.
- **FINISH MISSION** lets the robot fly the rest with default responses, so every flight reaches the report.

### 16.5 Mission Report

The flight as four comic panels (launch, the two most significant moments, the end), stars with their rules, what saved you and what hurt you, **you vs the real mission** (Mars → MAVEN, Bennu → OSIRIS-REx; mass, power and Δv, with the biggest gap flagged), and a real lesson. Engineer mode adds the score breakdown with the next-star row highlighted and the ⓘ of every comparison value.

### 16.6 Levels

Moon (three levels) → Mars → Venus → Bennu → Jupiter. Each level opens only the parts and steps it teaches; one star opens the next. Jupiter is the "impossible" lesson: no Atlas V in the catalogue reaches the direct C3, and the lesson shows Juno's real gravity-assist route.

### 16.7 Daily mission

The same mission for everyone each UTC day. The seed is an FNV-1a hash of the date; the number counts days since the epoch (Oct 1 2026 = Daily #1); the craft is the Mars starter with fixed extras. The share card shows one row per danger answered (held, cost you, hurt) and never reveals what was picked. Results stay in the browser.

### 16.8 Engineer's Notebook and Rescue History

- Each Notebook lesson points at a real-history text already Sourced elsewhere in the data; none is invented. A lesson opens when its deed is done (face a hazard, earn a star, solve a rescue, fly through a conjunction or eclipse season).
- Rescue History presents a real lost mission's published file and clues. Mars Climate Orbiter: the root cause is the SM_FORCES / AMD file in lbf·s instead of N·s (factor 4.45); planned periapsis 226 km, 80 km survivable, 57 km estimated. Stars drop by one per wrong guess (game rule), and the consequence is computed from the published altitudes.

### 16.9 Legacy single-card flight (engine only)

`simulateMission`, `previewCrisis` and `monteCarloMission` draw one crisis card per flight (Mars Climate Orbiter units, Genesis sensor, SOHO attitude, Spirit memory, solar storm). They are no longer used by the UI but stay for engine and validation tests. A card's day must fall inside its phase; a bad outcome ends the affected phase; costs apply only if the crisis is reached (except a pre-launch test).

---

## 17. Validation rules

- `tests/validation.test.ts` loads each real mission as a player design and asserts **±10%** against published values. Results are written to [`docs/VALIDATION_RESULTS.md`](docs/VALIDATION_RESULTS.md).
- Every row is labelled **validation** (independent published value), **calibration** (a constant was fitted to it, e.g. MAVEN power → η_sys) or **info** (not pass/fail).
- **When a check fails, fix the model or the data, never the expected value.**
- Physics tests are written first, with the hand calculation in a comment next to each assertion.

Current checks include MAVEN's Δv capability, transfer time, launch-window optimum inside the published launch period, science-orbit period and insertion-burn propellant share; OSIRIS-REx's route C3 and flyby labelling; the 2015, 2017 and 2019 Mars conjunction moratoria; and Mars perihelion Lₛ.

---

## 18. Assumptions and known limits

1. Patched conics: one body's gravity at a time.
2. Planet positions from JPL's approximate elements (1800–2050), with the Earth–Moon barycentre for Earth and UTC used for TDB (about 69 s off).
3. Zero-revolution Lambert, capped below 2 × t_Hohmann; no gravity assists except the fixed, labelled Bennu route.
4. Launch performance interpolated from placeholder curves until NASA LSP points are exported.
5. Impulsive burns; ion engines limited to cruise and rendezvous.
6. Solar power from the inverse-square law with one calibrated efficiency (0.20, MAVEN).
7. Data rate from a link budget anchored to MRO; band and coding fixed, so close-range rates are optimistic.
8. 30% mass growth, 12% tank mass and 50 m/s corrections are game rules.
9. Part costs are estimates; caps follow NASA Discovery / New Frontiers conventions.
10. Non-launch base failure rates are game values.
11. Thermal and drag are not modelled; Jupiter radiation dose is (game estimates), heaters are a power load, and cold days raise hardware hazard rates.
12. Real-mission presets use as-built dry mass and their planned prime mission.
13. Mission operations: inertially fixed science orbit, cylindrical shadow, whole-day clock with part-day commands, independent Poisson hazards, two-part cosine solar cycle, no lunar conjunctions, cruise positions in the ecliptic plane, DSN fees in FY09 dollars against FY2019 caps.
14. Scoring uses Σ wᵢsᵢ on 0–100 (the spec's 100 Σ wᵢsᵢ was read this way).

---

## 19. Where each rule lives in the code

| Rule area | File |
| --- | --- |
| `Sourced<T>`, `Design`, `Meter`, `Evaluation` | `src/engine/types.ts` |
| Constants and game rules | `src/engine/constants.ts` |
| Planet positions | `src/engine/ephemeris.ts`, `src/data/orbitalElements.json` |
| Hohmann, Lambert, capture, orbit change, launch windows | `src/engine/trajectory.ts` |
| Rocket equation, Δv budget | `src/engine/propulsion.ts` |
| Payload(C3), rideshare, reliability | `src/engine/launch.ts`, `src/data/launchVehicles.json`, `src/data/rideshares.json` |
| Solar, RTG, batteries; day-by-day power | `src/engine/power.ts`, `src/engine/powerProfile.ts` |
| Link budget, light delay | `src/engine/comms.ts` |
| Mass roll-up, cost | `src/engine/massCost.ts` |
| Meter status | `src/engine/meter.ts` |
| Phase risk, margin factor | `src/engine/risk.ts` |
| Weights, bands, stars | `src/engine/scoring.ts` |
| Evaluation pipeline | `src/engine/index.ts` |
| Mission operations clock and environment | `src/engine/ops/timeline.ts`, `ops/index.ts` |
| Conjunctions, eclipses, Lₛ, Jupiter dose | `src/engine/ops/predictable.ts` |
| Hazard rates, random streams, thinning | `src/engine/ops/random.ts`, `src/data/hazards.json`, `src/data/operations.json` |
| Command queue and light time | `src/engine/ops/commands.ts` |
| Power plan, load shedding, recorder, DSN | `src/engine/ops/resources.ts` |
| Hazard responses | `src/engine/ops/responses.ts` |
| Extension | `src/engine/ops/extension.ts` |
| Risk meter Monte Carlo | `src/engine/ops/riskEstimate.ts` |
| Fly & Survive view model | `src/engine/ops/fly.ts`, `ops/console.ts` |
| Mission Report | `src/engine/ops/report.ts` |
| Pack, danger deck, launch calendar | `src/engine/pack.ts`, `src/data/pack.json` |
| Daily mission | `src/engine/daily.ts` |
| Engineer's Notebook | `src/engine/notebook.ts`, `src/data/notebook.json` |
| Rescue History | `src/engine/rescue.ts`, `src/data/rescueCases.json` |
| Real-mission presets | `src/engine/missions.ts`, `src/data/missions.json` |
