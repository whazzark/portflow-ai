import { Exception } from '@adonisjs/core/exceptions'

export default class InvalidCredentialsException extends Exception {
  static status = 401
  static code = 'E_INVALID_CREDENTIALS'
  static message = 'Invalid credentials'
}
