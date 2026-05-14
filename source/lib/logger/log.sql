CREATE TABLE app_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME NOT NULL,
    level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    request_id VARCHAR(50) NULL,
    ip VARCHAR(45) NULL,
    status_code INT NULL,
    code VARCHAR(50) NULL,
    stack TEXT NULL,
    meta JSON NULL, -- SuccessResponse의 data 또는 ErrorResponse의 details 및 기타 데이터 저장
    INDEX idx_timestamp (timestamp),
    INDEX idx_level (level),
    INDEX idx_request_id (request_id),
    INDEX idx_ip (ip)
);

-- 컬럼명데이터 타입설명 / 저장되는 실제 데이터 값
-- id(INT) 자동으로 1씩 증가하는 고유 번호 (Primary Key)
-- timestamp(DATETIME) 로그가 발생한 시각 (Winston 포맷터로 추출한 현재 시간)
-- level(VARCHAR) 로그의 위험도 등급 (info, warn, error)
-- message(TEXT) 로그의 핵심 텍스트 내용 (에러 발생 시에는 에러 메시지가 우선 저장)
-- success(BOOLEAN) 성공 여부 (SuccessResponse는 1(true), ErrorResponse는 0(false))
-- request_id(VARCHAR) API 요청을 추적하기 위한 고유 ID (requestId 값)
-- status_code(INT) HTTP 상태 코드 또는 에러 상태 코드 (200, 400, 500 등)
-- code(VARCHAR) 비즈니스 로직 고유 에러 코드 (INVALID_INPUT, SUCCESS 등)
-- stack(TEXT) 에러 발생 시 최초 코드 호출 경로 전체 목록 (Stack Trace, 정상 로그 시 null)
-- meta(JSON) 위 고유 컬럼들을 제외한 나머지 가변 데이터 및 세부 객체 정보 전체


SuccessResponse
ogger.info('상품 조회 성공', { success: true, requestId: 'req-a1b2', data: { productId: 99, price: 15000 } });
level: "info"
message: "상품 조회 성공"
success: 1 (true)
request_id: "req-a1b2"
status_code: null
code: null
stack: null
meta: {"productId":99,"price":15000} (JSON 형식으로 저장)

ErrorResponse
logger.error(new Error('Validation Failed'), {
  success: false,
  requestId: 'req-c3d4',
  error: { statusCode: 400, code: 'BAD_REQUEST', message: '비밀번호가 틀렸습니다.', details: { attempt: 3 } }
});

level: "error"
message: "비밀번호가 틀렸습니다." (error.message 추출)
success: 0 (false)
request_id: "req-c3d4"
status_code: 400
code: "BAD_REQUEST"
stack: "Error: Validation Failed\n    at Context.<anonymous> (/app/user.ts:14:18)..."
meta: {"attempt":3} (내부 세부 details 데이터 추출)

문자열 치환 일반 로그 (winston.format.splat 사용 시)
logger.info('%s 사용자가 %s 작업을 수행했습니다.', 'Admin', '데이터 백업', { requestId: 'req-e5f6', category: 'SYSTEM' });

level: "info"
message: "Admin 사용자가 데이터 백업 작업을 수행했습니다." (치환 완료된 문자열)
success: 1 (true)
request_id: "req-e5f6"
status_code: null
code: null
stack: null
meta: {"category":"SYSTEM"} (치환 문자를 제외하고 남은 메타데이터 객체)