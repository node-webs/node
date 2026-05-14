import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

import logger from '../logger/logger';
import { ErrorFormatter } from './format.error';
import { NotFoundError } from './web.error';

export const errorHandler: ErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    // 에러 핸들러 미들웨어는 Express에서 가장 마지막에 등록되어야 하며,
    // 모든 라우터와 미들웨어에서 발생한 에러를 처리하는 역할을 합니다. 
    // WebError로 정의된 에러는 formatWebError로, 그 외의 예상치 못한 에러는 formatUnknownError로 포맷팅하여 응답합니다.

    // requestLogger 미들웨어에서 주입해둔 requestId와 ipAddress 가져오기 (없으면 헤더/소켓 백업)
    const request_id = (req as any).requestId || (req.headers['x-request-id'] as string) || undefined;
    const ip = (req as any).ipAddress || req.socket.remoteAddress || undefined;

    // 명확한 타입(ErrorResponse 가정)을 지정하거나 에러 방지용 기본값 구조 대입
    let errorResponse: any;
    // 에러 타입 판별 및 표준 포맷팅
    const isWebError = ErrorFormatter.isWebError(err);
    
    if (isWebError) {
        // 관리자가 정의한 커스텀 에러인 경우 (400, 401, 404 등)
        errorResponse = ErrorFormatter.formatWebError(err, request_id);
    } else {
        // 알 수 없는 에러, 예상치 못한 일반 에러인 경우
        // 시스템 예외 또는 런타임 버그 (ReferenceError 등)
        errorResponse = ErrorFormatter.formatUnknownError(err, request_id);
    }

    // 보안을 위해 프로덕션 환경에서는 민감한 정보(details) 제거 후 응답
    // 시스템 내부 정보가 유출되지 않게 방어, 프로덕션 환경일 경우 민감 정보 제거 후 응답
    const finalResponse = ErrorFormatter.sanitizeForProduction(errorResponse);
    // Morgan 미들웨어가 에러 응답 본문을 추적할 수 있도록 보관 (Morgan 스트림 처리용)
    res.locals.body = finalResponse;
    // 클라이언트 응답 전송
    res.status(finalResponse.error.statusCode).json(finalResponse);

    // DatabaseTransport 및 콘솔 포맷팅과 호환되는 Winston 페이로드 빌드
    const logMessage = `[${req.method}] ${req.path} - ${err.message}`;
    const logPayload = {
        request_id,
        ip,
        status_code: errorResponse.error.statusCode,
        code: errorResponse.error.code,
        stack: err.stack || null,
        // 로거 내부의 rest.error 파싱 규칙에 맞추기 위해 에러 객체 구조 전달
        error: {
            statusCode: errorResponse.error.statusCode,
            code: errorResponse.error.code,
            message: err.message,
            details: err.details || null
        }
    };
    
    // 의도된 에러(WebError)와 예외 에러(UnknownError)의 위험도 분기 기록
    if (isWebError) {
        // 400대 유효성 실패, 인증 실패 등은 시스템 경고(warn) 수준으로 기록
        logger.warn(logMessage, logPayload);
    } else {
        // 500대 런타임 버그, DB 단절 등은 심각한 에러(error) 수준으로 기록
        logger.error(logMessage, logPayload);
    }
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
    const error = new NotFoundError(
        `요청한 리소스 ${req.method} ${req.originalUrl}를 찾을 수 없습니다`);
    next(error);
};