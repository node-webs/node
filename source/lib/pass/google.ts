import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import db from '../../mysql2';

export const googleStrategy = new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: '/auth/google/callback',
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0].value;
      let [user] = await db.select<any>('SELECT * FROM users WHERE google_id = ?', [profile.id]);

      if (!user) {
        // 회원가입 처리
        const result = await db.execute(
          'INSERT INTO users (google_id, email, name) VALUES (?, ?, ?)',
          [profile.id, email, profile.displayName]
        );
        [user] = await db.select<any>('SELECT * FROM users WHERE id = ?', [result.insertId]);
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
);
