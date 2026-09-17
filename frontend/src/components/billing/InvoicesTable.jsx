import React from 'react';

export const InvoicesTable = ({ invoices }) => {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Billing Invoices</h3>
      </div>

      {!invoices || invoices.length === 0 ? (
        <p style={{ color: '#777', fontStyle: 'italic' }}>No invoices generated yet for this billing cycle.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td><code>{inv.invoice_number}</code></td>
                <td>{new Date(inv.created_at).toLocaleDateString()}</td>
                <td>${Number(inv.amount).toFixed(2)}</td>
                <td>
                  <span className="badge badge-active">{String(inv.status || 'paid').toUpperCase()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
