export class WebError extends Error {
    public readonly isOperational: boolean;
    // [ isOperational ]
    // 외부 주입이 아닌 고정된 값이기 때문에, 밖에 선언된 인터페이스나 타입이 필요 없습니다. WebError 클래스 자체가 이 플래그를 내장하고 있기 때문입니다.
    // 에러가 내가 의도한(운영적) 에러인지, 아니면 예상치 못한 시스템 버그인지를 구분하는 플래그입니다.
    // 예를 들어, 데이터베이스 연결 실패, 외부 API 오류, 유효성 검사 실패 등은 운영적 에러로 간주할 수 있습니다.
    // 반면에, null 참조 오류, 타입 오류 등은 코드 버그로 간주되어 isOperational이 false가 됩니다.
    // 나중에 에러 핸들러 미들웨어에서 이 값이 false인 경우에만 관리자에게 알림을 보내는 식으로 활용합니다.

    constructor(
        public readonly message: string,
        public readonly statusCode: number = 500,
        public readonly code: string = 'INTERNAL_SERVER_ERROR',
        public readonly details?: Record<string, any>

        // message
        // statusCode: HTTP 응답 상태 코드 (예: 400, 401, 403)
        // code: 서비스 고유 에러 코드 (예: USER_NOT_FOUND, INVALID_PASSWORD). 프론트엔드에서 이 값을 보고 분기 처리를 합니다.
        // details: 유효성 검사 실패 이유 등 추가 정보를 담는 변수. 실패 등의 추가 정보를 배열이나 객체 형태로 자유롭게 전달
    
        // 사용법
        // if (!user) {
        //     throw new WebError('사용자를 찾을 수 없습니다.', 404, 'USER_NOT_FOUND');
        // }
    ) {
        // 부모 클래스인 Error에 메시지를 전달하여 기본 에러 기능을 활성화
        super(message);

        // TypeScript에서 Error를 상속받을 때 발생하는 프로토타입 체인 문제를 해결합니다.
        // 이 코드가 있어야 instanceof WebError가 정확하게 동작합니다.
        Object.setPrototypeOf(this, new.target.prototype);
        // new.target은 현재 new 연산자로 호출된 클래스 자체를 가리킵니다.

        // 예를 들어, new WebError(...)로 호출되면 new.target은 WebError가 됩니다.
        // 따라서 Object.setPrototypeOf(this, new.target.prototype)는 현재 인스턴스(this)의 프로토타입을 WebError.prototype로 설정하는 역할을 합니다.
        
        // 결과적으로 부모 생성자에서 한 번만 작성해두면,
        // 이를 상속받는 수십 개의 자식 클래스에서 일일이 프로토타입을 재설정할 필요가 없습니다.

        // isOperational을 true로 설정하여 이 에러가 운영적(지정된) 에러임을 명시적으로 표시
        this.isOperational = true;
        
        // 사용자 정의 에러(Custom Error) 클래스를 만들 때 사용하는 패턴입니다.
        Error.captureStackTrace(this, this.constructor);
        
        // this 객체(생성된 에러 인스턴스)에 .stack 속성을 생성합니다.
        // 이를 통해 에러가 발생한 시점의 코드 실행 경로(파일 위치, 줄 번호 등)를 추적
        // this.constructor는 "여기까지의 호출 기록은 스택 트레이스에서 제외해줘"라는 의미

        // "이 객체에 에러 기록(stack)을 남기되, 나(에러 클래스 생성자) 자체는 기록에서 빼서
        // 에러가 발생한 진짜 위치만 보여줘!"라는 뜻
    }
}

// [ details?: Record<string, any> ]
// 유연성:
// 에러마다 필요한 정보가 다르기 때문에(이메일 중복 시에는 이메일 주소가,
// 결제 오류 시에는 금액 정보가 필요하듯) 무엇이든 담을 수 있게 설계된 것입니다.

// 로그 활용:
// 앞서 설정한 Winston 로그 파일에는 이 details 객체가 그대로 저장되므로,
// 카페24 터미널에서 로그를 열었을 때 "사용자가 정확히 어떤 값을 입력해서
// 유효성 검사가 깨졌는지"를 파싱 없이 바로 확인할 수 있습니다.


// details는 에러에 대한 추가 정보를 담는 객체입니다. 예를 들어, 유효성 검사 실패 시 어떤 필드가 왜 실패했는지 등의 상세 정보를 담을 수 있습니다.
// Record<string, any>는 TypeScript의 유틸리티 타입으로, 키가 문자열이고 값이 어떤 타입이든 될 수 있는 객체를 나타냅니다.
// 예시:
// throw new WebError('유효성 검사 실패', 400, 'VALIDATION_ERROR', { field: 'email', message: '이메일 형식이 올바르지 않습니다.' });

// 단일 필드 오류
// throw new ValidationError("입력값이 잘못되었습니다.", {
//   field: "email",
//   reason: "이미 가입된 이메일입니다.",
//   suggest: "비밀번호 찾기를 이용해주세요."
// });

// 다중 필드 오류
// throw new ValidationError("양식을 확인해주세요.", {
//   errorList: [
//     { field: "password", message: "숫자를 포함해야 합니다." },
//     { field: "nickname", message: "특수문자는 사용할 수 없습니다." }
//   ]
// });

export class InternalServerError extends WebError {
    // 내부 서버 에러, HTTP 상태: 500 Internal Server Error
    // 예를 들어, 데이터베이스 연결 실패, 외부 API 호출 실패 등과 같은 서버 측 문제를 나타냅니다.
    constructor(message: string = '내부 서버 에러가 발생했습니다', details?: Record<string, any>) {
        super(message, 500, 'INTERNAL_SERVER_ERROR', details);
    }
}

export class ValidationError extends WebError {
    // 입력 검증 실패 에러, HTTP 상태: 400 Bad Request
    // 예를 들어, 클라이언트가 필수 필드를 누락하거나, 잘못된 형식의 데이터를 보냈을 때 발생하는 에러입니다.
    constructor(message: string, details?: Record<string, any>) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

export class AuthenticationError extends WebError {
    // 인증 실패 에러, HTTP 상태: 401 Unauthorized
    // 예를 들어, 로그인 실패, 토큰 만료, 세션 유효성 검사 실패 등과 같은 인증 관련 에러를 나타냅니다.
    constructor(message: string = '인증이 필요합니다', details?: Record<string, any>) {
        super(message, 401, 'AUTHENTICATION_ERROR', details);
    }
}

export class AuthorizationError extends WebError {
    // 권한 부족 에러, HTTP 상태: 403 Forbidden
    // 예를 들어, 사용자가 로그인은 했지만 특정 리소스에 접근할 권한이 없는 경우, 관리자 권한이 필요한 작업을 일반 사용자가 시도하는 경우 등이 있습니다.
    constructor(message: string = '이 작업을 수행할 권한이 없습니다', details?: Record<string, any>) {
        super(message, 403, 'AUTHORIZATION_ERROR', details);
    }
}

export class NotFoundError extends WebError {
    // 리소스 없음 에러, HTTP 상태: 404 Not Found
    // 예를 들어, 클라이언트가 존재하지 않는 사용자 ID로 요청을 보냈을 때, 데이터베이스에서 해당 리소스를 찾을 수 없는 경우 등이 있습니다.
    constructor(message: string = '요청한 리소스를 찾을 수 없습니다', details?: Record<string, any>) {
        super(message, 404, 'NOT_FOUND_ERROR', details);
    }
}

export class ConflictError extends WebError {
    // 리소스 충돌 에러, HTTP 상태: 409 Conflict
    // 예를 들어, 회원가입 시 이미 존재하는 이메일로 가입하려는 경우, 데이터베이스에 중복된 키가 삽입되는 경우 등이 있습니다.
    constructor(message: string = '리소스 충돌이 발생했습니다', details?: Record<string, any>) {
        super(message, 409, 'CONFLICT_ERROR', details);
    }
}

export class TimeoutError extends WebError {
    // 요청 타임아웃 에러, HTTP 상태: 408 Request Timeout
    // 클라이언트가 서버에 요청을 보냈지만, 서버가 이를 처리하는 데 너무 오래 걸려서 타임아웃이 발생한 경우입니다.
    constructor(message: string = '요청 처리 시간이 초과되었습니다', details?: Record<string, any>) {
        super(message, 408, 'TIMEOUT_ERROR', details);
    }
}

export class BusinessLogicError extends WebError {
    // 비즈니스 로직 에러, HTTP 상태: 422 Unprocessable Entity
    // 예를 들어, 주문 처리 중 재고 부족, 결제 실패 등과 같은 비즈니스 규칙 위반을 나타냅니다.
    constructor(message: string, details?: Record<string, any>) {
        super(message, 422, 'BUSINESS_LOGIC_ERROR', details);
    }
}

export class ExternalServiceError extends WebError {
    // 외부 서비스 에러, HTTP 상태: 502 Bad Gateway
    // 외부 API 호출 실패, 서드파티 서비스 오류 등과 같은 에러를 나타냅니다.
    constructor(message: string = '외부 서비스 연결 실패', details?: Record<string, any>) {
        super(message, 502, 'EXTERNAL_SERVICE_ERROR', details);
    }
}

export class RateLimitError extends WebError {
    // 요청 속도 제한 에러, HTTP 상태: 429 Too Many Requests
    // 클라이언트가 너무 많은 요청을 보내서 서버가 이를 처리할 수 없을 때 발생하는 에러입니다.
    constructor(message: string = '요청 속도 제한을 초과했습니다', details?: Record<string, any>) {
        super(message, 429, 'RATE_LIMIT_ERROR', details);
    }
}

export class DatabaseError extends WebError {
    // 데이터베이스 관련 에러, HTTP 상태: 500 Internal Server Error
    // 데이터베이스 연결 실패, 쿼리 실행 실패 등과 같은 에러를 나타냅니다.
    constructor(message: string = '데이터베이스 오류가 발생했습니다.', details?: Record<string, any>) {
        // DB 에러는 보안상 클라이언트에게 500 에러로 노출하며, 
        // 내부적으로만 구체적인 DB 에러 코드(ER_DUP_ENTRY 등)를 관리합니다.
        super(message, 500, 'DATABASE_ERROR', details);
    }
}