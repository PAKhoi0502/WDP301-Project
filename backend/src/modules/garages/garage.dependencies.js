const Booking = require('../bookings/booking.model');
const BookingHandover = require('../booking-handovers/bookingHandover.model');
const BookingIncident = require('../booking-incidents/bookingIncident.model');
const BookingWaitlist = require('../booking-waitlists/bookingWaitlist.model');
const BookingPlateScan = require('../booking-arrivals/bookingPlateScan.model');
const CameraDevice = require('../booking-arrivals/cameraDevice.model');
const CustomerCase = require('../customer-cases/customerCase.model');
const CustomerCaseTechnicalAssessment = require('../customer-cases/customerCaseTechnicalAssessment.model');
const CustomerVoucher = require('../customer-vouchers/customerVoucher.model');
const ResearchReport = require('../research/researchReport.model');
const Review = require('../reviews/review.model');
const PriceQuote = require('../service-price-rules/priceQuote.model');
const ServicePriceRule = require('../service-price-rules/servicePriceRule.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const StaffTypeChangeRequest = require('../staff-profiles/staffTypeChange.model');
const WashBay = require('../wash-bays/washBay.model');
const WashHistory = require('../wash-histories/washHistory.model');

const garageDependencyRules = [
    {
        key: 'wash_bays',
        label: 'wash bays',
        model: WashBay,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'bookings',
        label: 'booking history',
        model: Booking,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'staff_profiles',
        label: 'staff profiles',
        model: StaffProfile,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'service_price_rules',
        label: 'service price rules',
        model: ServicePriceRule,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'price_quotes',
        label: 'price quotes',
        model: PriceQuote,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'camera_devices',
        label: 'camera devices',
        model: CameraDevice,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'booking_plate_scans',
        label: 'booking plate scans',
        model: BookingPlateScan,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'booking_handovers',
        label: 'booking handovers',
        model: BookingHandover,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'booking_incidents',
        label: 'booking incidents',
        model: BookingIncident,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'booking_waitlists',
        label: 'booking waitlists',
        model: BookingWaitlist,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'customer_cases',
        label: 'customer cases',
        model: CustomerCase,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'customer_case_assessments',
        label: 'customer case assessments',
        model: CustomerCaseTechnicalAssessment,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'customer_vouchers',
        label: 'customer vouchers',
        model: CustomerVoucher,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'wash_histories',
        label: 'wash histories',
        model: WashHistory,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'reviews',
        label: 'reviews',
        model: Review,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'research_reports',
        label: 'research reports',
        model: ResearchReport,
        buildFilter: (garageId) => ({ garage_id: garageId }),
    },
    {
        key: 'staff_type_changes',
        label: 'staff type change requests',
        model: StaffTypeChangeRequest,
        buildFilter: (garageId) => ({
            $or: [
                { from_garage_id: garageId },
                { to_garage_id: garageId },
            ],
        }),
    },
];

const findGarageDependencies = async (garageId) => {
    const dependencyResults = await Promise.all(
        garageDependencyRules.map(async (rule) => {
            const dependency = await rule.model.exists(
                rule.buildFilter(garageId)
            );

            if (!dependency) {
                return null;
            }

            return {
                key: rule.key,
                label: rule.label,
            };
        })
    );

    return dependencyResults.filter(Boolean);
};

module.exports = {
    findGarageDependencies,
    garageDependencyRules,
};
