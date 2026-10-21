import React, { useState } from 'react';
import { api } from '../../lib/session.js';
import { Card, Button, ErrorNote } from './ui.jsx';

// Super Admin tool: clear old test readings.
export default function SystemToolsCard() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const resetLogs = async () => {
    if (!window.confirm('Delete ALL water level readings, events and forecasts? This cannot be undone.')) return;
    setError(''); setMessage('');
    try {
      const json = await api('/test/reset', { method: 'POST' });
      const d = json.deletedRecords || {};
      setMessage(`Deleted ${d.telemetry ?? 0} readings, ${d.events ?? 0} events and ${d.projections ?? 0} forecasts.`);
    } catch (e) { setError(e.message); }
  };

  return (
    <Card className="px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm text-[#3f5361]">
          <b className="font-semibold text-[#123a54]">Reset logs</b> · deletes all readings, events and forecasts (accounts and boards are kept)
        </p>
        <Button size="sm" variant="secondary" onClick={resetLogs}>Reset logs</Button>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {message && <p className="mt-2 text-xs text-emerald-700">{message}</p>}
    </Card>
  );
}
