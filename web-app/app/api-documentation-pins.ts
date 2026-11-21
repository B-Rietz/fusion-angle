// The replay's pins: what a run would otherwise draw from
// the world, fixed before any product code loads, so every
// sample is byte-identical on every run and every day
// (spec, Byte-stable output). Nothing is rewritten after
// the fact to hide a difference.
//
// - The signing key. The run signs with a throwaway key it
//   sets itself, before any product code loads, so it never
//   reads the operator's (spec, The hard rule). It is drawn
//   from the real crypto.getRandomValues, before the seeded
//   stream replaces it: a key the seed fixes would be
//   known to every reader. Tokens show placeholders, so
//   the key moves no byte.
// - The day. The seed anchors on the current UTC day, a
//   module constant read at import, so the day is fixed
//   first and the seed is imported after. FakeTime stays
//   installed for the whole run: the seed stays stable
//   only while it does.
// - The clock. nowUtc must advance, or its same-ms
//   sequence spins forever past 999, so the product clock
//   steps a fixed amount on every read instead of
//   freezing.
// - Randomness. Identifiers draw from
//   crypto.getRandomValues and the multipart boundary from
//   crypto.randomUUID, so both draw from one seeded
//   stream.
//
// The only static import is FakeTime: the product clock
// seam loads after the day is fixed, by dynamic import.

import { FakeTime } from '@std/testing/time';

export const PINNED_DAY_MS = Date.UTC(2020, 0, 1);
export const CLOCK_STEP_MS = 1;
// xorshift32 needs a non-zero uint32 state.
export const RANDOM_SEED = 0x9E3779B9;

const SIGNING_KEY_ENV = 'JWT_HMAC_SIGNING_KEY';
// 64 hex characters.
const SIGNING_KEY_BYTES = 32;
const BYTES_PER_DRAW = 4;
const BITS_PER_BYTE = 8;
const BYTE_MASK = 0xFF;
const UUID_BYTE_LENGTH = 16;
const UUID_VERSION_INDEX = 6;
const UUID_VERSION_4 = 0x40;
const UUID_VARIANT_INDEX = 8;
const UUID_VARIANT_RFC_9562 = 0x80;
const LOW_NIBBLE_MASK = 0x0F;
const LOW_SIX_BITS_MASK = 0x3F;
const HEX_RADIX = 16;
const HEX_DIGITS_PER_BYTE = 2;
// Marsaglia's xorshift32 shift triple (13, 17, 5).
const XORSHIFT_LEFT_FIRST = 13;
const XORSHIFT_RIGHT = 17;
const XORSHIFT_LEFT_LAST = 5;

type UuidText = `${string}-${string}-${string}-${string}-${string}`;

export async function installReplayPins(): Promise<void> {
    installThrowawaySigningKey();
    // Construction installs the fake; it is never restored.
    new FakeTime(PINNED_DAY_MS);
    installSeededRandomness(RANDOM_SEED);
    const { setClockForTest } = await import(
        '../../shared/types.ts'
    );
    let nextMs = PINNED_DAY_MS;
    setClockForTest(() => {
        const ms = nextMs;
        nextMs += CLOCK_STEP_MS;
        return ms;
    });
}

function installThrowawaySigningKey(): void {
    Deno.env.set(SIGNING_KEY_ENV, hexOf(
        crypto.getRandomValues(new Uint8Array(SIGNING_KEY_BYTES)),
    ));
}

function installSeededRandomness(seed: number): void {
    let state = seed;
    const nextUint32 = (): number => {
        state ^= state << XORSHIFT_LEFT_FIRST;
        state ^= state >>> XORSHIFT_RIGHT;
        state ^= state << XORSHIFT_LEFT_LAST;
        state >>>= 0;
        return state;
    };
    const fill = (bytes: Uint8Array): void => {
        for (let i = 0; i < bytes.length; i += BYTES_PER_DRAW) {
            let draw = nextUint32();
            const end = Math.min(i + BYTES_PER_DRAW, bytes.length);
            for (let j = i; j < end; j++) {
                bytes[j] = draw & BYTE_MASK;
                draw >>>= BITS_PER_BYTE;
            }
        }
    };
    Object.defineProperty(crypto, 'getRandomValues', {
        configurable: true,
        writable: true,
        value: <T extends ArrayBufferView>(array: T): T => {
            fill(new Uint8Array(
                array.buffer, array.byteOffset, array.byteLength,
            ));
            return array;
        },
    });
    Object.defineProperty(crypto, 'randomUUID', {
        configurable: true,
        writable: true,
        value: (): UuidText => {
            const bytes = new Uint8Array(UUID_BYTE_LENGTH);
            fill(bytes);
            bytes[UUID_VERSION_INDEX] = UUID_VERSION_4
                | (bytes[UUID_VERSION_INDEX]! & LOW_NIBBLE_MASK);
            bytes[UUID_VARIANT_INDEX] = UUID_VARIANT_RFC_9562
                | (bytes[UUID_VARIANT_INDEX]! & LOW_SIX_BITS_MASK);
            return uuidTextOf(bytes);
        },
    });
}

function hexOf(bytes: Uint8Array): string {
    return Array.from(
        bytes,
        (byte) => byte.toString(HEX_RADIX)
            .padStart(HEX_DIGITS_PER_BYTE, '0'),
    ).join('');
}

// 8-4-4-4-12 hex digits, RFC 9562's text form.
function uuidTextOf(bytes: Uint8Array): UuidText {
    const hex = hexOf(bytes);
    const time = hex.slice(0, 8);
    const mid = hex.slice(8, 12);
    const version = hex.slice(12, 16);
    const variant = hex.slice(16, 20);
    const node = hex.slice(20);
    return `${time}-${mid}-${version}-${variant}-${node}`;
}
