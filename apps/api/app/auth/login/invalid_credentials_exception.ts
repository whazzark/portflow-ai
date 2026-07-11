import { Exception } from '@adonisjs/core/exceptions'

export default class InvalidCredentialsException extends Exception {
  static status = 401
  static code = 'E_LOGIN_INVALID_CREDENTIALS'
  static message = 'Invalid credentials'
}
