import passport from 'passport';
import { Request, Response, NextFunction } from 'express';

import db from '../lib/mysql2';
import { EmailCheckUser } from '../lib/intf/user.intf';
import { AppError, DatabaseError } from '../lib/errors/Exception';

const renderSignPage = (isSignin: boolean) => (req: Request, res: Response) => {
    try {
        const title = isSignin ? 'PET : 로그인' : 'PET : 회원가입';
        res.render('sign', { title, isSignin });
    } catch (error: any) {
        // 표준화된 에러 처리 루틴
        let statusCode = 500; // 페이지 렌더링 실패는 보통 500(Internal Server Error)이 적절합니다.
        let message = '서버 내부 오류가 발생했습니다.';
        
        if (error instanceof DatabaseError) {
            // DB 에러일 경우의 특수 로직 (로그 남기기 등)
            console.error(`[DB_ERROR_CODE]: ${error.code}`);
            message = '데이터베이스 연결에 문제가 발생했습니다.';
        } else if (error instanceof AppError) {
            // 기타 정의된 앱 에러
            statusCode = error.statusCode;
            message = error.message;
        }

        res.status(500).json({
            success: false,
            message: message,
            // 개발 환경에서만 에러 코드 노출 가능
            code: error instanceof AppError ? error.code : 'UNKNOWN'
        });
    }
};

const page = {
    signin: renderSignPage(true),
    signup: renderSignPage(false),
    signin2: (req: Request, res: Response) => {
        try {
            res.render('sign', { title: 'PET : 로그인', isSignin: true });
        } catch (error: any) {
            // 인증 실패 응답 (401: Unauthorized)
            return res.status(401).json({
                success: false,
                message: error.message || 'signup fail page'
            });
        }
    },
    signup2: (req: Request, res: Response) => {
        try {
            res.render('sign', { title: 'PET : 회원가입', isSignin: false });
        } catch (error: any) {
            // 인증 실패 응답 (401: Unauthorized)
            return res.status(401).json({
                success: false,
                message: error.message || 'signup fail page'
            });
        }        
    }
}

const process = {
    checkEmail: async (req: Request, res: Response) => {
        try {
            const { email } = req.query;
            console.log('Email :: ', email);

            if (!email) {
                return res.status(400).json({ 
                    isAvailable: false, 
                    message: '이메일을 입력해주세요.' 
                });
            }

            // 1. 해당 이메일이 존재하는지 SELECT 쿼리 실행
            const sql = 'SELECT id FROM users WHERE email = ?';
            const rows = await db.select<EmailCheckUser>(sql, [email]);
            
            // 2. 검색 결과가 없으면(rows.length === 0) 사용 가능
            if (rows.length === 0) {
                return res.status(200).json({
                    isAvailable: true,
                    message: '사용 가능한 이메일입니다.'
            });
            } else {
                return res.status(400).json({
                    isAvailable: false,
                    message: '이미 사용 중인 이메일입니다.'
                });
            }

        } catch (error: any) {
            // 인증 실패 응답 (401: Unauthorized)
            return res.status(401).json({
                success: false,
                message: error.message || 'check email fail process'
            });
        }
    },
    signin: async (req: Request, res: Response, next:NextFunction) => {
        passport.authenticate('local-signin', (err: any, user: any, info: any) => {
            try {
                // 1. 서버 에러 발생 시
                if (err) {
                    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
                }

                if (!user) {
                    // 인증 실패 시 (비밀번호 불일치 등)
                    return res.status(401).json({ message: info.message });
                }

                  // passport.serializeUser 실행 및 세션 저장
                  req.logIn(user, (loginErr) => {
                    if (loginErr) return next(loginErr);
                    // needsPasswordChange, 프론트에서 이 값을 보고 팝업 실행
                    return res.json({ message: '로그인 성공', user: { id: user.id, email: user.email, needsPasswordChange: user.needsPasswordChange } });

                    // fromt에서 needsPasswordChange가 true면 비밀번호 변경 팝업 띄우기
                    // if (response.user.needsPasswordChange) {
                    // alert('비밀번호를 변경한 지 90일이 지났습니다. 보안을 위해 비밀번호를 변경해주세요!');
                    // 
                });
            } catch (error: any) {
                // 인증 실패 응답 (401: Unauthorized)
                return res.status(401).json({
                    success: false,
                    message: error.message || 'signup fail process'
                });
            }
        })(req, res, next);
        
    },
    signup: async (req: Request, res: Response, next: NextFunction) => {
        passport.authenticate('local-signup', (err: any, user: any, info: any) => {
            try {
                if (err) {
                    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
                }

                if (!user) {
                    // 중복 이메일 등 전략에서 발생한 에러 메시지 반환
                    return res.status(400).json({ 
                        success: false, 
                        message: info ? info.message : '회원가입에 실패했습니다.' 
                    });
                }

                // 가입 성공 후 세션 생성을 원할 경우 (자동 로그인)
                req.logIn(user, (loginErr) => {
                    if (loginErr) return next(loginErr);
                    return res.status(201).json({
                        success: true,
                        message: '회원가입에 성공했습니다.',
                        user: { id: user.id, email: user.email }
                    });
                });
            } catch (error: any) {
                // 인증 실패 응답 (401: Unauthorized)
                return res.status(401).json({
                    success: false,
                    message: error.message || 'signup fail process'
                });
            }
        })(req, res, next);
    }
};

export { page, process };