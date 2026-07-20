-- Add password reset fields to User
ALTER TABLE "User" ADD COLUMN "pwResetToken" TEXT;
ALTER TABLE "User" ADD COLUMN "pwResetExpires" TIMESTAMP(3);
