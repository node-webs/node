import path from 'path';
import nunjucks from 'nunjucks';
import passport from 'passport';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import express, { Express } from 'express';

// [ import ]
import './lib/utils/env';
import passportConfig from './lib/pass/passport';
import { CsrfPublish } from './lib/middlewares/csrf';
import { morganMiddleware } from './lib/logger/morgan';
import { requestLogger } from './lib/middlewares/request_logger';
import { errorHandler, notFoundHandler } from './lib/errors/handler.error';

import webRouter from './web/web.router';

// [ Express ]
const app: Express = express();
app.set("port", process.env.PORT || 3000);

// [ Nunjucks ]
app.engine('pet', nunjucks.render);
app.set("view engine", "pet");
const env = nunjucks.configure(path.join(process.cwd(), "html"), {
    express: app, autoescape: true, watch: true,
    // __dirname: 현재 파일(index.ts 등)이 위치한 폴더 기준
    // process.cwd(): 노드 프로세스가 실행된 루트 폴더(package.json이 있는 곳) 
});

// [ Passport 전략 사전 초기화 ]
passportConfig();

// [ 정적파일 ]
app.use(express.static(path.join(process.cwd(), "statics")));
app.use("/script", express.static(path.join(process.cwd(), "templates", "aset")));

// [ 데이터 파싱 ]
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// [ 쿠키 서명에 사용할 비밀 키, 서명된 쿠키 사용 시 필요 ]
app.use(cookieParser(process.env.COOKIE_SECRET));

// [ 공통 미들웨어 ]
app.use(requestLogger);
app.use(morganMiddleware);

// [ 세션 설정 ]
app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: process.env.COOKIE_SECRET || 'your-secret-key',
    cookie: { 
        httpOnly: true,
        sameSite: 'strict',
        secure: false,
        maxAge: 1000 * 60 * 60   // 1시간 유지
    }
}));

// [ Passport ]
app.use(passport.initialize()); // req 객체에 passport 설정을 초기화
app.use(passport.session()); // req.session 객체에 저장된 정보를 바탕으로 passport.deserializeUser를 호출하여 req.user를 생성

app.use(CsrfPublish);
app.use('/', webRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(app.get('port'), () => {
  console.log(`Server is running on http://localhost:${app.get('port')}`);
});