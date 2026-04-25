import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  UpdateProfileDto,
  AddExperienceDto,
  UpdateExperienceDto,
  AddEducationDto,
  UpdateEducationDto,
  AddUserSkillDto,
} from './dto/profile.dto';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // ---------------------------------------------------------------------------
  // My profile (authenticated)
  // ---------------------------------------------------------------------------

  @Get('me')
  getMyProfile(@CurrentUser('id') userId: string) {
    return this.profileService.getMyProfile(userId);
  }

  @Patch('me')
  updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(userId, dto);
  }

  // ---------------------------------------------------------------------------
  // Work Experience (authenticated)
  // ---------------------------------------------------------------------------

  @Post('me/experience')
  addExperience(@CurrentUser('id') userId: string, @Body() dto: AddExperienceDto) {
    return this.profileService.addExperience(userId, dto);
  }

  @Patch('me/experience/:id')
  updateExperience(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExperienceDto,
  ) {
    return this.profileService.updateExperience(userId, id, dto);
  }

  @Delete('me/experience/:id')
  deleteExperience(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.profileService.deleteExperience(userId, id);
  }

  // ---------------------------------------------------------------------------
  // Education (authenticated)
  // ---------------------------------------------------------------------------

  @Post('me/education')
  addEducation(@CurrentUser('id') userId: string, @Body() dto: AddEducationDto) {
    return this.profileService.addEducation(userId, dto);
  }

  @Patch('me/education/:id')
  updateEducation(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEducationDto,
  ) {
    return this.profileService.updateEducation(userId, id, dto);
  }

  @Delete('me/education/:id')
  deleteEducation(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.profileService.deleteEducation(userId, id);
  }

  // ---------------------------------------------------------------------------
  // Skills (authenticated)
  // ---------------------------------------------------------------------------

  @Get('me/skills')
  listSkills(@CurrentUser('id') userId: string) {
    return this.profileService.listSkills(userId);
  }

  @Post('me/skills')
  addSkill(@CurrentUser('id') userId: string, @Body() dto: AddUserSkillDto) {
    return this.profileService.addSkill(userId, dto);
  }

  @Delete('me/skills/:skillId')
  removeSkill(@CurrentUser('id') userId: string, @Param('skillId') skillId: string) {
    return this.profileService.removeSkill(userId, skillId);
  }

  // ---------------------------------------------------------------------------
  // Public profile view (no auth required)
  // ---------------------------------------------------------------------------

  @Public()
  @Get(':userId')
  getPublicProfile(@Param('userId') userId: string) {
    return this.profileService.getPublicProfile(userId);
  }
}
