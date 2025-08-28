"use client";
import React from "react";
import Link from "next/link";
import CommunityFeed from "./feed";

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-white/90 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6 text-emerald-700">Community</h1>
        <CommunityFeed />
        <div className="grid md:grid-cols-2 gap-8">
          <section className="bg-emerald-50 rounded-xl p-6 shadow-md">
            <h2 className="text-2xl font-semibold mb-2 text-emerald-800">Discussion Forums</h2>
            <p className="text-slate-600 mb-4">Join topic-based threads and Q&A.</p>
            <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">View Forums</button>
          </section>
          <section className="bg-emerald-50 rounded-xl p-6 shadow-md">
            <h2 className="text-2xl font-semibold mb-2 text-emerald-800">Events & Meetups</h2>
            <p className="text-slate-600 mb-4">See upcoming events and RSVP.</p>
            <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">View Events</button>
          </section>
        </div>
        <div className="grid md:grid-cols-2 gap-8 mt-8">
          <section className="bg-emerald-50 rounded-xl p-6 shadow-md">
            <h2 className="text-2xl font-semibold mb-2 text-emerald-800">Resources & Guides</h2>
            <p className="text-slate-600 mb-4">Find articles, FAQs, and best practices.</p>
            <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">View Resources</button>
          </section>
          <section className="bg-emerald-50 rounded-xl p-6 shadow-md">
            <h2 className="text-2xl font-semibold mb-2 text-emerald-800">Leaderboard & Badges</h2>
            <p className="text-slate-600 mb-4">See top contributors and earn badges.</p>
            <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">View Leaderboard</button>
          </section>
        </div>
        <div className="mt-8 grid md:grid-cols-2 gap-8">
          <section className="bg-emerald-50 rounded-xl p-6 shadow-md">
            <h2 className="text-2xl font-semibold mb-2 text-emerald-800">Moderation & Reporting</h2>
            <p className="text-slate-600 mb-4">Report issues and view community guidelines.</p>
            <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">Report Issue</button>
          </section>
        </div>
      </div>
    </div>
  );
}
