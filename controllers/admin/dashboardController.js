
const Order = require('../../models/orderSchema');
const pdfkit = require('pdfkit');
const exceljs = require('exceljs');
const moment = require('moment');


exports.loadSalesReport = async (req, res) => {
  if (!req.session.admin) {
    return res.redirect('/admin/login');
  }

  try {
    const { period, startDate, endDate, page = 1 } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    let filter = { status: 'delivered' };
    let fromDate, toDate;
    let periodLabel = 'Custom Period';

   
    if (!period || !['daily', 'weekly', 'monthly', 'yearly', 'custom'].includes(period)) {
      fromDate = moment().subtract(7, 'days').startOf('day').toDate();
      toDate = moment().endOf('day').toDate();
      periodLabel = 'Last 7 Days';
    } 
  
    else if (period === 'daily') {
      fromDate = moment().startOf('day').toDate();
      toDate = moment().endOf('day').toDate();
      periodLabel = 'Today';
    } 
   
    else if (period === 'weekly') {
      fromDate = moment().subtract(6, 'days').startOf('day').toDate(); 
      toDate = moment().endOf('day').toDate();
      periodLabel = 'Last 7 Days';
    } 
   
    else if (period === 'monthly') {
      fromDate = moment().subtract(29, 'days').startOf('day').toDate(); 
      toDate = moment().endOf('day').toDate();
      periodLabel = 'Last 30 Days';
    } 

    else if (period === 'yearly') {
      fromDate = moment().startOf('year').toDate();
      toDate = moment().endOf('day').toDate();
      periodLabel = 'This Year';
    } 
  
    else if (period === 'custom' && startDate && endDate) {
      const start = moment(startDate);
      const end = moment(endDate);

      if (!start.isValid() || !end.isValid() || start > end) {
        return res.render('admin/dashboard', {
          pageTitle: 'Dashboard',
          currentPage: 'sales-report',
          error: 'Invalid date range',
          salesData: null,
          queryString: '',
          currentFilter: null,
          pagination: null
        });
      }

      fromDate = start.startOf('day').toDate();
      toDate = end.endOf('day').toDate();
      periodLabel = `${start.format('MMM DD, YYYY')} - ${end.format('MMM DD, YYYY')}`;
    }

  
    if (fromDate && toDate) {
      filter.createdOn = { $gte: fromDate, $lte: toDate };
    }


    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

  
    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const allOrders = await Order.find(filter).lean();

const totalAmount = allOrders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
const totalDiscount = allOrders.reduce((sum, o) => 
  sum + (o.discount || 0) + (o.couponDiscount || 0), 0);
const avgOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;

const salesData = {
  totalOrders,
  totalAmount: totalAmount.toFixed(2),      
  totalDiscount: totalDiscount.toFixed(2),  
  avgOrderValue: avgOrderValue.toFixed(2),  
  orders,
  periodLabel
};

 
    const queryParams = { period, startDate, endDate };
    const baseQuery = new URLSearchParams(
      Object.fromEntries(Object.entries(queryParams).filter(([_, v]) => v))
    ).toString();

    const pagination = {
      currentPage: parseInt(page),
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      getPageUrl: (p) => `/admin/dashboard?${baseQuery}&page=${p}`
    };

    res.render('admin/dashboard', {
      pageTitle: 'Sales Report',
      currentPage: 'sales-report',
      salesData,
      queryString: baseQuery,
      currentFilter: { period, startDate, endDate },
      pagination
    });

  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).render('admin/page-error', {
      message: 'Error loading sales report',
      error: error.message
    });
  }
};

exports.downloadSalesReport = async (req, res) => {
  if (!req.session.admin) {
    return res.redirect('/admin/login');
  }

  try {
    const { type, period, startDate, endDate } = req.query;
    let filter = { status: 'delivered' };

    let fromDate, toDate = new Date();
    let periodLabel = '';

    if (period === 'daily') {
      fromDate = moment().startOf('day').toDate();
      toDate = moment().endOf('day').toDate();
      periodLabel = 'Today';
    } else if (period === 'weekly') {
      fromDate = moment().subtract(7, 'days').startOf('day').toDate();
      periodLabel = 'Last 7 Days';
    } else if (period === 'monthly') {
      fromDate = moment().subtract(30, 'days').startOf('day').toDate();
      periodLabel = 'Last 30 Days';
    } else if (period === 'yearly') {
      fromDate = moment().startOf('year').toDate();
      periodLabel = 'This Year';
    } else if (period === 'custom' && startDate && endDate) {
      fromDate = moment(startDate).startOf('day').toDate();
      toDate = moment(endDate).endOf('day').toDate();
      periodLabel = `${moment(startDate).format('MMM DD, YYYY')} - ${moment(endDate).format('MMM DD, YYYY')}`;
    } else {
      return res.status(400).send('Invalid filter parameters');
    }

    filter.createdOn = { $gte: fromDate, $lte: toDate };

    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdOn: -1 });

    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, order) => sum + order.finalAmount, 0);
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0) + (order.couponDiscount || 0), 0);

    if (type === 'pdf') {
      await generatePDFReport(res, orders, {
        totalOrders,
        totalAmount,
        totalDiscount,
        periodLabel,
        fromDate,
        toDate
      });
    } else if (type === 'excel') {
      await generateExcelReport(res, orders, {
        totalOrders,
        totalAmount,
        totalDiscount,
        periodLabel,
        fromDate,
        toDate
      });
    } else {
      res.status(400).send('Invalid download type. Use "pdf" or "excel"');
    }
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).send('Error generating report: ' + error.message);
  }
};

// PDF Generation Helper
async function generatePDFReport(res, orders, stats) {
  const doc = new pdfkit({ margin: 50 });
  const filename = `sales-report-${moment().format('YYYY-MM-DD-HHmmss')}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);


  doc.fontSize(24).fillColor('#1a202c').text('Pure Botanica', { align: 'center' });
  doc.fontSize(20).fillColor('#2d3748').text('Sales Report', { align: 'center' });
  doc.moveDown();


  doc.fontSize(12).fillColor('#4a5568').text(`Period: ${stats.periodLabel}`, { align: 'center' });
  doc.text(`Generated on: ${moment().format('MMMM DD, YYYY HH:mm')}`, { align: 'center' });
  doc.moveDown(2);


  doc.fontSize(14).fillColor('#1a202c').text('Summary', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#2d3748');
  doc.text(`Total Orders: ${stats.totalOrders}`);
  doc.text(`Total Revenue: ₹${stats.totalAmount.toFixed(2)}`);
  doc.text(`Total Discount: ₹${stats.totalDiscount.toFixed(2)}`);
  doc.text(`Average Order Value: ₹${(stats.totalAmount / stats.totalOrders || 0).toFixed(2)}`);
  doc.moveDown(2);

  doc.fontSize(14).fillColor('#1a202c').text('Order Details', { underline: true });
  doc.moveDown(0.5);


  const tableTop = doc.y;
  const colWidths = [80, 70, 100, 80, 80, 80];
  const headers = ['Order ID', 'Date', 'Customer', 'Amount', 'Discount', 'Final'];

  doc.fontSize(10).fillColor('#1a202c');
  headers.forEach((header, i) => {
    const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.text(header, x, tableTop, { width: colWidths[i], align: 'left' });
  });

  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

  let y = tableTop + 25;
  doc.fontSize(9).fillColor('#4a5568');

  orders.forEach((order, index) => {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }

    const row = [
      order.orderId || 'N/A',
      moment(order.createdOn).format('MMM DD, YYYY'),
      order.user?.name || 'Unknown',
      `₹${order.totalPrice?.toFixed(2) || '0.00'}`,
      `₹${((order.discount || 0) + (order.couponDiscount || 0)).toFixed(2)}`,
      `₹${order.finalAmount?.toFixed(2) || '0.00'}`
    ];

    row.forEach((cell, i) => {
      const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(cell, x, y, { width: colWidths[i], align: 'left' });
    });

    y += 20;
  });


  doc.fontSize(8).fillColor('#718096').text(
    'This is a computer-generated report. No signature required.',
    50,
    doc.page.height - 50,
    { align: 'center' }
  );

  doc.end();
}


async function generateExcelReport(res, orders, stats) {
  const workbook = new exceljs.Workbook();
  const sheet = workbook.addWorksheet('Sales Report');


  sheet.mergeCells('A1:H1');
  sheet.getCell('A1').value = 'Pure Botanica - Sales Report';
  sheet.getCell('A1').font = { size: 16, bold: true };
  sheet.getCell('A1').alignment = { horizontal: 'center' };


  sheet.mergeCells('A2:H2');
  sheet.getCell('A2').value = `Period: ${stats.periodLabel}`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  sheet.addRow([]);


  sheet.addRow(['Summary']);
  sheet.addRow(['Total Orders', stats.totalOrders]);
  sheet.addRow(['Total Revenue', `₹${stats.totalAmount.toFixed(2)}`]);
  sheet.addRow(['Total Discount', `₹${stats.totalDiscount.toFixed(2)}`]);
  sheet.addRow(['Average Order Value', `₹${(stats.totalAmount / stats.totalOrders || 0).toFixed(2)}`]);

  sheet.addRow([]);


  const headerRow = sheet.addRow([
    'Order ID',
    'Date',
    'Customer',
    'Email',
    'Total Price',
    'Discount',
    'Coupon Discount',
    'Final Amount'
  ]);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' }
  };

  orders.forEach(order => {
    sheet.addRow([
      order.orderId || 'N/A',
      moment(order.createdOn).format('YYYY-MM-DD'),
      order.user?.name || 'Unknown',
      order.user?.email || 'N/A',
      order.totalPrice?.toFixed(2) || '0.00',
      order.discount?.toFixed(2) || '0.00',
      order.couponDiscount?.toFixed(2) || '0.00',
      order.finalAmount?.toFixed(2) || '0.00'
    ]);
  });


  sheet.columns.forEach(column => {
    column.width = 15;
  });

  const filename = `sales-report-${moment().format('YYYY-MM-DD-HHmmss')}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
}