

import Order from '../../models/orderSchema.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import moment from 'moment';
import STATUS from '../../constants/statusCode.js';
import MESSAGES from '../../constants/messages.js'; 

function buildDateRange(period, startDate, endDate) {
  let from, to, label = 'Custom Period';

  if (!period || !['daily','weekly','monthly','yearly','custom'].includes(period)) {
    from = moment().subtract(6, 'days').startOf('day');
    to   = moment().endOf('day');
    label = 'Last 7 Days';
  }
  else if (period === 'daily') {
    from = moment().startOf('day');
    to   = moment().endOf('day');
    label = 'Today';
  }
  else if (period === 'weekly') {
    from = moment().subtract(6, 'days').startOf('day');
    to   = moment().endOf('day');
    label = 'Last 7 Days';
  }
  else if (period === 'monthly') {
    from = moment().subtract(29, 'days').startOf('day');
    to   = moment().endOf('day');
    label = 'Last 30 Days';
  }
  else if (period === 'yearly') {
    from = moment().startOf('year');
    to   = moment().endOf('day');
    label = 'This Year';
  }
  else if (period === 'custom' && startDate && endDate) {
    const s = moment(startDate);
    const e = moment(endDate);
    if (!s.isValid() || !e.isValid() || s > e) throw new Error('Invalid custom range');
    from = s.startOf('day');
    to   = e.endOf('day');
    label = `${s.format('MMM DD, YYYY')} - ${e.format('MMM DD, YYYY')}`;
  }

  return { from: from.toDate(), to: to.toDate(), label };
}

export const loadSalesReport = async (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');

  try {
    const { period, startDate, endDate, page = 1 } = req.query;
    const limit = 10;
    const skip  = (page - 1) * limit;

    let filter = { status: 'delivered' };
    let from, to, periodLabel;

    try {
      const range = buildDateRange(period, startDate, endDate);
      from = range.from; to = range.to; periodLabel = range.label;
      filter.createdOn = { $gte: from, $lte: to };
    } catch (err) {
      console.log('Error LoadSalesReport',err)
      return res.render('admin/dashboard', {
        layout: 'layouts/adminLayout',
        pageTitle: 'Sales Report',
        currentPage: 'sales-report',
        error: MESSAGES.COMMON.INVALID_DATE_RANGE || 'Invalid date range',
        salesData: null,
        chartData: null,
        bestSellingProducts: [],
        bestSellingCategories: [],
        queryString: '',
        currentFilter: { period, startDate, endDate },
        pagination: null
      });
    }

    const totalOrdersCount = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrdersCount / limit);

    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const allOrders = await Order.find(filter).lean();

    const totalAmount = allOrders.reduce((s, o) => s + (o.finalAmount || 0), 0);
    const totalDiscount = allOrders.reduce((s, o) => s + (o.discount || 0) + (o.couponDiscount || 0), 0);
    const avgOrderValue = totalOrdersCount ? totalAmount / totalOrdersCount : 0;

    const chartData = await generateChartData(allOrders, period, from, to);
    const bestSellingProducts = await getBestSellingProducts(filter, 10);
    const bestSellingCategories = await getBestSellingCategories(filter, 10);

    const salesData = {
      totalOrders: totalOrdersCount,
      totalAmount: totalAmount.toFixed(2),
      totalDiscount: totalDiscount.toFixed(2),
      avgOrderValue: avgOrderValue.toFixed(2),
      orders,
      periodLabel
    };

    const queryParams = { period, startDate, endDate };
    const baseQuery = new URLSearchParams(
      Object.fromEntries(Object.entries(queryParams).filter(([, v]) => v))
    ).toString();

    const pagination = {
      currentPage: parseInt(page),
      totalPages,
      totalOrders: totalOrdersCount,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    res.render('admin/dashboard', {
      layout: 'layouts/adminLayout',
      pageTitle: 'Sales Report',
      currentPage: 'sales-report',
      salesData,
      chartData,
      bestSellingProducts,
      bestSellingCategories,
      queryString: baseQuery,
      currentFilter: { period, startDate, endDate },
      pagination
    });

  } catch (error) {
    console.error('Sales report error:', error);
    res.status(STATUS.INTERNAL_ERROR).render('admin/admin-error', {
      pageTitle: 'Admin Error',
      heading: 'Oops! Something Went Wrong',
      userName: 'Admin',
      imageURL: '/images/admin-avatar.jpg',
      errorMessage: MESSAGES.SALES_REPORT.LOAD_FAILED || 'Error loading sales report'
    });
  }
};


async function generateChartData(orders, period, fromDate, toDate) {
  const chartData = { labels: [], revenue: [], orderCount: [] };

  if (period === 'daily') {
    for (let i = 0; i < 24; i++) {
      chartData.labels.push(`${i}:00`);
      const hourOrders = orders.filter(o => new Date(o.createdOn).getHours() === i);
      chartData.orderCount.push(hourOrders.length);
      chartData.revenue.push(hourOrders.reduce((s, o) => s + (o.finalAmount || 0), 0));
    }
  }
  else if (period === 'weekly') {
    for (let i = 6; i >= 0; i--) {
      const date = moment().subtract(i, 'days');
      chartData.labels.push(date.format('ddd'));
      const dayOrders = orders.filter(o => moment(o.createdOn).isSame(date, 'day'));
      chartData.orderCount.push(dayOrders.length);
      chartData.revenue.push(dayOrders.reduce((s, o) => s + (o.finalAmount || 0), 0));
    }
  }
  else if (period === 'monthly') {
    for (let i = 3; i >= 0; i--) {
      const weekStart = moment().subtract((i + 1) * 7, 'days');
      const weekEnd = moment().subtract(i * 7, 'days');
      chartData.labels.push(`Week ${4 - i}`);
      const weekOrders = orders.filter(o => {
        const d = moment(o.createdOn);
        return d.isBetween(weekStart, weekEnd, 'day', '[]');
      });
      chartData.orderCount.push(weekOrders.length);
      chartData.revenue.push(weekOrders.reduce((s, o) => s + (o.finalAmount || 0), 0));
    }
  }
  else if (period === 'yearly') {
    for (let i = 0; i < 12; i++) {
      const month = moment().month(i);
      chartData.labels.push(month.format('MMM'));
      const monthOrders = orders.filter(o => {
        const d = moment(o.createdOn);
        return d.month() === i && d.year() === moment().year();
      });
      chartData.orderCount.push(monthOrders.length);
      chartData.revenue.push(monthOrders.reduce((s, o) => s + (o.finalAmount || 0), 0));
    }
  }
  else if (period === 'custom') {
    const days = moment(toDate).diff(moment(fromDate), 'days') + 1;

    if (days <= 7) {
      for (let i = 0; i < days; i++) {
        const date = moment(fromDate).add(i, 'days');
        chartData.labels.push(date.format('MMM DD'));
        const dayOrders = orders.filter(o => moment(o.createdOn).isSame(date, 'day'));
        chartData.orderCount.push(dayOrders.length);
        chartData.revenue.push(dayOrders.reduce((s, o) => s + (o.finalAmount || 0), 0));
      }
    } else if (days <= 60) {
      const weeks = Math.ceil(days / 7);
      for (let i = 0; i < weeks; i++) {
        const weekStart = moment(fromDate).add(i * 7, 'days');
        const weekEnd = moment(fromDate).add((i + 1) * 7, 'days').subtract(1, 'second');
        chartData.labels.push(weekStart.format('MMM DD'));
        const weekOrders = orders.filter(o => {
          const d = moment(o.createdOn);
          return d.isSameOrAfter(weekStart) && d.isSameOrBefore(weekEnd);
        });
        chartData.orderCount.push(weekOrders.length);
        chartData.revenue.push(weekOrders.reduce((s, o) => s + (o.finalAmount || 0), 0));
      }
    } else {
      let current = moment(fromDate).startOf('month');
      while (current.isSameOrBefore(toDate)) {
        chartData.labels.push(current.format('MMM YYYY'));
        const monthOrders = orders.filter(o => moment(o.createdOn).isSame(current, 'month'));
        chartData.orderCount.push(monthOrders.length);
        chartData.revenue.push(monthOrders.reduce((s, o) => s + (o.finalAmount || 0), 0));
        current.add(1, 'month');
      }
    }
  }

  return chartData;
}

async function getBestSellingProducts(filter, limit = 10) {
  try {
    const result = await Order.aggregate([
      { $match: filter },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: '$orderItems.product',
          totalQuantity: { $sum: '$orderItems.quantity' },
          totalRevenue: { $sum: { $multiply: ['$orderItems.purchasePrice', '$orderItems.quantity'] } },
          productName: { $first: '$orderItems.productName' },
          productImage: { $first: '$orderItems.productImage' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit }
    ]);

    return result.map(p => ({
      productId: p._id,
      name: p.productName,
      image: p.productImage,
      totalQuantity: p.totalQuantity,
      totalRevenue: p.totalRevenue.toFixed(2)
    }));
  } catch (err) {
    console.error('Best products error:', err);
    return [];
  }
}

async function getBestSellingCategories(filter, limit = 10) {
  try {
    const result = await Order.aggregate([
      { $match: filter },
      { $unwind: '$orderItems' },
      {
        $lookup: { from: 'products', localField: 'orderItems.product', foreignField: '_id', as: 'product' }
      },
      { $unwind: '$product' },
      {
        $lookup: { from: 'categories', localField: 'product.category', foreignField: '_id', as: 'category' }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$category._id',
          name: { $first: '$category.categoryName' },
          image: { $first: '$category.image' },
          totalQuantity: { $sum: '$orderItems.quantity' },
          totalRevenue: { $sum: { $multiply: ['$orderItems.purchasePrice', '$orderItems.quantity'] } },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit }
    ]);

    return result.map(c => ({
      categoryId: c._id,
      name: c.name || 'Unknown',
      image: c.image,
      totalQuantity: c.totalQuantity,
      totalRevenue: c.totalRevenue.toFixed(2),
      orderCount: c.orderCount
    }));
  } catch (err) {
    console.error('Best categories error:', err);
    return [];
  }
}

export const downloadSalesReport = async (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');

  try {
    const { type, period, startDate, endDate } = req.query;
    const range = buildDateRange(period, startDate, endDate);
    const filter = { status: 'delivered', createdOn: { $gte: range.from, $lte: range.to } };

    const orders = await Order.find(filter).populate('user', 'name email').sort({ createdOn: -1 }).lean();

    const totalOrders = orders.length;
    const totalAmount = orders.reduce((s, o) => s + (o.finalAmount || 0), 0);
    const totalDiscount = orders.reduce((s, o) => s + (o.discount || 0) + (o.couponDiscount || 0), 0);

    if (type === 'pdf') await generatePDFReport(res, orders, { totalOrders, totalAmount, totalDiscount, periodLabel: range.label });
    else if (type === 'excel') await generateExcelReport(res, orders, { totalOrders, totalAmount, totalDiscount, periodLabel: range.label });
    else {
      return res.status(STATUS.BAD_REQUEST).send(MESSAGES.COMMON.INVALID_REQUEST || 'Invalid report type');
    }
  } catch (err) {
    console.error('Download sales report error:', err);
    res.status(STATUS.INTERNAL_ERROR).send(MESSAGES.SALES_REPORT.DOWNLOAD_FAILED || 'Error generating report');
  }
};

async function generatePDFReport(res, orders, stats) {
  const doc = new PDFDocument({ margin: 50 });
  const filename = `sales-report-${moment().format('YYYY-MM-DD-HHmmss')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.fontSize(24).text('Pure Botanica', { align: 'center' });
  doc.fontSize(20).text('Sales Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Period: ${stats.periodLabel}`, { align: 'center' });
  doc.text(`Generated: ${moment().format('MMMM DD, YYYY HH:mm')}`, { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(14).text('Summary', { underline: true });
  doc.fontSize(11);
  doc.text(`Total Orders: ${stats.totalOrders}`);
  doc.text(`Total Revenue: ₹${stats.totalAmount.toFixed(2)}`);
  doc.text(`Total Discount: ₹${stats.totalDiscount.toFixed(2)}`);
  doc.text(`Avg Order: ₹${(stats.totalAmount / stats.totalOrders || 0).toFixed(2)}`);
  doc.moveDown(2);

  const tableTop = doc.y;
  const colWidths = [80, 70, 100, 80, 80, 80];
  const headers = ['Order ID', 'Date', 'Customer', 'Amount', 'Discount', 'Final'];
  doc.fontSize(10);
  headers.forEach((h, i) => {
    const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.text(h, x, tableTop, { width: colWidths[i] });
  });
  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

  let y = tableTop + 25;
  doc.fontSize(9);
  orders.forEach(o => {
    if (y > 700) { doc.addPage(); y = 50; }
    const row = [
      o.orderId || 'N/A',
      moment(o.createdOn).format('MMM DD, YYYY'),
      o.user?.name || 'Unknown',
      `₹${o.totalPrice?.toFixed(2) || '0.00'}`,
      `₹${((o.discount || 0) + (o.couponDiscount || 0)).toFixed(2)}`,
      `₹${o.finalAmount?.toFixed(2) || '0.00'}`
    ];
    row.forEach((cell, i) => {
      const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(cell, x, y, { width: colWidths[i] });
    });
    y += 20;
  });

  doc.fontSize(8).text('Computer-generated. No signature required.', 50, doc.page.height - 50, { align: 'center' });
  doc.end();
}

async function generateExcelReport(res, orders, stats) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sales Report');
  sheet.mergeCells('A1:H1'); sheet.getCell('A1').value = 'Pure Botanica - Sales Report'; sheet.getCell('A1').font = { bold: true, size: 16 }; sheet.getCell('A1').alignment = { horizontal: 'center' };
  sheet.mergeCells('A2:H2'); sheet.getCell('A2').value = `Period: ${stats.periodLabel}`; sheet.getCell('A2').alignment = { horizontal: 'center' };
  sheet.addRow([]); sheet.addRow(['Summary']);
  sheet.addRow(['Total Orders', stats.totalOrders]);
  sheet.addRow(['Total Revenue', `₹${stats.totalAmount.toFixed(2)}`]);
  sheet.addRow(['Total Discount', `₹${stats.totalDiscount.toFixed(2)}`]);
  sheet.addRow(['Avg Order', `₹${(stats.totalAmount / stats.totalOrders || 0).toFixed(2)}`]);
  sheet.addRow([]);

  const header = sheet.addRow(['Order ID', 'Date', 'Customer', 'Email', 'Total', 'Discount', 'Coupon', 'Final']);
  header.font = { bold: true }; header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

  orders.forEach(o => {
    sheet.addRow([
      o.orderId || 'N/A',
      moment(o.createdOn).format('YYYY-MM-DD'),
      o.user?.name || 'Unknown',
      o.user?.email || 'N/A',
      o.totalPrice?.toFixed(2) || '0.00',
      o.discount?.toFixed(2) || '0.00',
      o.couponDiscount?.toFixed(2) || '0.00',
      o.finalAmount?.toFixed(2) || '0.00'
    ]);
  });

  sheet.columns.forEach(c => c.width = 15);
  const filename = `sales-report-${moment().format('YYYY-MM-DD-HHmmss')}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}