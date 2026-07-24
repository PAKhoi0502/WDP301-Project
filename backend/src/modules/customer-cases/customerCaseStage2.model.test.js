const mongoose = require('mongoose');

const CustomerCaseTechnicalAssessment = require('./customerCaseTechnicalAssessment.model');
const CustomerCaseResolution = require('./customerCaseResolution.model');
const CustomerCaseRefund = require('./customerCaseRefund.model');

const id = () => new mongoose.Types.ObjectId();

describe('customer case stage 2 models', () => {
    it('requires complete findings before a technical assessment is submitted', async () => {
        const assessment = new CustomerCaseTechnicalAssessment({
            case_id: id(),
            garage_id: id(),
            inspector_staff_profile_id: id(),
            inspector_user_id: id(),
            assigned_by_id: id(),
            assigned_at: new Date(),
            status: 'SUBMITTED',
            findings: 'The scratch is new and visible.',
        });

        await expect(assessment.validate()).rejects.toMatchObject({
            errors: expect.objectContaining({ findings: expect.anything() }),
        });
    });

    it('accepts a versioned resolution with linked actions', () => {
        const resolution = new CustomerCaseResolution({
            case_id: id(),
            version: 1,
            summary: 'Refund and schedule a corrective rework service.',
            proposed_by_id: id(),
            proposed_at: new Date(),
            actions: [
                { action_type: 'REFUND', amount: 100000, refund_method: 'BANK_TRANSFER' },
                { action_type: 'REWORK', rework_start_time: new Date(Date.now() + 86400000) },
            ],
        });

        expect(resolution.validateSync()).toBeUndefined();
    });

    it('requires a valid refund method and positive amount', () => {
        const refund = new CustomerCaseRefund({
            case_id: id(),
            resolution_id: id(),
            booking_id: id(),
            amount: 0,
            method: 'UNKNOWN',
            approved_by_id: id(),
            approved_at: new Date(),
        });

        const error = refund.validateSync();
        expect(error.errors.amount).toBeDefined();
        expect(error.errors.method).toBeDefined();
    });

    it('does not allow no-compensation to be combined with another action', async () => {
        const resolution = new CustomerCaseResolution({
            case_id: id(),
            version: 1,
            summary: 'This invalid proposal mixes conflicting actions.',
            proposed_by_id: id(),
            proposed_at: new Date(),
            actions: [
                { action_type: 'NO_COMPENSATION' },
                { action_type: 'REWORK', rework_start_time: new Date(Date.now() + 86400000) },
            ],
        });

        await expect(resolution.validate()).rejects.toMatchObject({
            errors: expect.objectContaining({ actions: expect.anything() }),
        });
    });

    it('requires a positive amount for a charge waiver', async () => {
        const resolution = new CustomerCaseResolution({
            case_id: id(),
            version: 1,
            summary: 'Garage proposes waiving the remaining service charge.',
            proposed_by_id: id(),
            proposed_at: new Date(),
            actions: [{ action_type: 'WAIVE_CHARGE' }],
        });

        await expect(resolution.validate()).rejects.toMatchObject({
            errors: expect.objectContaining({ actions: expect.anything() }),
        });
    });

    it('does not allow refund and charge waiver in the same proposal', async () => {
        const resolution = new CustomerCaseResolution({
            case_id: id(),
            version: 1,
            summary: 'This invalid proposal mixes pre-payment and post-payment actions.',
            proposed_by_id: id(),
            proposed_at: new Date(),
            actions: [
                { action_type: 'REFUND', amount: 100000, refund_method: 'BANK_TRANSFER' },
                { action_type: 'WAIVE_CHARGE', amount: 100000 },
            ],
        });

        await expect(resolution.validate()).rejects.toMatchObject({
            errors: expect.objectContaining({ actions: expect.anything() }),
        });
    });

    it('requires a transaction reference before a refund is completed', async () => {
        const refund = new CustomerCaseRefund({
            case_id: id(),
            resolution_id: id(),
            booking_id: id(),
            amount: 100000,
            method: 'BANK_TRANSFER',
            status: 'COMPLETED',
            approved_by_id: id(),
            approved_at: new Date(),
        });

        await expect(refund.validate()).rejects.toMatchObject({
            errors: expect.objectContaining({ transaction_reference: expect.anything() }),
        });
    });
});
