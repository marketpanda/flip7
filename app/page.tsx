'use client'
import { useEffect, useRef, useState } from "react"; 
import { motion, AnimatePresence } from "motion/react";
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

const initializeDeck = ():DeckProps[] => {
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

const PLAYER_COUNT = 4

const shuffle = (orig:DeckProps[]) => {
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
      const valid = Array.from({ length: PLAYER_COUNT}, (_,i) =>  i).filter(n => !idlePlayers.includes(n))
      
      let next = prev

      do {
        next = (next + 1)  % PLAYER_COUNT        
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
  const getPlayerPos = (index: number) => {
    const radius = 260
    const angle = (Math.PI * 2 * index) / PLAYER_COUNT - Math.PI / 2
    // console.log('angle ', angle)
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    }
  }

  const checkDuplicateCards = (crds:Card[]) => {
    const seen = new Set<number | string>()
    

    for (const card of crds) {
      if (seen.has(card.label)) return true
      seen.add(card.label)
    }
    return false
  }

  useEffect(() => {
    console.log('cards ', cards) 
    if (!cards.length) return
    if (cards[cards.length - 1].playerIndex === currentPlayer && Number(cards[cards.length-1].label) > 5 ) {
      console.log('greater than 5 the latest label')
    }

    const playerCards = cards.filter(crd => crd.playerIndex === currentPlayer)
      // verifies a number
      .filter(c => Number(c.type) >= 0)
    console.log("playerCards ", playerCards)

    const hasDuplicate = checkDuplicateCards(playerCards)
    console.log('hasDuplicate ', hasDuplicate)
    if (hasDuplicate) {
      console.log(currentPlayer)
      setIdlePlayers(prev => {
        if (prev.includes(currentPlayer)) return prev
        return [...prev, currentPlayer]
      })
    }

    
  }, [cards])
  
  useEffect(() => {
    
    console.log('idlePlayers ', idlePlayers)
  }, [idlePlayers])
  return (
    <>
      <main>
        <div className="relative w-screen h-screen bg-slate-900 overflow-hidden">
          {/* Deck */}
          <div className="absolute left-1/2 top-1/2 w-2- h-28 bg-red-500 rounded-md -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-white">
           Deck ({deck.length})
          </div>

          {Array.from({ length: PLAYER_COUNT }).map((_, i) => {
            const pos = getPlayerPos(i)
            return (
              <div
                key ={i}
                className="absolute text-white font-bold transition-all"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  color: currentPlayer === i ? 'yellow' : 'white'
                }}
              >
                <span className="text-black text-3xl font-bold">Player {i + 1}</span>
                <div className="text-xs opacity-70">
                  {actions[i]}
                </div>
              </div>
            )
          })}

          {/* Cards */}
          <AnimatePresence>
              { cards.map((card, i) => {
                let ind = i
                const pos = getPlayerPos(card.playerIndex)
                // console.log('pos ', pos)
                // console.log('i ', i) 
                return (
                  <motion.div
                    key={card.id}
                    initial={{
                      x: 0, y: 0,
                      scale: 0.8, rotate: 0
                    }}
                    animate={{
                      x: pos.x + ((ind+1) * 20),
                      y: pos.y,
                      scale: 1, 
                    }}
                    transition={{
                      duration: 0.45, ease:'easeInOut'
                    }}
                    className="absolute left-1/2 top-1/2 w-20 h-28 bg-white rounded-md flex items-center justify-center font-bold"
                  >
                    { card.label }
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
              Current Player: { currentPlayer + 1}
            </div>

          </div>
        </div>
      </main>
    </>
      
      
  );
}
