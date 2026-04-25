import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class FeedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export interface JobWithScore {
  id: string;
  companyId: string;
  title: string;
  description: string;
  requirements?: string | null;
  location?: string | null;
  jobType: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency: string;
  status: string;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  company: {
    id: string;
    name: string;
    logoUrl?: string | null;
    isVerified: boolean;
  };
  jobSkills: Array<{
    skill: { id: string; name: string };
  }>;
  matchScore: number;
  scoreBreakdown: {
    skillsMatch: number;
    locationMatch: number;
    recency: number;
  };
}
