# Flip 7 MVP Plan

## 1. Product goal

Ship a stable, public, browser-based Flip 7-style game that a group can play together on one device from setup through a final winner.

The MVP is a **local pass-and-play game**, not an online multiplayer service. It should feel complete for one game session, work on phones and desktop screens, explain what is happening, and recover cleanly when a round or game ends.

## 2. Working assumptions

- Support 3–6 players.
- Players enter names before starting.
- A game contains multiple rounds and ends at the agreed target score.
- Core number, modifier, and action-card behavior is included.
- Game state lives in the browser; accounts, a database, and real-time networking are not required.
- Vercel is the initial hosting platform.
- Before public promotion, replace any artwork or branding that is not owned or licensed for redistribution.

The exact scoring order, target score, action-card edge cases, and end-of-game tie handling must be captured in a rule matrix from the rulebook before rule-engine implementation begins.

## 3. Current baseline

### Already working

- A complete 94-card deck is generated and shuffled.
- Number, modifier, and action cards have artwork.
- Three player positions are rendered.
- Clicking the deck deals an animated card.
- Turns rotate between players.
- Duplicate number cards and seven unique number cards are detected.
- A round-end modal and reset action exist.
- The app compiles as a static Next.js route.
- `npm run build` passes with Next.js 16.2.7.

### Launch blockers

| Area | Current issue | Required outcome |
| --- | --- | --- |
| Turn flow | **Skip** only passes one turn; it does not bank a player’s score or finish their round | A player can clearly choose **Hit** or **Stay**, and stayed players are skipped |
| Card typing | Values such as `+2` can be treated as numbers through numeric coercion | Use explicit, type-safe card categories |
| Flip 7 check | All cards currently count toward the hand limit in some paths | Only unique number cards count toward Flip 7 |
| Action cards | Freeze, Flip Three, and Second Chance are visual only | Implement each effect and any target selection |
| Modifiers | `+2` through `+10` and `×2` do not affect scoring | Apply modifiers in the verified scoring order |
| Scoring | No round score, total score, or winner calculation exists | Show round results, totals, and a final winner |
| Player setup | Player count and labels are hard-coded | Add names and a 3–6 player selector |
| Round lifecycle | The game ends when two players become idle | End rounds and games according to the verified rules |
| Layout | Fixed 400 px spacing overflows smaller screens | Support common phone, tablet, and desktop viewports |
| Accessibility | The deck is a clickable `div`; status relies heavily on color | Use real buttons, focus states, labels, and text status |
| Code quality | Lint reports 5 errors and 4 warnings | Lint, type checking, tests, and build all pass |
| Metadata | The description contains a typo and sharing metadata is absent | Add correct title, description, icon, and social preview |

## 4. MVP scope

### Must have

1. **Game setup**
   - Choose 3–6 players.
   - Enter and validate unique, non-empty player names.
   - Start a new game and return to setup safely.

2. **Correct game loop**
   - Create and shuffle the deck.
   - Deal cards and rotate only through eligible players.
   - Let each active player choose **Hit** or **Stay**.
   - Detect duplicate numbers, use Second Chance when available, and bust when appropriate.
   - Detect seven unique number cards and award the Flip 7 bonus.
   - Handle an exhausted deck without freezing the UI.

3. **Special cards**
   - Apply additive and multiplier scoring cards.
   - Resolve Freeze, Flip Three, and Second Chance.
   - Show a target picker when an action requires another player.
   - Display a short event message so everyone understands the result.

4. **Scoring and progression**
   - Calculate a player’s round score from number cards and modifiers.
   - Give busted players zero for the round.
   - Maintain totals across rounds.
   - Show a round summary before continuing.
   - End the game at the verified threshold and announce the winner or tie.

5. **Usable interface**
   - Responsive layout for phone, tablet, and desktop.
   - Clear active, stayed, frozen, busted, and Flip 7 states.
   - Disabled controls during animations and automatic effects.
   - Rules/help panel containing a concise explanation.
   - New-game confirmation to prevent accidental data loss.

6. **Release quality**
   - No lint or TypeScript errors.
   - Automated tests cover the rule engine.
   - Production build succeeds.
   - Core game can be completed in supported browsers without console errors.
   - Public assets and branding are safe to distribute.

### Not in the first MVP

- Online rooms or real-time multiplayer
- User accounts, authentication, or cloud saves
- Computer-controlled players
- Matchmaking, chat, or leaderboards
- Payments or advertising
- Native mobile apps
- Advanced animation and sound settings
- Localization

These are candidates for later releases and should not delay the first playable deployment.

## 5. Technical approach

### Separate game rules from the UI

Move rule logic out of `app/page.tsx` into a small, deterministic game module:

```text
app/
├── game/
│   ├── cards.ts          # Card definitions and deck creation
│   ├── reducer.ts        # State transitions
│   ├── rules.ts          # Bust, Flip 7, actions, and targeting
│   ├── scoring.ts        # Round and total score calculations
│   └── types.ts          # Card, player, phase, and event types
├── components/
│   ├── GameSetup.tsx
│   ├── GameBoard.tsx
│   ├── PlayerArea.tsx
│   ├── GameControls.tsx
│   ├── TargetPicker.tsx
│   └── ResultsDialog.tsx
└── page.tsx              # Composes setup and game screens
```

Use discriminated unions rather than strings that can be accidentally coerced:

```ts
type Card =
  | { id: string; kind: "number"; value: number }
  | { id: string; kind: "modifier"; value: 2 | 4 | 6 | 8 | 10 }
  | { id: string; kind: "multiplier"; value: 2 }
  | { id: string; kind: "action"; action: "freeze" | "flip-three" | "second-chance" };
```

Represent game flow explicitly:

```text
setup → player-turn → action-targeting → round-results
                    ↘ bust / stay / flip-7 ↗
round-results → next-round or game-results
```

A reducer should own transitions so dealing, busting, staying, actions, and scoring happen atomically. Animations should respond to game state rather than control the rules with timers.

### Testing strategy

Add unit tests for:

- Deck composition and shuffle invariants
- Duplicate-number detection
- Second Chance consumption
- Flip Three interruption and bust cases
- Freeze target eligibility
- Seven unique number detection
- Additive and multiplier scoring order
- Stayed, frozen, and busted player rotation
- Round completion
- Game winner and tie calculation

Add one browser-level smoke test for the happy path: setup → draw/stay → round result → next round/new game. Keep random behavior injectable or seedable so tests are repeatable.

## 6. Delivery milestones

### Milestone 0 — Rules and product decisions

**Estimated effort:** 0.5 day

- Write the rule matrix from the physical rulebook or another authorized rules source.
- Confirm target score and tie behavior.
- Confirm 3–6 players and local pass-and-play as the launch format.
- Decide whether the initial deployment is a private demo or public release.
- Audit card artwork, game name, and logo usage.

**Exit criteria:** no unresolved rule or asset-rights question can change the state model.

### Milestone 1 — Game engine foundation

**Estimated effort:** 1–1.5 days

- Introduce explicit card and player types.
- Create pure deck, rule, and scoring functions.
- Replace scattered state with a reducer and explicit phases.
- Implement Hit, Stay, bust, eligible-player rotation, and round completion.
- Fix current lint errors and remove debug logging.

**Exit criteria:** a complete number-card-only round works and core functions have tests.

### Milestone 2 — Complete rules and scoring

**Estimated effort:** 1.5–2 days

- Implement modifiers and scoring.
- Implement Second Chance, Freeze, and Flip Three.
- Add target selection and automatic action resolution.
- Add multiple rounds, total scores, the win threshold, and ties.
- Cover action-card edge cases with tests.

**Exit criteria:** a full game can reach a correct winner without manual intervention.

### Milestone 3 — MVP user experience

**Estimated effort:** 1–1.5 days

- Add game setup and player names.
- Rework the board into a responsive layout.
- Add clear player status and event feedback.
- Add rules/help, round results, game results, and confirmation dialogs.
- Improve keyboard, touch, contrast, and screen-reader behavior.
- Correct metadata and add a social sharing image.

**Exit criteria:** the game is understandable and playable at 360 px mobile width and on desktop.

### Milestone 4 — Release and deployment

**Estimated effort:** 0.5–1 day

- Run lint, tests, type checking, and the production build.
- Smoke-test the production server in Chrome, Safari, Firefox, and a mobile viewport.
- Run a Lighthouse check and fix serious accessibility or performance regressions.
- Connect the repository to Vercel.
- Verify a preview deployment before promoting it to production.
- Configure the production domain if one is available.
- Complete a production smoke test and document rollback.

**Exit criteria:** all launch gates pass and the production URL completes a full game.

**Total estimate:** approximately 5–7 focused development days, excluding artwork licensing or major rule changes.

## 7. Deployment plan

The route is currently statically prerendered and needs no database or secrets. Vercel’s verified Next.js integration is the lowest-risk first deployment:

1. Push a release branch to the Git repository.
2. Import the repository into Vercel as a Next.js project.
3. Use `npm run build`; no environment variables are currently needed.
4. Treat branch deployments as previews.
5. Run the launch checklist against the preview URL.
6. Merge or promote the approved version to production.
7. Verify the production URL and keep the previous deployment available for rollback.

Static export is possible for this client-only app, but it adds no immediate MVP benefit on Vercel. Keep the standard Next.js build so future server features remain available.

### Suggested automated checks

Run these for every pull request and production release:

```bash
npm run lint
npm run test
npm run build
```

Add a test script when the test runner is introduced. Deployment should stop if any required check fails.

## 8. MVP launch gate

The MVP is ready to deploy only when all answers are **yes**:

- [ ] Can 3–6 named players start a game without refreshing?
- [ ] Do Hit and Stay always advance to the correct eligible player?
- [ ] Are duplicate numbers, Second Chance, and Flip 7 handled correctly?
- [ ] Do all action and modifier cards follow the approved rule matrix?
- [ ] Are round scores, total scores, winners, and ties correct?
- [ ] Can users finish a complete game on both phone and desktop?
- [ ] Are controls keyboard-accessible and understandable without color alone?
- [ ] Are public artwork and branding cleared for use?
- [ ] Does lint pass with no errors?
- [ ] Do automated rule tests pass?
- [ ] Does `npm run build` pass?
- [ ] Does the preview deployment pass the full-game smoke test?
- [ ] Is the production deployment and rollback path documented?

## 9. Recommended first implementation slice

Start with the smallest vertical slice that proves the architecture:

1. Add setup for three named players.
2. Build the typed number-card deck.
3. Implement reducer-driven Hit, Stay, bust, and round completion.
4. Calculate and show number-only round scores.
5. Add tests for those transitions.
6. Render the existing artwork through the new state model.

Once this slice works, add special cards one at a time. This creates a playable foundation early and makes each complex rule independently testable.

## References

- [Official Flip 7 product overview](https://theop.games/products/flip-7)
- The project’s bundled Next.js 16 deployment and production-checklist documentation
