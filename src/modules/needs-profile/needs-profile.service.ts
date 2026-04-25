import { Injectable } from '@nestjs/common';
import { Prisma, ExperienceLevel } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { UpsertNeedsProfileDto } from './dto/needs-profile.dto';

type ScoreResult<T> = { item: T; score: number; reasons: string[] };

@Injectable()
export class NeedsProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    return this.prisma.userNeedsProfile.findUnique({ where: { userId } });
  }

  async upsert(userId: string, dto: UpsertNeedsProfileDto) {
    const data: Prisma.UserNeedsProfileUncheckedCreateInput = {
      userId,
      goals: dto.goals ?? [],
      currentLevel: dto.currentLevel as ExperienceLevel | undefined,
      preferredSessionTypes: dto.preferredSessionTypes ?? [],
      categoriesInterest: dto.categoriesInterest ?? [],
      problemStatement: dto.problemStatement,
      budgetMin: dto.budgetMin !== undefined ? (dto.budgetMin as any) : null,
      budgetMax: dto.budgetMax !== undefined ? (dto.budgetMax as any) : null,
      timeframeWeeks: dto.timeframeWeeks,
      urgency: dto.urgency,
    };

    // Load existing to merge for completeness check
    const existing = await this.prisma.userNeedsProfile.findUnique({ where: { userId } });

    const mergedGoals = dto.goals ?? existing?.goals ?? [];
    const mergedLevel = (dto.currentLevel as ExperienceLevel | undefined) ?? existing?.currentLevel ?? null;
    const mergedCategories = dto.categoriesInterest ?? existing?.categoriesInterest ?? [];

    const isComplete =
      Array.isArray(mergedGoals) &&
      mergedGoals.length > 0 &&
      !!mergedLevel &&
      Array.isArray(mergedCategories) &&
      mergedCategories.length > 0;

    const completedAt = isComplete ? existing?.completedAt ?? new Date() : existing?.completedAt ?? null;

    const updateData: Prisma.UserNeedsProfileUncheckedUpdateInput = {
      ...(dto.goals !== undefined && { goals: dto.goals }),
      ...(dto.currentLevel !== undefined && { currentLevel: dto.currentLevel as ExperienceLevel }),
      ...(dto.preferredSessionTypes !== undefined && { preferredSessionTypes: dto.preferredSessionTypes }),
      ...(dto.categoriesInterest !== undefined && { categoriesInterest: dto.categoriesInterest }),
      ...(dto.problemStatement !== undefined && { problemStatement: dto.problemStatement }),
      ...(dto.budgetMin !== undefined && { budgetMin: dto.budgetMin as any }),
      ...(dto.budgetMax !== undefined && { budgetMax: dto.budgetMax as any }),
      ...(dto.timeframeWeeks !== undefined && { timeframeWeeks: dto.timeframeWeeks }),
      ...(dto.urgency !== undefined && { urgency: dto.urgency }),
      completedAt,
    };

    return this.prisma.userNeedsProfile.upsert({
      where: { userId },
      create: { ...data, completedAt },
      update: updateData,
    });
  }

  // ---------------------------------------------------------------------------
  // Recommendations
  // ---------------------------------------------------------------------------

  async getOnboardingRecommendations(userId: string, opts: { limit?: number } = {}) {
    const limit = opts.limit ?? 10;
    const profile = await this.get(userId);
    const trainers = await this.scoreTrainers(userId, profile, limit);
    const courses = await this.scoreCourses(userId, profile, limit);
    return { profile, trainers, courses };
  }

  async getTrainerRecommendations(userId: string, opts: { limit?: number } = {}) {
    const limit = opts.limit ?? 10;
    const profile = await this.get(userId);
    return this.scoreTrainers(userId, profile, limit);
  }

  async getCourseRecommendations(userId: string, opts: { limit?: number } = {}) {
    const limit = opts.limit ?? 10;
    const profile = await this.get(userId);
    return this.scoreCourses(userId, profile, limit);
  }

  // ---------------------------------------------------------------------------
  // Scoring
  // ---------------------------------------------------------------------------

  private async scoreTrainers(_userId: string, profile: any | null, limit: number) {
    // Fallback: top-rated trainers
    if (!profile) {
      const fallback = await this.prisma.trainerProfile.findMany({
        take: limit,
        orderBy: [{ rating: 'desc' }, { totalReviews: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true,
              avatar: true,
              email: true,
            },
          },
          skills: {
            include: { skill: true },
          },
        },
      });
      return fallback.map((t) => ({
        trainer: this.shapeTrainer(t),
        score: 0,
        reasons: ['Top-rated trainer on the platform'],
      }));
    }

    const categoriesInterest: string[] = profile.categoriesInterest ?? [];
    const preferredSessionTypes: string[] = (profile.preferredSessionTypes ?? []).map((s: string) =>
      s.toUpperCase(),
    );
    const budgetMin = profile.budgetMin ? Number(profile.budgetMin) : null;
    const budgetMax = profile.budgetMax ? Number(profile.budgetMax) : null;

    // Resolve category IDs for matching on trainerProfile.categoryId
    let interestedCategoryIds: string[] = [];
    if (categoriesInterest.length > 0) {
      const categories = await this.prisma.category.findMany({
        where: { name: { in: categoriesInterest } },
        select: { id: true, name: true },
      });
      interestedCategoryIds = categories.map((c) => c.id);
    }

    // Load a reasonable pool - include skills so we can match skill.category too
    const pool = await this.prisma.trainerProfile.findMany({
      take: 200,
      orderBy: [{ rating: 'desc' }, { totalReviews: 'desc' }],
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            avatar: true,
            email: true,
          },
        },
        skills: {
          include: { skill: { select: { id: true, name: true, category: true } } },
        },
      },
    });

    const scored: ScoreResult<any>[] = pool.map((t) => {
      const reasons: string[] = [];
      let score = 0;

      // +40 if trainer has a skill in matching category OR categoryId matches
      const skillCategories: string[] = (t.skills ?? [])
        .map((ts: any) => ts.skill?.category)
        .filter(Boolean);
      const matchedBySkillCategory = skillCategories.find((cat) =>
        categoriesInterest.includes(cat),
      );
      const matchedByTrainerCategoryId =
        t.categoryId && interestedCategoryIds.includes(t.categoryId);

      if (matchedBySkillCategory) {
        score += 40;
        reasons.push(`Specializes in your area: ${matchedBySkillCategory}`);
      } else if (matchedByTrainerCategoryId) {
        const name = categoriesInterest.find(
          (_c, i) => interestedCategoryIds[i] === t.categoryId,
        );
        score += 40;
        reasons.push(`Specializes in your area${name ? `: ${name}` : ''}`);
      }

      // +20 if preferred session types overlap with trainer's availability
      if (preferredSessionTypes.length > 0) {
        const trainerModes: string[] = [];
        if (t.availableForOnline) trainerModes.push('VIRTUAL');
        if (t.availableForPhysical) trainerModes.push('PHYSICAL');
        if (t.availableForHybrid) trainerModes.push('HYBRID');
        const overlap = preferredSessionTypes.some((p) => trainerModes.includes(p));
        if (overlap) {
          score += 20;
          reasons.push(
            `Offers your preferred session type${preferredSessionTypes.length > 1 ? 's' : ''}: ${preferredSessionTypes.join(', ')}`,
          );
        }
      }

      // +15 if rating >= 4.0
      const rating = Number(t.rating ?? 0);
      if (rating >= 4.0) {
        score += 15;
        reasons.push(`Highly rated (${rating.toFixed(1)} stars)`);
      }

      // +10 per follower, capped at +20
      const followerCount = t.followerCount ?? 0;
      if (followerCount > 0) {
        const followerBonus = Math.min(followerCount * 10, 20);
        score += followerBonus;
        reasons.push(`Has ${followerCount} follower${followerCount === 1 ? '' : 's'}`);
      }

      // Budget penalties
      const hourlyRate = Number(t.hourlyRate ?? 0);
      if (budgetMax !== null && hourlyRate > budgetMax) {
        score -= 30;
        reasons.push(`Above your budget (KES ${hourlyRate}/hr > ${budgetMax})`);
      }
      if (budgetMin !== null && hourlyRate > 0 && hourlyRate < budgetMin) {
        score -= 10;
        reasons.push(`Below your budget range (may be too junior)`);
      }

      // +10 if VERIFIED
      if (t.verificationStatus === 'VERIFIED') {
        score += 10;
        reasons.push('Verified trainer');
      }

      return { item: this.shapeTrainer(t), score, reasons };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => ({
      trainer: s.item,
      score: s.score,
      reasons: s.reasons,
    }));
  }

  private async scoreCourses(_userId: string, profile: any | null, limit: number) {
    if (!profile) {
      const fallback = await this.prisma.course.findMany({
        where: { status: 'PUBLISHED' as any },
        take: limit,
        orderBy: [{ rating: 'desc' }, { totalEnrolled: 'desc' }],
        include: {
          instructor: {
            select: { id: true, firstName: true, lastName: true, name: true, avatar: true },
          },
        },
      });
      return fallback.map((c) => ({
        course: c,
        score: 0,
        reasons: ['Top-rated course on the platform'],
      }));
    }

    const categoriesInterest: string[] = profile.categoriesInterest ?? [];
    const budgetMin = profile.budgetMin ? Number(profile.budgetMin) : null;
    const budgetMax = profile.budgetMax ? Number(profile.budgetMax) : null;

    const pool = await this.prisma.course.findMany({
      take: 200,
      orderBy: [{ rating: 'desc' }, { totalEnrolled: 'desc' }],
      include: {
        instructor: {
          select: { id: true, firstName: true, lastName: true, name: true, avatar: true },
        },
      },
    });

    const scored: ScoreResult<any>[] = pool.map((c) => {
      const reasons: string[] = [];
      let score = 0;

      // +40 category match
      if (c.category && categoriesInterest.includes(c.category)) {
        score += 40;
        reasons.push(`Matches your area: ${c.category}`);
      }

      // +15 rating >= 4
      const rating = Number(c.rating ?? 0);
      if (rating >= 4.0) {
        score += 15;
        reasons.push(`Highly rated (${rating.toFixed(1)} stars)`);
      }

      // Budget-in-range bonus/penalty
      const price = Number(c.price ?? 0);
      const inBudget =
        (budgetMin === null || price >= budgetMin) &&
        (budgetMax === null || price <= budgetMax);

      if (budgetMax !== null && price > budgetMax) {
        score -= 30;
        reasons.push(`Above your budget (KES ${price} > ${budgetMax})`);
      } else if (inBudget && (budgetMin !== null || budgetMax !== null)) {
        score += 20;
        reasons.push('Priced within your budget');
      }

      // +10 per enrollment tier (cap +20)
      const enrolled = c.totalEnrolled ?? 0;
      if (enrolled >= 50) {
        score += 20;
        reasons.push(`Popular: ${enrolled} enrolled`);
      } else if (enrolled >= 10) {
        score += 10;
        reasons.push(`${enrolled} learners enrolled`);
      }

      return { item: c, score, reasons };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => ({
      course: s.item,
      score: s.score,
      reasons: s.reasons,
    }));
  }

  private shapeTrainer(t: any) {
    return {
      id: t.id,
      userId: t.userId,
      user: t.user,
      firmName: t.firmName,
      bio: t.bio,
      hourlyRate: t.hourlyRate,
      currency: t.currency,
      rating: t.rating,
      totalReviews: t.totalReviews,
      verificationStatus: t.verificationStatus,
      experience: t.experience,
      specialization: t.specialization,
      categoryId: t.categoryId,
      tier: t.tier,
      trainerType: t.trainerType,
      availableForOnline: t.availableForOnline,
      availableForPhysical: t.availableForPhysical,
      availableForHybrid: t.availableForHybrid,
      followerCount: t.followerCount,
      skills: (t.skills ?? []).map((ts: any) => ({
        id: ts.skill?.id,
        name: ts.skill?.name,
        category: ts.skill?.category,
      })),
    };
  }
}
