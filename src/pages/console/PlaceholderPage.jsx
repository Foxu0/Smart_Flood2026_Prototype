import React from 'react';
import { Construction } from 'lucide-react';
import { Page, PageHeader, Card } from '../../components/console/ui.jsx';

/** Menu destinations scheduled for Phase 2 — keeps the navigation complete for demos. */
export default function PlaceholderPage({ title, subtitle, planned = [] }) {
  return (
    <Page>
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <Construction size={20} className="text-amber-700" />
          </div>
          <div>
            <p className="font-semibold text-[#123a54]">Coming in Phase 2</p>
            {planned.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-[#3f5361] list-disc pl-5">
                {planned.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}
          </div>
        </div>
      </Card>
    </Page>
  );
}
