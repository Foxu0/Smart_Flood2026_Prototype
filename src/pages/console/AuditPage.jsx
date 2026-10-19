import React, { useCallback, useEffect, useState } from 'react';
import { ScrollText, RefreshCw } from 'lucide-react';
import { api } from '../../lib/session.js';
import { RoleBadge } from '../../layouts/ConsoleLayout.jsx';
import { Page, PageHeader, Card, Button, ErrorNote, EmptyState, formatDateTime } from '../../components/console/ui.jsx';

export default function AuditPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const json = await api('/users/audit?limit=200'); setRows(json.data); setError(''); } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Page>
      <PageHeader
        title="Audit Log"
        subtitle="Who did what: sign-ins, account changes, hardware registration, replacements and maintenance mode."
        actions={<Button variant="secondary" onClick={load}><RefreshCw size={15} /> Refresh</Button>}
      />
      <ErrorNote>{error}</ErrorNote>
      <Card className="overflow-hidden">
        {loading ? (
          <p className="text-sm text-[#6d818d] px-4 py-8 text-center">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="No activity recorded yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f9fa] text-[11px] uppercase tracking-wide text-[#6d818d]">
                <tr>
                  <th className="text-left font-bold px-4 py-2.5">When</th>
                  <th className="text-left font-bold px-4 py-2.5">Who</th>
                  <th className="text-left font-bold px-4 py-2.5">Action</th>
                  <th className="text-left font-bold px-4 py-2.5">Target</th>
                  <th className="text-left font-bold px-4 py-2.5 hidden lg:table-cell">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f4]">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 text-[11px] text-[#6d818d] whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                    <td className="px-4 py-2.5"><span className="font-mono text-xs text-[#123a54] mr-1.5">{r.actorName}</span><RoleBadge role={r.actorRole} /></td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.action}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.target || '—'}</td>
                    <td className="px-4 py-2.5 hidden lg:table-cell text-[11px] text-[#6d818d] max-w-[40ch] truncate" title={r.detail || ''}>{r.detail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}
