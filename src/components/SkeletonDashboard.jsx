import React from 'react';

export default function SkeletonDashboard({ publicMode = false }) {
  return (
    <div className="min-h-screen w-full font-sans text-[#3f5361] py-0 md:py-6 px-0 sm:px-3 md:px-6 lg:px-8 xl:px-12 flex flex-col justify-start items-center animate-pulse">
      <div className="w-full max-w-6xl bg-[#123a54] backdrop-blur-xl shadow-2xl rounded-none md:rounded-[28px] border-none overflow-hidden min-h-screen md:min-h-0">

        {/* ── HEADER SKELETON ────────────────────────────────────────── */}
        <header className="bg-gradient-to-r from-[#123a54] to-[#1f6f94] text-white px-3 sm:px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 shimmer flex-shrink-0" />
            <div className="space-y-2">
              <div className="h-5 w-36 bg-white/25 rounded-md shimmer" />
              <div className="h-3 w-48 bg-white/15 rounded-md shimmer" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-7 w-24 bg-white/20 rounded-full shimmer" />
            <div className="h-7 w-28 bg-white/15 rounded-full shimmer hidden sm:block" />
          </div>
        </header>

        {/* ── MAIN GRID SKELETON ──────────────────────────────────────── */}
        <main className="bg-[#f4f7f8] px-3 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

          {/* LEFT COLUMN (7/12 width) */}
          <div className="lg:col-span-7 space-y-4">

            {/* HERO STATUS CARD SKELETON */}
            <div className="bg-white rounded-[24px] border border-[#e4edf0] p-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-center shadow-sm">
              <div className="space-y-3">
                <div className="h-4 w-28 bg-[#eef4f6] rounded-full shimmer" />
                <div className="h-8 w-3/4 bg-[#eef4f6] rounded-lg shimmer" />
                <div className="h-4 w-full bg-[#eef4f6] rounded-md shimmer" />
                <div className="h-4 w-5/6 bg-[#eef4f6] rounded-md shimmer" />
                <div className="flex gap-4 pt-2">
                  <div className="h-4 w-24 bg-[#eef4f6] rounded-md shimmer" />
                  <div className="h-4 w-28 bg-[#eef4f6] rounded-md shimmer" />
                </div>
              </div>
              <div className="flex flex-col items-center justify-center">
                <div className="w-[104px] h-[150px] sm:w-[120px] sm:h-[160px] rounded-[32px] bg-[#eef4f6] border-4 border-[#dbe4de] shimmer" />
              </div>
            </div>

            {/* STAT CARDS SKELETON */}
            <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-[#e4edf0] shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="h-3 w-16 bg-[#eef4f6] rounded shimmer" />
                    <div className="w-7 h-7 bg-[#eef4f6] rounded-lg shimmer" />
                  </div>
                  <div className="h-6 w-20 bg-[#eef4f6] rounded-md shimmer" />
                  <div className="h-3 w-24 bg-[#eef4f6] rounded shimmer" />
                  <div className="h-1.5 w-full bg-[#eef4f6] rounded-full shimmer" />
                </div>
              ))}
            </div>

            {/* LARGE CHART / CONTENT SKELETON */}
            <div className="bg-white rounded-2xl p-5 border border-[#e4edf0] shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-[#f1f5f6] pb-3">
                <div className="h-4 w-40 bg-[#eef4f6] rounded shimmer" />
                <div className="h-6 w-28 bg-[#eef4f6] rounded-lg shimmer" />
              </div>
              <div className="h-40 w-full bg-[#f8fafb] rounded-xl border border-[#eef2f3] shimmer flex items-end justify-around p-4">
                <div className="h-1/3 w-6 bg-[#eef4f6] rounded-t shimmer" />
                <div className="h-1/2 w-6 bg-[#eef4f6] rounded-t shimmer" />
                <div className="h-2/3 w-6 bg-[#eef4f6] rounded-t shimmer" />
                <div className="h-3/4 w-6 bg-[#eef4f6] rounded-t shimmer" />
                <div className="h-1/2 w-6 bg-[#eef4f6] rounded-t shimmer" />
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN (5/12 width) */}
          <div className="lg:col-span-5 space-y-4">

            {/* WEATHER MAP SKELETON */}
            <div className="bg-white rounded-2xl border border-[#e4edf0] overflow-hidden shadow-sm">
              <div className="bg-[#123a54] p-3 flex justify-between items-center">
                <div className="h-4 w-28 bg-white/20 rounded shimmer" />
                <div className="h-5 w-20 bg-white/20 rounded-full shimmer" />
              </div>
              <div className="h-[340px] sm:h-[400px] bg-[#eef4f6] shimmer relative flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-[#123a54]/20 mx-auto shimmer" />
                  <div className="h-3 w-32 bg-[#123a54]/20 rounded mx-auto shimmer" />
                </div>
              </div>
            </div>

            {/* SECONDARY CARD SKELETON */}
            <div className="bg-white rounded-2xl p-5 border border-[#e4edf0] shadow-sm space-y-3">
              <div className="h-4 w-36 bg-[#eef4f6] rounded shimmer" />
              <div className="h-3 w-full bg-[#eef4f6] rounded shimmer" />
              <div className="h-3 w-4/5 bg-[#eef4f6] rounded shimmer" />
            </div>

          </div>

        </main>

        {/* ── FOOTER SKELETON ────────────────────────────────────────── */}
        <footer className="bg-gradient-to-r from-[#123a54] to-[#1f6f94] py-3.5 px-4 flex items-center justify-center">
          <div className="h-3 w-64 bg-white/20 rounded-md shimmer" />
        </footer>

      </div>
    </div>
  );
}
