export const authRequiredEventName = "nwt:auth-required";

export function requestClientAuth() {
  window.dispatchEvent(new Event(authRequiredEventName));
}
