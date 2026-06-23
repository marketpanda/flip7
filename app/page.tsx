'use client'
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, number } from "motion/react";
import { nanoid } from 'nanoid'


type PlayerAction = 'idle' | 'take' | 'skip'

interface Card {
  id: number | string,
  playerIndex: number,
  label: string | number
  type: number | string,
}
const Actions = {
  freeze: 'freeze',
  secondChance: 'secondChance',
  flip3: 'flip3'
} as const
type Actions = typeof Actions[keyof typeof Actions]

const Modifiers = {
  "+2": "+2",
  "+4": "+4",
  "+6": "+6",
  "+8": "+8",
  "+10": "+10",
  x2: "x2",
} as const

type Modifiers = typeof Modifiers[keyof typeof Modifiers]

interface DeckProps {
  id: string,
  label: string | number
  cardType: number | Modifiers | Actions
}

const initializeDeck = (): DeckProps[] => {
  const modifiersCards = [
    { id: nanoid(), label: "+2", cardType: Modifiers["+2"] },
    { id: nanoid(), label: "+4", cardType: Modifiers["+4"] },
    { id: nanoid(), label: "+6", cardType: Modifiers["+6"] },
    { id: nanoid(), label: "+8", cardType: Modifiers["+8"] },
    { id: nanoid(), label: "+10", cardType: Modifiers["+10"] },
    { id: nanoid(), label: "x2", cardType: Modifiers.x2 }
  ]

  const numberCards = Array.from(
    { length: 12 },
    (_, index) => 12 - index
  ).flatMap(num =>
    Array.from({ length: num }, () => ({
      id: nanoid(),
      label: num,
      cardType: num
    }))
  )

  const threeZeroes = Array.from(
    { length: 1 },
    (_, index) => ({
      id: nanoid(),
      label: 0,
      cardType: 0
    })
  )

  const actionCards = [
    ...Array.from(
      { length: 3 },
      () => ({
        id: nanoid(),
        label: "Freeze",
        cardType: Actions.freeze
      })
    ),
    ...Array.from(
      { length: 3 },
      () => ({
        id: nanoid(),
        label: "Flip Three",
        cardType: Actions.flip3
      })
    ),
    ...Array.from(
      { length: 3 },
      () => ({
        id: nanoid(),
        label: "Second Chance",
        cardType: Actions.secondChance
      })
    )
  ]

  const merged = [
    ...actionCards,
    ...modifiersCards,
    ...numberCards,
    ...threeZeroes
  ]

  return merged
}

const PLAYER_COUNT = 3
const PLAYER_COUNT2 = 6

const shuffle = (orig: DeckProps[]) => {
  const mergedItems = [...orig]
  for (let i = mergedItems.length - 1; i > 0; i--) {
    const random = Math.floor(Math.random() * (i + 1));
    [mergedItems[i], mergedItems[random]] = [mergedItems[random], mergedItems[i]]
  }
  return mergedItems
}

export default function Home() {
  const [deck, setDeck] = useState<DeckProps[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [currentPlayer, setCurrentPlayer] = useState(0)
  const [idlePlayers, setIdlePlayers] = useState<number[]>([])
  const [actions, setActions] = useState<PlayerAction[]>(Array(PLAYER_COUNT).fill('idle'))

  const [isOpenModal, setIsOpenModal] = useState(false)

  const chunk = (arr: any, size: number) => {
    const result = []
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size))
    }
    return result
  }

  const buildRows = (players: number[]) => {
    const n = players.length
    if (n <= 4) return chunk(players, 2)
    if (n === 5) return [players.slice(0, 3), players.slice(3)]
    return chunk(players, 3)

  }

  const buildPositionmap = (rows: number[][]) => {
    const map = new Map<number, { row: number; col: number }>()
    rows.forEach((row, rowIndex) => {
      row.forEach((playerIndex, colIndex) => {
        map.set(playerIndex, { row: rowIndex, col: colIndex })
      })
    })
    return map
  }

  const players = useMemo(
    () => Array.from({ length: PLAYER_COUNT2 }, (_, i) => i),
    []
  )

  const rows = useMemo(() => buildRows(players), [players])

  const positionMap = useMemo(() => buildPositionmap(rows), [rows])

  const servingRef = useRef(false)

  useEffect(() => {
    const generateDeck = initializeDeck()
    const getShuffled = shuffle(generateDeck)

    console.log('getShuffled ', getShuffled)
    setDeck(getShuffled)
  }, [])


  const dealCard = (playerIndex: number) => {

    setDeck(prevDeck => {
      if (!prevDeck.length) return prevDeck

      const [topCard, ...rest] = prevDeck
      console.log("topCard", topCard)
      queueMicrotask(() => {
        setCards(prevCards => [
          ...prevCards,
          { id: topCard.id, label: topCard.label, playerIndex, type: topCard.cardType }
        ])
      })

      return rest
    })

  }

  const nextTurn = () => {

    setCurrentPlayer((prev) => {
      const valid = Array.from({ length: PLAYER_COUNT }, (_, i) => i).filter(n => !idlePlayers.includes(n))

      let next = prev

      do {
        next = (next + 1) % PLAYER_COUNT
      } while (!valid.includes(next))
      return next
    })
  }

  const evaluatePlayerCards = (pCards: Card[], currP: number) => {
    const playerCards = pCards.filter(pCard => pCard.playerIndex === currP)

    return playerCards
  }


  const handleAction = (action: PlayerAction) => {
    if (servingRef.current) return

    servingRef.current = true
    setActions(prev => {
      const updated = [...prev]
      updated[currentPlayer] = action
      return updated
    })



    const pCards = evaluatePlayerCards(cards, currentPlayer)
    if (action === 'take' && pCards.length < 7) {
      console.log('current p cards', pCards)
      dealCard(currentPlayer)
    }



    setTimeout(() => {
      nextTurn()
      servingRef.current = false
    }, 300)
  }



  const checkDuplicateCards = (crds: Card[]) => {
    const seen = new Set<number | string>()

    for (const card of crds) {
      if (seen.has(card.label)) return true
      seen.add(card.label)
    }
    return false
  }

  useEffect(() => {
    if (!cards.length) return
    if (cards[cards.length - 1].playerIndex === currentPlayer && Number(cards[cards.length - 1].label) > 5) {
      console.log('greater than 5 the latest label')
    }

    const playerCards = cards.filter(crd => crd.playerIndex === currentPlayer)
      // verifies a number
      .filter(c => Number(c.type) >= 0)

    const hasDuplicate = checkDuplicateCards(playerCards)
    if (hasDuplicate) {
      console.log(currentPlayer)
      setIdlePlayers(prev => {
        if (prev.includes(currentPlayer)) return prev
        return [...prev, currentPlayer]
      })
    }
  }, [cards])

  const resetGame = () => {
    setIdlePlayers([])
    setActions(Array.from({ length: PLAYER_COUNT }, () => "idle"))
    setCards([])
    const generateDeck = initializeDeck()
    const getShuffled = shuffle(generateDeck)
    setDeck(getShuffled)
    setIsOpenModal(false)
  }



  useEffect(() => {
    setIsOpenModal(idlePlayers.length === PLAYER_COUNT - 1)
  }, [idlePlayers])
  const Modal = () => {
    return (

      <>
        {
          isOpenModal && (

            <div className="fixed inset-0 flex items-center justify-center z-50">
              <div className="bg-white w-[400px] h-52 rounded-md">
                <div className="p-2 bg-neutral-100">
                  <div>
                    <button
                      onClick={resetGame}
                      className="bg-amber-600 px-2 py-1 rounded text-white">
                      reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      </>
    )
  }


  return (
    <>

      {isOpenModal ? <Modal /> : null}
      <main>
        <div className="relative w-screen h-screen bg-fuchsia-100 overflow-hidden border-amber-300 border-2">
          {/* Deck */}
          <div className="absolute left-1/2 bottom-0 w-2- h-28 bg-red-500 rounded-md -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-white">
            Deck ({deck.length})
          </div>

          {Array.from({ length: PLAYER_COUNT }).map((_, i) => {
            const pos = positionMap.get(i)
            if (!pos) return null

            const { row, col } = pos

            const rowCount = rows.length
            const colCount = rows[row].length

            const xSpacing = 400
            const ySpacing = 400

            const x =
              (col - (colCount - 1) / 2) * xSpacing

            const y =
              (row - (rowCount - 1) / 2) * ySpacing - 80

            return (
              <div
                key={i}
                className="absolute font-bold transition-all border-2 border-red-700 px-2 py-1 rounded"
                style={{
                  left: "50%",
                  top: "50%",
                  transform: `translate(${x}px, ${y}px)`,
                  color: currentPlayer === i ? "yellow" : "white",
                }}
              >
                <div className="text-black text-2xl">
                  Player {i + 1}
                </div>

                <div className="text-xs opacity-70 tex">
                  {actions[i]}
                </div>
              </div>
            )
          })}
          {/* Cards */}

          <AnimatePresence>
            {cards.map((card, i) => {
              let ind = i
              // const pos = getPlayerPos(card.playerIndex)

              const pos = positionMap.get(card.playerIndex)
              if (!pos) return null

              const { row, col } = pos

              const rowCount = rows.length
              const colCount = rows[row].length

              const xSpacing = 400
              const ySpacing = 400

              const x =
                (col - (colCount - 1) / 2) * xSpacing
              const y =
                (row - (rowCount - 1) / 2) * ySpacing

              const CARDS_PER_ROW = 4

              const lastPlayerCountCard = cards.filter(crd => crd.playerIndex ===
                cards.at(-1)?.playerIndex).length
              console.log("lastPlayerCountCard ", lastPlayerCountCard)


              const playerCards = cards.filter(c => c.playerIndex === card.playerIndex)
              const cardIndexInHand = playerCards.findIndex(c => c.id === card.id)

              const rowOffset = Math.floor(cardIndexInHand / CARDS_PER_ROW)
              const colOffset = cardIndexInHand % CARDS_PER_ROW
              return (
                <motion.div
                  key={card.id}
                  initial={{
                    x: 0, y: 0,
                    scale: 0.5, rotate: 0
                  }}
                  animate={{
                    x: x + colOffset * 88,
                    y: y + rowOffset * 120,
                    scale: 1,
                  }}
                  transition={{
                    duration: 0.45, ease: 'easeInOut'
                  }}
                  className="border-amber-400 border-2 absolute left-1/2 top-1/2
                    w-20 h-28 bg-white rounded-md flex items-center justify-center font-bold"
                >
                  {card.label}
                </motion.div>
              )
            })}

          </AnimatePresence>


          {/* Controls (simulate player decision) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4">
            <button onClick={() => handleAction('take')}
              className="px-4 py-2 bg-green-500 rounded text-white">
              Get Card
            </button>
            <button onClick={() => handleAction('skip')}
              className="px-4 py-2 bg-gray-500 rounded text-white">
              Skip
            </button>

            {/* Current turn indicator */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white">
              Current Player: {currentPlayer + 1}
            </div>

          </div>
        </div>
      </main>
    </>


  );
}
