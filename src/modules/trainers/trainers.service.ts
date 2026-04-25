import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma, TrainerTier } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateTrainerProfileDto, UpdateTrainerProfileDto, ListTrainersDto, AddSkillsDto, AddCertificationDto, SetAvailabilityDto } from './dto/trainers.dto';

@Injectable()
export class TrainersService {
  constructor(private readonly prisma: PrismaService) {}

  async createProfile(userId: string, dto: CreateTrainerProfileDto) {
    const existing = await this.prisma.trainerProfile.findUnique({ where: { userId } });
    if (existing) throw new BadRequestException('Trainer profile already exists');
    const profile = await this.prisma.trainerProfile.create({
      data: {
        userId,
        bio: dto.bio,
        hourlyRate: dto.hourlyRate || 0,
        currency: dto.currency || 'KES',
        experience: dto.experience || 0,
        location: dto.location,
        city: dto.city,
        county: dto.county,
        specialization: dto.specialization,
        languages: dto.languages || [],
        availableForOnline: dto.availableForOnline ?? false,
        availableForPhysical: dto.availableForPhysical ?? false,
        availableForHybrid: dto.availableForHybrid ?? false,
        portfolioUrl: dto.portfolioUrl,
        linkedinUrl: dto.linkedinUrl,
        websiteUrl: dto.websiteUrl,
        tier: dto.tier || 'ENTRY_LEVEL',
        trainerType: dto.trainerType || 'PROFESSIONAL',
        categoryId: dto.categoryId,
        verificationStatus: 'PENDING',
      },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { role: 'TRAINER' } });
    return profile;
  }

  async findAll(dto: ListTrainersDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;
    const where: Prisma.TrainerProfileWhereInput = { user: { deletedAt: null, status: 'ACTIVE' } };
    if (dto.search) {
      where.OR = [
        { user: { firstName: { contains: dto.search, mode: 'insensitive' } } },
        { user: { lastName: { contains: dto.search, mode: 'insensitive' } } },
        { specialization: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    if (dto.location) where.location = { contains: dto.location, mode: 'insensitive' };
    if (dto.county) where.county = { contains: dto.county, mode: 'insensitive' };
    if (dto.minPrice !== undefined) where.hourlyRate = { ...(where.hourlyRate as any), gte: dto.minPrice };
    if (dto.maxPrice !== undefined) where.hourlyRate = { ...(where.hourlyRate as any), lte: dto.maxPrice };
    if (dto.minRating !== undefined) where.rating = { gte: dto.minRating };
    if (dto.sessionType === 'VIRTUAL') where.availableForOnline = true;
    if (dto.sessionType === 'PHYSICAL') where.availableForPhysical = true;
    if (dto.sessionType === 'HYBRID') where.availableForHybrid = true;
    if (dto.skill) where.skills = { some: { skill: { name: { contains: dto.skill, mode: 'insensitive' } } } };
    if (dto.category) where.skills = { some: { skill: { category: { contains: dto.category, mode: 'insensitive' } } } };
    // New filters
    if (dto.tier) where.tier = dto.tier;
    if (dto.trainerType) where.trainerType = dto.trainerType;
    if (dto.verificationStatus) where.verificationStatus = dto.verificationStatus;
    if (dto.categoryId) where.categoryId = dto.categoryId;
    if (dto.credentialType) where.certifications = { some: { credentialType: dto.credentialType } };
    // When no explicit sort, we'll do weighted scoring in-memory (fetch all matching, then sort + paginate)
    const useWeightedRanking = !dto.sortBy;
    const orderBy: any =
      dto.sortBy === 'price' ? { hourlyRate: dto.sortOrder || 'asc' } :
      dto.sortBy === 'rating' ? { rating: dto.sortOrder || 'desc' } :
      dto.sortBy === 'experience' ? { experience: dto.sortOrder || 'desc' } :
      dto.sortBy === 'hourlyRate' ? { hourlyRate: dto.sortOrder || 'asc' } :
      dto.sortBy === 'followers' ? { followerCount: dto.sortOrder || 'desc' } :
      { rating: 'desc' }; // fallback DB ordering — final order comes from scoring below

    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const includeSpec = {
      user: {
        select: {
          id: true, email: true, firstName: true, lastName: true, name: true, avatar: true,
          firmMembers: { where: { isActive: true }, select: { id: true, role: true } },
          teamMembership: { where: { isActive: true }, select: { role: true, firmId: true }, take: 1 },
        },
      },
      skills: { include: { skill: true } },
      certifications: { select: { id: true, name: true, issuer: true, credentialType: true, verified: true, documentUrl: true, yearObtained: true } },
      availabilitySlots: { where: { isActive: true }, select: { id: true, dayOfWeek: true, startTime: true, endTime: true }, take: 1 },
    };

    const [items, total] = await Promise.all([
      this.prisma.trainerProfile.findMany({
        where,
        // For weighted ranking, fetch all then paginate in memory; otherwise use DB skip/take
        skip: useWeightedRanking ? 0 : skip,
        take: useWeightedRanking ? undefined : limit,
        orderBy,
        include: includeSpec,
      }),
      this.prisma.trainerProfile.count({ where }),
    ]);

    // Tag each trainer as org or individual — org = has firmMembers AND is OWNER (not just a consultant with self-reference)
    const tagged = items.map((t: any) => {
      const members = t.user?.firmMembers || [];
      const ownMembership = t.user?.teamMembership?.[0];
      const isOrg = members.length > 0 && (!ownMembership || ownMembership.firmId === t.user.id || ownMembership.role === 'OWNER');
      const hasAvailability = (t.availabilitySlots?.length ?? 0) > 0;
      return {
        ...t,
        user: { ...t.user, firmMembers: undefined, teamMembership: undefined, _count: undefined },
        followerCount: t.followerCount ?? 0,
        isOrganization: isOrg,
        teamSize: isOrg ? members.length : 0,
        memberRole: ownMembership?.role || null,
        belongsToFirm: ownMembership?.firmId && ownMembership.firmId !== t.user.id ? ownMembership.firmId : null,
        _hasAvailability: hasAvailability,
      };
    });

    // Apply isOrganization filter in-memory (computed field, not a DB column)
    const filtered = dto.isOrganization !== undefined
      ? tagged.filter((t: any) => t.isOrganization === dto.isOrganization)
      : tagged;
    const filteredTotal = dto.isOrganization !== undefined ? filtered.length : total;

    if (useWeightedRanking) {
      // Apply weighted scoring and re-paginate in memory
      const searchSkills = dto.skill ? [dto.skill.toLowerCase()] : [];
      const scored = filtered.map((t) => ({
        ...t,
        _score: this.computeScore(t, searchSkills),
      }));
      scored.sort((a, b) => b._score - a._score);
      const paginated = scored.slice(skip, skip + limit).map(({ _score, _hasAvailability, ...rest }) => rest);
      return paginate(paginated, filteredTotal, page, limit);
    }

    const clean = filtered.map(({ _hasAvailability, ...rest }: any) => rest);
    const paginated = dto.isOrganization !== undefined ? clean.slice(skip, skip + limit) : clean;
    return paginate(paginated, filteredTotal, page, limit);
  }

  async findByType(type: string, page = 1, limit = 20) {
    const validTypes = ['PROFESSIONAL', 'VOCATIONAL', 'BOTH'];
    if (!validTypes.includes(type)) throw new BadRequestException('Invalid trainer type. Must be PROFESSIONAL, VOCATIONAL, or BOTH');
    const skip = (page - 1) * limit;
    const where: Prisma.TrainerProfileWhereInput = {
      trainerType: type as any,
      user: { deletedAt: null, status: 'ACTIVE' },
    };
    const [items, total] = await Promise.all([
      this.prisma.trainerProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { rating: 'desc' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
          skills: { include: { skill: true } },
          certifications: { where: { verified: true } },
        },
      }),
      this.prisma.trainerProfile.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async getMyProfile(userId: string) {
    const profile = await this.prisma.trainerProfile.findFirst({
      where: { userId, user: { deletedAt: null } },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true, phone: true } },
        skills: { include: { skill: true } },
        certifications: true,
        availabilitySlots: { where: { isActive: true } },
      },
    });
    if (!profile) throw new NotFoundException('Trainer profile not found — create one first');
    return profile;
  }

  async listMyCertifications(userId: string) {
    const profile = await this.prisma.trainerProfile.findFirst({ where: { userId } });
    if (!profile) return [];
    return this.prisma.certification.findMany({
      where: { trainerId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    // Search by profile ID first, then by user ID (courses link to user, not profile)
    const profile = await this.prisma.trainerProfile.findFirst({
      where: { OR: [{ id }, { userId: id }], user: { deletedAt: null } },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true, phone: true } },
        skills: { include: { skill: true } },
        certifications: true,
        availabilitySlots: { where: { isActive: true } },
      },
    });
    if (!profile) throw new NotFoundException('Trainer profile not found');
    const reviews = await this.prisma.review.findMany({
      where: { trainerId: profile.userId, isVisible: true },
      include: { reviewer: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return { ...profile, recentReviews: reviews };
  }

  async update(id: string, userId: string, dto: UpdateTrainerProfileDto) {
    const profile = await this.prisma.trainerProfile.findFirst({ where: { id } });
    if (!profile) throw new NotFoundException('Trainer profile not found');
    if (profile.userId !== userId) throw new ForbiddenException('Not your profile');
    const updated = await this.prisma.trainerProfile.update({
      where: { id },
      data: {
        bio: dto.bio,
        hourlyRate: dto.hourlyRate,
        currency: dto.currency,
        experience: dto.experience,
        location: dto.location,
        city: dto.city,
        county: dto.county,
        specialization: dto.specialization,
        languages: dto.languages,
        availableForOnline: dto.availableForOnline,
        availableForPhysical: dto.availableForPhysical,
        availableForHybrid: dto.availableForHybrid,
        portfolioUrl: dto.portfolioUrl,
        linkedinUrl: dto.linkedinUrl,
        websiteUrl: dto.websiteUrl,
        tier: dto.tier,
        trainerType: dto.trainerType,
        categoryId: dto.categoryId,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        skills: { include: { skill: true } },
      },
    });
    // Recalculate tier if experience was updated
    if (dto.experience !== undefined) {
      await this.recalculateTier(id);
    }
    return updated;
  }

  async addSkills(id: string, userId: string, dto: AddSkillsDto) {
    const profile = await this.prisma.trainerProfile.findFirst({ where: { id } });
    if (!profile) throw new NotFoundException('Trainer profile not found');
    if (profile.userId !== userId) throw new ForbiddenException('Not your profile');
    const skills = await this.prisma.skill.findMany({ where: { id: { in: dto.skillIds } } });
    if (skills.length !== dto.skillIds.length) throw new BadRequestException('Some skill IDs are invalid');
    const existing = await this.prisma.trainerSkill.findMany({ where: { trainerId: id }, select: { skillId: true } });
    const existingIds = new Set(existing.map(s => s.skillId));
    const newIds = dto.skillIds.filter(sid => !existingIds.has(sid));
    if (newIds.length > 0) await this.prisma.trainerSkill.createMany({ data: newIds.map(skillId => ({ trainerId: id, skillId })) });
    return this.prisma.trainerProfile.findUnique({ where: { id }, include: { skills: { include: { skill: true } } } });
  }

  async removeSkill(id: string, skillId: string, userId: string) {
    const profile = await this.prisma.trainerProfile.findFirst({ where: { id } });
    if (!profile) throw new NotFoundException('Trainer profile not found');
    if (profile.userId !== userId) throw new ForbiddenException('Not your profile');
    await this.prisma.trainerSkill.deleteMany({ where: { trainerId: id, skillId } });
    return { message: 'Skill removed' };
  }

  async addCertification(id: string, userId: string, dto: AddCertificationDto) {
    const profile = await this.prisma.trainerProfile.findFirst({ where: { id } });
    if (!profile) throw new NotFoundException('Trainer profile not found');
    if (!(await this.canManageTrainerProfile(profile.userId, userId))) throw new ForbiddenException('Not authorized to manage this trainer profile');
    const cert = await this.prisma.certification.create({
      data: {
        trainerId: id,
        name: dto.name,
        issuer: dto.issuer,
        yearObtained: dto.yearObtained,
        documentUrl: dto.documentUrl,
        credentialType: dto.credentialType || 'CERTIFICATE',
      },
    });
    // Recalculate tier when a certification is added
    await this.recalculateTier(id);
    return cert;
  }

  async updateCertification(id: string, certId: string, userId: string, data: { documentUrl?: string }) {
    const profile = await this.prisma.trainerProfile.findFirst({ where: { id } });
    if (!profile) throw new NotFoundException('Trainer profile not found');
    if (!(await this.canManageTrainerProfile(profile.userId, userId))) throw new ForbiddenException('Not authorized to manage this trainer profile');
    return this.prisma.certification.update({ where: { id: certId }, data });
  }

  async removeCertification(id: string, certId: string, userId: string) {
    const profile = await this.prisma.trainerProfile.findFirst({ where: { id } });
    if (!profile) throw new NotFoundException('Trainer profile not found');
    if (!(await this.canManageTrainerProfile(profile.userId, userId))) throw new ForbiddenException('Not authorized to manage this trainer profile');
    await this.prisma.certification.delete({ where: { id: certId } });
    return { message: 'Certification removed' };
  }

  /** Returns true if actor is the trainer themself, an admin, or the firm OWNER of the trainer. */
  private async canManageTrainerProfile(trainerUserId: string, actorId: string): Promise<boolean> {
    if (trainerUserId === actorId) return true;
    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
    if (actor && ['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'SUPPORT'].includes(actor.role)) return true;
    // Org owner check — actor is a firm OWNER and trainer is on their team
    const teamMember = await this.prisma.teamMember.findFirst({
      where: { firmId: actorId, userId: trainerUserId, isActive: true },
    });
    if (teamMember) {
      const isOwner = await this.prisma.teamMember.findFirst({
        where: { firmId: actorId, userId: actorId, role: 'OWNER', isActive: true },
      });
      if (isOwner) return true;
    }
    return false;
  }

  async setAvailability(id: string, userId: string, dto: SetAvailabilityDto) {
    let profile = await this.prisma.trainerProfile.findFirst({ where: { id } });
    if (!profile) profile = await this.prisma.trainerProfile.findFirst({ where: { userId: id } });
    if (!profile) throw new NotFoundException('Trainer profile not found');
    if (profile.userId !== userId && id !== userId) throw new ForbiddenException('Not your profile');
    const profileId = profile.id;
    await this.prisma.availabilitySlot.deleteMany({ where: { trainerId: profileId } });
    if (dto.slots.length > 0) {
      await this.prisma.availabilitySlot.createMany({
        data: dto.slots.map(s => ({
          trainerId: profileId,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isActive: s.isActive ?? true,
          consultantId: s.consultantId || null,
          departmentId: s.departmentId || null,
        })),
      });
    }
    return this.prisma.availabilitySlot.findMany({
      where: { trainerId: profileId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      include: {
        consultant: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        department: { select: { id: true, name: true } },
      },
    });
  }

  async getAvailability(id: string) {
    let profile = await this.prisma.trainerProfile.findFirst({ where: { id } });
    if (!profile) profile = await this.prisma.trainerProfile.findFirst({ where: { userId: id } });
    if (!profile) throw new NotFoundException('Trainer profile not found');
    return this.prisma.availabilitySlot.findMany({
      where: { trainerId: id, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      include: {
        consultant: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        department: { select: { id: true, name: true } },
      },
    });
  }

  async recommend(userId: string, query?: { skills?: string; category?: string; sessionType?: string; budget?: number; limit?: number }) {
    const limit = Math.min(query?.limit || 10, 20);
    // Get user's past bookings to understand preferences
    const pastBookings = await this.prisma.booking.findMany({
      where: { clientId: userId, status: 'COMPLETED' },
      select: { trainerId: true, sessionType: true },
      take: 20,
      orderBy: { completedAt: 'desc' },
    });
    const pastTrainerIds = pastBookings.map(b => b.trainerId);

    const where: Prisma.TrainerProfileWhereInput = {
      verificationStatus: { in: ['VERIFIED', 'PENDING', 'UNDER_REVIEW'] },
      user: { status: 'ACTIVE', deletedAt: null, id: { notIn: [userId] } },
    };

    if (query?.category) where.specialization = { contains: query.category, mode: 'insensitive' };
    if (query?.budget) where.hourlyRate = { lte: query.budget };
    if (query?.sessionType === 'VIRTUAL') where.availableForOnline = true;
    if (query?.sessionType === 'PHYSICAL') where.availableForPhysical = true;

    let skillFilter: string[] = [];
    if (query?.skills) skillFilter = query.skills.split(',').map(s => s.trim());

    const trainers = await this.prisma.trainerProfile.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        skills: { include: { skill: true } },
        certifications: { where: { verified: true } },
      },
      take: limit * 3, // Get extra to score and filter
      orderBy: [{ rating: 'desc' }, { totalReviews: 'desc' }],
    });

    // Score each trainer
    const scored = trainers.map(t => {
      let score = 0;
      score += Number(t.rating) * 20; // Max 100 from rating
      score += Math.min(t.totalReviews, 50); // Max 50 from reviews
      score += t.certifications.length * 10; // 10 per verified cert
      if (pastTrainerIds.includes(t.user.id)) score += 30; // Boost previously booked trainers
      if (skillFilter.length > 0) {
        const trainerSkills = t.skills.map(s => s.skill.name.toLowerCase());
        const matchCount = skillFilter.filter(s => trainerSkills.some(ts => ts.includes(s.toLowerCase()))).length;
        score += matchCount * 25;
      }
      return { ...t, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(t => ({
      id: t.id,
      userId: t.user.id,
      firstName: t.user.firstName,
      lastName: t.user.lastName,
      avatar: t.user.avatar,
      bio: t.bio,
      hourlyRate: Number(t.hourlyRate),
      rating: Number(t.rating),
      totalReviews: t.totalReviews,
      specialization: t.specialization,
      skills: t.skills.map(s => s.skill.name),
      certifications: t.certifications.length,
      score: t.score,
    }));
  }

  async getReviews(id: string) {
    const profile = await this.prisma.trainerProfile.findFirst({ where: { id } });
    if (!profile) throw new NotFoundException('Trainer profile not found');
    return this.prisma.review.findMany({
      where: { trainerId: profile.userId, isVisible: true },
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        booking: { select: { id: true, sessionType: true, scheduledAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Recalculate the tier for a trainer profile based on:
   * 1. >= 2 verified certs AND any are LICENSE or PROFESSIONAL_MEMBERSHIP -> CERTIFIED
   * 2. experience >= 5 years OR has any verified certs -> EXPERIENCED
   * 3. Otherwise -> ENTRY_LEVEL
   */
  async recalculateTier(profileId: string): Promise<TrainerTier> {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId },
      include: { certifications: { where: { verified: true } } },
    });
    if (!profile) return 'ENTRY_LEVEL';

    const verifiedCerts = profile.certifications;
    const verifiedCount = verifiedCerts.length;
    const hasLicenseOrMembership = verifiedCerts.some(
      c => c.credentialType === 'LICENSE' || c.credentialType === 'PROFESSIONAL_MEMBERSHIP',
    );

    let tier: TrainerTier = 'ENTRY_LEVEL';
    if (verifiedCount >= 2 && hasLicenseOrMembership) {
      tier = 'CERTIFIED';
    } else if (profile.experience >= 5 || verifiedCount > 0) {
      tier = 'EXPERIENCED';
    }

    await this.prisma.trainerProfile.update({
      where: { id: profileId },
      data: { tier },
    });

    return tier;
  }

  /**
   * Task 6 — Weighted trainer ranking score (0–1).
   * Weights: skillMatch=0.35, rating=0.25, experience=0.15, completionRate=0.10, availability=0.10, price=0.05
   */
  computeScore(trainer: any, searchSkills: string[] = []): number {
    const skillMatchBoost = searchSkills.length > 0
      ? (() => {
          const trainerSkillNames = (trainer.skills ?? []).map((s: any) => s.skill?.name?.toLowerCase() ?? '');
          const hasMatch = searchSkills.some(sk => trainerSkillNames.some((ts: string) => ts.includes(sk)));
          return hasMatch ? 1.0 : 0.5;
        })()
      : 1.0; // No search filter — treat as full match

    const avgRating = Number(trainer.rating ?? 0); // 0-5
    const yearsExp = Math.min(Number(trainer.experience ?? 0), 20);
    const completionRate = Number(trainer.completionRate ?? 0.8); // 0-1
    const availabilityBoost = trainer._hasAvailability ? 1.0 : 0.5;
    const hourlyRate = Number(trainer.hourlyRate ?? 0);
    const priceScore = Math.max(0, Math.min(1, 1 - hourlyRate / 10_000));

    return (
      skillMatchBoost * 0.35 +
      (avgRating / 5) * 0.25 +
      (yearsExp / 20) * 0.15 +
      completionRate * 0.10 +
      availabilityBoost * 0.10 +
      priceScore * 0.05
    );
  }

  async getOrganizations(trainerId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: trainerId },
      select: { userId: true },
    });
    if (!profile) throw new NotFoundException('Trainer not found');
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId: profile.userId, isActive: true },
      select: {
        role: true,
        title: true,
        joinedAt: true,
        firm: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            avatar: true,
          },
        },
        department: { select: { id: true, name: true } },
      },
    });
    return memberships.map((m) => ({
      id: m.firm.id,
      name: m.firm.name || `${m.firm.firstName || ''} ${m.firm.lastName || ''}`.trim() || 'Organization',
      logo: m.firm.avatar,
      role: m.role,
      title: m.title,
      department: m.department?.name,
      joinedAt: m.joinedAt,
    }));
  }
}
