import {
  HttpException,
  HttpStatus,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';

/* Structured auth errors. The `code` field is the source of truth for the
 * frontend — message is human-readable but localisable per language later. */

export class EmailAlreadyExistsException extends ConflictException {
  constructor(email: string) {
    super({
      code: 'EMAIL_EXISTS',
      message: 'An account with that email already exists.',
      hint: 'Try signing in or reset your password.',
      field: 'email',
      email,
    });
  }
}

export class PhoneAlreadyExistsException extends ConflictException {
  constructor(phone: string) {
    super({
      code: 'PHONE_EXISTS',
      message: 'An account with that phone number already exists.',
      hint: 'Try signing in or reset your password.',
      field: 'phone',
      phone,
    });
  }
}

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super({
      code: 'INVALID_CREDENTIALS',
      message: 'Email/phone or password is incorrect.',
    });
  }
}

export class AccountSuspendedException extends UnauthorizedException {
  constructor() {
    super({
      code: 'ACCOUNT_SUSPENDED',
      message: 'Your account has been suspended.',
      hint: 'Contact support@uteo.ai if you believe this is in error.',
    });
  }
}

export class AccountDeactivatedException extends UnauthorizedException {
  constructor() {
    super({
      code: 'ACCOUNT_DEACTIVATED',
      message: 'This account has been deactivated.',
      hint: 'Contact support@uteo.ai to reactivate.',
    });
  }
}

export class AccountLockedException extends HttpException {
  constructor(retryAfterSeconds: number) {
    super(
      {
        code: 'ACCOUNT_LOCKED',
        message: `Too many failed attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class WeakPasswordException extends BadRequestException {
  constructor(reason: string) {
    super({
      code: 'WEAK_PASSWORD',
      message: reason,
      field: 'password',
    });
  }
}

export class InvalidPhoneException extends BadRequestException {
  constructor() {
    super({
      code: 'INVALID_PHONE',
      message: 'Phone number format not recognised. Try with country code, e.g. +254712345678.',
      field: 'phone',
    });
  }
}
