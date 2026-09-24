import { AppConfig } from '../types';

export const initialConfig: AppConfig = {
  companyDetails: {
    companyName: 'TenderFlow Industrial Systems',
    companyAddress: 'Lovely Professional University, Phagwara, Jalandhar, Punjab - 144411, India',
    gstin: '03AAACT0000G1Z5',
    pan: 'AAACT0000G',
    domain: 'Wires & Cables',       
    turnover: '₹450 Cr',            
    turnoverYear: 'FY25',           
    oemStatus: 'MII Class-1'        
  },
  signingAuthorities: [
    {
      id: 'DIR-001',
      name: 'Ansh Pratap Singh',
      designation: 'Chief Executive Officer',
      din: '08945210',
    },
    {
      id: 'DIR-002',
      name: 'Rajan Singh',
      designation: 'Director of Logistics',
      din: '09124432',
    },
  ],
  discoveryFilters: {
    manualAvgKms: 400,
    manualRatePerKm: 55,             
    minMatchThreshold: 20,     
    allowEMD: true,
    categories: [
      "Lighting Pole or Post and Hardware"
    ]
  }
};