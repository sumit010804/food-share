"use client";
import { motion } from "framer-motion";
import { FaAppleAlt, FaHandsHelping, FaRecycle, FaSmile } from "react-icons/fa";

export default function RotatingCycle() {
  return (
    <div className="flex justify-center items-center py-8">
      <motion.div
        className="relative w-64 h-64 border-4 border-green-500 rounded-full flex justify-center items-center"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
      >
        {/* Center message */}
        <div className="absolute text-xl font-semibold text-green-700">Donate Food</div>

        {/* Icons positioned in a circular layout */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 text-green-600 text-3xl">
          <FaAppleAlt />
        </div>

        <div className="absolute right-0 top-1/2 -translate-y-1/2 text-green-600 text-3xl">
          <FaHandsHelping />
        </div>

        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-green-600 text-3xl">
          <FaRecycle />
        </div>

        <div className="absolute left-0 top-1/2 -translate-y-1/2 text-green-600 text-3xl">
          <FaSmile />
        </div>
      </motion.div>
    </div>
  );
}
