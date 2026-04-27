/**
 * Fix-seed: adds missing tech/professional skills, re-wires seeded candidate
 * userSkills, and patches recruiter jobs with matching skills.
 * Safe to re-run.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const NEW_SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS',
  'Python', 'Machine Learning', 'SQL', 'Tableau', 'Power BI', 'Redis', 'Java',
  'Flutter', 'Kotlin', 'Swift', 'Firebase', 'REST APIs', 'Git',
  'Figma', 'UI/UX Design', 'Adobe Photoshop', 'Illustrator', 'Video Editing',
  'Product Management', 'Data Analysis', 'Research', 'Agile', 'Scrum',
  'SEO', 'Social Media', 'Copywriting', 'Content Writing',
  'Accounting', 'Financial Modelling', 'Excel', 'Auditing', 'Tax',
  'Sales', 'Business Development', 'Account Management', 'CRM', 'Communication',
  'Recruitment', 'Training & Development', 'Payroll',
  'Operations', 'Supply Chain', 'Logistics',
  'Legal Research', 'Contract Drafting',
  'Events Management', 'Customer Success',
];

// Must match CANDIDATES array in seed-candidates.ts by email
const CANDIDATE_SKILLS: Record<string, string[]> = {
  'brian.otieno@uteo-demo.ke':    ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'],
  'grace.akinyi@uteo-demo.ke':    ['Product Management', 'Agile', 'Data Analysis', 'Communication', 'Research', 'Figma'],
  'daniel.mwangi@uteo-demo.ke':   ['Flutter', 'Kotlin', 'Swift', 'REST APIs', 'Git', 'Firebase'],
  'amina.hassan@uteo-demo.ke':    ['UI/UX Design', 'Figma', 'Research', 'Adobe Photoshop'],
  'kevin.kamau@uteo-demo.ke':     ['Python', 'Machine Learning', 'Data Analysis', 'SQL', 'Tableau', 'Power BI'],
  'sharon.wanjiku@uteo-demo.ke':  ['Digital Marketing', 'SEO', 'Social Media', 'Copywriting', 'Data Analysis', 'Content Writing'],
  'eric.njoroge@uteo-demo.ke':    ['Accounting', 'Financial Modelling', 'Excel', 'Auditing', 'Tax', 'SQL'],
  'zoe.adhiambo@uteo-demo.ke':    ['Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'Docker', 'REST APIs', 'AWS'],
  'peter.kimani@uteo-demo.ke':    ['Sales', 'Business Development', 'Account Management', 'CRM', 'Communication'],
  'mercy.odhiambo@uteo-demo.ke':  ['HR Management', 'Recruitment', 'Training & Development', 'Payroll', 'Communication'],
  'ian.cheruiyot@uteo-demo.ke':   ['Operations', 'Supply Chain', 'Logistics', 'Leadership', 'Excel', 'Data Analysis'],
  'brenda.munyiri@uteo-demo.ke':  ['Content Writing', 'Copywriting', 'SEO', 'Social Media', 'Research'],
  'moses.opiyo@uteo-demo.ke':     ['Java', 'Docker', 'AWS', 'REST APIs', 'PostgreSQL', 'Redis'],
  'claire.waweru@uteo-demo.ke':   ['Financial Modelling', 'Excel', 'Research', 'Project Management', 'Communication', 'Data Analysis'],
  'frank.oluoch@uteo-demo.ke':    ['AWS', 'Docker', 'Git', 'Python', 'PostgreSQL', 'Redis'],
  'joy.ndungu@uteo-demo.ke':      ['Procurement', 'Supply Chain', 'Logistics', 'Excel', 'Operations', 'Communication'],
  'samuel.mutua@uteo-demo.ke':    ['Python', 'React', 'JavaScript', 'PostgreSQL', 'Git', 'REST APIs'],
  'hawa.noor@uteo-demo.ke':       ['Legal Research', 'Contract Drafting', 'Research', 'Communication'],
  'victor.kiprotich@uteo-demo.ke': ['Kotlin', 'Java', 'Flutter', 'REST APIs', 'Git', 'SQL'],
  'lydia.cherono@uteo-demo.ke':   ['Customer Success', 'Account Management', 'CRM', 'Communication', 'Sales'],
  'tom.ngugi@uteo-demo.ke':       ['Scrum', 'Agile', 'Project Management', 'Leadership', 'Communication'],
  'stella.okoth@uteo-demo.ke':    ['Data Analysis', 'SQL', 'Power BI', 'Tableau', 'Excel', 'Python'],
  'alex.odhiambo@uteo-demo.ke':   ['Adobe Photoshop', 'Illustrator', 'UI/UX Design', 'Video Editing'],
  'naomi.waititu@uteo-demo.ke':   ['Events Management', 'Project Management', 'Operations', 'Communication', 'Leadership'],
};

// Map job title keywords → skills to attach (so per-job match score is meaningful)
const JOB_SKILL_MAP: { keywords: string[]; skills: string[] }[] = [
  { keywords: ['software', 'engineer', 'backend', 'full-stack', 'fullstack'], skills: ['JavaScript', 'TypeScript', 'Node.js', 'PostgreSQL', 'REST APIs', 'Docker'] },
  { keywords: ['react', 'frontend', 'web developer'], skills: ['JavaScript', 'TypeScript', 'React', 'Git', 'REST APIs'] },
  { keywords: ['flutter', 'mobile', 'android', 'ios'], skills: ['Flutter', 'Kotlin', 'Swift', 'REST APIs', 'Git'] },
  { keywords: ['data', 'analyst', 'analytics', 'bi'], skills: ['Data Analysis', 'SQL', 'Python', 'Power BI', 'Tableau'] },
  { keywords: ['data scientist', 'machine learning', 'ml'], skills: ['Python', 'Machine Learning', 'Data Analysis', 'SQL'] },
  { keywords: ['product manager', 'product owner'], skills: ['Product Management', 'Agile', 'Research', 'Communication', 'Figma'] },
  { keywords: ['designer', 'ux', 'ui', 'design'], skills: ['Figma', 'UI/UX Design', 'Research', 'Adobe Photoshop'] },
  { keywords: ['marketing', 'digital'], skills: ['Digital Marketing', 'SEO', 'Social Media', 'Content Writing', 'Data Analysis'] },
  { keywords: ['finance', 'treasury', 'accounting', 'auditor', 'credit', 'risk'], skills: ['Accounting', 'Financial Modelling', 'Excel', 'SQL', 'Data Analysis'] },
  { keywords: ['hr', 'human resource', 'payroll', 'talent'], skills: ['HR Management', 'Recruitment', 'Training & Development', 'Payroll', 'Communication'] },
  { keywords: ['sales', 'business development', 'bd manager', 'relationship manager'], skills: ['Sales', 'Business Development', 'CRM', 'Communication', 'Account Management'] },
  { keywords: ['operations', 'supply chain', 'logistics', 'procurement'], skills: ['Operations', 'Supply Chain', 'Logistics', 'Excel', 'Project Management'] },
  { keywords: ['devops', 'cloud', 'infrastructure', 'aws'], skills: ['AWS', 'Docker', 'Git', 'Python', 'Redis'] },
  { keywords: ['cybersecurity', 'security'], skills: ['Cybersecurity', 'Python', 'AWS', 'Docker'] },
  { keywords: ['content', 'writer', 'copywriter', 'journalist', 'editor'], skills: ['Content Writing', 'Copywriting', 'SEO', 'Research'] },
  { keywords: ['legal', 'counsel', 'lawyer', 'compliance'], skills: ['Legal Research', 'Contract Drafting', 'Research', 'Communication'] },
  { keywords: ['scrum', 'agile', 'project manager'], skills: ['Scrum', 'Agile', 'Project Management', 'Leadership', 'Communication'] },
  { keywords: ['events', 'activation'], skills: ['Events Management', 'Project Management', 'Operations', 'Communication'] },
];

function jobSkillsFor(title: string): string[] {
  const lower = title.toLowerCase();
  for (const entry of JOB_SKILL_MAP) {
    if (entry.keywords.some((k) => lower.includes(k))) return entry.skills;
  }
  return ['Leadership', 'Communication', 'Project Management'];
}

async function main() {
  console.log('🔧 Fixing candidate skills + job skills...\n');

  // 1. Upsert missing skills
  console.log('1/3 — Adding missing skills...');
  let skillsAdded = 0;
  for (const name of NEW_SKILLS) {
    const existing = await prisma.skill.findFirst({ where: { name } });
    if (!existing) {
      await prisma.skill.create({ data: { name } });
      skillsAdded++;
    }
  }
  console.log(`    ${skillsAdded} new skills added\n`);

  // Reload full skill map
  const allSkills = await prisma.skill.findMany({ select: { id: true, name: true } });
  const skillMap: Record<string, string> = {};
  for (const s of allSkills) skillMap[s.name] = s.id;

  // 2. Re-wire candidate userSkills
  console.log('2/3 — Wiring candidate skills...');
  let candidatesFixed = 0;
  for (const [email, skills] of Object.entries(CANDIDATE_SKILLS)) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.log(`    skip ${email} (not found)`); continue; }

    // Delete old userSkills and re-create
    await prisma.userSkill.deleteMany({ where: { userId: user.id } });

    const valid = skills.filter((s) => skillMap[s]);
    if (valid.length) {
      await prisma.userSkill.createMany({
        data: valid.map((s) => ({
          userId: user.id,
          skillId: skillMap[s],
          proficiency: 'ADVANCED',
        })),
        skipDuplicates: true,
      });
    }

    // Ensure profile is complete with openToWork
    await prisma.jobSeekerProfile.upsert({
      where: { userId: user.id },
      update: { openToWork: true },
      create: {
        userId: user.id,
        openToWork: true,
        headline: '',
        location: '',
      },
    });

    candidatesFixed++;
  }
  console.log(`    ${candidatesFixed} candidates fixed\n`);

  // 3. Update all jobs with matching skills
  console.log('3/3 — Patching job skills...');
  const jobs = await prisma.job.findMany({ select: { id: true, title: true } });
  let jobsPatched = 0;
  for (const job of jobs) {
    const targetSkillNames = jobSkillsFor(job.title);
    const targetSkillIds = targetSkillNames.filter((s) => skillMap[s]).map((s) => skillMap[s]);
    if (!targetSkillIds.length) continue;

    await prisma.jobSkill.deleteMany({ where: { jobId: job.id } });
    await prisma.jobSkill.createMany({
      data: targetSkillIds.map((skillId) => ({ jobId: job.id, skillId })),
      skipDuplicates: true,
    });
    jobsPatched++;
  }
  console.log(`    ${jobsPatched} jobs patched\n`);

  console.log('✅ All done!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
