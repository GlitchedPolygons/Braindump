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
        OFFLINE_SCRATCHPAD: 'offlineScratchpad',
        FILES_SORT_ORDER: 'filesSortOrder',
        FILES_SORT_PAGE_SIZE: 'filesPageSize',
        FILES_SORT_COLUMN_INDEX: 'filesSortColumnIndex',
        HIDE_FILES_HELP_TEXT: 'hideFilesHelpText',
        HIDE_EDITOR_HELP_TEXT: 'hideEditorHelpText',
        HIDE_OFFLINE_MODE_HELP_TEXT: 'hideOfflineModeHelpText',
    }
);

export const EndpointURLs = Object.freeze
(
    {
        LOGIN: '/api/v1/auth/login',
        REVIVE: '/api/v1/auth/revive',
        LOGOUT: '/api/v1/auth/logout',
        USERS: '/api/v1/users',
        ME: '/api/v1/users/me',
        ENABLE_2FA: '/api/v1/auth/2fa/enable',
        ENABLE_2FA_CONFIRM: '/api/v1/auth/2fa/enable/confirm',
        DISABLE_2FA: '/api/v1/auth/2fa/disable',
        RESET_PASSWORD: '/api/v1/auth/reset-password',
        RESET_PASSWORD_CONFIRM: '/api/v1/auth/reset-password/confirm',
        CHANGE_PASSWORD: '/api/v1/auth/change-password',
        CHANGE_EMAIL: '/api/v1/auth/change-email',
        CHANGE_EMAIL_CONFIRM: '/api/v1/auth/change-email/confirm',
        DATA_ENTRIES: '/api/v1/data',
        FILE_ENTRIES: '/api/v1/files',
        CHECK_NAME_AVAILABILITY: '/api/v1/data/name/check-availability',
    }
);

export const TypeNamesDTO = Object.freeze
(
    {
        LOGIN_RESPONSE_DTO: 'LoginResponseDto',
        USER_RESPONSE_DTO: 'UserResponseDto',
        USER_DATA_RESPONSE_DTO: 'UserDataResponseDto',
        USER_DATA_REDUX_RESPONSE_DTO: 'UserDataReduxResponseDto',
        USER_FILE_UPLOAD_RESPONSE_DTO: 'UserFileUploadResponseDto',
        USER_FILE_RESPONSE_DTO: 'UserFileResponseDto',
        USER_ENABLE_2FA_RESPONSE_DTO: 'UserEnableTwoFactorAuthResponseDto',
        USER_DISABLE_2FA_RESPONSE_DTO: 'UserDisableTwoFactorAuthResponseDto',

    }
);

export const Constants = Object.freeze
(
    {
        BRAINDUMP_ENCRYPTED_AES_KEY_ENTRY_NAME: 'BRAINDUMP_ENCRYPTED_AES_KEY',

        BRAINDUMP_ENCRYPTED_AES_KEY_ENTRY_NOTES: 'Automatically generated by Braindump. DO NOT DELETE OR MODIFY!',

        AUTH_TOKEN_DEFIBRILLATION_INTERVAL_SECONDS: 512,

        DEFAULT_BRAINDUMP_PAGE_INDEX: 3,

        DEFAULT_BRAINDUMP_PAGE_INDEX_OFFLINE_MODE: 7,

        SIGN_UP_URL: 'https://glitchedpolygons.com/store/software/braindump',

        DEFAULT_BRAINDUMP: {
            Guid: '',
            CreationTimestampUTC: 0,
            LastModificationTimestampUTC: 0,
            Notes: '',
            Name: '',
            Data: '',
            Private: true,
        },

        MONTHS: Object.freeze([
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December',
        ]),

        TOOLBAR: Object.freeze(
            [
                'revoke',
                'next',

                '-',

                'task',
                'unorderedList',
                'orderedList',

                '-',

                'bold',
                'italic',
                'strikeThrough',

                '-',

                'title',
                'sub',
                'sup',

                '-',

                'quote',
                'codeRow',
                'code',

                '-',

                'link',
                'image',
                'emoji',
                'table',
                'mermaid',
                'katex',

                '=',

                'pageFullscreen',
                'preview',
                'previewOnly',
            ]
        )
    }
);