import { HttpMessageError } from './types.ts';

// One String.fromCharCode call takes this many bytes as
// its arguments: far under any engine's argument limit.
const LATIN1_CHUNK_BYTES = 8192;

// An immutable octet sequence — the body payload and any
// byte-valued field carry one. btoa/atob speak Latin-1 binary
// strings (one char per byte), so the codec maps each byte to
// one char and back, like shared/base64url.ts — but in
// STANDARD padded base64 (the deterministic, lossless body
// encoding), not the URL-safe, padding-stripped variant.
// Platform primitives only — zero runtime deps. The inner
// array is
// copied on the way in and on the way out, so the value is
// sealed: no aliased reference can mutate it.
export class Octets {
    readonly #bytes: Uint8Array;

    private constructor(bytes: Uint8Array) {
        this.#bytes = bytes;
    }

    static fromBytes(bytes: Uint8Array): Octets {
        return new Octets(Uint8Array.from(bytes));
    }

    static fromLatin1(text: string): Octets {
        const bytes = new Uint8Array(text.length);
        for (let i = 0; i < text.length; i++) {
            bytes[i] = text.charCodeAt(i) & 0xff;
        }
        return new Octets(bytes);
    }

    static fromBase64(b64: string): Octets {
        let binary: string;
        try {
            binary = atob(b64);
        } catch {
            throw new HttpMessageError('invalid base64');
        }
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Octets(bytes);
    }

    byteLength(): number {
        return this.#bytes.length;
    }

    toBase64(): string {
        let binary = '';
        for (const byte of this.#bytes) {
            binary += String.fromCharCode(byte);
        }
        return btoa(binary);
    }

    // A chunk at a time: a string appended a byte at a
    // time is a rope with a node per byte, which every
    // later read pays to flatten. apply takes the bytes
    // as they are, though its type asks for an array; the
    // spread form measures no faster than the loop it
    // replaces.
    toLatin1(): string {
        let text = '';
        for (
            let at = 0;
            at < this.#bytes.length;
            at += LATIN1_CHUNK_BYTES
        ) {
            text += String.fromCharCode.apply(
                null,
                this.#bytes.subarray(
                    at, at + LATIN1_CHUNK_BYTES,
                ) as unknown as number[],
            );
        }
        return text;
    }

    asBytes(): Uint8Array {
        return Uint8Array.from(this.#bytes);
    }

    equals(other: Octets): boolean {
        const a = this.#bytes;
        const b = other.#bytes;
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }
}
