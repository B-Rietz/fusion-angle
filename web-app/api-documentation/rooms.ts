import type {
    ApiDocAnswer,
    ApiDocHeaderSet,
    ApiDocRoom,
    ApiDocStatus,
    ApiDocStep,
} from './shapes.ts';

export type {
    ApiDocAnswer,
    ApiDocHeaderSet,
    ApiDocRoom,
    ApiDocStatus,
    ApiDocStep,
};

export const API_DOC_ROOMS: readonly ApiDocRoom[] = [
    {
        hash: 'delete/identities/id/pii',
        verb: 'DELETE',
        uri: '/api/identities/:id/pii',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '204',
                line: 'Deleted, or already gone. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity other than yours that your r'
                    + 'ole may not act for, or one outside your organization'
                    + '.',
            },
            {
                code: '404',
                line: 'Nothing was ever written here.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/delete/identities/id/pii.json',
        },
    },
    {
        hash: 'delete/identities/id/registration',
        verb: 'DELETE',
        uri: '/api/identities/:id/registration',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '204',
                line: 'Deleted, or already gone. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
            {
                code: '404',
                line: 'Nothing was ever written here.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/delete/identities/id/registration.json',
        },
    },
    {
        hash: 'delete/organizations/id/flows/id/records/frid',
        verb: 'DELETE',
        uri: '/api/organizations/:id/flows/:id/records/:frid',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '204',
                line: 'Deleted, or already gone. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/flows/id/records',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/delete/organizations/id/flows/id/records/frid.json',
        },
    },
    {
        hash: 'delete/organizations/id/flows/id/tags/name',
        verb: 'DELETE',
        uri: '/api/organizations/:id/flows/:id/tags/:name',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '204',
                line: 'Deleted, or already gone. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [],
        sample: {
            kind: 'sample',
            path: 'samples/delete/organizations/id/flows/id/tags/name.json',
        },
    },
    {
        hash: 'delete/organizations/id/projects/id/flows/pfid',
        verb: 'DELETE',
        uri: '/api/organizations/:id/projects/:id/flows/:pfid',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '204',
                line: 'Deleted, or already gone. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/projects/id/flows',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/delete/organizations/id/projects/id/flows/pfid.json',
        },
    },
    {
        hash: 'delete/organizations/id/work-orders/id/claim',
        verb: 'DELETE',
        uri: '/api/organizations/:id/work-orders/:id/claim',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'Done. The body is the outcome.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
            {
                code: '428',
                line: 'Send If-Match with the ETag you read.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/work-orders/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/delete/organizations/id/work-orders/id/claim.json',
        },
    },
    {
        hash:
            'delete/organizations/organization-id/record-types/record-type-i'
            + 'd',
        verb: 'DELETE',
        uri:
            '/api/organizations/:organization-id/record-types/:record-type-i'
            + 'd',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '204',
                line: 'Deleted, or already gone. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first. Or y'
                    + 'our role is below organization admin.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/organization-id/record-types',
                label: 'the collection',
            },
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/delete/organizations/organization-id/record-types/r'
                + 'ecord-type-id.json',
        },
    },
    {
        hash:
            'delete/organizations/organization-id/record-types/record-type-i'
            + 'd/attributes/attribute-id',
        verb: 'DELETE',
        uri:
            '/api/organizations/:organization-id/record-types/:record-type-i'
            + 'd/attributes/:attribute-id',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '204',
                line: 'Deleted, or already gone. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first. Or y'
                    + 'our role is below organization admin.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/attributes',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/delete/organizations/organization-id/record-types/r'
                + 'ecord-type-id/attributes/attribute-id.json',
        },
    },
    {
        hash:
            'delete/organizations/organization-id/record-types/record-type-i'
            + 'd/instances/instance-id',
        verb: 'DELETE',
        uri:
            '/api/organizations/:organization-id/record-types/:record-type-i'
            + 'd/instances/:instance-id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '204',
                line: 'Deleted, or already gone. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/instances',
                label: 'the collection',
            },
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/instances/instance-id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/delete/organizations/organization-id/record-types/r'
                + 'ecord-type-id/instances/instance-id.json',
        },
    },
    {
        hash: 'get/identities',
        verb: 'GET',
        uri: '/api/identities/',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line: 'Your role is below organization admin.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities.json',
        },
    },
    {
        hash: 'get/identities/id',
        verb: 'GET',
        uri: '/api/identities/:id',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
        ],
        related: [
            {
                hash: 'get/identities',
                label: 'the collection',
            },
            {
                hash: 'get/identities/id/versions',
                label: 'versions',
            },
            {
                hash: 'get/identities/id/pii',
                label: 'pii',
            },
            {
                hash: 'get/identities/id/registration',
                label: 'registration',
            },
            {
                hash: 'get/identities/id/default-organization',
                label: 'default-organization',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id.json',
        },
    },
    {
        hash: 'get/identities/id/credentials',
        verb: 'GET',
        uri: '/api/identities/:id/credentials/',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/credentials/cid',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id/credentials.json',
        },
    },
    {
        hash: 'get/identities/id/credentials/cid',
        verb: 'GET',
        uri: '/api/identities/:id/credentials/:cid',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/credentials',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id/credentials/cid.json',
        },
    },
    {
        hash: 'get/identities/id/default-organization',
        verb: 'GET',
        uri: '/api/identities/:id/default-organization',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity other than yours that your r'
                    + 'ole may not act for, or one outside your organization'
                    + '.',
            },
            {
                code: '404',
                line: 'Nothing was ever written here.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id/default-organization.json',
        },
    },
    {
        hash: 'get/identities/id/invitations',
        verb: 'GET',
        uri: '/api/identities/:id/invitations/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [
            {
                name: 'state',
                values: [
                    'pending',
                    'accepted',
                    'declined',
                    'revoked',
                    'removed',
                ],
                absent: 'every',
            },
        ],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '400',
                line:
                    '?state= names no state this list takes. Send one the er'
                    + 'ror lists, or none.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity other than yours that your r'
                    + 'ole may not act for, or one outside your organization'
                    + '.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/invitations/membership-id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id/invitations.json',
        },
    },
    {
        hash: 'get/identities/id/invitations/membership-id',
        verb: 'GET',
        uri: '/api/identities/:id/invitations/:membership-id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity other than yours: only the i'
                    + 'nvitee reads or answers an invitation.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '405',
                line: 'A membership is never deleted: PUT its state instead.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/invitations',
                label: 'the collection',
            },
            {
                hash: 'get/identities/id/invitations/membership-id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id/invitations/membership-id.json',
        },
    },
    {
        hash: 'get/identities/id/invitations/membership-id/versions',
        verb: 'GET',
        uri: '/api/identities/:id/invitations/:membership-id/versions/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity other than yours: only the i'
                    + 'nvitee reads or answers an invitation.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/invitations/membership-id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/identities/id/invitations/membership-id/version'
                + 's.json',
        },
    },
    {
        hash: 'get/identities/id/invitations/membership-id/versions/etag',
        verb: 'GET',
        uri: '/api/identities/:id/invitations/:membership-id/versions/:etag',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity other than yours: only the i'
                    + 'nvitee reads or answers an invitation.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/invitations/membership-id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/identities/id/invitations/membership-id/version'
                + 's/etag.json',
        },
    },
    {
        hash: 'get/identities/id/organizations',
        verb: 'GET',
        uri: '/api/identities/:id/organizations/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity other than yours that your r'
                    + 'ole may not act for, or one outside your organization'
                    + '.',
            },
        ],
        related: [],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id/organizations.json',
        },
    },
    {
        hash: 'get/identities/id/pii',
        verb: 'GET',
        uri: '/api/identities/:id/pii',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity other than yours that your r'
                    + 'ole may not act for, or one outside your organization'
                    + '.',
            },
            {
                code: '404',
                line: 'Nothing was ever written here.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id/pii.json',
        },
    },
    {
        hash: 'get/identities/id/providers',
        verb: 'GET',
        uri: '/api/identities/:id/providers/',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/providers/eid',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id/providers.json',
        },
    },
    {
        hash: 'get/identities/id/providers/eid',
        verb: 'GET',
        uri: '/api/identities/:id/providers/:eid',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/providers',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id/providers/eid.json',
        },
    },
    {
        hash: 'get/identities/id/registration',
        verb: 'GET',
        uri: '/api/identities/:id/registration',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '400',
                line:
                    'The identity is not a service: only a service has a reg'
                    + 'istration.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
            {
                code: '404',
                line: 'Nothing was ever written here.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id/registration.json',
        },
    },
    {
        hash: 'get/identities/id/token-revocations/rid',
        verb: 'GET',
        uri: '/api/identities/:id/token-revocations/:rid',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
        ],
        related: [],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id/token-revocations/rid.json',
        },
    },
    {
        hash: 'get/identities/id/tokens',
        verb: 'GET',
        uri: '/api/identities/:id/tokens/',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/tokens/jti',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id/tokens.json',
        },
    },
    {
        hash: 'get/identities/id/tokens/jti',
        verb: 'GET',
        uri: '/api/identities/:id/tokens/:jti',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/tokens',
                label: 'the collection',
            },
            {
                hash: 'post/identities/id/tokens/jti/revocation',
                label: 'revocation',
            },
            {
                hash: 'post/identities/id/tokens/jti/rotation',
                label: 'rotation',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id/tokens/jti.json',
        },
    },
    {
        hash: 'get/identities/id/versions',
        verb: 'GET',
        uri: '/api/identities/:id/versions/',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id/versions.json',
        },
    },
    {
        hash: 'get/identities/id/versions/etag',
        verb: 'GET',
        uri: '/api/identities/:id/versions/:etag',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/identities/id/versions/etag.json',
        },
    },
    {
        hash: 'get/organizations/id',
        verb: 'GET',
        uri: '/api/organizations/:id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line: 'You are no member of this organization.',
            },
            {
                code: '404',
                line: 'No organization has this id.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id.json',
        },
    },
    {
        hash: 'get/organizations/id/ai-agents',
        verb: 'GET',
        uri: '/api/organizations/:id/ai-agents/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/ai-agents/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/ai-agents.json',
        },
    },
    {
        hash: 'get/organizations/id/ai-agents/id',
        verb: 'GET',
        uri: '/api/organizations/:id/ai-agents/:id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/ai-agents',
                label: 'the collection',
            },
            {
                hash: 'get/organizations/id/ai-agents/id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/ai-agents/id.json',
        },
    },
    {
        hash: 'get/organizations/id/ai-agents/id/versions',
        verb: 'GET',
        uri: '/api/organizations/:id/ai-agents/:id/versions/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/ai-agents/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/ai-agents/id/versions.json',
        },
    },
    {
        hash: 'get/organizations/id/ai-agents/id/versions/etag',
        verb: 'GET',
        uri: '/api/organizations/:id/ai-agents/:id/versions/:etag',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/ai-agents/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/id/ai-agents/id/versions/etag.jso'
                + 'n',
        },
    },
    {
        hash: 'get/organizations/id/flows',
        verb: 'GET',
        uri: '/api/organizations/:id/flows/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/flows/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/flows.json',
        },
    },
    {
        hash: 'get/organizations/id/flows/id',
        verb: 'GET',
        uri: '/api/organizations/:id/flows/:id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/flows',
                label: 'the collection',
            },
            {
                hash: 'get/organizations/id/flows/id/versions',
                label: 'versions',
            },
            {
                hash: 'post/organizations/id/flows/id/undo',
                label: 'undo',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/flows/id.json',
        },
    },
    {
        hash: 'get/organizations/id/flows/id/records',
        verb: 'GET',
        uri: '/api/organizations/:id/flows/:id/records/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/flows/id/records/frid',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/flows/id/records.json',
        },
    },
    {
        hash: 'get/organizations/id/flows/id/records/frid',
        verb: 'GET',
        uri: '/api/organizations/:id/flows/:id/records/:frid',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/flows/id/records',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/flows/id/records/frid.json',
        },
    },
    {
        hash: 'get/organizations/id/flows/id/tags/name',
        verb: 'GET',
        uri: '/api/organizations/:id/flows/:id/tags/:name',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/flows/id/tags/name.json',
        },
    },
    {
        hash: 'get/organizations/id/flows/id/versions',
        verb: 'GET',
        uri: '/api/organizations/:id/flows/:id/versions/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/flows/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/flows/id/versions.json',
        },
    },
    {
        hash: 'get/organizations/id/flows/id/versions/etag',
        verb: 'GET',
        uri: '/api/organizations/:id/flows/:id/versions/:etag',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/flows/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/flows/id/versions/etag.json',
        },
    },
    {
        hash: 'get/organizations/id/flows/id/work-orders',
        verb: 'GET',
        uri: '/api/organizations/:id/flows/:id/work-orders/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [
            {
                hash: 'put/organizations/id/flows/id/work-orders/woid',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/flows/id/work-orders.json',
        },
    },
    {
        hash: 'get/organizations/id/ideas',
        verb: 'GET',
        uri: '/api/organizations/:id/ideas/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/ideas/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/ideas.json',
        },
    },
    {
        hash: 'get/organizations/id/ideas/id',
        verb: 'GET',
        uri: '/api/organizations/:id/ideas/:id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/ideas',
                label: 'the collection',
            },
            {
                hash: 'get/organizations/id/ideas/id/versions',
                label: 'versions',
            },
            {
                hash: 'post/organizations/id/ideas/id/conversion',
                label: 'conversion',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/ideas/id.json',
        },
    },
    {
        hash: 'get/organizations/id/ideas/id/submissions',
        verb: 'GET',
        uri: '/api/organizations/:id/ideas/:id/submissions/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [
            {
                hash: 'put/organizations/id/ideas/id/submissions/sid',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/ideas/id/submissions.json',
        },
    },
    {
        hash: 'get/organizations/id/ideas/id/versions',
        verb: 'GET',
        uri: '/api/organizations/:id/ideas/:id/versions/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/ideas/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/ideas/id/versions.json',
        },
    },
    {
        hash: 'get/organizations/id/ideas/id/versions/etag',
        verb: 'GET',
        uri: '/api/organizations/:id/ideas/:id/versions/:etag',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/ideas/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/ideas/id/versions/etag.json',
        },
    },
    {
        hash: 'get/organizations/id/invitations',
        verb: 'GET',
        uri: '/api/organizations/:id/invitations/',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [
            {
                name: 'state',
                values: [
                    'pending',
                    'declined',
                    'revoked',
                ],
                absent: 'pending',
            },
        ],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '400',
                line:
                    '?state= names no state this list takes. Send one the er'
                    + 'ror lists, or none.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first. Or y'
                    + 'our role is below organization admin.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/invitations/membership-id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/invitations.json',
        },
    },
    {
        hash: 'get/organizations/id/invitations/membership-id',
        verb: 'GET',
        uri: '/api/organizations/:id/invitations/:membership-id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '405',
                line: 'A membership is never deleted: PUT its state instead.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/invitations',
                label: 'the collection',
            },
            {
                hash:
                    'get/organizations/id/invitations/membership-id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/id/invitations/membership-id.json',
        },
    },
    {
        hash: 'get/organizations/id/invitations/membership-id/versions',
        verb: 'GET',
        uri: '/api/organizations/:id/invitations/:membership-id/versions/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/invitations/membership-id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/id/invitations/membership-id/vers'
                + 'ions.json',
        },
    },
    {
        hash: 'get/organizations/id/invitations/membership-id/versions/etag',
        verb: 'GET',
        uri:
            '/api/organizations/:id/invitations/:membership-id/versions/:eta'
            + 'g',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/invitations/membership-id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/id/invitations/membership-id/vers'
                + 'ions/etag.json',
        },
    },
    {
        hash: 'get/organizations/id/memberships',
        verb: 'GET',
        uri: '/api/organizations/:id/memberships/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [
            {
                name: 'state',
                values: [
                    'accepted',
                    'removed',
                ],
                absent: 'accepted',
            },
        ],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '400',
                line:
                    '?state= names no state this list takes. Send one the er'
                    + 'ror lists, or none.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/memberships.json',
        },
    },
    {
        hash: 'get/organizations/id/objectives',
        verb: 'GET',
        uri: '/api/organizations/:id/objectives/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/objectives/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/objectives.json',
        },
    },
    {
        hash: 'get/organizations/id/objectives/id',
        verb: 'GET',
        uri: '/api/organizations/:id/objectives/:id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/objectives',
                label: 'the collection',
            },
            {
                hash: 'get/organizations/id/objectives/id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/objectives/id.json',
        },
    },
    {
        hash: 'get/organizations/id/objectives/id/revisions',
        verb: 'GET',
        uri: '/api/organizations/:id/objectives/:id/revisions/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [
            {
                hash: 'put/organizations/id/objectives/id/revisions/rid',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/objectives/id/revisions.json',
        },
    },
    {
        hash: 'get/organizations/id/objectives/id/versions',
        verb: 'GET',
        uri: '/api/organizations/:id/objectives/:id/versions/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/objectives/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/objectives/id/versions.json',
        },
    },
    {
        hash: 'get/organizations/id/objectives/id/versions/etag',
        verb: 'GET',
        uri: '/api/organizations/:id/objectives/:id/versions/:etag',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/objectives/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/id/objectives/id/versions/etag.js'
                + 'on',
        },
    },
    {
        hash: 'get/organizations/id/projects',
        verb: 'GET',
        uri: '/api/organizations/:id/projects/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/projects/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/projects.json',
        },
    },
    {
        hash: 'get/organizations/id/projects/id',
        verb: 'GET',
        uri: '/api/organizations/:id/projects/:id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/projects',
                label: 'the collection',
            },
            {
                hash: 'get/organizations/id/projects/id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/projects/id.json',
        },
    },
    {
        hash: 'get/organizations/id/projects/id/flows',
        verb: 'GET',
        uri: '/api/organizations/:id/projects/:id/flows/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [
            {
                hash: 'put/organizations/id/projects/id/flows/pfid',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/projects/id/flows.json',
        },
    },
    {
        hash: 'get/organizations/id/projects/id/objective-actual-scores',
        verb: 'GET',
        uri: '/api/organizations/:id/projects/:id/objective-actual-scores/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [
            {
                hash:
                    'put/organizations/id/projects/id/objective-actual-score'
                    + 's/sid',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/id/projects/id/objective-actual-s'
                + 'cores.json',
        },
    },
    {
        hash: 'get/organizations/id/projects/id/objective-baseline-scores',
        verb: 'GET',
        uri: '/api/organizations/:id/projects/:id/objective-baseline-scores/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [
            {
                hash:
                    'put/organizations/id/projects/id/objective-baseline-sco'
                    + 'res/sid',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/id/projects/id/objective-baseline'
                + '-scores.json',
        },
    },
    {
        hash: 'get/organizations/id/projects/id/versions',
        verb: 'GET',
        uri: '/api/organizations/:id/projects/:id/versions/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/projects/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/projects/id/versions.json',
        },
    },
    {
        hash: 'get/organizations/id/projects/id/versions/etag',
        verb: 'GET',
        uri: '/api/organizations/:id/projects/:id/versions/:etag',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/projects/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/id/projects/id/versions/etag.json',
        },
    },
    {
        hash: 'get/organizations/id/services',
        verb: 'GET',
        uri: '/api/organizations/:id/services/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/services/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/services.json',
        },
    },
    {
        hash: 'get/organizations/id/services/id',
        verb: 'GET',
        uri: '/api/organizations/:id/services/:id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/services',
                label: 'the collection',
            },
            {
                hash: 'get/organizations/id/services/id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/services/id.json',
        },
    },
    {
        hash: 'get/organizations/id/services/id/versions',
        verb: 'GET',
        uri: '/api/organizations/:id/services/:id/versions/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/services/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/services/id/versions.json',
        },
    },
    {
        hash: 'get/organizations/id/services/id/versions/etag',
        verb: 'GET',
        uri: '/api/organizations/:id/services/:id/versions/:etag',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/services/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/id/services/id/versions/etag.json',
        },
    },
    {
        hash: 'get/organizations/id/versions',
        verb: 'GET',
        uri: '/api/organizations/:id/versions/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line: 'You are no member of this organization.',
            },
            {
                code: '404',
                line: 'No organization has this id.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/versions.json',
        },
    },
    {
        hash: 'get/organizations/id/versions/etag',
        verb: 'GET',
        uri: '/api/organizations/:id/versions/:etag',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line: 'You are no member of this organization.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/versions/etag.json',
        },
    },
    {
        hash: 'get/organizations/id/work-orders',
        verb: 'GET',
        uri: '/api/organizations/:id/work-orders/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/work-orders/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/work-orders.json',
        },
    },
    {
        hash: 'get/organizations/id/work-orders/id',
        verb: 'GET',
        uri: '/api/organizations/:id/work-orders/:id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/work-orders',
                label: 'the collection',
            },
            {
                hash: 'get/organizations/id/work-orders/id/versions',
                label: 'versions',
            },
            {
                hash: 'put/organizations/id/work-orders/id/claim',
                label: 'claim',
            },
            {
                hash: 'post/organizations/id/work-orders/id/transition',
                label: 'transition',
            },
            {
                hash: 'put/organizations/id/work-orders/id/binding',
                label: 'binding',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/work-orders/id.json',
        },
    },
    {
        hash: 'get/organizations/id/work-orders/id/versions',
        verb: 'GET',
        uri: '/api/organizations/:id/work-orders/:id/versions/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/work-orders/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/get/organizations/id/work-orders/id/versions.json',
        },
    },
    {
        hash: 'get/organizations/id/work-orders/id/versions/etag',
        verb: 'GET',
        uri: '/api/organizations/:id/work-orders/:id/versions/:etag',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/work-orders/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/id/work-orders/id/versions/etag.j'
                + 'son',
        },
    },
    {
        hash: 'get/organizations/organization-id/record-types',
        verb: 'GET',
        uri: '/api/organizations/:organization-id/record-types/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/organization-id/record-types.json',
        },
    },
    {
        hash: 'get/organizations/organization-id/record-types/record-type-id',
        verb: 'GET',
        uri:
            '/api/organizations/:organization-id/record-types/:record-type-i'
            + 'd',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/organization-id/record-types',
                label: 'the collection',
            },
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/organization-id/record-types/reco'
                + 'rd-type-id.json',
        },
    },
    {
        hash:
            'get/organizations/organization-id/record-types/record-type-id/a'
            + 'ttributes',
        verb: 'GET',
        uri:
            '/api/organizations/:organization-id/record-types/:record-type-i'
            + 'd/attributes/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/attributes/attribute-id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/organization-id/record-types/reco'
                + 'rd-type-id/attributes.json',
        },
    },
    {
        hash:
            'get/organizations/organization-id/record-types/record-type-id/a'
            + 'ttributes/attribute-id',
        verb: 'GET',
        uri:
            '/api/organizations/:organization-id/record-types/:record-type-i'
            + 'd/attributes/:attribute-id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/attributes',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/organization-id/record-types/reco'
                + 'rd-type-id/attributes/attribute-id.json',
        },
    },
    {
        hash:
            'get/organizations/organization-id/record-types/record-type-id/i'
            + 'nstances',
        verb: 'GET',
        uri:
            '/api/organizations/:organization-id/record-types/:record-type-i'
            + 'd/instances/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/instances/instance-id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/organization-id/record-types/reco'
                + 'rd-type-id/instances.json',
        },
    },
    {
        hash:
            'get/organizations/organization-id/record-types/record-type-id/i'
            + 'nstances/instance-id',
        verb: 'GET',
        uri:
            '/api/organizations/:organization-id/record-types/:record-type-i'
            + 'd/instances/:instance-id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/instances',
                label: 'the collection',
            },
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/instances/instance-id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/organization-id/record-types/reco'
                + 'rd-type-id/instances/instance-id.json',
        },
    },
    {
        hash:
            'get/organizations/organization-id/record-types/record-type-id/i'
            + 'nstances/instance-id/versions',
        verb: 'GET',
        uri:
            '/api/organizations/:organization-id/record-types/:record-type-i'
            + 'd/instances/:instance-id/versions/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/instances/instance-id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/organization-id/record-types/reco'
                + 'rd-type-id/instances/instance-id/versions.json',
        },
    },
    {
        hash:
            'get/organizations/organization-id/record-types/record-type-id/i'
            + 'nstances/instance-id/versions/etag',
        verb: 'GET',
        uri:
            '/api/organizations/:organization-id/record-types/:record-type-i'
            + 'd/instances/:instance-id/versions/:etag',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/instances/instance-id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/organization-id/record-types/reco'
                + 'rd-type-id/instances/instance-id/versions/etag.json',
        },
    },
    {
        hash:
            'get/organizations/organization-id/record-types/record-type-id/v'
            + 'ersions',
        verb: 'GET',
        uri:
            '/api/organizations/:organization-id/record-types/:record-type-i'
            + 'd/versions/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The selected documents, one part each.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/organization-id/record-types/reco'
                + 'rd-type-id/versions.json',
        },
    },
    {
        hash:
            'get/organizations/organization-id/record-types/record-type-id/v'
            + 'ersions/etag',
        verb: 'GET',
        uri:
            '/api/organizations/:organization-id/record-types/:record-type-i'
            + 'd/versions/:etag',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The document, under its ETag.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted. Its versions/ still list its '
                    + 'history.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/get/organizations/organization-id/record-types/reco'
                + 'rd-type-id/versions/etag.json',
        },
    },
    {
        hash: 'get/status',
        verb: 'GET',
        uri: '/api/status',
        tier: 'none',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Every component is up. The body names the running commi'
                    + 't and each component\'s state.',
            },
            {
                code: '500',
                line:
                    'The API was started without its commit, so it has none '
                    + 'to report. Report the Request-ID.',
            },
            {
                code: '503',
                line:
                    'A component is not up. The body names each component\'s'
                    + ' state and the running commit. Retry later.',
            },
        ],
        related: [],
        sample: {
            kind: 'sample',
            path: 'samples/get/status.json',
        },
    },
    {
        hash:
            'patch/organizations/organization-id/record-types/record-type-id'
            + '/instances/instance-id',
        verb: 'PATCH',
        uri:
            '/api/organizations/:organization-id/record-types/:record-type-i'
            + 'd/instances/:instance-id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'alternative',
                        alternatives: [
                            'if-match',
                            'if-none-match',
                        ],
                    },
                    {
                        name: 'if-none-match',
                        state: 'alternative',
                        alternatives: [
                            'if-match',
                            'if-none-match',
                        ],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'Done. The body is the outcome.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'No record type has this id. Use one the listing returns'
                    + '.',
            },
            {
                code: '410',
                line:
                    'The document was deleted, and a deleted document takes '
                    + 'no write.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
            {
                code: '428',
                line:
                    'Send If-Match with the ETag you read, or If-None-Match:'
                    + ' * to create.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/instances',
                label: 'the collection',
            },
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/instances/instance-id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/patch/organizations/organization-id/record-types/re'
                + 'cord-type-id/instances/instance-id.json',
        },
    },
    {
        hash: 'post/authentication/authorize',
        verb: 'POST',
        uri: '/api/authentication/authorize',
        tier: 'none',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'Done. The body is the outcome.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion, or the request carries a precondition this route'
                    + ' does not take. The error names which; fix it and sen'
                    + 'd it again.',
            },
            {
                code: '401',
                line:
                    'The Basic credentials name no identity, or the password'
                    + ' does not match. Check both and retry.',
            },
            {
                code: '429',
                line:
                    'Too many sign-in attempts from this address. Wait, then'
                    + ' retry.',
            },
            {
                code: '501',
                line:
                    'The method is passkey, provider, or oidc, which this se'
                    + 'rver does not offer yet. Use password.',
            },
        ],
        related: [],
        sample: {
            kind: 'sample',
            path: 'samples/post/authentication/authorize.json',
        },
    },
    {
        hash: 'post/authentication/token',
        verb: 'POST',
        uri: '/api/authentication/token',
        tier: 'none',
        headerSets: [
            {
                when: 'grant_type=authorization_code',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
            {
                when: 'grant_type=refresh',
                headers: [
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'cookie',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
            {
                when: 'grant_type=token-exchange',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
            {
                when: 'grant_type=client_credentials',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'Done. The body is the outcome.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion, or the request carries a precondition this route'
                    + ' does not take. The error names which; fix it and sen'
                    + 'd it again.',
            },
            {
                code: '401',
                line:
                    'The credential the token request carries is missing, un'
                    + 'known, used, or revoked: the code, the refresh cookie'
                    + ', or the assertion. Sign in again.',
            },
            {
                code: '403',
                line:
                    'The token request names an organization the subject is '
                    + 'no member of, or a token exchange names an actor othe'
                    + 'r than its subject.',
            },
            {
                code: '429',
                line:
                    'Too many sign-in attempts from this address. Wait, then'
                    + ' retry.',
            },
        ],
        related: [],
        sample: {
            kind: 'sample',
            path: 'samples/post/authentication/token.json',
        },
    },
    {
        hash: 'post/identities',
        verb: 'POST',
        uri: '/api/identities/',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion, or the request carries a precondition this route'
                    + ' does not take. The error names which; fix it and sen'
                    + 'd it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line: 'Your role is below organization admin.',
            },
            {
                code: '409',
                line:
                    'A document already exists at the id the body names, as '
                    + 'when a create is sent twice. Read it, or create under'
                    + ' a fresh id.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/post/identities.json',
        },
    },
    {
        hash: 'post/identities/id/tokens/jti/revocation',
        verb: 'POST',
        uri: '/api/identities/:id/tokens/:jti/revocation',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'Done. The body is the outcome.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion, or the request carries a precondition this route'
                    + ' does not take. The error names which; fix it and sen'
                    + 'd it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity other than yours that your r'
                    + 'ole may not act for, or one outside your organization'
                    + '.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/tokens/jti',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/post/identities/id/tokens/jti/revocation.json',
        },
    },
    {
        hash: 'post/identities/id/tokens/jti/rotation',
        verb: 'POST',
        uri: '/api/identities/:id/tokens/:jti/rotation',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion, or the request carries a precondition this route'
                    + ' does not take. The error names which; fix it and sen'
                    + 'd it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity other than yours that your r'
                    + 'ole may not act for, or one outside your organization'
                    + '.',
            },
            {
                code: '409',
                line:
                    'The jti is not live: rotating an unknown or used token '
                    + 'is reuse, which revokes its chain. Sign in again.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/tokens/jti',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/post/identities/id/tokens/jti/rotation.json',
        },
    },
    {
        hash: 'post/organizations/id/flows',
        verb: 'POST',
        uri: '/api/organizations/:id/flows/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion, or the request carries a precondition this route'
                    + ' does not take. The error names which; fix it and sen'
                    + 'd it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '409',
                line:
                    'A document already exists at the id the body names, as '
                    + 'when a create is sent twice. Read it, or create under'
                    + ' a fresh id.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/flows/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/post/organizations/id/flows.json',
        },
    },
    {
        hash: 'post/organizations/id/flows/id/undo',
        verb: 'POST',
        uri: '/api/organizations/:id/flows/:id/undo',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'Done. The body is the outcome.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
            {
                code: '428',
                line: 'Send If-Match with the ETag you read.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/flows/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/post/organizations/id/flows/id/undo.json',
        },
    },
    {
        hash: 'post/organizations/id/ideas/id/conversion',
        verb: 'POST',
        uri: '/api/organizations/:id/ideas/:id/conversion',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'Done. The body is the outcome.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
            {
                code: '428',
                line: 'Send If-Match with the ETag you read.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/ideas/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/post/organizations/id/ideas/id/conversion.json',
        },
    },
    {
        hash: 'post/organizations/id/invitations',
        verb: 'POST',
        uri: '/api/organizations/:id/invitations/',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'The invitation is already pending: its head is served a'
                    + 'gain.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion, or the request carries a precondition this route'
                    + ' does not take. The error names which; fix it and sen'
                    + 'd it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first. Or y'
                    + 'our role is below organization admin.',
            },
            {
                code: '409',
                line:
                    'The membership\'s state does not allow this change. Rea'
                    + 'd it again; the error names the rule.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/invitations/membership-id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/post/organizations/id/invitations.json',
        },
    },
    {
        hash: 'post/organizations/id/memberships',
        verb: 'POST',
        uri: '/api/organizations/:id/memberships/',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion, or the request carries a precondition this route'
                    + ' does not take. The error names which; fix it and sen'
                    + 'd it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first. Or y'
                    + 'our role is below organization admin.',
            },
            {
                code: '409',
                line:
                    'The membership\'s state does not allow this change. Rea'
                    + 'd it again; the error names the rule.',
            },
        ],
        related: [],
        sample: {
            kind: 'sample',
            path: 'samples/post/organizations/id/memberships.json',
        },
    },
    {
        hash: 'post/organizations/id/objectives',
        verb: 'POST',
        uri: '/api/organizations/:id/objectives/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion, or the request carries a precondition this route'
                    + ' does not take. The error names which; fix it and sen'
                    + 'd it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '409',
                line:
                    'A document already exists at the id the body names, as '
                    + 'when a create is sent twice. Read it, or create under'
                    + ' a fresh id.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/objectives/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/post/organizations/id/objectives.json',
        },
    },
    {
        hash: 'post/organizations/id/work-orders',
        verb: 'POST',
        uri: '/api/organizations/:id/work-orders/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion, or the request carries a precondition this route'
                    + ' does not take. The error names which; fix it and sen'
                    + 'd it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'The instance names a record type that was deleted, thou'
                    + 'gh the flow still joins it. Name another type the flo'
                    + 'w joins.',
            },
            {
                code: '409',
                line:
                    'A document already exists at the id the body names, as '
                    + 'when a create is sent twice. Read it, or create under'
                    + ' a fresh id.',
            },
            {
                code: '410',
                line:
                    'The instance id names a deleted instance, and a deleted'
                    + ' name is never written again. Send a fresh instance i'
                    + 'd.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/work-orders/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/post/organizations/id/work-orders.json',
        },
    },
    {
        hash: 'post/organizations/id/work-orders/id/transition',
        verb: 'POST',
        uri: '/api/organizations/:id/work-orders/:id/transition',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'Done. The body is the outcome.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
            {
                code: '428',
                line: 'Send If-Match with the ETag you read.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/work-orders/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/post/organizations/id/work-orders/id/transition.jso'
                + 'n',
        },
    },
    {
        hash: 'post/organizations/organization-id/record-types',
        verb: 'POST',
        uri: '/api/organizations/:organization-id/record-types/',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'An edit: the body names an existing record type, under '
                    + 'its If-Match.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first. Or y'
                    + 'our role is below organization admin.',
            },
            {
                code: '409',
                line:
                    'A document already exists at the id the body names, as '
                    + 'when a create is sent twice. Read it, or create under'
                    + ' a fresh id.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
            {
                code: '428',
                line:
                    'An edit body needs If-Match. Read the record type and s'
                    + 'end its ETag.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/post/organizations/organization-id/record-types.jso'
                + 'n',
        },
    },
    {
        hash: 'put/identities/id',
        verb: 'PUT',
        uri: '/api/identities/:id',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/identities',
                label: 'the collection',
            },
            {
                hash: 'get/identities/id/versions',
                label: 'versions',
            },
            {
                hash: 'get/identities/id/pii',
                label: 'pii',
            },
            {
                hash: 'get/identities/id/registration',
                label: 'registration',
            },
            {
                hash: 'get/identities/id/default-organization',
                label: 'default-organization',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/identities/id.json',
        },
    },
    {
        hash: 'put/identities/id/credentials/cid',
        verb: 'PUT',
        uri: '/api/identities/:id/credentials/:cid',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/credentials',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/identities/id/credentials/cid.json',
        },
    },
    {
        hash: 'put/identities/id/default-organization',
        verb: 'PUT',
        uri: '/api/identities/:id/default-organization',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity other than yours that your r'
                    + 'ole may not act for, or one outside your organization'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/identities/id/default-organization.json',
        },
    },
    {
        hash: 'put/identities/id/invitations/membership-id',
        verb: 'PUT',
        uri: '/api/identities/:id/invitations/:membership-id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Changed: the membership took the state or type sent. Th'
                    + 'e same body sent again under the new ETag answers 409'
                    + '.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity other than yours: only the i'
                    + 'nvitee reads or answers an invitation.',
            },
            {
                code: '404',
                line:
                    'The membership names another identity than the path\'s.',
            },
            {
                code: '405',
                line: 'A membership is never deleted: PUT its state instead.',
            },
            {
                code: '409',
                line:
                    'The membership\'s state does not allow this change. Rea'
                    + 'd it again; the error names the rule.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
            {
                code: '428',
                line: 'Send If-Match with the ETag you read.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/invitations',
                label: 'the collection',
            },
            {
                hash: 'get/identities/id/invitations/membership-id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/identities/id/invitations/membership-id.json',
        },
    },
    {
        hash: 'put/identities/id/pii',
        verb: 'PUT',
        uri: '/api/identities/:id/pii',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity other than yours that your r'
                    + 'ole may not act for, or one outside your organization'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/identities/id/pii.json',
        },
    },
    {
        hash: 'put/identities/id/providers/eid',
        verb: 'PUT',
        uri: '/api/identities/:id/providers/:eid',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/providers',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/identities/id/providers/eid.json',
        },
    },
    {
        hash: 'put/identities/id/registration',
        verb: 'PUT',
        uri: '/api/identities/:id/registration',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion, or the identity is not a service. The error name'
                    + 's which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/identities/id/registration.json',
        },
    },
    {
        hash: 'put/identities/id/token-revocations/rid',
        verb: 'PUT',
        uri: '/api/identities/:id/token-revocations/:rid',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity other than yours that your r'
                    + 'ole may not act for, or one outside your organization'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [],
        sample: {
            kind: 'sample',
            path: 'samples/put/identities/id/token-revocations/rid.json',
        },
    },
    {
        hash: 'put/identities/id/tokens/jti',
        verb: 'PUT',
        uri: '/api/identities/:id/tokens/:jti',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names an identity outside your organization. O'
                    + 'r your role is below organization admin.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/identities/id/tokens',
                label: 'the collection',
            },
            {
                hash: 'post/identities/id/tokens/jti/revocation',
                label: 'revocation',
            },
            {
                hash: 'post/identities/id/tokens/jti/rotation',
                label: 'rotation',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/identities/id/tokens/jti.json',
        },
    },
    {
        hash: 'put/organizations/id',
        verb: 'PUT',
        uri: '/api/organizations/:id',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'alternative',
                        alternatives: [
                            'if-match',
                            'if-none-match',
                        ],
                    },
                    {
                        name: 'if-none-match',
                        state: 'alternative',
                        alternatives: [
                            'if-match',
                            'if-none-match',
                        ],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first. Or y'
                    + 'our role is below organization admin.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
            {
                code: '428',
                line: 'Send If-Match with the ETag you read.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/organizations/id.json',
        },
    },
    {
        hash: 'put/organizations/id/ai-agents/id',
        verb: 'PUT',
        uri: '/api/organizations/:id/ai-agents/:id',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'alternative',
                        alternatives: [
                            'if-match',
                            'if-none-match',
                        ],
                    },
                    {
                        name: 'if-none-match',
                        state: 'alternative',
                        alternatives: [
                            'if-match',
                            'if-none-match',
                        ],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first. Or y'
                    + 'our role is below organization admin.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
            {
                code: '428',
                line: 'Send If-Match with the ETag you read.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/ai-agents',
                label: 'the collection',
            },
            {
                hash: 'get/organizations/id/ai-agents/id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/organizations/id/ai-agents/id.json',
        },
    },
    {
        hash: 'put/organizations/id/flows/id',
        verb: 'PUT',
        uri: '/api/organizations/:id/flows/:id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'alternative',
                        alternatives: [
                            'if-match',
                            'if-none-match',
                        ],
                    },
                    {
                        name: 'if-none-match',
                        state: 'alternative',
                        alternatives: [
                            'if-match',
                            'if-none-match',
                        ],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
            {
                code: '428',
                line:
                    'Send If-Match with the ETag you read, or If-None-Match:'
                    + ' * to create.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/flows',
                label: 'the collection',
            },
            {
                hash: 'get/organizations/id/flows/id/versions',
                label: 'versions',
            },
            {
                hash: 'post/organizations/id/flows/id/undo',
                label: 'undo',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/organizations/id/flows/id.json',
        },
    },
    {
        hash: 'put/organizations/id/flows/id/records/frid',
        verb: 'PUT',
        uri: '/api/organizations/:id/flows/:id/records/:frid',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/flows/id/records',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/organizations/id/flows/id/records/frid.json',
        },
    },
    {
        hash: 'put/organizations/id/flows/id/tags/name',
        verb: 'PUT',
        uri: '/api/organizations/:id/flows/:id/tags/:name',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [],
        sample: {
            kind: 'sample',
            path: 'samples/put/organizations/id/flows/id/tags/name.json',
        },
    },
    {
        hash: 'put/organizations/id/flows/id/work-orders/woid',
        verb: 'PUT',
        uri: '/api/organizations/:id/flows/:id/work-orders/:woid',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/flows/id/work-orders',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/put/organizations/id/flows/id/work-orders/woid.json',
        },
    },
    {
        hash: 'put/organizations/id/ideas/id',
        verb: 'PUT',
        uri: '/api/organizations/:id/ideas/:id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/ideas',
                label: 'the collection',
            },
            {
                hash: 'get/organizations/id/ideas/id/versions',
                label: 'versions',
            },
            {
                hash: 'post/organizations/id/ideas/id/conversion',
                label: 'conversion',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/organizations/id/ideas/id.json',
        },
    },
    {
        hash: 'put/organizations/id/ideas/id/submissions/sid',
        verb: 'PUT',
        uri: '/api/organizations/:id/ideas/:id/submissions/:sid',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/ideas/id/submissions',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/put/organizations/id/ideas/id/submissions/sid.json',
        },
    },
    {
        hash: 'put/organizations/id/invitations/membership-id',
        verb: 'PUT',
        uri: '/api/organizations/:id/invitations/:membership-id',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'alternative',
                        alternatives: [
                            'if-match',
                            'if-none-match',
                        ],
                    },
                    {
                        name: 'if-none-match',
                        state: 'alternative',
                        alternatives: [
                            'if-match',
                            'if-none-match',
                        ],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Changed: the membership took the state or type sent. Th'
                    + 'e same body sent again under the new ETag answers 409'
                    + '.',
            },
            {
                code: '201',
                line:
                    'Seated: the organization admin seated an identity direc'
                    + 'tly, as accepted with its type. The body is the membe'
                    + 'rship.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first. Or y'
                    + 'our role is below organization admin.',
            },
            {
                code: '404',
                line:
                    'No identity has this id: a direct seat names an identit'
                    + 'y that exists.',
            },
            {
                code: '405',
                line: 'A membership is never deleted: PUT its state instead.',
            },
            {
                code: '409',
                line:
                    'The membership\'s state does not allow this change. Rea'
                    + 'd it again; the error names the rule.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
            {
                code: '428',
                line:
                    'Send If-Match with the ETag you read, or If-None-Match:'
                    + ' * to create.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/invitations',
                label: 'the collection',
            },
            {
                hash:
                    'get/organizations/id/invitations/membership-id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/put/organizations/id/invitations/membership-id.json',
        },
    },
    {
        hash: 'put/organizations/id/objectives/id',
        verb: 'PUT',
        uri: '/api/organizations/:id/objectives/:id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/objectives',
                label: 'the collection',
            },
            {
                hash: 'get/organizations/id/objectives/id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/organizations/id/objectives/id.json',
        },
    },
    {
        hash: 'put/organizations/id/objectives/id/revisions/rid',
        verb: 'PUT',
        uri: '/api/organizations/:id/objectives/:id/revisions/:rid',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/objectives/id/revisions',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/put/organizations/id/objectives/id/revisions/rid.js'
                + 'on',
        },
    },
    {
        hash: 'put/organizations/id/projects/id',
        verb: 'PUT',
        uri: '/api/organizations/:id/projects/:id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/projects',
                label: 'the collection',
            },
            {
                hash: 'get/organizations/id/projects/id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/organizations/id/projects/id.json',
        },
    },
    {
        hash: 'put/organizations/id/projects/id/flows/pfid',
        verb: 'PUT',
        uri: '/api/organizations/:id/projects/:id/flows/:pfid',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/projects/id/flows',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/organizations/id/projects/id/flows/pfid.json',
        },
    },
    {
        hash: 'put/organizations/id/projects/id/objective-actual-scores/sid',
        verb: 'PUT',
        uri:
            '/api/organizations/:id/projects/:id/objective-actual-scores/:si'
            + 'd',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/id/projects/id/objective-actual-score'
                    + 's',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/put/organizations/id/projects/id/objective-actual-s'
                + 'cores/sid.json',
        },
    },
    {
        hash:
            'put/organizations/id/projects/id/objective-baseline-scores/sid',
        verb: 'PUT',
        uri:
            '/api/organizations/:id/projects/:id/objective-baseline-scores/:'
            + 'sid',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/id/projects/id/objective-baseline-sco'
                    + 'res',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/put/organizations/id/projects/id/objective-baseline'
                + '-scores/sid.json',
        },
    },
    {
        hash: 'put/organizations/id/services/id',
        verb: 'PUT',
        uri: '/api/organizations/:id/services/:id',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'alternative',
                        alternatives: [
                            'if-match',
                            'if-none-match',
                        ],
                    },
                    {
                        name: 'if-none-match',
                        state: 'alternative',
                        alternatives: [
                            'if-match',
                            'if-none-match',
                        ],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first. Or y'
                    + 'our role is below organization admin.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
            {
                code: '428',
                line: 'Send If-Match with the ETag you read.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/services',
                label: 'the collection',
            },
            {
                hash: 'get/organizations/id/services/id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/organizations/id/services/id.json',
        },
    },
    {
        hash: 'put/organizations/id/work-orders/id',
        verb: 'PUT',
        uri: '/api/organizations/:id/work-orders/:id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'alternative',
                        alternatives: [
                            'if-match',
                            'if-none-match',
                        ],
                    },
                    {
                        name: 'if-none-match',
                        state: 'alternative',
                        alternatives: [
                            'if-match',
                            'if-none-match',
                        ],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
            {
                code: '428',
                line: 'Send If-Match with the ETag you read.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/work-orders',
                label: 'the collection',
            },
            {
                hash: 'get/organizations/id/work-orders/id/versions',
                label: 'versions',
            },
            {
                hash: 'put/organizations/id/work-orders/id/claim',
                label: 'claim',
            },
            {
                hash: 'post/organizations/id/work-orders/id/transition',
                label: 'transition',
            },
            {
                hash: 'put/organizations/id/work-orders/id/binding',
                label: 'binding',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/organizations/id/work-orders/id.json',
        },
    },
    {
        hash: 'put/organizations/id/work-orders/id/binding',
        verb: 'PUT',
        uri: '/api/organizations/:id/work-orders/:id/binding',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
            {
                code: '428',
                line: 'Send If-Match with the ETag you read.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/work-orders/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/organizations/id/work-orders/id/binding.json',
        },
    },
    {
        hash: 'put/organizations/id/work-orders/id/claim',
        verb: 'PUT',
        uri: '/api/organizations/:id/work-orders/:id/claim',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'forbidden',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '404',
                line:
                    'Nothing has this id here. Use an id the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
            {
                code: '428',
                line: 'Send If-Match with the ETag you read.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/work-orders/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/put/organizations/id/work-orders/id/claim.json',
        },
    },
    {
        hash: 'put/organizations/organization-id/record-types/record-type-id',
        verb: 'PUT',
        uri:
            '/api/organizations/:organization-id/record-types/:record-type-i'
            + 'd',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first. Or y'
                    + 'our role is below organization admin.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/organization-id/record-types',
                label: 'the collection',
            },
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/put/organizations/organization-id/record-types/reco'
                + 'rd-type-id.json',
        },
    },
    {
        hash:
            'put/organizations/organization-id/record-types/record-type-id/a'
            + 'ttributes/attribute-id',
        verb: 'PUT',
        uri:
            '/api/organizations/:organization-id/record-types/:record-type-i'
            + 'd/attributes/:attribute-id',
        tier: 'admin',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'if-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'if-none-match',
                        state: 'optional',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line:
                    'Replaced. A body equal to the stored one writes nothing'
                    + ' and answers the same ETag.',
            },
            {
                code: '201',
                line: 'Created. The body is the stored document.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object, or a field fails validat'
                    + 'ion. The error names which; fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first. Or y'
                    + 'our role is below organization admin.',
            },
            {
                code: '404',
                line:
                    'No record type has this id. Use one the listing returns'
                    + '.',
            },
            {
                code: '412',
                line:
                    'If-Match names no current version. Read the document ag'
                    + 'ain and retry under its ETag.',
            },
        ],
        related: [
            {
                hash:
                    'get/organizations/organization-id/record-types/record-t'
                    + 'ype-id/attributes',
                label: 'the collection',
            },
        ],
        sample: {
            kind: 'sample',
            path:
                'samples/put/organizations/organization-id/record-types/reco'
                + 'rd-type-id/attributes/attribute-id.json',
        },
    },
    {
        hash: 'query/organizations/id',
        verb: 'QUERY',
        uri: '/api/organizations/:id',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'content-type',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The matching documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object with a string q of at mos'
                    + 't 256 characters. Fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '415',
                line:
                    'A QUERY body is application/json. Send that Content-Typ'
                    + 'e.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/versions',
                label: 'versions',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/query/organizations/id.json',
        },
    },
    {
        hash: 'query/organizations/id/memberships',
        verb: 'QUERY',
        uri: '/api/organizations/:id/memberships/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'content-type',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [
            {
                name: 'state',
                values: [
                    'accepted',
                    'removed',
                ],
                absent: 'accepted',
            },
        ],
        answers: [
            {
                code: '200',
                line: 'The matching documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object with a string q of at mos'
                    + 't 256 characters, or ?state= names no state this list'
                    + ' takes. Fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '415',
                line:
                    'A QUERY body is application/json. Send that Content-Typ'
                    + 'e.',
            },
        ],
        related: [],
        sample: {
            kind: 'sample',
            path: 'samples/query/organizations/id/memberships.json',
        },
    },
    {
        hash: 'query/organizations/id/work-orders',
        verb: 'QUERY',
        uri: '/api/organizations/:id/work-orders/',
        tier: 'member',
        headerSets: [
            {
                when: '',
                headers: [
                    {
                        name: 'authorization',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'operation-id',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'content-type',
                        state: 'required',
                        alternatives: [],
                    },
                    {
                        name: 'request-id',
                        state: 'forbidden',
                        alternatives: [],
                    },
                ],
            },
        ],
        query: [],
        answers: [
            {
                code: '200',
                line: 'The matching documents, one part each.',
            },
            {
                code: '204',
                line:
                    'Nothing is selected: the collection is empty, or nothin'
                    + 'g matches. No body.',
            },
            {
                code: '400',
                line:
                    'The body is not a JSON object with a string q of at mos'
                    + 't 256 characters. Fix it and send it again.',
            },
            {
                code: '401',
                line:
                    'No bearer, or one expired or revoked. Refresh the sessi'
                    + 'on, or sign in again.',
            },
            {
                code: '403',
                line:
                    'The path names another organization than your token\'s.'
                    + ' Exchange the token for that organization first.',
            },
            {
                code: '415',
                line:
                    'A QUERY body is application/json. Send that Content-Typ'
                    + 'e.',
            },
        ],
        related: [
            {
                hash: 'get/organizations/id/work-orders/id',
                label: 'the item',
            },
        ],
        sample: {
            kind: 'sample',
            path: 'samples/query/organizations/id/work-orders.json',
        },
    },
];

export const API_DOC_STATUSES: readonly ApiDocStatus[] = [
    {
        hash: 'statuses/200',
        code: '200',
        body: 'empty',
    },
    {
        hash: 'statuses/201',
        code: '201',
        body: 'empty',
    },
    {
        hash: 'statuses/204',
        code: '204',
        body: 'empty',
    },
    {
        hash: 'statuses/400',
        code: '400',
        body: '{\n  "error": "validation message"\n}',
    },
    {
        hash: 'statuses/401',
        code: '401',
        body: '{\n  "error": "invalid_token"\n}',
    },
    {
        hash: 'statuses/403',
        code: '403',
        body:
            '{\n  "error":\n  "forbidden: path organization does not match t'
            + 'he token organization"\n}',
    },
    {
        hash: 'statuses/404',
        code: '404',
        body: '{\n  "error": "Not found: /path"\n}',
    },
    {
        hash: 'statuses/405',
        code: '405',
        body: '{\n  "error": "Method GET not allowed on /path"\n}',
    },
    {
        hash: 'statuses/409',
        code: '409',
        body: '{\n  "error": "conflict message"\n}',
    },
    {
        hash: 'statuses/410',
        code: '410',
        body: '{\n  "error": "Gone: table/id"\n}',
    },
    {
        hash: 'statuses/411',
        code: '411',
        body: '{\n  "error": "A request body requires Content-Length"\n}',
    },
    {
        hash: 'statuses/412',
        code: '412',
        body: '{\n  "error": "precondition failed"\n}',
    },
    {
        hash: 'statuses/413',
        code: '413',
        body: '{\n  "error": "payload too large"\n}',
    },
    {
        hash: 'statuses/415',
        code: '415',
        body: '{\n  "error": "QUERY /path takes application/json"\n}',
    },
    {
        hash: 'statuses/428',
        code: '428',
        body: '{\n  "error": "If-Match required"\n}',
    },
    {
        hash: 'statuses/429',
        code: '429',
        body: '{\n  "error": "too many requests"\n}',
    },
    {
        hash: 'statuses/500',
        code: '500',
        body: '{\n  "error": "git sha unavailable"\n}',
    },
    {
        hash: 'statuses/501',
        code: '501',
        body: '{\n  "error": "passkey auth is a server-tier seam"\n}',
    },
    {
        hash: 'statuses/503',
        code: '503',
        body:
            '{\n  "git-sha": "0123456789abcdef0123456789abcdef01234567",\n  '
            + '"git-subject": "Answer system status at /api/status",\n  "up"'
            + ': false,\n  "components": {\n    "postgres": "down"\n  }\n}',
    },
    {
        hash: 'statuses/504',
        code: '504',
        body: '{\n  "error": "gateway timeout"\n}',
    },
];

export const API_DOC_STEPS: readonly ApiDocStep[] = [
    {
        hash: 'start/sign-in',
        title: 'Sign in',
        prose: [
            'Sign in with your username and password in two calls. Before th'
            + 'e first, make a verifier and its S256 challenge. The first ca'
            + 'll sends your username and password under Basic, with the cha'
            + 'llenge, and answers a code in Authentication-Info. The second'
            + ' sends the code and the verifier under Basic, and answers you'
            + 'r access token in Authentication-Info and a refresh cookie.',
            'Every call needs an Operation-ID of its own: run the first line'
            + ' before each call. Step 2 says why.',
            'A line that reads an answer reads the call\'s output, headers i'
            + 'ncluded, on its standard input. Save the output with curl '
            + '\u2026 > answer.txt, then run the line as { LINE; } < answer.'
            + 'txt.',
            'Send the token on every other call as Authorization: Bearer $TO'
            + 'KEN. The answer\'s expires_in says for how many seconds it se'
            + 'rves.',
        ],
        shell: [
            'OPERATION_ID=$(openssl rand 16 | openssl base64 -A | tr \'+/\' '
            + '\'-_\' | tr -d \'=\')',
            'VERIFIER=$(openssl rand 32 | openssl base64 -A | tr \'+/\' \'-_'
            + '\' | tr -d \'=\')',
            'CHALLENGE=$(printf \'%s\' "$VERIFIER" | openssl dgst -sha256 -b'
            + 'inary | openssl base64 -A | tr \'+/\' \'-_\' | tr -d \'=\')',
            'CODE=$(grep -i \'^authentication-info:\' | sed \'s/.*code="\\(['
            + '^"]*\\)".*/\\1/\')',
            'TOKEN=$(grep -i \'^authentication-info:\' | sed \'s/.*access_to'
            + 'ken="\\([^"]*\\)".*/\\1/\')',
        ],
        sample: {
            kind: 'sample',
            path: 'samples/start/sign-in.json',
        },
    },
    {
        hash: 'start/operation-id',
        title: 'Every request needs an Operation-ID',
        prose: [
            'Send a fresh Operation-ID on every request: 16 random bytes in '
            + 'base64url, 22 characters. A write that changes a document car'
            + 'ries it back in its answer. A read\'s answer, and a write\'s '
            + 'that changes nothing, name the Operation-ID of the write that'
            + ' made the document.',
            'This call reads the organization your identity opens by default'
            + '; the next step reads it.',
            'A sample shows what the API answered, with the server\'s defaul'
            + 'ts. The HTTP layer frames the answer on the wire: it sets con'
            + 'tent-length, and adds date where the answer has none.',
        ],
        shell: [
            'OPERATION_ID=$(openssl rand 16 | openssl base64 -A | tr \'+/\' '
            + '\'-_\' | tr -d \'=\')',
        ],
        sample: {
            kind: 'sample',
            path: 'samples/start/operation-id.json',
        },
    },
    {
        hash: 'start/read',
        title: 'Read your organization',
        prose: [
            'A read of one document answers it as JSON, with the ETag that n'
            + 'ames this version of it.',
        ],
        shell: [],
        sample: {
            kind: 'sample',
            path: 'samples/start/read.json',
        },
    },
    {
        hash: 'start/list',
        title: 'List its flows',
        prose: [
            'A read of a collection answers multipart/mixed: one part per do'
            + 'cument, each the answer a read of that document gives, with i'
            + 'ts own status line, headers, ETag, and body.',
            'This sample shows the first 2 parts and counts the rest.',
        ],
        shell: [],
        sample: {
            kind: 'sample',
            path: 'samples/start/list.json',
        },
    },
    {
        hash: 'start/change',
        title: 'Change one',
        prose: [
            'Read the flow and keep its ETag. Write it back with one change,'
            + ' its name, under If-Match: that ETag. The write lands only on'
            + ' the version you read: if another landed first, the answer is'
            + ' 412, and you read again. The answer names the new version\'s'
            + ' ETag.',
        ],
        shell: [
            'ETAG=$(grep -i \'^etag:\' | sed \'s/^[^:]*: *//\' | tr -d \'\\r'
            + '\')',
        ],
        sample: {
            kind: 'sample',
            path: 'samples/start/change.json',
        },
    },
    {
        hash: 'start/unattended',
        title: 'Going unattended',
        prose: [
            'A program that runs with no person signs in as a service, with '
            + 'a key of its own. This step needs an organization admin: one '
            + 'creates the service and registers its public key. The service'
            + ' then signs an assertion with its private key and exchanges i'
            + 't for an access token, under grant_type client_credentials.',
            'Register your own key: put its public coordinates, in base64url'
            + ', where the registration shows $JWK_X and $JWK_Y. Sign the as'
            + 'sertion with a JOSE library. This guide stops at what the ass'
            + 'ertion carries: no single openssl command makes an ES256 sign'
            + 'ature in the form JWS needs.',
            'The assertion is signed with RS256 or ES256.',
            'Its claims:',
            'iss (required): the client id.',
            'sub (required): the client id.',
            'aud (required): the audience the client\'s registration names.',
            'exp (required): a time in epoch seconds, still in the future.',
            'nbf (optional): when sent, a time in epoch seconds already past'
            + '.',
            'jti (required): a fresh id of letters, digits, _ and -; an asse'
            + 'rtion is spent once.',
            'Send it as Authorization: Bearer $CLIENT_ASSERTION, with the se'
            + 'rvice\'s id as client_id in the body. The answer\'s access to'
            + 'ken is the service\'s $TOKEN.',
        ],
        shell: [],
        sample: {
            kind: 'sample',
            path: 'samples/start/unattended.json',
        },
    },
];

export const API_DOC_TRANSPORT: readonly ApiDocHeaderSet[] = [
    {
        when: '',
        headers: [
            {
                name: 'content-length',
                state: 'required',
                alternatives: [],
            },
            {
                name: 'transfer-encoding',
                state: 'forbidden',
                alternatives: [],
            },
        ],
    },
    {
        when: 'POST /api/authentication/token grant_type=authorization_code',
        headers: [
            {
                name: 'content-length',
                state: 'required',
                alternatives: [],
            },
            {
                name: 'transfer-encoding',
                state: 'forbidden',
                alternatives: [],
            },
            {
                name: 'forwarded',
                state: 'optional',
                alternatives: [],
            },
            {
                name: 'x-forwarded-for',
                state: 'optional',
                alternatives: [],
            },
        ],
    },
    {
        when: 'POST /api/authentication/token grant_type=client_credentials',
        headers: [
            {
                name: 'content-length',
                state: 'required',
                alternatives: [],
            },
            {
                name: 'transfer-encoding',
                state: 'forbidden',
                alternatives: [],
            },
            {
                name: 'forwarded',
                state: 'optional',
                alternatives: [],
            },
            {
                name: 'x-forwarded-for',
                state: 'optional',
                alternatives: [],
            },
        ],
    },
    {
        when: 'POST /api/authentication/authorize',
        headers: [
            {
                name: 'content-length',
                state: 'required',
                alternatives: [],
            },
            {
                name: 'transfer-encoding',
                state: 'forbidden',
                alternatives: [],
            },
            {
                name: 'forwarded',
                state: 'optional',
                alternatives: [],
            },
            {
                name: 'x-forwarded-for',
                state: 'optional',
                alternatives: [],
            },
        ],
    },
];

export const API_DOC_GENERIC_ANSWERS: readonly ApiDocAnswer[] = [
    {
        code: '400',
        line:
            'Operation-ID is missing, or is not a 22-character identifier. S'
            + 'end a fresh one on every request.',
    },
    {
        code: '400',
        line:
            'The request carries a Request-ID. The server mints it; send non'
            + 'e.',
    },
    {
        code: '400',
        line:
            'Content-Length does not match the body. Send the body\'s length'
            + ' in bytes.',
    },
    {
        code: '400',
        line:
            'A path id is not a 22-character identifier, or a membership id '
            + 'is not two joined by a colon. Use an id a listing returns.',
    },
    {
        code: '400',
        line:
            'If-Match is not one strong validator, If-None-Match is not *, o'
            + 'r If-None-Match comes where the route takes only If-Match. Se'
            + 'nd the ETag you read, quotes included.',
    },
    {
        code: '411',
        line:
            'A body came without Content-Length, or with Transfer-Encoding. '
            + 'Send the body with its length.',
    },
    {
        code: '413',
        line: 'The body is over 1048576 bytes. Send a smaller one.',
    },
    {
        code: '500',
        line:
            'The server failed. The error is "internal error", or names a da'
            + 'tabase fault\'s class, such as a deadlock: retry, and report '
            + 'the Request-ID if it persists.',
    },
    {
        code: '504',
        line: 'The database did not answer in time. Retry later.',
    },
];

export const API_DOC_CURL_ADDS: readonly string[] = [
    'host',
    'user-agent',
    'accept',
    'content-length',
];
