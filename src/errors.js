class AuthError extends Error {
  constructor(msg) {
    super(msg);
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

class Failure {
  constructor(error) {
    this.error = error;
  }

  static unauthorized(details) {
    return new Failure(new FailureError("UNAUTHORIZED", details));
  }
}

class FailureError {
  constructor(reason, details) {
    this.reason = reason;
    this.details = details;
  }
}

export { AuthError, Failure, FailureError };
