import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../lib/session.js';
import AdminDashboard from '../AdminDashboard.jsx';
import StationOverview from '../../components/console/StationOverview.jsx';
import { LEVEL_TAG, OFF_TAG } from '../../lib/floodLevels.js';

/**
 * River monitoring.
 *  - CDRRMO: water level and forecast for every barangay with a station.
 *  - Barangay staff: their own station's dashboard (a switcher if their barangay has 2+ stations).
 */
export default function MonitoringPage() {
  const { user } = useOutletContext();
  const isCityWide = user?.role !== 'BARANGAY';
  const [boards, setBoards] = useState([]);
  const [selected, setSelected] = useState(null); // Barangay staff: station being shown
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const json = await api('/devices/summary');
      setBoards(json.data);
      if (!isCityWide) setSelected((cur) => cur ?? json.data[0]?.id ?? null);
      setError('');
    } catch (e) { setError(e.message); }
  }, [isCityWide]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const current = !isCityWide ? boards.find((b) => b.id === selected) : null;
  const tag = current?.status === 'MAINTENANCE' ? OFF_TAG : LEVEL_TAG[current?.level];

  return (
    <div>
      <div className="px-4 sm:px-6 lg:px-8 pt-6 max-w-7xl mx-auto">
        {error && <p className="text-xs text-red-700 mb-2">{error}</p>}

        {boards.length === 0 && !error ? (
          <p className="text-sm text-[#6d818d]">
            {isCityWide ? 'No stations yet. Add a board on the Hardware page.' : `No stations in Barangay ${user.barangay} yet.`}
          </p>
        ) : isCityWide ? (
          /* CDRRMO: every barangay's station */
          <div className="pb-8">
            <h1 className="font-display text-2xl font-bold text-[#123a54] leading-tight">Barangay stations</h1>
            <p className="text-sm text-[#6d818d] mt-1 mb-5">Water level and forecast for each barangay with a station.</p>
            <StationOverview boards={boards} />
          </div>
        ) : current && (
          /* Barangay staff: their station's header */
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl font-bold text-[#123a54] leading-tight">{current.name}</h1>
                {tag && <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${tag.style}`}>{tag.name}</span>}
              </div>
              <p className="text-sm text-[#6d818d] mt-1">Barangay {current.barangay}</p>
            </div>
            {boards.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-[#3f5361]">
                <span className="font-semibold text-[#123a54]">Station</span>
                <select
                  className="px-3 py-2 rounded-xl bg-white border border-[#d5e2e7] text-sm text-[#123a54] max-w-[18rem]"
                  value={selected ?? ''}
                  onChange={(e) => setSelected(Number(e.target.value))}
                >
                  {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}
          </div>
        )}
      </div>

      {current && <AdminDashboard key={current.id} nodeId={current.id} />}
    </div>
  );
}
