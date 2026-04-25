import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import {
  UpdateProfileDto,
  AddExperienceDto,
  UpdateExperienceDto,
  AddEducationDto,
  UpdateEducationDto,
  AddUserSkillDto,
} from './dto/profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Full profile for the current user (private view — all data)
  // ---------------------------------------------------------------------------
  async getMyProfile(userId: string) {
    // Upsert the jobSeekerProfile so first-time users always get an empty record
    await this.prisma.jobSeekerProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        name: true,
        avatar: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        jobSeekerProfile: true,
        trainerProfile: {
          select: {
            bio: true,
            location: true,
            firmName: true,
            specialization: true,
            linkedinUrl: true,
            isHiring: true,
          },
        },
        recruiter: {
          include: {
            company: {
              select: { id: true, name: true, logoUrl: true, website: true, description: true },
            },
          },
        },
        workExperience: {
          orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
        },
        education: {
          orderBy: [{ isCurrent: 'desc' }, { startYear: 'desc' }],
        },
        userSkills: {
          include: { skill: { select: { id: true, name: true, category: true } } },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { jobsPosted: true, applications: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ---------------------------------------------------------------------------
  // Public profile view for another user
  // ---------------------------------------------------------------------------
  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        avatar: true,
        role: true,
        createdAt: true,
        jobSeekerProfile: {
          select: {
            headline: true,
            bio: true,
            location: true,
            portfolioUrl: true,
            linkedinUrl: true,
            githubUrl: true,
            openToWork: true,
          },
        },
        workExperience: {
          orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
        },
        education: {
          orderBy: [{ isCurrent: 'desc' }, { startYear: 'desc' }],
        },
        userSkills: {
          include: { skill: { select: { id: true, name: true, category: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ---------------------------------------------------------------------------
  // Update profile — splits fields between User, jobSeekerProfile, trainerProfile
  // ---------------------------------------------------------------------------
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const { firstName, lastName, avatar, isHiring, ...profileFields } = dto;

    // Update User-level fields if provided
    const userUpdate: any = {};
    if (firstName !== undefined) userUpdate.firstName = firstName;
    if (lastName !== undefined) userUpdate.lastName = lastName;
    if (avatar !== undefined) userUpdate.avatar = avatar;
    if (Object.keys(userUpdate).length > 0) {
      await this.prisma.user.update({ where: { id: userId }, data: userUpdate });
    }

    // Update trainerProfile.isHiring if provided
    if (isHiring !== undefined) {
      await this.prisma.trainerProfile.updateMany({
        where: { userId },
        data: { isHiring },
      });
    }

    // Update jobSeekerProfile fields
    return this.prisma.jobSeekerProfile.upsert({
      where: { userId },
      create: { userId, ...profileFields },
      update: profileFields,
    });
  }

  // ---------------------------------------------------------------------------
  // Work Experience
  // ---------------------------------------------------------------------------
  async addExperience(userId: string, dto: AddExperienceDto) {
    return this.prisma.workExperience.create({
      data: {
        userId,
        company: dto.company,
        title: dto.title,
        location: dto.location,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isCurrent: dto.isCurrent ?? false,
        description: dto.description,
      },
    });
  }

  async updateExperience(userId: string, id: string, dto: UpdateExperienceDto) {
    const exp = await this.prisma.workExperience.findUnique({ where: { id } });
    if (!exp) throw new NotFoundException('Experience record not found');
    if (exp.userId !== userId) throw new ForbiddenException('Not your experience record');

    return this.prisma.workExperience.update({
      where: { id },
      data: {
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.isCurrent !== undefined && { isCurrent: dto.isCurrent }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  async deleteExperience(userId: string, id: string) {
    const exp = await this.prisma.workExperience.findUnique({ where: { id } });
    if (!exp) throw new NotFoundException('Experience record not found');
    if (exp.userId !== userId) throw new ForbiddenException('Not your experience record');
    await this.prisma.workExperience.delete({ where: { id } });
    return { message: 'Experience deleted' };
  }

  // ---------------------------------------------------------------------------
  // Education
  // ---------------------------------------------------------------------------
  async addEducation(userId: string, dto: AddEducationDto) {
    return this.prisma.education.create({
      data: {
        userId,
        institution: dto.institution,
        degree: dto.degree,
        fieldOfStudy: dto.fieldOfStudy,
        startYear: dto.startYear,
        endYear: dto.endYear,
        isCurrent: dto.isCurrent ?? false,
      },
    });
  }

  async updateEducation(userId: string, id: string, dto: UpdateEducationDto) {
    const edu = await this.prisma.education.findUnique({ where: { id } });
    if (!edu) throw new NotFoundException('Education record not found');
    if (edu.userId !== userId) throw new ForbiddenException('Not your education record');

    return this.prisma.education.update({
      where: { id },
      data: {
        ...(dto.institution !== undefined && { institution: dto.institution }),
        ...(dto.degree !== undefined && { degree: dto.degree }),
        ...(dto.fieldOfStudy !== undefined && { fieldOfStudy: dto.fieldOfStudy }),
        ...(dto.startYear !== undefined && { startYear: dto.startYear }),
        ...(dto.endYear !== undefined && { endYear: dto.endYear }),
        ...(dto.isCurrent !== undefined && { isCurrent: dto.isCurrent }),
      },
    });
  }

  async deleteEducation(userId: string, id: string) {
    const edu = await this.prisma.education.findUnique({ where: { id } });
    if (!edu) throw new NotFoundException('Education record not found');
    if (edu.userId !== userId) throw new ForbiddenException('Not your education record');
    await this.prisma.education.delete({ where: { id } });
    return { message: 'Education deleted' };
  }

  // ---------------------------------------------------------------------------
  // Skills
  // ---------------------------------------------------------------------------
  async listSkills(userId: string) {
    return this.prisma.userSkill.findMany({
      where: { userId },
      include: { skill: { select: { id: true, name: true, category: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addSkill(userId: string, dto: AddUserSkillDto) {
    let skillId = dto.skillId;

    if (!skillId) {
      if (!dto.skillName) throw new NotFoundException('Provide skillId or skillName');
      // Find or create the skill by name (case-insensitive match first)
      const normalizedName = dto.skillName.trim();
      const existing = await this.prisma.skill.findFirst({
        where: { name: { equals: normalizedName, mode: 'insensitive' } },
      });
      if (existing) {
        skillId = existing.id;
      } else {
        const created = await this.prisma.skill.create({
          data: { name: normalizedName, isActive: true },
        });
        skillId = created.id;
      }
    } else {
      const skill = await this.prisma.skill.findUnique({ where: { id: skillId } });
      if (!skill) throw new NotFoundException('Skill not found');
    }

    return this.prisma.userSkill.upsert({
      where: { userId_skillId: { userId, skillId } },
      create: { userId, skillId, proficiency: dto.proficiency ?? 'INTERMEDIATE' },
      update: { proficiency: dto.proficiency ?? 'INTERMEDIATE' },
      include: { skill: { select: { id: true, name: true, category: true } } },
    });
  }

  async removeSkill(userId: string, skillId: string) {
    const existing = await this.prisma.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId } },
    });
    if (!existing) throw new NotFoundException('Skill not in your profile');

    await this.prisma.userSkill.delete({
      where: { userId_skillId: { userId, skillId } },
    });
    return { message: 'Skill removed' };
  }
}
