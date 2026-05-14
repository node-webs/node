import { Request, Response } from 'express';
import morgan, { StreamOptions } from 'morgan';

import logger from './logger';

// Morgan(HTTP 요청 로거)과 Winston(추정되는 커스텀 logger)을 결합하여,
// HTTP 요청과 응답을 상세하게 기록하는 미들웨어 설정

// token 정의
// 로그에 출력할 단어(토큰)를 직접 만들 수 있습니다.
// 요청 ID와 응답 데이터 요약을 로그에 포함시키기 위해 Morgan의 token 기능을 활용


// HTTP 요청 헤더에서 x-request-id 값을 찾아 로그에 붙입니다.
// 값이 없으면 unknown으로 표시합니다. 분산 시스템에서 하나의 요청을 추적할 때 필수적입니다.
// morgan.token('requestId', (req: Request) => (req.headers['x-request-id'] as string) || 'unknown');

// IP 주소 토큰
// HTTP 요청 헤더에서 IP 주소를 찾아 로그에 붙입니다.
morgan.token('ip', (req: Request) => (req as any).ipAddress || 'unknown');
// requestId
// 추적용 ID 기록동작
morgan.token('requestId', (req: Request) => (req as any).requestId || 'unknown');
// res-data
// 응답 데이터 요약 토큰
// 서버가 클라이언트에게 보낸 응답 데이터를 요약해서 로그에 포함합니다.
morgan.token('res-data', (req: Request, res: Response) => {
    const body = res.locals.body;

    if (!body) return '{}'; // 응답 데이터가 없으면 빈 객체로 표시

    try {
        // 이미 객체라면 그대로 사용, 문자열이라면 파싱
        const parsed = typeof body === 'object' ? body : JSON.parse(body);

        // 데이터 구조화를 위해 통째로 문자열화하여 리턴 (스트림에서 JSON 파싱 예정)
        return JSON.stringify({
            success: parsed.success !== false,
            code: parsed.error?.code || null,
            message: parsed.error?.message || null,
            // 성공 시 data, 실패 시 details 추출 (너무 길면 잘리지 않도록 테이블 구조에 맞춤)
            data: parsed.success !== false ? (parsed.data || null) : (parsed.error?.details || null)
        });
    } catch {
        return JSON.stringify({ success: true, isRaw: true }); // 응답 데이터가 JSON이 아니거나 파싱에 실패하면 원본 문자열을 그대로 로그에 포함 (실패했음을 나타내는 isRaw 플래그 추가)
    }  
});

// JSON 포맷으로 들어온 요청을 파싱
const stream: StreamOptions = {
    // Morgan이 생성한 로그 문자열을 어디로 보낼지 결정하는 통로입니다.
    // 콘솔에 그냥 찍는 대신, 프로젝트의 공통 logger로 전달하고 있습니다.
    write: (message: string) => {
        try {
            const rawLog = JSON.parse(message.trim());
            const statusCode = parseInt(rawLog.status || '0', 10);

            // 내포된 응답 데이터 JSON 파싱
            let resData: any = {};
            try { resData = JSON.parse(rawLog.resData); } catch { resData = {}; }
            
            // DB 컬럼에 맞출 변수 추출
            const success = resData.success !== false;
            const logMessage = `[HTTP] ${rawLog.method} ${rawLog.url} ${statusCode} (${rawLog.responseTime} ms)`;
            
            // DB에 깔끔하게 들어갈 JSON 메타데이터 빌드
            const dbMeta = {
                method: rawLog.method,
                url: rawLog.url,
                responseTime: parseFloat(rawLog.responseTime),
                // 데이터 혹은 에러 디테일 저장
                payload: resData.data || null 
            };

            // Winston 로거로 보낼 파라미터 구성 (테이블 컬럼 명과 일치시킴)
            const logPayload = {
                request_id: rawLog.requestId,
                ip: rawLog.ip,
                status_code: statusCode,
                success: success,
                code: resData.code || null,
                stack: null, // HTTP 정상/클라이언트 에러 로그는 stack이 보통 null입니다.
                meta: dbMeta // JSON 컬럼으로 바인딩될 객체
            };

            // 상태 코드에 따른 로그 레벨 분기 및 데이터 전송
            if (statusCode >= 500) {
                // logger.error는 Winston의 메서드로, 로그 레벨이 'error'인 로그를 기록합니다.
                // 첫 번째 인자는 로그 메시지, 두 번째 인자는 추가 메타데이터입니다.
                logger.error(resData.message || logMessage, { ...logPayload, type: 'HTTP_SERVER_ERROR' });
            } else if (statusCode >= 400) {
                // logger.warn는 Winston의 메서드로, 로그 레벨이 'warn'인 로그를 기록합니다.
                // 클라이언트 오류는 경고 수준으로 기록합니다.
                logger.warn(resData.message || logMessage, { ...logPayload, type: 'HTTP_CLIENT_ERROR' });
            } else {
                // logger.info는 Winston의 메서드로, 로그 레벨이 'info'인 로그를 기록합니다.
                // 성공적인 요청은 정보 수준으로 기록합니다.
                logger.info(logMessage, { ...logPayload, type: 'HTTP_SUCCESS' });

                //logger.info(message, logPayload)를 호출할 때 넘겨준 logPayload 객체 속성들은
                // Winston의 MySQL Transport(예: winston-mysql) 등을 통해 DB에 저장될 때 자동으로 매핑됩니다.
            }
        } catch (error) {
            // Morgan 로그 파싱 자체 실패 시 예외 처리
            logger.error('Failed to parse morgan log', { error, type: 'LOG_SYSTEM_ERROR' });
        }
    },
};

// 포맷 정의 및 미들웨어 내보내기
// const morganFormat = '[:requestId] [:ip] :method :url :status :response-time ms :res-data | :status';
const morganFormat = JSON.stringify({
    requestId: ':requestId',
    ip: ':ip',
    method: ':method',
    url: ':url',
    status: ':status',
    responseTime: ':response-time',
    resData: ':res-data' // 위에서 정의한 객체 문자열이 치환됨
});

// app.use(requestLogger);    여기서 requestId와 ipAddress를 생성 및 req에 주입
// app.use(morganMiddleware)  여기서 morganMiddleware가 req에서 requestId와 ipAddress를 읽어서 로그에 포함시키고, 응답 데이터도 요약해서 로그에 붙입니다.
// 모든 HTTP 요청이 들어오고 나갈 때마다 이 규칙에 맞춰 정돈된 로그가 남게 됩니다.

// morgan은 "모든 요청에 대한 공통 처리"와 "흐름 가로채기(Hooking)" 때문에 미들웨어로 정의해서 사용
export const morganMiddleware = morgan(morganFormat, { stream });


/*
    사용 중이신 Winston 로거 설정 파일(logger.ts)에서 DB 쿼리를 직접 짜거나
    Transport를 붙이실 때 아래 명칭으로 매핑하시면 컬럼에 정확히 삽입됩니다.
    
    info.timestamp  -> timestamp (Winston에서 제공하는 현재 시간)
    info.level -> level
    info.message -> message
    info.success -> success
    info.request_id -> request_id
    info.ip -> ip
    info.status_code -> status_code
    info.code -> code
    info.stack -> stack (컨트롤러 내 catch(e) 등에서 logger.error(e) 호출 시 주입 가능)
    JSON.stringify(info.meta) -> meta
*/