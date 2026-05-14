import bcrypt from 'bcrypt';
import passport from 'passport';

import db from '../utils/mysql-2';
// import localSignin from './local-signin';
// import localSignup from './local-signup';
// import { SignInUser, SignUpUser } from '../intf/user.intf';

export default function passportConfig() {
    // 세션 저장/복구 설정
    passport.serializeUser((user: any, done) => {
        done(null, user.id);
    });

    // 세션의 ID로 유저 정보 복구
    passport.deserializeUser(async (id: number, done) => {
        try {
            const [user] = await db.select<any>('SELECT * FROM users WHERE id = ?', [id]);
            done(null, user);
        } catch (err) {
            done(err);
        }
    });

    // 전략 등록
    // passport.use('local-signin', localSignin);
    // passport.use('local-signup', localSignup);
}