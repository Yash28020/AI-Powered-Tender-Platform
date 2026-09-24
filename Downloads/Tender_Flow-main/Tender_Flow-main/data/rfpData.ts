/* /data/rfpData.ts */
import { Rfp } from '../types';

const today = new Date();
const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// 1. CPWD - Tubular Street Light Poles (Matches PLB-LGT-TUB-9M-V2)
export const rfpDoc_CPWD_Poles = `
Central Public Works Department - Notice Inviting Tender
Bid Number: GEM/2026/B/987654
Item Category: Lighting Pole or Post and Hardware - Tubular Street Light Poles (V2) (Q3)
Quantity: 100
Technical Specs:
- Overall Length: 9 Meters
- Standard: Must comply with IS 2713
- Finish: Hot Dip Galvanized
`;

// 2. NHAI - High Mast Lighting (Matches PLB-HMT-30M-V2Q3)
export const rfpDoc_NHAI_HighMast = `
National Highways Authority of India - NHAI E-Tender
Bid Number: NHAI/PUNJAB/2026/B/112233
Quantity: 15
Technical Specs:
- Height: 30 Meters
- Standards: IS 875 Part-3 (Wind Loading)
- Luminaires: High power LED Flood Lights included
`;

// 3. PowerGrid - Armoured Cables (Matches PLB-CBL-1.5-FLEX)
export const rfpDoc_PowerGrid_Cables = `
Power Grid Corporation of India - Request for Quotation
RFQ Number: PGCIL/WR1/2026/CABLE/101
Quantity: 2000 Meters
Technical Specs:
- Standard: IS 694
- Voltage Grade: 1100V
- Size: 1.5 sq.mm
`;

// 4. NIC - Networking Infrastructure (Matches CIS-L3S-C9300-48T)
export const rfpDoc_NIC_Switches = `
National Informatics Centre - Vendor Enquiry
Enquiry No: NIC/DATA-CENTER/2026/045
Item: Layer-3 Distribution Switch
Quantity: 10
Technical Specs:
- Ports: 48-port Data Only
- Stacking Bandwidth: 480 Gbps
`;

// 5. Port Trust - Industrial Protection (Matches PLB-MCCB-125A-4P-36K)
export const rfpDoc_PortTrust_MCCB = `
Visakhapatnam Port Trust - Material Procurement Tender
Tender ID: VPT/ELECT/2026/78
Item: Molded Case Circuit Breakers (MCCB) - 125A 4-Pole
Quantity: 25
Technical Specs:
- Standard: IS/IEC 60947
- Rating: 125 Ampere
- Breaking Capacity: 36kA
`;

// ADDED: The specific export requested by your error
export const rfpDoc_CPWD_Exterior = rfpDoc_CPWD_Poles; 

export const initialRfpList: Rfp[] = [
  {
    id: 'GEM/2026/B/987654',
    organisation: 'CPWD, Gurgaon Division',
    bidType: 'Two Packet Bid',
    closingDate: new Date('2026-02-28T17:00:00'),
    status: 'Pending',
    rawDocument: rfpDoc_CPWD_Poles,
    source: 'File',
    fileName: 'CPWD-Tubular-Poles.pdf',
    agentOutputs: {
        parsedData: null,
        technicalAnalysis: null,
        pricing: null
    },
    processingDuration: 0
  },
  {
    id: 'NHAI/PUNJAB/2026/B/112233',
    organisation: 'NHAI, PIU Jalandhar',
    bidType: 'Single Packet Bid',
    closingDate: addDays(today, 25),
    status: 'Pending',
    rawDocument: rfpDoc_NHAI_HighMast,
    source: 'URL',
    fileName: 'https://nhai.gov.in/tenders/high-mast-112233',
    agentOutputs: {
        parsedData: null,
        technicalAnalysis: null,
        pricing: null
    },
    processingDuration: 0
  }
];