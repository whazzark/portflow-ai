import { Exception } from '@adonisjs/core/exceptions'

export class WeighingAreaNotFoundException extends Exception {
  static status = 404
  static code = 'E_WEIGHING_AREA_NOT_FOUND'
  static message = 'Weighing area not found'
}

export class DuplicateWeighingAreaNameException extends Exception {
  static status = 409
  static code = 'E_WEIGHING_AREA_NAME_CONFLICT'
  static message = 'Weighing area name is already in use'
}

export class ArchivedWeighingAreaReadOnlyException extends Exception {
  static status = 409
  static code = 'E_WEIGHING_AREA_ARCHIVED'
  static message = 'Archived weighing areas are read-only'
}

export class WeighingAreaInUseException extends Exception {
  static status = 409
  static code = 'E_WEIGHING_AREA_IN_USE'
  static message = 'Weighing area is used by a planned or active discharge'
}

export class WeighingAreaAlreadyArchivedException extends Exception {
  static status = 409
  static code = 'E_WEIGHING_AREA_ALREADY_ARCHIVED'
  static message = 'Weighing area is already archived'
}

export class WeighingAreaAlreadyAvailableException extends Exception {
  static status = 409
  static code = 'E_WEIGHING_AREA_ALREADY_AVAILABLE'
  static message = 'Weighing area is already available'
}
