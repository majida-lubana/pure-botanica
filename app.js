



import express from 'express';
import session from 'express-session';
import passport from 'passport';
import './config/passport.js';


import connectDB from './config/db.js'; 

import path from 'path';
import { fileURLToPath } from 'url';

import userRouter from './routes/userRouter.js';
import adminRouter from './routes/adminRouter.js';

import morgan from 'morgan';
import logger from './utils/logger.js';

import MongoStore from 'connect-mongo';
import expressLayouts from 'express-ejs-layouts';


const app = express();
app.set('trust proxy', 1);


app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


connectDB();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(expressLayouts);
app.set('layout', false); 


app.use(express.static(path.join(__dirname, 'public')));



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
    secure: false, 
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});


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
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});




app.use('/admin', adminSession, adminRouter);


app.use(userSession);
app.use(passport.initialize());
app.use(passport.session());
app.use('/', userRouter);


app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).render('user/page-404', { 
    pageTitle: 'Error',
    message: 'Something went wrong!' 
  });
});


app.use((req, res) => {
  res.status(404).render('user/page-404', {
    pageTitle: 'Page Not Found'
  });
});

export default app;