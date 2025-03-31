import {reactive} from "vue";
import {getUnixTimestamp} from "@/util.ts";
import {Constants, LocalStorageKeys} from "@/constants.ts";

export const aesKeyStore = reactive({
    aesKey: '',
    encryptedAesKeyGuid: ''
});

export class AES
{
    private textEncoder: TextEncoder = new TextEncoder();
    private textDecoder: TextDecoder = new TextDecoder();

    async generateKey(): Promise<string>
    {
        let entropy: string = self.btoa(String.fromCharCode(...new Uint8Array(self.crypto.getRandomValues(new Uint8Array(64)))));

        entropy += getUnixTimestamp().toString();
        entropy += self.crypto.randomUUID().toString();
        entropy += localStorage.getItem(LocalStorageKeys.LAST_AUTH_TOKEN_REFRESH_UTC);

        const generatedAesKeyBytes: ArrayBuffer = await self.crypto.subtle.digest('SHA-256', this.textEncoder.encode(entropy));

        return self.btoa(String.fromCharCode(...new Uint8Array(generatedAesKeyBytes)));
    }

    async deriveKey(encryptionKey: string, salt: Uint8Array, iterations: number)
    {
        const pbkdf2 = {
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt: salt.buffer,
            iterations: iterations
        };

        return await self.crypto.subtle.deriveKey
        (
            pbkdf2,
            await self.crypto.subtle.importKey
            (
                'raw',
                await self.crypto.subtle.digest('SHA-256', this.textEncoder.encode(encryptionKey)),
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
        const salt = self.crypto.getRandomValues(new Uint8Array(16));

        const aesKey = await this.deriveKey(encryptionKey, salt, Constants.DEFAULT_PBKDF2_ITERATION_COUNT);

        const algorithm = {name: "AES-GCM", iv: self.crypto.getRandomValues(new Uint8Array(12))};

        const ciphertext = await self.crypto.subtle.encrypt
        (
            algorithm,
            aesKey,
            this.textEncoder.encode(plaintext),
        );

        return self.btoa(`${String.fromCharCode(...new Uint8Array(salt))}${String.fromCharCode(...new Uint8Array(algorithm.iv))}${String.fromCharCode(...new Uint8Array(ciphertext))}`);
    }

    async decryptString(ciphertext: string, decryptionKey: string): Promise<string>
    {
        try
        {
            const ciphertextBytes = self.atob(ciphertext);

            const aesKey = await this.deriveKey(decryptionKey, new Uint8Array(Array.from(ciphertextBytes.slice(0, 16)).map(ch => ch.charCodeAt(0))), Constants.DEFAULT_PBKDF2_ITERATION_COUNT);

            const algorithm = {name: "AES-GCM", iv: new Uint8Array(Array.from(ciphertextBytes.slice(16, 28)).map(ch => ch.charCodeAt(0)))};

            const decryptedBytes = await self.crypto.subtle.decrypt(algorithm, aesKey, new Uint8Array(Array.from(ciphertextBytes.slice(28)).map(ch => ch.charCodeAt(0))));

            return this.textDecoder.decode(decryptedBytes);
        }
        catch (e)
        {
            return '';
        }
    }
}
