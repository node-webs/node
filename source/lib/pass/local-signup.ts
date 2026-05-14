import bcrypt from 'bcrypt';
import { Strategy as LocalStrategy } from 'passport-local';

import db from '../mysql2';
import { SignUpUser } from '../intf/user.intf';

const localSignin = new LocalStrategy(
    { usernameField: 'email', passwordField: 'password', passReqToCallback: true, },
    async (req, email, password, done) => {
        try {
            const userData: SignUpUser = req.body;

            // 이메일 중복 확인
            const sqlCheck = 'SELECT id FROM users WHERE email = ?';
            const rows = await db.select<SignUpUser>(sqlCheck, [email]);

            if (rows.length > 0) {
                return done(null, false, { message: '이미 가입된 이메일입니다.' });
            }

            // 비밀번호 해싱
            const hashedPassword = await bcrypt.hash(password, 12);

            // 데이터 가공 (PetType, Array -> String)
            const petTypeString = Array.isArray(userData.petType)
                ? userData.petType.join(',')
                : userData.petType;

            // DB 저장
             const sqlInsert = 'INSERT INTO users (email, password, name, phoneNumber, petType, provider) VALUES (?, ?, ?, ?, ?, "local")';
             const result = await db.execute(sqlInsert, [
                email,
                hashedPassword,
                userData.name || null,
                userData.phoneNumber || null,
                petTypeString || ''
            ]);

            const newUser = { id: result.insertId, email };
            return done(null, newUser);
        } catch (err) {
            return done(err);
        }
    }
);

export default localSignin;