const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema')
require('dotenv').config()

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3002/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    console.log('=== Google Strategy Callback ===');
    console.log('Profile ID:', profile.id);
    console.log('Profile email:', profile.emails[0].value);
    
    try {
      const existingUser = await User.findOne({ googleId: profile.id });
      if (existingUser) {
        console.log('Existing user found:', existingUser._id);
        return done(null, existingUser);
      }

      const newUser = new User({
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
      });
      await newUser.save();
      console.log('New user created:', newUser._id);
      done(null, newUser);
    } catch (error) {
      console.log('Error in Google strategy:', error);
      done(error, null);
    }
  }
));

passport.serializeUser((user, done) => {
    console.log('=== Serializing User ===');
    console.log('User._id:', user._id);
    done(null, user._id);
});

passport.deserializeUser((id, done) => {
    console.log('=== Deserializing User ===');
    console.log('Looking for user ID:', id);
    User.findById(id)
    .then(user => {
        console.log('Found user:', user);
        done(null, user);
    })
    .catch(err => {
        console.log('Deserialize error:', err);
        done(err, null);
    });
});

module.exports = passport;