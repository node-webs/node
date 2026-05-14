export interface ErrorResponse {
    // API 응답에서 [ 에러 정보 ]를 담는 표준 형식입니다.
    success: false;
    error: {
        code: string;
        message: string;
        statusCode: number;
        details?: Record<string, any>;
    };
    timestamp: string; // 에러 발생 시점을 기록해 로그 추적
    requestId?: string; // 요청 추적을 위한 고유 ID (예: UUID). 에러 로그와 함께 기록하여 문제 해결에 도움을 줍니다.
}

export interface SuccessResponse<T = any> {
    // API 응답에서 [ 성공 정보 ]를 담는 표준 형식입니다.
    success: true;
    data: T;
    timestamp: string;
    requestId?: string;
}