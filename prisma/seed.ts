import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n: number) { return new Date(Date.now() - n * 86400_000); }
function hoursAgo(n: number) { return new Date(Date.now() - n * 3600_000); }
function daysFrom(n: number) { return new Date(Date.now() + n * 86400_000); }

async function main() {
  console.log('Seeding Uteo...');
  const pw = await bcrypt.hash('Admin2026!', 12);
  const recruiterPw = await bcrypt.hash('Recruiter2026!', 12);
  const seekerPw = await bcrypt.hash('Seeker2026!', 12);

  // ── Clear ALL tables (try/catch each — some tables may not exist on older migrations) ──
  const del = async (fn: () => Promise<any>) => { try { await fn(); } catch { /* table may not exist yet */ } };
  await del(() => prisma.scheduledReminder.deleteMany());
  await del(() => prisma.jobInteraction.deleteMany());
  await del(() => prisma.savedJob.deleteMany());
  await del(() => prisma.application.deleteMany());
  await del(() => prisma.jobSkill.deleteMany());
  await del(() => prisma.job.deleteMany());
  await del(() => prisma.recruiter.deleteMany());
  await del(() => prisma.company.deleteMany());
  await del(() => prisma.userSkill.deleteMany());
  await del(() => prisma.workExperience.deleteMany());
  await del(() => prisma.education.deleteMany());
  await del(() => prisma.jobSeekerProfile.deleteMany());
  await del(() => prisma.institutionalAffiliation.deleteMany());
  await del(() => prisma.questionAnswer.deleteMany());
  await del(() => prisma.lessonQuestion.deleteMany());
  await del(() => prisma.enrollment.deleteMany());
  await del(() => prisma.courseLesson.deleteMany());
  await del(() => prisma.course.deleteMany());
  await del(() => prisma.favorite.deleteMany());
  await del(() => prisma.department.deleteMany());
  await del(() => prisma.teamInvite.deleteMany());
  await del(() => prisma.teamMember.deleteMany());
  await del(() => prisma.commissionRecord.deleteMany());
  await del(() => prisma.escrowStatusLog.deleteMany());
  await del(() => prisma.escrowAccount.deleteMany());
  await del(() => prisma.bookingStatusLog.deleteMany());
  await del(() => prisma.dispute.deleteMany());
  await del(() => prisma.review.deleteMany());
  await del(() => prisma.booking.deleteMany());
  await del(() => prisma.ledgerEntry.deleteMany());
  await del(() => prisma.walletTransaction.deleteMany());
  await del(() => prisma.wallet.deleteMany());
  await del(() => prisma.payment.deleteMany());
  await del(() => prisma.subscription.deleteMany());
  await del(() => prisma.subscriptionPlan.deleteMany());
  await del(() => prisma.verificationRequest.deleteMany());
  await del(() => prisma.availabilitySlot.deleteMany());
  await del(() => prisma.certification.deleteMany());
  await del(() => prisma.trainerSkill.deleteMany());
  await del(() => prisma.trainerProfile.deleteMany());
  await del(() => prisma.skill.deleteMany());
  await del(() => prisma.category.deleteMany());
  await del(() => prisma.commissionRule.deleteMany());
  await del(() => prisma.message.deleteMany());
  await del(() => prisma.conversationParticipant.deleteMany());
  await del(() => prisma.conversation.deleteMany());
  await del(() => prisma.notification.deleteMany());
  await del(() => prisma.auditLog.deleteMany());
  await del(() => prisma.systemSetting.deleteMany());
  await del(() => prisma.passwordResetToken.deleteMany());
  await del(() => prisma.userSession.deleteMany());
  await del(() => prisma.user.deleteMany());

  // ── Categories (16) ────────────────────────────────────────────────────────
  const categoryDefs = [
    // Professional (white collar)
    { name: 'Business & Management', description: 'Corporate strategy, leadership, management consulting', icon: 'briefcase', trainerType: 'PROFESSIONAL', sortOrder: 1 },
    { name: 'Technology & IT', description: 'Software, data analytics, cybersecurity, digital transformation', icon: 'laptop', trainerType: 'PROFESSIONAL', sortOrder: 2 },
    { name: 'Finance & Accounting', description: 'Financial planning, accounting, investment, tax advisory', icon: 'banknote', trainerType: 'PROFESSIONAL', sortOrder: 3 },
    { name: 'Legal & Compliance', description: 'Legal training, regulatory compliance, governance', icon: 'scale', trainerType: 'PROFESSIONAL', sortOrder: 4 },
    { name: 'Healthcare & Medical', description: 'Medical training, nursing, pharmacy, public health', icon: 'heart', trainerType: 'PROFESSIONAL', sortOrder: 5 },
    { name: 'Education & Academia', description: 'Teaching methods, curriculum development, academic coaching', icon: 'book', trainerType: 'PROFESSIONAL', sortOrder: 6 },
    { name: 'Marketing & Communications', description: 'Digital marketing, branding, PR, content creation', icon: 'megaphone', trainerType: 'PROFESSIONAL', sortOrder: 7 },
    { name: 'Personal Development', description: 'Life coaching, public speaking, soft skills', icon: 'star', trainerType: null, sortOrder: 8 },
    // Vocational (blue collar)
    { name: 'Construction & Building', description: 'Masonry, plumbing, electrical, carpentry, welding', icon: 'hammer', trainerType: 'VOCATIONAL', sortOrder: 9 },
    { name: 'Automotive & Mechanics', description: 'Motor vehicle repair, body work, diagnostics', icon: 'wrench', trainerType: 'VOCATIONAL', sortOrder: 10 },
    { name: 'Beauty & Cosmetology', description: 'Hair styling, barbering, skincare, nail technology', icon: 'scissors', trainerType: 'VOCATIONAL', sortOrder: 11 },
    { name: 'Culinary & Hospitality', description: 'Cooking, baking, catering, hotel management', icon: 'utensils', trainerType: 'VOCATIONAL', sortOrder: 12 },
    { name: 'Agriculture & Farming', description: 'Crop farming, livestock, agribusiness, horticulture', icon: 'leaf', trainerType: 'VOCATIONAL', sortOrder: 13 },
    { name: 'Fashion & Textiles', description: 'Tailoring, fashion design, textile production', icon: 'shirt', trainerType: 'VOCATIONAL', sortOrder: 14 },
    { name: 'Electrical & Electronics', description: 'Electrical installation, solar, electronics repair', icon: 'zap', trainerType: 'VOCATIONAL', sortOrder: 15 },
    { name: 'Transport & Logistics', description: 'Driving, fleet management, supply chain', icon: 'truck', trainerType: 'VOCATIONAL', sortOrder: 16 },
  ];

  const categories = await Promise.all(
    categoryDefs.map((c) => prisma.category.create({ data: c })),
  );

  // Build a lookup map: category name -> id
  const catMap: Record<string, string> = {};
  for (const cat of categories) {
    catMap[cat.name] = cat.id;
  }

  // ── Skills (24) ───────────────────────────────────────────────────────────
  const skillDefs = [
    // Professional
    { name: 'Leadership', category: 'Business & Management', trainerType: 'PROFESSIONAL', description: 'Team leadership, executive coaching, organizational leadership' },
    { name: 'Project Management', category: 'Business & Management', trainerType: 'PROFESSIONAL', description: 'Planning, execution, and delivery of projects using modern methodologies' },
    { name: 'Strategic Planning', category: 'Business & Management', trainerType: 'PROFESSIONAL', description: 'Long-term business strategy, goal setting, competitive analysis' },
    { name: 'Data Analytics', category: 'Technology & IT', trainerType: 'PROFESSIONAL', description: 'Data analysis, visualization, and insight generation' },
    { name: 'Digital Marketing', category: 'Marketing & Communications', trainerType: 'PROFESSIONAL', description: 'SEO, social media, email campaigns, paid advertising' },
    { name: 'Financial Literacy', category: 'Finance & Accounting', trainerType: 'PROFESSIONAL', description: 'Personal finance, budgeting, investment, pension planning' },
    { name: 'HR Management', category: 'Business & Management', trainerType: 'PROFESSIONAL', description: 'Human resources policies, talent management, compliance' },
    { name: 'Agile/Scrum', category: 'Technology & IT', trainerType: 'PROFESSIONAL', description: 'Agile methodologies, Scrum framework, sprint planning' },
    { name: 'Public Speaking', category: 'Personal Development', trainerType: null, description: 'Presentation skills, rhetoric, audience engagement' },
    { name: 'Sales Training', category: 'Marketing & Communications', trainerType: 'PROFESSIONAL', description: 'Sales techniques, negotiation, client relationship management' },
    { name: 'Cybersecurity', category: 'Technology & IT', trainerType: 'PROFESSIONAL', description: 'Network security, threat analysis, compliance frameworks' },
    { name: 'Tax Advisory', category: 'Finance & Accounting', trainerType: 'PROFESSIONAL', description: 'Tax planning, KRA compliance, corporate tax strategies' },
    // Vocational
    { name: 'Plumbing', category: 'Construction & Building', trainerType: 'VOCATIONAL', description: 'Pipe fitting, water systems, drainage installation and repair' },
    { name: 'Electrical Wiring', category: 'Electrical & Electronics', trainerType: 'VOCATIONAL', description: 'Domestic and commercial electrical wiring, safety standards' },
    { name: 'Welding & Fabrication', category: 'Construction & Building', trainerType: 'VOCATIONAL', description: 'Arc welding, MIG/TIG, metal fabrication and joining' },
    { name: 'Motor Vehicle Repair', category: 'Automotive & Mechanics', trainerType: 'VOCATIONAL', description: 'Engine diagnostics, brake systems, suspension, body work' },
    { name: 'Hair Styling', category: 'Beauty & Cosmetology', trainerType: 'VOCATIONAL', description: 'Cutting, coloring, braiding, hair treatment techniques' },
    { name: 'Barbering', category: 'Beauty & Cosmetology', trainerType: 'VOCATIONAL', description: 'Men\'s grooming, clipper techniques, beard shaping' },
    { name: 'Professional Cooking', category: 'Culinary & Hospitality', trainerType: 'VOCATIONAL', description: 'Culinary techniques, menu planning, kitchen management' },
    { name: 'Tailoring & Fashion Design', category: 'Fashion & Textiles', trainerType: 'VOCATIONAL', description: 'Pattern making, sewing, garment construction, fashion design' },
    { name: 'Solar Installation', category: 'Electrical & Electronics', trainerType: 'VOCATIONAL', description: 'Solar panel installation, inverter setup, off-grid systems' },
    { name: 'Crop Farming', category: 'Agriculture & Farming', trainerType: 'VOCATIONAL', description: 'Crop cultivation, soil management, irrigation, pest control' },
    { name: 'Masonry & Construction', category: 'Construction & Building', trainerType: 'VOCATIONAL', description: 'Brick laying, plastering, concrete work, building construction' },
    { name: 'Driving & Fleet Management', category: 'Transport & Logistics', trainerType: 'VOCATIONAL', description: 'Professional driving, fleet operations, route planning' },
  ];

  const skills = await Promise.all(
    skillDefs.map((s) =>
      prisma.skill.create({ data: { name: s.name, category: s.category, trainerType: s.trainerType, description: s.description } }),
    ),
  );

  // Build a lookup map: skill name -> skill object
  const skillMap: Record<string, typeof skills[0]> = {};
  for (const sk of skills) {
    skillMap[sk.name] = sk;
  }

  // ── Subscription Plans (3) ────────────────────────────────────────────────
  const [planBasic, planPro, planEnterprise] = await Promise.all([
    prisma.subscriptionPlan.create({
      data: {
        name: 'Basic', price: 0, currency: 'KES', durationDays: 365,
        description: 'Free tier — basic marketplace visibility',
        features: ['Create trainer profile', 'Up to 10 bookings/month', 'Standard directory visibility', '10% platform commission', 'Email support'],
        sortOrder: 1,
      },
    }),
    prisma.subscriptionPlan.create({
      data: {
        name: 'Professional', price: 2500, currency: 'KES', durationDays: 30,
        description: '2,500 KES/month — priority listing, reduced commission',
        features: ['Unlimited bookings', 'Priority directory visibility', '7% platform commission', 'Verified badge', 'Analytics dashboard', 'Priority support'],
        sortOrder: 2,
      },
    }),
    prisma.subscriptionPlan.create({
      data: {
        name: 'Enterprise', price: 7500, currency: 'KES', durationDays: 30,
        description: '7,500 KES/month — premium features, lowest commission',
        features: ['Everything in Professional', 'Team management', '5% platform commission', 'Featured placement', 'API access', 'Dedicated account manager'],
        sortOrder: 3,
      },
    }),
  ]);

  // ── Commission Rules (2) ──────────────────────────────────────────────────
  const [ruleDefault, rulePremium] = await Promise.all([
    prisma.commissionRule.create({
      data: {
        name: 'Default (10%)', minAmount: 0, maxAmount: 999999999,
        commissionRate: 0.1, isActive: true,
      },
    }),
    prisma.commissionRule.create({
      data: {
        name: 'Premium Subscribers (7%)', minAmount: 0, maxAmount: 999999999,
        commissionRate: 0.07, subscriptionTier: 'Professional', isActive: true,
      },
    }),
  ]);

  // ── Super Admin ───────────────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      email: 'admin@uteo.com', phone: '+254700000001', passwordHash: pw,
      firstName: 'System', lastName: 'Admin', name: 'System Admin',
      role: 'SUPER_ADMIN', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      lastLoginAt: hoursAgo(2),
    },
  });
  await prisma.wallet.create({
    data: { userId: admin.id, balance: 0, currency: 'KES' },
  });

  // ── Finance Admin ─────────────────────────────────────────────────────────
  const financeAdmin = await prisma.user.create({
    data: {
      email: 'finance@uteo.com', phone: '+254700000004', passwordHash: pw,
      firstName: 'Finance', lastName: 'Admin', name: 'Finance Admin',
      role: 'FINANCE_ADMIN', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      lastLoginAt: hoursAgo(4),
    },
  });
  await prisma.wallet.create({
    data: { userId: financeAdmin.id, balance: 0, currency: 'KES' },
  });

  // ── Ops Admin ─────────────────────────────────────────────────────────────
  const opsAdmin = await prisma.user.create({
    data: {
      email: 'ops@uteo.com', phone: '+254700000005', passwordHash: pw,
      firstName: 'Ops', lastName: 'Admin', name: 'Ops Admin',
      role: 'ADMIN', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      lastLoginAt: hoursAgo(5),
    },
  });
  await prisma.wallet.create({
    data: { userId: opsAdmin.id, balance: 0, currency: 'KES' },
  });

  // ── Support Admin ─────────────────────────────────────────────────────────
  const supportAdmin = await prisma.user.create({
    data: {
      email: 'support@uteo.com', phone: '+254700000006', passwordHash: pw,
      firstName: 'Support', lastName: 'Admin', name: 'Support Admin',
      role: 'SUPPORT', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      lastLoginAt: hoursAgo(6),
    },
  });
  await prisma.wallet.create({
    data: { userId: supportAdmin.id, balance: 0, currency: 'KES' },
  });

  // ── Platform Wallets ──────────────────────────────────────────────────────
  // Note: platform wallets use the admin user as their holder
  // In production these would be system accounts

  // ── Test Trainer ──────────────────────────────────────────────────────────
  const trainerUser = await prisma.user.create({
    data: {
      email: 'benjamin.kakai@uteo-demo.ke', phone: '+254700000002', passwordHash: recruiterPw,
      firstName: 'Benjamin', lastName: 'Kakai', name: 'Benjamin Kakai',
      avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop&crop=face',
      role: 'TRAINER', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      lastLoginAt: hoursAgo(1),
    },
  });
  const trainerWallet = await prisma.wallet.create({
    data: { userId: trainerUser.id, balance: 25000, currency: 'KES' },
  });
  const trainerProfile = await prisma.trainerProfile.create({
    data: {
      userId: trainerUser.id,
      firmName: 'Kakai Talent Solutions',
      bio: 'Founder of Kakai Talent Solutions. 7+ years technical recruiting across East Africa. VERIFIED recruiter.',
      hourlyRate: 5000, currency: 'KES', rating: 4.8, totalReviews: 24,
      verificationStatus: 'VERIFIED', experience: 10,
      location: 'Nairobi, Kenya', city: 'Nairobi', county: 'Nairobi',
      specialization: 'Leadership & Project Management',
      languages: ['English', 'Swahili'],
      tier: 'CERTIFIED', trainerType: 'PROFESSIONAL', categoryId: catMap['Business & Management'],
      availableForOnline: true, availableForPhysical: true, availableForHybrid: true,
      portfolioUrl: 'https://janemuthoni.co.ke',
      linkedinUrl: 'https://linkedin.com/in/janemuthoni',
    },
  });

  // Add skills to trainer
  await prisma.trainerSkill.createMany({
    data: [
      { trainerId: trainerProfile.id, skillId: skillMap['Leadership'].id },
      { trainerId: trainerProfile.id, skillId: skillMap['Project Management'].id },
      { trainerId: trainerProfile.id, skillId: skillMap['Public Speaking'].id },
    ],
  });

  // Add certifications
  const janeCerts = await Promise.all([
    prisma.certification.create({
      data: { trainerId: trainerProfile.id, name: 'PMP', issuer: 'PMI', yearObtained: 2020, credentialType: 'LICENSE', verified: true, verifiedAt: daysAgo(60) },
    }),
    prisma.certification.create({
      data: { trainerId: trainerProfile.id, name: 'ICF Coach', issuer: 'ICF', yearObtained: 2022, credentialType: 'PROFESSIONAL_MEMBERSHIP', verified: true, verifiedAt: daysAgo(30) },
    }),
  ]);

  // Add availability (Mon-Fri 8am-5pm)
  await prisma.availabilitySlot.createMany({
    data: [1, 2, 3, 4, 5].map((d) => ({
      trainerId: trainerProfile.id,
      dayOfWeek: d,
      startTime: '08:00',
      endTime: '17:00',
      isActive: true,
    })),
  });

  // ── Test Client ───────────────────────────────────────────────────────────
  const clientUser = await prisma.user.create({
    data: {
      email: 'sienna.kaks@uteo-demo.ke', phone: '+254700000003', passwordHash: seekerPw,
      firstName: 'Sienna', lastName: 'Kaks', name: 'Sienna Kaks',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
      role: 'CLIENT', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      lastLoginAt: hoursAgo(3),
    },
  });
  const clientWallet = await prisma.wallet.create({
    data: { userId: clientUser.id, balance: 100000, currency: 'KES' },
  });

  // ── Additional Professional Trainers (5 more) ──────────────────────────────
  const extraTrainers = [
    { email: 'michael.kariuki@uteo-demo.ke', phone: '+254700000010', first: 'Michael', last: 'Kariuki', city: 'Mombasa', county: 'Mombasa', spec: 'Digital Marketing', rate: 4000, rating: 4.5, tier: 'EXPERIENCED' as const, type: 'PROFESSIONAL' as const, category: 'Marketing & Communications', skillNames: ['Digital Marketing', 'Sales Training'], avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face' },
    { email: 'winnie.achieng@uteo-demo.ke', phone: '+254700000011', first: 'Winnie', last: 'Achieng', city: 'Nakuru', county: 'Nakuru', spec: 'Data Analytics', rate: 6000, rating: 4.9, tier: 'CERTIFIED' as const, type: 'PROFESSIONAL' as const, category: 'Technology & IT', skillNames: ['Data Analytics', 'Agile/Scrum'], avatar: 'https://images.unsplash.com/photo-1589156229687-496a31ad1d1f?w=200&h=200&fit=crop&crop=face' },
    { email: 'kevin.mwangi@uteo-demo.ke', phone: '+254700000012', first: 'Kevin', last: 'Mwangi', city: 'Nairobi', county: 'Nairobi', spec: 'Financial Literacy', rate: 3500, rating: 4.2, tier: 'EXPERIENCED' as const, type: 'PROFESSIONAL' as const, category: 'Finance & Accounting', skillNames: ['Financial Literacy', 'Tax Advisory'], avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face' },
    { email: 'recruiter4@uteo-demo.ke', phone: '+254700000013', first: 'Faith', last: 'Wambui', city: 'Nairobi', county: 'Nairobi', spec: 'HR Management', rate: 5500, rating: 4.7, tier: 'CERTIFIED' as const, type: 'PROFESSIONAL' as const, category: 'Business & Management', skillNames: ['HR Management', 'Leadership'], avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face' },
    { email: 'recruiter5@uteo-demo.ke', phone: '+254700000014', first: 'Kofi', last: 'Asante', city: 'Eldoret', county: 'Uasin Gishu', spec: 'Sales Training', rate: 3000, rating: 4.0, tier: 'EXPERIENCED' as const, type: 'PROFESSIONAL' as const, category: 'Marketing & Communications', skillNames: ['Sales Training', 'Public Speaking'], avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face' },
  ];

  const trainerUsers: any[] = [trainerUser];
  const trainerProfiles: any[] = [trainerProfile];
  for (const t of extraTrainers) {
    const u = await prisma.user.create({
      data: {
        email: t.email, phone: t.phone, passwordHash: recruiterPw,
        firstName: t.first, lastName: t.last, name: `${t.first} ${t.last}`,
        avatar: (t as any).avatar || null,
        role: 'TRAINER', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
        lastLoginAt: daysAgo(rndInt(0, 5)),
      },
    });
    await prisma.wallet.create({ data: { userId: u.id, balance: rndInt(5000, 50000), currency: 'KES' } });
    const profile = await prisma.trainerProfile.create({
      data: {
        userId: u.id, bio: `${t.spec} specialist based in ${t.city}, Kenya.`,
        hourlyRate: t.rate, currency: 'KES', rating: t.rating, totalReviews: rndInt(5, 30),
        verificationStatus: 'VERIFIED', experience: rndInt(3, 15),
        location: `${t.city}, Kenya`, city: t.city, county: t.county,
        specialization: t.spec, languages: ['English', 'Swahili'],
        tier: t.tier, trainerType: t.type, categoryId: catMap[t.category],
        availableForOnline: true, availableForPhysical: rndInt(0, 1) === 1,
        availableForHybrid: rndInt(0, 1) === 1,
      },
    });
    await prisma.trainerSkill.createMany({
      data: t.skillNames.map((sn) => ({ trainerId: profile.id, skillId: skillMap[sn].id })),
    });
    await prisma.availabilitySlot.createMany({
      data: [1, 2, 3, 4, 5].map((d) => ({ trainerId: profile.id, dayOfWeek: d, startTime: '09:00', endTime: '17:00' })),
    });
    trainerUsers.push(u);
    trainerProfiles.push(profile);
  }

  // Add certification for Grace Njeri (MSc Data Science)
  const graceProfile = trainerProfiles[2]; // index 0=Jane, 1=Peter, 2=Grace
  const graceCert = await prisma.certification.create({
    data: { trainerId: graceProfile.id, name: 'MSc Data Science', issuer: 'University of Nairobi', yearObtained: 2019, credentialType: 'DEGREE', verified: true, verifiedAt: daysAgo(45) },
  });

  // ── Vocational Trainers (4 new) ───────────────────────────────────────────
  const vocationalTrainers = [
    { email: 'joseph@uteo-demo.ke', phone: '+254700000030', first: 'Joseph', last: 'Kipchoge', city: 'Thika', county: 'Kiambu', spec: 'Welding & Fabrication', rate: 1500, rating: 4.6, tier: 'CERTIFIED' as const, type: 'VOCATIONAL' as const, category: 'Construction & Building', skillNames: ['Welding & Fabrication', 'Masonry & Construction'], avatar: 'https://images.unsplash.com/photo-1548544149-4835e62ee5b3?w=200&h=200&fit=crop&crop=face' },
    { email: 'mary@uteo-demo.ke', phone: '+254700000031', first: 'Mary', last: 'Akinyi', city: 'Nairobi', county: 'Nairobi', spec: 'Hair Styling & Beauty', rate: 2000, rating: 4.8, tier: 'EXPERIENCED' as const, type: 'VOCATIONAL' as const, category: 'Beauty & Cosmetology', skillNames: ['Hair Styling', 'Barbering'], avatar: 'https://images.unsplash.com/photo-1611432579699-484f7990b127?w=200&h=200&fit=crop&crop=face' },
    { email: 'james@uteo-demo.ke', phone: '+254700000032', first: 'James', last: 'Wafula', city: 'Nakuru', county: 'Nakuru', spec: 'Electrical Installation', rate: 2500, rating: 4.4, tier: 'CERTIFIED' as const, type: 'VOCATIONAL' as const, category: 'Electrical & Electronics', skillNames: ['Electrical Wiring', 'Solar Installation'], avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&h=200&fit=crop&crop=face' },
    { email: 'agnes@uteo-demo.ke', phone: '+254700000033', first: 'Agnes', last: 'Chebet', city: 'Eldoret', county: 'Uasin Gishu', spec: 'Professional Cooking & Catering', rate: 1800, rating: 4.7, tier: 'EXPERIENCED' as const, type: 'VOCATIONAL' as const, category: 'Culinary & Hospitality', skillNames: ['Professional Cooking'], avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face' },
  ];

  const vocProfiles: any[] = [];
  for (const t of vocationalTrainers) {
    const u = await prisma.user.create({
      data: {
        email: t.email, phone: t.phone, passwordHash: recruiterPw,
        firstName: t.first, lastName: t.last, name: `${t.first} ${t.last}`,
        avatar: (t as any).avatar || null,
        role: 'TRAINER', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
        lastLoginAt: daysAgo(rndInt(0, 5)),
      },
    });
    await prisma.wallet.create({ data: { userId: u.id, balance: rndInt(3000, 30000), currency: 'KES' } });
    const profile = await prisma.trainerProfile.create({
      data: {
        userId: u.id, bio: `${t.spec} trainer based in ${t.city}, Kenya. Hands-on practical training for aspiring artisans.`,
        hourlyRate: t.rate, currency: 'KES', rating: t.rating, totalReviews: rndInt(8, 40),
        verificationStatus: 'VERIFIED', experience: rndInt(5, 20),
        location: `${t.city}, Kenya`, city: t.city, county: t.county,
        specialization: t.spec, languages: ['English', 'Swahili'],
        tier: t.tier, trainerType: t.type, categoryId: catMap[t.category],
        availableForOnline: false, availableForPhysical: true,
        availableForHybrid: false,
      },
    });
    await prisma.trainerSkill.createMany({
      data: t.skillNames.map((sn) => ({ trainerId: profile.id, skillId: skillMap[sn].id })),
    });
    // Vocational trainers typically available Mon-Sat
    await prisma.availabilitySlot.createMany({
      data: [1, 2, 3, 4, 5, 6].map((d) => ({ trainerId: profile.id, dayOfWeek: d, startTime: '07:00', endTime: '16:00' })),
    });
    trainerUsers.push(u);
    vocProfiles.push(profile);
  }

  // ── Vocational Certifications ─────────────────────────────────────────────
  // Joseph Kipchoge
  const josephCerts = await Promise.all([
    prisma.certification.create({
      data: { trainerId: vocProfiles[0].id, name: 'NITA Welding Certificate', issuer: 'NITA Kenya', yearObtained: 2018, credentialType: 'TRADE_CERTIFICATE', verified: true, verifiedAt: daysAgo(90) },
    }),
    prisma.certification.create({
      data: { trainerId: vocProfiles[0].id, name: 'Kenya Welders Association', issuer: 'KWA', yearObtained: 2020, credentialType: 'PROFESSIONAL_MEMBERSHIP', verified: false },
    }),
  ]);

  // Mary Akinyi
  const maryCert = await prisma.certification.create({
    data: { trainerId: vocProfiles[1].id, name: 'Beauty & Cosmetology Diploma', issuer: 'Vera Beauty College', yearObtained: 2017, credentialType: 'DIPLOMA', verified: true, verifiedAt: daysAgo(120) },
  });

  // James Wafula
  const jamesCerts = await Promise.all([
    prisma.certification.create({
      data: { trainerId: vocProfiles[2].id, name: 'KPLC Licensed Electrician', issuer: 'Kenya Power & Lighting', yearObtained: 2016, credentialType: 'LICENSE', verified: true, verifiedAt: daysAgo(75) },
    }),
    prisma.certification.create({
      data: { trainerId: vocProfiles[2].id, name: 'EPRA Solar Installer Cert', issuer: 'EPRA', yearObtained: 2021, credentialType: 'TRADE_CERTIFICATE', verified: true, verifiedAt: daysAgo(50) },
    }),
  ]);

  // Agnes Chebet
  const agnesCerts = await Promise.all([
    prisma.certification.create({
      data: { trainerId: vocProfiles[3].id, name: 'Culinary Arts Certificate', issuer: 'Utalii College', yearObtained: 2019, credentialType: 'CERTIFICATE', verified: false },
    }),
    prisma.certification.create({
      data: { trainerId: vocProfiles[3].id, name: 'Portfolio of catering events', issuer: 'Self', yearObtained: 2023, credentialType: 'PORTFOLIO', verified: false },
    }),
  ]);

  // ── Verification Requests (4) ─────────────────────────────────────────────
  // 2 approved, 1 pending, 1 rejected
  await prisma.verificationRequest.create({
    data: {
      trainerId: trainerProfile.id, documentType: 'PMP Certificate',
      documentUrl: 'https://storage.uteo.com/docs/jane-pmp.pdf',
      status: 'APPROVED', reviewNote: 'PMP credential verified with PMI registry.',
      reviewedById: admin.id, reviewedAt: daysAgo(60),
    },
  });
  await prisma.verificationRequest.create({
    data: {
      trainerId: vocProfiles[2].id, documentType: 'KPLC Electrician License',
      documentUrl: 'https://storage.uteo.com/docs/james-kplc.pdf',
      status: 'APPROVED', reviewNote: 'License number confirmed with KPLC records.',
      reviewedById: admin.id, reviewedAt: daysAgo(75),
    },
  });
  await prisma.verificationRequest.create({
    data: {
      trainerId: vocProfiles[0].id, documentType: 'Kenya Welders Association Membership',
      documentUrl: 'https://storage.uteo.com/docs/joseph-kwa.pdf',
      status: 'PENDING',
    },
  });
  await prisma.verificationRequest.create({
    data: {
      trainerId: vocProfiles[3].id, documentType: 'Culinary Arts Certificate',
      documentUrl: 'https://storage.uteo.com/docs/agnes-culinary.pdf',
      status: 'REJECTED', reviewNote: 'Document image is blurry and unreadable. Please re-upload a clear scan.',
      reviewedById: admin.id, reviewedAt: daysAgo(10),
    },
  });

  // ── Additional Clients / Job Seekers ─────────────────────────────────────
  // Named seekers from PASSWORDS.md plus a few extras
  const namedSeekerDefs = [
    {
      email: 'amara.osei@uteo-demo.ke', phone: '+254700000023', first: 'Amara', last: 'Osei',
      avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop&crop=face',
      headline: 'Senior Software Engineer', location: 'Nairobi, Kenya',
      bio: 'Full-stack engineer with 6 years in fintech. Passionate about building scalable payment systems across East Africa.',
      phone_display: '+254 712 345 678', portfolioUrl: 'https://amara.dev',
      skills: ['Data Analytics', 'Agile/Scrum', 'Cybersecurity'],
      exp: [
        { company: 'Cellulant', title: 'Senior Software Engineer', location: 'Nairobi', start: new Date('2021-03-01'), isCurrent: true, desc: 'Lead engineer for Pan-African payment orchestration platform. 3M+ daily transactions.' },
        { company: 'Jumo', title: 'Software Engineer', location: 'Cape Town / Remote', start: new Date('2018-06-01'), end: new Date('2021-02-28'), desc: 'Built microservices for mobile lending products across 8 African markets.' },
      ],
      edu: [{ inst: 'University of Nairobi', degree: 'BSc Computer Science', field: 'Computer Science', start: 2014, end: 2018 }],
    },
    {
      email: 'fatima.diallo@uteo-demo.ke', phone: '+254700000024', first: 'Fatima', last: 'Diallo',
      avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&h=200&fit=crop&crop=face',
      headline: 'Digital Marketing Manager', location: 'Nairobi, Kenya',
      bio: 'Award-winning digital marketing professional specialising in brand growth and performance marketing for FMCG brands.',
      phone_display: '+254 720 456 789', portfolioUrl: 'https://fatima-portfolio.co.ke',
      skills: ['Digital Marketing', 'Sales Training', 'Public Speaking'],
      exp: [
        { company: 'Unilever East Africa', title: 'Digital Marketing Manager', location: 'Nairobi', start: new Date('2022-01-01'), isCurrent: true, desc: 'Lead digital campaigns across 6 East African markets. 140% YoY growth in online revenue.' },
        { company: 'Ogilvy Kenya', title: 'Senior Brand Strategist', location: 'Nairobi', start: new Date('2019-04-01'), end: new Date('2021-12-31'), desc: 'Led brand strategy for EABL, Safaricom, and Equity Bank accounts.' },
      ],
      edu: [{ inst: 'Strathmore University', degree: 'BA Business Administration', field: 'Marketing', start: 2015, end: 2019 }],
    },
    {
      email: 'james.mutua@uteo-demo.ke', phone: '+254700000025', first: 'James', last: 'Mutua',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face',
      headline: 'Finance & Treasury Analyst', location: 'Nairobi, Kenya',
      bio: 'CPA(K) qualified finance professional with 5 years in commercial banking. Expert in financial modelling and risk analysis.',
      phone_display: '+254 733 567 890', portfolioUrl: null,
      skills: ['Financial Literacy', 'Tax Advisory', 'Strategic Planning'],
      exp: [
        { company: 'KCB Bank Kenya', title: 'Treasury Analyst', location: 'Nairobi', start: new Date('2020-07-01'), isCurrent: true, desc: 'FX trading desk, liquidity management, and regulatory reporting (CBK).' },
        { company: 'Equity Bank', title: 'Financial Analyst', location: 'Nairobi', start: new Date('2018-01-01'), end: new Date('2020-06-30'), desc: 'Credit risk analysis, loan portfolio modelling, IFRS 9 provisions.' },
      ],
      edu: [
        { inst: 'University of Nairobi', degree: 'BCom Finance', field: 'Finance', start: 2014, end: 2018 },
        { inst: 'ICPAK', degree: 'CPA(K)', field: 'Accounting', start: 2018, end: 2020 },
      ],
    },
    {
      email: 'ciku.wanjiru@uteo-demo.ke', phone: '+254700000026', first: 'Ciku', last: 'Wanjiru',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face',
      headline: 'HR & People Operations Lead', location: 'Nairobi, Kenya',
      bio: 'CHRP-certified HR professional with 7 years shaping people strategy at fast-growing startups and corporates across Kenya.',
      phone_display: '+254 701 678 901', portfolioUrl: null,
      skills: ['HR Management', 'Leadership', 'Project Management'],
      exp: [
        { company: 'Twiga Foods', title: 'Head of People Operations', location: 'Nairobi', start: new Date('2021-09-01'), isCurrent: true, desc: 'Built HR function from 80 to 400 employees. Designed performance management and L&D frameworks.' },
        { company: 'Jumia Kenya', title: 'HR Business Partner', location: 'Nairobi', start: new Date('2018-03-01'), end: new Date('2021-08-31'), desc: 'Partnered with engineering and ops leadership on talent acquisition and retention.' },
      ],
      edu: [{ inst: 'USIU-Africa', degree: 'BA Human Resource Management', field: 'HR Management', start: 2014, end: 2018 }],
    },
  ];

  const extraClients = [
    { email: 'alice@company.co.ke', phone: '+254700000020', first: 'Alice', last: 'Munene', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face' },
    { email: 'brian@startup.io', phone: '+254700000021', first: 'Brian', last: 'Otieno', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=face' },
    { email: 'sylvia@ngo.org', phone: '+254700000022', first: 'Sylvia', last: 'Wambua', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face' },
  ];

  const clientUsers: any[] = [clientUser];

  // Create named seekers with rich profiles
  const namedSeekerUsers: any[] = [];
  for (const ns of namedSeekerDefs) {
    const u = await prisma.user.create({
      data: {
        email: ns.email, phone: ns.phone, passwordHash: seekerPw,
        firstName: ns.first, lastName: ns.last, name: `${ns.first} ${ns.last}`,
        avatar: ns.avatar, role: 'CLIENT', status: 'ACTIVE',
        emailVerified: true, phoneVerified: true, lastLoginAt: daysAgo(rndInt(0, 3)),
      },
    });
    await prisma.wallet.create({ data: { userId: u.id, balance: rndInt(5000, 50000), currency: 'KES' } });
    await prisma.jobSeekerProfile.create({
      data: {
        userId: u.id, headline: ns.headline, bio: ns.bio, location: ns.location,
        phone: ns.phone_display, portfolioUrl: ns.portfolioUrl ?? null, openToWork: true,
        linkedinUrl: `https://linkedin.com/in/${ns.first.toLowerCase()}-${ns.last.toLowerCase()}`,
      },
    });
    for (const ex of ns.exp) {
      await prisma.workExperience.create({
        data: {
          userId: u.id, company: ex.company, title: ex.title, location: ex.location,
          startDate: ex.start, endDate: (ex as any).end ?? null,
          isCurrent: (ex as any).isCurrent ?? false, description: ex.desc,
        },
      });
    }
    for (const ed of ns.edu) {
      await prisma.education.create({
        data: {
          userId: u.id, institution: ed.inst, degree: ed.degree,
          fieldOfStudy: ed.field, startYear: ed.start, endYear: ed.end,
        },
      });
    }
    for (const sn of ns.skills) {
      if (skillMap[sn]) {
        await prisma.userSkill.upsert({
          where: { userId_skillId: { userId: u.id, skillId: skillMap[sn].id } },
          update: {}, create: { userId: u.id, skillId: skillMap[sn].id, proficiency: 'ADVANCED' },
        });
      }
    }
    namedSeekerUsers.push(u);
    clientUsers.push(u);
  }

  // Sienna Kaks — full profile
  await prisma.jobSeekerProfile.create({
    data: {
      userId: clientUser.id,
      headline: 'Digital Marketing Specialist',
      bio: '4+ years helping brands grow their digital presence across East Africa. Specialise in performance marketing, content strategy, and social media campaigns.',
      location: 'Nairobi, Kenya', phone: '+254 722 100 200',
      portfolioUrl: 'https://sienna.co.ke', openToWork: true,
      linkedinUrl: 'https://linkedin.com/in/sienna-kaks',
      githubUrl: null,
      resumeUrl: 'https://storage.uteo.com/resumes/sienna-kaks-cv.pdf',
    },
  });
  await prisma.workExperience.createMany({
    data: [
      { userId: clientUser.id, company: 'WPP Scangroup', title: 'Digital Marketing Specialist', location: 'Nairobi', startDate: new Date('2022-02-01'), isCurrent: true, description: 'Lead performance marketing for FMCG clients. Managed KES 20M+ annual ad spend across Meta, Google, and TikTok.' },
      { userId: clientUser.id, company: 'Nation Media Group', title: 'Marketing Coordinator', location: 'Nairobi', startDate: new Date('2020-06-01'), endDate: new Date('2022-01-31'), description: 'Coordinated digital campaigns for NTV, Daily Nation, and QTV brands.' },
      { userId: clientUser.id, company: 'JWT Kenya', title: 'Marketing Intern', location: 'Nairobi', startDate: new Date('2019-09-01'), endDate: new Date('2020-05-31'), description: 'Supported creative production and social media management for Kenyan brands.' },
    ],
  });
  await prisma.education.createMany({
    data: [
      { userId: clientUser.id, institution: 'University of Nairobi', degree: 'BA Marketing', fieldOfStudy: 'Marketing & Communications', startYear: 2015, endYear: 2019 },
      { userId: clientUser.id, institution: 'Google', degree: 'Google Digital Marketing Certificate', fieldOfStudy: 'Digital Marketing', startYear: 2020, endYear: 2020 },
    ],
  });
  for (const sn of ['Digital Marketing', 'Sales Training', 'Public Speaking', 'HR Management']) {
    if (skillMap[sn]) {
      await prisma.userSkill.upsert({
        where: { userId_skillId: { userId: clientUser.id, skillId: skillMap[sn].id } },
        update: {}, create: { userId: clientUser.id, skillId: skillMap[sn].id, proficiency: sn === 'Digital Marketing' ? 'EXPERT' : 'ADVANCED' },
      });
    }
  }

  for (const c of extraClients) {
    const u = await prisma.user.create({
      data: {
        email: c.email, phone: c.phone, passwordHash: seekerPw,
        firstName: c.first, lastName: c.last, name: `${c.first} ${c.last}`,
        avatar: (c as any).avatar || null,
        role: 'CLIENT', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
        lastLoginAt: daysAgo(rndInt(0, 7)),
      },
    });
    await prisma.wallet.create({ data: { userId: u.id, balance: rndInt(20000, 200000), currency: 'KES' } });
    clientUsers.push(u);
  }

  // ── Companies + Recruiter links ───────────────────────────────────────────
  const [
    companyKakai, companySafaricom, companyKCB, companyAndela, companyTwiga,
  ] = await Promise.all([
    prisma.company.create({
      data: {
        name: 'Kakai Talent Solutions', industry: 'Staffing & Recruitment',
        description: 'East Africa\'s premier technical recruiting firm. We connect top talent with high-growth companies across Kenya, Uganda, and Tanzania.',
        website: 'https://kakairecruiting.co.ke', size: 'SMALL',
        location: 'Nairobi, Kenya', isVerified: true,
        logoUrl: 'https://logo.clearbit.com/kakairecruiting.co.ke',
      },
    }),
    prisma.company.create({
      data: {
        name: 'Safaricom PLC', industry: 'Telecommunications',
        description: 'Kenya\'s leading mobile network operator and technology company. Home of M-PESA — Africa\'s largest mobile money service.',
        website: 'https://safaricom.co.ke', size: 'ENTERPRISE',
        location: 'Nairobi, Kenya', isVerified: true,
        logoUrl: 'https://logo.clearbit.com/safaricom.co.ke',
      },
    }),
    prisma.company.create({
      data: {
        name: 'KCB Group', industry: 'Banking & Financial Services',
        description: 'The largest commercial bank in Kenya and one of the largest in East Africa. Operating in 7 countries with 500+ branches.',
        website: 'https://kcbgroup.com', size: 'LARGE',
        location: 'Nairobi, Kenya', isVerified: true,
        logoUrl: 'https://logo.clearbit.com/kcbgroup.com',
      },
    }),
    prisma.company.create({
      data: {
        name: 'Andela Kenya', industry: 'Technology',
        description: 'Global talent network that connects companies with vetted software engineers from Africa. 3,000+ engineers across 100+ countries.',
        website: 'https://andela.com', size: 'LARGE',
        location: 'Nairobi, Kenya', isVerified: true,
        logoUrl: 'https://logo.clearbit.com/andela.com',
      },
    }),
    prisma.company.create({
      data: {
        name: 'Twiga Foods', industry: 'FMCG & AgriTech',
        description: 'Africa\'s leading B2B food distribution platform. Using technology to connect farmers with food businesses, reducing waste and improving incomes.',
        website: 'https://twigafoods.com', size: 'MEDIUM',
        location: 'Nairobi, Kenya', isVerified: true,
        logoUrl: 'https://logo.clearbit.com/twigafoods.com',
      },
    }),
  ]);

  // Link recruiters to companies
  const michaelUser = await prisma.user.findUnique({ where: { email: 'michael.kariuki@uteo-demo.ke' } });
  const winnieUser = await prisma.user.findUnique({ where: { email: 'winnie.achieng@uteo-demo.ke' } });
  const kevinUser = await prisma.user.findUnique({ where: { email: 'kevin.mwangi@uteo-demo.ke' } });

  await prisma.recruiter.createMany({
    data: [
      { userId: trainerUser.id, companyId: companyKakai.id, title: 'Founder & Lead Recruiter' },
      { userId: michaelUser!.id, companyId: companySafaricom.id, title: 'Senior Talent Acquisition Specialist' },
      { userId: winnieUser!.id, companyId: companyAndela.id, title: 'Technical Recruiter' },
      { userId: kevinUser!.id, companyId: companyKCB.id, title: 'HR & Talent Manager' },
    ],
  });

  // ── Jobs (12 rich postings) ───────────────────────────────────────────────
  const jobDefs = [
    {
      company: companyKakai, poster: trainerUser, title: 'Senior Product Designer (UX/UI)',
      description: 'We are looking for a talented Senior Product Designer to join our client — a fast-growing fintech startup in Nairobi. You will own the end-to-end design process for web and mobile products, conducting user research, building wireframes, prototypes, and high-fidelity designs.\n\nYou will work closely with the engineering and product teams to ship polished, accessible experiences for millions of Kenyan users.',
      requirements: '• 4+ years of product design experience\n• Proficiency in Figma and design systems\n• Strong portfolio of shipped mobile/web products\n• Experience with user research and usability testing\n• Background in fintech or e-commerce is a bonus',
      location: 'Nairobi, Kenya', jobType: 'FULL_TIME', salaryMin: 150000, salaryMax: 200000,
      status: 'ACTIVE', skillNames: ['Leadership', 'Project Management'],
      hiringStages: ['Application Review', 'Portfolio Review', 'Design Challenge', 'Final Interview', 'Offer'],
    },
    {
      company: companySafaricom, poster: michaelUser!, title: 'Software Engineer — M-PESA Platform',
      description: 'Join the team that powers M-PESA — the world\'s most successful mobile money platform. As a Software Engineer on the M-PESA Platform team, you will design, build, and scale the services that handle 10 billion+ transactions annually.\n\nYou will work with microservices, event-driven architectures, and high-throughput distributed systems. This is a rare opportunity to work at true scale on infrastructure that changes lives across Africa.',
      requirements: '• BSc Computer Science or equivalent\n• 3+ years backend engineering (Java, Go, or Node.js)\n• Experience with distributed systems and high-throughput APIs\n• Familiarity with Kubernetes and cloud infrastructure (AWS/GCP)\n• Strong understanding of system design and scalability',
      location: 'Westlands, Nairobi', jobType: 'FULL_TIME', salaryMin: 200000, salaryMax: 280000,
      status: 'ACTIVE', skillNames: ['Data Analytics', 'Agile/Scrum'],
      hiringStages: ['CV Screening', 'Online Assessment', 'Technical Interview', 'System Design Round', 'HR Interview', 'Offer'],
    },
    {
      company: companyKCB, poster: kevinUser!, title: 'Treasury & FX Analyst',
      description: 'KCB Group is seeking a skilled Treasury & FX Analyst to join our Treasury division. You will support the management of the bank\'s liquidity, foreign exchange, and fixed income portfolios.\n\nKey responsibilities include FX trading, liquidity forecasting, regulatory reporting to the CBK, and supporting ALCO (Asset & Liability Committee) with analytics and reporting.',
      requirements: '• BCom Finance, Economics, or related degree\n• CPA(K) or CFA Level I preferred\n• 2–4 years in treasury, banking, or financial analysis\n• Proficiency in Bloomberg Terminal\n• Strong Excel/financial modelling skills',
      location: 'Upper Hill, Nairobi', jobType: 'FULL_TIME', salaryMin: 110000, salaryMax: 160000,
      status: 'ACTIVE', skillNames: ['Financial Literacy', 'Tax Advisory'],
      hiringStages: ['Application Review', 'Technical Test', 'Panel Interview', 'Offer'],
    },
    {
      company: companyAndela, poster: winnieUser!, title: 'Full-Stack Engineer (React + Node.js)',
      description: 'Andela is looking for a Full-Stack Engineer to join a global product team. You will build features across the full stack using React and Node.js, participate in architecture discussions, write tests, and mentor junior engineers.\n\nThis is a remote-first role, working with engineers across multiple time zones to ship high-quality software to enterprise customers worldwide.',
      requirements: '• 4+ years of full-stack engineering experience\n• Strong React (hooks, context, performance optimisation)\n• Node.js/TypeScript backend experience\n• Familiarity with PostgreSQL and Redis\n• Experience with CI/CD pipelines (GitHub Actions preferred)\n• Clear written communication in English (remote-first culture)',
      location: 'Remote (Kenya)', jobType: 'REMOTE', salaryMin: 250000, salaryMax: 350000,
      status: 'ACTIVE', skillNames: ['Data Analytics', 'Cybersecurity'],
      hiringStages: ['Application Review', 'Technical Screening', 'Take-Home Project', 'Technical Interview', 'Culture Fit Interview', 'Offer'],
    },
    {
      company: companyTwiga, poster: trainerUser, title: 'Digital Marketing Manager',
      description: 'Twiga Foods is looking for a data-driven Digital Marketing Manager to own our B2B and D2C marketing channels. You will lead a team of 3 and manage a monthly digital budget of KES 5M+, driving acquisition and retention for our platform of 20,000+ food vendors.\n\nThis role owns SEO, paid search, social media, email/SMS marketing, and influencer partnerships across all Twiga digital properties.',
      requirements: '• 5+ years of digital marketing experience\n• Proven experience managing large ad budgets (Meta, Google)\n• Strong analytical skills (Google Analytics 4, Looker Studio)\n• Experience in FMCG, agritech, or B2B marketplace is a plus\n• Team management experience preferred',
      location: 'Nairobi, Kenya', jobType: 'FULL_TIME', salaryMin: 120000, salaryMax: 170000,
      status: 'ACTIVE', skillNames: ['Digital Marketing', 'Sales Training'],
      hiringStages: ['Application Review', 'Marketing Case Study', 'Panel Interview', 'CEO Interview', 'Offer'],
    },
    {
      company: companySafaricom, poster: michaelUser!, title: 'HR Business Partner — Technology',
      description: 'Safaricom is hiring an HR Business Partner to support the Technology & Digital division (900+ employees). You will be the people strategy lead for engineering, product, and data teams — partnering with senior leadership on talent acquisition, performance management, succession planning, and culture initiatives.',
      requirements: '• 5+ years HR experience, with at least 2 as an HRBP\n• CHRP certification or equivalent\n• Experience supporting technology or engineering teams strongly preferred\n• Strong knowledge of Kenyan labour law\n• Data-driven approach to people analytics',
      location: 'Westlands, Nairobi', jobType: 'FULL_TIME', salaryMin: 130000, salaryMax: 180000,
      status: 'ACTIVE', skillNames: ['HR Management', 'Leadership'],
      hiringStages: ['CV Review', 'HR Screening Call', 'Panel Interview', 'Case Study Presentation', 'Offer'],
    },
    {
      company: companyKakai, poster: trainerUser, title: 'Data Scientist — Consumer Analytics',
      description: 'A leading e-commerce platform (placed by Kakai Talent Solutions) is looking for a Data Scientist to join their Consumer Analytics team. You will build predictive models for customer lifetime value, churn prediction, and personalisation, using Python and SQL on datasets with millions of rows.\n\nYou will partner closely with the product and engineering teams to productionise models and measure business impact.',
      requirements: '• MSc/BSc in Data Science, Statistics, Mathematics, or Computer Science\n• 3+ years of applied data science or machine learning experience\n• Proficiency in Python (pandas, scikit-learn, XGBoost)\n• Strong SQL skills (PostgreSQL or BigQuery)\n• Experience with A/B testing and statistical analysis\n• Portfolio of shipped models with measurable business impact',
      location: 'Nairobi, Kenya', jobType: 'HYBRID', salaryMin: 180000, salaryMax: 230000,
      status: 'ACTIVE', skillNames: ['Data Analytics', 'Agile/Scrum'],
      hiringStages: ['Application Review', 'Take-Home Case Study', 'Technical Interview', 'Final Round', 'Offer'],
    },
    {
      company: companyAndela, poster: winnieUser!, title: 'DevOps Engineer — Cloud Infrastructure',
      description: 'Andela\'s platform engineering team is looking for a DevOps Engineer to manage and improve our cloud infrastructure. You will own Kubernetes cluster operations, CI/CD pipelines, monitoring, and cost optimisation across AWS and GCP, supporting 3,000+ engineers on the Andela platform.',
      requirements: '• 3+ years of DevOps / platform engineering experience\n• Deep expertise in Kubernetes (EKS or GKE)\n• Infrastructure as Code (Terraform preferred)\n• CI/CD pipeline engineering (GitHub Actions, ArgoCD)\n• Monitoring & observability (Datadog, Prometheus/Grafana)\n• AWS or GCP professional certification is a plus',
      location: 'Remote (Kenya)', jobType: 'REMOTE', salaryMin: 220000, salaryMax: 300000,
      status: 'ACTIVE', skillNames: ['Cybersecurity', 'Data Analytics'],
      hiringStages: ['Application Review', 'Technical Screening', 'Infrastructure Assessment', 'Team Interview', 'Offer'],
    },
    {
      company: companyKCB, poster: kevinUser!, title: 'Relationship Manager — Corporate Banking',
      description: 'KCB is hiring a Relationship Manager for the Corporate Banking division. You will manage a portfolio of 30–50 corporate clients with a total lending exposure of KES 2B+, responsible for growing wallet share, cross-selling products, and ensuring portfolio quality.',
      requirements: '• BCom, Finance, or Economics degree\n• 4+ years in corporate or commercial banking\n• Proven track record of meeting or exceeding revenue targets\n• Strong credit analysis and financial modelling skills\n• Existing corporate banking relationships in Nairobi a strong plus',
      location: 'Upper Hill, Nairobi', jobType: 'FULL_TIME', salaryMin: 140000, salaryMax: 200000,
      status: 'ACTIVE', skillNames: ['Financial Literacy', 'Sales Training'],
      hiringStages: ['Application Review', 'Credit Skills Assessment', 'Panel Interview', 'Offer'],
    },
    {
      company: companyTwiga, poster: trainerUser, title: 'Operations Manager — Last Mile Delivery',
      description: 'Twiga Foods is expanding its delivery network and needs an experienced Operations Manager to lead last-mile logistics across Nairobi. You will manage a team of 40+ riders and 3 regional supervisors, overseeing daily routes, SLA compliance, and cost per delivery metrics.',
      requirements: '• 5+ years of logistics or supply chain management experience\n• Experience managing large field teams (30+ direct reports)\n• Proficiency with route optimisation software (TransVirtual, Circuit)\n• Strong analytical skills — comfortable with daily KPI dashboards\n• BSc Supply Chain, Logistics, or Industrial Engineering preferred',
      location: 'Industrial Area, Nairobi', jobType: 'FULL_TIME', salaryMin: 100000, salaryMax: 140000,
      status: 'ACTIVE', skillNames: ['Project Management', 'Leadership'],
      hiringStages: ['CV Screen', 'Operations Case Study', 'Field Assessment', 'Final Interview', 'Offer'],
    },
    {
      company: companyKakai, poster: trainerUser, title: 'Content & Social Media Specialist',
      description: 'A growing EdTech startup (placed by Kakai Talent Solutions) is looking for a creative Content & Social Media Specialist to build and manage their brand presence. You will create short-form video content, manage LinkedIn and Instagram, write SEO-optimised blog posts, and track performance across channels.',
      requirements: '• 2+ years of content creation or social media management experience\n• Strong portfolio of video, graphic, and written content\n• Proficiency with Canva and Adobe tools (Premiere, Lightroom)\n• Basic SEO knowledge\n• Experience with edtech or consumer apps is a bonus',
      location: 'Nairobi, Kenya', jobType: 'PART_TIME', salaryMin: 40000, salaryMax: 65000,
      status: 'ACTIVE', skillNames: ['Digital Marketing', 'Public Speaking'],
      hiringStages: ['Application & Portfolio Review', 'Creative Assessment', 'Interview', 'Offer'],
    },
    {
      company: companySafaricom, poster: michaelUser!, title: 'Product Manager — M-PESA Super App',
      description: 'Safaricom is looking for a talented Product Manager to drive the roadmap for the M-PESA Super App — a financial services platform with 32M+ users. You will own 2–3 key product verticals, conducting user research, writing PRDs, coordinating with engineering, design, and legal, and tracking success metrics post-launch.',
      requirements: '• 4+ years of product management experience\n• Experience with financial services, payments, or consumer mobile apps\n• Strong data analysis skills (SQL, analytics dashboards)\n• Excellent written and verbal communication\n• MBA or Computer Science background preferred but not required',
      location: 'Westlands, Nairobi', jobType: 'FULL_TIME', salaryMin: 210000, salaryMax: 280000,
      status: 'ACTIVE', skillNames: ['Project Management', 'Strategic Planning'],
      hiringStages: ['Application Review', 'PM Case Study', 'Product Critique', 'Panel Interview', 'Executive Interview', 'Offer'],
    },
  ];

  const createdJobs: any[] = [];
  for (const jd of jobDefs) {
    const job = await prisma.job.create({
      data: {
        companyId: jd.company.id, postedById: jd.poster.id,
        title: jd.title, description: jd.description,
        requirements: jd.requirements, location: jd.location,
        jobType: jd.jobType as any, salaryMin: jd.salaryMin, salaryMax: jd.salaryMax,
        currency: 'KES', status: jd.status as any,
        hiringStages: jd.hiringStages,
        expiresAt: daysFrom(rndInt(30, 90)),
      },
    });
    for (const sn of jd.skillNames) {
      if (skillMap[sn]) {
        await prisma.jobSkill.upsert({
          where: { jobId_skillId: { jobId: job.id, skillId: skillMap[sn].id } },
          update: {}, create: { jobId: job.id, skillId: skillMap[sn].id },
        });
      }
    }
    createdJobs.push(job);
  }

  // ── Applications — Sienna applies to 4 jobs ───────────────────────────────
  const siennaApps = [
    { job: createdJobs[4], status: 'INTERVIEW', cover: 'I have 4 years of performance marketing experience managing KES 20M+ budgets. I\'d love to bring that expertise to Twiga Foods and help scale your digital channels.', scheduledAt: daysFrom(3), meetingLink: 'https://meet.google.com/twg-mkt-int' },
    { job: createdJobs[10], status: 'SHORTLISTED', cover: 'Content creation is my passion. I\'ve built social media audiences from 0 to 50K+ and created video campaigns that exceeded engagement benchmarks by 3x. Portfolio attached.', scheduledAt: null, meetingLink: null },
    { job: createdJobs[5], status: 'REVIEWED', cover: 'As an HRBP with experience supporting product and engineering teams, I am excited about this opportunity at Safaricom and believe I can hit the ground running.', scheduledAt: null, meetingLink: null },
    { job: createdJobs[0], status: 'SUBMITTED', cover: 'I am a creative professional with strong collaboration skills and a keen interest in UX. While my background is in marketing, I have been building my design portfolio and would welcome the opportunity.', scheduledAt: null, meetingLink: null },
  ];
  for (const app of siennaApps) {
    await prisma.application.create({
      data: {
        userId: clientUser.id, jobId: app.job.id, status: app.status as any,
        coverLetter: app.cover,
        scheduledAt: app.scheduledAt, meetingLink: app.meetingLink,
        appliedAt: daysAgo(rndInt(1, 14)),
      },
    });
  }

  // Amara (seeker) applies to 3 engineering jobs
  if (namedSeekerUsers[0]) {
    const amaraApps = [
      { job: createdJobs[1], status: 'SHORTLISTED', cover: 'I have 6 years of fintech engineering experience building high-throughput payment systems, directly aligned with the M-PESA Platform role. I am excited to contribute to Safaricom\'s engineering team.' },
      { job: createdJobs[3], status: 'INTERVIEW', cover: 'Remote-first, full-stack, TypeScript — this Andela role is exactly my stack. I have shipped 12+ features to production in the past 2 years and would love to bring that energy to this team.' },
      { job: createdJobs[6], status: 'SUBMITTED', cover: 'My background in fintech engineering gives me strong foundations for data science work. I have been building ML models in Python for the past year and am excited to transition to this role.' },
    ];
    for (const app of amaraApps) {
      await prisma.application.create({
        data: {
          userId: namedSeekerUsers[0].id, jobId: app.job.id, status: app.status as any,
          coverLetter: app.cover, appliedAt: daysAgo(rndInt(1, 10)),
        },
      });
    }
  }

  // James (seeker) applies to finance jobs
  if (namedSeekerUsers[2]) {
    await prisma.application.create({
      data: {
        userId: namedSeekerUsers[2].id, jobId: createdJobs[2].id, status: 'INTERVIEW' as any,
        coverLetter: 'CPA(K) qualified with 5 years of treasury and financial analysis experience at KCB and Equity Bank. This Treasury Analyst role aligns perfectly with my expertise.',
        scheduledAt: daysFrom(2), meetingLink: 'https://meet.google.com/kcb-trs-int',
        appliedAt: daysAgo(7),
      },
    });
    await prisma.application.create({
      data: {
        userId: namedSeekerUsers[2].id, jobId: createdJobs[8].id, status: 'REVIEWED' as any,
        coverLetter: 'Experienced in credit analysis and corporate client portfolio management from my time at KCB and Equity Bank.',
        appliedAt: daysAgo(5),
      },
    });
  }

  // ── Saved Jobs — Sienna saves 3 jobs ─────────────────────────────────────
  await prisma.savedJob.createMany({
    data: [
      { userId: clientUser.id, jobId: createdJobs[1].id },
      { userId: clientUser.id, jobId: createdJobs[3].id },
      { userId: clientUser.id, jobId: createdJobs[11].id },
    ],
  });
  // Amara saves 2 jobs
  if (namedSeekerUsers[0]) {
    await prisma.savedJob.createMany({
      data: [
        { userId: namedSeekerUsers[0].id, jobId: createdJobs[7].id },
        { userId: namedSeekerUsers[0].id, jobId: createdJobs[11].id },
      ],
    });
  }

  // ── Job Interactions — view/click events for feed data ────────────────────
  for (let i = 0; i < 20; i++) {
    const seeker = clientUsers[i % clientUsers.length];
    const job = createdJobs[i % createdJobs.length];
    await prisma.jobInteraction.create({
      data: {
        userId: seeker.id, jobId: job.id,
        action: rnd(['view', 'view', 'view', 'click', 'save']),
        createdAt: daysAgo(rndInt(0, 7)),
      },
    });
  }

  // ── Team Members (Jane Muthoni's firm) ─────────────────────────────────────
  // Find Peter Kamau and Grace Njeri from the extra trainers
  const peterUser = await prisma.user.findUnique({ where: { email: 'michael.kariuki@uteo-demo.ke' } });
  const graceUser = await prisma.user.findUnique({ where: { email: 'winnie.achieng@uteo-demo.ke' } });

  // Jane Muthoni (trainerUser) is the firm owner
  await prisma.teamMember.create({
    data: {
      firmId: trainerUser.id,
      userId: trainerUser.id,
      role: 'OWNER',
      title: 'Managing Director',
      specialization: 'Leadership & Project Management',
      isActive: true,
      invitedById: trainerUser.id,
      invitedAt: daysAgo(90),
      joinedAt: daysAgo(90),
    },
  });

  if (peterUser) {
    await prisma.teamMember.create({
      data: {
        firmId: trainerUser.id,
        userId: peterUser.id,
        role: 'CONSULTANT',
        title: 'Senior Consultant',
        specialization: 'Digital Marketing',
        isActive: true,
        invitedById: trainerUser.id,
        invitedAt: daysAgo(60),
        joinedAt: daysAgo(58),
      },
    });
  }

  if (graceUser) {
    await prisma.teamMember.create({
      data: {
        firmId: trainerUser.id,
        userId: graceUser.id,
        role: 'ASSOCIATE',
        title: 'Data Analytics Associate',
        specialization: 'Data Analytics',
        isActive: true,
        invitedById: trainerUser.id,
        invitedAt: daysAgo(30),
        joinedAt: daysAgo(28),
      },
    });
  }

  // ── Departments (Jane Muthoni's firm) ──────────────────────────────────────
  const samuelUser = await prisma.user.findUnique({ where: { email: 'kevin.mwangi@uteo-demo.ke' } });

  // Find the team member records we just created
  const janeTeamMember = await prisma.teamMember.findUnique({
    where: { firmId_userId: { firmId: trainerUser.id, userId: trainerUser.id } },
  });
  const peterTeamMember = peterUser
    ? await prisma.teamMember.findUnique({ where: { firmId_userId: { firmId: trainerUser.id, userId: peterUser.id } } })
    : null;
  const graceTeamMember = graceUser
    ? await prisma.teamMember.findUnique({ where: { firmId_userId: { firmId: trainerUser.id, userId: graceUser.id } } })
    : null;

  const deptHR = await prisma.department.create({
    data: {
      firmId: trainerUser.id,
      name: 'HR & Strategy',
      description: 'Human resources and strategic planning training programs',
      leadId: trainerUser.id,
      isActive: true,
      sortOrder: 1,
    },
  });

  const deptFinance = await prisma.department.create({
    data: {
      firmId: trainerUser.id,
      name: 'Financial Training',
      description: 'Financial literacy, budgeting, and investment training modules',
      leadId: samuelUser?.id || trainerUser.id,
      isActive: true,
      sortOrder: 2,
    },
  });

  const deptICT = await prisma.department.create({
    data: {
      firmId: trainerUser.id,
      name: 'ICT & Digital Skills',
      description: 'Information technology and digital transformation training',
      isActive: true,
      sortOrder: 3,
    },
  });

  // Assign existing team members to departments
  if (janeTeamMember) {
    await prisma.teamMember.update({
      where: { id: janeTeamMember.id },
      data: { departmentId: deptHR.id },
    });
  }
  if (peterTeamMember) {
    await prisma.teamMember.update({
      where: { id: peterTeamMember.id },
      data: { departmentId: deptICT.id },
    });
  }
  if (graceTeamMember) {
    await prisma.teamMember.update({
      where: { id: graceTeamMember.id },
      data: { departmentId: deptFinance.id },
    });
  }

  // ── Additional Organizations (4 more firms) ────────────────────────────────
  const newOrgs = [
    {
      owner: { email: 'eliud@eliudassociates.co.ke', phone: '+254700000040', first: 'Eliud', last: 'Kiprop', avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=face', firmName: 'Eliud & Associates', spec: 'Strategic Planning', rate: 8000, type: 'PROFESSIONAL', cat: 'Business & Management' },
      consultants: [
        { email: 'diana@eliudassociates.co.ke', phone: '+254700000041', first: 'Diana', last: 'Cherop', avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&h=200&fit=crop&crop=face', role: 'CONSULTANT', title: 'Senior Consultant', spec: 'Public Speaking' },
        { email: 'kevin@eliudassociates.co.ke', phone: '+254700000042', first: 'Kevin', last: 'Maina', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face', role: 'CONSULTANT', title: 'Consultant', spec: 'Project Management' },
      ],
      departments: ['Corporate Strategy', 'Executive Coaching'],
    },
    {
      owner: { email: 'amina@techbridge.co.ke', phone: '+254700000050', first: 'Amina', last: 'Hassan', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face', firmName: 'TechBridge Training', spec: 'Data Analytics', rate: 7000, type: 'PROFESSIONAL', cat: 'Technology & IT' },
      consultants: [
        { email: 'dennis@techbridge.co.ke', phone: '+254700000051', first: 'Dennis', last: 'Odhiambo', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face', role: 'CONSULTANT', title: 'Lead Instructor', spec: 'Cybersecurity' },
        { email: 'lucy@techbridge.co.ke', phone: '+254700000052', first: 'Lucy', last: 'Wanjiku', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face', role: 'ASSOCIATE', title: 'Junior Trainer', spec: 'Agile/Scrum' },
        { email: 'tom@techbridge.co.ke', phone: '+254700000053', first: 'Tom', last: 'Nyaga', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face', role: 'CONSULTANT', title: 'Cloud Specialist', spec: 'Data Analytics' },
      ],
      departments: ['Software Development', 'Data Science', 'Cloud & DevOps'],
    },
    {
      owner: { email: 'john@craftmasters.co.ke', phone: '+254700000060', first: 'John', last: 'Ndung\'u', avatar: 'https://images.unsplash.com/photo-1548544149-4835e62ee5b3?w=200&h=200&fit=crop&crop=face', firmName: 'CraftMasters Kenya', spec: 'Welding & Fabrication', rate: 3000, type: 'VOCATIONAL', cat: 'Construction & Building' },
      consultants: [
        { email: 'paul@craftmasters.co.ke', phone: '+254700000061', first: 'Paul', last: 'Mutua', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face', role: 'CONSULTANT', title: 'Master Welder', spec: 'Welding & Fabrication' },
        { email: 'rose@craftmasters.co.ke', phone: '+254700000062', first: 'Rose', last: 'Achieng', avatar: 'https://images.unsplash.com/photo-1611432579699-484f7990b127?w=200&h=200&fit=crop&crop=face', role: 'ASSOCIATE', title: 'Apprentice Trainer', spec: 'Masonry & Construction' },
      ],
      departments: ['Welding Workshop', 'Construction Training'],
    },
    {
      owner: { email: 'mercy@beautyacademy.co.ke', phone: '+254700000070', first: 'Mercy', last: 'Nyambura', avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop&crop=face', firmName: 'Mercy\'s Beauty Academy', spec: 'Hair Styling', rate: 2500, type: 'VOCATIONAL', cat: 'Beauty & Cosmetology' },
      consultants: [
        { email: 'cynthia@beautyacademy.co.ke', phone: '+254700000071', first: 'Cynthia', last: 'Mwende', avatar: 'https://images.unsplash.com/photo-1589156229687-496a31ad1d1f?w=200&h=200&fit=crop&crop=face', role: 'CONSULTANT', title: 'Senior Stylist', spec: 'Hair Styling' },
      ],
      departments: ['Hair & Styling', 'Skincare & Nails'],
    },
  ];

  for (const org of newOrgs) {
    const o = org.owner;
    // Create owner user
    const ownerUser = await prisma.user.create({
      data: {
        email: o.email, phone: o.phone, passwordHash: recruiterPw,
        firstName: o.first, lastName: o.last, name: `${o.first} ${o.last}`,
        avatar: o.avatar, role: 'TRAINER', status: 'ACTIVE',
        emailVerified: true, phoneVerified: true, lastLoginAt: daysAgo(rndInt(0, 5)),
      },
    });
    await prisma.wallet.create({ data: { userId: ownerUser.id, balance: rndInt(10000, 80000), currency: 'KES' } });
    await prisma.trainerProfile.create({
      data: {
        userId: ownerUser.id, firmName: o.firmName, bio: `${o.firmName} — ${o.spec} training specialists.`,
        hourlyRate: o.rate, currency: 'KES', rating: rndInt(38, 50) / 10, totalReviews: rndInt(5, 40),
        verificationStatus: 'VERIFIED', experience: rndInt(5, 15), specialization: o.spec,
        location: rnd(['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru']) + ', Kenya',
        city: rnd(['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru']),
        county: rnd(['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru']),
        languages: ['English', 'Swahili'], tier: 'CERTIFIED',
        trainerType: o.type as any, categoryId: catMap[o.cat],
        availableForOnline: true, availableForPhysical: true,
      },
    });
    // Owner as team member
    await prisma.teamMember.create({
      data: { firmId: ownerUser.id, userId: ownerUser.id, role: 'OWNER', title: 'Founder & Director', isActive: true, invitedById: ownerUser.id, joinedAt: daysAgo(rndInt(90, 365)) },
    });
    trainerUsers.push(ownerUser);

    // Create departments
    const deptIds: string[] = [];
    for (let d = 0; d < org.departments.length; d++) {
      const dept = await prisma.department.create({
        data: { firmId: ownerUser.id, name: org.departments[d], isActive: true, sortOrder: d, leadId: ownerUser.id },
      });
      deptIds.push(dept.id);
    }

    // Create consultants
    for (let c = 0; c < org.consultants.length; c++) {
      const con = org.consultants[c];
      const conUser = await prisma.user.create({
        data: {
          email: con.email, phone: con.phone, passwordHash: recruiterPw,
          firstName: con.first, lastName: con.last, name: `${con.first} ${con.last}`,
          avatar: con.avatar, role: 'TRAINER', status: 'ACTIVE',
          emailVerified: true, phoneVerified: true, lastLoginAt: daysAgo(rndInt(0, 10)),
        },
      });
      await prisma.wallet.create({ data: { userId: conUser.id, balance: rndInt(5000, 30000), currency: 'KES' } });
      await prisma.trainerProfile.create({
        data: {
          userId: conUser.id, bio: `${con.spec} specialist at ${o.firmName}.`,
          hourlyRate: rndInt(2000, o.rate), currency: 'KES', rating: rndInt(35, 48) / 10, totalReviews: rndInt(2, 20),
          verificationStatus: rnd(['VERIFIED', 'UNDER_REVIEW', 'PENDING']) as any, experience: rndInt(2, 10),
          specialization: con.spec, languages: ['English', 'Swahili'],
          tier: rnd(['CERTIFIED', 'EXPERIENCED']) as any, trainerType: o.type as any,
          categoryId: catMap[o.cat],
        },
      });
      await prisma.teamMember.create({
        data: {
          firmId: ownerUser.id, userId: conUser.id, role: con.role as any, title: con.title,
          specialization: con.spec, isActive: true, invitedById: ownerUser.id,
          joinedAt: daysAgo(rndInt(10, 180)), departmentId: deptIds[c % deptIds.length] || null,
        },
      });
      trainerUsers.push(conUser);
    }
  }

  console.log(`  + 4 new organizations: Eliud & Associates, TechBridge Training, CraftMasters Kenya, Mercy's Beauty Academy`);
  console.log(`  + ${newOrgs.reduce((s, o) => s + o.consultants.length, 0)} new consultants across those orgs`);
  console.log(`  + ${newOrgs.reduce((s, o) => s + o.departments.length, 0)} new departments`);

  // ── Bookings (15) ─────────────────────────────────────────────────────────
  const statuses: any[] = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'CONFIRMED', 'CONFIRMED', 'IN_PROGRESS', 'IN_PROGRESS', 'PENDING_PAYMENT', 'CANCELLED', 'COMPLETED', 'COMPLETED', 'DISPUTED', 'NO_SHOW', 'COMPLETED', 'CONFIRMED'];
  const sessions: any[] = ['VIRTUAL', 'PHYSICAL', 'HYBRID', 'VIRTUAL', 'PHYSICAL'];

  for (let i = 0; i < 15; i++) {
    const trainer = trainerUsers[i % trainerUsers.length];
    const client = clientUsers[i % clientUsers.length];
    const status = statuses[i];
    const amount = rndInt(3000, 15000);
    const booking = await prisma.booking.create({
      data: {
        trainerId: trainer.id, clientId: client.id,
        amount, currency: 'KES', status,
        sessionType: sessions[i % sessions.length],
        scheduledAt: status === 'COMPLETED' ? daysAgo(rndInt(5, 60)) : daysFrom(rndInt(1, 30)),
        duration: rnd([60, 90, 120, 180]),
        location: rnd(['Nairobi CBD', 'Westlands', 'Karen', 'Online', 'Mombasa']),
        meetingLink: sessions[i % sessions.length] === 'VIRTUAL' ? 'https://meet.jit.si/uteo-session-' + i : null,
        completedAt: status === 'COMPLETED' ? daysAgo(rndInt(1, 30)) : null,
        cancellationReason: status === 'CANCELLED' ? 'Schedule conflict' : null,
      },
    });

    await prisma.bookingStatusLog.create({
      data: { bookingId: booking.id, fromStatus: null, toStatus: 'PENDING_PAYMENT', changedBy: client.id },
    });

    if (['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED'].includes(status)) {
      await prisma.bookingStatusLog.create({
        data: { bookingId: booking.id, fromStatus: 'PENDING_PAYMENT', toStatus: 'CONFIRMED', changedBy: client.id },
      });

      // Create escrow for funded bookings
      const cWallet = await prisma.wallet.findUnique({ where: { userId: client.id } });
      if (cWallet) {
        await prisma.escrowAccount.create({
          data: {
            bookingId: booking.id, payerWalletId: cWallet.id,
            amount, currency: 'KES',
            status: status === 'COMPLETED' ? 'RELEASED' : status === 'DISPUTED' ? 'FROZEN' : 'FUNDED',
            fundedAt: daysAgo(rndInt(5, 60)),
            releasedAt: status === 'COMPLETED' ? daysAgo(rndInt(1, 30)) : null,
          },
        });
      }
    }

    // Reviews for completed bookings
    if (status === 'COMPLETED') {
      const rating = rndInt(3, 5);
      await prisma.review.create({
        data: {
          bookingId: booking.id, reviewerId: client.id, trainerId: trainer.id,
          rating,
          comment: rnd([
            'Excellent session! Very knowledgeable trainer.',
            'Good presentation skills and practical examples.',
            'Highly recommended. Will book again.',
            'Great trainer, very patient and thorough.',
            'Learned a lot. The content was well-structured.',
          ]),
        },
      });
    }
  }

  // ── Conversations (5) ─────────────────────────────────────────────────────
  const convoBodies = [
    ['Hi, I would like to discuss the upcoming session.', 'Of course! What would you like to know?', 'Can we change the venue to Karen?', 'Sure, I will update the booking details.'],
    ['Thank you for the great session today!', 'You are welcome! Feel free to reach out if you need anything.'],
    ['When are you available next week?', 'Monday and Wednesday afternoons work best.', 'Great, I will book Wednesday at 2pm.'],
  ];

  for (let i = 0; i < 3; i++) {
    const trainer = trainerUsers[i % trainerUsers.length];
    const client = clientUsers[i % clientUsers.length];
    const bodies = convoBodies[i];
    const convo = await prisma.conversation.create({
      data: {
        type: 'DIRECT',
        participants: { create: [{ userId: trainer.id }, { userId: client.id }] },
      },
    });
    for (let m = 0; m < bodies.length; m++) {
      await prisma.message.create({
        data: {
          conversationId: convo.id,
          senderId: m % 2 === 0 ? client.id : trainer.id,
          messageType: 'TEXT', content: bodies[m],
          createdAt: hoursAgo(bodies.length - m + rndInt(0, 3)),
        },
      });
    }
  }

  // ── Notifications (20) ────────────────────────────────────────────────────
  const allUsers = [admin, ...trainerUsers, ...clientUsers];
  const notifTmpls = [
    { title: 'New booking request', message: 'You have a new booking request from a client.', type: 'BOOKING', channel: 'IN_APP' },
    { title: 'Booking confirmed', message: 'Your booking has been confirmed. Check your schedule.', type: 'BOOKING', channel: 'IN_APP' },
    { title: 'Payment received', message: 'Payment of KES 5,000 has been added to your wallet.', type: 'PAYMENT', channel: 'PUSH' },
    { title: 'Session reminder', message: 'Your training session starts in 30 minutes.', type: 'REMINDER', channel: 'EMAIL' },
    { title: 'New review', message: 'A client has left you a 5-star review!', type: 'REVIEW', channel: 'IN_APP' },
  ];

  for (let i = 0; i < 20; i++) {
    const user = allUsers[i % allUsers.length];
    const tmpl = notifTmpls[i % notifTmpls.length];
    const status = rnd(['SENT', 'SENT', 'READ', 'READ', 'PENDING']) as any;
    await prisma.notification.create({
      data: {
        userId: user.id, title: tmpl.title, message: tmpl.message,
        type: tmpl.type, channel: tmpl.channel as any, status,
        readAt: status === 'READ' ? hoursAgo(rndInt(1, 48)) : null,
        sentAt: status !== 'PENDING' ? hoursAgo(rndInt(1, 72)) : null,
        createdAt: hoursAgo(rndInt(1, 168)),
      },
    });
  }

  // ── Audit Logs (20) ───────────────────────────────────────────────────────
  const auditActions = ['USER_LOGIN', 'USER_REGISTER', 'BOOKING_CREATED', 'BOOKING_COMPLETED', 'PAYMENT_PROCESSED', 'TRAINER_VERIFIED', 'DISPUTE_OPENED', 'REVIEW_CREATED'];
  for (let i = 0; i < 20; i++) {
    const user = allUsers[i % allUsers.length];
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: auditActions[i % auditActions.length],
        resource: 'User', resourceId: user.id,
        severity: rnd(['INFO', 'INFO', 'INFO', 'WARN']) as any,
        createdAt: daysAgo(rndInt(0, 60)),
      },
    });
  }

  // ── System Settings ───────────────────────────────────────────────────────
  await prisma.systemSetting.createMany({
    data: [
      { key: 'platform.commission_rate', value: 0.1 as any, category: 'pricing' },
      { key: 'platform.min_booking_amount', value: 1000 as any, category: 'pricing' },
      { key: 'platform.currency', value: 'KES' as any, category: 'pricing' },
      { key: 'notifications.email_enabled', value: true as any, category: 'notifications' },
      { key: 'notifications.sms_enabled', value: true as any, category: 'notifications' },
      { key: 'platform.maintenance_mode', value: false as any, category: 'platform' },
    ],
  });

  // ── Courses (4) ────────────────────────────────────────────────────────────
  const courseDefs = [
    { title: 'Leadership Fundamentals for East Africa', desc: 'A comprehensive course on leadership styles, team management, and strategic thinking adapted for the East African business context.', cat: 'Business', level: 'BEGINNER', price: 8000, duration: 480 },
    { title: 'Advanced Data Analytics with Python', desc: 'Master data analysis, visualization, and machine learning basics using Python. Hands-on projects with real Kenyan datasets.', cat: 'Technology', level: 'ADVANCED', price: 15000, duration: 720 },
    { title: 'Digital Marketing Mastery', desc: 'Learn SEO, social media marketing, email campaigns, and paid advertising strategies for the African market.', cat: 'Technology', level: 'INTERMEDIATE', price: 5000, duration: 360 },
    { title: 'Financial Literacy for Professionals', desc: 'Personal finance, budgeting, investment strategies, and pension planning for working professionals in Kenya.', cat: 'Business', level: 'BEGINNER', price: 3500, duration: 240 },
  ];

  for (let i = 0; i < courseDefs.length; i++) {
    const def = courseDefs[i];
    const instructor = trainerUsers[i % trainerUsers.length];
    const course = await prisma.course.create({
      data: {
        instructorId: instructor.id, title: def.title, description: def.desc,
        price: def.price, currency: 'KES', category: def.cat, level: def.level,
        duration: def.duration, status: 'PUBLISHED', rating: rndInt(35, 50) / 10,
        totalEnrolled: rndInt(5, 50), tags: [def.cat.toLowerCase(), def.level.toLowerCase()],
      },
    });
    // Add 5 lessons per course — mix of VIDEO, TEXT, and QUIZ content types
    const lessonDefs = [
      { title: 'Introduction & Overview', contentType: 'VIDEO', desc: 'Welcome and course overview', isFree: true },
      { title: 'Core Concepts', contentType: 'VIDEO', desc: 'Key principles and frameworks' },
      { title: 'Practical Application', contentType: 'VIDEO', desc: 'Real-world examples and hands-on exercises' },
      { title: 'Reading Materials & Case Studies', contentType: 'TEXT', desc: 'In-depth case studies and reading materials' },
      { title: 'Assessment & Quiz', contentType: 'QUIZ', desc: 'Test your understanding of the course material' },
    ];
    const lessonIds: string[] = [];
    for (let l = 0; l < lessonDefs.length; l++) {
      const ld = lessonDefs[l];
      const lesson = await prisma.courseLesson.create({
        data: {
          courseId: course.id, title: `Episode ${l + 1}: ${ld.title}`,
          description: ld.desc, contentType: ld.contentType,
          duration: ld.contentType === 'QUIZ' ? 15 : rndInt(20, 60),
          sortOrder: l, episodeNumber: l + 1,
          isFree: ld.isFree || false,
          textContent: ld.contentType === 'TEXT' ? `This is the reading material for ${def.title}. It covers key case studies and frameworks used in ${def.cat}.` : null,
        },
      });
      lessonIds.push(lesson.id);
    }
    // Add quiz questions to the last lesson (QUIZ type)
    const quizLessonId = lessonIds[lessonIds.length - 1];
    await prisma.lessonQuestion.createMany({
      data: [
        { lessonId: quizLessonId, question: `What is the primary focus of ${def.title}?`, questionType: 'MULTIPLE_CHOICE', options: ['Option A: Theory only', 'Option B: Practical application', 'Option C: Both theory and practice', 'Option D: Neither'], correctAnswer: 'Option C: Both theory and practice', explanation: 'This course combines theoretical frameworks with hands-on practical exercises.', points: 2, sortOrder: 0 },
        { lessonId: quizLessonId, question: `${def.cat} training requires continuous learning.`, questionType: 'TRUE_FALSE', options: ['True', 'False'], correctAnswer: 'True', explanation: 'Professional development is an ongoing process.', points: 1, sortOrder: 1 },
        { lessonId: quizLessonId, question: `Describe one key takeaway from this course.`, questionType: 'SHORT_ANSWER', correctAnswer: null, explanation: 'This is a reflective question — there is no single correct answer.', points: 3, sortOrder: 2 },
      ],
    });
    // Enroll some clients
    for (let c = 0; c < Math.min(2, clientUsers.length); c++) {
      await prisma.enrollment.create({
        data: { userId: clientUsers[c].id, courseId: course.id, status: c === 0 ? 'ACTIVE' : 'COMPLETED', progress: c === 0 ? rndInt(10, 80) : 100, completedAt: c === 1 ? daysAgo(rndInt(1, 10)) : null },
      });
    }
  }

  // ── Favorites (6) ─────────────────────────────────────────────────────────
  for (let i = 0; i < Math.min(clientUsers.length, 4); i++) {
    const client = clientUsers[i];
    // Each client favorites 1-2 trainers
    for (let j = 0; j < rndInt(1, 2); j++) {
      const trainer = trainerUsers[(i + j + 1) % trainerUsers.length];
      await prisma.favorite.upsert({
        where: { userId_trainerId: { userId: client.id, trainerId: trainer.id } },
        update: {},
        create: { userId: client.id, trainerId: trainer.id },
      });
    }
  }

  // ── Institutional Affiliations (6) ────────────────────────────────────────
  const affiliationDefs = [
    { inst: 'University of Nairobi', role: 'Adjunct Lecturer', verified: true },
    { inst: 'Kenya Institute of Management', role: 'Certified Trainer', verified: true },
    { inst: 'Strathmore Business School', role: 'Guest Faculty', verified: false },
    { inst: 'Kenya Revenue Authority', role: 'Tax Training Consultant', verified: true },
    { inst: 'ICF - International Coaching Federation', role: 'Associate Certified Coach', verified: true },
    { inst: 'PMI Kenya Chapter', role: 'Volunteer Trainer', verified: false },
  ];
  for (let i = 0; i < affiliationDefs.length; i++) {
    const aff = affiliationDefs[i];
    const user = trainerUsers[i % trainerUsers.length];
    await prisma.institutionalAffiliation.create({
      data: { userId: user.id, institutionName: aff.inst, role: aff.role, isCurrent: true, verified: aff.verified, startDate: daysAgo(rndInt(365, 1825)) },
    });
  }

  // ── Scheduled Reminders (5) ───────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const user = allUsers[i % allUsers.length];
    await prisma.scheduledReminder.create({
      data: {
        userId: user.id, type: rnd(['BOOKING_REMINDER', 'FOLLOW_UP', 'REVIEW_REQUEST']) as any,
        channel: rnd(['EMAIL', 'SMS', 'IN_APP']) as any,
        title: rnd(['Upcoming session', 'Session follow-up', 'Please leave a review']),
        message: rnd(['Your training session starts in 1 hour', 'How was your recent session?', 'Share your experience with other clients']),
        scheduledAt: daysFrom(rndInt(1, 7)),
        status: 'SCHEDULED',
      },
    });
  }

  // ── EXTRA UTEO MARKETPLACE DATA (60 more jobs across 11 more companies) ──
  console.log('\nSeeding additional Uteo marketplace data (companies, recruiters, jobs, applications)…');

  const extraSkillNames = [
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
  const extraSkillMap: Record<string, string> = {};
  for (const name of extraSkillNames) {
    const s = await prisma.skill.upsert({ where: { name }, update: {}, create: { name, category: 'General' } });
    extraSkillMap[name] = s.id;
  }

  // 15 companies — upsert by name (will reuse Safaricom/KCB/Andela/Twiga from above)
  const extraCompaniesData = [
    { name: 'Safaricom PLC', industry: 'Telecommunications', size: 'LARGE' as const, location: 'Westlands, Nairobi', logo: 'https://logo.clearbit.com/safaricom.co.ke', website: 'https://safaricom.co.ke', verified: true },
    { name: 'Equity Bank Kenya', industry: 'Banking & Finance', size: 'LARGE' as const, location: 'Upper Hill, Nairobi', logo: 'https://logo.clearbit.com/equitybank.co.ke', website: 'https://equitybank.co.ke', verified: true },
    { name: 'Andela Kenya', industry: 'Technology', size: 'MEDIUM' as const, location: 'Kilimani, Nairobi', logo: 'https://logo.clearbit.com/andela.com', website: 'https://andela.com', verified: true },
    { name: 'M-KOPA Solar', industry: 'Clean Energy', size: 'MEDIUM' as const, location: 'Karen, Nairobi', logo: 'https://logo.clearbit.com/m-kopa.com', website: 'https://m-kopa.com', verified: true },
    { name: 'Twiga Foods', industry: 'Agritech', size: 'MEDIUM' as const, location: 'Industrial Area, Nairobi', logo: 'https://logo.clearbit.com/twigafoods.com', website: 'https://twiga.com', verified: true },
    { name: 'NCBA Group', industry: 'Banking & Finance', size: 'LARGE' as const, location: 'Upperhill, Nairobi', logo: 'https://logo.clearbit.com/ncbagroup.com', website: 'https://ncbagroup.com', verified: true },
    { name: 'Sendy Ltd', industry: 'Logistics & Delivery', size: 'SMALL' as const, location: 'Ngong Road, Nairobi', logo: 'https://logo.clearbit.com/sendy.co.ke', website: 'https://sendy.co.ke', verified: false },
    { name: "Africa's Talking", industry: 'Technology', size: 'MEDIUM' as const, location: 'Westlands, Nairobi', logo: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=100&h=100&fit=crop', website: 'https://africastalking.com', verified: true },
    { name: 'Deloitte East Africa', industry: 'Professional Services', size: 'LARGE' as const, location: 'Waiyaki Way, Nairobi', logo: 'https://logo.clearbit.com/deloitte.com', website: 'https://deloitte.com/ke', verified: true },
    { name: 'Nation Media Group', industry: 'Media & Publishing', size: 'LARGE' as const, location: 'Nation Centre, Nairobi', logo: 'https://logo.clearbit.com/nation.africa', website: 'https://nation.africa', verified: true },
    { name: 'Sanergy', industry: 'Sanitation & Impact', size: 'SMALL' as const, location: 'Mukuru, Nairobi', logo: 'https://logo.clearbit.com/sanergy.com', website: 'https://sanergy.com', verified: false },
    { name: 'Jumia Kenya', industry: 'E-Commerce', size: 'MEDIUM' as const, location: 'Parklands, Nairobi', logo: 'https://logo.clearbit.com/jumia.co.ke', website: 'https://jumia.co.ke', verified: true },
    { name: 'KCB Group', industry: 'Banking & Finance', size: 'LARGE' as const, location: 'Kencom House, Nairobi', logo: 'https://logo.clearbit.com/kcbgroup.com', website: 'https://kcbgroup.com', verified: true },
    { name: 'Cellulant', industry: 'Fintech', size: 'MEDIUM' as const, location: 'Kilimani, Nairobi', logo: 'https://logo.clearbit.com/cellulant.io', website: 'https://cellulant.io', verified: true },
    { name: 'Watu Credit', industry: 'Fintech', size: 'SMALL' as const, location: 'Mombasa Road, Nairobi', logo: 'https://logo.clearbit.com/watucredit.com', website: 'https://watucredit.com', verified: false },
  ];

  const extraCompanies: any[] = [];
  for (const c of extraCompaniesData) {
    const existing = await prisma.company.findFirst({ where: { name: c.name } });
    if (existing) {
      extraCompanies.push(existing);
    } else {
      const created = await prisma.company.create({
        data: {
          name: c.name, industry: c.industry, size: c.size, location: c.location,
          logoUrl: c.logo, website: c.website, isVerified: c.verified,
          description: `${c.name} is a leading organisation in the ${c.industry} sector operating across East Africa.`,
        },
      });
      extraCompanies.push(created);
    }
  }

  const extraRecruiterDefs = [
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

  const extraRecruiters: any[] = [];
  for (let i = 0; i < extraRecruiterDefs.length; i++) {
    const r = extraRecruiterDefs[i];
    let user = await prisma.user.findUnique({ where: { email: r.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: r.email, passwordHash: recruiterPw, firstName: r.first, lastName: r.last, role: 'TRAINER', emailVerified: true },
      });
    }
    const existingRec = await prisma.recruiter.findFirst({ where: { userId: user.id } });
    if (!existingRec) {
      await prisma.recruiter.create({ data: { userId: user.id, companyId: extraCompanies[i].id, title: 'Talent Acquisition Manager' } });
    }
    extraRecruiters.push(user);
  }

  type ExtraJob = { companyIdx: number; title: string; jobType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'REMOTE' | 'HYBRID'; location: string; salaryMin: number; salaryMax: number; daysOld: number; description: string; requirements: string; skills: string[] };
  const extraJobDefs: ExtraJob[] = [
    { companyIdx: 0, title: 'Senior Software Engineer', jobType: 'FULL_TIME', location: 'Westlands, Nairobi', salaryMin: 180000, salaryMax: 280000, daysOld: 3, description: 'Join our platform engineering team building the systems that power M-PESA and millions of Kenyan transactions every day. You will design and maintain high-availability microservices at massive scale.', requirements: 'At least 5 years of backend engineering experience. Strong knowledge of distributed systems and cloud infrastructure. Experience with Java or Go preferred.', skills: ['Java', 'AWS', 'Docker', 'PostgreSQL', 'REST APIs'] },
    { companyIdx: 0, title: 'Product Manager - M-PESA Super App', jobType: 'FULL_TIME', location: 'Westlands, Nairobi', salaryMin: 200000, salaryMax: 320000, daysOld: 7, description: 'Own the roadmap for the M-PESA Super App product suite. Work cross-functionally with engineering design and business teams to define and ship features used by over 30 million customers.', requirements: 'Minimum 4 years of product management in a consumer or fintech product. Demonstrated ability to work with data to make decisions. Strong communicator.', skills: ['Product Management', 'Data Analysis', 'Agile', 'Communication'] },
    { companyIdx: 0, title: 'UI/UX Designer', jobType: 'HYBRID', location: 'Westlands, Nairobi', salaryMin: 100000, salaryMax: 160000, daysOld: 5, description: 'Design intuitive experiences for Safaricom digital products. You will run user research sessions create wireframes and prototypes and work directly with engineers to ship polished interfaces.', requirements: 'Portfolio demonstrating mobile-first design. Proficiency in Figma. Experience doing user research and usability testing.', skills: ['Figma', 'UI/UX Design', 'Research'] },
    { companyIdx: 1, title: 'Credit Risk Analyst', jobType: 'FULL_TIME', location: 'Upper Hill, Nairobi', salaryMin: 120000, salaryMax: 180000, daysOld: 2, description: 'Assess credit risk for SME and corporate loan applications. Build financial models and make recommendations to the credit committee. This role sits within our Group Risk function.', requirements: 'Degree in Finance Economics or Accounting. At least 3 years in credit analysis or corporate banking. CPA or CFA progress is an advantage.', skills: ['Financial Modelling', 'Excel', 'Accounting', 'Data Analysis'] },
    { companyIdx: 1, title: 'Mobile Banking Developer', jobType: 'FULL_TIME', location: 'Upper Hill, Nairobi', salaryMin: 150000, salaryMax: 240000, daysOld: 10, description: 'Build and maintain the Equity Mobile Banking app serving millions of customers across Africa. Work on new features performance improvements and security hardening.', requirements: '3 years Android or iOS development experience. Understanding of financial systems and security best practices. Kotlin preferred.', skills: ['Kotlin', 'Java', 'REST APIs', 'SQL'] },
    { companyIdx: 1, title: 'Graduate Trainee - Finance', jobType: 'INTERNSHIP', location: 'Upper Hill, Nairobi', salaryMin: 35000, salaryMax: 50000, daysOld: 1, description: 'A structured 12-month graduate programme rotating across Treasury Corporate Banking and Retail. Ideal for recent graduates looking to build a career in banking.', requirements: 'Degree in Finance Economics Commerce or a related field. Must have graduated within the last 2 years with at minimum second class honours.', skills: ['Excel', 'Accounting', 'Financial Modelling', 'Communication'] },
    { companyIdx: 2, title: 'Senior React Engineer', jobType: 'REMOTE', location: 'Remote (Africa)', salaryMin: 300000, salaryMax: 500000, daysOld: 4, description: 'Work on world-class product teams as an Andela engineer. You will be matched to a global technology company and build sophisticated web applications using React and TypeScript.', requirements: 'At least 4 years React development. Strong TypeScript skills. Experience with modern state management and testing frameworks.', skills: ['React', 'TypeScript', 'JavaScript', 'GraphQL', 'Git'] },
    { companyIdx: 2, title: 'Full Stack Engineer - Node.js', jobType: 'REMOTE', location: 'Remote (Africa)', salaryMin: 280000, salaryMax: 450000, daysOld: 6, description: 'Join the Andela talent network and get matched with leading technology companies globally. You will build scalable full-stack systems and collaborate with distributed teams.', requirements: '4 years full-stack experience. Node.js backend and React or Vue on the frontend. CI/CD experience and strong Git workflow.', skills: ['Node.js', 'React', 'PostgreSQL', 'Docker', 'REST APIs'] },
    { companyIdx: 2, title: 'Python Data Engineer', jobType: 'REMOTE', location: 'Remote (Africa)', salaryMin: 260000, salaryMax: 420000, daysOld: 8, description: 'Design and maintain data pipelines for global clients as part of the Andela engineering talent network. Work with large datasets and cloud-based data infrastructure.', requirements: '3 years data engineering experience. Python proficiency. Strong SQL. Experience with AWS or GCP data services.', skills: ['Python', 'SQL', 'PostgreSQL', 'AWS', 'Data Analysis'] },
    { companyIdx: 3, title: 'Field Sales Agent', jobType: 'FULL_TIME', location: 'Kisumu, Kenya', salaryMin: 40000, salaryMax: 70000, daysOld: 1, description: "Grow M-KOPA's customer base in Western Kenya by selling solar home systems and smartphones to underserved communities. You will be the face of M-KOPA in your territory.", requirements: 'At least 1 year field sales experience. Own transport is an advantage. Fluency in Dholuo or Luhya a strong plus. Driven and self-motivated.', skills: ['Sales', 'Customer Service', 'Communication', 'Swahili'] },
    { companyIdx: 3, title: 'Data Scientist - IoT Analytics', jobType: 'HYBRID', location: 'Karen, Nairobi', salaryMin: 160000, salaryMax: 250000, daysOld: 9, description: 'Analyse data from over 3 million connected solar devices to improve payment propensity models and device health monitoring. This is a high-impact role in our data team.', requirements: '3 years applied data science. Python and ML experience. Experience with time-series data is a big plus.', skills: ['Python', 'Machine Learning', 'Data Analysis', 'SQL', 'Tableau'] },
    { companyIdx: 4, title: 'Supply Chain Coordinator', jobType: 'FULL_TIME', location: 'Industrial Area, Nairobi', salaryMin: 80000, salaryMax: 120000, daysOld: 3, description: 'Coordinate daily produce procurement from farmers and delivery to informal retailers across Nairobi. Manage relationships with over 200 farmer suppliers and monitor delivery KPIs.', requirements: 'Degree in Supply Chain Logistics or Business. 2 years experience in FMCG or agri supply chain. Strong Excel and analytical skills.', skills: ['Supply Chain', 'Logistics', 'Procurement', 'Excel', 'Operations'] },
    { companyIdx: 4, title: 'Android Developer', jobType: 'FULL_TIME', location: 'Industrial Area, Nairobi', salaryMin: 120000, salaryMax: 190000, daysOld: 12, description: 'Build the Twiga vendor app used by thousands of kiosks and dukas across Kenya. You will work closely with product and operations to ship features that directly help informal traders.', requirements: '3 years Android development. Kotlin experience required. Understanding of offline-first mobile architecture a plus.', skills: ['Kotlin', 'Java', 'Flutter', 'REST APIs', 'Git'] },
    { companyIdx: 5, title: 'Relationship Manager - SME Banking', jobType: 'FULL_TIME', location: 'Upperhill, Nairobi', salaryMin: 130000, salaryMax: 200000, daysOld: 5, description: 'Manage and grow a portfolio of SME clients. Offer tailored banking solutions including trade finance asset finance and M-Shwari lending products.', requirements: 'Banking or finance degree. 3 years relationship management in commercial banking. Strong client-facing skills and credit analysis ability.', skills: ['Account Management', 'Business Development', 'Financial Modelling', 'CRM'] },
    { companyIdx: 5, title: 'Internal Auditor', jobType: 'FULL_TIME', location: 'Upperhill, Nairobi', salaryMin: 100000, salaryMax: 160000, daysOld: 14, description: 'Conduct risk-based audits across NCBA Group operations in Kenya and the region. Report findings to the audit committee and track remediation progress.', requirements: 'CPA or ACCA qualified. At least 3 years internal audit experience in financial services. CIA certification is an added advantage.', skills: ['Auditing', 'Accounting', 'Excel', 'Research'] },
    { companyIdx: 6, title: 'Operations Manager', jobType: 'FULL_TIME', location: 'Ngong Road, Nairobi', salaryMin: 150000, salaryMax: 220000, daysOld: 2, description: 'Lead day-to-day logistics operations including driver management route optimisation and customer escalations. Own city-level KPIs and build a high-performing ops team.', requirements: '4 years operations management. Experience in logistics or on-demand delivery is strongly preferred. Analytical with strong people management skills.', skills: ['Operations', 'Supply Chain', 'Leadership', 'Data Analysis'] },
    { companyIdx: 6, title: 'Customer Success Executive', jobType: 'FULL_TIME', location: 'Ngong Road, Nairobi', salaryMin: 55000, salaryMax: 85000, daysOld: 0, description: "Manage key business accounts and ensure they get maximum value from Sendy's logistics platform. Handle escalations conduct business reviews and identify upsell opportunities.", requirements: '2 years in customer success or account management. Experience with logistics or SaaS products preferred.', skills: ['Customer Success', 'Account Management', 'CRM', 'Communication'] },
    { companyIdx: 7, title: 'Developer Evangelist', jobType: 'HYBRID', location: 'Westlands, Nairobi', salaryMin: 130000, salaryMax: 200000, daysOld: 6, description: "Represent Africa's Talking at hackathons developer conferences and online communities. Create technical content build sample applications and help developers across Africa succeed with our APIs.", requirements: 'Software engineering background. Excellent communication and presentation skills. Active in developer communities. Experience writing technical blog posts.', skills: ['JavaScript', 'Python', 'REST APIs', 'Communication', 'Content Writing'] },
    { companyIdx: 7, title: 'Backend Engineer - Telco APIs', jobType: 'FULL_TIME', location: 'Westlands, Nairobi', salaryMin: 160000, salaryMax: 250000, daysOld: 10, description: "Build and scale the Africa's Talking API platform that enables SMS voice USSD and payments across over 20 African markets. High-availability systems serving billions of requests a month.", requirements: '4 years backend engineering. Java or Go preferred. Deep understanding of API design and high-throughput systems.', skills: ['Java', 'Node.js', 'PostgreSQL', 'Redis', 'Docker'] },
    { companyIdx: 7, title: 'Technical Support Engineer', jobType: 'FULL_TIME', location: 'Westlands, Nairobi', salaryMin: 80000, salaryMax: 120000, daysOld: 4, description: "Be the first line of technical support for developers integrating the Africa's Talking API platform. Debug integration issues write documentation and escalate complex bugs to engineering.", requirements: '2 years in a technical support role. Comfortable reading code in JavaScript or Python. Strong written English.', skills: ['JavaScript', 'Python', 'REST APIs', 'Customer Service', 'Communication'] },
    { companyIdx: 8, title: 'Tax Consultant', jobType: 'FULL_TIME', location: 'Waiyaki Way, Nairobi', salaryMin: 110000, salaryMax: 170000, daysOld: 3, description: 'Advise corporate clients on Kenyan and East African tax compliance tax structuring and dispute resolution with the Kenya Revenue Authority.', requirements: 'CPA (K) qualified. Degree in Finance Accounting or Law. At least 2 years tax advisory experience. Strong research and drafting skills.', skills: ['Tax', 'Accounting', 'Legal Research', 'Excel', 'Research'] },
    { companyIdx: 8, title: 'Management Consultant - Strategy', jobType: 'FULL_TIME', location: 'Waiyaki Way, Nairobi', salaryMin: 180000, salaryMax: 300000, daysOld: 7, description: 'Work on high-impact strategy and transformation engagements for leading organisations in Kenya and across the region. Build financial models conduct market research and present findings at C-suite level.', requirements: 'MBA or equivalent. 3 years consulting or strategy experience. Exceptional Excel and PowerPoint skills. Strong analytical thinking.', skills: ['Financial Modelling', 'Excel', 'Research', 'Project Management', 'Communication'] },
    { companyIdx: 8, title: 'Risk Advisory Associate', jobType: 'CONTRACT', location: 'Waiyaki Way, Nairobi', salaryMin: 90000, salaryMax: 140000, daysOld: 15, description: 'Support risk advisory engagements covering enterprise risk management internal controls and regulatory compliance for clients in financial services and public sector.', requirements: 'Accounting or finance degree. Understanding of risk frameworks (COSO ISO 31000). Good communicator.', skills: ['Auditing', 'Accounting', 'Research', 'Excel', 'Communication'] },
    { companyIdx: 9, title: 'Digital Journalist', jobType: 'FULL_TIME', location: 'Nation Centre, Nairobi', salaryMin: 70000, salaryMax: 110000, daysOld: 2, description: 'Report and write stories across Nation.Africa digital platforms. Cover business politics and society with a digital-first approach. You will produce both written stories and multimedia content.', requirements: 'Journalism or communications degree. 2 years newsroom experience. Strong news judgement and ability to work to tight deadlines.', skills: ['Content Writing', 'Research', 'Social Media', 'Communication'] },
    { companyIdx: 9, title: 'Digital Marketing Manager', jobType: 'FULL_TIME', location: 'Nation Centre, Nairobi', salaryMin: 130000, salaryMax: 200000, daysOld: 8, description: "Drive subscriber growth and engagement across Nation Media Group's digital platforms. Own SEO paid media email campaigns and performance analytics.", requirements: '4 years digital marketing experience. Proven track record growing digital audiences. Google Ads and Meta certified preferred.', skills: ['Digital Marketing', 'SEO', 'Social Media', 'Data Analysis', 'Copywriting'] },
    { companyIdx: 9, title: 'Graphic Designer', jobType: 'PART_TIME', location: 'Nation Centre, Nairobi', salaryMin: 40000, salaryMax: 65000, daysOld: 1, description: 'Create visual content for Nation.Africa digital platforms social media and print supplements. Work with editorial and commercial teams on daily design requests.', requirements: 'Strong portfolio of editorial or media design work. Proficiency in Adobe Creative Suite. Ability to work quickly under editorial deadlines.', skills: ['Graphic Design', 'Adobe Photoshop', 'Illustrator', 'UI/UX Design'] },
    { companyIdx: 10, title: 'Community Health Officer', jobType: 'FULL_TIME', location: 'Mukuru, Nairobi', salaryMin: 50000, salaryMax: 75000, daysOld: 4, description: 'Engage with communities in Mukuru and other informal settlements to promote proper sanitation practices and conduct health education sessions. Work closely with local health authorities.', requirements: 'Diploma or degree in public health or community development. Experience working in informal settlements. Fluent in Swahili and English.', skills: ['Healthcare', 'Customer Service', 'Swahili', 'Research', 'Communication'] },
    { companyIdx: 10, title: 'Research and Impact Associate', jobType: 'CONTRACT', location: 'Mukuru, Nairobi', salaryMin: 65000, salaryMax: 95000, daysOld: 11, description: "Design and implement surveys to measure the health and economic impact of Sanergy's sanitation products. Analyse data and write reports for donors and investors.", requirements: 'Degree in public health economics or social sciences. Experience with quantitative data analysis. SPSS or Stata skills preferred.', skills: ['Research', 'Data Analysis', 'Excel', 'Communication'] },
    { companyIdx: 11, title: 'Category Manager - Electronics', jobType: 'FULL_TIME', location: 'Parklands, Nairobi', salaryMin: 130000, salaryMax: 200000, daysOld: 5, description: 'Own the electronics category on Jumia Kenya. Negotiate vendor terms optimise product assortment drive category revenue and coordinate with marketing on promotions.', requirements: '3 years category or buying experience in retail or e-commerce. Strong negotiation and commercial acumen. Data-driven approach.', skills: ['Business Development', 'Sales', 'Data Analysis', 'Procurement', 'Excel'] },
    { companyIdx: 11, title: 'Digital Marketing Specialist', jobType: 'FULL_TIME', location: 'Parklands, Nairobi', salaryMin: 80000, salaryMax: 130000, daysOld: 9, description: 'Plan and execute performance marketing campaigns across Google Meta and programmatic channels to drive Jumia traffic and orders. Own campaign budgets and report on ROI.', requirements: '2 years performance marketing. Google Ads and Meta Ads Manager proficiency required. Strong analytical skills.', skills: ['Digital Marketing', 'SEO', 'Social Media', 'Data Analysis'] },
    { companyIdx: 11, title: 'Junior Frontend Developer', jobType: 'INTERNSHIP', location: 'Parklands, Nairobi', salaryMin: 30000, salaryMax: 45000, daysOld: 0, description: 'Join the Jumia engineering team as an intern. Work on the Jumia Kenya web and mobile experience with guidance from senior engineers. Real code shipped from week one.', requirements: 'Currently pursuing or recently completed a Computer Science or related degree. Basic React or JavaScript knowledge. Eager to learn.', skills: ['JavaScript', 'React', 'Git', 'Communication'] },
    { companyIdx: 12, title: 'Head of Digital Banking', jobType: 'FULL_TIME', location: 'Kencom House, Nairobi', salaryMin: 350000, salaryMax: 550000, daysOld: 6, description: "Lead KCB's digital banking transformation agenda. Own the KCB app and mobile banking platforms serving over 9 million customers. Drive product vision team performance and revenue growth.", requirements: '8 years in banking with at least 4 in a digital or product leadership role. MBA preferred. Proven track record delivering digital banking products.', skills: ['Product Management', 'Leadership', 'Agile', 'Data Analysis', 'Communication'] },
    { companyIdx: 12, title: 'HR Business Partner', jobType: 'FULL_TIME', location: 'Kencom House, Nairobi', salaryMin: 130000, salaryMax: 200000, daysOld: 13, description: 'Partner with business units across KCB Group to provide strategic HR support. Handle talent management performance management employee relations and organisational design.', requirements: 'HR degree or IHRM qualification. 4 years HRBP experience in a large organisation. Strong understanding of Kenyan employment law.', skills: ['HR Management', 'Recruitment', 'Training & Development', 'Communication'] },
    { companyIdx: 12, title: 'Corporate Finance Associate', jobType: 'FULL_TIME', location: 'Kencom House, Nairobi', salaryMin: 150000, salaryMax: 230000, daysOld: 4, description: 'Support structured finance transactions including project finance syndications and bond issuances across East Africa. Work alongside senior bankers on live deals.', requirements: 'CFA Level 2 or above preferred. Finance or economics degree. 2 years in investment banking corporate finance or treasury.', skills: ['Financial Modelling', 'Excel', 'Accounting', 'Research'] },
    { companyIdx: 13, title: 'Solutions Architect', jobType: 'HYBRID', location: 'Kilimani, Nairobi', salaryMin: 250000, salaryMax: 400000, daysOld: 7, description: "Design integration architectures for enterprise clients connecting to Cellulant's pan-African payment platform. Lead pre-sales technical discussions and own solution design documents.", requirements: '5 years software engineering. Strong understanding of payment systems and APIs. Excellent communication skills for client-facing technical discussions.', skills: ['REST APIs', 'Java', 'Node.js', 'Communication', 'AWS'] },
    { companyIdx: 13, title: 'Business Development Manager', jobType: 'FULL_TIME', location: 'Kilimani, Nairobi', salaryMin: 180000, salaryMax: 280000, daysOld: 10, description: 'Drive new enterprise and bank partnerships for Cellulant across East Africa. Own the full sales cycle from prospecting to close and manage C-level client relationships.', requirements: '4 years B2B sales in fintech or financial services. Existing network in banking or enterprise technology preferred.', skills: ['Business Development', 'Sales', 'Account Management', 'CRM', 'Communication'] },
    { companyIdx: 13, title: 'QA Engineer', jobType: 'FULL_TIME', location: 'Kilimani, Nairobi', salaryMin: 110000, salaryMax: 170000, daysOld: 2, description: "Own quality assurance for Cellulant's payment platform. Design test strategies write automated test suites and work with engineers to ship reliable payment infrastructure.", requirements: '3 years QA engineering. Experience with API testing and automated testing frameworks. Payment systems experience is a plus.', skills: ['JavaScript', 'Python', 'REST APIs', 'Git', 'SQL'] },
    { companyIdx: 14, title: 'Credit Collections Officer', jobType: 'FULL_TIME', location: 'Mombasa Road, Nairobi', salaryMin: 55000, salaryMax: 85000, daysOld: 0, description: 'Manage a portfolio of defaulted motorcycle loan accounts. Engage customers to negotiate repayment plans and work with field agents on physical recovery where necessary.', requirements: '1 year collections or credit experience. Assertive communicator. Swahili fluency required.', skills: ['Customer Service', 'Communication', 'Swahili', 'CRM'] },
    { companyIdx: 14, title: 'Data Analyst', jobType: 'FULL_TIME', location: 'Mombasa Road, Nairobi', salaryMin: 90000, salaryMax: 140000, daysOld: 5, description: 'Analyse loan book performance customer repayment behaviour and portfolio risk. Build dashboards and provide insights to the credit and operations leadership teams.', requirements: '2 years data analysis. Strong SQL and Excel. Power BI or Tableau experience preferred.', skills: ['Data Analysis', 'SQL', 'Excel', 'Power BI', 'Python'] },
    { companyIdx: 7, title: 'Technical Writer', jobType: 'REMOTE', location: 'Remote (Kenya)', salaryMin: 80000, salaryMax: 120000, daysOld: 3, description: "Write and maintain developer documentation for Africa's Talking APIs. Create tutorials quick-start guides and API references that help developers integrate our products successfully.", requirements: 'Technical writing experience. Comfortable reading code. Excellent English writing skills. Experience documenting REST APIs preferred.', skills: ['Content Writing', 'Copywriting', 'REST APIs', 'Research'] },
    { companyIdx: 2, title: 'Flutter Mobile Developer', jobType: 'REMOTE', location: 'Remote (Africa)', salaryMin: 250000, salaryMax: 400000, daysOld: 8, description: 'Build cross-platform mobile applications for global technology clients through the Andela talent network. Deliver high-quality Flutter apps with clean architecture and thorough testing.', requirements: '3 years Flutter development. Strong Dart skills. Experience with state management solutions such as Riverpod or BLoC.', skills: ['Flutter', 'Kotlin', 'Swift', 'REST APIs', 'Git'] },
    { companyIdx: 9, title: 'Social Media Editor', jobType: 'PART_TIME', location: 'Remote (Nairobi)', salaryMin: 35000, salaryMax: 55000, daysOld: 2, description: 'Manage Nation Media Group social media channels. Create and schedule content monitor engagement and respond to audience comments on Twitter Instagram and Facebook.', requirements: 'Strong understanding of social media platforms. Good writing skills and news awareness. Experience with social media scheduling tools.', skills: ['Social Media', 'Content Writing', 'Copywriting', 'Communication'] },
    { companyIdx: 3, title: 'Legal Counsel', jobType: 'CONTRACT', location: 'Karen, Nairobi', salaryMin: 150000, salaryMax: 220000, daysOld: 6, description: "Provide legal support across M-KOPA's operations in Kenya. Draft and review commercial contracts advise on regulatory matters and support fundraising transactions.", requirements: 'LLB degree and Advocate of the High Court of Kenya. 3 years commercial legal experience. In-house experience at a technology or financial company preferred.', skills: ['Legal Research', 'Contract Drafting', 'Research', 'Communication'] },
    { companyIdx: 5, title: 'Events and Sponsorship Manager', jobType: 'FULL_TIME', location: 'Upperhill, Nairobi', salaryMin: 100000, salaryMax: 160000, daysOld: 11, description: 'Plan and execute NCBA Group brand events sponsorships and activations across Kenya. Manage agency relationships and corporate sponsorship portfolio.', requirements: '3 years events management experience. Strong project management and budget management skills. Experience with corporate sponsorships is a plus.', skills: ['Events Management', 'Project Management', 'Operations', 'Communication'] },
    { companyIdx: 4, title: 'Procurement Officer', jobType: 'FULL_TIME', location: 'Industrial Area, Nairobi', salaryMin: 70000, salaryMax: 110000, daysOld: 7, description: "Manage daily procurement of fresh produce from over 300 smallholder farmers. Negotiate prices manage quality standards and ensure supply reliability for Twiga's distribution network.", requirements: 'Supply chain or agribusiness degree. 2 years procurement experience. Understanding of fresh produce supply chains preferred.', skills: ['Procurement', 'Supply Chain', 'Logistics', 'Excel', 'Communication'] },
    { companyIdx: 1, title: 'Compliance Officer', jobType: 'FULL_TIME', location: 'Upper Hill, Nairobi', salaryMin: 120000, salaryMax: 190000, daysOld: 4, description: "Ensure Equity Bank's compliance with CBK regulations AML/CFT requirements and internal policies. Review products and processes for regulatory alignment and manage regulatory relationships.", requirements: 'Law or finance degree. 3 years compliance experience in banking or financial services. Strong knowledge of CBK prudential guidelines.', skills: ['Legal Research', 'Research', 'Communication', 'Excel'] },
    { companyIdx: 8, title: 'Financial Analyst Intern', jobType: 'INTERNSHIP', location: 'Waiyaki Way, Nairobi', salaryMin: 25000, salaryMax: 40000, daysOld: 0, description: 'Support client engagements in financial advisory and transactions services. Build financial models prepare information memorandums and assist with due diligence projects.', requirements: 'Pursuing a final year degree in Finance Accounting or Economics. Strong Excel skills. Highly analytical with attention to detail.', skills: ['Financial Modelling', 'Excel', 'Accounting', 'Research'] },
    { companyIdx: 11, title: 'Logistics Coordinator', jobType: 'FULL_TIME', location: 'Parklands, Nairobi', salaryMin: 65000, salaryMax: 95000, daysOld: 3, description: 'Coordinate last-mile delivery operations for Jumia Kenya. Work with third-party logistics providers to ensure order fulfilment KPIs are met and handle escalations from customers and vendors.', requirements: '2 years logistics or operations experience in e-commerce. Strong Excel skills. Calm under pressure.', skills: ['Logistics', 'Supply Chain', 'Operations', 'Excel', 'Communication'] },
    { companyIdx: 0, title: 'Cybersecurity Engineer', jobType: 'FULL_TIME', location: 'Westlands, Nairobi', salaryMin: 200000, salaryMax: 320000, daysOld: 5, description: "Protect Safaricom's critical infrastructure and customer data. Conduct security assessments monitor for threats and lead incident response. Work on one of Africa's most critical digital platforms.", requirements: '4 years information security experience. CISSP or CEH certification preferred. Experience with telco or payments security is an advantage.', skills: ['AWS', 'Docker', 'Research', 'Communication', 'SQL'] },
    { companyIdx: 13, title: 'Payroll and HR Officer', jobType: 'FULL_TIME', location: 'Kilimani, Nairobi', salaryMin: 75000, salaryMax: 110000, daysOld: 8, description: 'Manage monthly payroll for Cellulant Kenya and handle day-to-day HR operations including recruitment onboarding and employee relations.', requirements: 'HR or business degree. 2 years payroll and HR generalist experience. IHRM membership preferred.', skills: ['HR Management', 'Payroll', 'Recruitment', 'Excel'] },
    { companyIdx: 6, title: 'Software Engineer - Backend', jobType: 'HYBRID', location: 'Ngong Road, Nairobi', salaryMin: 130000, salaryMax: 210000, daysOld: 9, description: "Build and improve Sendy's logistics platform serving thousands of businesses. Work on driver matching algorithms route optimisation and integrations with enterprise clients.", requirements: '3 years backend experience. Node.js or Python. Experience with mapping APIs or logistics technology is a strong plus.', skills: ['Node.js', 'Python', 'PostgreSQL', 'Redis', 'Docker'] },
    { companyIdx: 10, title: 'Fundraising and Partnerships Manager', jobType: 'FULL_TIME', location: 'Mukuru, Nairobi', salaryMin: 120000, salaryMax: 190000, daysOld: 6, description: 'Lead grant writing donor relations and strategic partnership development for Sanergy. Manage relationships with impact investors foundations and development finance institutions.', requirements: '4 years fundraising or development experience in the NGO or impact enterprise sector. Exceptional writing skills. Track record securing significant grants.', skills: ['Business Development', 'Research', 'Content Writing', 'Communication'] },
    { companyIdx: 12, title: 'Branch Manager', jobType: 'FULL_TIME', location: 'Mombasa, Kenya', salaryMin: 160000, salaryMax: 250000, daysOld: 2, description: 'Lead the KCB Mombasa Main Branch team. Drive retail banking sales targets ensure excellent customer service manage branch operations and oversee staff performance.', requirements: 'Banking experience of at least 5 years with 2 in a supervisory role. Strong leadership and commercial skills.', skills: ['Leadership', 'Sales', 'Account Management', 'Operations', 'Communication'] },
    { companyIdx: 14, title: 'Marketing Communications Officer', jobType: 'FULL_TIME', location: 'Mombasa Road, Nairobi', salaryMin: 70000, salaryMax: 105000, daysOld: 7, description: 'Create and execute marketing campaigns for Watu Credit across digital and traditional channels. Write copy for ads social media and customer communications.', requirements: '2 years marketing or communications experience. Strong copywriting skills. Experience with digital marketing tools.', skills: ['Digital Marketing', 'Copywriting', 'Social Media', 'Content Writing'] },
    { companyIdx: 3, title: 'UX Researcher', jobType: 'CONTRACT', location: 'Karen, Nairobi', salaryMin: 120000, salaryMax: 180000, daysOld: 4, description: 'Conduct qualitative and quantitative research to understand how M-KOPA customers in low-income communities use digital products. Translate findings into actionable product insights.', requirements: '3 years UX research experience. Experience doing fieldwork in underserved communities. Strong research design and analysis skills.', skills: ['Research', 'UI/UX Design', 'Data Analysis', 'Communication'] },
    { companyIdx: 7, title: 'Scrum Master', jobType: 'HYBRID', location: 'Westlands, Nairobi', salaryMin: 140000, salaryMax: 220000, daysOld: 13, description: "Facilitate agile ceremonies and coach engineering teams at Africa's Talking. Remove blockers improve team velocity and drive continuous improvement across the product delivery process.", requirements: 'CSM or PSM certification. 3 years as a Scrum Master in a technology company. Excellent facilitation and communication skills.', skills: ['Scrum', 'Agile', 'Project Management', 'Leadership', 'Communication'] },
  ];

  let extraJobCount = 0;
  for (const j of extraJobDefs) {
    const recruiter = extraRecruiters[j.companyIdx % extraRecruiters.length];
    const company = extraCompanies[j.companyIdx];
    const job = await prisma.job.create({
      data: {
        companyId: company.id, postedById: recruiter.id,
        title: j.title, description: j.description, requirements: j.requirements,
        location: j.location, jobType: j.jobType as any,
        salaryMin: j.salaryMin, salaryMax: j.salaryMax, currency: 'KES',
        status: 'ACTIVE', expiresAt: daysFrom(30), createdAt: daysAgo(j.daysOld),
      },
    });
    const validSkills = j.skills.filter(s => extraSkillMap[s]);
    if (validSkills.length) {
      await prisma.jobSkill.createMany({
        data: validSkills.map(s => ({ jobId: job.id, skillId: extraSkillMap[s] })),
        skipDuplicates: true,
      });
    }
    extraJobCount++;
  }

  // Extra job seekers (1 new — others reused from above)
  const tobiasExisting = await prisma.user.findUnique({ where: { email: 'tobias.onyango@uteo-demo.ke' } });
  if (!tobiasExisting) {
    const tobias = await prisma.user.create({
      data: { email: 'tobias.onyango@uteo-demo.ke', passwordHash: seekerPw, firstName: 'Tobias', lastName: 'Onyango', role: 'CLIENT', emailVerified: true },
    });
    await prisma.jobSeekerProfile.create({
      data: { userId: tobias.id, headline: 'Flutter developer 3 years cross-platform mobile', location: 'Nairobi, Kenya', openToWork: true },
    });
    const tSkills = ['Flutter', 'Kotlin', 'REST APIs', 'Git', 'SQL'].filter(sk => extraSkillMap[sk]);
    await prisma.userSkill.createMany({
      data: tSkills.map(sk => ({ userId: tobias.id, skillId: extraSkillMap[sk], proficiency: 'ADVANCED' as any })),
      skipDuplicates: true,
    });
  }

  // Spread applications across all 5 demo seekers + the 60 new jobs
  const seekerEmails = ['amara.osei@uteo-demo.ke', 'fatima.diallo@uteo-demo.ke', 'james.mutua@uteo-demo.ke', 'ciku.wanjiru@uteo-demo.ke', 'tobias.onyango@uteo-demo.ke'];
  const allDemoSeekers = await prisma.user.findMany({ where: { email: { in: seekerEmails } }, select: { id: true } });
  const allActiveJobs = await prisma.job.findMany({ where: { status: 'ACTIVE' }, select: { id: true, title: true } });
  const appStatuses: any[] = [
    'SUBMITTED', 'SUBMITTED', 'SUBMITTED', 'SUBMITTED',
    'REVIEWED', 'REVIEWED', 'REVIEWED',
    'SHORTLISTED', 'SHORTLISTED', 'SHORTLISTED',
    'INTERVIEW', 'INTERVIEW', 'INTERVIEW', 'INTERVIEW',
    'HIRED', 'HIRED',
    'REJECTED', 'REJECTED',
  ];

  let extraAppCount = 0;
  for (const seeker of allDemoSeekers) {
    const numApps = rndInt(8, 14);
    const shuffled = [...allActiveJobs].sort(() => Math.random() - 0.5).slice(0, numApps);
    for (const job of shuffled) {
      const status = rnd(appStatuses);
      try {
        await prisma.application.create({
          data: {
            userId: seeker.id, jobId: job.id, status,
            coverLetter: `I am very excited to apply for the ${job.title} role. My background aligns closely with what you are looking for and I would welcome the chance to discuss further.`,
            appliedAt: daysAgo(rndInt(1, 25)),
          },
        });
        extraAppCount++;
      } catch { /* skip duplicates */ }
    }
  }

  console.log(`Extra Uteo data: ${extraCompanies.length} companies referenced, ${extraJobCount} additional jobs, ${extraAppCount} additional applications`);

  // ── BONUS COMPANIES + 35 MORE JOBS — for a really full marketplace ────
  console.log('\nSeeding bonus marketplace data…');

  const bonusCompaniesData = [
    { name: 'iHub', industry: 'Technology', size: 'SMALL' as const, location: 'Kilimani, Nairobi', website: 'https://ihub.co.ke', verified: true, desc: "Africa's leading innovation hub and tech community space." },
    { name: 'Eneza Education', industry: 'Edtech', size: 'SMALL' as const, location: 'Nairobi', website: 'https://enezaeducation.com', verified: true, desc: 'Mobile-based learning platform serving 6 million African students.' },
    { name: 'Sokowatch', industry: 'B2B Commerce', size: 'MEDIUM' as const, location: 'Industrial Area, Nairobi', website: 'https://sokowatch.com', verified: true, desc: 'B2B e-commerce platform for African informal retailers.' },
    { name: 'Kobo360', industry: 'Logistics', size: 'MEDIUM' as const, location: 'Nairobi', website: 'https://kobo360.com', verified: true, desc: 'Pan-African logistics platform connecting cargo owners with truckers.' },
    { name: 'Branch International', industry: 'Fintech', size: 'MEDIUM' as const, location: 'Westlands, Nairobi', website: 'https://branch.co', verified: true, desc: 'Mobile-first lending and savings, serving millions across Africa.' },
    { name: 'Tala Kenya', industry: 'Fintech', size: 'MEDIUM' as const, location: 'Westlands, Nairobi', website: 'https://tala.co.ke', verified: true, desc: 'Digital lender providing microloans to over 5 million Kenyans.' },
    { name: 'iProcure', industry: 'Agritech', size: 'SMALL' as const, location: 'Industrial Area, Nairobi', website: 'https://iprocu.re', verified: true, desc: 'Agricultural inputs supply chain platform serving 350k+ farmers.' },
    { name: 'Apollo Agriculture', industry: 'Agritech', size: 'MEDIUM' as const, location: 'Nairobi', website: 'https://apolloagriculture.com', verified: true, desc: 'AI-powered platform helping smallholder farmers increase yields.' },
    { name: 'BasiGo', industry: 'Clean Mobility', size: 'SMALL' as const, location: 'Industrial Area, Nairobi', website: 'https://basigo.ke', verified: true, desc: 'Electric bus fleet operator transforming public transport in Kenya.' },
    { name: 'Wasoko', industry: 'B2B Commerce', size: 'MEDIUM' as const, location: 'Westlands, Nairobi', website: 'https://wasoko.com', verified: true, desc: 'Africa-focused B2B e-commerce platform.' },
  ];

  const bonusCompanies: any[] = [];
  for (const c of bonusCompaniesData) {
    const existing = await prisma.company.findFirst({ where: { name: c.name } });
    if (existing) { bonusCompanies.push(existing); continue; }
    const created = await prisma.company.create({
      data: {
        name: c.name, industry: c.industry, size: c.size, location: c.location,
        logoUrl: `https://logo.clearbit.com/${c.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}`,
        website: c.website, isVerified: c.verified, description: c.desc,
      },
    });
    bonusCompanies.push(created);
  }

  const bonusRecruiterDefs = [
    { first: 'Naomi', last: 'Wachira', email: 'naomi.wachira@uteo-demo.ke' },
    { first: 'David', last: 'Mwendia', email: 'david.mwendia@uteo-demo.ke' },
    { first: 'Sharon', last: 'Atieno', email: 'sharon.atieno@uteo-demo.ke' },
    { first: 'Charles', last: 'Maina', email: 'charles.maina@uteo-demo.ke' },
    { first: 'Lucy', last: 'Wambui', email: 'lucy.wambui@uteo-demo.ke' },
    { first: 'Tony', last: 'Kiarie', email: 'tony.kiarie@uteo-demo.ke' },
    { first: 'Mercy', last: 'Njeri', email: 'mercy.njeri@uteo-demo.ke' },
    { first: 'Steve', last: 'Mutuku', email: 'steve.mutuku@uteo-demo.ke' },
    { first: 'Anita', last: 'Wanjala', email: 'anita.wanjala@uteo-demo.ke' },
    { first: 'Gilbert', last: 'Otieno', email: 'gilbert.otieno@uteo-demo.ke' },
  ];

  const bonusRecruiters: any[] = [];
  for (let i = 0; i < bonusRecruiterDefs.length; i++) {
    const r = bonusRecruiterDefs[i];
    let user = await prisma.user.findUnique({ where: { email: r.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: r.email, passwordHash: recruiterPw, firstName: r.first, lastName: r.last, role: 'TRAINER', emailVerified: true },
      });
    }
    const existingRec = await prisma.recruiter.findFirst({ where: { userId: user.id } });
    if (!existingRec) {
      await prisma.recruiter.create({ data: { userId: user.id, companyId: bonusCompanies[i].id, title: 'Senior Talent Lead' } });
    }
    bonusRecruiters.push(user);
  }

  type BonusJob = { ci: number; title: string; jt: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'REMOTE' | 'HYBRID'; loc: string; min: number; max: number; days: number; desc: string; req: string; skills: string[] };

  const bonusJobs: BonusJob[] = [
    { ci: 0, title: 'Community Manager', jt: 'FULL_TIME', loc: 'Kilimani, Nairobi', min: 80000, max: 130000, days: 2, desc: "Run iHub's developer events, hackathons and community programmes. Be the face of Kenya's tech scene to startups, sponsors and visitors. Light marketing, heavy people work.", req: '3+ years community or events. Strong network in Kenya tech. Comfortable on stage and in DMs.', skills: ['Events Management', 'Communication', 'Social Media', 'Project Management'] },
    { ci: 0, title: 'Frontend Engineer (React)', jt: 'HYBRID', loc: 'Kilimani, Nairobi', min: 150000, max: 230000, days: 5, desc: 'Build the iHub member portal, event platform and partner dashboards. Modern stack: Next.js, TypeScript, Tailwind. Ship weekly.', req: '3+ years React. Strong TypeScript. Knows accessibility and performance.', skills: ['React', 'TypeScript', 'JavaScript', 'Figma', 'Git'] },
    { ci: 1, title: 'Curriculum Lead', jt: 'FULL_TIME', loc: 'Nairobi', min: 110000, max: 160000, days: 4, desc: 'Own the K-12 curriculum across 6 African countries. Work with subject experts, ministry partners and our content team to keep lessons relevant and effective.', req: '5+ years curriculum design. Teaching background. KICD or similar experience a plus.', skills: ['Training & Development', 'Research', 'Project Management', 'Communication'] },
    { ci: 1, title: 'Mobile Engineer (Kotlin/Flutter)', jt: 'REMOTE', loc: 'Remote (East Africa)', min: 200000, max: 320000, days: 7, desc: 'Build the Eneza app used by 6 million students across Africa. Offline-first design, low-bandwidth optimisation, dozens of African languages.', req: '4+ years mobile (Kotlin or Flutter). Experience with offline sync. Bonus: low-bandwidth optimisation experience.', skills: ['Kotlin', 'Flutter', 'REST APIs', 'SQL', 'Git'] },
    { ci: 1, title: 'Growth Lead', jt: 'FULL_TIME', loc: 'Nairobi', min: 180000, max: 280000, days: 9, desc: "Drive student acquisition across Kenya, Ghana, Cote d'Ivoire. Mix of paid acquisition, school partnerships and SMS-based marketing.", req: '5+ years growth/marketing in consumer tech. Comfortable with data. Proven scale-ups.', skills: ['Digital Marketing', 'Data Analysis', 'SEO', 'Business Development'] },
    { ci: 2, title: 'Field Operations Manager', jt: 'FULL_TIME', loc: 'Mombasa', min: 130000, max: 200000, days: 3, desc: "Lead Sokowatch's field team in Mombasa coast region. Recruit, train and supervise sales reps serving 1,500+ informal retailers. Hit weekly GMV targets.", req: '4+ years field ops or FMCG sales management. Comfortable with Excel and route optimisation.', skills: ['Operations', 'Leadership', 'Sales', 'Data Analysis', 'Logistics'] },
    { ci: 2, title: 'Backend Engineer', jt: 'HYBRID', loc: 'Industrial Area, Nairobi', min: 220000, max: 350000, days: 8, desc: 'Engineer the Sokowatch order, inventory and routing systems. Stack: Node.js, PostgreSQL, AWS. Handle 50k+ orders per day.', req: '4+ years backend. Strong system design. Experience with high-throughput systems.', skills: ['Node.js', 'PostgreSQL', 'AWS', 'Docker', 'REST APIs'] },
    { ci: 3, title: 'Truck Onboarding Manager', jt: 'FULL_TIME', loc: 'Mombasa Road, Nairobi', min: 100000, max: 160000, days: 2, desc: 'Recruit and onboard truckers onto the Kobo360 platform. Manage relationships with truck owners and ensure compliance with KRA, NTSA and insurance requirements.', req: '3+ years logistics or fleet management. Strong network of trucking operators. KRA/NTSA compliance familiarity.', skills: ['Logistics', 'Operations', 'CRM', 'Communication'] },
    { ci: 3, title: 'Data Engineer', jt: 'REMOTE', loc: 'Remote (Africa)', min: 250000, max: 400000, days: 10, desc: 'Build the data infrastructure that powers Kobo360: pricing models, route optimisation, fraud detection. Work directly with the data science team.', req: '4+ years data engineering. Strong Python and SQL. Experience with Airflow, Kafka, dbt.', skills: ['Python', 'SQL', 'PostgreSQL', 'AWS', 'Data Analysis'] },
    { ci: 4, title: 'Credit Risk Analyst', jt: 'FULL_TIME', loc: 'Westlands, Nairobi', min: 150000, max: 230000, days: 4, desc: 'Help Branch make better lending decisions across Kenya, Tanzania, Nigeria and Mexico. Build risk models that balance default rate against approval rate.', req: 'Quantitative degree (Stats, Maths, Econ). 3+ years risk or analytics. Strong Python or R.', skills: ['Python', 'Data Analysis', 'SQL', 'Financial Modelling', 'Machine Learning'] },
    { ci: 4, title: 'Product Designer', jt: 'HYBRID', loc: 'Westlands, Nairobi', min: 180000, max: 280000, days: 6, desc: 'Design how Africans experience financial services on Branch. Lead end-to-end design for new products, from research through to ship.', req: '4+ years product design. Strong portfolio of mobile work. Experience with research and quantitative testing.', skills: ['Figma', 'UI/UX Design', 'Research', 'Product Management'] },
    { ci: 5, title: 'Customer Success Manager', jt: 'FULL_TIME', loc: 'Westlands, Nairobi', min: 90000, max: 140000, days: 1, desc: "Manage relationships with Tala's top 1% of borrowers: high-volume, high-trust customers who get our best rates and most attention. Reduce churn, grow lifetime value.", req: '2+ years customer success or account management. Numbers-driven. Strong communication.', skills: ['Customer Success', 'Account Management', 'CRM', 'Data Analysis'] },
    { ci: 5, title: 'Senior Backend Engineer', jt: 'REMOTE', loc: 'Remote (Africa)', min: 280000, max: 450000, days: 11, desc: "Build the systems that power Tala's lending across 4 markets. Work on credit scoring infrastructure, KYC pipelines, payment integrations.", req: '5+ years backend. Strong Python or Go. Experience with financial services or high-compliance environments.', skills: ['Python', 'PostgreSQL', 'AWS', 'Docker', 'REST APIs'] },
    { ci: 6, title: 'Agronomist', jt: 'FULL_TIME', loc: 'Eldoret, Kenya', min: 75000, max: 120000, days: 3, desc: 'Train smallholder farmers on best practices for inputs application. Field-based role across the western Kenya region. Build trust with farmer cooperatives.', req: 'Diploma or degree in Agriculture. 3+ years field experience with smallholders. Fluent in Swahili.', skills: ['Training & Development', 'Customer Service', 'Swahili', 'Communication'] },
    { ci: 6, title: 'Senior Software Engineer (Full-Stack)', jt: 'HYBRID', loc: 'Industrial Area, Nairobi', min: 220000, max: 340000, days: 9, desc: 'Build the iProcure platform. Frontend in React, backend in Node.js, mobile in Flutter. Real impact: every line of code affects farmer livelihoods.', req: '4+ years full-stack. Strong React and Node.js. Mobile experience a plus.', skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Flutter'] },
    { ci: 7, title: 'Field Sales Lead', jt: 'FULL_TIME', loc: 'Kakamega, Kenya', min: 80000, max: 130000, days: 5, desc: 'Lead a team of 15 field agents across western Kenya, helping smallholder maize farmers access credit, inputs and training to double their yields.', req: '4+ years sales management in agritech or microfinance. Local language fluency. Driving licence.', skills: ['Sales', 'Leadership', 'Operations', 'Swahili', 'Communication'] },
    { ci: 7, title: 'Machine Learning Engineer', jt: 'REMOTE', loc: 'Remote (Kenya)', min: 250000, max: 400000, days: 7, desc: 'Build ML models that predict farm yields, optimal input mixes and credit risk for Kenyan smallholder farmers. Work with satellite imagery, weather data and on-farm surveys.', req: '4+ years ML engineering. Strong Python. Experience with geospatial data a major plus.', skills: ['Python', 'Machine Learning', 'Data Analysis', 'SQL', 'AWS'] },
    { ci: 8, title: 'Fleet Operations Manager', jt: 'FULL_TIME', loc: 'Industrial Area, Nairobi', min: 200000, max: 310000, days: 4, desc: "Run BasiGo's electric bus fleet operations: maintenance, charging schedules, route optimisation. Work with PSV operators to maximise vehicle uptime.", req: '5+ years fleet or transport operations. EV experience a plus. Strong analytical mindset.', skills: ['Operations', 'Leadership', 'Logistics', 'Data Analysis'] },
    { ci: 8, title: 'Embedded Software Engineer', jt: 'FULL_TIME', loc: 'Industrial Area, Nairobi', min: 200000, max: 320000, days: 12, desc: 'Build the telematics and fleet management software that runs on every BasiGo bus. Real-time vehicle data, charge state, route compliance.', req: '4+ years embedded or IoT engineering. C/C++ and Python. Linux and CAN bus experience.', skills: ['Python', 'AWS', 'Docker', 'PostgreSQL', 'REST APIs'] },
    { ci: 9, title: 'Country Manager (Tanzania)', jt: 'FULL_TIME', loc: 'Dar es Salaam', min: 380000, max: 600000, days: 6, desc: "Lead Wasoko's Tanzania operation. Full P&L responsibility. Build local teams in sales, ops, finance. Set the strategy for one of our key growth markets.", req: '8+ years GM or country lead experience. Strong African market track record. MBA preferred.', skills: ['Leadership', 'Business Development', 'Operations', 'Financial Modelling', 'Communication'] },
    { ci: 9, title: 'Senior Product Manager', jt: 'HYBRID', loc: 'Westlands, Nairobi', min: 280000, max: 450000, days: 8, desc: 'Own the Wasoko retailer ordering experience across 5 markets. Drive ordering frequency, basket size and retention through better product.', req: '5+ years PM. Consumer or B2B marketplace experience. Strong analytical chops.', skills: ['Product Management', 'Data Analysis', 'Agile', 'Communication', 'Research'] },
    { ci: 0, title: 'Investor Relations Associate', jt: 'CONTRACT', loc: 'Kilimani, Nairobi', min: 100000, max: 150000, days: 2, desc: "Support iHub's engagement with VCs, foundations and corporate partners. Prep decks, manage outreach pipelines, write quarterly updates.", req: '3+ years in IR, BD or PR. Strong writing. Comfortable in Excel and Notion.', skills: ['Business Development', 'Communication', 'Research', 'Excel', 'Content Writing'] },
    { ci: 1, title: 'Education Researcher', jt: 'PART_TIME', loc: 'Remote (Kenya)', min: 50000, max: 80000, days: 3, desc: 'Run small qualitative studies with parents, students and teachers to validate Eneza product directions. 20 hours per week, flexible.', req: '2+ years applied research. Comfortable with thematic coding. Native English; Swahili a plus.', skills: ['Research', 'Communication', 'Swahili', 'Data Analysis'] },
    { ci: 2, title: 'Inventory Planner', jt: 'FULL_TIME', loc: 'Industrial Area, Nairobi', min: 90000, max: 140000, days: 4, desc: 'Forecast demand and plan stock for Sokowatch warehouses across Kenya. Reduce out-of-stock and overstock through better data-driven planning.', req: '3+ years supply chain planning. Strong Excel and SQL. FMCG experience preferred.', skills: ['Supply Chain', 'Excel', 'SQL', 'Data Analysis', 'Operations'] },
    { ci: 3, title: 'DevOps Engineer', jt: 'REMOTE', loc: 'Remote (Africa)', min: 280000, max: 440000, days: 6, desc: "Build and maintain Kobo360's cloud infrastructure across AWS and GCP. Containerised microservices, observability, cost optimisation.", req: '4+ years DevOps/SRE. Strong Kubernetes and Terraform. AWS or GCP certified preferred.', skills: ['AWS', 'Docker', 'Python', 'PostgreSQL', 'REST APIs'] },
    { ci: 4, title: 'Compliance Officer', jt: 'FULL_TIME', loc: 'Westlands, Nairobi', min: 130000, max: 200000, days: 8, desc: "Ensure Branch's lending operations comply with CBK regulations, AML/CFT and emerging digital lending rules. Liaise directly with regulators.", req: 'Law or finance degree. 4+ years compliance in financial services. CBK familiarity required.', skills: ['Legal Research', 'Auditing', 'Excel', 'Research', 'Communication'] },
    { ci: 5, title: 'Marketing Analyst', jt: 'FULL_TIME', loc: 'Westlands, Nairobi', min: 110000, max: 170000, days: 1, desc: "Measure the effectiveness of Tala's marketing across SMS, USSD, paid digital and partnerships. Build dashboards and run experiments.", req: '2+ years marketing analytics. Strong SQL. Familiar with attribution modelling.', skills: ['Data Analysis', 'SQL', 'Excel', 'Power BI', 'Digital Marketing'] },
    { ci: 6, title: 'Logistics Coordinator', jt: 'FULL_TIME', loc: 'Eldoret, Kenya', min: 70000, max: 105000, days: 5, desc: 'Coordinate iProcure deliveries from regional warehouses to farmer collection points across western Kenya. Manage drivers, fuel cards, route plans.', req: '2+ years logistics or fleet coordination. Comfortable with GIS tools. Driving licence.', skills: ['Logistics', 'Operations', 'Excel', 'Communication'] },
    { ci: 7, title: 'Customer Onboarding Specialist', jt: 'FULL_TIME', loc: 'Kakamega, Kenya', min: 50000, max: 80000, days: 2, desc: 'Onboard new smallholder farmers onto Apollo Agriculture programmes. Field-based, lots of farmer education, trust-building.', req: '1+ year customer-facing field role. Local language fluency. Strong patience and empathy.', skills: ['Customer Service', 'Training & Development', 'Swahili', 'Communication'] },
    { ci: 8, title: 'Charging Infrastructure Manager', jt: 'FULL_TIME', loc: 'Industrial Area, Nairobi', min: 180000, max: 280000, days: 3, desc: "Plan, deploy and maintain BasiGo's electric bus charging network across Nairobi. Work with KPLC, landlords and our engineering team.", req: '5+ years infrastructure or electrical engineering. EV charging experience strongly preferred.', skills: ['Electrical Engineering', 'Project Management', 'Operations', 'Communication'] },
    { ci: 9, title: 'Finance Business Partner', jt: 'FULL_TIME', loc: 'Westlands, Nairobi', min: 220000, max: 340000, days: 9, desc: "Partner with Wasoko's sales and ops leadership to plan budgets, track unit economics and run weekly business reviews. CFO's right hand.", req: 'CPA(K) or ACCA. 5+ years FP&A. Experience in fast-moving consumer or commerce companies.', skills: ['Financial Modelling', 'Excel', 'Accounting', 'Data Analysis', 'Auditing'] },
    { ci: 0, title: 'Junior Frontend Engineer', jt: 'INTERNSHIP', loc: 'Kilimani, Nairobi', min: 35000, max: 55000, days: 0, desc: 'Join iHub as a paid intern. Work on the member portal alongside our senior engineers. Real code that ships.', req: 'Final year CS or self-taught with portfolio. Basic React. Eager to learn.', skills: ['JavaScript', 'React', 'Git', 'Communication'] },
    { ci: 1, title: 'Customer Support Lead', jt: 'FULL_TIME', loc: 'Nairobi', min: 100000, max: 150000, days: 4, desc: "Build and lead Eneza's customer support operation. SMS, WhatsApp and call centre channels. Coach a team of 8.", req: '4+ years customer support. Team lead experience. Familiar with Zendesk and HubSpot.', skills: ['Customer Service', 'Customer Success', 'Leadership', 'CRM', 'Communication'] },
    { ci: 4, title: 'Mobile App Engineer (Android)', jt: 'HYBRID', loc: 'Westlands, Nairobi', min: 200000, max: 310000, days: 7, desc: 'Build the Branch Android app used by millions across Kenya, Tanzania, Nigeria and Mexico. Strong focus on performance and offline experience.', req: '4+ years Android. Kotlin and Jetpack Compose. Performance optimisation experience.', skills: ['Kotlin', 'Java', 'REST APIs', 'SQL', 'Git'] },
  ];

  let bonusJobCount = 0;
  for (const j of bonusJobs) {
    const recruiter = bonusRecruiters[j.ci];
    const company = bonusCompanies[j.ci];
    if (!recruiter || !company) continue;
    const job = await prisma.job.create({
      data: {
        companyId: company.id, postedById: recruiter.id,
        title: j.title, description: j.desc, requirements: j.req,
        location: j.loc, jobType: j.jt as any,
        salaryMin: j.min, salaryMax: j.max, currency: 'KES',
        status: 'ACTIVE', expiresAt: daysFrom(30), createdAt: daysAgo(j.days),
      },
    });
    const validSkills = j.skills.filter(s => extraSkillMap[s]);
    if (validSkills.length) {
      await prisma.jobSkill.createMany({
        data: validSkills.map(s => ({ jobId: job.id, skillId: extraSkillMap[s] })),
        skipDuplicates: true,
      });
    }
    bonusJobCount++;
  }

  const allActiveJobs2 = await prisma.job.findMany({ where: { status: 'ACTIVE' }, select: { id: true, title: true } });
  const allDemoSeekers2 = await prisma.user.findMany({ where: { email: { in: seekerEmails } }, select: { id: true } });
  let bonusAppCount = 0;
  for (const seeker of allDemoSeekers2) {
    const more = rndInt(5, 10);
    const shuffled = [...allActiveJobs2].sort(() => Math.random() - 0.5).slice(0, more);
    for (const job of shuffled) {
      try {
        await prisma.application.create({
          data: {
            userId: seeker.id, jobId: job.id, status: rnd(appStatuses),
            coverLetter: `I'd love the chance to interview for the ${job.title} role.`,
            appliedAt: daysAgo(rndInt(1, 30)),
          },
        });
        bonusAppCount++;
      } catch { /* dup, skip */ }
    }
  }

  console.log(`Bonus marketplace data: ${bonusCompanies.length} more companies, ${bonusJobCount} more jobs, ${bonusAppCount} more applications`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\nUteo seed complete!\n');
  console.log('  admin@uteo.com                    / Admin2026!      — SUPER_ADMIN');
  console.log('  finance@uteo.com                  / Admin2026!      — FINANCE_ADMIN');
  console.log('  ops@uteo.com                      / Admin2026!      — ADMIN');
  console.log('  support@uteo.com                  / Admin2026!      — SUPPORT');
  console.log('  benjamin.kakai@uteo-demo.ke       / Recruiter2026!  — TRAINER/RECRUITER (Kakai Talent Solutions, 12 jobs posted)');
  console.log('  michael.kariuki@uteo-demo.ke      / Recruiter2026!  — TRAINER/RECRUITER (Safaricom PLC)');
  console.log('  winnie.achieng@uteo-demo.ke       / Recruiter2026!  — TRAINER/RECRUITER (Andela Kenya)');
  console.log('  kevin.mwangi@uteo-demo.ke         / Recruiter2026!  — TRAINER/RECRUITER (KCB Group)');
  console.log('  sienna.kaks@uteo-demo.ke          / Seeker2026!     — CLIENT/JOB SEEKER (4 applications, 3 saved jobs)');
  console.log('  amara.osei@uteo-demo.ke           / Seeker2026!     — CLIENT/JOB SEEKER (3 applications, fintech engineer)');
  console.log('  fatima.diallo@uteo-demo.ke        / Seeker2026!     — CLIENT/JOB SEEKER (digital marketing)');
  console.log('  james.mutua@uteo-demo.ke          / Seeker2026!     — CLIENT/JOB SEEKER (2 applications, CPA(K) finance)');
  console.log('  ciku.wanjiru@uteo-demo.ke         / Seeker2026!     — CLIENT/JOB SEEKER (HR & People Ops)');
  console.log('  5 companies: Kakai Talent Solutions, Safaricom, KCB, Andela, Twiga Foods');
  console.log('  12 jobs across 5 companies (salary ranges, stages, skills)');
  console.log('  9 applications (various statuses: SUBMITTED→INTERVIEW)');
  console.log('  5 saved jobs, 20 job interactions');
  console.log('  Rich seeker profiles: headline, bio, work experience, education, skills');
  console.log('  24 skills, 16 categories');
  console.log('  3 subscription plans (Basic/Professional/Enterprise)');
  console.log('  2 commission rules (Default 10%, Premium 7%)');
  console.log('  3 team members under benjamin.kakai@uteo-demo.ke firm');
  console.log('  3 departments (HR & Strategy, Financial Training, ICT & Digital Skills)');
  console.log('  15 bookings with escrows, status logs, reviews');
  console.log('  3 conversations with messages');
  console.log('  20 notifications, 20 audit logs, 6 system settings');
  console.log('  4 courses with lessons and enrollments');
  console.log('  6+ favorites, 6 institutional affiliations, 5 scheduled reminders');
  console.log('  Certifications with credentialTypes: LICENSE, PROFESSIONAL_MEMBERSHIP, DEGREE, DIPLOMA, TRADE_CERTIFICATE, CERTIFICATE, PORTFOLIO');
  console.log('  4 verification requests (2 approved, 1 pending, 1 rejected)\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
