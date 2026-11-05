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
