
const moment = require('moment');

const TODAY = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

const setRange = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(23, 59, 59, 999);
  return { $gte: s, $lte: e };
};

exports.buildDateFilter = (quickSelect, startDate, endDate) => {
  const today = TODAY();

  if (quickSelect === 'custom' && startDate && endDate) {
    return { createdAt: setRange(startDate, endDate) };
  }

  let start;
  switch (quickSelect) {
    case 'today':
      start = new Date(today);
      start.setHours(0, 0, 0, 0);
      return { createdAt: setRange(start, today) };
    case 'last7days':
      start = new Date(today);
      start.setDate(today.getDate() - 6);
      return { createdAt: setRange(start, today) };
    case 'last30days':
      start = new Date(today);
      start.setDate(today.getDate() - 29);
      return { createdAt: setRange(start, today) };
    case 'year':
      start = new Date(today.getFullYear(), 0, 1);
      return { createdAt: setRange(start, today) };
    default: {
      // fallback – last 30 days
      const def = new Date(today);
      def.setDate(today.getDate() - 29);
      return { createdAt: setRange(def, today) };
    }
  }
};

exports.buildCompareFilter = (dateFilter, compareWith) => {
  if (compareWith === 'none') return null;
  const { $gte: start, $lte: end } = dateFilter.createdAt;
  const duration = end - start;

  if (compareWith === 'prevPeriod') {
    const prevStart = new Date(start.getTime() - duration);
    const prevEnd   = new Date(end.getTime() - duration);
    return { createdAt: setRange(prevStart, prevEnd) };
  }

  const prevStart = new Date(start);
  prevStart.setFullYear(start.getFullYear() - 1);
  const prevEnd = new Date(end);
  prevEnd.setFullYear(end.getFullYear() - 1);
  return { createdAt: setRange(prevStart, prevEnd) };
};