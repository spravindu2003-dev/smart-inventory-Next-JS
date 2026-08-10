import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFReportData {
  businessName: string;
  reportTitle: string;
  generatedAt: string;
  dateRange: { start: string; end: string } | null;
  currency: string;
  currencySymbol: string;
  sections: string[];
  kpis?: Record<string, unknown>;
  revenueTrend?: { date: string; revenue: number; count: number }[];
  productByCategory?: { category: string; count: number }[];
  stockByCategory?: { category: string; stock: number; count: number }[];
  inventoryStatus?: { inStock: number; lowStock: number; outOfStock: number; expired: number };
  topProducts?: { name: string; sku: string; category: string; totalSold: number; totalRevenue: number }[];
  lowStockProducts?: { name: string; sku: string; category: string; stock: number }[];
  outOfStockProducts?: { name: string; sku: string; category: string }[];
  salesByCategory?: { category: string; quantity: number; revenue: number }[];
  salesByUser?: { user: { name: string; role: string }; saleCount: number; totalItems: number; totalRevenue: number }[];
  activityByType?: { action: string; count: number }[];
  requestByStatus?: { status: string; count: number }[];
  requestByType?: { type: string; count: number }[];
}

function formatCurrencyVal(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getActionLabel(action: string): string {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function generatePDFReport(data: PDFReportData) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  function checkPage(needed: number) {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = margin;
    }
  }

  function addHeader() {
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(data.businessName, margin, 15);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(data.reportTitle, margin, 23);
    doc.setFontSize(9);
    doc.text(`Generated: ${data.generatedAt}`, margin, 30);
    if (data.dateRange) {
      doc.text(`Period: ${data.dateRange.start} to ${data.dateRange.end}`, pageWidth - margin - 80, 30);
    }
    doc.setTextColor(0, 0, 0);
    y = 45;
  }

  function addSectionTitle(title: string) {
    checkPage(15);
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y - 2, pageWidth - 2 * margin, 8, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(title, margin + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 12;
  }

  function addKPITable(kpis: Record<string, string>) {
    checkPage(20);
    const entries = Object.entries(kpis);
    const colWidth = (pageWidth - 2 * margin) / Math.min(entries.length, 4);
    let row = 0;
    for (let i = 0; i < entries.length; i += 4) {
      const slice = entries.slice(i, i + 4);
      slice.forEach(([label, value], idx) => {
        const x = margin + idx * colWidth;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text(label, x + 2, y + row * 12 + 3);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.text(String(value), x + 2, y + row * 12 + 9);
      });
      row += 1;
    }
    y += row * 12 + 5;
  }

  function addTable(headers: string[], rows: string[][]) {
    checkPage(rows.length * 5 + 20);
    autoTable(doc, {
      startY: y,
      head: [headers],
      body: rows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      didDrawPage: (hookData) => {
        y = hookData.cursor?.y ?? y;
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  function addFooter(pageNum: number) {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `${data.businessName} | ${data.reportTitle} | Page ${i} of ${totalPages}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    }
  }

  // Build PDF
  addHeader();

  // KPI Section
  if (data.sections.includes('kpis') && data.kpis) {
    addSectionTitle('Key Performance Indicators');
    const kpiLabels: Record<string, string> = {
      totalRevenue: 'Total Revenue',
      totalSales: 'Total Sales',
      totalProducts: 'Products',
      totalStockUnits: 'Stock Units',
      lowStock: 'Low Stock',
      outOfStock: 'Out of Stock',
      pendingRequests: 'Pending Requests',
      inventoryValue: 'Inventory Value',
    };
    const kpiValues: Record<string, string> = {};
    const kpiData = data.kpis as Record<string, number>;
    for (const [key, label] of Object.entries(kpiLabels)) {
      const val = kpiData[key];
      if (val !== undefined) {
        kpiValues[label] = (key === 'totalRevenue' || key === 'inventoryValue')
          ? formatCurrencyVal(val, data.currencySymbol)
          : String(val);
      }
    }
    addKPITable(kpiValues);
  }

  // Revenue & Sales Trend
  if (data.sections.includes('revenue') && data.revenueTrend && data.revenueTrend.length > 0) {
    addSectionTitle('Revenue & Sales Trend');
    addTable(
      ['Date', 'Revenue', 'Sales Count'],
      data.revenueTrend.map((r) => [
        r.date,
        formatCurrencyVal(r.revenue, data.currencySymbol),
        String(r.count),
      ])
    );
  }

  // Product Distribution
  if (data.sections.includes('products') && data.productByCategory) {
    addSectionTitle('Products by Category');
    addTable(
      ['Category', 'Products'],
      data.productByCategory.map((c) => [c.category, String(c.count)])
    );
    if (data.stockByCategory && data.stockByCategory.length > 0) {
      addSectionTitle('Stock by Category');
      addTable(
        ['Category', 'Products', 'Total Stock'],
        data.stockByCategory.map((c) => [c.category, String(c.count), String(c.stock)])
      );
    }
  }

  // Inventory Health
  if (data.sections.includes('inventory') && data.inventoryStatus) {
    addSectionTitle('Inventory Status');
    addKPITable({
      'In Stock': String(data.inventoryStatus.inStock),
      'Low Stock': String(data.inventoryStatus.lowStock),
      'Out of Stock': String(data.inventoryStatus.outOfStock),
      'Expired': String(data.inventoryStatus.expired),
    });
    if (data.lowStockProducts && data.lowStockProducts.length > 0) {
      addSectionTitle('Low Stock Products');
      addTable(
        ['Name', 'SKU', 'Category', 'Stock'],
        data.lowStockProducts.map((p) => [p.name, p.sku, p.category, String(p.stock)])
      );
    }
    if (data.outOfStockProducts && data.outOfStockProducts.length > 0) {
      addSectionTitle('Out of Stock Products');
      addTable(
        ['Name', 'SKU', 'Category'],
        data.outOfStockProducts.map((p) => [p.name, p.sku, p.category])
      );
    }
  }

  // Top Products
  if (data.sections.includes('topProducts') && data.topProducts && data.topProducts.length > 0) {
    addSectionTitle('Top Products');
    addTable(
      ['Rank', 'Product', 'SKU', 'Category', 'Qty Sold', 'Revenue'],
      data.topProducts.map((p, i) => [
        String(i + 1),
        p.name,
        p.sku,
        p.category,
        String(p.totalSold),
        formatCurrencyVal(p.totalRevenue, data.currencySymbol),
      ])
    );
  }

  // Sales by Category
  if (data.sections.includes('salesByCategory') && data.salesByCategory && data.salesByCategory.length > 0) {
    addSectionTitle('Sales by Category');
    addTable(
      ['Category', 'Qty Sold', 'Revenue'],
      data.salesByCategory.map((c) => [
        c.category,
        String(c.quantity),
        formatCurrencyVal(c.revenue, data.currencySymbol),
      ])
    );
  }

  // Sales by User
  if (data.sections.includes('salesByUser') && data.salesByUser && data.salesByUser.length > 0) {
    addSectionTitle('Sales by User');
    addTable(
      ['User', 'Role', 'Sales', 'Items', 'Revenue'],
      data.salesByUser.map((u) => [
        u.user.name,
        u.user.role,
        String(u.saleCount),
        String(u.totalItems),
        formatCurrencyVal(u.totalRevenue, data.currencySymbol),
      ])
    );
  }

  // Activity Log
  if (data.sections.includes('activity') && data.activityByType && data.activityByType.length > 0) {
    addSectionTitle('Activity Log Summary');
    addTable(
      ['Activity Type', 'Count'],
      data.activityByType.map((a) => [getActionLabel(a.action), String(a.count)])
    );
  }

  // Requests
  if (data.sections.includes('requests')) {
    if (data.requestByStatus && data.requestByStatus.length > 0) {
      addSectionTitle('Change Requests by Status');
      addTable(
        ['Status', 'Count'],
        data.requestByStatus.map((r) => [r.status, String(r.count)])
      );
    }
    if (data.requestByType && data.requestByType.length > 0) {
      addSectionTitle('Change Requests by Type');
      addTable(
        ['Type', 'Count'],
        data.requestByType.map((r) => [getActionLabel(r.type), String(r.count)])
      );
    }
  }

  addFooter(doc.getNumberOfPages());
  doc.save(`${data.reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}
