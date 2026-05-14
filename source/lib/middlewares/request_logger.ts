import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

import logger from '../logger/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    // 1. 요청 고유 ID 발급 및 IP 추출 (프록시 서버가 앞에 있을 경우 x-forwarded-for 사용)
    const request_id = uuidv4();
    const address_ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

    // 2. 이후 컨트롤러나 미들웨어에서 사용할 수 있도록 req 객체에 보관 (선택 사항)
    // req 객체에 requestId와 ip를 추가하여 이후 미들웨어나 컨트롤러에서 사용할 수 있도록 함, index.d.ts에 추가
    req.request_id = request_id;
    req.address_ip = address_ip;

    // 3. API 요청 진입 로그 예시
    logger.info(`[API Request] ${req.method} ${req.url}`, {
        request_id,
        address_ip,
        category: 'HTTP'
    });

    next();
};
    