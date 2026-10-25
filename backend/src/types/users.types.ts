export interface UpdateProfileDTO {
  firstName?: string;
  lastName?: string;
  avatar?: string | null;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}
