/**
 * Uteo — Candidate seed
 * Adds 24 fully-loaded job seekers with avatars, profiles, skills and applications.
 * Safe to re-run: skips existing emails, skips duplicate applications.
 *
 * Run: npx ts-node prisma/seed-candidates.ts
 */
import { PrismaClient, ApplicationStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n: number) { return new Date(Date.now() - n * 86400_000); }

const STATUSES: ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED, ApplicationStatus.SUBMITTED, ApplicationStatus.SUBMITTED,
  ApplicationStatus.REVIEWED, ApplicationStatus.REVIEWED,
  ApplicationStatus.SHORTLISTED, ApplicationStatus.SHORTLISTED, ApplicationStatus.SHORTLISTED,
  ApplicationStatus.INTERVIEW, ApplicationStatus.INTERVIEW, ApplicationStatus.INTERVIEW,
  ApplicationStatus.HIRED,
  ApplicationStatus.REJECTED, ApplicationStatus.REJECTED,
];

// Real Unsplash portrait photo IDs — professional looking, diverse
const AVATARS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1525186402429-b4ff38bedec6?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1614283233556-f35b0c801ef1?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1590086782957-93c06ef21604?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1548544149-4835e62ee5b3?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1601412436009-d964bd02edbc?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1623582854588-d60de57fa33f?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1628157588553-5eeea00af15c?w=400&h=400&fit=crop&crop=face',
];

const CANDIDATES = [
  {
    first: 'Brian', last: 'Otieno', email: 'brian.otieno@uteo-demo.ke',
    headline: 'Senior React & Node.js Engineer — 6 years fintech',
    location: 'Westlands, Nairobi',
    bio: 'Full-stack engineer with deep fintech experience. Built payment systems processing billions in transactions. Passionate about clean architecture and developer experience.',
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'],
    matchedFor: ['Senior Software Engineer', 'Senior React Engineer', 'Full Stack Engineer - Node.js'],
  },
  {
    first: 'Grace', last: 'Akinyi', email: 'grace.akinyi@uteo-demo.ke',
    headline: 'Product Manager — Consumer & Fintech Products',
    location: 'Kilimani, Nairobi',
    bio: 'Product leader who has shipped features to 5M+ users. Previously at Safaricom and a YC-backed startup. I thrive at the intersection of user empathy and business strategy.',
    skills: ['Product Management', 'Agile', 'Data Analysis', 'Communication', 'Research', 'Figma'],
    matchedFor: ['Product Manager - M-PESA Super App', 'Head of Digital Banking'],
  },
  {
    first: 'Daniel', last: 'Mwangi', email: 'daniel.mwangi@uteo-demo.ke',
    headline: 'Flutter Developer — 4 years cross-platform mobile',
    location: 'Nairobi, Kenya',
    bio: 'Mobile engineer specialising in Flutter. Built apps with 500k+ downloads. Strong in clean architecture, Riverpod state management and CI/CD pipelines for mobile.',
    skills: ['Flutter', 'Kotlin', 'Swift', 'REST APIs', 'Git', 'Firebase'],
    matchedFor: ['Flutter Mobile Developer', 'Android Developer', 'Mobile Banking Developer'],
  },
  {
    first: 'Amina', last: 'Hassan', email: 'amina.hassan@uteo-demo.ke',
    headline: 'UX/Product Designer — Mobile-first, research-led',
    location: 'Westlands, Nairobi',
    bio: 'Designer who starts with user research and ends with shipped interfaces. 5 years designing fintech and e-commerce products across East Africa.',
    skills: ['UI/UX Design', 'Figma', 'Research', 'Graphic Design', 'Adobe Photoshop'],
    matchedFor: ['UI/UX Designer', 'UX Researcher'],
  },
  {
    first: 'Kevin', last: 'Kamau', email: 'kevin.kamau@uteo-demo.ke',
    headline: 'Data Scientist — ML & Analytics for business decisions',
    location: 'Karen, Nairobi',
    bio: 'Applied data scientist with 4 years building predictive models in financial services and agritech. Comfortable from data wrangling to model deployment in production.',
    skills: ['Python', 'Machine Learning', 'Data Analysis', 'SQL', 'Tableau', 'Power BI'],
    matchedFor: ['Data Scientist - IoT Analytics', 'Data Analyst', 'Python Data Engineer'],
  },
  {
    first: 'Sharon', last: 'Wanjiku', email: 'sharon.wanjiku@uteo-demo.ke',
    headline: 'Digital Marketing Lead — Growth & Performance',
    location: 'Parklands, Nairobi',
    bio: 'Growth marketer who has scaled B2C digital channels from scratch. Expert in paid media, SEO and email. Data-driven and creative in equal measure.',
    skills: ['Digital Marketing', 'SEO', 'Social Media', 'Copywriting', 'Data Analysis', 'Content Writing'],
    matchedFor: ['Digital Marketing Manager', 'Digital Marketing Specialist', 'Marketing Communications Officer'],
  },
  {
    first: 'Eric', last: 'Njoroge', email: 'eric.njoroge@uteo-demo.ke',
    headline: 'CPA(K) Finance Professional — Banking & Corporate Finance',
    location: 'Upper Hill, Nairobi',
    bio: 'Qualified accountant with 5 years across audit, corporate banking and treasury. Comfortable with complex financial modelling and stakeholder presentations.',
    skills: ['Accounting', 'Financial Modelling', 'Excel', 'Auditing', 'Tax', 'SQL'],
    matchedFor: ['Credit Risk Analyst', 'Internal Auditor', 'Corporate Finance Associate', 'Tax Consultant'],
  },
  {
    first: 'Zoe', last: 'Adhiambo', email: 'zoe.adhiambo@uteo-demo.ke',
    headline: 'Backend Engineer — Node.js & Distributed Systems',
    location: 'Nairobi, Kenya',
    bio: 'Engineer with a passion for high-throughput APIs and clean server-side code. Previously built telco and payments infrastructure at scale.',
    skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'Docker', 'REST APIs', 'AWS'],
    matchedFor: ['Backend Engineer - Telco APIs', 'Senior Software Engineer', 'Software Engineer - Backend'],
  },
  {
    first: 'Peter', last: 'Kimani', email: 'peter.kimani@uteo-demo.ke',
    headline: 'Sales & BD Manager — Enterprise SaaS & Fintech',
    location: 'Nairobi, Kenya',
    bio: 'Commercial leader with 6 years in B2B sales. Consistently exceeded quota by 130%+. I love building client relationships and closing complex deals.',
    skills: ['Sales', 'Business Development', 'Account Management', 'CRM', 'Communication'],
    matchedFor: ['Business Development Manager', 'Relationship Manager - SME Banking', 'Branch Manager'],
  },
  {
    first: 'Mercy', last: 'Odhiambo', email: 'mercy.odhiambo@uteo-demo.ke',
    headline: 'HR Business Partner — Talent & Organisational Development',
    location: 'Upperhill, Nairobi',
    bio: 'IHRM-certified HR professional with 5 years in HRBP roles at a large commercial bank. Expert in talent acquisition, performance management and employment law.',
    skills: ['HR Management', 'Recruitment', 'Training & Development', 'Payroll', 'Communication'],
    matchedFor: ['HR Business Partner', 'Payroll and HR Officer'],
  },
  {
    first: 'Ian', last: 'Cheruiyot', email: 'ian.cheruiyot@uteo-demo.ke',
    headline: 'Operations Manager — Logistics & Last-Mile Delivery',
    location: 'Nairobi, Kenya',
    bio: 'Operations leader who has managed teams of 50+ and city-level logistics for a leading delivery startup. Analytical, calm under pressure and obsessed with efficiency.',
    skills: ['Operations', 'Supply Chain', 'Logistics', 'Leadership', 'Excel', 'Data Analysis'],
    matchedFor: ['Operations Manager', 'Supply Chain Coordinator', 'Logistics Coordinator'],
  },
  {
    first: 'Brenda', last: 'Munyiri', email: 'brenda.munyiri@uteo-demo.ke',
    headline: 'Content & Copywriter — Brand Voice & SEO Content',
    location: 'Nairobi, Kenya',
    bio: 'Writer with a knack for turning complex topics into clear, compelling copy. 4 years across editorial, brand and performance copy for leading Kenyan media and brands.',
    skills: ['Content Writing', 'Copywriting', 'SEO', 'Social Media', 'Research'],
    matchedFor: ['Digital Journalist', 'Technical Writer', 'Social Media Editor'],
  },
  {
    first: 'Moses', last: 'Opiyo', email: 'moses.opiyo@uteo-demo.ke',
    headline: 'Java Backend Engineer — Payments & Microservices',
    location: 'Nairobi, Kenya',
    bio: 'Backend engineer who has built payment APIs and telco integrations serving millions of users. Strong in Java, Spring Boot and cloud-native architectures.',
    skills: ['Java', 'Docker', 'AWS', 'REST APIs', 'PostgreSQL', 'Redis'],
    matchedFor: ['Senior Software Engineer', 'Backend Engineer - Telco APIs', 'Solutions Architect'],
  },
  {
    first: 'Claire', last: 'Waweru', email: 'claire.waweru@uteo-demo.ke',
    headline: 'Management Consultant — Strategy & Finance',
    location: 'Waiyaki Way, Nairobi',
    bio: 'MBA graduate with 4 years consulting at a Big 4 firm. Delivered strategy and M&A engagements for clients in banking, telecoms and FMCG. Strong presenter and modeller.',
    skills: ['Financial Modelling', 'Excel', 'Research', 'Project Management', 'Communication', 'Data Analysis'],
    matchedFor: ['Management Consultant - Strategy', 'Risk Advisory Associate', 'Tax Consultant'],
  },
  {
    first: 'Frank', last: 'Oluoch', email: 'frank.oluoch@uteo-demo.ke',
    headline: 'DevOps & Cloud Engineer — AWS & Kubernetes',
    location: 'Nairobi, Kenya',
    bio: 'DevOps engineer with 5 years automating infrastructure and building CI/CD pipelines. AWS Certified. Love making deployments boring and reliable.',
    skills: ['AWS', 'Docker', 'Git', 'Python', 'PostgreSQL', 'Redis'],
    matchedFor: ['Senior Software Engineer', 'Cybersecurity Engineer', 'Python Data Engineer'],
  },
  {
    first: 'Joy', last: 'Ndung\'u', email: 'joy.ndungu@uteo-demo.ke',
    headline: 'Procurement & Supply Chain Professional',
    location: 'Industrial Area, Nairobi',
    bio: 'Supply chain specialist with experience in agri and FMCG sectors. Strong negotiation skills, ERP proficiency and a track record of reducing procurement costs.',
    skills: ['Procurement', 'Supply Chain', 'Logistics', 'Excel', 'Operations', 'Communication'],
    matchedFor: ['Procurement Officer', 'Supply Chain Coordinator', 'Logistics Coordinator'],
  },
  {
    first: 'Samuel', last: 'Mutua', email: 'samuel.mutua@uteo-demo.ke',
    headline: 'Full-stack Developer — React & Python',
    location: 'Nairobi, Kenya',
    bio: 'Self-taught developer who turned a passion for coding into a 4-year career. I build fast, accessible web apps using React on the frontend and Python/Django on the backend.',
    skills: ['Python', 'React', 'JavaScript', 'PostgreSQL', 'Git', 'REST APIs'],
    matchedFor: ['Junior Frontend Developer', 'Full Stack Engineer - Node.js', 'QA Engineer'],
  },
  {
    first: 'Hawa', last: 'Noor', email: 'hawa.noor@uteo-demo.ke',
    headline: 'Legal Counsel — Commercial & Regulatory Law',
    location: 'Nairobi, Kenya',
    bio: 'Advocate of the High Court with 4 years in commercial law. Experience in contracts, fintech regulation and corporate advisory. Fluent in English and Swahili.',
    skills: ['Legal Research', 'Contract Drafting', 'Research', 'Communication'],
    matchedFor: ['Legal Counsel', 'Compliance Officer', 'Risk Advisory Associate'],
  },
  {
    first: 'Victor', last: 'Kiprotich', email: 'victor.kiprotich@uteo-demo.ke',
    headline: 'Android Developer — Kotlin & MVVM Architecture',
    location: 'Nairobi, Kenya',
    bio: 'Android engineer with 4 years shipping apps in fintech and logistics. Strong in Kotlin, Jetpack Compose and offline-first architecture. Published 3 apps on Play Store.',
    skills: ['Kotlin', 'Java', 'Flutter', 'REST APIs', 'Git', 'SQL'],
    matchedFor: ['Android Developer', 'Mobile Banking Developer', 'Flutter Mobile Developer'],
  },
  {
    first: 'Lydia', last: 'Cherono', email: 'lydia.cherono@uteo-demo.ke',
    headline: 'Customer Success & Account Management Specialist',
    location: 'Nairobi, Kenya',
    bio: 'Customer-obsessed professional with 4 years managing enterprise SaaS accounts. Consistent renewal rates above 95%. I build relationships that last.',
    skills: ['Customer Success', 'Account Management', 'CRM', 'Communication', 'Sales'],
    matchedFor: ['Customer Success Executive', 'Relationship Manager - SME Banking'],
  },
  {
    first: 'Tom', last: 'Ngugi', email: 'tom.ngugi@uteo-demo.ke',
    headline: 'Scrum Master & Agile Coach — 5 years tech teams',
    location: 'Nairobi, Kenya',
    bio: 'CSM-certified Scrum Master who has coached engineering teams at startups and corporates. I remove blockers, improve team health and make delivery predictable.',
    skills: ['Scrum', 'Agile', 'Project Management', 'Leadership', 'Communication'],
    matchedFor: ['Scrum Master', 'Product Manager - M-PESA Super App'],
  },
  {
    first: 'Stella', last: 'Okoth', email: 'stella.okoth@uteo-demo.ke',
    headline: 'Data Analyst — Power BI, SQL & Business Intelligence',
    location: 'Nairobi, Kenya',
    bio: 'Analyst who turns raw data into decisions. Built BI dashboards tracking $50M+ portfolios. Equally comfortable writing complex SQL and presenting to the board.',
    skills: ['Data Analysis', 'SQL', 'Power BI', 'Tableau', 'Excel', 'Python'],
    matchedFor: ['Data Analyst', 'Credit Risk Analyst', 'Research and Impact Associate'],
  },
  {
    first: 'Alex', last: 'Odhiambo', email: 'alex.odhiambo@uteo-demo.ke',
    headline: 'Graphic Designer & Visual Storyteller',
    location: 'Nairobi, Kenya',
    bio: 'Designer with 5 years in media, advertising and brand. Fast, precise and able to work across print and digital. Strong illustration skills and a sharp eye for typography.',
    skills: ['Graphic Design', 'Adobe Photoshop', 'Illustrator', 'UI/UX Design', 'Video Editing'],
    matchedFor: ['Graphic Designer', 'UI/UX Designer'],
  },
  {
    first: 'Naomi', last: 'Waititu', email: 'naomi.waititu@uteo-demo.ke',
    headline: 'Events & Brand Activation Manager',
    location: 'Nairobi, Kenya',
    bio: 'Events professional who has delivered 100+ corporate events across East Africa. Strong in budget management, vendor negotiation and on-ground execution.',
    skills: ['Events Management', 'Project Management', 'Operations', 'Communication', 'Leadership'],
    matchedFor: ['Events and Sponsorship Manager', 'Operations Manager'],
  },
];

async function main() {
  console.log('🌱 Seeding 24 candidates with avatars and applications...');

  const pw = await bcrypt.hash('Seeker2026!', 12);

  // Fetch skill map
  const allSkills = await prisma.skill.findMany({ select: { id: true, name: true } });
  const skillMap: Record<string, string> = {};
  for (const s of allSkills) skillMap[s.name] = s.id;

  // Fetch all jobs for applications
  const allJobs = await prisma.job.findMany({ select: { id: true, title: true } });

  let created = 0;
  let appCount = 0;

  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i];

    // Skip if already exists
    const existing = await prisma.user.findUnique({ where: { email: c.email } });
    if (existing) {
      console.log(`  skip ${c.email} (exists)`);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email: c.email,
        passwordHash: pw,
        firstName: c.first,
        lastName: c.last,
        role: 'CLIENT',
        emailVerified: true,
        avatar: AVATARS[i % AVATARS.length],
      },
    });

    await prisma.jobSeekerProfile.create({
      data: {
        userId: user.id,
        headline: c.headline,
        location: c.location,
        bio: c.bio,
        openToWork: true,
      },
    });

    const validSkills = c.skills.filter(s => skillMap[s]);
    if (validSkills.length) {
      await prisma.userSkill.createMany({
        data: validSkills.map(s => ({
          userId: user.id,
          skillId: skillMap[s],
          proficiency: 'ADVANCED',
        })),
        skipDuplicates: true,
      });
    }

    // Apply to 10–16 jobs — prioritise jobs matching their role
    const matchedJobs = allJobs.filter(j =>
      c.matchedFor.some(title => j.title.toLowerCase().includes(title.toLowerCase().split(' ')[0]))
    );
    const otherJobs = allJobs.filter(j => !matchedJobs.find(m => m.id === j.id));
    const shuffledOthers = [...otherJobs].sort(() => Math.random() - 0.5);

    const targetJobs = [
      ...matchedJobs,
      ...shuffledOthers.slice(0, Math.max(0, rndInt(10, 16) - matchedJobs.length)),
    ].slice(0, 16);

    for (const job of targetJobs) {
      // Higher chance of good status for matched jobs
      const isMatch = matchedJobs.some(m => m.id === job.id);
      const statusPool: ApplicationStatus[] = isMatch
        ? [ApplicationStatus.SHORTLISTED, ApplicationStatus.SHORTLISTED, ApplicationStatus.INTERVIEW, ApplicationStatus.INTERVIEW, ApplicationStatus.INTERVIEW, ApplicationStatus.REVIEWED, ApplicationStatus.HIRED]
        : STATUSES;

      try {
        await prisma.application.create({
          data: {
            userId: user.id,
            jobId: job.id,
            status: rnd(statusPool),
            coverLetter: `I am excited to apply for the ${job.title} position. My background in ${c.skills.slice(0, 3).join(', ')} makes me a strong fit and I would welcome the opportunity to contribute to your team.`,
            appliedAt: daysAgo(rndInt(1, 20)),
          },
        });
        appCount++;
      } catch { /* skip duplicate */ }
    }

    created++;
    console.log(`  ✓ ${c.first} ${c.last}`);
  }

  console.log(`\n✅ Done — ${created} candidates created, ${appCount} applications`);
  console.log(`   Login any candidate with: <email> / Seeker2026!`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
