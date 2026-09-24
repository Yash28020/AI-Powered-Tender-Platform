
import { TruckType } from '../types';

// PART 2: TRANSPORTATION CONFIG
export const TRUCK_CAPACITY_TONS: Record<TruckType, number> = {
  MINI_TRUCK: 1.5,
  LCV: 4,
  MEDIUM_TRUCK: 9,
  HEAVY_TRUCK: 20,
};

export const TRUCK_COST_PER_KM: Record<TruckType, number> = {
  MINI_TRUCK: 20,
  LCV: 30,
  MEDIUM_TRUCK: 25,
  HEAVY_TRUCK: 55,
};

export const TRANSPORT_COST_ADJUSTMENT_FACTOR = 1.10; // 10% for tolls, fuel, etc.

// Updated for Asian Paints context
export const CONSIGNEE_LOCATIONS: Record<string, { lat: number; lon: number }> = {
  '122002': { lat: 28.4595, lon: 77.0266 }, // DLF Cyber City, Gurgaon
  '600089': { lat: 13.0367, lon: 80.2676 }, // L&T Construction Site, Chennai
  '560066': { lat: 12.9716, lon: 77.5946 }, // Prestige Shantiniketan, Bangalore
  '700091': { lat: 22.5726, lon: 88.3639 }, // Godrej Waterside, Kolkata
  '411032': { lat: 18.5793, lon: 73.9099 }, // Lohegaon, Pune
  '560062': { lat: 12.8763, lon: 77.5791 }, // Kanakapura Road, Bangalore
};

// PART 3: GST & TAX CONFIG
export const GST_RATE_CONFIG: Record<string, number> = {
    'Decorative Paints': 18,
    'Industrial Coatings': 18,
    'Waterproofing Products': 18,
    'Primers & Undercoats': 18,
};

// PART 4: TESTING & SERVICES PRICE CONFIG
export const SERVICES_PRICING_CONFIG = [
    { Service_Code: 'TEST-ADH-01', Service_Name: 'Adhesion Test (Cross-hatch)', Applicable_Product_Category: 'All', Cost_INR: 7500 },
    { Service_Code: 'TEST-DUR-01', Service_Name: 'Accelerated Weathering Test', Applicable_Product_Category: 'Exterior Emulsion', Cost_INR: 25000 },
    { Service_Code: 'TEST-QBC-01', Service_Name: 'Batch Quality Inspection', Applicable_Product_Category: 'All', Cost_INR: 12000 },
    { Service_Code: 'TEST-SAT-01', Service_Name: 'Site Acceptance Test', Applicable_Product_Category: 'All', Cost_INR: 40000 },
];

// PART 5: AGENT REFERENCE MAPPINGS
export const SPEC_WEIGHT_CONFIG: Record<string, number> = {
    'Finish': 1,
    'Base': 1,
    'Coverage_SqM_Per_Litre': 1,
    'Drying_Time_Hours': 1,
    'Application': 1,
    'Standard': 1,
};

export const CATEGORY_TO_TRUCK_MAP: Record<string, TruckType> = {
    'Decorative Paints': 'MEDIUM_TRUCK',
    'Industrial Coatings': 'HEAVY_TRUCK',
    'Waterproofing Products': 'MEDIUM_TRUCK',
    'Primers & Undercoats': 'LCV',
};

export const WAREHOUSE_TO_REGION_MAP: Record<string, string> = {
    'Ankleshwar': 'West',
    'Sriperumbudur': 'South',
    'Rohtak': 'North',
    'Khandala': 'West',
    'Kolkata': 'East',
};


/**
 * Calculates the distance between two geographical points using the Haversine formula.
 * @returns Distance in kilometers.
 */
export function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}