import React, { useEffect } from 'react';
import { X, AlertTriangle, Radio, Layers, CloudRain, Phone, ExternalLink, Info, Globe, MapPin } from 'lucide-react';

export default function DataSourcesDisclaimerModal({ isOpen, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-all animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b2434] text-white w-full max-w-2xl rounded-2xl shadow-2xl border border-sky-500/30 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#123a54] px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#2b6e8f]/30 text-sky-300 border border-sky-400/30">
              <Info size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">Data Sources &amp; Official Disclaimers</h2>
              <p className="text-xs text-sky-200/70">Attribution for Satellite, Radar, Weather APIs &amp; Emergency Helplines</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-sky-200 hover:text-white transition cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-sky-100/90 leading-relaxed font-sans">
          
          {/* Section 1: Weather Radar & Satellite Sources */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-2 border-b border-white/10 pb-2.5">
              <Layers size={15} className="text-sky-300" />
              Satellite Imagery &amp; Weather Radar Sources
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* DOST-PAGASA */}
              <div className="bg-[#0e2a3e] p-4 rounded-xl border border-sky-500/20 hover:border-sky-500/40 transition-all h-full flex flex-col justify-between space-y-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Globe size={14} className="text-sky-300" /> DOST-PAGASA
                  </span>
                  <a 
                    href="https://meteopilipinas.gov.ph" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[11px] font-bold text-sky-300 hover:text-white hover:underline flex items-center gap-1"
                  >
                    Website <ExternalLink size={11} />
                  </a>
                </div>
                <p className="text-[11px] text-sky-200/70 leading-relaxed flex-grow">
                  Official Himawari-9 Infrared 24-hour geostationary satellite cloud sequence covering the Philippine Area of Responsibility (PAR).
                </p>
              </div>

              {/* RainViewer Radar */}
              <div className="bg-[#0e2a3e] p-4 rounded-xl border border-sky-500/20 hover:border-sky-500/40 transition-all h-full flex flex-col justify-between space-y-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Radio size={14} className="text-sky-300" /> RainViewer API
                  </span>
                  <a 
                    href="https://www.rainviewer.com" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[11px] font-bold text-sky-300 hover:text-white hover:underline flex items-center gap-1"
                  >
                    Website <ExternalLink size={11} />
                  </a>
                </div>
                <p className="text-[11px] text-sky-200/70 leading-relaxed flex-grow">
                  Real-time ground Doppler weather radar precipitation mosaics and short-term nowcast reflectivity maps for Rizal Province.
                </p>
              </div>

              {/* OpenWeatherMap */}
              <div className="bg-[#0e2a3e] p-4 rounded-xl border border-sky-500/20 hover:border-sky-500/40 transition-all h-full flex flex-col justify-between space-y-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    <CloudRain size={14} className="text-sky-300" /> OpenWeather API
                  </span>
                  <a 
                    href="https://openweathermap.org" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[11px] font-bold text-sky-300 hover:text-white hover:underline flex items-center gap-1"
                  >
                    Website <ExternalLink size={11} />
                  </a>
                </div>
                <p className="text-[11px] text-sky-200/70 leading-relaxed flex-grow">
                  Atmospheric weather metrics including temperature, relative humidity, barometric pressure, and regional rain forecasts.
                </p>
              </div>

              {/* CartoDB & OpenStreetMap */}
              <div className="bg-[#0e2a3e] p-4 rounded-xl border border-sky-500/20 hover:border-sky-500/40 transition-all h-full flex flex-col justify-between space-y-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    <MapPin size={14} className="text-sky-300" /> CartoDB &amp; OSM
                  </span>
                  <a 
                    href="https://carto.com" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[11px] font-bold text-sky-300 hover:text-white hover:underline flex items-center gap-1"
                  >
                    Website <ExternalLink size={11} />
                  </a>
                </div>
                <p className="text-[11px] text-sky-200/70 leading-relaxed flex-grow">
                  Dark Matter base map tile layers provided by CartoDB and OpenStreetMap open-source mapping contributors.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Emergency Contact Directory Attribution */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-2 border-b border-white/10 pb-2.5">
              <Phone size={15} className="text-sky-300" />
              Emergency Contact Hotline Sources
            </h3>
            <div className="bg-[#0e2a3e] p-4 rounded-xl border border-sky-500/20 space-y-2">
              <p className="text-[11px] text-sky-200/80 leading-relaxed">
                Emergency telephone numbers and helpline contacts listed across the platform are compiled directly from public emergency directories issued by:
              </p>
              <ul className="list-disc list-inside text-[11px] text-sky-300/90 space-y-1 font-mono">
                <li><strong className="text-white">Antipolo City CDRRMO</strong> (City Disaster Risk Reduction and Management Office)</li>
                <li><strong className="text-white">Rizal Provincial DRRMO</strong> &amp; Regional Disaster Risk Reduction Council</li>
                <li><strong className="text-white">Bureau of Fire Protection (BFP)</strong> &amp; Philippine National Police (PNP) Antipolo Station</li>
                <li><strong className="text-white">Philippine Red Cross (PRC)</strong> Rizal Chapter</li>
              </ul>
            </div>
          </div>

          {/* Section 3: Academic & Research Safety Disclaimer */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2 border-b border-white/10 pb-2.5">
              <AlertTriangle size={15} className="text-amber-400" />
              System Usage &amp; Academic Research Disclaimer
            </h3>
            <div className="bg-amber-500/10 border-2 border-amber-500/40 p-4 rounded-xl space-y-2 text-amber-100/90 shadow-sm">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                <span>Academic Prototype Notice</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                SmartFlood is an IoT micro-hydrological research prototype developed for capstone research and public disaster risk reduction demonstration.
              </p>
              <p className="text-[11px] leading-relaxed">
                While hardware telemetry, ONNX LSTM machine learning models, and satellite integrations are updated in real time, official evacuation directives during emergency flood events should always follow announcements issued by DOST-PAGASA, NDRRMC, and Antipolo City CDRRMO.
              </p>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-[#123a54] px-6 py-3.5 border-t border-white/10 flex items-center justify-between text-xs text-sky-200/60 font-mono">
          <span>SmartFlood · Capstone Project 2026</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#2b6e8f] hover:bg-[#1f6f94] text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
