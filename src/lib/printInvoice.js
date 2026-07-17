/**
 * Opens a new browser window containing pre-rendered invoice HTML,
 * triggers the browser's print dialog, then closes the window.
 *
 * @param {object} sale    - The sales_order row
 * @param {object} shop    - The shop row (name, code)
 * @param {Array}  items   - Array of sales_order_items (with products joined)
 */
export function printInvoice(sale, shop, items) {
    const subtotal = parseFloat(sale.subtotal || 0);
    const taxAmt = parseFloat(sale.tax_amount || 0);
    const total = parseFloat(sale.total || 0);
    const taxRate = parseFloat(sale.tax_rate || 0);
    const invoiceNo = sale.order_number || sale.id?.slice(0, 8) || '—';
    const createdAt = sale.created_at
        ? new Date(sale.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : '';

    const rowsHtml = items.length > 0
        ? items.map(item => `
            <tr>
                <td style="padding:10px 14px">
                    <div style="font-weight:600">${item.products?.name || 'Item'}</div>
                    ${item.products?.sku ? `<div style="font-size:11px;color:#94a3b8">SKU: ${item.products.sku}</div>` : ''}
                </td>
                <td style="padding:10px 14px;text-align:center">${item.quantity}</td>
                <td style="padding:10px 14px;text-align:right">Br ${parseFloat(item.unit_price || 0).toFixed(2)}</td>
                <td style="padding:10px 14px;text-align:right;font-weight:600">Br ${(item.quantity * parseFloat(item.unit_price || 0)).toFixed(2)}</td>
            </tr>`).join('')
        : `<tr><td colspan="4" style="padding:16px 14px;color:#94a3b8;font-style:italic;font-size:12px">No line items — order summary only.</td></tr>`;

    const statusHtml = sale.status === 'paid'
        ? `<span style="background:#dcfce7;color:#15803d;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase">✓ Paid</span>`
        : `<span style="background:#fef9c3;color:#854d0e;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase">Pending</span>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${invoiceNo}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, sans-serif; background: white; color: #1e293b; }
    @media print {
      @page { margin: 16mm 18mm; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div style="max-width:680px;margin:0 auto;padding:40px 48px">

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px">
      <div>
        <div style="font-size:28px;font-weight:800;color:#1e40af">
          Easy<span style="color:#0ea5e9">Stock</span>
        </div>
        ${shop ? `<div style="font-size:13px;color:#64748b;margin-top:6px">
          ${shop.name}<br/>
          Company Code: <strong style="font-family:monospace;letter-spacing:2px">${shop.code || '—'}</strong>
        </div>` : ''}
      </div>
      <div style="text-align:right">
        <div style="font-size:22px;font-weight:800;color:#0f172a">INVOICE</div>
        <div style="font-size:13px;color:#64748b;margin-top:4px">
          #${invoiceNo}<br/>${createdAt}
        </div>
      </div>
    </div>

    <!-- Divider -->
    <div style="height:2px;background:linear-gradient(90deg,#1e40af,#0ea5e9);border-radius:2px;margin-bottom:28px"></div>

    <!-- Bill To -->
    <div style="margin-bottom:28px">
      <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Bill To</div>
      <div style="font-size:15px;font-weight:700;color:#0f172a">${sale.customers?.name || 'Walk-in Customer'}</div>
      ${sale.customers?.phone ? `<div style="font-size:12px;color:#64748b;margin-top:2px">${sale.customers.phone}</div>` : ''}
    </div>

    <!-- Items Table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Item</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Qty</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Unit Price</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Total</th>
        </tr>
      </thead>
      <tbody style="font-size:13px">
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Totals -->
    <div style="display:flex;justify-content:flex-end">
      <div style="width:260px">
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;color:#64748b">
          <span>Subtotal</span><span>Br ${subtotal.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;color:#64748b">
          <span>Tax (${taxRate}%)</span><span>Br ${taxAmt.toFixed(2)}</span>
        </div>
        <div style="border-top:2px solid #1e40af;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:#0f172a">
          <span>Total</span><span>Br ${total.toFixed(2)}</span>
        </div>
        <div style="margin-top:10px;text-align:right">${statusHtml}</div>
      </div>
    </div>

    <!-- Footer -->
    <div style="margin-top:48px;border-top:1px solid #e2e8f0;padding-top:16px;font-size:11px;color:#94a3b8;text-align:center">
      Thank you for your business · Generated by EasyStock
    </div>
  </div>

  <script>
    // Auto-print and close after fonts load
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) {
        alert('Please allow pop-ups for this site to enable printing.');
        return;
    }
    win.document.write(html);
    win.document.close();
}
