import Image, { type StaticImageData } from "next/image"
import card0 from "../assets/cards/card_0.png"
import card1 from "../assets/cards/card_1.png"
import card2 from "../assets/cards/card_2.png"
import card3 from "../assets/cards/card_3.png"
import card4 from "../assets/cards/card_4.png"
import card5 from "../assets/cards/card_5.png"
import card6 from "../assets/cards/card_6.png"
import card7 from "../assets/cards/card_7.png"
import card8 from "../assets/cards/card_8.png"
import card9 from "../assets/cards/card_9.png"
import card10 from "../assets/cards/card_10.png"
import card11 from "../assets/cards/card_11.png"
import card12 from "../assets/cards/card_12.png"
import cardPlus2 from "../assets/cards/card_+2.png"
import cardPlus4 from "../assets/cards/card_+4.png"
import cardPlus6 from "../assets/cards/card_+6.png"
import cardPlus8 from "../assets/cards/card_+8.png"
import cardPlus10 from "../assets/cards/card_+10.png"
import cardFlipThree from "../assets/cards/card_flip_three.png"
import cardFreeze from "../assets/cards/card_freeze.png"
import cardSecondChance from "../assets/cards/card_second_chance.png"
import cardX2 from "../assets/cards/card_x2.png"
import type { Card } from "../../packages/game-engine/types"

const numberImages: Record<number, StaticImageData> = {
  0: card0,
  1: card1,
  2: card2,
  3: card3,
  4: card4,
  5: card5,
  6: card6,
  7: card7,
  8: card8,
  9: card9,
  10: card10,
  11: card11,
  12: card12,
}

const modifierImages: Record<number, StaticImageData> = {
  2: cardPlus2,
  4: cardPlus4,
  6: cardPlus6,
  8: cardPlus8,
  10: cardPlus10,
}

const actionImages = {
  freeze: cardFreeze,
  "flip-three": cardFlipThree,
  "second-chance": cardSecondChance,
}

export function cardLabel(card: Card) {
  if (card.kind === "number") return `${card.value}`
  if (card.kind === "modifier") return `plus ${card.value}`
  if (card.kind === "multiplier") return "times two"
  return card.action.replace("-", " ")
}

function cardImage(card: Card) {
  if (card.kind === "number") return numberImages[card.value]
  if (card.kind === "modifier") return modifierImages[card.value]
  if (card.kind === "multiplier") return cardX2
  return actionImages[card.action]
}

interface CardFaceProps {
  card: Card
  compact?: boolean
  muted?: boolean
}

export default function CardFace({
  card,
  compact = false,
  muted = false,
}: CardFaceProps) {
  return (
    <div
      className={[
        "card-face relative shrink-0 overflow-hidden rounded-lg bg-slate-900 shadow-lg",
        compact ? "w-12 sm:w-14" : "w-16 sm:w-20",
        muted ? "opacity-50 grayscale" : "",
      ].join(" ")}
      title={cardLabel(card)}
    >
      <Image
        src={cardImage(card)}
        alt={`${cardLabel(card)} card`}
        fill
        sizes={compact ? "56px" : "80px"}
        className="object-cover"
      />
    </div>
  )
}
