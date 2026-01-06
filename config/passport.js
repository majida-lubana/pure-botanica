

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/userSchema.js';

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL
} = process.env;

console.log("GOOGLE:", process.env.GOOGLE_CLIENT_ID ? "OK" : "MISSING");


if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn(' Google OAuth disabled: missing client ID or secret');
} else {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL || 'http://localhost:3002/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;

          let user = await User.findOne({ googleId: profile.id });

          if (!user) {
            user = await User.create({
              googleId: profile.id,
              name: profile.displayName,
              email,
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
}


passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
