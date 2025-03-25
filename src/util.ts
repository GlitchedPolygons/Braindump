import {Constants, LocalStorageKeys} from "@/constants.ts";

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

export function getDateFromUnixTimestamp(unixTimestamp: number): Date
{
    return new Date(unixTimestamp * 1000);
}

export function getDateString(date: Date): string
{
    return `${date.getDate()}. ${Constants.MONTHS[date.getMonth()]}, ${date.getFullYear()}`;
}

export function getDateTimeString(date: Date): string
{
    const year: number = date.getFullYear();
    const monthIndex: number = date.getMonth();
    const day: number = date.getDate();
    const minutes: number = date.getMinutes();
    const hours: number = date.getHours();

    return `${day}. ${Constants.MONTHS[monthIndex]} ${year}, ${hours}:${minutes < 10 ? `0${minutes}` : minutes} (UTC)`;
}

export function logout(reload: boolean = true): void
{
    localStorage.removeItem(LocalStorageKeys.AUTH_TOKEN);
    localStorage.removeItem(LocalStorageKeys.DEFIBRILLATOR_TOKEN);
    localStorage.removeItem(LocalStorageKeys.LAST_AUTH_TOKEN_REFRESH_UTC);
    localStorage.removeItem(LocalStorageKeys.PASSWORD_HASH);

    if (!reload)
    {
        return;
    }

    window.location.reload();
}

export function selectOnFocus(event: Event): void
{
    const a = event.target as HTMLInputElement;
    a?.select();
}

export async function sha256(value: string): Promise<string>
{
    const textEncoder = new TextEncoder();
    return arrayBufferToHexEncodedString(await window.crypto.subtle.digest('SHA-256', textEncoder.encode(value)));
}

export function containsUppercaseCharacters(string: string): boolean
{
    return /[A-Z]/.test(string);
}

export function containsLowercaseCharacters(string: string): boolean
{
    return /[a-z]/.test(string);
}

export function containsNumberCharacters(string: string): boolean
{
    return /[0-9]/.test(string);
}

export function isPasswordShitty(password: string): boolean
{
    if (!password)
    {
        return true;
    }

    if (password.length < 7)
    {
        return true;
    }

    if (!containsUppercaseCharacters(password))
    {
        return true;
    }

    if (!containsLowercaseCharacters(password))
    {
        return true;
    }

    if (!containsNumberCharacters(password))
    {
        return true;
    }

    return false;
}

export function exportBraindump(guid: string)
{
    console.log(`Exporting Braindump ${guid}`);

    // todo: impl
}

export function deepClone<T>(object: T): T
{
    if (typeof window.structuredClone !== 'undefined' && typeof window.structuredClone === 'function')
    {
        return window.structuredClone(object);
    }

    console.warn('structuredClone function not available in this environment; reverting to JSON-based deep clone heuristics...');

    return JSON.parse(JSON.stringify(object));
}