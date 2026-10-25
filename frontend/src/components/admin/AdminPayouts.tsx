import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock, RefreshCw, X } from 'lucide-react';
import { payoutService, type PayoutEntry, type PayoutState } from '../../services/payoutService';

export const AdminPayouts: React.FC = () => {
  const [rows, setRows] = useState<PayoutEntry[]>([]);
  const [status, setStatus] = useState<PayoutState | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState<PayoutEntry | null>(null);
  const [action, setAction] = useState<'APPROVED' | 'HELD' | 'PAID' | 'REJECTED'>('APPROVED');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (selection && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [selection]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await payoutService.list(true, page, status || undefined);
      setRows(result.payouts); setTotalPages(Math.max(1, result.totalPages));
    } catch (err: any) { setError(err?.message || 'Could not load payout requests.'); }
    finally { setLoading(false); }
  }, [page, status]);
  useEffect(() => { void load(); }, [load]);

  const select = (row: PayoutEntry) => {
    setSelection(row); setAction(row.status === 'APPROVED' ? 'PAID' : 'APPROVED');
    setNote(''); setReference(''); setConfirmed(false); setError('');
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selection || saving) return;
    if (action === 'PAID' && !confirmed) { setError('Confirm that payment has already been sent.'); return; }
    setSaving(true); setError('');
    try {
      await payoutService.update(selection.id, { status: action, note: note.trim() || undefined,
        referenceId: action === 'PAID' ? reference.trim() : undefined });
      setSelection(null);
      await load();
    } catch (err: any) { setError(err?.message || 'Could not update this payout.'); }
    finally { setSaving(false); }
  };
  const field = 'w-full min-w-0 border border-[#eedbe6] rounded-md px-3 py-2 bg-white text-sm';

  return <section className="min-w-0 border-t border-[#eedbe6] pt-6" aria-labelledby="payout-heading">
    <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
      <h2 id="payout-heading" className="text-lg font-bold text-[#141219]">Payout Requests</h2>
      <div className="flex items-center gap-2">
        <select aria-label="Payout status" value={status} onChange={e => { setStatus(e.target.value as PayoutState | ''); setPage(1); }} className={field}>
          <option value="">All statuses</option>
          {(['PENDING', 'APPROVED', 'HELD', 'PAID', 'REJECTED', 'CANCELLED'] as const).map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <button type="button" title="Refresh payouts" aria-label="Refresh payouts" disabled={loading} onClick={() => void load()} className="shrink-0 w-10 h-10 grid place-items-center border rounded-md disabled:opacity-50"><RefreshCw size={16} /></button>
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-red-700 mb-3">{error}</p>}
    {loading ? <p role="status" className="text-sm py-4">Loading payout requests...</p> : !error && rows.length === 0 ? <p className="text-sm text-[#716d77] py-4">No payout requests.</p> : null}
    {!loading && rows.length > 0 && <div className="overflow-x-auto">
      <table className="w-full text-sm text-left min-w-[650px]">
        <thead className="text-[#716d77] border-b"><tr>{['Representative', 'Amount', 'Method', 'Status', 'Requested', 'Review'].map(label => <th key={label} className="py-3 pr-4 font-semibold">{label}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.id} className="border-b border-[#f4edf2]">
          <td className="py-3 pr-4 max-w-[190px] break-all">{row.representative || row.affiliateId}</td>
          <td className="py-3 pr-4 whitespace-nowrap">${row.amount.toFixed(2)}</td>
          <td className="py-3 pr-4 capitalize">{row.method.replace('_', ' ')}</td>
          <td className="py-3 pr-4">{row.status}</td>
          <td className="py-3 pr-4 whitespace-nowrap">{new Date(row.requestedAt).toLocaleDateString()}</td>
          <td className="py-3"><button type="button" onClick={() => select(row)} className="inline-flex items-center gap-1 px-3 py-2 border border-[#eedbe6] rounded-md hover:bg-rose-50"><Clock size={14} />Review</button></td>
        </tr>)}</tbody>
      </table>
    </div>}
    <div className="flex justify-end items-center gap-3 mt-3 text-sm">
      <button type="button" aria-label="Previous payout page" title="Previous page" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)} className="w-9 h-9 grid place-items-center border rounded-md disabled:opacity-40"><ChevronLeft size={16} /></button>
      <span>{page} / {totalPages}</span>
      <button type="button" aria-label="Next payout page" title="Next page" disabled={loading || page >= totalPages} onClick={() => setPage(p => p + 1)} className="w-9 h-9 grid place-items-center border rounded-md disabled:opacity-40"><ChevronRight size={16} /></button>
    </div>
    {selection && <dialog ref={dialogRef} aria-labelledby="payout-review-title" className="fixed inset-0 z-[9999] m-0 w-full max-w-none h-full max-h-none bg-black/40 p-4 flex items-center justify-center"
      onCancel={event => { event.preventDefault(); if (!saving) setSelection(null); }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-lg p-5 text-[#141219]">
        <div className="flex justify-between items-center gap-3 mb-4">
          <h3 id="payout-review-title" className="text-lg font-bold">Payout Review</h3>
          <button type="button" aria-label="Close payout review" title="Close" disabled={saving} onClick={() => setSelection(null)} className="w-9 h-9 grid place-items-center shrink-0"><X size={20} /></button>
        </div>
        <dl className="text-sm space-y-2 mb-5 break-words">
          <div><dt className="text-[#716d77]">Representative</dt><dd>{selection.representative || selection.affiliateId}</dd></div>
          <div><dt className="text-[#716d77]">Amount / Status</dt><dd>${selection.amount.toFixed(2)} / {selection.status}</dd></div>
          <div><dt className="text-[#716d77]">Payment destination</dt><dd>{selection.method.replace('_', ' ')}: {selection.destinationAccount}</dd></div>
          {selection.referenceId && <div><dt className="text-[#716d77]">Payment reference</dt><dd>{selection.referenceId}</dd></div>}
        </dl>
        {error && <p role="alert" className="text-sm text-red-700 mb-3">{error}</p>}
        {!['PAID', 'REJECTED', 'CANCELLED'].includes(selection.status) && <form onSubmit={submit} className="space-y-4 mb-5">
          <label className="block text-sm font-semibold">Decision<select className={`${field} mt-1`} value={action} disabled={saving} onChange={e => { setAction(e.target.value as typeof action); setConfirmed(false); }}>
            {selection.status !== 'APPROVED' && <option value="APPROVED">Approve</option>}
            {selection.status !== 'HELD' && <option value="HELD">Hold</option>}
            {selection.status === 'APPROVED' && <option value="PAID">Record completed payment</option>}
            <option value="REJECTED">Reject</option>
          </select></label>
          {action === 'PAID' && <>
            <label className="block text-sm font-semibold">Payment reference<input autoComplete="off" className={`${field} mt-1`} value={reference} onChange={e => setReference(e.target.value)} required minLength={3} maxLength={150} disabled={saving} /></label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required disabled={saving} className="mt-1" />I have already sent this payment and verified the destination and amount.</label>
          </>}
          <label className="block text-sm font-semibold">{['HELD', 'REJECTED'].includes(action) ? 'Reason' : 'Note (optional)'}<textarea className={`${field} mt-1`} rows={3} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} required={['HELD', 'REJECTED'].includes(action)} disabled={saving} /></label>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold bg-[#D30915] text-white disabled:opacity-50"><Check size={16} />{saving ? 'Saving...' : 'Save decision'}</button>
        </form>}
        <h4 className="font-semibold text-sm border-t pt-4">History</h4>
        <ol className="text-sm divide-y divide-[#f4edf2]">
          {selection.events.map(event => <li key={event.id} className="py-3 break-words">
            <div className="font-semibold">{event.fromStatus ? `${event.fromStatus} to ` : ''}{event.toStatus}</div>
            <div className="text-[#716d77]">{new Date(event.createdAt).toLocaleString()}</div>
            {event.note && <p>{event.note}</p>}
            {event.referenceId && <p>Reference: {event.referenceId}</p>}
          </li>)}
        </ol>
      </div>
    </dialog>}
  </section>;
};
