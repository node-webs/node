import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// CSRF 토큰 발행
const CsrfPublish = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
        if(process.env.NODE_ENV === 'local') {
            console.log('=======================================================================');
            console.log('[CsrfPublish] req.session.csrfToken :: ', req.session.csrfToken);
            console.log('=======================================================================');
        }
    }    
    next();
};

// CSRF 토큰 검증
const CsrfVerify = (req: Request, res: Response, next: NextFunction) => {
    const serverToken = req.session.csrfToken;
    const clientToken = req.headers['x-csrf-token'] || req.body._csrf;

    if(process.env.NODE_ENV === 'local') {
        console.log('=======================================================================');
        console.log('[CsrfVerify] req.session.csrfToken :: ', req.session.csrfToken);
        console.log('[CsrfVerify] req.headers[x-csrf-token] :: ', req.headers['x-csrf-token']);
        console.log('=======================================================================');
    }

    if (!clientToken || serverToken !== clientToken) {
        console.log('error 403 clientToken........');
        return res.status(403).json({
            success: false,
            message: '서버가 바빠서, 명령이 지연되고 있습니다.'
        });
    }
    next();
};

// CSRF 토큰 분할 (프론트엔드 전달용)
const csrfSplitter = (req: Request, res: Response, next: NextFunction) => {
    const fullToken = req.session.csrfToken || '';
    const mid = Math.floor(fullToken.length / 2);
    res.locals.csrfPart1 = fullToken.substring(0, mid);
    res.locals.csrfPart2 = fullToken.substring(mid);
    next();
};

export { CsrfPublish, CsrfVerify, csrfSplitter };