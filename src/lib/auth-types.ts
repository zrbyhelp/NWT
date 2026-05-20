export const authRequiredCode = "AUTH_REQUIRED";

export type AuthViewer = {
  id: string;
  account: string | null;
  avatarUrl: string | null;
  displayName: string;
  role: "USER" | "ADMIN";
  showAiThinking: boolean;
};

export type AuthCredentialsInput = {
  account: string;
  password: string;
};

export type AuthActionResult = {
  viewer: AuthViewer;
};

export type AuthProfileInput = {
  avatarUrl?: string;
  displayName: string;
};

export type AuthPasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type AuthPreferencesInput = {
  showAiThinking: boolean;
};

export function isAuthRequiredError(error: unknown) {
  return error instanceof Error && error.message.includes(authRequiredCode);
}
