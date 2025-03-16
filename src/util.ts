import {LocalStorageKeys} from "@/constants.ts";

export function arrayBufferToHexEncodedString(buffer: ArrayBuffer): string
{
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

export function getUnixTimestamp(): number
{
    return Math.floor(Date.now() / 1000);
}

export function logout(): void
{
    localStorage.removeItem(LocalStorageKeys.AUTH_TOKEN);
    localStorage.removeItem(LocalStorageKeys.DEFIBRILLATOR_TOKEN);
    localStorage.removeItem(LocalStorageKeys.LAST_AUTH_TOKEN_REFRESH_UTC);
    localStorage.removeItem(LocalStorageKeys.PASSWORD_HASH);

    window.location.reload();
}