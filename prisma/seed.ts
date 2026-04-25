import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n: number) { return new Date(Date.now() - n * 86400_000); }
function hoursAgo(n: number) { return new Date(Date.now() - n * 3600_000); }
function daysFrom(n: number) { return new Date(Date.now() + n * 86400_000); }

async function main() {
  console.log('Seeding PTAK...');
  const pw = await bcrypt.hash('Admin2026!', 12);
  const trainerPw = await bcrypt.hash('Trainer2026!', 12);
  const clientPw = await bcrypt.hash('Client2026!', 12);

  // ── Clear ALL tables (try/catch each — some tables may not exist on older migrations) ──
  const del = async (fn: () => Promise<any>) => { try { await fn(); } catch { /* table may not exist yet */ } };
  await del(() => prisma.scheduledReminder.deleteMany());
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
      email: 'admin@ptak.co.ke', phone: '+254700000001', passwordHash: pw,
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
      email: 'finance@ptak.co.ke', phone: '+254700000004', passwordHash: pw,
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
      email: 'ops@ptak.co.ke', phone: '+254700000005', passwordHash: pw,
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
      email: 'support@ptak.co.ke', phone: '+254700000006', passwordHash: pw,
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
      email: 'trainer@ptak.co.ke', phone: '+254700000002', passwordHash: trainerPw,
      firstName: 'Jane', lastName: 'Muthoni', name: 'Jane Muthoni',
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
      firmName: 'Muthoni & Associates Consulting',
      bio: 'Certified leadership and project management trainer with 10+ years of experience across East Africa.',
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
      email: 'client@ptak.co.ke', phone: '+254700000003', passwordHash: clientPw,
      firstName: 'David', lastName: 'Ochieng', name: 'David Ochieng',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
      role: 'CLIENT', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      lastLoginAt: hoursAgo(3),
    },
  });
  const clientWallet = await prisma.wallet.create({
    data: { userId: clientUser.id, balance: 100000, currency: 'KES' },
  });

  // ── Additional Professional Trainers (5 more) ──────────────────────────────
  const extraTrainers = [
    { email: 'peter@ptak.co.ke', phone: '+254700000010', first: 'Peter', last: 'Kamau', city: 'Mombasa', county: 'Mombasa', spec: 'Digital Marketing', rate: 4000, rating: 4.5, tier: 'EXPERIENCED' as const, type: 'PROFESSIONAL' as const, category: 'Marketing & Communications', skillNames: ['Digital Marketing', 'Sales Training'], avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face' },
    { email: 'grace@ptak.co.ke', phone: '+254700000011', first: 'Grace', last: 'Njeri', city: 'Nakuru', county: 'Nakuru', spec: 'Data Analytics', rate: 6000, rating: 4.9, tier: 'CERTIFIED' as const, type: 'PROFESSIONAL' as const, category: 'Technology & IT', skillNames: ['Data Analytics', 'Agile/Scrum'], avatar: 'https://images.unsplash.com/photo-1589156229687-496a31ad1d1f?w=200&h=200&fit=crop&crop=face' },
    { email: 'samuel@ptak.co.ke', phone: '+254700000012', first: 'Samuel', last: 'Otieno', city: 'Kisumu', county: 'Kisumu', spec: 'Financial Literacy', rate: 3500, rating: 4.2, tier: 'EXPERIENCED' as const, type: 'PROFESSIONAL' as const, category: 'Finance & Accounting', skillNames: ['Financial Literacy', 'Tax Advisory'], avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face' },
    { email: 'faith@ptak.co.ke', phone: '+254700000013', first: 'Faith', last: 'Wambui', city: 'Nairobi', county: 'Nairobi', spec: 'HR Management', rate: 5500, rating: 4.7, tier: 'CERTIFIED' as const, type: 'PROFESSIONAL' as const, category: 'Business & Management', skillNames: ['HR Management', 'Leadership'], avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face' },
    { email: 'kofi@ptak.co.ke', phone: '+254700000014', first: 'Kofi', last: 'Asante', city: 'Eldoret', county: 'Uasin Gishu', spec: 'Sales Training', rate: 3000, rating: 4.0, tier: 'EXPERIENCED' as const, type: 'PROFESSIONAL' as const, category: 'Marketing & Communications', skillNames: ['Sales Training', 'Public Speaking'], avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face' },
  ];

  const trainerUsers: any[] = [trainerUser];
  const trainerProfiles: any[] = [trainerProfile];
  for (const t of extraTrainers) {
    const u = await prisma.user.create({
      data: {
        email: t.email, phone: t.phone, passwordHash: trainerPw,
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
    { email: 'joseph@ptak.co.ke', phone: '+254700000030', first: 'Joseph', last: 'Kipchoge', city: 'Thika', county: 'Kiambu', spec: 'Welding & Fabrication', rate: 1500, rating: 4.6, tier: 'CERTIFIED' as const, type: 'VOCATIONAL' as const, category: 'Construction & Building', skillNames: ['Welding & Fabrication', 'Masonry & Construction'], avatar: 'https://images.unsplash.com/photo-1548544149-4835e62ee5b3?w=200&h=200&fit=crop&crop=face' },
    { email: 'mary@ptak.co.ke', phone: '+254700000031', first: 'Mary', last: 'Akinyi', city: 'Nairobi', county: 'Nairobi', spec: 'Hair Styling & Beauty', rate: 2000, rating: 4.8, tier: 'EXPERIENCED' as const, type: 'VOCATIONAL' as const, category: 'Beauty & Cosmetology', skillNames: ['Hair Styling', 'Barbering'], avatar: 'https://images.unsplash.com/photo-1611432579699-484f7990b127?w=200&h=200&fit=crop&crop=face' },
    { email: 'james@ptak.co.ke', phone: '+254700000032', first: 'James', last: 'Wafula', city: 'Nakuru', county: 'Nakuru', spec: 'Electrical Installation', rate: 2500, rating: 4.4, tier: 'CERTIFIED' as const, type: 'VOCATIONAL' as const, category: 'Electrical & Electronics', skillNames: ['Electrical Wiring', 'Solar Installation'], avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&h=200&fit=crop&crop=face' },
    { email: 'agnes@ptak.co.ke', phone: '+254700000033', first: 'Agnes', last: 'Chebet', city: 'Eldoret', county: 'Uasin Gishu', spec: 'Professional Cooking & Catering', rate: 1800, rating: 4.7, tier: 'EXPERIENCED' as const, type: 'VOCATIONAL' as const, category: 'Culinary & Hospitality', skillNames: ['Professional Cooking'], avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face' },
  ];

  const vocProfiles: any[] = [];
  for (const t of vocationalTrainers) {
    const u = await prisma.user.create({
      data: {
        email: t.email, phone: t.phone, passwordHash: trainerPw,
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
      documentUrl: 'https://storage.ptak.co.ke/docs/jane-pmp.pdf',
      status: 'APPROVED', reviewNote: 'PMP credential verified with PMI registry.',
      reviewedById: admin.id, reviewedAt: daysAgo(60),
    },
  });
  await prisma.verificationRequest.create({
    data: {
      trainerId: vocProfiles[2].id, documentType: 'KPLC Electrician License',
      documentUrl: 'https://storage.ptak.co.ke/docs/james-kplc.pdf',
      status: 'APPROVED', reviewNote: 'License number confirmed with KPLC records.',
      reviewedById: admin.id, reviewedAt: daysAgo(75),
    },
  });
  await prisma.verificationRequest.create({
    data: {
      trainerId: vocProfiles[0].id, documentType: 'Kenya Welders Association Membership',
      documentUrl: 'https://storage.ptak.co.ke/docs/joseph-kwa.pdf',
      status: 'PENDING',
    },
  });
  await prisma.verificationRequest.create({
    data: {
      trainerId: vocProfiles[3].id, documentType: 'Culinary Arts Certificate',
      documentUrl: 'https://storage.ptak.co.ke/docs/agnes-culinary.pdf',
      status: 'REJECTED', reviewNote: 'Document image is blurry and unreadable. Please re-upload a clear scan.',
      reviewedById: admin.id, reviewedAt: daysAgo(10),
    },
  });

  // ── Additional Clients (3 more) ───────────────────────────────────────────
  const extraClients = [
    { email: 'alice@company.co.ke', phone: '+254700000020', first: 'Alice', last: 'Munene', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face' },
    { email: 'brian@startup.io', phone: '+254700000021', first: 'Brian', last: 'Otieno', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=face' },
    { email: 'sylvia@ngo.org', phone: '+254700000022', first: 'Sylvia', last: 'Wambua', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face' },
  ];

  const clientUsers: any[] = [clientUser];
  for (const c of extraClients) {
    const u = await prisma.user.create({
      data: {
        email: c.email, phone: c.phone, passwordHash: clientPw,
        firstName: c.first, lastName: c.last, name: `${c.first} ${c.last}`,
        avatar: (c as any).avatar || null,
        role: 'CLIENT', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
        lastLoginAt: daysAgo(rndInt(0, 7)),
      },
    });
    await prisma.wallet.create({ data: { userId: u.id, balance: rndInt(20000, 200000), currency: 'KES' } });
    clientUsers.push(u);
  }

  // ── Team Members (Jane Muthoni's firm) ─────────────────────────────────────
  // Find Peter Kamau and Grace Njeri from the extra trainers
  const peterUser = await prisma.user.findUnique({ where: { email: 'peter@ptak.co.ke' } });
  const graceUser = await prisma.user.findUnique({ where: { email: 'grace@ptak.co.ke' } });

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
  const samuelUser = await prisma.user.findUnique({ where: { email: 'samuel@ptak.co.ke' } });

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
        email: o.email, phone: o.phone, passwordHash: trainerPw,
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
          email: con.email, phone: con.phone, passwordHash: trainerPw,
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
        meetingLink: sessions[i % sessions.length] === 'VIRTUAL' ? 'https://meet.jit.si/ptak-session-' + i : null,
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

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\nPTAK seed complete!\n');
  console.log('  admin@ptak.co.ke       / Admin2026!    — SUPER_ADMIN');
  console.log('  finance@ptak.co.ke     / Admin2026!    — FINANCE_ADMIN');
  console.log('  ops@ptak.co.ke         / Admin2026!    — ADMIN');
  console.log('  support@ptak.co.ke     / Admin2026!    — SUPPORT');
  console.log('  trainer@ptak.co.ke     / Trainer2026!  — TRAINER (Jane Muthoni, PROFESSIONAL/CERTIFIED, 4.8 rating)');
  console.log('  client@ptak.co.ke      / Client2026!   — CLIENT (David Ochieng)');
  console.log('  + 5 professional trainers (peter, grace, samuel, faith, kofi @ptak.co.ke / Trainer2026!)');
  console.log('  + 4 vocational trainers (joseph, mary, james, agnes @ptak.co.ke / Trainer2026!)');
  console.log('  + 3 additional clients (alice@company.co.ke, brian@startup.io, sylvia@ngo.org / Client2026!)');
  console.log('  24 skills (12 professional + 12 vocational), 16 categories (8 professional + 8 vocational)');
  console.log('  3 subscription plans (Basic/Professional/Enterprise)');
  console.log('  2 commission rules (Default 10%, Premium 7%)');
  console.log('  3 team members (Jane=OWNER, Peter=CONSULTANT, Grace=ASSOCIATE) under trainer@ptak.co.ke firm');
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
