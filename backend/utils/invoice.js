// utils/invoice.js — GST-compliant invoice HTML → PDF
// Uses puppeteer-core or falls back to plain HTML string

const generateInvoiceHTML = (order, items, user) => {
  const rows = items.map(i => `
    <tr>
      <td>${i.title}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:right">₹${(i.unit_price * 84).toFixed(2)}</td>
      <td style="text-align:right">18%</td>
      <td style="text-align:right">₹${(i.unit_price * 84 * i.qty).toFixed(2)}</td>
    </tr>`).join('');

  const subtotalINR  = (order.subtotal * 84).toFixed(2);
  const shippingINR  = (order.shipping_fee * 84).toFixed(2);
  const discountINR  = ((order.discount || 0) * 84).toFixed(2);
  const totalINR     = (order.total * 84).toFixed(2);
  const cgst         = (order.total * 84 * 0.09).toFixed(2);
  const sgst         = cgst;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #222; margin: 0; padding: 32px; }
  h1   { font-size: 24px; color: #C8501A; margin: 0 0 4px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 28px; }
  .label  { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .5px; }
  table   { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th      { background: #1A1612; color: white; padding: 8px 10px; text-align: left; font-size: 12px; }
  td      { padding: 8px 10px; border-bottom: 1px solid #eee; }
  .total-row td { font-weight: bold; border-top: 2px solid #C8501A; }
  .badge  { display: inline-block; background: #EAF3DE; color: #2C7A45; padding: 3px 10px;
            border-radius: 20px; font-size: 11px; font-weight: 600; }
  .footer { margin-top: 32px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 12px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>Future Store</h1>
    <div style="color:#888;font-size:12px">GST No: 27AAAAA0000A1Z5<br>futurestore.com</div>
  </div>
  <div style="text-align:right">
    <div class="label">Tax Invoice</div>
    <div style="font-size:18px;font-weight:bold">#${order.order_number}</div>
    <div style="color:#888;margin-top:4px">${new Date(order.created_at).toLocaleDateString('en-IN')}</div>
    <div style="margin-top:6px"><span class="badge">${order.status.toUpperCase()}</span></div>
  </div>
</div>

<div style="display:flex;gap:40px;margin-bottom:20px">
  <div>
    <div class="label">Bill To</div>
    <div style="margin-top:4px"><strong>${order.shipping_name || user.name}</strong><br>
    ${order.shipping_email || user.email}<br>
    ${order.shipping_phone || ''}</div>
  </div>
  <div>
    <div class="label">Shipping To</div>
    <div style="margin-top:4px">${order.shipping_address || 'As above'}</div>
  </div>
  ${order.payment_gateway ? `<div>
    <div class="label">Payment</div>
    <div style="margin-top:4px">${order.payment_gateway}<br>
    <span style="font-size:11px;color:#888">${order.payment_id || ''}</span></div>
  </div>` : ''}
</div>

<table>
  <thead><tr>
    <th>Book</th><th style="text-align:center">Qty</th>
    <th style="text-align:right">Unit Price</th>
    <th style="text-align:right">GST</th>
    <th style="text-align:right">Amount</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr><td colspan="4" style="text-align:right">Subtotal</td><td style="text-align:right">₹${subtotalINR}</td></tr>
    <tr><td colspan="4" style="text-align:right">CGST (9%)</td><td style="text-align:right">₹${cgst}</td></tr>
    <tr><td colspan="4" style="text-align:right">SGST (9%)</td><td style="text-align:right">₹${sgst}</td></tr>
    ${order.discount > 0 ? `<tr><td colspan="4" style="text-align:right;color:#2C7A45">Discount (${order.coupon_code})</td><td style="text-align:right;color:#2C7A45">−₹${discountINR}</td></tr>` : ''}
    <tr><td colspan="4" style="text-align:right">Shipping</td><td style="text-align:right">${order.shipping_fee == 0 ? '<span style="color:#2C7A45">Free</span>' : '₹' + shippingINR}</td></tr>
    <tr class="total-row"><td colspan="4" style="text-align:right">Total</td><td style="text-align:right">₹${totalINR}</td></tr>
  </tfoot>
</table>

<div class="footer">
  Thank you for shopping at Future Store! · Returns accepted within 30 days · support@futurestore.com
  <br>This is a computer-generated invoice and does not require a signature.
</div>
</body></html>`;
};

module.exports = { generateInvoiceHTML };
