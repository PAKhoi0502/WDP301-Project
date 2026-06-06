const mongoose = require('mongoose');

const Promotion = require('./promotion.model');
const PromotionMapper = require('./promotion.mapper');
const {
    createPromotionSchema,
    updatePromotionSchema,
    validatePromotionSchema,
} = require('./promotion.validator');

describe('promotion module', () => {
    const servicePackageId = new mongoose.Types.ObjectId().toString();
    const promotionId = new mongoose.Types.ObjectId().toString();

    it('validates and normalizes promotion create payload', () => {
        const result = createPromotionSchema.safeParse({
            body: {
                code: ' welcome10 ',
                name: 'Welcome discount',
                discount_type: 'PERCENTAGE',
                discount_value: '10',
                start_at: '2026-06-01T00:00:00+07:00',
                end_at: '2026-06-30T23:59:59+07:00',
            },
        });

        expect(result.success).toBe(true);
        expect(result.data.body).toMatchObject({
            code: 'WELCOME10',
            discount_value: 10,
            min_order_amount: 0,
            applicable_tiers: [],
            applicable_vehicle_types: [],
            applicable_service_package_ids: [],
        });
    });

    it('rejects invalid percentage and invalid date range', () => {
        const result = createPromotionSchema.safeParse({
            body: {
                code: 'TOO_HIGH',
                name: 'Invalid promotion',
                discount_type: 'PERCENTAGE',
                discount_value: 101,
                start_at: '2026-06-30T00:00:00+07:00',
                end_at: '2026-06-01T00:00:00+07:00',
            },
        });

        expect(result.success).toBe(false);
        expect(result.error.issues.map((issue) => issue.message)).toEqual(
            expect.arrayContaining([
                'Percentage discount must not exceed 100',
                'Promotion end time must be after start time',
            ])
        );
    });

    it('validates promotion code lookup payload', () => {
        const result = validatePromotionSchema.safeParse({
            body: {
                promotion_code: ' silver20 ',
                service_package_id: servicePackageId,
            },
        });

        expect(result.success).toBe(true);
        expect(result.data.body.promotion_code).toBe('SILVER20');
    });

    it('requires at least one update field', () => {
        const result = updatePromotionSchema.safeParse({
            params: { id: promotionId },
            body: {},
        });

        expect(result.success).toBe(false);
        expect(result.error.issues[0].message).toBe('At least one field is required');
    });

    it('applies model-level promotion rules', async () => {
        const promotion = new Promotion({
            code: 'BAD_PERCENT',
            name: 'Bad percent',
            discount_type: 'PERCENTAGE',
            discount_value: 150,
            start_at: new Date('2026-06-01T00:00:00+07:00'),
            end_at: new Date('2026-06-30T23:59:59+07:00'),
        });

        await expect(promotion.validate()).rejects.toMatchObject({
            errors: {
                discount_value: {
                    message: 'Percentage discount must not exceed 100',
                },
            },
        });
    });

    it('maps promotion documents with populated service packages', () => {
        const now = new Date('2026-06-01T00:00:00+07:00');
        const dto = PromotionMapper.toPromotionDto({
            _id: promotionId,
            code: 'WELCOME10',
            name: 'Welcome discount',
            description: null,
            discount_type: 'FIXED_AMOUNT',
            discount_value: 10000,
            max_discount_amount: null,
            min_order_amount: 50000,
            applicable_tiers: ['BRONZE'],
            applicable_vehicle_types: ['CAR'],
            applicable_service_package_ids: [
                {
                    _id: servicePackageId,
                    name: 'Basic Wash',
                    vehicle_type: 'CAR',
                    service_type: 'WASH',
                    base_price: 100000,
                    is_active: true,
                },
            ],
            start_at: now,
            end_at: now,
            usage_limit: 100,
            per_customer_limit: 1,
            used_count: 0,
            is_active: true,
            created_by_id: null,
            updated_by_id: null,
            created_at: now,
            updated_at: now,
        });

        expect(dto).toMatchObject({
            id: promotionId,
            code: 'WELCOME10',
            applicable_service_package_ids: [
                {
                    id: servicePackageId,
                    name: 'Basic Wash',
                    base_price: 100000,
                },
            ],
        });
    });
});
