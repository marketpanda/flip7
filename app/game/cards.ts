import { nanoid } from "nanoid"
import type {
  ActionCard,
  ActionName,
  Card,
  ModifierCard,
  MultiplierCard,
  NumberCard,
} from "./types"

export function numberCard(value: number, id = nanoid()): NumberCard {
  return { id, kind: "number", value }
}

export function modifierCard(
  value: ModifierCard["value"],
  id = nanoid(),
): ModifierCard {
  return { id, kind: "modifier", value }
}

export function multiplierCard(id = nanoid()): MultiplierCard {
  return { id, kind: "multiplier", value: 2 }
}

export function actionCard(action: ActionName, id = nanoid()): ActionCard {
  return { id, kind: "action", action }
}

export function createDeck(): Card[] {
  const numbers = Array.from({ length: 12 }, (_, index) => 12 - index).flatMap(
    (value) =>
      Array.from({ length: value }, () => numberCard(value)),
  )

  return [
    numberCard(0),
    ...numbers,
    modifierCard(2),
    modifierCard(4),
    modifierCard(6),
    modifierCard(8),
    modifierCard(10),
    multiplierCard(),
    ...Array.from({ length: 3 }, () => actionCard("freeze")),
    ...Array.from({ length: 3 }, () => actionCard("flip-three")),
    ...Array.from({ length: 3 }, () => actionCard("second-chance")),
  ]
}

export function shuffleDeck(cards: Card[], random = Math.random): Card[] {
  const shuffled = [...cards]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ]
  }

  return shuffled
}
