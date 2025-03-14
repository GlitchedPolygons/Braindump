export class AES
{
    private ready: Boolean = false;
    private initializing: Boolean = false;
    private textEncoder: TextEncoder = new TextEncoder();
    private textDecoder: TextDecoder = new TextDecoder();
    private aesKeyHash: ArrayBuffer = new ArrayBuffer(0);

    async init(aesKey: string)
    {
        if (this.ready || this.initializing)
        {
            return;
        }

        this.initializing = true;

        this.aesKeyHash = await window.crypto.subtle.digest('SHA-256', this.textEncoder.encode(aesKey));

        this.ready = true;

        this.initializing = false;
    }

    reset(): void
    {
        this.aesKeyHash = new ArrayBuffer(0);

        this.initializing = false;

        this.ready = false;
    }

    generateKey(): string
    {
        return window.btoa(String.fromCharCode(...new Uint8Array(window.crypto.getRandomValues(new Uint8Array(32)))));
    }

    async encryptString(plaintext: string): Promise<string>
    {
        if (!this.ready)
        {
            throw new Error('Not initialized... Call AES::init(aesKey) first!');
        }

        const algorithm = {name: "AES-GCM", iv: window.crypto.getRandomValues(new Uint8Array(12))};

        const key = await window.crypto.subtle.importKey('raw', this.aesKeyHash, algorithm, false, ['encrypt']);

        const ciphertext = await window.crypto.subtle.encrypt
        (
            algorithm,
            key,
            this.textEncoder.encode(plaintext),
        );

        return window.btoa(`${String.fromCharCode(...new Uint8Array(algorithm.iv))}${String.fromCharCode(...new Uint8Array(ciphertext))}`);
    }

    async decryptString(ciphertext: string): Promise<string>
    {
        if (!this.ready)
        {
            throw new Error('Not initialized... Call AES::init(aesKey) first!');
        }

        try
        {
            const ciphertextBytes = window.atob(ciphertext);

            const algorithm = {
                name: "AES-GCM",
                iv: new Uint8Array(Array.from(ciphertextBytes.slice(0, 12)).map(ch => ch.charCodeAt(0)))
            };

            const key = await window.crypto.subtle.importKey('raw', this.aesKeyHash, algorithm, false, ['decrypt']);

            const decryptedBytes = await window.crypto.subtle.decrypt(algorithm, key, new Uint8Array(Array.from(ciphertextBytes.slice(12)).map(ch => ch.charCodeAt(0))));

            return this.textDecoder.decode(decryptedBytes);
        }
        catch (e)
        {
            throw new Error('Decryption failed!');
        }
    }
}
