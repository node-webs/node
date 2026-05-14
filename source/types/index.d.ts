import * as express from 'express';
// express 라이브러리 내부의 모든 기능(클래스, 함수, 타입 등)을 한꺼번에 가져와
// express라는 이름의 객체로 묶어서 사용하겠다

declare global {
    namespace Express {
        interface Request {
            request_id?: string;
            address_ip?: string;
        }
    }
}

declare module 'express-session' {
    interface SessionData {
        csrfToken?: string;
        user?: {
            id: string;
            email: string;
        };
    }
}

declare global {
    namespace Express {
        interface Locals {
            // csrfToken1?: string;
            // csrfToken2?: string;
            // isSignin?: boolean;
            // title?: string;
            // user?: IUser;
        }
        // Passport 라이브러리를 사용한다면, Express.User 인터페이스를 사용
        // User를 사용하지 않고, 따로 타입이 정해져 있다면 ILoginUser와 같이 병합합니다.
        // interface User extends IUser {}
    }
}