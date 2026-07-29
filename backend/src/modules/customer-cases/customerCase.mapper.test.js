const customerCaseMapper = require('./customerCase.mapper');

describe('customer case mapper', () => {
    it('includes the registered customer phone in the case customer summary', () => {
        const result = customerCaseMapper.toCustomerCaseDto({
            _id: '507f1f77bcf86cd799439010',
            customer_id: {
                _id: '507f1f77bcf86cd799439011',
                full_name: 'Nguyen Van A',
                role: 'CUSTOMER',
                phone: '0901234567',
            },
            assigned_to_id: {
                _id: '507f1f77bcf86cd799439012',
                full_name: 'Staff One',
                role: 'STAFF',
                phone: '0909999999',
            },
            upload_ids: [],
        });

        expect(result.customer).toEqual({
            id: '507f1f77bcf86cd799439011',
            full_name: 'Nguyen Van A',
            role: 'CUSTOMER',
            phone: '0901234567',
        });
        expect(result.assigned_to).not.toHaveProperty('phone');
    });
});
