import { IsIn, IsString, Length } from 'class-validator';
import { UserRole } from '@prisma/client';

/** Includes `customer`, which is how staff access is removed: the account
 *  survives, its back-office access does not. */
const ROLES = [
  'customer',
  'support',
  'operations',
  'compliance',
  'admin',
] as const satisfies readonly UserRole[];

export class AssignRoleDto {
  @IsIn(ROLES)
  role!: UserRole;

  @IsString()
  @Length(3, 200)
  reason!: string;
}
