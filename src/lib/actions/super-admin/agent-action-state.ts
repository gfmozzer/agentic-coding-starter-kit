export interface ActionState {
  success?: string;
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
}

export const initialActionState: ActionState = {};
