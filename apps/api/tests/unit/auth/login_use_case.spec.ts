import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import InvalidCredentialsException from '#auth/login/invalid_credentials_exception'
import LoginUserUseCase from '#auth/login/login_use_case'
import { USER_FACTORY_PASSWORD, UserFactory } from '#database/factories/user_factory'

test.group('Login use case', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('logs in an active user with valid credentials', async ({ assert }) => {
    const activeUser = await UserFactory.apply('active').create()

    const loginUserUseCase = await app.container.make(LoginUserUseCase)
    const user = await loginUserUseCase.handle({
      email: activeUser.email,
      password: USER_FACTORY_PASSWORD,
    })

    assert.equal(user.id, activeUser.id)
  })

  test('normalizes the email casing and surrounding whitespace before lookup', async ({
    assert,
  }) => {
    const activeUser = await UserFactory.apply('active')
      .merge({ email: 'user@example.com' })
      .create()

    const loginUserUseCase = await app.container.make(LoginUserUseCase)
    const user = await loginUserUseCase.handle({
      email: '  USER@EXAMPLE.COM  ',
      password: USER_FACTORY_PASSWORD,
    })

    assert.equal(user.id, activeUser.id)
  })

  test('rejects an unknown email with a generic invalid-credentials error', async ({ assert }) => {
    const loginUserUseCase = await app.container.make(LoginUserUseCase)

    await assert.rejects(
      () =>
        loginUserUseCase.handle({ email: 'unknown@example.com', password: USER_FACTORY_PASSWORD }),
      InvalidCredentialsException,
    )
  })

  test('rejects an active user with the wrong password with a generic invalid-credentials error', async ({
    assert,
  }) => {
    const activeUser = await UserFactory.apply('active').create()
    const loginUserUseCase = await app.container.make(LoginUserUseCase)

    await assert.rejects(
      () => loginUserUseCase.handle({ email: activeUser.email, password: 'wrong-password' }),
      InvalidCredentialsException,
    )
  })

  test('rejects a pending user with a generic invalid-credentials error', async ({ assert }) => {
    const pendingUser = await UserFactory.create()
    const loginUserUseCase = await app.container.make(LoginUserUseCase)

    await assert.rejects(
      () => loginUserUseCase.handle({ email: pendingUser.email, password: USER_FACTORY_PASSWORD }),
      InvalidCredentialsException,
    )
  })

  test('rejects a cancelled user with a generic invalid-credentials error', async ({ assert }) => {
    const cancelledUser = await UserFactory.apply('cancelled').create()
    const loginUserUseCase = await app.container.make(LoginUserUseCase)

    await assert.rejects(
      () =>
        loginUserUseCase.handle({ email: cancelledUser.email, password: USER_FACTORY_PASSWORD }),
      InvalidCredentialsException,
    )
  })

  test('rejects a deactivated user with a valid password with a generic invalid-credentials error', async ({
    assert,
  }) => {
    const deactivatedUser = await UserFactory.apply('active', 'deactivated').create()
    const loginUserUseCase = await app.container.make(LoginUserUseCase)

    await assert.rejects(
      () =>
        loginUserUseCase.handle({ email: deactivatedUser.email, password: USER_FACTORY_PASSWORD }),
      InvalidCredentialsException,
    )
  })

  test('does not let the rejection reason be distinguished across unknown email, wrong password, and inactive status', async ({
    assert,
  }) => {
    const activeUser = await UserFactory.apply('active').create()
    const deactivatedUser = await UserFactory.apply('active', 'deactivated').create()
    const loginUserUseCase = await app.container.make(LoginUserUseCase)

    const errors = await Promise.all(
      [
        { email: 'unknown@example.com', password: USER_FACTORY_PASSWORD },
        { email: activeUser.email, password: 'wrong-password' },
        { email: deactivatedUser.email, password: USER_FACTORY_PASSWORD },
      ].map(async (input) => {
        try {
          await loginUserUseCase.handle(input)
          throw new Error('Expected handle() to reject')
        } catch (error) {
          return error as InvalidCredentialsException
        }
      }),
    )

    const [unknownEmailError, wrongPasswordError, inactiveStatusError] = errors
    assert.equal(unknownEmailError.message, wrongPasswordError.message)
    assert.equal(unknownEmailError.code, wrongPasswordError.code)
    assert.equal(unknownEmailError.status, wrongPasswordError.status)
    assert.equal(wrongPasswordError.message, inactiveStatusError.message)
    assert.equal(wrongPasswordError.code, inactiveStatusError.code)
    assert.equal(wrongPasswordError.status, inactiveStatusError.status)
  })
})
