// Seeds demo industries/startups and citizen-reported problems (challenges).
// Safe to re-run — existing companies (unique name) and challenges (title+district) are skipped.
// Usage: node src/scripts/seedDemoData.js
import mongoose from 'mongoose';

import '../config/env.js';
import { connectDB } from '../config/db.js';
import Industry from '../models/Industry.js';
import Challenge from '../models/Challenge.js';
import User from '../models/User.js';

// District centroids [lat, lng] — approximate public geographic data
const DISTRICT_COORDS = {
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

const DEMO_PASSWORD = 'Johar@2026';

// ---- Demo citizens (challenge submitters) ----
const CITIZENS = [
  { name: 'Ravi Mahato', email: 'ravi.citizen@demo.johar.in', district: 'Ranchi' },
  { name: 'Sita Oraon', email: 'sita.citizen@demo.johar.in', district: 'Khunti' },
  { name: 'Mohan Tudu', email: 'mohan.citizen@demo.johar.in', district: 'East Singhbhum' },
  { name: 'Lakshmi Devi', email: 'lakshmi.citizen@demo.johar.in', district: 'Hazaribagh' },
  { name: 'Arjun Soren', email: 'arjun.citizen@demo.johar.in', district: 'Dumka' },
  { name: 'Poonam Kumari', email: 'poonam.citizen@demo.johar.in', district: 'Dhanbad' },
  { name: 'Sanjay Besra', email: 'sanjay.citizen@demo.johar.in', district: 'Gumla' },
  { name: 'Meena Hansda', email: 'meena.citizen@demo.johar.in', district: 'Sahibganj' },
  { name: 'Dinesh Ram', email: 'dinesh.citizen@demo.johar.in', district: 'Bokaro' },
  { name: 'Kavita Munda', email: 'kavita.citizen@demo.johar.in', district: 'West Singhbhum' },
];

// ---- Industries & Startups ----
const INDUSTRIES = [
  {
    companyName: 'Vananchal AgriTech',
    companyType: 'startup',
    description:
      'Ranchi-based agri-tech startup building affordable soil-testing kits and mandi price apps for smallholder farmers of Jharkhand.',
    address: 'Hinoo, Ranchi, Jharkhand',
    location: DISTRICT_COORDS.Ranchi,
    industries: ['Agriculture', 'Food Processing'],
    expertise: ['Soil analytics', 'Agri marketplaces', 'IoT sensors', 'Farmer training'],
    technologies: ['IoT', 'Mobile apps', 'Machine learning'],
    collaborationTypes: ['pilot_deployment', 'mentorship', 'internships'],
    fundingCapacity: { min: 100000, max: 2500000, currency: 'INR' },
    previousCollaborations: [
      { title: 'Soil health camps in Khunti', partner: 'BIT Mesra', year: 2025 },
    ],
    contactInformation: { email: 'hello@vananchalagri.in', website: 'https://vananchalagri.example.in' },
    verificationStatus: 'verified',
  },
  {
    companyName: 'Jharkhand Solar Collective',
    companyType: 'MSME',
    description:
      'Deploys decentralized solar micro-grids and solar irrigation pumps in off-grid villages across Gumla and Simdega districts.',
    address: 'Main Road, Gumla, Jharkhand',
    location: DISTRICT_COORDS.Gumla,
    industries: ['Renewable Energy', 'Rural Development'],
    expertise: ['Micro-grids', 'Solar pumps', 'Village electrification', 'Maintenance training'],
    technologies: ['Solar PV', 'Battery storage', 'Smart metering'],
    collaborationTypes: ['pilot_deployment', 'sponsorship', 'csr_funding'],
    fundingCapacity: { min: 500000, max: 5000000, currency: 'INR' },
    verificationStatus: 'verified',
  },
  {
    companyName: 'Kolhan EdTech Labs',
    companyType: 'startup',
    description:
      'Builds multilingual learning apps in Ho, Santhali and Nagpuri for first-generation learners in tribal blocks.',
    address: 'Sakchi, Jamshedpur, East Singhbhum',
    location: DISTRICT_COORDS['East Singhbhum'],
    industries: ['Education', 'Technology'],
    expertise: ['EdTech', 'Local language content', 'Offline-first apps', 'Teacher enablement'],
    technologies: ['React Native', 'Speech tech', 'AI tutoring'],
    collaborationTypes: ['research_collaboration', 'internships', 'pilot_deployment'],
    fundingCapacity: { min: 50000, max: 1500000, currency: 'INR' },
    contactInformation: { email: 'team@kolhanlabs.in', website: 'https://kolhanlabs.example.in' },
    verificationStatus: 'verified',
  },
  {
    companyName: 'Tata Steel Foundation CSR Cell',
    companyType: 'CSR',
    description:
      'Corporate CSR arm funding water conservation, livelihood and education programs across East Singhbhum and West Singhbhum.',
    address: 'Jamshedpur, East Singhbhum, Jharkhand',
    location: DISTRICT_COORDS['East Singhbhum'],
    industries: ['CSR', 'Community Development'],
    expertise: ['Watershed development', 'Skill development', 'Women livelihoods', 'Program evaluation'],
    technologies: [],
    collaborationTypes: ['csr_funding', 'sponsorship', 'mentorship'],
    fundingCapacity: { min: 1000000, max: 20000000, currency: 'INR' },
    previousCollaborations: [
      { title: 'Jal Sahiya water program', partner: 'District Administration, West Singhbhum', year: 2024 },
    ],
    verificationStatus: 'verified',
  },
  {
    companyName: 'Dhanbad Mine Safety Systems',
    companyType: 'MSME',
    description:
      'Designs low-cost miner safety wearables and gas-detection systems for coal belt safety in partnership with mining institutes.',
    address: 'Bank More, Dhanbad, Jharkhand',
    location: DISTRICT_COORDS.Dhanbad,
    industries: ['Mining Safety', 'Industrial Hardware'],
    expertise: ['Safety hardware', 'Gas sensing', 'Wearables', 'Compliance audits'],
    technologies: ['Embedded systems', 'LoRa', 'Edge computing'],
    collaborationTypes: ['research_collaboration', 'pilot_deployment', 'internships'],
    fundingCapacity: { min: 200000, max: 3000000, currency: 'INR' },
    verificationStatus: 'verified',
  },
  {
    companyName: 'Santhal Handloom Hub',
    companyType: 'startup',
    description:
      'Direct-to-consumer marketplace helping Santhali weavers and artisans in Dumka and Pakur sell crafts nationally.',
    address: 'Dumka town, Dumka, Jharkhand',
    location: DISTRICT_COORDS.Dumka,
    industries: ['Handicrafts', 'E-commerce', 'Rural Livelihood'],
    expertise: ['Artisan onboarding', 'Brand building', 'Logistics', 'Fair trade'],
    technologies: ['Marketplace platform', 'Digital payments'],
    collaborationTypes: ['sponsorship', 'mentorship', 'pilot_deployment'],
    fundingCapacity: { min: 100000, max: 1000000, currency: 'INR' },
    verificationStatus: 'pending',
  },
  {
    companyName: 'Birsa Water Works',
    companyType: 'MSME',
    description:
      'Installs community water filtration units and repairs handpumps under Gram Panchayat contracts across Lohardaga and Latehar.',
    address: 'Lohardaga town, Lohardaga, Jharkhand',
    location: DISTRICT_COORDS.Lohardaga,
    industries: ['Water & Sanitation'],
    expertise: ['Filtration plants', 'Handpump repair', 'Water quality testing'],
    technologies: ['Reverse osmosis', 'Iron removal media'],
    collaborationTypes: ['pilot_deployment', 'csr_funding'],
    fundingCapacity: { min: 200000, max: 2000000, currency: 'INR' },
    verificationStatus: 'verified',
  },
  {
    companyName: 'NexGen Health Jharkhand',
    companyType: 'corporate',
    description:
      'Regional healthcare provider running telemedicine kiosks and mobile diagnostic vans for rural blocks of Palamu and Garhwa.',
    address: 'Ratu Road, Ranchi, Jharkhand',
    location: DISTRICT_COORDS.Ranchi,
    industries: ['Healthcare', 'Telemedicine'],
    expertise: ['Telemedicine', 'Diagnostics', 'ASHA worker support', 'Health camps'],
    technologies: ['Teleconsult platform', 'Portable diagnostics'],
    collaborationTypes: ['pilot_deployment', 'research_collaboration', 'sponsorship'],
    fundingCapacity: { min: 500000, max: 8000000, currency: 'INR' },
    previousCollaborations: [
      { title: 'Mobile OPD pilot, Palamu', partner: 'PHED & District Health Society', year: 2025 },
    ],
    verificationStatus: 'verified',
  },
  {
    companyName: 'Xavier Institute Innovation Hub',
    companyType: 'innovation_hub',
    description:
      'Ranchi-based incubator supporting early-stage founders working on tribal livelihood, climate resilience and civic-tech solutions.',
    address: 'Purulia Road, Ranchi, Jharkhand',
    location: DISTRICT_COORDS.Ranchi,
    industries: ['Incubation', 'Civic Tech', 'Climate'],
    expertise: ['Incubation', 'Prototype grants', 'Mentor networks', 'Investor connects'],
    technologies: [],
    collaborationTypes: ['mentorship', 'sponsorship', 'research_collaboration'],
    fundingCapacity: { min: 100000, max: 2000000, currency: 'INR' },
    verificationStatus: 'verified',
  },
  {
    companyName: 'Central Mining Research Outreach',
    companyType: 'research_organization',
    description:
      'Applied research unit working with universities on mine-affected land reclamation, subsidence mapping and dust pollution control.',
    address: 'CFRI Campus, Dhanbad, Jharkhand',
    location: DISTRICT_COORDS.Dhanbad,
    industries: ['Mining Research', 'Environment'],
    expertise: ['Land reclamation', 'Remote sensing', 'Air quality modelling'],
    technologies: ['GIS', 'Drone surveys', 'Satellite imagery'],
    collaborationTypes: ['research_collaboration', 'internships'],
    fundingCapacity: { min: 0, max: 0, currency: 'INR' },
    verificationStatus: 'pending',
  },
  {
    companyName: 'Giridih BambooWorks',
    companyType: 'MSME',
    description:
      'Bamboo processing unit creating furniture and handicraft value chains with tribal SHGs of Giridih and Koderma.',
    address: 'Giridih town, Giridih, Jharkhand',
    location: DISTRICT_COORDS.Giridih,
    industries: ['Bamboo Craft', 'Forest Produce', 'Manufacturing'],
    expertise: ['Bamboo processing', 'SHG federation', 'Product design', 'Export compliance'],
    technologies: ['Bamboo treatment', 'CNC tools'],
    collaborationTypes: ['pilot_deployment', 'internships', 'csr_funding'],
    fundingCapacity: { min: 150000, max: 1200000, currency: 'INR' },
    verificationStatus: 'verified',
  },
  {
    companyName: 'Sahyog Waste Solutions',
    companyType: 'startup',
    description:
      'Ward-level dry waste collection and plastic recycling startup operating material recovery facilities in Bokaro and Ramgarh.',
    address: 'Sector 4, Bokaro Steel City, Bokaro',
    location: DISTRICT_COORDS.Bokaro,
    industries: ['Waste Management', 'Recycling'],
    expertise: ['Material recovery', 'Plastic recycling', 'Waste picker inclusion', 'ULB contracts'],
    technologies: ['Sorting lines', 'Waste tracking app'],
    collaborationTypes: ['pilot_deployment', 'sponsorship'],
    fundingCapacity: { min: 300000, max: 4000000, currency: 'INR' },
    verificationStatus: 'verified',
  },
];

// ---- Citizen-reported problems (Explore Problems entries) ----
const CHALLENGES = [
  {
    title: 'No drinking water supply in Makhmandro village for three months',
    description:
      'The only public handpump in our village has been broken since March. Over 60 families walk nearly 2 km to a stream for drinking water. Children miss school to help fetch water and there have already been cases of stomach illness among kids. Requesting urgent repair or installation of a new handpump near the primary school.',
    category: 'water',
    subCategory: 'Drinking water access',
    district: 'Dumka',
    severity: 'critical',
    affectedPopulation: 350,
    skillsRequired: ['Civil engineering', 'Public health', 'Community mobilization'],
    tags: ['handpump', 'drinking water', 'village'],
  },
  {
    title: 'Primary school in Angara block has only one teacher for 80 students',
    description:
      'Government primary school in Angara has classes 1 to 5 but just one teacher posted. Students of different grades sit together without proper instruction and many cannot read simple sentences even by class 4. The school also needs teaching aids and mid-day meal infrastructure repair.',
    category: 'education',
    subCategory: 'Teacher shortage',
    district: 'Ranchi',
    severity: 'high',
    affectedPopulation: 80,
    skillsRequired: ['Pedagogy', 'Volunteer teaching', 'Curriculum design'],
    tags: ['school', 'teacher shortage', 'primary education'],
  },
  {
    title: 'Open drain overflowing near Sadar hospital road spreading disease',
    description:
      'The open drainage channel along the approach road to Sadar hospital overflows every week. Stagnant dirty water breeds mosquitoes and the smell makes it hard for patients to reach the outpatient wing. Municipal cleaning happens rarely despite repeated complaints.',
    category: 'sanitation',
    subCategory: 'Urban drainage',
    district: 'Hazaribagh',
    severity: 'high',
    affectedPopulation: 1200,
    skillsRequired: ['Civil engineering', 'Municipal planning'],
    tags: ['drainage', 'mosquitoes', 'hospital'],
  },
  {
    title: 'Coal dust from open-cast mines covering homes in Putki village',
    description:
      'Daily blasting and truck movement at the nearby open-cast mine covers our houses in thick coal dust. Elders and children are developing breathing problems and eye infections. Windows must stay closed all day. We request air quality monitoring and dust suppression measures like water sprinkling on haul roads.',
    category: 'environment',
    subCategory: 'Air pollution',
    district: 'Dhanbad',
    severity: 'critical',
    affectedPopulation: 900,
    skillsRequired: ['Environmental engineering', 'Air quality monitoring', 'Data analysis'],
    tags: ['coal mining', 'air pollution', 'health'],
  },
  {
    title: 'Irrigation canal broken — paddy crop failing in Bishungarh blocks',
    description:
      'The main earthen canal serving five villages breached two seasons ago and was never repaired. Farmers who used to grow two paddy crops now depend entirely on rain. Several families have started migrating for construction work. Requesting canal desilting and concrete lining so irrigation reaches tail-end fields again.',
    category: 'agriculture',
    subCategory: 'Irrigation',
    district: 'Giridih',
    severity: 'high',
    affectedPopulation: 2100,
    skillsRequired: ['Water resources', 'Agriculture', 'Civil engineering'],
    tags: ['canal', 'irrigation', 'paddy'],
  },
  {
    title: 'Streetlights not working on main market road, women unsafe after dusk',
    description:
      'Over half the streetlight poles on the weekly haat bazaar road are dead. Shopkeepers close early and women returning from work avoid the route after sunset due to safety concerns. Wiring appears damaged at several poles and needs full rewiring rather than bulb replacement.',
    category: 'energy',
    subCategory: 'Street lighting',
    district: 'East Singhbhum',
    severity: 'medium',
    affectedPopulation: 600,
    skillsRequired: ['Electrical engineering', 'Solar technology'],
    tags: ['streetlights', 'safety', 'market'],
  },
  {
    title: 'Bridge approach road washed away cutting off four villages',
    description:
      'The earthen approach road to the culvert over Kanchi river collapsed during monsoon. Ambulances and school buses cannot enter our villages — patients are carried on cots for 3 km. Urgently need rubble and culvert widening before the next rains.',
    category: 'roads_infrastructure',
    subCategory: 'Bridge / culvert',
    district: 'Gumla',
    severity: 'critical',
    affectedPopulation: 1800,
    skillsRequired: ['Structural engineering', 'PWD coordination'],
    tags: ['bridge', 'connectivity', 'monsoon'],
  },
  {
    title: 'Unemployment driving youth migration from Pakur tribal hamlets',
    description:
      'Young people from our panchayat migrate to Delhi and Surat every year after harvest because there is no local work. Skill training centres are 40 km away and nobody knows about government schemes. We want a local skill centre focused on trades that fit our area — masonry, food processing, mobile repair.',
    category: 'employment',
    subCategory: 'Youth skilling',
    district: 'Pakur',
    severity: 'high',
    affectedPopulation: 2500,
    skillsRequired: ['Skill training', 'Career counselling', 'Program design'],
    tags: ['migration', 'skills', 'unemployment'],
  },
  {
    title: 'Village pond turned into garbage dump causing seasonal flooding',
    description:
      'The traditional pond that once stored monsoon runoff is being used as an open dump. Plastic chokes its inlets, so nearby lanes flood within an hour of heavy rain. Cleaning the pond and restoring its inlet-outlet channels would solve both dumping and flooding.',
    category: 'waste_management',
    subCategory: 'Illegal dumping / water body',
    district: 'Bokaro',
    severity: 'medium',
    affectedPopulation: 450,
    skillsRequired: ['Waste management', 'Hydrology', 'Community awareness'],
    tags: ['pond', 'flooding', 'plastic waste'],
  },
  {
    title: 'Anganwadi centre building unsafe, children sit in open courtyard',
    description:
      'Our anganwadi centre\'s roof was declared unsafe last year so the worker holds sessions in the open. In summer and rain, nutrition and pre-school activities stop completely. A repaired or new building would restore daily nutrition for around 60 children and 15 pregnant/lactating mothers.',
    category: 'healthcare',
    subCategory: 'Nutrition infrastructure',
    district: 'Khunti',
    severity: 'high',
    affectedPopulation: 75,
    skillsRequired: ['Architecture', 'Public health', 'Fundraising'],
    tags: ['anganwadi', 'nutrition', 'children'],
  },
  {
    title: 'No accessible ramp or toilets for differently-abled students at college',
    description:
      'The degree college has no ramps and the single toilet block is unusable for wheelchair users. Three differently-abled students currently depend on friends to be carried upstairs every day. Requesting ramps with railings, an accessible toilet and classroom relocation to ground floor as interim relief.',
    category: 'accessibility',
    subCategory: 'Educational institution access',
    district: 'Ranchi',
    severity: 'medium',
    affectedPopulation: 12,
    skillsRequired: ['Accessible design', 'Advocacy', 'Civil engineering'],
    tags: ['disability access', 'college', 'ramp'],
  },
  {
    title: 'Forest-edge village facing frequent elephant conflict at night',
    description:
      'Elephant herds raid our crops almost every week during harvest season and two people were injured last month while guarding fields at night. Solar fencing exists but is broken in stretches. Need rapid-repair of fence, early warning siren network and compensation process guidance for crop loss.',
    category: 'environment',
    subCategory: 'Human-wildlife conflict',
    district: 'West Singhbhum',
    severity: 'high',
    affectedPopulation: 1100,
    skillsRequired: ['Wildlife management', 'Sensor technology', 'Community protocols'],
    tags: ['elephants', 'crop damage', 'fencing'],
  },
  {
    title: 'PDS ration shop opens irregularly, families denied full entitlement',
    description:
      'The fair price shop in our panchayat opens only 4-5 days a month and often shows stock shortages. Families end up buying rice from the market at double cost. We ask for biometric attendance logging of shop opening hours and grievance redressal support so entitlements reach everyone.',
    category: 'public_services',
    subCategory: 'Public distribution system',
    district: 'Sahibganj',
    severity: 'high',
    affectedPopulation: 1600,
    skillsRequired: ['Policy analysis', 'Data transparency tools'],
    tags: ['PDS', 'ration shop', 'entitlements'],
  },
  {
    title: 'Mobile network absent across three hamlets, students unable to study online',
    description:
      'There is no reliable mobile signal in our hill-top hamlets. Online classes, telemedicine calls and digital payment at the haat are impossible — people climb a ridge half a kilometre away just to make calls. Requesting a telecom tower feasibility survey or community Wi-Fi via BharatNet.',
    category: 'other',
    subCategory: 'Digital connectivity',
    district: 'Latehar',
    severity: 'medium',
    affectedPopulation: 700,
    skillsRequired: ['Telecom planning', 'Networking', 'Surveying'],
    tags: ['mobile network', 'connectivity', 'online education'],
  },
  {
    title: 'Weekly haat lacks cold storage — vegetable farmers forced into distress sale',
    description:
      'Tomato and cauliflower farmers around our block sell at throwaway prices on haat day because produce spoils within a day without cold storage. Even a small 10-tonne cold room at the market would let farmers hold stock and get fair prices, raising incomes for hundreds of families.',
    category: 'rural_livelihood',
    subCategory: 'Post-harvest storage',
    district: 'Chatra',
    severity: 'high',
    affectedPopulation: 1300,
    skillsRequired: ['Cold chain design', 'Agri business', 'Solar technology'],
    tags: ['cold storage', 'vegetables', 'distress sale'],
  },
  {
    title: 'Seasonal river crossing dangerous for schoolchildren in monsoon',
    description:
      'Around 90 children wade through waist-deep water of a seasonal stream to reach school every monsoon. Last year a teenager was swept away but rescued in time. A footbridge or at minimum a safe raised causeway with rope rails is urgently needed before June.',
    category: 'roads_infrastructure',
    subCategory: 'Footbridge',
    district: 'Deoghar',
    severity: 'critical',
    affectedPopulation: 400,
    skillsRequired: ['Structural engineering', 'Low-cost bridge design'],
    tags: ['footbridge', 'schoolchildren', 'monsoon'],
  },
  {
    title: 'Health sub-centre has no medicine stock or trained staff most days',
    description:
      'Our health sub-centre building exists but remains locked most days — the ANM covers three villages and basic medicines like ORS, paracetamol and iron tablets are out of stock for weeks. Villagers travel 25 km to the block hospital for minor ailments. Need regular stock audits and staff posting.',
    category: 'healthcare',
    subCategory: 'Primary care access',
    district: 'Godda',
    severity: 'high',
    affectedPopulation: 2200,
    skillsRequired: ['Public health', 'Supply chain', 'Health policy'],
    tags: ['sub-centre', 'medicine stock', 'ANM'],
  },
  {
    title: 'Stone quarry blasting cracking houses in Koderma villages',
    description:
      'Regular blasting at stone quarries within 200 metres of our homes has cracked walls in more than 30 houses. Dust coats crops and water tanks. Villagers want enforcement of the mandatory blast-free zone, vibration monitoring and damage assessment of affected houses.',
    category: 'other',
    subCategory: 'Quarry regulation',
    district: 'Koderma',
    severity: 'high',
    affectedPopulation: 850,
    skillsRequired: ['Geology', 'Structural inspection', 'Legal aid'],
    tags: ['quarry', 'blasting', 'house damage'],
  },
];

async function seedCitizens() {
  let created = 0;
  const usersByEmail = {};
  for (const c of CITIZENS) {
    const existing = await User.findOne({ email: c.email }).select('_id').lean();
    if (existing) {
      usersByEmail[c.email] = existing._id;
      continue;
    }
    const user = await User.create({
      ...c,
      password: DEMO_PASSWORD,
      role: 'citizen',
      isVerified: true,
      preferredLanguage: 'en',
      location: {
        type: 'Point',
        coordinates: [DISTRICT_COORDS[c.district][1], DISTRICT_COORDS[c.district][0]],
      },
    });
    usersByEmail[c.email] = user._id;
    created += 1;
  }
  console.log(`citizens: created ${created}, reused ${CITIZENS.length - created}`);
  return usersByEmail;
}

async function seedIndustries() {
  let created = 0;
  let skipped = 0;
  for (const ind of INDUSTRIES) {
    const exists = await Industry.findOne({ companyName: ind.companyName }).select('_id').lean();
    if (exists) {
      skipped += 1;
      continue;
    }
    const coords = ind.location ? [ind.location[1], ind.location[0]] : undefined;
    await Industry.create({
      ...ind,
      ...(coords ? { location: { type: 'Point', coordinates: coords } } : {}),
    });
    created += 1;
    console.log(`created: ${ind.companyType.padEnd(20)} ${ind.companyName}`);
  }
  console.log(`industries: created ${created}, skipped ${skipped}`);
}

async function seedChallenges(usersByEmail) {
  const emails = Object.keys(usersByEmail);
  const submitterFor = (i) => usersByEmail[emails[i % emails.length]];

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < CHALLENGES.length; i += 1) {
    const ch = CHALLENGES[i];
    const exists = await Challenge.findOne({
      title: ch.title,
      district: ch.district,
    })
      .select('_id')
      .lean();
    if (exists) {
      skipped += 1;
      continue;
    }

    const [lat, lng] = DISTRICT_COORDS[ch.district];
    await Challenge.create({
      ...ch,
      submittedBy: submitterFor(i),
      language: 'en',
      status: ['submitted', 'under_review', 'validated'][i % 3],
      aiStatus: 'completed',
      aiSummary: `Reported issue categorized under "${ch.category}" (${ch.subCategory || 'general'}) in ${ch.district} district. Community validation pending.`,
      priorityScore: { low: 25, medium: 45, high: 70, critical: 88 }[ch.severity] ?? 40,
      location: {
        type: 'Point',
        // jitter so pins don't overlap exactly at centroid
        coordinates: [
          lng + ((i % 5) - 2) * 0.02,
          lat + (((i + 2) % 5) - 2) * 0.02,
        ],
      },
      address: `${ch.subCategory || ch.category} issue, ${ch.district}, Jharkhand`,
      communityValidation: {
        supportCount: (i * 7) % 40,
        disputeCount: i % 4 === 0 ? 1 : 0,
        commentCount: (i * 3) % 9,
      },
    });
    created += 1;
    console.log(`created: [${String(ch.severity).padEnd(8)}] ${ch.title.slice(0, 58)}…`);
  }
  console.log(`challenges: created ${created}, skipped ${skipped}`);
}

async function main() {
  await connectDB();

  const usersByEmail = await seedCitizens();
  await seedIndustries();
  await seedChallenges(usersByEmail);

  console.log('\nDone.');
  console.log(`Demo citizen password: ${DEMO_PASSWORD}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Seeding failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
