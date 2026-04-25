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
        firstName: true,
        lastName: true,
        name: true,
        avatar: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        jobSeekerProfile: true,
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
  // Update job seeker profile fields
  // ---------------------------------------------------------------------------
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.jobSeekerProfile.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
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
    const skill = await this.prisma.skill.findUnique({ where: { id: dto.skillId } });
    if (!skill) throw new NotFoundException('Skill not found');

    return this.prisma.userSkill.upsert({
      where: { userId_skillId: { userId, skillId: dto.skillId } },
      create: {
        userId,
        skillId: dto.skillId,
        proficiency: dto.proficiency ?? 'INTERMEDIATE',
      },
      update: {
        proficiency: dto.proficiency ?? 'INTERMEDIATE',
      },
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
