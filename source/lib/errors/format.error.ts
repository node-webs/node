import { WebError } from "./web.error";

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

export class ErrorFormatter {

    static formatWebError(error: WebError, requestId?: string): ErrorResponse {
        // 관리자가 정의한 에러를 WebError 객체를 받아서
        // 일반 Error를 표준 응답 포맷인 ErrorResponse 형태로 변환하여 반환합니다.
        return {
            success: false,
            error: {
                code: error.code,
                message: error.message,
                statusCode: error.statusCode,
                ...(error.details && { details: error.details }),
            },
            timestamp: new Date().toISOString(),
            ...(requestId && { requestId }),
        };
    }

     static formatUnknownError(error: unknown, requestId?: string): ErrorResponse {
        // 예상치 못한 일반 에러(unknown) 또는 알 수 없는 타입의 에러를 받아서
        // 시스템 내부 정보가 유출되지 않게 방어 최소한의 정보(500 에러)로 변환하여
        // 일반 Error를 표준 응답 포맷인 ErrorResponse 형태로 변환하여 반환합니다.

        const message = 'Internal Server Error';
        const code = 'INTERNAL_SERVER_ERROR';
        const statusCode = 500;

        // error.message 안에 DB 쿼리, 테이블명, 혹은 내부 IP 주소 같은 민감한 정보가 포함되어
        // 클라이언트에게 그대로 노출될 위험, 아래 코드 삭제

        // if (error instanceof Error) {
        //     message = error.message;
        // } else if (typeof error === 'string') {
        //     message = error;
        // }

        return {
            success: false,
            error: {
                code,
                message,
                statusCode,
            },
            timestamp: new Date().toISOString(),
            ...(requestId && { requestId }),
        };
    }

    static formatSuccess<T>(data: T, requestId?: string): SuccessResponse<T> {
        // API가 정상적으로 처리되어 성공한 경우, 데이터를 받아서
        // 표준 응답 포맷인 SuccessResponse 형태로 변환하여 반환합니다.
        // data는 실제 응답 데이터를 포함하며, 제네릭 타입 T로 정의되어 있어 유연하게 다양한 데이터 구조를 지원할 수 있습니다.

        return {
            success: true,
            data,
            timestamp: new Date().toISOString(),
            ...(requestId && { requestId }),
        };
    }

    static isWebError(error: unknown): error is WebError {
        // 주어진 에러가 WebError 타입인지 확인하는 타입 가드 함수입니다.

        // try {
        //     // 어떤 로직 수행
        // } catch (error) {
        //     if (ErrorFormatter.isWebError(error)) {
        //         return ErrorFormatter.formatWebError(error, requestId);
        //     }
        //     return ErrorFormatter.formatUnknownError(error, requestId);
        // }

        return error instanceof WebError;
    }

    static sanitizeForProduction(response: ErrorResponse): ErrorResponse {
        // 보안상 매우 중요한 메서드
        // 운영 환경에서는 에러 메시지에서 시스템 내부 정보가 유출되지 않도록 방어적으로 메시지를 변경하는 함수
        if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'web') {
            // 프로덕션에서는 상세 정보 제거
            // 개발 환경에서는 에러의 details(쿼리문, 스택 등)를 다 보여주지만,
            // 실제 서비스(production, web) 환경에서는 민감한 정보를 자동으로 삭제하여 보안 사고를 예방
            const { details, ...rest } = response.error;

            // 500 에러인 경우 메시지까지 한 번 더 마스킹 (선택 사항)
            if (rest.statusCode === 500) {
                rest.message = 'An unexpected error occurred. Please contact support.';
            }

            return {
                ...response,
                error: rest,
            };
        }
        return response;
    }
}