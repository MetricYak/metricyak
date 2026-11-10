export type ApiErrorOptions = {
  type?: string;
  code?: string;
  detail?: string;
};

export class ApiError extends Error {
  static statusCode = 500;
  static defaultType = "api_error";
  static defaultCode = "internal_error";
  static defaultDetail = "A server error occurred";

  readonly statusCode: number;
  readonly type: string;
  readonly code: string;
  readonly detail: string;

  constructor({ type, code, detail }: ApiErrorOptions = {}) {
    const defaults = new.target;
    super(detail ?? defaults.defaultDetail);
    this.name = defaults.name;
    this.statusCode = defaults.statusCode;
    this.type = type ?? defaults.defaultType;
    this.code = code ?? defaults.defaultCode;
    this.detail = detail ?? defaults.defaultDetail;
  }
}

export class NotFoundError extends ApiError {
  static override statusCode = 404;
  static override defaultType = "invalid_request";
  static override defaultCode = "not_found";
  static override defaultDetail = "Not found.";
}

export class ConflictError extends ApiError {
  static override statusCode = 409;
  static override defaultType = "invalid_request";
  static override defaultCode = "conflict";
  static override defaultDetail = "Conflict.";
}

export type ValidationErrorParam = {
  code: string;
  detail: string;
  param: string | null;
};

export class ValidationError extends ApiError {
  static override statusCode = 400;
  static override defaultType = "invalid_request";
  static override defaultCode = "validation_error";
  static override defaultDetail = "Invalid request.";

  readonly params: ValidationErrorParam[];

  constructor(params: ValidationErrorParam[], options: ApiErrorOptions = {}) {
    super(options);
    this.params = params;
  }
}

export class UnauthorizedError extends ApiError {
  static override statusCode = 401;
  static override defaultType = "invalid_request";
  static override defaultCode = "not_authenticated";
  static override defaultDetail = "Authentication required.";
}

export class ForbiddenError extends ApiError {
  static override statusCode = 403;
  static override defaultType = "invalid_request";
  static override defaultCode = "permission_denied";
  static override defaultDetail = "You don't have permission to do this.";
}
