import {Constants, EndpointURLs, LocalStorageKeys, TypeNamesDTO} from "@/constants.ts";
import config from "@/assets/config.json";
import {AES, aesKeyStore} from "@/aes.ts";
import {type Braindump, braindumpStore} from "@/braindump.ts";
import type {Ref} from "vue";

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

export function getDateTimeString(date: Date, utc: boolean = false): string
{
    const year: number = utc ? date.getUTCFullYear() : date.getFullYear();
    const monthIndex: number = utc ? date.getUTCMonth() : date.getMonth();
    const day: number = utc ? date.getUTCDate() : date.getDate();
    const minutes: number = utc ? date.getUTCMinutes() : date.getMinutes();
    const hours: number = utc ? date.getUTCHours() : date.getHours();

    return `${day}. ${Constants.MONTHS[monthIndex]} ${year}, ${hours < 10 ? `0${hours}` : hours}:${minutes < 10 ? `0${minutes}` : minutes}${utc ? ' (UTC)' : ''}`;
}

export function logout(reload: boolean = true): void
{
    localStorage.removeItem(LocalStorageKeys.AUTH_TOKEN);
    localStorage.removeItem(LocalStorageKeys.DEFIBRILLATOR_TOKEN);
    localStorage.removeItem(LocalStorageKeys.SAVE_DEFIBRILLATOR_TOKEN);
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

export function containsSpecialCharacters(string: string): boolean
{
    return /[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(string);
}

export function isPasswordShitty(password: string): boolean
{
    if (!password)
    {
        return true;
    }

    if (password.length < Constants.MIN_PASSWORD_LENGTH)
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

    if (!containsSpecialCharacters(password))
    {
        return true;
    }

    return false;
}

export async function exportBraindump(guid: string, aes: AES): Promise<void>
{
    console.log(`Exporting Braindump ${guid}`);

    const response: Response = await fetch
    (
        `${config.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}/${guid}`,
        {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
            },
        }
    );

    const responseBodyEnvelope = await response?.json();

    if (!response.ok || !responseBodyEnvelope || !responseBodyEnvelope.Items || responseBodyEnvelope.Items.length !== 1)
    {
        return;
    }

    const dump: Braindump = responseBodyEnvelope.Items[0];

    const title: string = await aes.decryptString(dump.Name, aesKeyStore.aesKey);
    const markdown = await aes.decryptString(dump.Data, aesKeyStore.aesKey);

    save(markdown, `${title}.md`);
}

export function save(data: any, filename: string)
{
    if (!data)
    {
        console.error('Nothing to save...');
        return;
    }

    if (!filename)
    {
        alert('No file name specified!');
        return;
    }

    if (typeof data === 'object')
    {
        data = JSON.stringify(data, null, 4);
    }

    const blob = new Blob([data], {type: 'text/obj'});
    const downloadAnchor = document.createElement('a');
    const mouseEvent = document.createEvent('MouseEvents');

    downloadAnchor.download = filename;
    downloadAnchor.href = window.URL.createObjectURL(blob);
    downloadAnchor.dataset.downloadurl = ['text/obj', downloadAnchor.download, downloadAnchor.href].join(':');

    mouseEvent.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);

    downloadAnchor.dispatchEvent(mouseEvent);

    setTimeout
    (
        () =>
        {
            (downloadAnchor as HTMLElement).remove();
        }, 1024
    );
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

export function setTheme(dark: boolean, persist: boolean = false)
{
    const theme: string =
        dark
            ? 'dark'
            : 'light';

    document.body.classList.add(theme);
    document.documentElement.setAttribute('data-bs-theme', theme);

    if (persist)
    {
        localStorage.setItem(LocalStorageKeys.THEME, theme);
    }

    if ((window as any).onChangedTheme)
    {
        (window as any).onChangedTheme(theme);
    }
}

export function bytesToFileSizeString(bytes: number): string
{
    const units: string[] = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    const unitCount: number = units.length;

    let result: number = bytes;
    let unitIndex: number = 0;

    while (result >= 1024 && unitCount > unitIndex + 1)
    {
        result /= 1024;
        ++unitIndex;
    }

    return `${result.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

export async function refreshUserAccount(): Promise<void>
{
    const requestContext = {
        method: 'GET',
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
        },
    };

    const response: Response = await fetch
    (
        `${config.BackendBaseURL}${EndpointURLs.ME}`,
        requestContext
    );

    if (!response.ok)
    {
        logout();
    }

    const responseBody = await response.json();

    if (!responseBody || responseBody.Type !== TypeNamesDTO.USER_RESPONSE_DTO || responseBody.Items.length === 0)
    {
        logout();
    }

    braindumpStore.user = responseBody.Items[0];
}

export function toggleCheckboxInMarkdown(clickEvent: Event, braindump: Ref): void
{
    const htmlElement = clickEvent.target as HTMLElement;

    if (!htmlElement || !htmlElement.nextSibling)
    {
        return;
    }

    const checked: string = ` [x]${htmlElement.nextSibling.textContent}`;
    const unchecked: string = ` [ ]${htmlElement.nextSibling.textContent}`;

    const newValueChecked: boolean = braindump.value.Data.includes(unchecked);

    braindump.value.Data = braindump.value.Data.replace
    (
        newValueChecked
            ? unchecked
            : checked,
        newValueChecked
            ? checked
            : unchecked
    );
}

export function pageCountFromTotal(totalCount: number, pageSize: number): number
{
    return Math.floor((totalCount + (pageSize - 1)) / pageSize);
}

export function splitIntoChunks<T>(array: Array<T>, chunkCount: number): Array<Array<T>>
{
    let chunkBuffer: Array<Array<T>> = [];

    for (let i: number = chunkCount; i > 0; --i)
    {
        chunkBuffer.push(array.splice(0, Math.ceil(array.length / i)));
    }

    return chunkBuffer;
}

export function encodeBase64Url(arrayBuffer: ArrayBuffer): string
{
    const bytes: Uint8Array = new Uint8Array(arrayBuffer);
    const len: number = bytes.length;

    let base64 = '';

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

    for (let i = 0; i < len; i += 3)
    {
        base64 += chars[bytes[i] >> 2];
        base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
        base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
        base64 += chars[bytes[i + 2] & 63];
    }

    if ((len % 3) === 2)
    {
        base64 = base64.substring(0, base64.length - 1);
    }
    else if (len % 3 === 1)
    {
        base64 = base64.substring(0, base64.length - 2);
    }

    return base64;
}

export function decodeBase64Url(encodedString: string): ArrayBuffer
{
    encodedString = encodedString.replace(/-/g, '+').replace(/_/g, '/');

    while (encodedString.length % 4)
    {
        encodedString += '=';
    }

    return Uint8Array.from(window.atob(encodedString), v => v.charCodeAt(0));
}