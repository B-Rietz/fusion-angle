import {
    MissingTableError,
    type StorageBackend,
    type Tx,
    type TxMode,
} from './db.ts';
import {
    bufferTx,
    hasOrganizationGenesis,
} from './backend-buffer-tx.ts';
import {
    noOrganizationDocument,
    ownOrganizationDocumentsOf,
    rosterOrganizationsOf,
} from './organization-hold.ts';
import { createSerializer } from './store-serializer.ts';
import { mintRootBind } from './ledger-root.ts';
import { SuccessionConflict }
    from './ledger-statement.ts';
import { nowUtc } from '../shared/types.ts';
import {
    classifyStatement,
} from '../shared/ledger-statement.ts';
import type {
    Attempt,
    Head,
    StatementAnswer,
    StatementBind,
} from '../shared/ledger-statement.ts';
import { compareIdentifiers }
    from '../shared/identifier.ts';
import type { ComponentState } from
    '../shared/system-status.ts';
import { Octets } from
    '../shared/http-message/octets.ts';

const TABLE = 'fa_message_pairs';
const PKEY = 'fa_message_pairs_pkey';

export class MemoryStorageBackend
    implements StorageBackend
{
    #rows: { id: string }[] | undefined;
    #refusals = 0;
    #executions = 0;
    // Orders whole transactions within this backend
    // instance — global ordering, stronger than the
    // per-store mutex it replaces (A2). Cross-process
    // ordering is Postgres's (advisory locks); this
    // serializer orders one memory instance.
    readonly #serialize:
        <R>(fn: () => Promise<R>) => Promise<R>;

    constructor() {
        this.#rows = undefined;
        this.#serialize = createSerializer();
    }

    // The next `count` statement executions throw
    // before the succession set is consulted.
    refuseNextSuccessions(count: number): void {
        this.#refusals = count;
    }

    statementExecutions(): number {
        return this.#executions;
    }

    // One mint with the event times callers stamp.
    // An injected stamp still wins, so a successor
    // pin can sit behind the head.
    #clock(now: string | undefined): string {
        if (now !== undefined) return now;
        return nowUtc();
    }

    // Simulated transaction: copy the table, serve every
    // row op from the copy, adopt the copy when `fn`
    // resolves. A throw skips the adoption, so the live
    // rows are byte-identical — rollback is "don't adopt",
    // never "undo".
    async read<R>(
        fn: (tx: Tx) => Promise<R>,
    ): Promise<R> {
        if (this.#rows === undefined) {
            throw new MissingTableError(TABLE);
        }
        const live = this.#rows;
        return fn(bufferTx(live, 'readonly'));
    }

    async transaction<R>(
        mode: TxMode,
        fn: (tx: Tx) => Promise<R>,
    ): Promise<R> {
        return this.#serialize(async () => {
            if (this.#rows === undefined) {
                throw new MissingTableError(TABLE);
            }
            const buffer = [...this.#rows];
            const result = await fn(bufferTx(buffer, mode));
            this.#rows = buffer;
            return result;
        });
    }

    // The schema step is a buffer: empty when the table is
    // absent, its rows when it exists (IF NOT EXISTS).
    // Memory has no marker; the table is the schema. A
    // throw adopts nothing, so an absent table stays
    // absent.
    async seedTransaction<R>(
        fn: (tx: Tx) => Promise<R>,
    ): Promise<R> {
        return this.#serialize(async () => {
            const buffer = this.#rows === undefined
                ? []
                : [...this.#rows];
            const result = await fn(
                bufferTx(buffer, 'readwrite'),
            );
            this.#rows = buffer;
            return result;
        });
    }

    async ensureTable(): Promise<void> {
        if (this.#rows === undefined) {
            this.#rows = [];
        }
        if (hasRoot(this.#rows)) return;
        await this.executeLedger(
            'blind',
            [mintRootBind()],
            undefined,
            undefined,
        );
    }

    async executeLedger(
        attempt: Attempt,
        rows: readonly StatementBind[],
        now: string | undefined,
        tx: Tx | undefined,
    ): Promise<StatementAnswer[]> {
        const open = tx?.ledgerBuffer?.();
        if (open !== undefined) {
            return this.#apply(open, attempt, rows, now);
        }
        return this.#serialize(async () => {
            if (this.#rows === undefined) {
                throw new MissingTableError(TABLE);
            }
            const copy = [...this.#rows];
            const result = await this.#apply(
                copy, attempt, rows, now,
            );
            this.#rows = copy;
            return result;
        });
    }

    async #apply(
        buffer: { id: string }[],
        attempt: Attempt,
        rows: readonly StatementBind[],
        now: string | undefined,
    ): Promise<StatementAnswer[]> {
        this.#executions += 1;
        if (this.#refusals > 0) {
            this.#refusals -= 1;
            throw new SuccessionConflict();
        }
        // The writer's half of the organization hold, as
        // Postgres takes it before the statement: a roster
        // row's organization has its genesis row, or this
        // statement is that genesis.
        const own = ownOrganizationDocumentsOf(rows);
        for (const organizationId of rosterOrganizationsOf(rows)) {
            if (hasOrganizationGenesis(buffer, organizationId)) {
                continue;
            }
            if (own.has(organizationId)) continue;
            throw noOrganizationDocument(organizationId);
        }
        const clock = this.#clock(now);
        const documents = documentsOf(rows);
        const classified = await classifyStatement(
            attempt,
            rows,
            headsOf(documentRowsOf(buffer, documents)),
            clock,
        );
        const answers: StatementAnswer[] = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]!;
            const item = classified[i]!;
            answers.push({
                id: row.id,
                path: row.path,
                name: row.name,
                method: row.method,
                outcome: item.outcome,
                rawOutcome: item.rawOutcome,
                stamp: item.stamp,
                response: item.response,
                headId: item.headId,
                headResponse: item.headResponse,
                headMethod: item.headMethod,
                inserted: item.inserted,
                supersedes: item.supersedes,
                requestHashHex: item.requestHashHex,
                requestSecretsHashHex:
                    item.requestSecretsHashHex,
                responseHashHex: item.responseHashHex,
                responseSecretsHashHex:
                    item.responseSecretsHashHex,
                pairHashHex: item.pairHashHex,
                requesterIdentityId:
                    row.requesterIdentityId,
                headResponseAt: item.headResponseAt,
                headRequesterIdentityId:
                    item.headRequesterIdentityId,
            });
        }
        const inserting = rows.filter(
            (_row, i) => classified[i]!.inserted,
        );
        for (const row of inserting) {
            if (buffer.some((existing) => existing.id === row.id)) {
                const error = new Error(
                    'duplicate primary key',
                ) as Error & {
                    code: string,
                    constraint: string,
                };
                error.code = '23505';
                error.constraint = PKEY;
                throw error;
            }
        }
        // Read after the classification's awaits, not
        // with the heads: a statement that overlapped this
        // one in a transaction may have written since.
        const claimed = successionKeys(
            documentRowsOf(buffer, documents),
        );
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]!;
            const item = classified[i]!;
            if (!item.inserted) continue;
            if (!documentMethod(row.method)) continue;
            const key = successionKey(
                row.path, row.name, item.supersedes,
            );
            if (claimed.has(key)) {
                throw new SuccessionConflict();
            }
            claimed.add(key);
        }
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]!;
            const item = classified[i]!;
            if (!item.inserted) continue;
            buffer.push(entityOf(row, item));
        }
        return answers;
    }

    async hasSchema(): Promise<boolean> {
        return this.#rows !== undefined;
    }

    // The same rows under a backend of its own: a write on
    // either is never seen by the other. Rows are appended
    // and never changed in place, so the two share them. A
    // transaction adopts its buffer whole, so the rows
    // copied are committed ones.
    copy(): MemoryStorageBackend {
        if (this.#rows === undefined) {
            throw new MissingTableError(TABLE);
        }
        const backend = new MemoryStorageBackend();
        backend.#rows = [...this.#rows];
        return backend;
    }

    async postSchemaCreation(): Promise<void> {
        await this.ensureTable();
    }

    async deleteSchema(): Promise<void> {
        this.#rows = undefined;
    }

    // No connection to lose.
    async probe(): Promise<ComponentState> {
        return 'up';
    }
}

function hasRoot(rows: readonly { id: string }[]): boolean {
    return rows.some((row) => {
        const rec = row as Record<string, unknown>;
        return rec['path'] === '/migrations/'
            && rec['name'] === '0000-root';
    });
}

function documentMethod(method: string): boolean {
    return method === 'PUT' || method === 'DELETE';
}

function successionKey(
    path: string,
    name: string,
    supersedes: string,
): string {
    return path + '\u0000' + name + '\u0000' + supersedes;
}

function successionKeys(
    rows: readonly DocumentRow[],
): Set<string> {
    const keys = new Set<string>();
    for (const row of rows) {
        const supersedes = row.rec['supersedes'];
        if (typeof supersedes !== 'string') continue;
        keys.add(successionKey(row.path, row.name, supersedes));
    }
    return keys;
}

function laterHead(
    left: Record<string, unknown>,
    right: Record<string, unknown>,
): boolean {
    const atL = String(left['response_at'] ?? '');
    const atR = String(right['response_at'] ?? '');
    if (atL !== atR) return atL > atR;
    return compareIdentifiers(
        String(left['id'] ?? ''),
        String(right['id'] ?? ''),
    ) > 0;
}

// A statement's documents, their names by path, so a table
// scan asks whether a row is one of them without building
// a key for the row.
type Documents = ReadonlyMap<string, ReadonlySet<string>>;

function documentsOf(
    statement: readonly StatementBind[],
): Documents {
    const documents = new Map<string, Set<string>>();
    for (const bind of statement) {
        const names = documents.get(bind.path);
        if (names === undefined) {
            documents.set(bind.path, new Set([bind.name]));
        } else {
            names.add(bind.name);
        }
    }
    return documents;
}

// A PUT or DELETE row of one of a statement's documents.
type DocumentRow = {
    readonly path: string,
    readonly name: string,
    readonly rec: Record<string, unknown>,
};

// The table's PUT and DELETE rows of a statement's own
// documents, the only rows its heads and its successions
// read. Every statement pays this scan of the whole
// table, a seed's every statement among them.
function documentRowsOf(
    rows: readonly { id: string }[],
    documents: Documents,
): DocumentRow[] {
    const written: DocumentRow[] = [];
    for (const row of rows) {
        const rec = row as Record<string, unknown>;
        const method = rec['method'];
        if (
            typeof method !== 'string'
            || !documentMethod(method)
        ) {
            continue;
        }
        const path = rec['path'];
        const name = rec['name'];
        if (typeof path !== 'string' || typeof name !== 'string') {
            continue;
        }
        if (documents.get(path)?.has(name) !== true) continue;
        written.push({ path, name, rec });
    }
    return written;
}

// The heads of the statement's own documents: a whole
// table's heads would decode every stored response on
// every statement.
function headsOf(rows: readonly DocumentRow[]): Head[] {
    const best = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
        const key = row.path + '\u0000' + row.name;
        const prev = best.get(key);
        if (prev === undefined || laterHead(row.rec, prev)) {
            best.set(key, row.rec);
        }
    }
    const heads: Head[] = [];
    for (const rec of best.values()) {
        const response = rec['response'];
        heads.push({
            path: String(rec['path']),
            name: String(rec['name']),
            id: String(rec['id']),
            responseAt: String(rec['response_at']),
            requesterIdentityId: String(
                rec['requester_identity_id'],
            ),
            response: typeof response === 'string'
                ? Octets.fromLatin1(response).asBytes()
                : new Uint8Array(0),
            method: String(rec['method']),
        });
    }
    return heads;
}

function latin1(bytes: Uint8Array): string {
    return Octets.fromBytes(bytes).toLatin1();
}

function hexOf(bytes: Uint8Array): string {
    let hex = '';
    for (const byte of bytes) {
        hex += byte.toString(16).padStart(2, '0');
    }
    return hex;
}

function entityOf(
    row: StatementBind,
    item: {
        supersedes: string,
        stamp: string,
        response: Uint8Array,
        requestHashHex: string,
        requestSecretsHashHex: string,
        responseHashHex: string,
        responseSecretsHashHex: string,
        pairHashHex: string,
    },
): { id: string } {
    const entity = {
        id: row.id,
        operation_id: row.operationId,
        path: row.path,
        name: row.name,
        supersedes: item.supersedes,
        requester_identity_id: row.requesterIdentityId,
        method: row.method,
        response_at: item.stamp,
        request: latin1(row.request),
        request_salt: hexOf(row.requestSalt),
        request_hash: item.requestHashHex,
        request_secrets: latin1(row.requestSecrets),
        request_secrets_hash: item.requestSecretsHashHex,
        response: latin1(item.response),
        response_salt: hexOf(row.responseSalt),
        response_hash: item.responseHashHex,
        response_secrets: latin1(row.responseSecrets),
        response_secrets_hash: item.responseSecretsHashHex,
        pair_hash: item.pairHashHex,
    };
    return entity as { id: string };
}
