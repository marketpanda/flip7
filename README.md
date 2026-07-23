# Flip 7 Card Game

A browser-based, local pass-and-play game inspired by the push-your-luck card game **Flip 7**. Draw unique numbers, bank your points before you bust, and race to 200.

![Flip 7 game board](./flip7.png)

## How to play

This version supports three to six players sharing one device:

1. Choose the player count, enter names, and start the game.
2. Deal one opening card to each player.
3. On your turn, choose **Hit** to draw or **Stay** to bank your points.
4. Drawing a duplicate number busts you for zero round points unless you have a Second Chance.
5. Seven unique number cards immediately end the round and award a 15-point bonus.
6. Continue playing rounds until one player has the unique highest score at 200 or more.

## Current features

- Shuffled deck with number cards from 0 to 12
- Setup for three to six named players
- Correct Hit, Stay, bust, and eligible-player rotation
- Duplicate-number detection
- Second Chance duplicate protection
- Freeze targeting and score banking
- Sequential Flip Three resolution
- `+2`, `+4`, `+6`, `+8`, `+10`, and `×2` scoring
- Flip 7 detection and 15-point bonus
- Multi-round totals, ties, and winner calculation
- Responsive phone, tablet, and desktop layout
- Keyboard focus states, semantic controls, and status announcements
- Automated tests for deck composition, scoring, turns, actions, and rounds

## Tech stack

- [Next.js](https://nextjs.org/) 16
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) 4
- [Vitest](https://vitest.dev/) for game-engine tests

## Getting started

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available scripts

```bash
npm run dev    # Start the development server
npm run build  # Create a production build
npm run start  # Run the production build
npm run lint   # Check the code with ESLint
npm run test   # Run the game-engine test suite
```

## Project structure

```text
app/
├── assets/cards/     # Number, action, modifier, and card-back artwork
├── components/       # Setup, board, player, card, and dialog UI
├── game/             # Typed deck, rules, scoring, reducer, and tests
├── globals.css       # Global styles and Tailwind setup
├── layout.tsx        # Root application layout
└── page.tsx          # Server-rendered route and client game boundary
```

## Roadmap

- Online rooms and real-time multiplayer
- Optional sound and richer card animations
- Saved games and player statistics
- Additional browser-level end-to-end tests
- Localization

## Disclaimer

This is an unofficial fan-made project created for learning and experimentation. Flip 7 and its associated trademarks belong to their respective owners.
