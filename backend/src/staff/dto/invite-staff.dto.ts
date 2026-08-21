import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { UserRole } from '@prisma/client';

/** The roles that can be handed out. `customer` is not one of them — this
 *  endpoint creates back-office accounts, and demoting someone to a customer
 *  is a role change, not an invitation. */
export const ASSIGNABLE_ROLES = [
  'support',
  'operations',
  'compliance',
  'admin',
] as const satisfies readonly UserRole[];

export class InviteStaffDto {
  @IsEmail()
  email!: string;

  @IsIn(ASSIGNABLE_ROLES)
  role!: (typeof ASSIGNABLE_ROLES)[number];

  @IsOptional()
  @IsString()
  @Length(1, 80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  lastName?: string;

  /** Why this person needs this access. Read by whoever reviews the compliance
   *  programme, who will not accept "because they asked". */
  @IsString()
  @Length(3, 200)
  reason!: string;

  /**
   * Send the setup code to their address as well as showing it.
   *
   * Off by default. The code is always returned to the admin who created the
   * account, so this adds a second copy rather than choosing where it goes —
   * useful when the new colleague is not in the room, pointless when they are.
   */
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}
