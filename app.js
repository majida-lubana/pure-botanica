const express = require('express');
const app = express();
const dotenv = require('dotenv').config();
const session = require('express-session');
const passport = require('passport');
require('./config/passport');
const db = require('./config/db');
const path = require('path');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const MongoStore = require('connect-mongo');


db();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  res.set('cache-control', 'no-store');
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Update this line to match the correct directory
app.use('/uploads/product-images', express.static(path.join(__dirname, 'public/uploads/product-images')));

app.use('/', userRouter);
app.use('/admin', adminRouter);

// 404 Handler
app.use((req, res, next) => {
  res.status(404).render('user/page-404', {
    message: 'Page not found',
    error: process.env.NODE_ENV === 'development' ? {} : {}
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('user/page-404', {
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});








module.exports = app;