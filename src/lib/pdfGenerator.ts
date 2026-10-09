import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product } from '@/types';

export interface PrintItem {
  productId: number;
  qty: string;
}

export const generatePurchaseOrderPDF = (printItems: PrintItem[], products: Product[]) => {
  const doc = new jsPDF();
  
  const date = new Date().toLocaleDateString();
  const restockId = Math.floor(Date.now() / 1000).toString();
  
  // Header Text
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('KASSERO', 14, 20);
  
  doc.setFontSize(14);
  doc.text('SHOPPING LIST / PURCHASE ORDER', 14, 30);
  
  // Meta Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${date}`, 14, 40);
  doc.text(`Printed By: Admin / Staff`, 14, 45);
  doc.text(`Restock Sheet ID: #${restockId}`, 140, 40);
  
  // Table Data
  const tableData = [];
  let grandTotal = 0;
  
  for (const item of printItems) {
    const product = products.find(p => p.product_id === item.productId);
    if (!product) continue;
    
    const qty = parseInt(item.qty) || 0;
    const estTotal = qty * product.cost_price;
    grandTotal += estTotal;
    
    tableData.push([
      product.product_name,
      product.stock_quantity.toString(),
      qty.toString(),
      `P${product.cost_price.toFixed(2)}`,
      `P${estTotal.toFixed(2)}`
    ]);
  }
  
  // Add Table
  autoTable(doc, {
    startY: 55,
    head: [['Product Name', 'Current Stock', 'Reorder Qty', 'Unit Cost', 'Est. Total']],
    body: tableData,
    foot: [['', '', '', 'Grand Total:', `P${grandTotal.toFixed(2)}`]],
    theme: 'grid',
    headStyles: { fillColor: [41, 42, 45] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 25 },
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'right', cellWidth: 30 },
    },
  });
  

  // Output PDF
  // Mobile browsers (especially iOS Safari and in-app webviews) often block or silently fail direct downloads.
  // Opening a Blob URL in a new tab is the most universally reliable way to present PDFs on mobile.
  if (typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } else {
    doc.save(`Kassero_Purchase_Order_${restockId}.pdf`);
  }
};
