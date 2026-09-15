export const CATEGORIES = [
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'water', label: 'Water' },
  { value: 'sanitation', label: 'Sanitation' },
  { value: 'environment', label: 'Environment' },
  { value: 'energy', label: 'Energy' },
  { value: 'roads_infrastructure', label: 'Roads & Infrastructure' },
  { value: 'rural_livelihood', label: 'Rural Livelihood' },
  { value: 'accessibility', label: 'Accessibility' },
  { value: 'public_services', label: 'Public Services' },
  { value: 'waste_management', label: 'Waste Management' },
  { value: 'employment', label: 'Employment' },
  { value: 'other', label: 'Other' },
];

export const DISTRICTS = [
  'Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum',
  'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara',
  'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu',
  'Ramgarh', 'Ranchi', 'Sahibganj', 'Seraikela-Kharsawan', 'Simdega',
  'West Singhbhum',
];

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
  { value: 'bn', label: 'বাংলা (Bengali)' },
  { value: 'od', label: 'ଓଡ଼ିଆ (Odia)' },
  { value: 'san', label: 'संथाली (Santhali)' },
  { value: 'nag', label: 'नागपुरी (Nagpuri)' },
  { value: 'kur', label: 'कुड़ुख़ (Kurukh)' },
  { value: 'ho', label: 'हो (Ho)' },
  { value: 'mundari', label: 'मुण्डारी (Mundari)' },
];

export const SEVERITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

// Approximate district centroids for map centering (public geographic data)
export const DISTRICT_COORDS = {
  Bokaro: [23.67, 86.15],
  Chatra: [24.21, 84.87],
  Deoghar: [24.48, 86.7],
  Dhanbad: [23.79, 86.43],
  Dumka: [24.27, 87.25],
  'East Singhbhum': [22.8, 86.2],
  Garhwa: [24.03, 83.77],
  Giridih: [24.18, 86.3],
  Godda: [24.83, 87.21],
  Gumla: [23.04, 84.54],
  Hazaribagh: [23.99, 85.36],
  Jamtara: [24.02, 86.81],
  Khunti: [23.08, 85.28],
  Koderma: [24.47, 85.59],
  Latehar: [23.75, 84.51],
  Lohardaga: [23.43, 84.68],
  Pakur: [24.64, 87.85],
  Palamu: [24.04, 84.07],
  Ramgarh: [23.63, 85.52],
  Ranchi: [23.34, 85.31],
  Sahibganj: [25.25, 87.65],
  'Seraikela-Kharsawan': [22.78, 85.82],
  Simdega: [22.62, 84.51],
  'West Singhbhum': [22.31, 85.83],
};

export const JHARKHAND_CENTER = [23.61, 85.43];
export const RADIUS_OPTIONS = [1, 5, 10, 25];
