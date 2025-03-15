export const LocalStorageKeys = Object.freeze
(
    {
        THEME: 'theme',
        AUTH_TOKEN: 'authToken',
        DEFIBRILLATOR_TOKEN: 'defibrillatorToken',
        PASSWORD_HASH: 'passwordHash',
        LAST_USERNAME: 'lastUsername',
        LAST_AUTH_TOKEN_REFRESH_UTC: 'lastAuthTokenRefreshUTC',
        SAVE_DEFIBRILLATOR_TOKEN: 'saveDefibrillatorToken',
    }
);

export const EndpointURLs = Object.freeze
(
    {
        LOGIN: '/api/v1/auth/login',
        REVIVE: '/api/v1/auth/revive',
        LOGOUT: '/api/v1/auth/logout',
        ENABLE_2FA: '/api/v1/auth/2fa/enable',
        ENABLE_2FA_CONFIRM: '/api/v1/auth/2fa/enable/confirm',
        DISABLE_2FA: '/api/v1/auth/2fa/disable',
        RESET_PASSWORD: '/api/v1/auth/reset-password',
        RESET_PASSWORD_CONFIRM: '/api/v1/auth/reset-password/confirm',
        CHANGE_PASSWORD: '/api/v1/auth/change-password',
        CHANGE_EMAIL: '/api/v1/auth/change-email',
        CHANGE_EMAIL_CONFIRM: '/api/v1/auth/change-email/confirm',
    }
);

export const TypeNamesDTO = Object.freeze
(
    {
        LOGIN_RESPONSE_DTO: 'LoginResponseDto'
    }
);

export const Constants = Object.freeze
(
    {
        //
    }
);