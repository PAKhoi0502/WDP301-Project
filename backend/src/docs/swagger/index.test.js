const openApiSpec = require('./index');
const {
    STAFF_CAPABILITIES,
    STAFF_CAPABILITY_VALUES,
} = require('../../shared/constants/staff.constant');
const {
    HTTP_METHODS,
    STAFF_OPERATION_POLICIES,
    metadataByOperation,
} = require('./roleMetadata');

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

describe('OpenAPI staff capability contract', () => {
    it('publishes the canonical current-staff capability response', () => {
        const capabilityKey = openApiSpec.components.schemas.StaffCapabilityKey;
        const context = openApiSpec.components.schemas.StaffCapabilityContext;
        const response = openApiSpec.components.schemas.StaffCapabilitiesResponse;
        const operation = openApiSpec.paths['/staff-profiles/me/capabilities'].get;

        expect(capabilityKey.enum).toEqual(STAFF_CAPABILITY_VALUES);
        expect(Object.keys(context.properties)).toEqual([
            'is_admin',
            'user_id',
            'staff_profile_id',
            'staff_type',
            'staff_group',
            'garage_id',
            'capabilities',
        ]);
        expect(context.properties.capabilities.items).toEqual({
            $ref: '#/components/schemas/StaffCapabilityKey',
        });
        expect(response.properties.data).toEqual({
            $ref: '#/components/schemas/StaffCapabilityContext',
        });
        expect(operation.responses[200].content['application/json'].schema).toEqual({
            $ref: '#/components/schemas/StaffCapabilitiesResponse',
        });
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

    it('publishes canonical capability policies for protected staff operations', () => {
        const operationsByKey = new Map(
            getOperations().map(({ key, operation }) => [key, operation])
        );

        Array.from(STAFF_OPERATION_POLICIES.entries()).forEach(([key, policy]) => {
            const operation = operationsByKey.get(key);

            expect(operation).toBeDefined();
            expect(operation['x-required-capabilities']).toEqual(policy.capabilities);
            expect(operation['x-capability-match']).toBe(policy.match);
            expect(operation['x-resource-scope']).toBe(policy.resourceScope);
            expect(operation.description).toContain('**Capabilities:**');

            policy.capabilities.forEach((capability) => {
                expect(STAFF_CAPABILITY_VALUES).toContain(capability);
            });

            if (policy.selector) {
                expect(operation['x-capability-selector']).toBe(policy.selector);
            }
        });
    });

    it('documents every shared staff-admin operation that is capability protected', () => {
        const capabilityExemptOperations = new Set([
            'PATCH /staff-profiles/type-change-requests/{requestId}/cancel',
        ]);

        getOperations().forEach(({ key, operation }) => {
            const isSharedStaffAdminOperation = (
                operation['x-roles'].includes('STAFF')
                && operation['x-roles'].includes('ADMIN')
            );

            if (isSharedStaffAdminOperation && !capabilityExemptOperations.has(key)) {
                expect(STAFF_OPERATION_POLICIES.has(key)).toBe(true);
                expect(operation['x-required-capabilities']).toEqual(expect.any(Array));
            }
        });
    });

    it('documents assigned booking reads as an any-capability policy', () => {
        const operation = openApiSpec.paths['/admin/bookings'].get;

        expect(operation['x-required-capabilities']).toEqual([
            STAFF_CAPABILITIES.BOOKING_READ_GARAGE,
            STAFF_CAPABILITIES.BOOKING_READ_ASSIGNED,
        ]);
        expect(operation['x-capability-match']).toBe('any');
        expect(operation['x-resource-scope']).toBe('garage-or-assigned');
    });

    it('documents incident reporting as a request-resolved capability', () => {
        const operation = openApiSpec.paths['/admin/bookings/{id}/incidents'].post;

        expect(operation['x-capability-match']).toBe('resolved');
        expect(operation['x-capability-selector']).toBe('request.body.incident_type');
        expect(operation['x-required-capabilities']).toEqual([
            STAFF_CAPABILITIES.INCIDENT_REPORT_WASH_BAY_FAILURE,
            STAFF_CAPABILITIES.INCIDENT_REPORT_STAFF_UNAVAILABLE,
            STAFF_CAPABILITIES.INCIDENT_REPORT_OTHER_GARAGE,
        ]);
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
