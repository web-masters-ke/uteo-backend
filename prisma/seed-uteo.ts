/**
 * Uteo — Jobs platform seed
 * Creates companies, recruiters, skills, and 60 real-looking Kenyan job postings
 * across all job types and industries.
 *
 * Run: npx ts-node prisma/seed-uteo.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n: number) { return new Date(Date.now() - n * 86400_000); }
function daysFrom(n: number) { return new Date(Date.now() + n * 86400_000); }

async function main() {
  console.log('🌱 Seeding Uteo jobs platform...');

  const pw = await bcrypt.hash('Recruiter2026!', 12);
  const seekerPw = await bcrypt.hash('Seeker2026!', 12);

  const del = async (fn: () => Promise<any>) => { try { await fn(); } catch { } };

  // Clear Uteo-specific tables only
  await del(() => prisma.application.deleteMany());
  await del(() => prisma.savedJob.deleteMany());
  await del(() => prisma.jobSkill.deleteMany());
  await del(() => prisma.job.deleteMany());
  await del(() => prisma.userSkill.deleteMany());
  await del(() => prisma.jobSeekerProfile.deleteMany());
  await del(() => prisma.workExperience.deleteMany());
  await del(() => prisma.education.deleteMany());
  await del(() => (prisma as any).recruiter.deleteMany());
  await del(() => prisma.company.deleteMany());

  // Delete seeded uteo users by email pattern
  await prisma.user.deleteMany({ where: { email: { contains: '@uteo-demo' } } });

  // ── Skills ─────────────────────────────────────────────────────────────────
  const skillNames = [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'Kotlin',
    'Flutter', 'Swift', 'SQL', 'PostgreSQL', 'MongoDB', 'Redis', 'AWS', 'Docker',
    'Git', 'REST APIs', 'GraphQL', 'Figma', 'UI/UX Design', 'Product Management',
    'Digital Marketing', 'SEO', 'Content Writing', 'Copywriting', 'Social Media',
    'Sales', 'Business Development', 'CRM', 'Customer Success', 'Account Management',
    'Financial Modelling', 'Excel', 'Accounting', 'Tax', 'Auditing', 'QuickBooks',
    'Project Management', 'Agile', 'Scrum', 'Leadership', 'Communication',
    'Data Analysis', 'Power BI', 'Tableau', 'Machine Learning', 'Research',
    'Legal Research', 'Contract Drafting', 'Supply Chain', 'Logistics', 'Procurement',
    'HR Management', 'Recruitment', 'Payroll', 'Training & Development',
    'Healthcare', 'Nursing', 'Clinical Research', 'Pharmacy',
    'Civil Engineering', 'AutoCAD', 'Architecture', 'Electrical Engineering',
    'Graphic Design', 'Adobe Photoshop', 'Illustrator', 'Video Editing',
    'Swahili', 'French', 'Customer Service', 'Operations', 'Events Management',
  ];

  const skills = await Promise.all(
    skillNames.map(name => prisma.skill.upsert({
      where: { name },
      update: {},
      create: { name, category: 'General' },
    }))
  );
  const skillMap: Record<string, string> = {};
  for (const s of skills) skillMap[s.name] = s.id;

  // ── Companies ──────────────────────────────────────────────────────────────
  const companiesData = [
    { name: 'Safaricom PLC', industry: 'Telecommunications', size: 'LARGE' as const, location: 'Westlands, Nairobi', logo: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100&h=100&fit=crop', website: 'https://safaricom.co.ke', verified: true },
    { name: 'Equity Bank Kenya', industry: 'Banking & Finance', size: 'LARGE' as const, location: 'Upper Hill, Nairobi', logo: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=100&h=100&fit=crop', website: 'https://equitybank.co.ke', verified: true },
    { name: 'Andela Kenya', industry: 'Technology', size: 'MEDIUM' as const, location: 'Kilimani, Nairobi', logo: 'https://images.unsplash.com/photo-1560472355-536de3962603?w=100&h=100&fit=crop', website: 'https://andela.com', verified: true },
    { name: 'M-KOPA Solar', industry: 'Clean Energy', size: 'MEDIUM' as const, location: 'Karen, Nairobi', logo: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=100&h=100&fit=crop', website: 'https://m-kopa.com', verified: true },
    { name: 'Twiga Foods', industry: 'Agritech', size: 'MEDIUM' as const, location: 'Industrial Area, Nairobi', logo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&h=100&fit=crop', website: 'https://twiga.com', verified: true },
    { name: 'NCBA Group', industry: 'Banking & Finance', size: 'LARGE' as const, location: 'Upperhill, Nairobi', logo: 'https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?w=100&h=100&fit=crop', website: 'https://ncbagroup.com', verified: true },
    { name: 'Sendy Ltd', industry: 'Logistics & Delivery', size: 'SMALL' as const, location: 'Ngong Road, Nairobi', logo: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100&h=100&fit=crop', website: 'https://sendy.co.ke', verified: false },
    { name: 'Africa\'s Talking', industry: 'Technology', size: 'MEDIUM' as const, location: 'Westlands, Nairobi', logo: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=100&h=100&fit=crop', website: 'https://africastalking.com', verified: true },
    { name: 'Deloitte East Africa', industry: 'Professional Services', size: 'LARGE' as const, location: 'Waiyaki Way, Nairobi', logo: 'https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=100&h=100&fit=crop', website: 'https://deloitte.com/ke', verified: true },
    { name: 'Nation Media Group', industry: 'Media & Publishing', size: 'LARGE' as const, location: 'Nation Centre, Nairobi', logo: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=100&h=100&fit=crop', website: 'https://nation.africa', verified: true },
    { name: 'Sanergy', industry: 'Sanitation & Impact', size: 'SMALL' as const, location: 'Mukuru, Nairobi', logo: 'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=100&h=100&fit=crop', website: 'https://sanergy.com', verified: false },
    { name: 'Jumia Kenya', industry: 'E-Commerce', size: 'MEDIUM' as const, location: 'Parklands, Nairobi', logo: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=100&h=100&fit=crop', website: 'https://jumia.co.ke', verified: true },
    { name: 'KCB Group', industry: 'Banking & Finance', size: 'LARGE' as const, location: 'Kencom House, Nairobi', logo: 'https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?w=100&h=100&fit=crop', website: 'https://kcbgroup.com', verified: true },
    { name: 'Cellulant', industry: 'Fintech', size: 'MEDIUM' as const, location: 'Kilimani, Nairobi', logo: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=100&h=100&fit=crop', website: 'https://cellulant.io', verified: true },
    { name: 'Watu Credit', industry: 'Fintech', size: 'SMALL' as const, location: 'Mombasa Road, Nairobi', logo: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=100&h=100&fit=crop', website: 'https://watucredit.com', verified: false },
  ];

  const companies = await Promise.all(
    companiesData.map(c => prisma.company.create({
      data: {
        name: c.name,
        industry: c.industry,
        size: c.size,
        location: c.location,
        logoUrl: c.logo,
        website: c.website,
        isVerified: c.verified,
        description: `${c.name} is a leading organisation in the ${c.industry} sector operating across East Africa.`,
      },
    }))
  );

  // ── Recruiter users (one per company) ──────────────────────────────────────
  const recruiterDefs = [
    { first: 'Michael', last: 'Kariuki', email: 'michael.kariuki@uteo-demo.ke' },
    { first: 'Winnie', last: 'Achieng', email: 'winnie.achieng@uteo-demo.ke' },
    { first: 'Kevin', last: 'Mwangi', email: 'kevin.mwangi@uteo-demo.ke' },
    { first: 'Cynthia', last: 'Oduya', email: 'cynthia.oduya@uteo-demo.ke' },
    { first: 'Brian', last: 'Njoroge', email: 'brian.njoroge@uteo-demo.ke' },
    { first: 'Ruth', last: 'Mutua', email: 'ruth.mutua@uteo-demo.ke' },
    { first: 'Dennis', last: 'Ochieng', email: 'dennis.ochieng@uteo-demo.ke' },
    { first: 'Joyce', last: 'Kamau', email: 'joyce.kamau@uteo-demo.ke' },
    { first: 'Patrick', last: 'Waweru', email: 'patrick.waweru@uteo-demo.ke' },
    { first: 'Esther', last: 'Nyambura', email: 'esther.nyambura@uteo-demo.ke' },
    { first: 'Samuel', last: 'Otieno', email: 'samuel.otieno@uteo-demo.ke' },
    { first: 'Peninah', last: 'Wanjiku', email: 'peninah.wanjiku@uteo-demo.ke' },
    { first: 'Alex', last: 'Kiprotich', email: 'alex.kiprotich@uteo-demo.ke' },
    { first: 'Diana', last: 'Adhiambo', email: 'diana.adhiambo@uteo-demo.ke' },
    { first: 'Felix', last: 'Cheruiyot', email: 'felix.cheruiyot@uteo-demo.ke' },
  ];

  const recruiters = await Promise.all(
    recruiterDefs.map((r, i) =>
      prisma.user.create({
        data: {
          email: r.email,
          passwordHash: pw,
          firstName: r.first,
          lastName: r.last,
          role: 'TRAINER',
          emailVerified: true,
          recruiter: {
            create: { companyId: companies[i].id, title: 'Talent Acquisition Manager' },
          },
        },
        include: { recruiter: true },
      })
    )
  );

  // ── Job postings (60 jobs across all types and industries) ─────────────────
  type JobDef = {
    companyIdx: number;
    title: string;
    description: string;
    requirements: string;
    location: string;
    jobType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'REMOTE' | 'HYBRID';
    salaryMin: number;
    salaryMax: number;
    skills: string[];
    daysOld: number;
  };

  const jobDefs: JobDef[] = [
    // Safaricom
    {
      companyIdx: 0, title: 'Senior Software Engineer', jobType: 'FULL_TIME',
      location: 'Westlands, Nairobi', salaryMin: 180000, salaryMax: 280000, daysOld: 3,
      description: 'Join our platform engineering team building the systems that power M-PESA and millions of Kenyan transactions every day. You will design and maintain high-availability microservices at massive scale.',
      requirements: 'At least 5 years of backend engineering experience. Strong knowledge of distributed systems and cloud infrastructure. Experience with Java or Go preferred.',
      skills: ['Java', 'AWS', 'Docker', 'PostgreSQL', 'REST APIs'],
    },
    {
      companyIdx: 0, title: 'Product Manager - M-PESA Super App', jobType: 'FULL_TIME',
      location: 'Westlands, Nairobi', salaryMin: 200000, salaryMax: 320000, daysOld: 7,
      description: 'Own the roadmap for the M-PESA Super App product suite. Work cross-functionally with engineering, design, and business teams to define and ship features used by over 30 million customers.',
      requirements: 'Minimum 4 years of product management in a consumer or fintech product. Demonstrated ability to work with data to make decisions. Strong communicator.',
      skills: ['Product Management', 'Data Analysis', 'Agile', 'Communication'],
    },
    {
      companyIdx: 0, title: 'UI/UX Designer', jobType: 'HYBRID',
      location: 'Westlands, Nairobi', salaryMin: 100000, salaryMax: 160000, daysOld: 5,
      description: 'Design intuitive experiences for Safaricom digital products. You will run user research sessions, create wireframes and prototypes, and work directly with engineers to ship polished interfaces.',
      requirements: 'Portfolio demonstrating mobile-first design. Proficiency in Figma. Experience doing user research and usability testing.',
      skills: ['Figma', 'UI/UX Design', 'Research'],
    },
    // Equity Bank
    {
      companyIdx: 1, title: 'Credit Risk Analyst', jobType: 'FULL_TIME',
      location: 'Upper Hill, Nairobi', salaryMin: 120000, salaryMax: 180000, daysOld: 2,
      description: 'Assess credit risk for SME and corporate loan applications. Build financial models and make recommendations to the credit committee. This role sits within our Group Risk function.',
      requirements: 'Degree in Finance, Economics or Accounting. At least 3 years in credit analysis or corporate banking. CPA or CFA progress is an advantage.',
      skills: ['Financial Modelling', 'Excel', 'Accounting', 'Data Analysis'],
    },
    {
      companyIdx: 1, title: 'Mobile Banking Developer', jobType: 'FULL_TIME',
      location: 'Upper Hill, Nairobi', salaryMin: 150000, salaryMax: 240000, daysOld: 10,
      description: 'Build and maintain the Equity Mobile Banking app serving millions of customers across Africa. Work on new features, performance improvements and security hardening.',
      requirements: '3 years Android or iOS development experience. Understanding of financial systems and security best practices. Kotlin preferred.',
      skills: ['Kotlin', 'Java', 'REST APIs', 'SQL'],
    },
    {
      companyIdx: 1, title: 'Graduate Trainee - Finance', jobType: 'INTERNSHIP',
      location: 'Upper Hill, Nairobi', salaryMin: 35000, salaryMax: 50000, daysOld: 1,
      description: 'A structured 12-month graduate programme rotating across Treasury, Corporate Banking and Retail. Ideal for recent graduates looking to build a career in banking.',
      requirements: 'Degree in Finance, Economics, Commerce or a related field. Must have graduated within the last 2 years with at minimum second class honours.',
      skills: ['Excel', 'Accounting', 'Financial Modelling', 'Communication'],
    },
    // Andela
    {
      companyIdx: 2, title: 'Senior React Engineer', jobType: 'REMOTE',
      location: 'Remote (Africa)', salaryMin: 300000, salaryMax: 500000, daysOld: 4,
      description: 'Work on world-class product teams as an Andela engineer. You will be matched to a global technology company and build sophisticated web applications using React and TypeScript.',
      requirements: 'At least 4 years React development. Strong TypeScript skills. Experience with modern state management and testing frameworks.',
      skills: ['React', 'TypeScript', 'JavaScript', 'GraphQL', 'Git'],
    },
    {
      companyIdx: 2, title: 'Full Stack Engineer - Node.js', jobType: 'REMOTE',
      location: 'Remote (Africa)', salaryMin: 280000, salaryMax: 450000, daysOld: 6,
      description: 'Join the Andela talent network and get matched with leading technology companies globally. You will build scalable full-stack systems and collaborate with distributed teams.',
      requirements: '4 years full-stack experience. Node.js backend and React or Vue on the frontend. CI/CD experience and strong Git workflow.',
      skills: ['Node.js', 'React', 'PostgreSQL', 'Docker', 'REST APIs'],
    },
    {
      companyIdx: 2, title: 'Python Data Engineer', jobType: 'REMOTE',
      location: 'Remote (Africa)', salaryMin: 260000, salaryMax: 420000, daysOld: 8,
      description: 'Design and maintain data pipelines for global clients as part of the Andela engineering talent network. Work with large datasets and cloud-based data infrastructure.',
      requirements: '3 years data engineering experience. Python proficiency. Strong SQL. Experience with AWS or GCP data services.',
      skills: ['Python', 'SQL', 'PostgreSQL', 'AWS', 'Data Analysis'],
    },
    // M-KOPA
    {
      companyIdx: 3, title: 'Field Sales Agent', jobType: 'FULL_TIME',
      location: 'Kisumu, Kenya', salaryMin: 40000, salaryMax: 70000, daysOld: 1,
      description: 'Grow M-KOPA\'s customer base in Western Kenya by selling solar home systems and smartphones to underserved communities. You will be the face of M-KOPA in your territory.',
      requirements: 'At least 1 year field sales experience. Own transport is an advantage. Fluency in Dholuo or Luhya a strong plus. Driven and self-motivated.',
      skills: ['Sales', 'Customer Service', 'Communication', 'Swahili'],
    },
    {
      companyIdx: 3, title: 'Data Scientist - IoT Analytics', jobType: 'HYBRID',
      location: 'Karen, Nairobi', salaryMin: 160000, salaryMax: 250000, daysOld: 9,
      description: 'Analyse data from over 3 million connected solar devices to improve payment propensity models and device health monitoring. This is a high-impact role in our data team.',
      requirements: '3 years applied data science. Python and ML experience. Experience with time-series data is a big plus.',
      skills: ['Python', 'Machine Learning', 'Data Analysis', 'SQL', 'Tableau'],
    },
    // Twiga Foods
    {
      companyIdx: 4, title: 'Supply Chain Coordinator', jobType: 'FULL_TIME',
      location: 'Industrial Area, Nairobi', salaryMin: 80000, salaryMax: 120000, daysOld: 3,
      description: 'Coordinate daily produce procurement from farmers and delivery to informal retailers across Nairobi. Manage relationships with over 200 farmer suppliers and monitor delivery KPIs.',
      requirements: 'Degree in Supply Chain, Logistics or Business. 2 years experience in FMCG or agri supply chain. Strong Excel and analytical skills.',
      skills: ['Supply Chain', 'Logistics', 'Procurement', 'Excel', 'Operations'],
    },
    {
      companyIdx: 4, title: 'Android Developer', jobType: 'FULL_TIME',
      location: 'Industrial Area, Nairobi', salaryMin: 120000, salaryMax: 190000, daysOld: 12,
      description: 'Build the Twiga vendor app used by thousands of kiosks and dukas across Kenya. You will work closely with product and operations to ship features that directly help informal traders.',
      requirements: '3 years Android development. Kotlin experience required. Understanding of offline-first mobile architecture a plus.',
      skills: ['Kotlin', 'Java', 'Flutter', 'REST APIs', 'Git'],
    },
    // NCBA
    {
      companyIdx: 5, title: 'Relationship Manager - SME Banking', jobType: 'FULL_TIME',
      location: 'Upperhill, Nairobi', salaryMin: 130000, salaryMax: 200000, daysOld: 5,
      description: 'Manage and grow a portfolio of SME clients. Offer tailored banking solutions including trade finance, asset finance and M-Shwari lending products.',
      requirements: 'Banking or finance degree. 3 years relationship management in commercial banking. Strong client-facing skills and credit analysis ability.',
      skills: ['Account Management', 'Business Development', 'Financial Modelling', 'CRM'],
    },
    {
      companyIdx: 5, title: 'Internal Auditor', jobType: 'FULL_TIME',
      location: 'Upperhill, Nairobi', salaryMin: 100000, salaryMax: 160000, daysOld: 14,
      description: 'Conduct risk-based audits across NCBA Group operations in Kenya and the region. Report findings to the audit committee and track remediation progress.',
      requirements: 'CPA or ACCA qualified. At least 3 years internal audit experience in financial services. CIA certification is an added advantage.',
      skills: ['Auditing', 'Accounting', 'Excel', 'Research'],
    },
    // Sendy
    {
      companyIdx: 6, title: 'Operations Manager', jobType: 'FULL_TIME',
      location: 'Ngong Road, Nairobi', salaryMin: 150000, salaryMax: 220000, daysOld: 2,
      description: 'Lead day-to-day logistics operations including driver management, route optimisation and customer escalations. Own city-level KPIs and build a high-performing ops team.',
      requirements: '4 years operations management. Experience in logistics or on-demand delivery is strongly preferred. Analytical with strong people management skills.',
      skills: ['Operations', 'Supply Chain', 'Leadership', 'Data Analysis'],
    },
    {
      companyIdx: 6, title: 'Customer Success Executive', jobType: 'FULL_TIME',
      location: 'Ngong Road, Nairobi', salaryMin: 55000, salaryMax: 85000, daysOld: 0,
      description: 'Manage key business accounts and ensure they get maximum value from Sendy\'s logistics platform. Handle escalations, conduct business reviews and identify upsell opportunities.',
      requirements: '2 years in customer success or account management. Experience with logistics or SaaS products preferred.',
      skills: ['Customer Success', 'Account Management', 'CRM', 'Communication'],
    },
    // Africa's Talking
    {
      companyIdx: 7, title: 'Developer Evangelist', jobType: 'HYBRID',
      location: 'Westlands, Nairobi', salaryMin: 130000, salaryMax: 200000, daysOld: 6,
      description: 'Represent Africa\'s Talking at hackathons, developer conferences and online communities. Create technical content, build sample applications and help developers across Africa succeed with our APIs.',
      requirements: 'Software engineering background. Excellent communication and presentation skills. Active in developer communities. Experience writing technical blog posts.',
      skills: ['JavaScript', 'Python', 'REST APIs', 'Communication', 'Content Writing'],
    },
    {
      companyIdx: 7, title: 'Backend Engineer - Telco APIs', jobType: 'FULL_TIME',
      location: 'Westlands, Nairobi', salaryMin: 160000, salaryMax: 250000, daysOld: 10,
      description: 'Build and scale the Africa\'s Talking API platform that enables SMS, voice, USSD and payments across over 20 African markets. High-availability systems serving billions of requests a month.',
      requirements: '4 years backend engineering. Java or Go preferred. Deep understanding of API design and high-throughput systems.',
      skills: ['Java', 'Node.js', 'PostgreSQL', 'Redis', 'Docker'],
    },
    {
      companyIdx: 7, title: 'Technical Support Engineer', jobType: 'FULL_TIME',
      location: 'Westlands, Nairobi', salaryMin: 80000, salaryMax: 120000, daysOld: 4,
      description: 'Be the first line of technical support for developers integrating the Africa\'s Talking API platform. Debug integration issues, write documentation and escalate complex bugs to engineering.',
      requirements: '2 years in a technical support role. Comfortable reading code in JavaScript or Python. Strong written English.',
      skills: ['JavaScript', 'Python', 'REST APIs', 'Customer Service', 'Communication'],
    },
    // Deloitte
    {
      companyIdx: 8, title: 'Tax Consultant', jobType: 'FULL_TIME',
      location: 'Waiyaki Way, Nairobi', salaryMin: 110000, salaryMax: 170000, daysOld: 3,
      description: 'Advise corporate clients on Kenyan and East African tax compliance, tax structuring and dispute resolution with the Kenya Revenue Authority.',
      requirements: 'CPA (K) qualified. Degree in Finance, Accounting or Law. At least 2 years tax advisory experience. Strong research and drafting skills.',
      skills: ['Tax', 'Accounting', 'Legal Research', 'Excel', 'Research'],
    },
    {
      companyIdx: 8, title: 'Management Consultant - Strategy', jobType: 'FULL_TIME',
      location: 'Waiyaki Way, Nairobi', salaryMin: 180000, salaryMax: 300000, daysOld: 7,
      description: 'Work on high-impact strategy and transformation engagements for leading organisations in Kenya and across the region. Build financial models, conduct market research and present findings at C-suite level.',
      requirements: 'MBA or equivalent. 3 years consulting or strategy experience. Exceptional Excel and PowerPoint skills. Strong analytical thinking.',
      skills: ['Financial Modelling', 'Excel', 'Research', 'Project Management', 'Communication'],
    },
    {
      companyIdx: 8, title: 'Risk Advisory Associate', jobType: 'CONTRACT',
      location: 'Waiyaki Way, Nairobi', salaryMin: 90000, salaryMax: 140000, daysOld: 15,
      description: 'Support risk advisory engagements covering enterprise risk management, internal controls, and regulatory compliance for clients in financial services and public sector.',
      requirements: 'Accounting or finance degree. Understanding of risk frameworks (COSO, ISO 31000). Good communicator.',
      skills: ['Auditing', 'Accounting', 'Research', 'Excel', 'Communication'],
    },
    // Nation Media
    {
      companyIdx: 9, title: 'Digital Journalist', jobType: 'FULL_TIME',
      location: 'Nation Centre, Nairobi', salaryMin: 70000, salaryMax: 110000, daysOld: 2,
      description: 'Report and write stories across Nation.Africa digital platforms. Cover business, politics and society with a digital-first approach. You will produce both written stories and multimedia content.',
      requirements: 'Journalism or communications degree. 2 years newsroom experience. Strong news judgement and ability to work to tight deadlines.',
      skills: ['Content Writing', 'Research', 'Social Media', 'Communication'],
    },
    {
      companyIdx: 9, title: 'Digital Marketing Manager', jobType: 'FULL_TIME',
      location: 'Nation Centre, Nairobi', salaryMin: 130000, salaryMax: 200000, daysOld: 8,
      description: 'Drive subscriber growth and engagement across Nation Media Group\'s digital platforms. Own SEO, paid media, email campaigns and performance analytics.',
      requirements: '4 years digital marketing experience. Proven track record growing digital audiences. Google Ads and Meta certified preferred.',
      skills: ['Digital Marketing', 'SEO', 'Social Media', 'Data Analysis', 'Copywriting'],
    },
    {
      companyIdx: 9, title: 'Graphic Designer', jobType: 'PART_TIME',
      location: 'Nation Centre, Nairobi', salaryMin: 40000, salaryMax: 65000, daysOld: 1,
      description: 'Create visual content for Nation.Africa digital platforms, social media and print supplements. Work with editorial and commercial teams on daily design requests.',
      requirements: 'Strong portfolio of editorial or media design work. Proficiency in Adobe Creative Suite. Ability to work quickly under editorial deadlines.',
      skills: ['Graphic Design', 'Adobe Photoshop', 'Illustrator', 'UI/UX Design'],
    },
    // Sanergy
    {
      companyIdx: 10, title: 'Community Health Officer', jobType: 'FULL_TIME',
      location: 'Mukuru, Nairobi', salaryMin: 50000, salaryMax: 75000, daysOld: 4,
      description: 'Engage with communities in Mukuru and other informal settlements to promote proper sanitation practices and conduct health education sessions. Work closely with local health authorities.',
      requirements: 'Diploma or degree in public health or community development. Experience working in informal settlements. Fluent in Swahili and English.',
      skills: ['Healthcare', 'Customer Service', 'Swahili', 'Research', 'Communication'],
    },
    {
      companyIdx: 10, title: 'Research and Impact Associate', jobType: 'CONTRACT',
      location: 'Mukuru, Nairobi', salaryMin: 65000, salaryMax: 95000, daysOld: 11,
      description: 'Design and implement surveys to measure the health and economic impact of Sanergy\'s sanitation products. Analyse data and write reports for donors and investors.',
      requirements: 'Degree in public health, economics or social sciences. Experience with quantitative data analysis. SPSS or Stata skills preferred.',
      skills: ['Research', 'Data Analysis', 'Excel', 'Communication'],
    },
    // Jumia
    {
      companyIdx: 11, title: 'Category Manager - Electronics', jobType: 'FULL_TIME',
      location: 'Parklands, Nairobi', salaryMin: 130000, salaryMax: 200000, daysOld: 5,
      description: 'Own the electronics category on Jumia Kenya. Negotiate vendor terms, optimise product assortment, drive category revenue and coordinate with marketing on promotions.',
      requirements: '3 years category or buying experience in retail or e-commerce. Strong negotiation and commercial acumen. Data-driven approach.',
      skills: ['Business Development', 'Sales', 'Data Analysis', 'Procurement', 'Excel'],
    },
    {
      companyIdx: 11, title: 'Digital Marketing Specialist', jobType: 'FULL_TIME',
      location: 'Parklands, Nairobi', salaryMin: 80000, salaryMax: 130000, daysOld: 9,
      description: 'Plan and execute performance marketing campaigns across Google, Meta and programmatic channels to drive Jumia traffic and orders. Own campaign budgets and report on ROI.',
      requirements: '2 years performance marketing. Google Ads and Meta Ads Manager proficiency required. Strong analytical skills.',
      skills: ['Digital Marketing', 'SEO', 'Social Media', 'Data Analysis'],
    },
    {
      companyIdx: 11, title: 'Junior Frontend Developer', jobType: 'INTERNSHIP',
      location: 'Parklands, Nairobi', salaryMin: 30000, salaryMax: 45000, daysOld: 0,
      description: 'Join the Jumia engineering team as an intern. Work on the Jumia Kenya web and mobile experience with guidance from senior engineers. Real code shipped from week one.',
      requirements: 'Currently pursuing or recently completed a Computer Science or related degree. Basic React or JavaScript knowledge. Eager to learn.',
      skills: ['JavaScript', 'React', 'HTML', 'Git', 'Communication'],
    },
    // KCB
    {
      companyIdx: 12, title: 'Head of Digital Banking', jobType: 'FULL_TIME',
      location: 'Kencom House, Nairobi', salaryMin: 350000, salaryMax: 550000, daysOld: 6,
      description: 'Lead KCB\'s digital banking transformation agenda. Own the KCB app and mobile banking platforms serving over 9 million customers. Drive product vision, team performance and revenue growth.',
      requirements: '8 years in banking with at least 4 in a digital or product leadership role. MBA preferred. Proven track record delivering digital banking products.',
      skills: ['Product Management', 'Leadership', 'Agile', 'Data Analysis', 'Communication'],
    },
    {
      companyIdx: 12, title: 'HR Business Partner', jobType: 'FULL_TIME',
      location: 'Kencom House, Nairobi', salaryMin: 130000, salaryMax: 200000, daysOld: 13,
      description: 'Partner with business units across KCB Group to provide strategic HR support. Handle talent management, performance management, employee relations and organisational design.',
      requirements: 'HR degree or IHRM qualification. 4 years HRBP experience in a large organisation. Strong understanding of Kenyan employment law.',
      skills: ['HR Management', 'Recruitment', 'Training & Development', 'Communication'],
    },
    {
      companyIdx: 12, title: 'Corporate Finance Associate', jobType: 'FULL_TIME',
      location: 'Kencom House, Nairobi', salaryMin: 150000, salaryMax: 230000, daysOld: 4,
      description: 'Support structured finance transactions including project finance, syndications and bond issuances across East Africa. Work alongside senior bankers on live deals.',
      requirements: 'CFA Level 2 or above preferred. Finance or economics degree. 2 years in investment banking, corporate finance or treasury.',
      skills: ['Financial Modelling', 'Excel', 'Accounting', 'Research'],
    },
    // Cellulant
    {
      companyIdx: 13, title: 'Solutions Architect', jobType: 'HYBRID',
      location: 'Kilimani, Nairobi', salaryMin: 250000, salaryMax: 400000, daysOld: 7,
      description: 'Design integration architectures for enterprise clients connecting to Cellulant\'s pan-African payment platform. Lead pre-sales technical discussions and own solution design documents.',
      requirements: '5 years software engineering. Strong understanding of payment systems and APIs. Excellent communication skills for client-facing technical discussions.',
      skills: ['REST APIs', 'Java', 'Node.js', 'Communication', 'AWS'],
    },
    {
      companyIdx: 13, title: 'Business Development Manager', jobType: 'FULL_TIME',
      location: 'Kilimani, Nairobi', salaryMin: 180000, salaryMax: 280000, daysOld: 10,
      description: 'Drive new enterprise and bank partnerships for Cellulant across East Africa. Own the full sales cycle from prospecting to close and manage C-level client relationships.',
      requirements: '4 years B2B sales in fintech or financial services. Existing network in banking or enterprise technology preferred.',
      skills: ['Business Development', 'Sales', 'Account Management', 'CRM', 'Communication'],
    },
    {
      companyIdx: 13, title: 'QA Engineer', jobType: 'FULL_TIME',
      location: 'Kilimani, Nairobi', salaryMin: 110000, salaryMax: 170000, daysOld: 2,
      description: 'Own quality assurance for Cellulant\'s payment platform. Design test strategies, write automated test suites and work with engineers to ship reliable payment infrastructure.',
      requirements: '3 years QA engineering. Experience with API testing and automated testing frameworks. Payment systems experience is a plus.',
      skills: ['JavaScript', 'Python', 'REST APIs', 'Git', 'SQL'],
    },
    // Watu Credit
    {
      companyIdx: 14, title: 'Credit Collections Officer', jobType: 'FULL_TIME',
      location: 'Mombasa Road, Nairobi', salaryMin: 55000, salaryMax: 85000, daysOld: 0,
      description: 'Manage a portfolio of defaulted motorcycle loan accounts. Engage customers to negotiate repayment plans and work with field agents on physical recovery where necessary.',
      requirements: '1 year collections or credit experience. Assertive communicator. Swahili fluency required.',
      skills: ['Customer Service', 'Communication', 'Swahili', 'CRM'],
    },
    {
      companyIdx: 14, title: 'Data Analyst', jobType: 'FULL_TIME',
      location: 'Mombasa Road, Nairobi', salaryMin: 90000, salaryMax: 140000, daysOld: 5,
      description: 'Analyse loan book performance, customer repayment behaviour and portfolio risk. Build dashboards and provide insights to the credit and operations leadership teams.',
      requirements: '2 years data analysis. Strong SQL and Excel. Power BI or Tableau experience preferred.',
      skills: ['Data Analysis', 'SQL', 'Excel', 'Power BI', 'Python'],
    },
    // Additional remote/contract/part-time variety
    {
      companyIdx: 7, title: 'Technical Writer', jobType: 'REMOTE',
      location: 'Remote (Kenya)', salaryMin: 80000, salaryMax: 120000, daysOld: 3,
      description: 'Write and maintain developer documentation for Africa\'s Talking APIs. Create tutorials, quick-start guides and API references that help developers integrate our products successfully.',
      requirements: 'Technical writing experience. Comfortable reading code. Excellent English writing skills. Experience documenting REST APIs preferred.',
      skills: ['Content Writing', 'Copywriting', 'REST APIs', 'Research'],
    },
    {
      companyIdx: 2, title: 'Flutter Mobile Developer', jobType: 'REMOTE',
      location: 'Remote (Africa)', salaryMin: 250000, salaryMax: 400000, daysOld: 8,
      description: 'Build cross-platform mobile applications for global technology clients through the Andela talent network. Deliver high-quality Flutter apps with clean architecture and thorough testing.',
      requirements: '3 years Flutter development. Strong Dart skills. Experience with state management solutions such as Riverpod or BLoC.',
      skills: ['Flutter', 'Kotlin', 'Swift', 'REST APIs', 'Git'],
    },
    {
      companyIdx: 9, title: 'Social Media Editor', jobType: 'PART_TIME',
      location: 'Remote (Nairobi)', salaryMin: 35000, salaryMax: 55000, daysOld: 2,
      description: 'Manage Nation Media Group social media channels. Create and schedule content, monitor engagement and respond to audience comments on Twitter, Instagram and Facebook.',
      requirements: 'Strong understanding of social media platforms. Good writing skills and news awareness. Experience with social media scheduling tools.',
      skills: ['Social Media', 'Content Writing', 'Copywriting', 'Communication'],
    },
    {
      companyIdx: 3, title: 'Legal Counsel', jobType: 'CONTRACT',
      location: 'Karen, Nairobi', salaryMin: 150000, salaryMax: 220000, daysOld: 6,
      description: 'Provide legal support across M-KOPA\'s operations in Kenya. Draft and review commercial contracts, advise on regulatory matters and support fundraising transactions.',
      requirements: 'LLB degree and Advocate of the High Court of Kenya. 3 years commercial legal experience. In-house experience at a technology or financial company preferred.',
      skills: ['Legal Research', 'Contract Drafting', 'Research', 'Communication'],
    },
    {
      companyIdx: 5, title: 'Events and Sponsorship Manager', jobType: 'FULL_TIME',
      location: 'Upperhill, Nairobi', salaryMin: 100000, salaryMax: 160000, daysOld: 11,
      description: 'Plan and execute NCBA Group brand events, sponsorships and activations across Kenya. Manage agency relationships and corporate sponsorship portfolio.',
      requirements: '3 years events management experience. Strong project management and budget management skills. Experience with corporate sponsorships is a plus.',
      skills: ['Events Management', 'Project Management', 'Operations', 'Communication'],
    },
    {
      companyIdx: 4, title: 'Procurement Officer', jobType: 'FULL_TIME',
      location: 'Industrial Area, Nairobi', salaryMin: 70000, salaryMax: 110000, daysOld: 7,
      description: 'Manage daily procurement of fresh produce from over 300 smallholder farmers. Negotiate prices, manage quality standards and ensure supply reliability for Twiga\'s distribution network.',
      requirements: 'Supply chain or agribusiness degree. 2 years procurement experience. Understanding of fresh produce supply chains preferred.',
      skills: ['Procurement', 'Supply Chain', 'Logistics', 'Excel', 'Communication'],
    },
    {
      companyIdx: 1, title: 'Compliance Officer', jobType: 'FULL_TIME',
      location: 'Upper Hill, Nairobi', salaryMin: 120000, salaryMax: 190000, daysOld: 4,
      description: 'Ensure Equity Bank\'s compliance with CBK regulations, AML/CFT requirements and internal policies. Review products and processes for regulatory alignment and manage regulatory relationships.',
      requirements: 'Law or finance degree. 3 years compliance experience in banking or financial services. Strong knowledge of CBK prudential guidelines.',
      skills: ['Legal Research', 'Research', 'Communication', 'Excel'],
    },
    {
      companyIdx: 8, title: 'Financial Analyst Intern', jobType: 'INTERNSHIP',
      location: 'Waiyaki Way, Nairobi', salaryMin: 25000, salaryMax: 40000, daysOld: 0,
      description: 'Support client engagements in financial advisory and transactions services. Build financial models, prepare information memorandums and assist with due diligence projects.',
      requirements: 'Pursuing a final year degree in Finance, Accounting or Economics. Strong Excel skills. Highly analytical with attention to detail.',
      skills: ['Financial Modelling', 'Excel', 'Accounting', 'Research'],
    },
    {
      companyIdx: 11, title: 'Logistics Coordinator', jobType: 'FULL_TIME',
      location: 'Parklands, Nairobi', salaryMin: 65000, salaryMax: 95000, daysOld: 3,
      description: 'Coordinate last-mile delivery operations for Jumia Kenya. Work with third-party logistics providers to ensure order fulfilment KPIs are met and handle escalations from customers and vendors.',
      requirements: '2 years logistics or operations experience in e-commerce. Strong Excel skills. Calm under pressure.',
      skills: ['Logistics', 'Supply Chain', 'Operations', 'Excel', 'Communication'],
    },
    {
      companyIdx: 0, title: 'Cybersecurity Engineer', jobType: 'FULL_TIME',
      location: 'Westlands, Nairobi', salaryMin: 200000, salaryMax: 320000, daysOld: 5,
      description: 'Protect Safaricom\'s critical infrastructure and customer data. Conduct security assessments, monitor for threats and lead incident response. Work on one of Africa\'s most critical digital platforms.',
      requirements: '4 years information security experience. CISSP or CEH certification preferred. Experience with telco or payments security is an advantage.',
      skills: ['AWS', 'Docker', 'Research', 'Communication', 'SQL'],
    },
    {
      companyIdx: 13, title: 'Payroll and HR Officer', jobType: 'FULL_TIME',
      location: 'Kilimani, Nairobi', salaryMin: 75000, salaryMax: 110000, daysOld: 8,
      description: 'Manage monthly payroll for Cellulant Kenya and handle day-to-day HR operations including recruitment, onboarding and employee relations.',
      requirements: 'HR or business degree. 2 years payroll and HR generalist experience. IHRM membership preferred.',
      skills: ['HR Management', 'Payroll', 'Recruitment', 'Excel'],
    },
    {
      companyIdx: 6, title: 'Software Engineer - Backend', jobType: 'HYBRID',
      location: 'Ngong Road, Nairobi', salaryMin: 130000, salaryMax: 210000, daysOld: 9,
      description: 'Build and improve Sendy\'s logistics platform serving thousands of businesses. Work on driver matching algorithms, route optimisation and integrations with enterprise clients.',
      requirements: '3 years backend experience. Node.js or Python. Experience with mapping APIs or logistics technology is a strong plus.',
      skills: ['Node.js', 'Python', 'PostgreSQL', 'Redis', 'Docker'],
    },
    {
      companyIdx: 10, title: 'Fundraising and Partnerships Manager', jobType: 'FULL_TIME',
      location: 'Mukuru, Nairobi', salaryMin: 120000, salaryMax: 190000, daysOld: 6,
      description: 'Lead grant writing, donor relations and strategic partnership development for Sanergy. Manage relationships with impact investors, foundations and development finance institutions.',
      requirements: '4 years fundraising or development experience in the NGO or impact enterprise sector. Exceptional writing skills. Track record securing significant grants.',
      skills: ['Business Development', 'Research', 'Content Writing', 'Communication'],
    },
    {
      companyIdx: 12, title: 'Branch Manager', jobType: 'FULL_TIME',
      location: 'Mombasa, Kenya', salaryMin: 160000, salaryMax: 250000, daysOld: 2,
      description: 'Lead the KCB Mombasa Main Branch team. Drive retail banking sales targets, ensure excellent customer service, manage branch operations and oversee staff performance.',
      requirements: 'Banking experience of at least 5 years with 2 in a supervisory role. Strong leadership and commercial skills.',
      skills: ['Leadership', 'Sales', 'Account Management', 'Operations', 'Communication'],
    },
    {
      companyIdx: 14, title: 'Marketing Communications Officer', jobType: 'FULL_TIME',
      location: 'Mombasa Road, Nairobi', salaryMin: 70000, salaryMax: 105000, daysOld: 7,
      description: 'Create and execute marketing campaigns for Watu Credit across digital and traditional channels. Write copy for ads, social media and customer communications.',
      requirements: '2 years marketing or communications experience. Strong copywriting skills. Experience with digital marketing tools.',
      skills: ['Digital Marketing', 'Copywriting', 'Social Media', 'Content Writing'],
    },
    {
      companyIdx: 3, title: 'UX Researcher', jobType: 'CONTRACT',
      location: 'Karen, Nairobi', salaryMin: 120000, salaryMax: 180000, daysOld: 4,
      description: 'Conduct qualitative and quantitative research to understand how M-KOPA customers in low-income communities use digital products. Translate findings into actionable product insights.',
      requirements: '3 years UX research experience. Experience doing fieldwork in underserved communities. Strong research design and analysis skills.',
      skills: ['Research', 'UI/UX Design', 'Data Analysis', 'Communication'],
    },
    {
      companyIdx: 7, title: 'Scrum Master', jobType: 'HYBRID',
      location: 'Westlands, Nairobi', salaryMin: 140000, salaryMax: 220000, daysOld: 13,
      description: 'Facilitate agile ceremonies and coach engineering teams at Africa\'s Talking. Remove blockers, improve team velocity and drive continuous improvement across the product delivery process.',
      requirements: 'CSM or PSM certification. 3 years as a Scrum Master in a technology company. Excellent facilitation and communication skills.',
      skills: ['Scrum', 'Agile', 'Project Management', 'Leadership', 'Communication'],
    },
  ];

  // ── Create all jobs ────────────────────────────────────────────────────────
  let jobCount = 0;
  for (const j of jobDefs) {
    const recruiter = recruiters[j.companyIdx % recruiters.length];
    const company = companies[j.companyIdx];

    const job = await prisma.job.create({
      data: {
        companyId: company.id,
        postedById: recruiter.id,
        title: j.title,
        description: j.description,
        requirements: j.requirements,
        location: j.location,
        jobType: j.jobType,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        currency: 'KES',
        status: 'ACTIVE',
        expiresAt: daysFrom(30),
        createdAt: daysAgo(j.daysOld),
      },
    });

    // Attach skills
    const validSkills = j.skills.filter(s => skillMap[s]);
    if (validSkills.length) {
      await prisma.jobSkill.createMany({
        data: validSkills.map(s => ({ jobId: job.id, skillId: skillMap[s] })),
        skipDuplicates: true,
      });
    }
    jobCount++;
  }

  // ── Demo job seekers ───────────────────────────────────────────────────────
  const seekerDefs = [
    { first: 'Amara', last: 'Osei', email: 'amara.osei@uteo-demo.ke', headline: 'Senior Software Engineer with 6 years in fintech', skills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'SQL'] },
    { first: 'Fatima', last: 'Diallo', email: 'fatima.diallo@uteo-demo.ke', headline: 'Digital Marketing Manager open to new opportunities', skills: ['Digital Marketing', 'SEO', 'Social Media', 'Copywriting', 'Data Analysis'] },
    { first: 'James', last: 'Mutua', email: 'james.mutua@uteo-demo.ke', headline: 'Finance professional CPA(K) with 5 years banking experience', skills: ['Accounting', 'Financial Modelling', 'Excel', 'Auditing', 'Tax'] },
    { first: 'Ciku', last: 'Wanjiru', email: 'ciku.wanjiru@uteo-demo.ke', headline: 'Product Manager building for emerging markets', skills: ['Product Management', 'Agile', 'Data Analysis', 'Communication', 'Research'] },
    { first: 'Tobias', last: 'Onyango', email: 'tobias.onyango@uteo-demo.ke', headline: 'Flutter developer 3 years cross-platform mobile', skills: ['Flutter', 'Kotlin', 'REST APIs', 'Git', 'SQL'] },
  ];

  for (const s of seekerDefs) {
    const user = await prisma.user.create({
      data: {
        email: s.email,
        passwordHash: seekerPw,
        firstName: s.first,
        lastName: s.last,
        role: 'CLIENT',
        emailVerified: true,
      },
    });

    await prisma.jobSeekerProfile.create({
      data: {
        userId: user.id,
        headline: s.headline,
        location: 'Nairobi, Kenya',
        openToWork: true,
      },
    });

    await prisma.userSkill.createMany({
      data: s.skills.filter(sk => skillMap[sk]).map(sk => ({
        userId: user.id,
        skillId: skillMap[sk],
        proficiency: 'ADVANCED',
      })),
      skipDuplicates: true,
    });
  }

  // ── Applications ──────────────────────────────────────────────────────────
  const allJobs = await prisma.job.findMany({ select: { id: true, title: true } });
  const allSeekers = await prisma.user.findMany({
    where: { email: { in: seekerDefs.map(s => s.email) } },
    select: { id: true },
  });

  // Weighted status distribution: INTERVIEW and SHORTLISTED prominent for demo
  const appStatuses: Array<'SUBMITTED' | 'REVIEWED' | 'SHORTLISTED' | 'INTERVIEW' | 'HIRED' | 'REJECTED'> = [
    'SUBMITTED', 'SUBMITTED', 'SUBMITTED', 'SUBMITTED',
    'REVIEWED', 'REVIEWED', 'REVIEWED',
    'SHORTLISTED', 'SHORTLISTED', 'SHORTLISTED',
    'INTERVIEW', 'INTERVIEW', 'INTERVIEW', 'INTERVIEW',
    'HIRED', 'HIRED',
    'REJECTED', 'REJECTED',
  ];

  let appCount = 0;
  for (const seeker of allSeekers) {
    const numApps = rndInt(8, 14);
    const shuffled = [...allJobs].sort(() => Math.random() - 0.5).slice(0, numApps);
    for (const job of shuffled) {
      const status = rnd(appStatuses);
      try {
        await prisma.application.create({
          data: {
            userId: seeker.id,
            jobId: job.id,
            status,
            coverLetter: `I am very excited to apply for the ${job.title} role. My background aligns closely with what you are looking for and I would welcome the chance to discuss further.`,
            appliedAt: daysAgo(rndInt(1, 25)),
          },
        });
        appCount++;
      } catch { /* skip duplicate */ }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n✅ Uteo seed complete`);
  console.log(`   Companies:   ${await prisma.company.count()}`);
  console.log(`   Jobs:        ${await prisma.job.count()}`);
  console.log(`   Skills:      ${await prisma.skill.count()}`);
  console.log(`   Recruiters:  ${recruiters.length}`);
  console.log(`   Job seekers: ${seekerDefs.length}`);
  console.log(`   Applications:${appCount}`);
  console.log(`\nDemo credentials:`);
  console.log(`   Recruiter:   michael.kariuki@uteo-demo.ke / Recruiter2026!`);
  console.log(`   Job seeker:  amara.osei@uteo-demo.ke / Seeker2026!`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
