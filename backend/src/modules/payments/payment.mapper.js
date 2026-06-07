const toId = (value) => {
    if (!value) {
        return null;
    }

    return value._id ? value._id.toString() : value.toString();
};

const toPaymentTransactionDto = (paymentTransaction) => {
    if (!paymentTransaction) {
        return null;
    }

    const plainTransaction = paymentTransaction.toObject ? paymentTransaction.toObject() : paymentTransaction;

    return {
        id: toId(plainTransaction._id),
        booking_id: toId(plainTransaction.booking_id),
        provider: plainTransaction.provider,
        method: plainTransaction.method,
        order_code: plainTransaction.order_code,
        payment_link_id: plainTransaction.payment_link_id,
        checkout_url: plainTransaction.checkout_url,
        qr_code: plainTransaction.qr_code,
        amount: plainTransaction.amount,
        currency: plainTransaction.currency,
        description: plainTransaction.description,
        status: plainTransaction.status,
        paid_at: plainTransaction.paid_at,
        expires_at: plainTransaction.expires_at,
        canceled_at: plainTransaction.canceled_at,
        expired_at: plainTransaction.expired_at,
        created_by_staff_id: toId(plainTransaction.created_by_staff_id),
        created_at: plainTransaction.created_at,
        updated_at: plainTransaction.updated_at,
    };
};

const toPaymentTransactionDtoList = (paymentTransactions = []) => {
    return paymentTransactions.map((paymentTransaction) => toPaymentTransactionDto(paymentTransaction));
};

module.exports = {
    toId,
    toPaymentTransactionDto,
    toPaymentTransactionDtoList,
};
