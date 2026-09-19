import React from 'react';
import { FileText, Calendar } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const InvoicesTable = ({ invoices }) => {
  return (
    <Card variant="bordered" className="shadow-sm space-y-4">
      <div className="pb-3 border-b border-gray-100">
        <h3
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-lg font-bold text-[#292929] tracking-tight"
        >
          Billing Invoices
        </h3>
        <p className="text-xs text-gray-500">
          Historical payment records and monthly subscription receipts
        </p>
      </div>

      {!invoices || invoices.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400">
          No billing invoices generated yet for this subscription cycle.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/80 text-xs font-mono text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Invoice Number</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-gray-400" />
                      <code className="font-mono text-xs font-semibold text-[#292929]">
                        {inv.invoice_number}
                      </code>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-gray-400" />
                      <span>{new Date(inv.created_at).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-[#292929]">
                    ${Number(inv.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant={inv.status === 'failed' ? 'red' : 'green'}>
                      {String(inv.status || 'paid').toUpperCase()}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
