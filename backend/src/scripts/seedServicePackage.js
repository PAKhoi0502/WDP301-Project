const ServicePackage = require('../modules/service-packages/servicePackage.model');
const { VEHICLE_TYPES } = require('../shared/constants/vehicle.constant');
const { STAFF_TYPES } = require('../shared/constants/staff.constant');
const {
    SERVICE_PACKAGE_TYPES,
    SERVICE_STEP_TYPES,
} = require('../shared/constants/servicePackage.constant');

const packageDefinitions = [
    {
        key: 'MOTORBIKE_STANDARD_WASH',
        name: 'Motorbike Standard Wash',
        vehicle_type: VEHICLE_TYPES.MOTORBIKE,
        service_type: SERVICE_PACKAGE_TYPES.WASH,
        description: 'Standard wash service for motorbikes.',
        base_price: 30000,
        duration_minutes: 20,
        wash_bay_duration_minutes: 20,
        points_earned: 5,
        requires_wash_bay: true,
        steps_template: [
            {
                step_code: 'MOTORBIKE_STANDARD_WASH',
                step_name: 'Motorbike standard wash process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Verify booking and vehicle information',
                    'Check visible exterior condition before washing',
                    'Apply pre-rinse to remove loose dirt',
                    'Apply neutral foam and wash the vehicle body',
                    'Clean wheels and lower body area',
                    'Rinse thoroughly and dry the vehicle',
                    'Perform final visual check before handover',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'MOTORBIKE_PREMIUM_WASH',
        name: 'Motorbike Premium Wash',
        vehicle_type: VEHICLE_TYPES.MOTORBIKE,
        service_type: SERVICE_PACKAGE_TYPES.WASH,
        description: 'Premium wash service for motorbikes with more detailed cleaning.',
        base_price: 50000,
        duration_minutes: 30,
        wash_bay_duration_minutes: 30,
        points_earned: 8,
        requires_wash_bay: true,
        steps_template: [
            {
                step_code: 'MOTORBIKE_PREMIUM_WASH',
                step_name: 'Motorbike premium wash process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Verify booking and vehicle information',
                    'Check visible exterior condition before washing',
                    'Protect sensitive vehicle areas if needed',
                    'Apply pre-rinse to remove loose dirt',
                    'Apply neutral foam and clean body panels',
                    'Clean wheels, lower body area, and small gaps',
                    'Rinse thoroughly and dry the vehicle',
                    'Apply quick surface wipe and final visual check',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'MOTORBIKE_OIL_CHANGE',
        name: 'Motorbike Oil Change',
        vehicle_type: VEHICLE_TYPES.MOTORBIKE,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual motorbike oil change service.',
        base_price: 120000,
        duration_minutes: 20,
        wash_bay_duration_minutes: 0,
        points_earned: 10,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'MOTORBIKE_OIL_CHANGE',
                step_name: 'Motorbike oil change process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Verify oil type and customer request',
                    'Drain old oil safely',
                    'Refill new oil according to vehicle requirement',
                    'Check for leakage after refill',
                    'Record service note if needed',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_STANDARD_WASH',
        name: 'Car Standard Wash',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.WASH,
        description: 'Standard exterior wash service for cars.',
        base_price: 80000,
        duration_minutes: 30,
        wash_bay_duration_minutes: 30,
        points_earned: 10,
        requires_wash_bay: true,
        steps_template: [
            {
                step_code: 'CAR_STANDARD_WASH',
                step_name: 'Car standard wash process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Verify booking and vehicle information',
                    'Check visible exterior condition before washing',
                    'Protect sensitive areas if needed',
                    'Apply pre-rinse to remove loose dirt',
                    'Apply neutral foam and wash exterior body',
                    'Clean wheels and lower body area',
                    'Rinse thoroughly and dry the vehicle',
                    'Perform final visual check before handover',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_PREMIUM_WASH',
        name: 'Car Premium Wash',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.WASH,
        description: 'Premium exterior wash service for cars with detailed exterior cleaning.',
        base_price: 120000,
        duration_minutes: 35,
        wash_bay_duration_minutes: 35,
        points_earned: 15,
        requires_wash_bay: true,
        steps_template: [
            {
                step_code: 'CAR_PREMIUM_WASH',
                step_name: 'Car premium wash process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Verify booking and vehicle information',
                    'Check visible exterior condition before washing',
                    'Protect electric vehicle charging port if applicable',
                    'Apply pre-rinse to remove loose dirt',
                    'Apply neutral foam and clean exterior body',
                    'Clean grille, body gaps, wheels, and lower body area',
                    'Rinse thoroughly and dry the vehicle',
                    'Check glass, charging port, and exterior surfaces before handover',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_INTERIOR_VACUUM_CLEANING',
        name: 'Interior Vacuum And Cleaning',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual interior vacuuming and basic cabin cleaning service.',
        base_price: 100000,
        duration_minutes: 25,
        wash_bay_duration_minutes: 0,
        points_earned: 8,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'INTERIOR_VACUUM_CLEANING',
                step_name: 'Interior vacuum and cleaning process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Remove floor mats carefully',
                    'Vacuum seats, floor, and trunk area',
                    'Clean dashboard and frequently touched surfaces',
                    'Clean floor mats and place them back correctly',
                    'Perform final interior check',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_GLASS_STAIN_REMOVAL',
        name: 'Glass Mold Stain Removal',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual glass mold and stain removal service for cars.',
        base_price: 150000,
        duration_minutes: 30,
        wash_bay_duration_minutes: 0,
        points_earned: 12,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'GLASS_STAIN_REMOVAL',
                step_name: 'Glass mold stain removal process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Inspect glass surface condition',
                    'Apply suitable glass cleaning compound',
                    'Remove mold stains and water spots carefully',
                    'Wipe glass surface clean',
                    'Perform final glass visibility check',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_HEADLIGHT_POLISHING',
        name: 'Headlight Polishing',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual headlight polishing service for cars.',
        base_price: 180000,
        duration_minutes: 35,
        wash_bay_duration_minutes: 0,
        points_earned: 14,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'HEADLIGHT_POLISHING',
                step_name: 'Headlight polishing process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Inspect headlight surface condition',
                    'Clean headlight surface before polishing',
                    'Polish headlight surface evenly',
                    'Wipe residue and inspect clarity',
                    'Record note if damage is detected',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_WINDSHIELD_POLISHING_WATER_REPELLENT',
        name: 'Windshield Polishing And Water Repellent',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual windshield polishing and water repellent coating service.',
        base_price: 250000,
        duration_minutes: 45,
        wash_bay_duration_minutes: 0,
        points_earned: 20,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'WINDSHIELD_POLISHING_WATER_REPELLENT',
                step_name: 'Windshield polishing and water repellent process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Inspect windshield surface condition',
                    'Clean windshield before polishing',
                    'Polish windshield evenly',
                    'Apply water repellent coating',
                    'Perform final visibility and water behavior check',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_TAR_ADHESIVE_REMOVAL',
        name: 'Tar And Adhesive Removal',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual tar, adhesive, and road grime removal service.',
        base_price: 200000,
        duration_minutes: 40,
        wash_bay_duration_minutes: 0,
        points_earned: 16,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'TAR_ADHESIVE_REMOVAL',
                step_name: 'Tar and adhesive removal process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Inspect affected exterior areas',
                    'Apply suitable remover to tar and adhesive spots',
                    'Remove residue carefully without damaging paint',
                    'Wipe treated areas clean',
                    'Perform final exterior surface check',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_IRON_FALLOUT_REMOVAL',
        name: 'Iron Fallout Removal',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual iron fallout and metal particle removal service.',
        base_price: 220000,
        duration_minutes: 45,
        wash_bay_duration_minutes: 0,
        points_earned: 18,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'IRON_FALLOUT_REMOVAL',
                step_name: 'Iron fallout removal process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Inspect exterior surface for metal particles',
                    'Apply iron fallout remover safely',
                    'Allow chemical reaction according to product guideline',
                    'Wipe and rinse treated surfaces carefully',
                    'Perform final exterior surface check',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_ENGINE_BAY_CLEANING',
        name: 'Engine Bay Cleaning',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual engine bay cleaning service.',
        base_price: 300000,
        duration_minutes: 60,
        wash_bay_duration_minutes: 0,
        points_earned: 25,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'ENGINE_BAY_CLEANING',
                step_name: 'Engine bay cleaning process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Inspect engine bay condition before cleaning',
                    'Protect sensitive electrical components',
                    'Apply suitable cleaning solution',
                    'Clean visible engine bay surfaces carefully',
                    'Dry treated areas and perform final safety check',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_AC_SYSTEM_CLEANING',
        name: 'AC System Cleaning',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual AC system cleaning support service.',
        base_price: 350000,
        duration_minutes: 60,
        wash_bay_duration_minutes: 0,
        points_earned: 28,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'AC_SYSTEM_CLEANING',
                step_name: 'AC system cleaning process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Verify customer request and AC condition note',
                    'Prepare AC cleaning equipment and materials',
                    'Clean reachable AC system areas according to procedure',
                    'Run AC check after cleaning',
                    'Record final service note if needed',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_UVC_SANITIZING',
        name: 'UVC Interior Surface Sanitizing',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual UVC interior surface sanitizing service.',
        base_price: 180000,
        duration_minutes: 25,
        wash_bay_duration_minutes: 0,
        points_earned: 14,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'UVC_INTERIOR_SANITIZING',
                step_name: 'UVC interior surface sanitizing process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Confirm vehicle cabin is empty',
                    'Place UVC equipment according to safety procedure',
                    'Run sanitizing cycle for required duration',
                    'Remove equipment safely',
                    'Record completion note',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_OZONE_ODOR_TREATMENT',
        name: 'Ozone Odor And Bacteria Treatment',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual ozone odor and bacteria treatment service.',
        base_price: 200000,
        duration_minutes: 30,
        wash_bay_duration_minutes: 0,
        points_earned: 16,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'OZONE_ODOR_TREATMENT',
                step_name: 'Ozone odor and bacteria treatment process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Confirm vehicle cabin is empty',
                    'Place ozone equipment according to safety procedure',
                    'Run ozone treatment cycle for required duration',
                    'Ventilate cabin after treatment',
                    'Record completion note',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'MOTORBIKE_WASH_OIL_COMBO',
        name: 'Motorbike Wash And Oil Change Combo',
        vehicle_type: VEHICLE_TYPES.MOTORBIKE,
        service_type: SERVICE_PACKAGE_TYPES.COMBO,
        description: 'Motorbike wash combined with oil change.',
        base_price: 140000,
        duration_minutes: 45,
        wash_bay_duration_minutes: 20,
        points_earned: 14,
        requires_wash_bay: true,
        included_service_keys: [
            'MOTORBIKE_STANDARD_WASH',
            'MOTORBIKE_OIL_CHANGE',
        ],
        steps_template: [
            {
                step_code: 'MOTORBIKE_COMBO_WASH',
                step_name: 'Motorbike wash process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Verify booking and vehicle information',
                    'Perform standard motorbike wash process',
                    'Dry vehicle before manual service step',
                    'Perform final exterior check',
                ],
            },
            {
                step_code: 'MOTORBIKE_COMBO_OIL_CHANGE',
                step_name: 'Motorbike oil change process',
                order: 2,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Verify oil type and customer request',
                    'Drain old oil safely',
                    'Refill new oil according to vehicle requirement',
                    'Check for leakage after refill',
                    'Record service note if needed',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_BASIC_CLEAN',
        name: 'Basic Clean',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.COMBO,
        description: 'Premium wash, glass stain removal, headlight polishing, and interior cleaning.',
        base_price: 500000,
        duration_minutes: 120,
        wash_bay_duration_minutes: 35,
        points_earned: 45,
        requires_wash_bay: true,
        included_service_keys: [
            'CAR_PREMIUM_WASH',
            'CAR_GLASS_STAIN_REMOVAL',
            'CAR_HEADLIGHT_POLISHING',
            'CAR_INTERIOR_VACUUM_CLEANING',
        ],
        steps_template: [
            {
                step_code: 'BASIC_CLEAN_WASH',
                step_name: 'Car premium wash process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Verify booking and vehicle information',
                    'Perform premium car wash process',
                    'Release wash bay after wash process is completed',
                    'Perform final exterior wash check',
                ],
            },
            {
                step_code: 'BASIC_CLEAN_GLASS_STAIN',
                step_name: 'Glass mold stain removal process',
                order: 2,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Inspect glass surface condition',
                    'Remove mold stains and water spots carefully',
                    'Wipe glass surface clean',
                    'Perform final glass visibility check',
                ],
            },
            {
                step_code: 'BASIC_CLEAN_HEADLIGHT',
                step_name: 'Headlight polishing process',
                order: 3,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Inspect headlight surface condition',
                    'Polish headlight surface evenly',
                    'Wipe residue and inspect clarity',
                    'Record note if damage is detected',
                ],
            },
            {
                step_code: 'BASIC_CLEAN_INTERIOR',
                step_name: 'Interior vacuum and cleaning process',
                order: 4,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Remove floor mats carefully',
                    'Vacuum seats, floor, and trunk area',
                    'Clean dashboard and frequently touched surfaces',
                    'Clean floor mats and perform final interior check',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_DETAIL_CLEAN',
        name: 'Detail Clean',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.COMBO,
        description: 'Basic Clean plus windshield polishing, tar removal, and iron fallout removal.',
        base_price: 950000,
        duration_minutes: 220,
        wash_bay_duration_minutes: 35,
        points_earned: 85,
        requires_wash_bay: true,
        included_service_keys: [
            'CAR_PREMIUM_WASH',
            'CAR_GLASS_STAIN_REMOVAL',
            'CAR_HEADLIGHT_POLISHING',
            'CAR_INTERIOR_VACUUM_CLEANING',
            'CAR_WINDSHIELD_POLISHING_WATER_REPELLENT',
            'CAR_TAR_ADHESIVE_REMOVAL',
            'CAR_IRON_FALLOUT_REMOVAL',
        ],
        steps_template: [
            {
                step_code: 'DETAIL_CLEAN_WASH',
                step_name: 'Car premium wash process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Verify booking and vehicle information',
                    'Perform premium car wash process',
                    'Release wash bay after wash process is completed',
                    'Perform final exterior wash check',
                ],
            },
            {
                step_code: 'DETAIL_CLEAN_BASIC_MANUAL',
                step_name: 'Basic manual care process',
                order: 2,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Remove glass mold stains and water spots',
                    'Polish headlights evenly',
                    'Vacuum and clean interior cabin',
                    'Perform visual quality check for basic care tasks',
                ],
            },
            {
                step_code: 'DETAIL_CLEAN_ADVANCED_MANUAL',
                step_name: 'Advanced exterior care process',
                order: 3,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Polish windshield and apply water repellent coating',
                    'Remove tar and adhesive residue carefully',
                    'Remove iron fallout and metal particles',
                    'Perform final exterior surface check',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_ULTIMATE_CLEAN',
        name: 'Ultimate Clean',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.COMBO,
        description: 'Detail Clean plus engine bay cleaning and AC system cleaning.',
        base_price: 1500000,
        duration_minutes: 330,
        wash_bay_duration_minutes: 35,
        points_earned: 140,
        requires_wash_bay: true,
        included_service_keys: [
            'CAR_PREMIUM_WASH',
            'CAR_GLASS_STAIN_REMOVAL',
            'CAR_HEADLIGHT_POLISHING',
            'CAR_INTERIOR_VACUUM_CLEANING',
            'CAR_WINDSHIELD_POLISHING_WATER_REPELLENT',
            'CAR_TAR_ADHESIVE_REMOVAL',
            'CAR_IRON_FALLOUT_REMOVAL',
            'CAR_ENGINE_BAY_CLEANING',
            'CAR_AC_SYSTEM_CLEANING',
        ],
        steps_template: [
            {
                step_code: 'ULTIMATE_CLEAN_WASH',
                step_name: 'Car premium wash process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Verify booking and vehicle information',
                    'Perform premium car wash process',
                    'Release wash bay after wash process is completed',
                    'Perform final exterior wash check',
                ],
            },
            {
                step_code: 'ULTIMATE_CLEAN_DETAIL_MANUAL',
                step_name: 'Detail manual care process',
                order: 2,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Complete glass, headlight, interior, and advanced exterior care tasks',
                    'Check treated surfaces before moving to engine and AC tasks',
                    'Record service note if abnormal condition is detected',
                ],
            },
            {
                step_code: 'ULTIMATE_CLEAN_ENGINE_AC',
                step_name: 'Engine bay and AC system cleaning process',
                order: 3,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Protect sensitive components before engine bay cleaning',
                    'Clean visible engine bay surfaces carefully',
                    'Clean AC system areas according to procedure',
                    'Run final safety and function check',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_SUPER_CLEAN',
        name: 'Super Clean',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.COMBO,
        description: 'Ultimate Clean plus UVC sanitizing and ozone odor treatment.',
        base_price: 1850000,
        duration_minutes: 390,
        wash_bay_duration_minutes: 35,
        points_earned: 180,
        requires_wash_bay: true,
        included_service_keys: [
            'CAR_PREMIUM_WASH',
            'CAR_GLASS_STAIN_REMOVAL',
            'CAR_HEADLIGHT_POLISHING',
            'CAR_INTERIOR_VACUUM_CLEANING',
            'CAR_WINDSHIELD_POLISHING_WATER_REPELLENT',
            'CAR_TAR_ADHESIVE_REMOVAL',
            'CAR_IRON_FALLOUT_REMOVAL',
            'CAR_ENGINE_BAY_CLEANING',
            'CAR_AC_SYSTEM_CLEANING',
            'CAR_UVC_SANITIZING',
            'CAR_OZONE_ODOR_TREATMENT',
        ],
        steps_template: [
            {
                step_code: 'SUPER_CLEAN_WASH',
                step_name: 'Car premium wash process',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Verify booking and vehicle information',
                    'Perform premium car wash process',
                    'Release wash bay after wash process is completed',
                    'Perform final exterior wash check',
                ],
            },
            {
                step_code: 'SUPER_CLEAN_ULTIMATE_MANUAL',
                step_name: 'Ultimate manual care process',
                order: 2,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Complete detail manual care tasks',
                    'Complete engine bay cleaning task',
                    'Complete AC system cleaning task',
                    'Record service note if abnormal condition is detected',
                ],
            },
            {
                step_code: 'SUPER_CLEAN_SANITIZING',
                step_name: 'Interior sanitizing and odor treatment process',
                order: 3,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Confirm vehicle cabin is empty',
                    'Run UVC sanitizing cycle safely',
                    'Run ozone odor treatment cycle safely',
                    'Ventilate cabin after treatment',
                    'Perform final cabin check before handover',
                ],
            },
        ],
        is_active: true,
    },
];

const hasVehicleCareStaffStep = (definition) => {
    return (definition.steps_template || []).some((step) => {
        return step.display_staff_type === STAFF_TYPES.VEHICLE_CARE_STAFF;
    });
};

const toSeedPayload = (definition, idByKey) => {
    const includedServiceIds = (definition.included_service_keys || []).map((key) => {
        const serviceId = idByKey.get(key);

        if (!serviceId) {
            throw new Error(`Missing included service for key: ${key}`);
        }

        return serviceId;
    });
    const requiresCareStaff = definition.requires_care_staff !== undefined
        ? definition.requires_care_staff
        : hasVehicleCareStaffStep(definition);
    const requiresWashBay = Boolean(definition.requires_wash_bay);

    return {
        name: definition.name,
        vehicle_type: definition.vehicle_type,
        service_type: definition.service_type,
        description: definition.description,
        base_price: definition.base_price,
        duration_minutes: definition.duration_minutes,
        wash_bay_duration_minutes: definition.wash_bay_duration_minutes,
        wash_bay_start_offset_minutes: requiresWashBay
            ? definition.wash_bay_start_offset_minutes || 0
            : 0,
        points_earned: definition.points_earned,
        requires_wash_bay: requiresWashBay,
        requires_care_staff: requiresCareStaff,
        care_staff_type: requiresCareStaff
            ? definition.care_staff_type || STAFF_TYPES.VEHICLE_CARE_STAFF
            : null,
        care_staff_required_count: requiresCareStaff
            ? definition.care_staff_required_count || 1
            : 0,
        care_staff_duration_minutes: requiresCareStaff
            ? definition.care_staff_duration_minutes || definition.duration_minutes
            : 0,
        care_staff_start_offset_minutes: requiresCareStaff
            ? definition.care_staff_start_offset_minutes || 0
            : 0,
        allow_duplicate_in_booking: definition.allow_duplicate_in_booking || false,
        included_service_ids: includedServiceIds,
        steps_template: definition.service_type === SERVICE_PACKAGE_TYPES.COMBO
            ? []
            : definition.steps_template,
        is_active: definition.is_active,
    };
};

const upsertPackage = async (definition, idByKey) => {
    const payload = toSeedPayload(definition, idByKey);

    const servicePackage = await ServicePackage.findOneAndUpdate(
        {
            name: payload.name,
            vehicle_type: payload.vehicle_type,
        },
        {
            $set: payload,
        },
        {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
        }
    );

    idByKey.set(definition.key, servicePackage._id);

    console.log(`Seeded service package: ${servicePackage.name}`);

    return servicePackage;
};

const seedServicePackage = async () => {
    console.log('== Seeding service packages ==');

    const idByKey = new Map();
    const basePackages = packageDefinitions.filter(
        (item) => item.service_type !== SERVICE_PACKAGE_TYPES.COMBO
    );
    const comboPackages = packageDefinitions.filter(
        (item) => item.service_type === SERVICE_PACKAGE_TYPES.COMBO
    );

    for (const definition of basePackages) {
        await upsertPackage(definition, idByKey);
    }

    for (const definition of comboPackages) {
        await upsertPackage(definition, idByKey);
    }

    console.log('Service packages seeding completed');
};

module.exports = seedServicePackage;
