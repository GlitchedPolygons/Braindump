import {getUnixTimestamp} from "@/util.ts";
import {LocalStorageKeys} from "@/constants.ts";

export class AES
{
    private textEncoder: TextEncoder = new TextEncoder();
    private textDecoder: TextDecoder = new TextDecoder();

    async generateKey(): Promise<string>
    {
        let entropy: string = window.btoa(String.fromCharCode(...new Uint8Array(window.crypto.getRandomValues(new Uint8Array(64)))));

        entropy += getUnixTimestamp().toString();
        entropy += window.crypto.randomUUID().toString();
        entropy += localStorage.getItem(LocalStorageKeys.LAST_AUTH_TOKEN_REFRESH_UTC);

        const generatedAesKeyBytes: ArrayBuffer = await window.crypto.subtle.digest('SHA-256', this.textEncoder.encode(entropy));

        return window.btoa(String.fromCharCode(...new Uint8Array(generatedAesKeyBytes)));
    }

    async deriveKey(encryptionKey: string, salt: Uint8Array)
    {
        const pbkdf2 = {
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt: salt.buffer,
            iterations: 1024 * 1024
        };

        return await window.crypto.subtle.deriveKey
        (
            pbkdf2,
            await window.crypto.subtle.importKey
            (
                'raw',
                await window.crypto.subtle.digest('SHA-256', this.textEncoder.encode(encryptionKey)),
                {name: 'PBKDF2'},
                false,
                ['deriveKey']
            ),
            {name: 'AES-GCM', length: 256},
            false,
            ['encrypt', 'decrypt']
        );
    }

    async encryptString(plaintext: string, encryptionKey: string): Promise<string>
    {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));

        const aesKey = await this.deriveKey(encryptionKey, salt);

        const algorithm = {name: "AES-GCM", iv: window.crypto.getRandomValues(new Uint8Array(12))};

        const ciphertext = await window.crypto.subtle.encrypt
        (
            algorithm,
            aesKey,
            this.textEncoder.encode(plaintext),
        );

        return window.btoa(`${String.fromCharCode(...new Uint8Array(salt))}${String.fromCharCode(...new Uint8Array(algorithm.iv))}${String.fromCharCode(...new Uint8Array(ciphertext))}`);
    }

    async decryptString(ciphertext: string, decryptionKey: string): Promise<string>
    {
        try
        {
            const ciphertextBytes = window.atob(ciphertext);

            const aesKey = await this.deriveKey(decryptionKey, new Uint8Array(Array.from(ciphertextBytes.slice(0, 16)).map(ch => ch.charCodeAt(0))));

            const algorithm = {name: "AES-GCM", iv: new Uint8Array(Array.from(ciphertextBytes.slice(16, 28)).map(ch => ch.charCodeAt(0)))};

            const decryptedBytes = await window.crypto.subtle.decrypt(algorithm, aesKey, new Uint8Array(Array.from(ciphertextBytes.slice(28)).map(ch => ch.charCodeAt(0))));

            return this.textDecoder.decode(decryptedBytes);
        }
        catch (e)
        {
            throw new Error('Decryption failed!');
        }
    }
}
