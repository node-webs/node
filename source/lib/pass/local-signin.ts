import bcrypt from 'bcrypt';
import { Strategy as LocalStrategy } from 'passport-local';

import db from '../mysql2';
import { SignInUser } from '../intf/user.intf';

const localSignin = new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
        try {
            const [user] = await db.select<any>('SELECT * FROM users WHERE email = ?', [email]);
            // const user = await User.findOne({ email });
            
            if (!user) {
                return done(null, false, { message: '존재하지 않는 유저입니다.' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return done(null, false, { message: '비밀번호가 일치하지 않습니다.' });
            }

            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
);

export default localSignin;