"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

const MIN_FILLED_BOXES = 5
const MAX_FILLED_BOXES = 7
const TOTAL_BOXES = 9

export default function PriaLogo() {
  const [boxes, setBoxes] = useState<boolean[]>(Array(TOTAL_BOXES).fill(false))

  useEffect(() => {
    const interval = setInterval(() => {
      setBoxes((prevBoxes) => {
        const newBoxes = [...prevBoxes]
        const filledBoxes = newBoxes.filter(Boolean).length
        const targetFilledBoxes =
          Math.floor(Math.random() * (MAX_FILLED_BOXES - MIN_FILLED_BOXES + 1)) + MIN_FILLED_BOXES

        if (filledBoxes < targetFilledBoxes) {
          // Fill more boxes
          while (newBoxes.filter(Boolean).length < targetFilledBoxes) {
            const randomIndex = Math.floor(Math.random() * TOTAL_BOXES)
            newBoxes[randomIndex] = true
          }
        } else if (filledBoxes > targetFilledBoxes) {
          // Remove some filled boxes
          while (newBoxes.filter(Boolean).length > targetFilledBoxes) {
            const filledIndices = newBoxes.map((box, index) => (box ? index : -1)).filter((index) => index !== -1)
            const randomIndex = filledIndices[Math.floor(Math.random() * filledIndices.length)]
            newBoxes[randomIndex] = false
          }
        } else {
          // Swap some filled and empty boxes
          const swaps = Math.floor(Math.random() * 3) + 1 // 1 to 3 swaps
          for (let i = 0; i < swaps; i++) {
            const filledIndex = newBoxes.findIndex(Boolean)
            const emptyIndex = newBoxes.findIndex((box) => !box)
            if (filledIndex !== -1 && emptyIndex !== -1) {
              newBoxes[filledIndex] = false
              newBoxes[emptyIndex] = true
            }
          }
        }

        return newBoxes
      })
    }, 1000) // Update every second

    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      className="flex items-center gap-4 p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      {/* QR Code Grid */}
      <motion.div
        className="grid grid-cols-3 gap-1 h-12 w-12"
        whileHover={{ scale: 1.05 }}
        animate={{ scale: [1, 1.02, 1] }}
        transition={{
          repeat: Number.POSITIVE_INFINITY,
          duration: 2,
          ease: "easeInOut",
        }}
      >
        <AnimatePresence>
          {boxes.map((isFilled, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: isFilled ? 1 : 0,
                scale: isFilled ? 1 : 0.8,
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className={`${isFilled ? "bg-violet-600" : "bg-transparent"} rounded-sm`}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Logo Text */}
      <motion.div
        className="flex items-center"
        animate={{
          y: [0, -4, 0],
        }}
        transition={{
          repeat: Number.POSITIVE_INFINITY,
          duration: 3,
          ease: "easeInOut",
        }}
        whileHover={{
          scale: 1.02,
          y: -2,
        }}
      >
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-p2kMec05jtFv3HoJoedBNhY9EXeyMA.png"
          alt="PRIA"
          width={96}
          height={48}
          className="object-contain"
        />
      </motion.div>
    </motion.div>
  )
}
