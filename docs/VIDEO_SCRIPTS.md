# Signal Delay: video scripts

Two cuts, both updated for the game as it stands now: solo play plus Team Mode, the Online Room, live DONKI storms and বাংলা.

- **240 s:** the full walkthrough (demo or submission video).
- **30 s:** the trailer (social, opener, booth loop).

Every claim below is something the game really does, checked against `README.md`, `docs/SCIENCE_SPEC.md` and the code. Keep it that way if you edit: no "NASA-endorsed", no invented numbers. Read today's distance and light time off the Mars plate on the day you record.

Voice-over pace: about 140 words a minute. The 240 s script has about 470 words, which leaves room for pauses and sound.

---

## 240 s: full walkthrough

| Time | Picture | Voice-over | On-screen text |
| --- | --- | --- | --- |
| **0:00–0:15** | Black. ▶ RECEIVE TRANSMISSION, tapped. The cold open: orbit insertion burn, WAITING FOR SIGNAL, then — NO SIGNAL —. CRT hum, then static. | "September 23rd, 1999. Mars Climate Orbiter fires its engine and slips behind Mars. On Earth, the team waits for the signal to come back. It never does." | SEPTEMBER 23, 1999 · NO SIGNAL |
| **0:15–0:27** | ONE TEAM USED POUNDS. THE OTHER, NEWTONS. Hold, then cut to the SIGNAL DELAY wordmark. | "One team used pounds. The other used newtons. And out there, even a fix arrives late. That's the game." | EVERY ORDER YOU SEND ARRIVES LATE. MAKE IT COUNT. |
| **0:27–0:50** | Home. Slow push in on the Mars plate (distance and light time), then the order crawling from Earth to Mars. | "Signal Delay is a browser game about the hardest part of exploring space with robots: you're not there. Mars is between three and twenty-two light-minutes away. Today it's [read the plate]. That number comes from JPL's planetary orbits. Nobody typed it in." | MARS RIGHT NOW |
| **0:50–1:20** | Name Your Robot. Pack: parts dropping into the 6 × 6 nose grid, the weight meter rising, a blocker naming the limit that failed, then the launch calendar. | "You name your robot, then you pack it. The rocket's nose is a grid, which is volume. The scale is the rocket's lift, which is weight. Those are two separate limits, the same as for real engineers. The launch calendar shows the days Earth and Mars line up, from a real transfer orbit." | PACK · two limits: space and weight |
| **1:20–2:00** | Fly & Survive at 100×. A solar storm card opens: "Danger arrives in …" next to "Your order takes …". Choose, then follow the order pulse crossing the map. The TRANSMISSIONS teletype prints the robot's reply, one light time later. | "Then you fly. When a solar storm is coming, the card tells you two things: when the danger arrives, and how long your order takes to get there. Choose, and watch your words cross space at the speed of light. Your robot answers, and its reply takes just as long to come home. In the Daily mission, the storms are this week's real Sun, from NASA's DONKI space-weather record." | Danger arrives in … · Your order takes … |
| **2:00–2:30** | The arrival zoom into the Mars globe. Science Targets: tap a target, then OBSERVE. "IMAGE QUEUED". The Downlink drawer prints the picture. | "But surviving isn't the point. Science is. At Mars, the robot asks what it should look at. Every picture costs fuel, battery or risk, and it only counts once it has come down a Deep Space Network pass and crossed the light time to Earth." | BRING THE SCIENCE HOME |
| **2:30–2:50** | Mission Report: the album, the final transmission typing out, the comic strip, stars, your mission against MAVEN. | "The Mission Report opens with the pictures that made it home, then your robot's final message. Your flight becomes a comic, and it's scored against the real NASA mission to the same place." | MISSION REPORT · YOU vs MAVEN |
| **2:50–3:15** | Flip the CADET / ENGINEER lever. The EQUATIONS drawer opens. ⓘ shows a source card, then one with the GAME ESTIMATE badge. | "Flip to Engineer mode, and every number opens up: its equation, its inputs, its source. When there's no public source, the game says so. Real missions fly through exactly the same model as yours, and that model is checked against MAVEN and OSIRIS-REx." | Every number: equation · inputs · source |
| **3:15–3:42** | Team Setup: four roles in their colours. Cut to four phones joining an Online Room by code. A danger card: the recommendation, the vote tokens, the Flight Director's FINAL CALL, then the order leaving. A quick look at the Team Debrief. | "Real missions are flown by teams. Up to four players take roles: Flight Director, Spacecraft Engineer, Science Lead, and Comms and Ops. You can play around one screen, or each on your own phone in an online room. The right role recommends, the team votes, and the Flight Director makes the final call. Only then does the order leave." | TEAM MODE · 2–4 PLAYERS · ONLINE ROOM |
| **3:42–3:52** | Tap EN / বাংলা: the same screen redraws in Bangla. Open ⓘ to show the English original. | "And the whole game switches to Bangla in one tap, with the English source kept behind every cited fact." | EN / বাংলা |
| **3:52–4:00** | End card: the wordmark, the URL and "no install, no account". The CRT hum fades out. | "Signal Delay. Every order you send arrives late. Make it count." | shariar165.github.io/space-mission-design-game- · Free in your browser |

---

## 30 s: trailer

| Time | Picture | Voice-over | On-screen text |
| --- | --- | --- | --- |
| **0:00–0:05** | The cold open's — NO SIGNAL —, with static. | "In 1999, NASA lost a spacecraft at Mars." | NO SIGNAL |
| **0:05–0:11** | The Mars plate's light time, then an order pulse crawling from Earth to Mars. | "Out there, every order you send arrives minutes late." | Your order takes … |
| **0:11–0:20** | Fast cuts: the Pack grid, a solar storm card, four phones voting, the Flight Director's FINAL CALL. | "Pack a robot. Survive solar storms. Decide as a team, before the danger beats your signal." | Real NASA data · Real orbits |
| **0:20–0:26** | The Mars globe and OBSERVE, then the album filling with pictures. | "Then bring the science home." | BRING THE SCIENCE HOME |
| **0:26–0:30** | End card. | "Signal Delay. Free in your browser." | SIGNAL DELAY · URL |

About 45 words. If you cut music hits on the beats, drop "Then" from the fourth line.

---

## Recording notes

- **Getting to each shot fast.**
  - Press **DAILY** on Home to fly Mars straight away.
  - Use **NEXT EVENT ▸** or **100×** to reach a danger card.
  - Use **FINISH MISSION ▸▸** to jump to the report.
  - Use **INTRO** on Home to replay the cold open.
- **The cold open** shows only for a new player. Use a private window, or press INTRO.
- **Sound** is synthesised in the browser, with no files, and it starts after your first click. Unmute with 🔊 before you record. The CRT hum, the teletype clack, the static while a signal is in transit and the arrival beeps make good bed sound.
- **The Online Room** needs the relay to be reachable. For a four-phone shot without real phones, `npm run shots -- online` drives one host and four phone browsers. Its PNGs in `test-results/shots/` work as stills.
- **Stills** at 1440 × 900 and 390 × 844: run `npm run shots`. The images in `docs/images/` are the README's.
- **Both sizes:** the game works on a phone, so a vertical 390-wide crop of the 30 s cut works for social.
- **Don't claim** that the game predicts real storms. The live Daily replays this week's real DONKI events on a game timeline.
