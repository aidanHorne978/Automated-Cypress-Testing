"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Homepage() {
  return (
    <div className="min-h-screen w-full bg-white flex flex-col">
      {/* Top Navbar */}
      <nav className="w-full flex items-center justify-between px-8 py-4 shadow-sm bg-white/70 backdrop-blur-md fixed top-0 left-0 z-50">
        <div className="text-2xl font-bold">TestFlow AI</div>
        <div className="flex items-center gap-8 text-lg font-medium">
          <a href="#features" className="hover:text-gray-600">Features</a>
          <a href="#pricing" className="hover:text-gray-600">Pricing</a>
          <a href="#docs" className="hover:text-gray-600">Docs</a>
          <a href="#login" className="hover:text-gray-600">Login</a>
          <Button className="rounded-2xl px-6 py-2 text-base">Get Started</Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center px-8 pt-40 pb-20">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-5xl font-bold max-w-3xl leading-tight mb-6"
        >
          AI-Generated Cypress Tests for Teams Without QA
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-xl text-gray-600 max-w-2xl mb-10"
        >
          "Only 20% of small dev teams use automated testing — yet teams that do reduce bugs by up to 70%." 
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden border"
        >
          {/* Replace with your GIF or Cypress video */}
          <img
            src="/cypress-demo.gif"
            alt="Cypress Test Demo"
            className="w-full h-auto object-cover"
          />
        </motion.div>
      </section>
    </div>
  );
}