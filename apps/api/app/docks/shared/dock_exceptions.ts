import { Exception } from '@adonisjs/core/exceptions'

export class DockNotFoundException extends Exception {
  static status = 404
  static code = 'E_DOCK_NOT_FOUND'
  static message = 'Dock not found'
}

export class DuplicateDockNameException extends Exception {
  static status = 409
  static code = 'E_DOCK_NAME_CONFLICT'
  static message = 'Dock name is already in use'
}

export class InvalidDockNameException extends Exception {
  static status = 422
  static code = 'E_DOCK_NAME_INVALID'
  static message = 'Dock name must not be empty'
}

export class InvalidDockCoordinatesException extends Exception {
  static status = 422
  static code = 'E_DOCK_COORDINATES_INVALID'
  static message = 'Dock coordinates are invalid'
}

export class ArchivedDockReadOnlyException extends Exception {
  static status = 409
  static code = 'E_DOCK_ARCHIVED'
  static message = 'Archived docks are read-only'
}

export class DockInUseException extends Exception {
  static status = 409
  static code = 'E_DOCK_IN_USE'
  static message = 'Dock is used by a planned or active discharge'
}

export class DockAlreadyArchivedException extends Exception {
  static status = 409
  static code = 'E_DOCK_ALREADY_ARCHIVED'
  static message = 'Dock is already archived'
}

export class DockAlreadyAvailableException extends Exception {
  static status = 409
  static code = 'E_DOCK_ALREADY_AVAILABLE'
  static message = 'Dock is already available'
}
