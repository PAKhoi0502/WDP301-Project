const openApiSpec = require('./index');
const { HTTP_METHODS, metadataByOperation } = require('./roleMetadata');

describe('OpenAPI server configuration', () => {
    it('uses the current origin for API requests', () => {
        expect(openApiSpec.servers).toEqual([
            {
                url: '/api/v1',
                description: 'Current server',
            },
        ]);
    });
});

describe('OpenAPI role metadata', () => {
    const getOperations = () => {
        const operations = [];

        Object.entries(openApiSpec.paths).forEach(([path, pathItem]) => {
            HTTP_METHODS.forEach((method) => {
                const operation = pathItem[method];

                if (operation) {
                    operations.push({
                        key: `${method.toUpperCase()} ${path}`,
                        operation,
                    });
                }
            });
        });

        return operations;
    };

    it('documents every operation with role and function metadata', () => {
        getOperations().forEach(({ key, operation }) => {
            expect(metadataByOperation.has(key)).toBe(true);
            expect(operation['x-roles']).toEqual(expect.any(Array));
            expect(operation['x-roles'].length).toBeGreaterThan(0);
            expect(operation['x-feature']).toEqual(expect.any(String));
            expect(operation['x-auth']).toEqual(expect.any(String));
            expect(operation.summary).toMatch(/^\[[A-Z, ]+\] .+ - .+/);
            expect(operation.description).toContain('**Roles:**');
            expect(operation.description).toContain('**Function:**');
            expect(operation.description).toContain('**Auth:**');
        });
    });

    it('does not keep undocumented metadata entries', () => {
        const operationKeys = new Set(getOperations().map(({ key }) => key));

        Array.from(metadataByOperation.keys()).forEach((key) => {
            expect(operationKeys.has(key)).toBe(true);
        });
    });

    it('separates staff and admin tags for shared operations', () => {
        const operation = openApiSpec.paths['/admin/bookings'].get;

        expect(operation['x-roles']).toEqual(['STAFF', 'ADMIN']);
        expect(operation.tags).toContain('STAFF / Booking operations');
        expect(operation.tags).toContain('ADMIN / Booking operations');
        expect(operation.summary).toContain('[STAFF, ADMIN]');
    });

    it('marks admin-only operations clearly', () => {
        const operation = openApiSpec.paths['/admin/bookings/{id}/reopen-service'].patch;

        expect(operation['x-roles']).toEqual(['ADMIN']);
        expect(operation.tags).toEqual(['ADMIN / Booking operations']);
        expect(operation.summary).toContain('[ADMIN]');
    });
});
