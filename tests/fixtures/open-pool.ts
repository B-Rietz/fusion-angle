// Open a pool to its full width before test one. A pooled
// connection starts timers as it connects (connect_timeout,
// then max_lifetime), and the ops sanitizer blames whichever
// test first sees them. Concurrent queries do not force the
// width: postgres.js 4 pipelines them onto the connections
// already open while the rest still connect. A transaction
// holds its own connection, so POOL_MAX transactions held
// open behind one barrier need POOL_MAX connections, all
// connected before any of them commits.

import { POOL_MAX } from '../../api/advisory-lock.ts';
import type { SqlClient } from '../../api/postgres-client.ts';

export async function openPoolToFullWidth(
    sql: SqlClient,
): Promise<void> {
    let entered = 0;
    let openBarrier = (): void => {};
    const barrier = new Promise<void>((resolve) => {
        openBarrier = resolve;
    });
    await Promise.all(Array.from(
        { length: POOL_MAX },
        () => sql.begin(async () => {
            entered += 1;
            if (entered === POOL_MAX) openBarrier();
            await barrier;
        }),
    ));
}
