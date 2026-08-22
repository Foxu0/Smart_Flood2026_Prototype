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
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-[#123a54] text-[#123a54] rounded-2xl shadow-2xl border border-[#123a54] overflow-hidden flex flex-col max-h-[85vh]"
        style={{ width: '90%', maxWidth: '520px', margin: '0 auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header (Dark Navy to match app header theme) */}
        <div className="bg-[#123a54] text-white px-4 py-3 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#2b6e8f]/40 text-sky-200 border border-sky-400/20">
              <Info size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">Data Sources &amp; Official Disclaimers</h2>
              <p className="text-[10px] text-sky-200/80">Attribution for Satellite, Radar &amp; Emergency Helplines</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sky-200 hover:text-white transition cursor-pointer"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content Body (Clean Web Light Theme) */}
        <div className="bg-[#f8fafc] p-4 overflow-y-auto space-y-4 text-xs font-sans">
          
          {/* Section 1: Weather Radar & Satellite Sources */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold text-[#123a54] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#e2e8f0] pb-1.5">
              <Layers size={13} className="text-[#2b6e8f]" />
              Satellite Imagery &amp; Weather Radar Sources
            </h3>
            
            <div className="grid grid-cols-1 gap-2">
              {/* DOST-PAGASA */}
              <div className="bg-white p-2.5 rounded-xl border border-[#e2e8f0] shadow-xs space-y-1">
                <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1">
                  <span className="font-bold text-[#123a54] text-[11px] flex items-center gap-1.5">
                    <Globe size={13} className="text-[#2b6e8f]" /> DOST-PAGASA
                  </span>
                  <a 
                    href="https://meteopilipinas.gov.ph" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] font-bold text-[#2b6e8f] hover:underline flex items-center gap-0.5"
                  >
                    Website <ExternalLink size={10} />
                  </a>
                </div>
                <p className="text-[10px] text-[#506370] leading-snug">
                  Official Himawari-9 Infrared 24-hour geostationary satellite cloud sequence covering the Philippine Area of Responsibility (PAR).
                </p>
              </div>

              {/* RainViewer Radar */}
              <div className="bg-white p-2.5 rounded-xl border border-[#e2e8f0] shadow-xs space-y-1">
                <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1">
                  <span className="font-bold text-[#123a54] text-[11px] flex items-center gap-1.5">
                    <Radio size={13} className="text-[#2b6e8f]" /> RainViewer API
                  </span>
                  <a 
                    href="https://www.rainviewer.com" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] font-bold text-[#2b6e8f] hover:underline flex items-center gap-0.5"
                  >
                    Website <ExternalLink size={10} />
                  </a>
                </div>
                <p className="text-[10px] text-[#506370] leading-snug">
                  Real-time ground Doppler weather radar precipitation mosaics and short-term nowcast reflectivity maps for Rizal Province.
                </p>
              </div>

              {/* OpenWeatherMap */}
              <div className="bg-white p-2.5 rounded-xl border border-[#e2e8f0] shadow-xs space-y-1">
                <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1">
                  <span className="font-bold text-[#123a54] text-[11px] flex items-center gap-1.5">
                    <CloudRain size={13} className="text-[#2b6e8f]" /> OpenWeather API
                  </span>
                  <a 
                    href="https://openweathermap.org" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] font-bold text-[#2b6e8f] hover:underline flex items-center gap-0.5"
                  >
                    Website <ExternalLink size={10} />
                  </a>
                </div>
                <p className="text-[10px] text-[#506370] leading-snug">
                  Atmospheric weather metrics including temperature, relative humidity, barometric pressure, and regional rain forecasts.
                </p>
              </div>

              {/* CartoDB & OpenStreetMap */}
              <div className="bg-white p-2.5 rounded-xl border border-[#e2e8f0] shadow-xs space-y-1">
                <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1">
                  <span className="font-bold text-[#123a54] text-[11px] flex items-center gap-1.5">
                    <MapPin size={13} className="text-[#2b6e8f]" /> CartoDB &amp; OSM
                  </span>
                  <a 
                    href="https://carto.com" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] font-bold text-[#2b6e8f] hover:underline flex items-center gap-0.5"
                  >
                    Website <ExternalLink size={10} />
                  </a>
                </div>
                <p className="text-[10px] text-[#506370] leading-snug">
                  Dark Matter base map tile layers provided by CartoDB and OpenStreetMap open-source mapping contributors.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Emergency Contact Directory Attribution */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold text-[#123a54] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#e2e8f0] pb-1.5">
              <Phone size={13} className="text-[#2b6e8f]" />
              Emergency Contact Hotline Sources
            </h3>
            <div className="bg-white p-2.5 rounded-xl border border-[#e2e8f0] shadow-xs space-y-1 text-[10px] text-[#506370]">
              <p className="leading-relaxed">
                Emergency telephone numbers and helpline contacts listed across the platform are compiled directly from public emergency directories issued by:
              </p>
              <ul className="list-disc list-inside space-y-0.5 font-mono text-[#123a54]">
                <li><strong>Antipolo City CDRRMO</strong> (City Disaster Risk Reduction and Management Office)</li>
                <li><strong>Rizal Provincial DRRMO</strong> &amp; Regional Disaster Risk Reduction Council</li>
                <li><strong>Bureau of Fire Protection (BFP)</strong> &amp; PNP Antipolo Station</li>
                <li><strong>Philippine Red Cross (PRC)</strong> Rizal Chapter</li>
              </ul>
            </div>
          </div>

          {/* Section 3: Academic & Research Safety Disclaimer */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-amber-200 pb-1.5">
              <AlertTriangle size={13} className="text-amber-600" />
              System Usage &amp; Academic Research Disclaimer
            </h3>
            <div className="bg-amber-50 border border-amber-200/80 p-2.5 rounded-xl space-y-1 text-amber-950 text-[10px] shadow-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                <span>Academic Prototype Notice</span>
              </div>
              <p className="leading-relaxed">
                SmartFlood is an IoT micro-hydrological research prototype developed for capstone research and public disaster risk reduction demonstration.
              </p>
              <p className="leading-relaxed text-amber-900/90">
                While hardware telemetry, ONNX LSTM machine learning models, and satellite integrations update in real time, official evacuation directives follow announcements issued by DOST-PAGASA, NDRRMC, and Antipolo City CDRRMO.
              </p>
            </div>
          </div>

        </div>

        {/* Modal Footer (Web Light Theme Accent) */}
        <div className="bg-[#f1f5f7] px-4 py-2.5 border-t border-[#e2e8f0] flex items-center justify-between text-[10px] text-[#64748b] font-mono">
          <span>SmartFlood · Capstone Project 2026</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#2b6e8f] hover:bg-[#1f6f94] text-white font-bold rounded-lg text-xs transition shadow-sm cursor-pointer flex items-center gap-1 active:scale-95"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
