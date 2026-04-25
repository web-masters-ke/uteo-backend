import { Injectable } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { FeedQueryDto, JobWithScore } from './dto/feed.dto';

const MAX_SKILL_SCORE = 50;
const MAX_LOCATION_SCORE = 20;
const MAX_RECENCY_SCORE = 10;
const RECENCY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeed(userId: string, dto: FeedQueryDto) {
    const page = Number(dto.page) || 1;
    const limit = Math.min(Number(dto.limit) || 20, 50);

    const [userProfile, userSkills, appliedJobIds, skippedJobIds] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
      // Get user's skills via TrainerProfile → TrainerSkill (if trainer)
      // or we use a joined approach that covers the general case
      this.getUserSkillIds(userId),
      // Jobs already applied to — exclude from feed
      this.prisma.application.findMany({
        where: { userId },
        select: { jobId: true },
      }).then((apps) => apps.map((a) => a.jobId)),
      // Jobs user has skipped — exclude from feed
      this.prisma.jobInteraction.findMany({
        where: { userId, action: 'skip' },
        select: { jobId: true },
      }).then((interactions) => interactions.map((i) => i.jobId)),
    ]);

    const excludeJobIds = [...new Set([...appliedJobIds, ...skippedJobIds])];

    // Fetch active jobs not excluded
    const jobs = await this.prisma.job.findMany({
      where: {
        status: JobStatus.ACTIVE,
        id: excludeJobIds.length > 0 ? { notIn: excludeJobIds } : undefined,
        // Exclude expired jobs
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        company: { select: { id: true, name: true, logoUrl: true, isVerified: true } },
        jobSkills: { include: { skill: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      // Fetch a larger pool to allow scoring + re-sorting
      take: 500,
    });

    const userLocation = await this.getUserLocation(userId);

    const now = Date.now();
    const scored: JobWithScore[] = jobs.map((job) => {
      const jobSkillIds = job.jobSkills.map((js) => js.skill.id);
      const skillsMatch = this.scoreSkills(userSkills, jobSkillIds);
      const locationMatch = this.scoreLocation(userLocation, job.location);
      const recency = this.scoreRecency(job.createdAt, now);
      const matchScore = skillsMatch + locationMatch + recency;

      return {
        ...job,
        matchScore,
        scoreBreakdown: { skillsMatch, locationMatch, recency },
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.matchScore - a.matchScore);

    const total = scored.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const items = scored.slice(start, end);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async refreshFeed(userId: string) {
    // Lightweight endpoint — just re-runs the feed calculation from scratch
    return this.getFeed(userId, { page: 1, limit: 20 });
  }

  // ── scoring helpers ───────────────────────────────────────────────────────

  private scoreSkills(userSkillIds: string[], jobSkillIds: string[]): number {
    if (jobSkillIds.length === 0) return 0;
    const matched = userSkillIds.filter((id) => jobSkillIds.includes(id)).length;
    return Math.round((matched / jobSkillIds.length) * MAX_SKILL_SCORE);
  }

  private scoreLocation(userLocation: string | null, jobLocation: string | null | undefined): number {
    if (!userLocation || !jobLocation) return 0;
    const normalize = (s: string) => s.toLowerCase().trim();
    const user = normalize(userLocation);
    const job = normalize(jobLocation);
    if (user === job) return MAX_LOCATION_SCORE;
    // Partial match — same city/county keyword
    const userTokens = user.split(/[\s,]+/);
    const jobTokens = job.split(/[\s,]+/);
    const overlap = userTokens.filter((t) => jobTokens.includes(t)).length;
    if (overlap > 0) return Math.round((overlap / Math.max(userTokens.length, jobTokens.length)) * MAX_LOCATION_SCORE);
    return 0;
  }

  private scoreRecency(createdAt: Date, now: number): number {
    const ageMs = now - createdAt.getTime();
    if (ageMs <= 0) return MAX_RECENCY_SCORE;
    if (ageMs >= RECENCY_WINDOW_MS) return 0;
    const fraction = 1 - ageMs / RECENCY_WINDOW_MS;
    return Math.round(fraction * MAX_RECENCY_SCORE);
  }

  // ── data helpers ──────────────────────────────────────────────────────────

  private async getUserSkillIds(userId: string): Promise<string[]> {
    // UserSkill covers all roles (job seekers + trainers)
    const userSkills = await this.prisma.userSkill.findMany({
      where: { userId },
      select: { skillId: true },
    });
    if (userSkills.length > 0) return userSkills.map((s) => s.skillId);

    // Fallback: trainer-only skill store (TrainerProfile → TrainerSkill)
    const trainerProfile = await this.prisma.trainerProfile.findUnique({
      where: { userId },
      include: { skills: { select: { skillId: true } } },
    });
    return trainerProfile?.skills.map((s) => s.skillId) ?? [];
  }

  private async getUserLocation(userId: string): Promise<string | null> {
    // JobSeekerProfile has location for CLIENT users
    const seekerProfile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId },
      select: { location: true },
    });
    if (seekerProfile?.location) return seekerProfile.location;

    // Fallback: TrainerProfile location fields
    const trainerProfile = await this.prisma.trainerProfile.findUnique({
      where: { userId },
      select: { location: true, city: true, county: true },
    });
    return trainerProfile?.city ?? trainerProfile?.county ?? trainerProfile?.location ?? null;
  }
}
