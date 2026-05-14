import URL from 'url';
import path from 'path';
import winston from 'winston';
import Transport from 'winston-transport';
import DailyRotateFile from 'winston-daily-rotate-file';

/*
    Winston-Transport 사용 이유
    npm install winston winston-daily-rotate-file
    1. 다중 출력 (Multiple Transports):
       로그를 콘솔(Console)에 출력하는 동시에 파일(File)로 저장하거나,
       DB/외부 모니터링 서비스(DataDog, Cloud Logging)로 동시에 전송할 수 있습니다.
    2. 파일 로테이션 (DailyRotateFile):
       일자별로 로그 파일을 생성하여 대용량 로그 파일을 효율적으로 관리하고 저장 공간 문제를 해결합니다.
    3. 로그 레벨 관리:
       Error, Warn, Info, Debug 등 중요도에 따라 로그를 분류하여 저장할 수 있습니다.
    4. 구조화된 로그 (JSON):
       로그를 JSON 형식으로 남겨 가독성을 높이고, 분석 툴(ELK Stack 등)에서 처리하기 쉽게 만듭니다.
    5. 서비스 안정성:
       console.log는 서버 종료 시 기록이 사라질 수 있지만, Winston은 파일에 안전하게 저장하여
       디버깅 및 에러 추적을 용이하게 합니다.
*/

// Custom Transport(출력 방식) 정의
class DatabaseTransport extends Transport {
    // winston-transport가 제공하는 기본 Transport를 상속받아,
    // 로그를 MySQL 데이터베이스에 직접 저장할 수 있는 커스텀 저장소를 정의

    // 데이터베이스 연결 풀(pool) 객체를 임시 보관할 변수입니다.
    // 최초 1회만 DB 모듈을 불러오기 위해(싱글톤 패턴) 사용, 지연 로딩된 DB 풀을 캐싱할 변수
    private dbPool: any = null;

    constructor(opts?: Transport.TransportStreamOptions) {
        // 클래스 생성자입니다.
        // 상위 클래스(Transport)의 생성자를 호출하면서 설정 옵션(opts)을 그대로 전달
        super(opts);
    }

    // DB 모듈을 최초 1회만 로드하는 헬퍼 메서드
    private async getDatabase() {
        // 데이터베이스 인스턴스를 가져오는 내부 비동기 메서드
        if (!this.dbPool) {
            // 만약 기존에 캐싱해 둔 dbPool 변수가 비어 있다면(최초 로그 기록 시점) 아래 블록을 실행

            // 지연 로딩 방식
            // DB 모듈을 동적으로 import하여, DB 커넥션이 필요한 시점에만 로드하도록 최적화
            // 이렇게 하면 DB 커넥션이 필요한 로그가 발생했을 때만 DB 모듈이 로드되고, 초기 로딩 시점에는 DB 커넥션이 필요하지 않은 로그들은 빠르게 처리할 수 있습니다.
            // 서로가 서로의 생성을 무한히 기다리는 교착 상태에 빠지거나 마비되는 상황을 방지할 수 있습니다.

            // import 문 대신 필요한 순간에 동적으로 ./mysql-2 파일을 불러옵니다.
            // 초기 로딩 성능 최적화 및 로거-DB 모듈 간 상호 참조 교착 상태(Circular Dependency)를 막아줍니다.
            const dbModule = await import('./mysql-2');
            // 모듈이 export default 구조인지 일반 export 구조인지 판별하여
            // 실제 풀(Pool) 객체를 dbPool 변수에 할당
            this.dbPool = dbModule.default || dbModule;
        }
        return this.dbPool; // 데이터베이스 풀 객체를 반환
    }

    async log(info: any, callback: () => void) {
        // logger.info() 등이 호출될 때 Winston 시스템에 의해 실행되는 핵심 가로채기 메서드입니다.
        // info는 로그 데이터이며, 작업 완료 후 callback()을 호출해 주어야 다음 로직으로 넘어갑니다.

        // Winston이 로그를 처리하는 비동기 방식에 맞춰, 로그 기록이 완료된 후 Winston에게 알리는 역할을 합니다.
        // Node.js 이벤트 루프의 다음 틱에서 로그 처리가 성공했음을 이벤트를 통해 외부에 알립니다.
        setImmediate(() => this.emit('logged', info));

        // 무한 루프 방지 필터입니다.
        // DB 커넥션 및 풀 관련 로그는 DB에 쓰지 않고 통과
        // DB 연결 상태나 DB 에러 로그를 다시 DB에 저장하려고 시도하면
        // 또다시 에러 로그가 생성되어 서버가 뻗을 수 있으므로,
        // 이 조건에 걸리면 DB 저장 처리를 건너뛰고(return callback()) 종료합니다.
        if (info.message && (
            info.message.includes('🔌 신규 DB 연결 생성') || 
            info.message.includes('⚠ DB 연결 풀 포화') ||
            info.message.includes('[DB Select Error]') ||
            info.message.includes('[DB Execute Error]')
        )) {
            return callback();
        }

        try {
            // 지연 로딩 헬퍼 메서드를 호출하여 안전하게 데이터베이스 연결 객체를 가져옵니다.
            const db = await this.getDatabase();

            // 미들웨어 및 Morgan 스트림과 매핑을 위해 'request_id' 명시적 추출
            const { timestamp, level, message, request_id, ip, stack, ...rest } = info;

            // 데이터베이스 테이블 컬럼 구조에 매핑하기 위해 초기 변수 기본값 설정
            let isSuccess = true;
            let statusCode: number | null = null;
            let code: string | null = null;
            let metaData: any = null;
            
            if (rest.error && typeof rest.error === 'object') {
                // [ Error ] - info.error 객체가 존재하는 경우

                isSuccess = false;
                const errObj = rest.error as { statusCode?: number; code?: string; message?: string; details?: any };

                // 에러 객체 안에서 응답 상태 코드(예: 400)와
                // 비즈니스 커스텀 에러 코드(예: 'INVALID_PASSWORD')를 추출
                statusCode = errObj.statusCode || null;
                code = errObj.code || null;

                // 에러 상세 내용(details)과 그 외 부가 로그 정보(extraMeta)를 수집하고, 가공
                // 이 과정에서 불필요하게 겹치는 원본 error 속성은 도려냅니다.
                const details = errObj.details || {};
                const extraMeta = { ...rest };
                delete extraMeta.error; // 중복 제거

                // 수집된 세부 내용인 details와 extraMeta를 합쳐서 하나의 객체로 묶은 뒤,
                // JSON 문자열로 변환하여 metaData 변수에 할당합니다. 데이터가 없다면 null을 유지합니다.
                const combinedMeta = { ...details, ...extraMeta };
                metaData = Object.keys(combinedMeta).length ? JSON.stringify(combinedMeta) : null;
            }
            else if (rest.data !== undefined) {
                // [ Success ] - info.data 객체가 존재하는 경우
                
                isSuccess = true;

                // data 속성이 이미 JSON 객체라면 통째로 직렬화하고, 문자열이나 숫자 같은
                // 원시 타입이라면 키값({ data: 값 }) 구조로 감싸서 문자열 형태로 만듭니다.
                metaData = typeof rest.data === 'object' && rest.data !== null
                    ? JSON.stringify(rest.data)
                    : JSON.stringify({ data: rest.data });
            } else {
                // [ GeneralLog ] 인터페이스 패턴 매핑 (기타 일반 로그)
                // 앞선 비즈니스 에러/성공 규격이 아닌 Morgan 스트림 로그나
                // logger.info('서버 구동 시작') 같은 일반 텍스트 로그일 때 도달합니다.

                // Morgan 스트림 로직 측에서 상태 코드가 400 이상일 때 success: false를
                // 수동으로 담아 보냈다면 이를 적용하고, 그 외에는 기본적으로 성공 상태(true)를 적용합니다.
                isSuccess = rest.success !== false;

                // 수동으로 주입된 상태 코드나 커스텀 코드 값이 존재한다면 추출합니다.
                statusCode = rest.statusCode || null;
                code = rest.code || null;

                // 구조 가공을 마쳤으므로 데이터베이스 컬럼에 1:1로 매핑되는
                // 공통 속성들과 내부 제어용 변수(type 등)들을 메타데이터 객체에서 말끔히 도려냅니다.
                const filteredMeta = { ...rest };
                delete filteredMeta.status_code;
                delete filteredMeta.code;
                delete filteredMeta.success;
                delete filteredMeta.type; // 내부 메타 플래그 제거

                // Morgan 스트림 로직이 미리 온전하게 정제해서 전송해 준 meta 데이터 객체가
                // 존재하면 이를 그대로 쓰고, 없다면 남은 찌꺼기 메타데이터들을 취합해 JSON 텍스트로 변환합니다.
                const finalMeta = filteredMeta.meta ? filteredMeta.meta : filteredMeta;
                metaData = Object.keys(finalMeta).length ? JSON.stringify(finalMeta) : null;
            }

            const sql = `
                INSERT INTO app_logs (timestamp, level, message, success, request_id, ip, status_code, code, stack, meta)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            // 쿼리문의 ? 위치에 순서대로 대입할 실제 값 배열 파라미터입니다.
            // 미들웨어의 requestId 표기법 다양성에 유연하게 대처하도록 처리되어 있습니다.
            const params = [
                timestamp || new Date(),
                level,
                rest.error?.message || message, // 에러 시 에러 메시지 우선 저장
                isSuccess,
                request_id || info.requestId || null, // 하위 호환성을 위해 둘 다 지원
                ip || null,
                statusCode,
                code,
                stack || null,
                metaData
            ];

            // 파라미터를 안전하게 바인딩(SQL 인젝션 방지)하여
            // 데이터베이스에 비동기로 로그 로우(Row)를 삽입합니다.
            await db.execute(sql, params);
        } catch (err) {
            // 로깅 시스템 오류가 전체 앱을 마비시키지 않도록 차단
            // 커넥션 타임아웃이나 DB 마비 등으로 로그 삽입이 실패하더라도
            // 실제 사용자의 HTTP API 서버 자체가 폭발하는 연쇄 마비를 막아주는 최후의 안전장치입니다.
            console.error('Failed to write log to MySQL:', err);
        }

        // DB 저장 로직의 성공/실패 여부와 관계없이
        // Winston의 현재 로그 처리가 끝났음을 시스템에 전달하며 비동기 함수를 종료합니다.
        callback();
    }
}

// 로그 파일이 백업될 물리 경로
const logDir: string = process.env.LOGGER_DIR || path.join(process.cwd(), 'logs');

const logger = winston.createLogger({
    // Winston 로거 인스턴스를 빌드합니다.
    // 기록할 최소 로그 위험 수준의 기준점(level)을 info로 설정
    level: 'info',
    format: winston.format.combine(
        // 파일이나 커스텀 내부 통로로 들어오는 모든 가공 전 데이터 구조 규칙(기본 포맷)을 조립합니다.
        // 에러 객체 추적 활성화, 포맷 치환 기호 지원, 공통 타임스탬프 형식 지정, 전체 전송 구조 JSON화 처리를 실행합니다.
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
    ),
    transports: [
        // 화면에 출력하는 부분(콘솔)과 데이터베이스에 저장하는 부분(MySQL)은
        // transports라는 개념을 통해 완벽하게 구별
        new DailyRotateFile({
            // 날짜별 로테이션 파일 저장소 1호기입니다.
            // 일반 및 에러 로그 전체를 수집하며 매일 새 파일로 쪼개고,
            // 20MB 단위 분할 백업, 30일 경과 자동 영구 삭제, 압축 보관 아카이빙을 수행
            level: 'info',
            datePattern: 'YYYY-MM-DD',
            dirname: logDir,
            filename: '%DATE%.combined.log',
            maxFiles: '30d',
            maxSize: '20m',
            zippedArchive: true,
        }),
        new DailyRotateFile({
            // 날짜별 로테이션 파일 저장소 2호기입니다.
            // 서비스 장애 극비 추적을 위해 error 레벨 로그만 필터링하여
            // logs/error/ 디렉터리에 별도로 분리 수집합니다.
            level: 'error',
            datePattern: 'YYYY-MM-DD',
            dirname: path.join(logDir, 'error'),
            filename: '%DATE%.error.log',
            maxFiles: '30d',
            zippedArchive: true,
        }),
        // 위에서 우리가 공들여 커스텀 제작한 MySQL 삽입용 클래스 인스턴스를
        // 최종 목적지로 바인딩합니다. 이로써 파일과 DB 두 곳에 동시 저장이 완성됩니다.
        new DatabaseTransport({ level: 'info' }),
        new winston.transports.Http({
            // 특정 HTTP 주소로 로그 데이터를 전송하는 트랜스포트
            // logger.error()가 실행될 때마다 지정한 주소로 HTTP POST 요청이 자동 발생
            level: 'warn', // 👈 에러 로그만 선별해서 보내고 싶다면 'error', 전체는 'info' 설정
            host: process.env.LOG_SERVER_HOST || 'mywebsite.com', // 👈 독립 서버 도메인/IP
            port: Number(process.env.LOG_SERVER_PORT) || 443,        // HTTPS 표준 포트 443 추천
            path: '/log',
            // 🔒 보안 핵심: 아무나 로그 서버에 데이터를 밀어 넣지 못하도록 인증 헤더 추가
            headers: {
                'x-log-api-key': process.env.LOG_SERVER_API_KEY || 'my-secure-secret-key'
            },
            // ssl: false (https를 사용할 경우 true로 변경)

            // {
            //     "timestamp": "2026-05-14 15:12:00",
            //     "level": "error",
            //     "message": "[POST] /api/login - 비밀번호가 일치하지 않습니다.",
            //     "request_id": "uuid-1234-5678",
            //     "ip": "127.0.0.1",
            //     "status_code": 401,
            //     "code": "INVALID_PASSWORD",
            //     "stack": "Error: 비밀번호가 일치하지 않습니다...\n    at ...",
            //     "error": {
            //         "statusCode": 401,
            //         "code": "INVALID_PASSWORD",
            //         "message": "비밀번호가 일치하지 않습니다."
            //     }
            // }
        })
    ],
    exceptionHandlers: [
        // 개발자가 사전에 try-catch로 대비하지 못해 Node.js 프로세스 자체를
        // 다운시키는 치명적 예외 사태(uncaughtException)가 발생할 때 강제 탈취하여
        // 디스크 파일로 유언장을 남기는 단독 긴급 차단기입니다
        new DailyRotateFile({
            level: 'error',
            dirname: path.join(logDir, 'exceptions'),
            filename: '%DATE%.exception.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
        })
    ],
});

// 개발 환경 전용 모니터 출력 설정
if (process.env.NODE_ENV !== 'web') {
    logger.add(
        new winston.transports.Console({
            // 전역 로거 인스턴스에 모니터 화면 즉시 출력용 콘솔 통로를 추가 가동
            format: winston.format.combine(
                // 터미널 창의 시인성을 극대화하기 위해 로그 성격에 맞춰
                // 빨강, 노랑, 초록 등 글자 색상을 부여
                winston.format.colorize(),
                // JSON 구조 데이터를 터미널에서 사람이 눈으로 훑기 편하도록
                // 단 한 줄의 직관적인 문자열 디자인 패턴으로 재구축하기 위해 데이터를 구조 분해합니다.
                winston.format.printf(({ timestamp, level, message, request_id, requestId, ip, ...meta }) => {
                    const id = request_id || requestId; // Morgan 스트림과 일반 로그에서 모두 requestId를 지원하기 위해 두 가지 키를 확인
                    const idStr = id ? `[${id}]` : '';
                    const ipStr = ip ? `[${ip}]` : '';

                    // 콘솔의 하단 영역에 노출시킬 순수 커스텀 객체 영역(printMeta)을
                    // 정비하기 위해 기노출된 내부 중복 변수들을 숨김 처리합니다.
                    let statusStr = '';
                    let printMeta = { ...meta };
                    delete printMeta.timestamp;
                    delete printMeta.type;

                    // [해결] meta.error 객체 타입 안정성 확보
                    if (meta.error && typeof meta.error === 'object') {
                        // 메타데이터에 에러 구조체가 포함되어 있다면 모니터링 편의를 위해
                        // 제목 자리에 (상태코드/에러코드) 패턴 문자열을 가공해 끼워 넣고,
                        // 에러 원본 메시지로 메인 텍스트를 자동 전환합니다.
                        const errObj = meta.error as { statusCode?: number; code?: string; message?: string };
                        statusStr = ` (${errObj.statusCode || ''}/${errObj.code || ''})`;
                        message = errObj.message || message;
                    } else if (meta.status_code || meta.statusCode) {
                        // Morgan 등이 보낸 정상 혹은 클라이언트 요청 실패 관련 로그 스펙일 때도
                        // 괄호 패턴 상태 문자열을 가공 처리합니다.
                        statusStr = ` (${meta.status_code || meta.statusCode}/${meta.code || ''})`;
                    }
                    
                    // 화면 타이틀에 출력된 필수 값들 외에 더 깊은 가공 데이터(비즈니스 payload 객체 등)가
                    // 남아 있다면, 개발 창 가독성을 위해 개행(\n) 후 2스페이스 인덴트 들여쓰기가 된
                    // 예쁜 다단 JSON 구조 문자열로 파싱해 줍니다.
                    const metaStr = Object.keys(printMeta).length ? `\n${JSON.stringify(printMeta, null, 2)}` : '';

                    // 가공이 완료된 한 편의 텍스트 라인을 최종 조립하여 개발자의 Visual Studio Code나
                    // 모니터 터미널 창 화면에 깔끔하게 프린트하며 출력을 종료합니다.
                    return `[${timestamp}] ${level}:${idStr}${ipStr} ${message}${statusStr}${metaStr}`;
                })
            ),
        })
    );
}

export default logger;