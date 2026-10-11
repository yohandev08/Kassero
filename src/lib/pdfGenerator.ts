import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product } from '@/types';

export interface PrintItem {
  productId: number;
  quantity: string;
}

export const generatePurchaseOrderPDF = (printItems: PrintItem[], products: Product[]) => {
  const pdfDocument = new jsPDF();
  
  const currentDate = new Date().toLocaleDateString();
  const restockSheetId = Math.floor(Date.now() / 1000).toString();
  
  // Header Text
  pdfDocument.setFontSize(22);
  pdfDocument.setFont('helvetica', 'bold');
  pdfDocument.text('KASSERO', 14, 20);
  
  pdfDocument.setFontSize(14);
  pdfDocument.text('SHOPPING LIST / PURCHASE ORDER', 14, 30);
  
  // Meta Info
  pdfDocument.setFontSize(10);
  pdfDocument.setFont('helvetica', 'normal');
  pdfDocument.text(`Date: ${currentDate}`, 14, 40);
  pdfDocument.text(`Printed By: Admin / Staff`, 14, 45);
  pdfDocument.text(`Restock Sheet ID: #${restockSheetId}`, 140, 40);
  
  // Table Data
  const tableData = [];
  let grandTotal = 0;
  
  for (const item of printItems) {
    const foundProduct = products.find(product => product.product_id === item.productId);
    if (!foundProduct) continue;
    
    const quantity = parseInt(item.quantity) || 0;
    const estimatedTotal = quantity * foundProduct.cost_price;
    grandTotal += estimatedTotal;
    
    tableData.push([
      foundProduct.product_name,
      foundProduct.stock_quantity.toString(),
      quantity.toString(),
      `P${foundProduct.cost_price.toFixed(2)}`,
      `P${estimatedTotal.toFixed(2)}`
    ]);
  }
  
  // Add Table
  autoTable(pdfDocument, {
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
    const blob = pdfDocument.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  } else {
    pdfDocument.save(`Kassero_Purchase_Order_${restockSheetId}.pdf`);
  }
};
