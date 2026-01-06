// app.js (recommended to keep as app.js with "type": "module" in package.json)



import express from 'express';
import session from 'express-session';
import passport from 'passport';
import './config/passport.js';


import connectDB from './config/db.js'; // Renamed to connectDB for clarity

import path from 'path';
import { fileURLToPath } from 'url';

import userRouter from './routes/userRouter.js';
import adminRouter from './routes/adminRouter.js';

import morgan from 'morgan';
import logger from './utils/logger.js';

import MongoStore from 'connect-mongo';
import expressLayouts from 'express-ejs-layouts';


const app = express();

app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

// __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to Database
connectDB();

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prevent caching of sensitive pages
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(expressLayouts);
app.set('layout', false); // Disable default layout unless explicitly set

// Static Files
app.use(express.static(path.join(__dirname, 'public')));


// User Session Middleware
const userSession = session({
  name: 'userSessionId',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'userSessions',
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});

// Admin Session Middleware
const adminSession = session({
  name: 'adminSessionId',
  secret: process.env.ADMIN_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'adminSessions',
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});

// Routes

// Admin Routes (with separate session)
app.use('/admin', adminSession, adminRouter);

// User Routes (with Passport + user session)
app.use(userSession);
app.use(passport.initialize());
app.use(passport.session());
app.use('/', userRouter);

// Global Error Handler (for unexpected errors)
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).render('user/page-404', { 
    pageTitle: 'Error',
    message: 'Something went wrong!' 
  });
});

// 404 Handler (for undefined routes)
app.use((req, res) => {
  res.status(404).render('user/page-404', {
    pageTitle: 'Page Not Found'
  });
});

export default app;