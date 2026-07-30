const { randomBytes } = require('crypto');

const CustomerVoucher = require('./customerVoucher.model');
const CustomerVoucherMapper = require('./customerVoucher.mapper');
const ServicePackage = require('../service-packages/servicePackage.model');
const User = require('../users/user.model');
const Garage = require('../garages/garage.model');
const servicePriceRuleService = require('../service-price-rules/servicePriceRule.service');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const notificationService = require('../notifications/notification.service');
const auditLogService = require('../audit-logs/auditLog.service');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    CUSTOMER_VOUCHER_TYPES,
    CUSTOMER_VOUCHER_STATUS,
    CUSTOMER_VOUCHER_SOURCES,
} = require('../../shared/constants/customerVoucher.constant');
const {
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
} = require('../../shared/constants/notification.constant');
const { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } = require('../../shared/constants/audit.constant');
const { normalizePhone, isValidPhone } = require('../../shared/utils/phone');

const getStaffVoucherLimit = () => {
    const value = Number(process.env.GARAGE_COMPENSATION_STAFF_MAX_AMOUNT || 100000);

    return Number.isInteger(value) && value >= 0 ? value : 100000;
};

const normalizeCode = (value) => String(value || '').trim().toUpperCase();

const generateVoucherCode = () => `CARE_${randomBytes(6).toString('hex').toUpperCase()}`;

const buildVoucherOwnerFilter = ({ customerId, guestPhoneNormalized }) => {
    if (customerId) {
        return { customer_id: customerId };
    }

    const normalizedGuestPhone = normalizePhone(guestPhoneNormalized);

    if (!isValidPhone(normalizedGuestPhone)) {
        throw new AppError(
            'A registered customer or valid guest phone is required for the voucher',
            400,
            'CUSTOMER_VOUCHER_OWNER_REQUIRED'
        );
    }

    return {
        customer_id: null,
        normalized_guest_phone: normalizedGuestPhone,
    };
};

const populateVoucherQuery = (query) => query
    .populate('customer_id', 'full_name email phone')
    .populate('garage_id', 'name garage_code')
    .populate('service_package_id', 'name service_type vehicle_type base_price')
    .populate('issued_by_id', 'full_name email phone role')
    .populate('approved_by_id', 'full_name email phone role');

const getVoucherDocumentById = async (voucherId, session = null) => {
    const query = CustomerVoucher.findById(voucherId);
    const voucher = session ? await query.session(session) : await query;

    if (!voucher) {
        throw new AppError('Customer voucher not found', 404, 'CUSTOMER_VOUCHER_NOT_FOUND');
    }

    return voucher;
};

const expireVoucherIfNeeded = async (voucher, session = null) => {
    if (
        voucher.expires_at <= new Date()
        && voucher.status === CUSTOMER_VOUCHER_STATUS.ISSUED
    ) {
        voucher.status = CUSTOMER_VOUCHER_STATUS.EXPIRED;
        voucher.reserved_booking_id = null;
        voucher.reserved_at = null;
        await voucher.save(session ? { session } : undefined);
    }

    return voucher.status === CUSTOMER_VOUCHER_STATUS.EXPIRED;
};

const calculateVoucherDiscount = ({ voucher, servicePackage, orderAmount }) => {
    if (orderAmount < voucher.min_order_amount) {
        throw new AppError(
            'Booking amount does not meet voucher minimum order amount',
            400,
            'CUSTOMER_VOUCHER_MIN_ORDER_NOT_MET'
        );
    }

    if (
        voucher.voucher_type === CUSTOMER_VOUCHER_TYPES.FREE_SERVICE
        && voucher.service_package_id.toString() !== servicePackage._id.toString()
    ) {
        throw new AppError(
            'Voucher is not applicable to selected service package',
            400,
            'CUSTOMER_VOUCHER_SERVICE_NOT_APPLICABLE'
        );
    }

    let discountAmount = 0;

    if (voucher.voucher_type === CUSTOMER_VOUCHER_TYPES.FIXED_AMOUNT) {
        discountAmount = voucher.value;
    } else if (voucher.voucher_type === CUSTOMER_VOUCHER_TYPES.PERCENTAGE) {
        discountAmount = Math.floor(orderAmount * voucher.value / 100);

        if (voucher.max_discount_amount !== null) {
            discountAmount = Math.min(discountAmount, voucher.max_discount_amount);
        }
    } else {
        discountAmount = servicePackage.base_price;
    }

    return Math.max(0, Math.min(Math.floor(discountAmount), orderAmount));
};

const findUsableVoucher = async ({
    customerId,
    guestPhoneNormalized,
    code,
    session = null,
}) => {
    const query = CustomerVoucher.findOne({
        code: normalizeCode(code),
        ...buildVoucherOwnerFilter({ customerId, guestPhoneNormalized }),
    });
    const voucher = session ? await query.session(session) : await query;

    if (!voucher) {
        throw new AppError('Customer voucher not found', 404, 'CUSTOMER_VOUCHER_NOT_FOUND');
    }

    await expireVoucherIfNeeded(voucher, session);

    if (voucher.status !== CUSTOMER_VOUCHER_STATUS.ISSUED) {
        throw new AppError(
            'Customer voucher is not available for use',
            409,
            'CUSTOMER_VOUCHER_NOT_AVAILABLE'
        );
    }

    return voucher;
};

const previewVoucherForBooking = async ({
    customerId,
    guestPhoneNormalized,
    code,
    servicePackage,
    orderAmount,
    session = null,
}) => {
    if (!code) {
        return null;
    }

    const voucher = await findUsableVoucher({
        customerId,
        guestPhoneNormalized,
        code,
        session,
    });
    const discountAmount = calculateVoucherDiscount({
        voucher,
        servicePackage,
        orderAmount,
    });

    return {
        voucher,
        discount_amount: discountAmount,
    };
};

const reserveVoucherForBooking = async ({
    voucherId,
    customerId,
    guestPhoneNormalized,
    bookingId,
    session = null,
}) => {
    const options = { new: true };

    if (session) {
        options.session = session;
    }

    const voucher = await CustomerVoucher.findOneAndUpdate(
        {
            _id: voucherId,
            ...buildVoucherOwnerFilter({ customerId, guestPhoneNormalized }),
            status: CUSTOMER_VOUCHER_STATUS.ISSUED,
            expires_at: { $gt: new Date() },
        },
        {
            status: CUSTOMER_VOUCHER_STATUS.RESERVED,
            reserved_booking_id: bookingId,
            reserved_at: new Date(),
        },
        options
    );

    if (!voucher) {
        throw new AppError(
            'Customer voucher is no longer available',
            409,
            'CUSTOMER_VOUCHER_NO_LONGER_AVAILABLE'
        );
    }

    return voucher;
};

const releaseVoucherForBooking = async ({ bookingId, session = null }) => {
    const options = { new: true };

    if (session) {
        options.session = session;
    }

    return CustomerVoucher.findOneAndUpdate(
        {
            reserved_booking_id: bookingId,
            status: CUSTOMER_VOUCHER_STATUS.RESERVED,
        },
        {
            status: CUSTOMER_VOUCHER_STATUS.ISSUED,
            reserved_booking_id: null,
            reserved_at: null,
        },
        options
    );
};

const consumeVoucherForBooking = async ({ bookingId, session = null }) => {
    const options = { new: true };

    if (session) {
        options.session = session;
    }

    return CustomerVoucher.findOneAndUpdate(
        {
            reserved_booking_id: bookingId,
            status: CUSTOMER_VOUCHER_STATUS.RESERVED,
        },
        {
            status: CUSTOMER_VOUCHER_STATUS.USED,
            used_at: new Date(),
        },
        options
    );
};

const getCompensationApprovalAmount = ({ voucherType, value, maxDiscountAmount, servicePackage }) => {
    if (voucherType === CUSTOMER_VOUCHER_TYPES.PERCENTAGE) {
        return maxDiscountAmount === null || maxDiscountAmount === undefined
            ? Number.MAX_SAFE_INTEGER
            : maxDiscountAmount;
    }

    if (voucherType === CUSTOMER_VOUCHER_TYPES.FREE_SERVICE) {
        return servicePackage?.base_price || Number.MAX_SAFE_INTEGER;
    }

    return value;
};

const issueCompensationVoucher = async ({
    user,
    customerId,
    guestPhoneNormalized = null,
    garageId,
    bookingId,
    incidentId,
    customerCaseId = null,
    customerCaseResolutionId = null,
    sourceType = null,
    voucherType,
    value,
    maxDiscountAmount = null,
    minOrderAmount = 0,
    servicePackageId = null,
    expiresAt,
    note = null,
    session = null,
}) => {
    const ownerFilter = buildVoucherOwnerFilter({
        customerId,
        guestPhoneNormalized,
    });

    if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        throw new AppError(
            'Voucher expiration time must be in the future',
            400,
            'CUSTOMER_VOUCHER_EXPIRATION_INVALID'
        );
    }

    const servicePackageQuery = servicePackageId
        ? ServicePackage.findById(servicePackageId)
        : null;
    const servicePackage = servicePackageQuery
        ? session
            ? await servicePackageQuery.session(session)
            : await servicePackageQuery
        : null;

    if (customerCaseResolutionId) {
        const existingQuery = CustomerVoucher.findOne({
            source_customer_case_resolution_id: customerCaseResolutionId,
        });
        const existing = session ? await existingQuery.session(session) : await existingQuery;
        if (existing) return existing;
    }

    if (
        voucherType === CUSTOMER_VOUCHER_TYPES.FREE_SERVICE
        && (!servicePackage || !servicePackage.is_active)
    ) {
        throw new AppError('Service package not found', 404, 'SERVICE_PACKAGE_NOT_FOUND');
    }

    const approvalAmount = getCompensationApprovalAmount({
        voucherType,
        value,
        maxDiscountAmount,
        servicePackage,
    });
    const requiresApproval = user.role !== USER_ROLES.ADMIN
        && approvalAmount > getStaffVoucherLimit();
    const now = new Date();
    const payload = {
        code: generateVoucherCode(),
        customer_id: ownerFilter.customer_id || null,
        guest_phone: ownerFilter.normalized_guest_phone || null,
        normalized_guest_phone: ownerFilter.normalized_guest_phone || null,
        garage_id: garageId,
        source_type: sourceType
            || (customerCaseId
                ? CUSTOMER_VOUCHER_SOURCES.CUSTOMER_CASE
                : CUSTOMER_VOUCHER_SOURCES.INCIDENT),
        source_booking_id: bookingId,
        source_incident_id: incidentId,
        source_customer_case_id: customerCaseId,
        source_customer_case_resolution_id: customerCaseResolutionId,
        voucher_type: voucherType,
        value,
        max_discount_amount: maxDiscountAmount,
        min_order_amount: minOrderAmount,
        service_package_id: servicePackageId,
        status: requiresApproval
            ? CUSTOMER_VOUCHER_STATUS.PENDING_APPROVAL
            : CUSTOMER_VOUCHER_STATUS.ISSUED,
        expires_at: expiresAt,
        note,
        issued_by_id: user._id,
        approved_by_id: requiresApproval ? null : user._id,
        approved_at: requiresApproval ? null : now,
    };
    const documents = await CustomerVoucher.create(
        [payload],
        session ? { session } : undefined
    );

    return documents[0];
};

const issueAdminGiftVoucher = async ({
    adminId,
    payload,
    auditContext = {},
}) => {
    const [customer, garage] = await Promise.all([
        User.findOne({
            _id: payload.customer_id,
            role: USER_ROLES.CUSTOMER,
        }),
        Garage.findOne({
            _id: payload.garage_id,
            is_active: true,
        }),
    ]);

    if (!customer) {
        throw new AppError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
    }

    if (!customer.is_active) {
        throw new AppError(
            'Cannot gift a voucher to a locked customer account',
            409,
            'CUSTOMER_VOUCHER_CUSTOMER_INACTIVE'
        );
    }

    if (!garage) {
        throw new AppError('Active garage not found', 404, 'GARAGE_NOT_FOUND');
    }

    const voucher = await issueCompensationVoucher({
        user: {
            _id: adminId,
            role: USER_ROLES.ADMIN,
        },
        customerId: customer._id,
        garageId: garage._id,
        bookingId: null,
        incidentId: null,
        sourceType: CUSTOMER_VOUCHER_SOURCES.ADMIN_GIFT,
        voucherType: payload.voucher_type,
        value: payload.value,
        maxDiscountAmount: payload.max_discount_amount ?? null,
        minOrderAmount: payload.min_order_amount || 0,
        servicePackageId: payload.service_package_id || null,
        expiresAt: new Date(payload.expires_at),
        note: payload.note,
    });

    await auditLogService.recordAuditEvent({
        actorId: adminId,
        action: AUDIT_ACTIONS.CUSTOMER_VOUCHER_GIFTED,
        resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER_VOUCHER,
        resourceId: voucher._id,
        after: {
            customer_id: customer._id,
            garage_id: garage._id,
            source_type: voucher.source_type,
            voucher_type: voucher.voucher_type,
            value: voucher.value,
            max_discount_amount: voucher.max_discount_amount,
            min_order_amount: voucher.min_order_amount,
            service_package_id: voucher.service_package_id,
            expires_at: voucher.expires_at,
            note: voucher.note,
        },
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });

    await notificationService.createInAppNotification({
        userId: customer._id,
        type: NOTIFICATION_TYPES.CUSTOMER_VOUCHER_ISSUED,
        title: 'Bạn nhận được voucher mới',
        message: `Carivo đã tặng bạn voucher ${voucher.code}.`,
        relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_VOUCHER,
        relatedId: voucher._id,
        metadata: {
            voucher_id: voucher._id.toString(),
            code: voucher.code,
            expires_at: voucher.expires_at,
        },
    });

    return CustomerVoucherMapper.toCustomerVoucherDto(voucher);
};

const getMyVouchers = async (customerId, { status, garage_id, page = 1, limit = 20 } = {}) => {
    await CustomerVoucher.updateMany(
        {
            customer_id: customerId,
            status: CUSTOMER_VOUCHER_STATUS.ISSUED,
            expires_at: { $lte: new Date() },
        },
        {
            status: CUSTOMER_VOUCHER_STATUS.EXPIRED,
        }
    );
    const filter = { customer_id: customerId };

    if (status) {
        filter.status = status;
    }

    if (garage_id) {
        filter.garage_id = garage_id;
    }

    const skip = (page - 1) * limit;
    const [vouchers, total] = await Promise.all([
        populateVoucherQuery(
            CustomerVoucher.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
        ),
        CustomerVoucher.countDocuments(filter),
    ]);

    return {
        data: CustomerVoucherMapper.toCustomerVoucherDtoList(vouchers),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const validateMyVoucher = async (
    customerId,
    { code, service_package_id, order_amount, quote_id }
) => {
    const servicePackage = await ServicePackage.findById(service_package_id);

    if (!servicePackage || !servicePackage.is_active) {
        throw new AppError('Service package not found', 404, 'SERVICE_PACKAGE_NOT_FOUND');
    }

    const quote = quote_id
        ? await servicePriceRuleService.getActiveQuote({
            quoteId: quote_id,
            customerId,
        })
        : null;
    if (quote && quote.service_package_id.toString() !== servicePackage._id.toString()) {
        throw new AppError('Price quote does not match service package', 409, 'PRICE_QUOTE_CHANGED');
    }
    const effectiveOrderAmount = quote?.subtotal ?? order_amount;
    const result = await previewVoucherForBooking({
        customerId,
        code,
        servicePackage,
        orderAmount: effectiveOrderAmount,
    });

    return {
        voucher: CustomerVoucherMapper.toCustomerVoucherDto(result.voucher),
        discount_amount: result.discount_amount,
        final_amount: Math.max(effectiveOrderAmount - result.discount_amount, 0),
    };
};

const getStaffGarageId = async (user) => {
    if (user.role === USER_ROLES.ADMIN) {
        return null;
    }

    const staffProfile = await StaffProfile.findOne({
        user_id: user._id,
        is_active: true,
    });

    if (!staffProfile?.garage_id) {
        throw new AppError('Staff is not assigned to any garage', 403, 'STAFF_GARAGE_NOT_ASSIGNED');
    }

    return staffProfile.garage_id;
};

const getAdminVouchers = async (
    user,
    {
        status,
        garage_id,
        customer_id,
        source,
        page = 1,
        limit = 20,
    } = {}
) => {
    const staffGarageId = await getStaffGarageId(user);
    const filter = {};

    if (staffGarageId) {
        filter.garage_id = staffGarageId;
    } else if (garage_id) {
        filter.garage_id = garage_id;
    }

    if (status) {
        filter.status = status;
    }

    if (customer_id) {
        filter.customer_id = customer_id;
    }

    if (source === CUSTOMER_VOUCHER_SOURCES.ADMIN_GIFT) {
        filter.source_type = CUSTOMER_VOUCHER_SOURCES.ADMIN_GIFT;
    } else if (source === CUSTOMER_VOUCHER_SOURCES.INCIDENT) {
        filter.$or = [
            { source_type: CUSTOMER_VOUCHER_SOURCES.INCIDENT },
            {
                source_type: { $exists: false },
                source_incident_id: { $ne: null },
            },
        ];
    } else if (source === CUSTOMER_VOUCHER_SOURCES.CUSTOMER_CASE) {
        filter.$or = [
            { source_type: CUSTOMER_VOUCHER_SOURCES.CUSTOMER_CASE },
            {
                source_type: { $exists: false },
                source_customer_case_id: { $ne: null },
            },
        ];
    }

    const skip = (page - 1) * limit;
    const [vouchers, total] = await Promise.all([
        populateVoucherQuery(
            CustomerVoucher.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
        ),
        CustomerVoucher.countDocuments(filter),
    ]);

    return {
        data: CustomerVoucherMapper.toCustomerVoucherDtoList(vouchers),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const approveVoucher = async (adminId, voucherId) => {
    const voucher = await getVoucherDocumentById(voucherId);

    if (voucher.status !== CUSTOMER_VOUCHER_STATUS.PENDING_APPROVAL) {
        throw new AppError(
            'Voucher does not require approval',
            409,
            'CUSTOMER_VOUCHER_APPROVAL_NOT_ALLOWED'
        );
    }

    if (voucher.expires_at <= new Date()) {
        voucher.status = CUSTOMER_VOUCHER_STATUS.EXPIRED;
        await voucher.save();

        throw new AppError(
            'Customer voucher has expired',
            409,
            'CUSTOMER_VOUCHER_EXPIRED'
        );
    }

    voucher.status = CUSTOMER_VOUCHER_STATUS.ISSUED;
    voucher.approved_by_id = adminId;
    voucher.approved_at = new Date();
    await voucher.save();

    await auditLogService.recordAuditEvent({
        actorId: adminId,
        action: AUDIT_ACTIONS.COMPENSATION_VOUCHER_APPROVED,
        resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER_VOUCHER,
        resourceId: voucher._id,
        after: {
            status: voucher.status,
            customer_id: voucher.customer_id,
            source_incident_id: voucher.source_incident_id,
            source_customer_case_id: voucher.source_customer_case_id,
        },
    });
    if (voucher.customer_id) {
        await notificationService.createInAppNotification({
            userId: voucher.customer_id,
            type: NOTIFICATION_TYPES.COMPENSATION_VOUCHER_ISSUED,
            title: 'Compensation voucher issued',
            message: `The garage issued compensation voucher ${voucher.code}.`,
            relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
            relatedId: voucher.source_booking_id,
            metadata: {
                voucher_id: voucher._id.toString(),
                incident_id: voucher.source_incident_id?.toString() || null,
                customer_case_id: voucher.source_customer_case_id?.toString() || null,
                code: voucher.code,
                expires_at: voucher.expires_at,
            },
        });
    }

    return CustomerVoucherMapper.toCustomerVoucherDto(
        await populateVoucherQuery(CustomerVoucher.findById(voucher._id))
    );
};

const revokeVoucher = async (adminId, voucherId) => {
    const voucher = await getVoucherDocumentById(voucherId);
    const previousStatus = voucher.status;

    if (![CUSTOMER_VOUCHER_STATUS.PENDING_APPROVAL, CUSTOMER_VOUCHER_STATUS.ISSUED].includes(voucher.status)) {
        throw new AppError(
            'Voucher cannot be revoked in current status',
            409,
            'CUSTOMER_VOUCHER_REVOKE_NOT_ALLOWED'
        );
    }

    voucher.status = CUSTOMER_VOUCHER_STATUS.REVOKED;
    voucher.revoked_by_id = adminId;
    voucher.revoked_at = new Date();
    await voucher.save();

    await auditLogService.recordAuditEvent({
        actorId: adminId,
        action: AUDIT_ACTIONS.COMPENSATION_VOUCHER_REVOKED,
        resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER_VOUCHER,
        resourceId: voucher._id,
        before: {
            status: previousStatus,
        },
        after: {
            status: voucher.status,
        },
    });

    return CustomerVoucherMapper.toCustomerVoucherDto(
        await populateVoucherQuery(CustomerVoucher.findById(voucher._id))
    );
};

module.exports = {
    previewVoucherForBooking,
    reserveVoucherForBooking,
    releaseVoucherForBooking,
    consumeVoucherForBooking,
    issueCompensationVoucher,
    issueAdminGiftVoucher,
    getMyVouchers,
    validateMyVoucher,
    getAdminVouchers,
    approveVoucher,
    revokeVoucher,
};
